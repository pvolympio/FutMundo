"""Carga do Wikidata para o PostgreSQL.

Uso (na raiz do projeto):
    python -m pipeline.carga --papel ambos --paises BR --limite 200

A carga é idempotente e retomável: pessoas já carregadas são puladas (a menos
que você passe --atualizar), então dá para interromper com Ctrl+C e continuar
depois. Cada lote é gravado numa única transação, e nada é gravado se a busca
no Wikidata falhar.
"""
from __future__ import annotations

import argparse
import logging
import os
import re
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

from . import consultas as q
from .cliente_wikidata import ClienteWikidata, ErroWikidata
from .utils import (
    arquivo_commons, em_lotes, eh_qid, id_declaracao, inteiro,
    normalizar_pe, parse_data, qid_de_uri, slugify,
)

log = logging.getLogger("carga")
FONTE = "wikidata"


def _rotulo(valor: str | None) -> str | None:
    """O serviço de rótulos devolve o próprio QID quando não há tradução. Trata como vazio."""
    return None if not valor or eh_qid(valor) else valor


def _mesclar(linhas: list[dict], chave: str) -> dict[str, dict]:
    """Junta várias linhas do mesmo item, ficando com o primeiro valor de cada campo."""
    saida: dict[str, dict] = {}
    for linha in linhas:
        destino = saida.setdefault(qid_de_uri(linha[chave]), {})
        for campo, valor in linha.items():
            destino.setdefault(campo, valor)
    return saida


class Carga:
    def __init__(self, conn, cliente: ClienteWikidata):
        self.conn = conn
        self.cli = cliente
        self.paises = self._mapa("pais")
        self.posicoes = self._mapa("posicao")
        self.equipes = self._mapa("equipe")
        self.totais = {"pessoas": 0, "equipes": 0, "vinculos": 0, "lotes_com_erro": 0}
        self._lote = {"pessoas": 0, "equipes": 0, "vinculos": 0}  # só entra em totais após o commit

    # ------------------------------------------------------------------ apoio
    def _mapa(self, tabela: str) -> dict[str, int]:
        with self.conn.cursor() as cur:
            cur.execute(f"SELECT wikidata_id, id FROM {tabela}")  # nome de tabela fixo, não vem do usuário
            return dict(cur.fetchall())

    def recarregar_caches(self) -> None:
        """Após um rollback, os ids em cache podem apontar para linhas que não existem mais."""
        self.paises = self._mapa("pais")
        self.posicoes = self._mapa("posicao")
        self.equipes = self._mapa("equipe")

    def _fechar_lote(self) -> None:
        self.conn.commit()
        for chave, valor in self._lote.items():
            self.totais[chave] += valor

    def ja_carregadas(self, papel: str) -> set[str]:
        tabela = "jogador" if papel == "jogador" else "treinador"
        with self.conn.cursor() as cur:
            cur.execute(
                f"SELECT p.wikidata_id FROM pessoa p JOIN {tabela} t ON t.pessoa_id = p.id"
            )
            return {r[0] for r in cur.fetchall()}

    # ------------------------------------------------- fase 1: buscar (rede)
    def _buscar_equipes(self, qids: list[str]) -> dict[str, dict]:
        """Detalhes das equipes que ainda não estão no banco."""
        novas = [x for x in dict.fromkeys(qids) if x not in self.equipes]
        detalhes: dict[str, dict] = {}
        for sub in em_lotes(novas, 200):
            for linha in self.cli.consultar(q.detalhes_equipes(sub)):
                d = detalhes.setdefault(qid_de_uri(linha["t"]), {})
                for campo, valor in linha.items():
                    if campo in ("nomeCurto", "nomeCurtoLang"):
                        continue
                    d.setdefault(campo, valor)
                if "nomeCurto" in linha:  # prefere o nome curto em português
                    em_pt = linha.get("nomeCurtoLang", "").startswith("pt")
                    if "nomeCurto" not in d or (em_pt and not d.get("_curto_pt")):
                        d["nomeCurto"], d["_curto_pt"] = linha["nomeCurto"], em_pt
        return detalhes

    # -------------------------------------------------- fase 2: gravar (banco)
    def _gravar_paises(self, itens: dict[str, tuple[str, str | None]]) -> None:
        novos = [(qid, nome, iso if iso and len(iso) == 2 else None)
                 for qid, (nome, iso) in itens.items() if qid not in self.paises]
        if not novos:
            return
        with self.conn.cursor() as cur:
            res = execute_values(
                cur,
                "INSERT INTO pais (wikidata_id, nome, codigo_iso2) VALUES %s "
                "ON CONFLICT (wikidata_id) DO UPDATE SET nome = EXCLUDED.nome "
                "RETURNING wikidata_id, id",
                novos, fetch=True,
            )
        self.paises.update(dict(res))

    def _gravar_posicoes(self, itens: dict[str, str]) -> None:
        novos = [(qid, nome) for qid, nome in itens.items() if qid not in self.posicoes]
        if not novos:
            return
        with self.conn.cursor() as cur:
            res = execute_values(
                cur,
                "INSERT INTO posicao (wikidata_id, nome) VALUES %s "
                "ON CONFLICT (wikidata_id) DO UPDATE SET nome = EXCLUDED.nome "
                "RETURNING wikidata_id, id",
                novos, fetch=True,
            )
        self.posicoes.update(dict(res))

    def _gravar_equipes(self, detalhes: dict[str, dict]) -> None:
        if not detalhes:
            return
        paises = {}
        for d in detalhes.values():
            if d.get("pais"):
                paises[qid_de_uri(d["pais"])] = (d.get("paisLabel") or d["pais"], d.get("iso"))
        self._gravar_paises(paises)

        linhas = []
        for qid, d in detalhes.items():
            nome = d.get("tLabel") or qid
            if d.get("ehSelecao") == "true":
                tipo = "selecao"
            elif d.get("ehClube") == "true":
                tipo = "clube"
            else:
                tipo = "outro"
            fundacao, _ = parse_data(d.get("fund"), "11")
            ano = fundacao.year if fundacao and 1800 <= fundacao.year <= 2100 else None
            linhas.append((
                qid, slugify(nome, qid), nome, _rotulo(d.get("nomeCurto")), tipo,
                self.paises.get(qid_de_uri(d["pais"])) if d.get("pais") else None,
                ano, _rotulo(d.get("estadioLabel")), arquivo_commons(d.get("logo")),
            ))
        with self.conn.cursor() as cur:
            res = execute_values(
                cur,
                """INSERT INTO equipe (wikidata_id, slug, nome, nome_curto, tipo, pais_id,
                                       ano_fundacao, estadio, escudo_commons)
                   VALUES %s
                   ON CONFLICT (wikidata_id) DO UPDATE SET
                       nome = EXCLUDED.nome, nome_curto = EXCLUDED.nome_curto,
                       tipo = EXCLUDED.tipo, pais_id = EXCLUDED.pais_id,
                       ano_fundacao = EXCLUDED.ano_fundacao, estadio = EXCLUDED.estadio,
                       escudo_commons = EXCLUDED.escudo_commons, atualizado_em = now()
                   RETURNING wikidata_id, id""",
                linhas, fetch=True,
            )
        self.equipes.update(dict(res))
        self._lote["equipes"] += len(res)

    # ------------------------------------------------------- um lote completo
    def processar_lote(self, papel: str, qids: list[str]) -> None:
        funcao = "jogador" if papel == "jogador" else "treinador"
        self._lote = {"pessoas": 0, "equipes": 0, "vinculos": 0}

        # --- rede: tudo é buscado antes de gravar qualquer coisa ---
        det = _mesclar(self.cli.consultar(q.detalhes_pessoas(qids)), "p")
        nac = self.cli.consultar(q.nacionalidades(qids))
        if papel == "jogador":
            pos = self.cli.consultar(q.posicoes(qids))
            vinc = self.cli.consultar(q.vinculos_jogador(qids))
        else:
            pos, vinc = [], self.cli.consultar(q.vinculos_treinador(qids))
        equipes_novas = self._buscar_equipes([qid_de_uri(v["time"]) for v in vinc])

        # --- banco: uma transação para o lote inteiro ---
        self._gravar_equipes(equipes_novas)

        linhas_pessoa = []
        for qid in qids:
            d = det.get(qid, {})
            nome = _rotulo(d.get("pLabel"))
            if not nome:
                continue  # sem nome em pt/en não serve para exibir
            nasc, nprec = parse_data(d.get("nasc"), d.get("nascPrec"))
            obito, oprec = parse_data(d.get("obito"), d.get("obitoPrec"))
            linhas_pessoa.append((
                qid, slugify(nome, qid), nome, nasc, nprec, _rotulo(d.get("localItemLabel")),
                obito, oprec, arquivo_commons(d.get("imagem")),
            ))
        if not linhas_pessoa:
            self._fechar_lote()  # as equipes novas já foram gravadas: confirma
            return
        with self.conn.cursor() as cur:
            res = execute_values(
                cur,
                """INSERT INTO pessoa (wikidata_id, slug, nome, data_nascimento, precisao_nascimento,
                                       local_nascimento, data_falecimento, precisao_falecimento,
                                       imagem_commons)
                   VALUES %s
                   ON CONFLICT (wikidata_id) DO UPDATE SET
                       nome = EXCLUDED.nome, data_nascimento = EXCLUDED.data_nascimento,
                       precisao_nascimento = EXCLUDED.precisao_nascimento,
                       local_nascimento = EXCLUDED.local_nascimento,
                       data_falecimento = EXCLUDED.data_falecimento,
                       precisao_falecimento = EXCLUDED.precisao_falecimento,
                       imagem_commons = EXCLUDED.imagem_commons, atualizado_em = now()
                   RETURNING wikidata_id, id""",
                linhas_pessoa, fetch=True,
            )
        ids = dict(res)
        ids_lista = list(ids.values())
        self._lote["pessoas"] += len(ids)

        with self.conn.cursor() as cur:
            if papel == "jogador":
                linhas = []
                for qid, pid in ids.items():
                    d = det[qid]
                    altura = None
                    if d.get("alturaM"):
                        cm = round(float(d["alturaM"]) * 100)
                        altura = cm if 120 <= cm <= 240 else None
                    linhas.append((pid, altura, normalizar_pe(d.get("peItemLabel"))))
                execute_values(
                    cur,
                    """INSERT INTO jogador (pessoa_id, altura_cm, pe_preferido) VALUES %s
                       ON CONFLICT (pessoa_id) DO UPDATE SET
                           altura_cm = EXCLUDED.altura_cm, pe_preferido = EXCLUDED.pe_preferido""",
                    linhas,
                )
            else:
                execute_values(
                    cur,
                    "INSERT INTO treinador (pessoa_id) VALUES %s ON CONFLICT DO NOTHING",
                    [(pid,) for pid in ids_lista],
                )

        # nacionalidades: apaga e regrava o que veio do Wikidata para este lote
        paises = {qid_de_uri(n["pais"]): (n.get("paisLabel") or n["pais"], n.get("iso")) for n in nac}
        self._gravar_paises(paises)
        pares = {(ids[qid_de_uri(n["p"])], self.paises[qid_de_uri(n["pais"])])
                 for n in nac if qid_de_uri(n["p"]) in ids}
        with self.conn.cursor() as cur:
            cur.execute("DELETE FROM pessoa_pais WHERE pessoa_id = ANY(%s)", (ids_lista,))
            if pares:
                execute_values(cur, "INSERT INTO pessoa_pais (pessoa_id, pais_id) VALUES %s", list(pares))

        # posições (só jogadores)
        if papel == "jogador":
            self._gravar_posicoes({qid_de_uri(p["pos"]): p.get("posLabel") or p["pos"] for p in pos})
            pares = {(ids[qid_de_uri(p["p"])], self.posicoes[qid_de_uri(p["pos"])])
                     for p in pos if qid_de_uri(p["p"]) in ids}
            with self.conn.cursor() as cur:
                cur.execute("DELETE FROM jogador_posicao WHERE pessoa_id = ANY(%s)", (ids_lista,))
                if pares:
                    execute_values(cur, "INSERT INTO jogador_posicao (pessoa_id, posicao_id) VALUES %s", list(pares))

        # vínculos (a carreira)
        registros: dict[str, tuple] = {}
        vistos_treinador: set[tuple] = set()
        for v in vinc:
            pqid, eqid = qid_de_uri(v["p"]), qid_de_uri(v["time"])
            if pqid not in ids or eqid not in self.equipes:
                continue
            fonte_id = id_declaracao(v["st"])
            if fonte_id in registros:
                continue
            ini, iprec = parse_data(v.get("ini"), v.get("iniPrec"))
            fim, fprec = parse_data(v.get("fim"), v.get("fimPrec"))
            if ini and fim and fim < ini:  # dado inconsistente na fonte: descarta o fim
                fim, fprec = None, None
            if papel == "treinador":  # a mesma passagem pode vir por P6087 e por P286
                chave = (pqid, eqid, ini, fim)
                if chave in vistos_treinador:
                    continue
                vistos_treinador.add(chave)
            registros[fonte_id] = (
                ids[pqid], self.equipes[eqid], funcao, ini, iprec, fim, fprec,
                inteiro(v.get("camisa"), 0, 999), inteiro(v.get("jogos"), 0, 10_000),
                inteiro(v.get("gols"), 0, 10_000), FONTE, fonte_id,
            )
        with self.conn.cursor() as cur:
            cur.execute(
                "DELETE FROM vinculo WHERE pessoa_id = ANY(%s) AND funcao = %s AND fonte = %s",
                (ids_lista, funcao, FONTE),
            )
            if registros:
                execute_values(
                    cur,
                    """INSERT INTO vinculo (pessoa_id, equipe_id, funcao, data_inicio, precisao_inicio,
                                            data_fim, precisao_fim, numero_camisa, jogos, gols,
                                            fonte, fonte_id)
                       VALUES %s""",
                    list(registros.values()), page_size=1000,
                )
        self._lote["vinculos"] += len(registros)
        self._fechar_lote()


# ---------------------------------------------------------------------- CLI
def _carregar_dotenv(caminho: str = ".env") -> None:
    p = Path(caminho)
    if not p.exists():
        return
    for linha in p.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if linha and not linha.startswith("#") and "=" in linha:
            chave, valor = linha.split("=", 1)
            os.environ.setdefault(chave.strip(), valor.strip().strip('"').strip("'"))


def _iso(valor: str) -> str:
    v = valor.upper()
    if not re.fullmatch(r"[A-Z]{2}", v):
        raise argparse.ArgumentTypeError(f"{valor!r} não é um código ISO de 2 letras (ex.: BR)")
    return v


def _args(argv=None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Carrega jogadores, treinadores e equipes do Wikidata.")
    ap.add_argument("--papel", choices=["jogadores", "treinadores", "ambos"], default="ambos")
    ap.add_argument("--paises", nargs="+", type=_iso, metavar="ISO",
                    help="filtra pela cidadania (ex.: BR AR PT). Sem isso, carrega o mundo todo.")
    ap.add_argument("--limite", type=int, help="máximo de pessoas por papel (bom para testar)")
    ap.add_argument("--lote", type=int, default=150, help="pessoas por lote (padrão: 150)")
    ap.add_argument("--pausa", type=float, default=1.0, help="segundos entre consultas (padrão: 1)")
    ap.add_argument("--atualizar", action="store_true", help="reprocessa pessoas já carregadas")
    ap.add_argument("--database-url", default=None)
    ap.add_argument("--user-agent", default=None)
    return ap.parse_args(argv)


def main(argv=None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(message)s", datefmt="%H:%M:%S")
    _carregar_dotenv()
    args = _args(argv)
    url = args.database_url or os.environ.get("DATABASE_URL")
    agente = args.user_agent or os.environ.get("WDQS_USER_AGENT", "")
    if not url:
        log.error("Defina DATABASE_URL (no .env ou no ambiente).")
        return 2
    if not agente or "exemplo.com" in agente or not re.search(r"@|https?://", agente):
        log.error("Defina WDQS_USER_AGENT com seu contato real, como pede a política do Wikimedia. "
                  "Ex.: futebol-db/0.1 (https://github.com/seu-usuario/futebol-db; voce@email.com)")
        return 2

    conn = psycopg2.connect(url)
    carga = Carga(conn, ClienteWikidata(agente, pausa=args.pausa))
    papeis = {"jogadores": ["jogador"], "treinadores": ["treinador"], "ambos": ["jogador", "treinador"]}[args.papel]
    escopo = f"papel={args.papel} paises={','.join(args.paises) if args.paises else 'mundo'} limite={args.limite}"

    with conn.cursor() as cur:
        cur.execute("INSERT INTO carga_ingestao (fonte, escopo) VALUES (%s, %s) RETURNING id", (FONTE, escopo))
        carga_id = cur.fetchone()[0]
    conn.commit()

    falhas_seguidas = 0
    try:
        for papel in papeis:
            ocupacao = q.OCUPACAO_JOGADOR if papel == "jogador" else q.OCUPACAO_TREINADOR
            log.info("Buscando a lista de %ses (%s)...", papel, escopo)
            linhas = carga.cli.consultar(q.ids_pessoas(ocupacao, args.paises, args.limite))
            qids = sorted({qid_de_uri(l["p"]) for l in linhas}, key=lambda x: int(x[1:]))
            if not args.atualizar:
                feitos = carga.ja_carregadas(papel)
                qids = [x for x in qids if x not in feitos]
            lotes = list(em_lotes(qids, args.lote))
            log.info("%d %ses para processar em %d lotes.", len(qids), papel, len(lotes))
            for i, lote in enumerate(lotes, 1):
                try:
                    carga.processar_lote(papel, lote)
                    falhas_seguidas = 0
                    log.info("[%s %d/%d] pessoas=%d equipes=%d vínculos=%d", papel, i, len(lotes),
                             carga.totais["pessoas"], carga.totais["equipes"], carga.totais["vinculos"])
                except (ErroWikidata, psycopg2.Error) as exc:
                    conn.rollback()
                    carga.recarregar_caches()
                    carga.totais["lotes_com_erro"] += 1
                    falhas_seguidas += 1
                    log.error("Lote %d/%d falhou e foi ignorado: %s", i, len(lotes), exc)
                    if falhas_seguidas >= 5:
                        log.error("5 falhas seguidas. Abortando; rode de novo mais tarde (a carga retoma de onde parou).")
                        return 1
    except KeyboardInterrupt:
        conn.rollback()
        log.warning("Interrompido. O que já foi gravado fica; rode de novo para continuar.")
    finally:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE carga_ingestao SET finalizado_em = now(), pessoas = %s, equipes = %s, "
                "vinculos = %s, lotes_com_erro = %s WHERE id = %s",
                (carga.totais["pessoas"], carga.totais["equipes"], carga.totais["vinculos"],
                 carga.totais["lotes_com_erro"], carga_id),
            )
        conn.commit()
        conn.close()
    log.info("Concluído: %s", carga.totais)
    return 0


if __name__ == "__main__":
    sys.exit(main())
