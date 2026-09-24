"""Teste ponta a ponta da carga, sem internet.

O Wikidata é substituído por respostas fixas (incluindo casos sujos: duplicatas,
data final antes da inicial, item sem rótulo, mesma passagem de treinador vinda
por dois caminhos). O banco é real: o teste recria o esquema a partir de db/schema.sql.

Rodar:  DATABASE_URL_TESTE=postgresql://futebol:futebol@localhost:5432/futebol pytest -q
CUIDADO: o teste APAGA o schema public do banco apontado. Use um banco de teste.
"""
import os
from pathlib import Path

import psycopg2
import pytest

from pipeline import carga
from pipeline.cliente_wikidata import ClienteWikidata

URL = os.environ.get("DATABASE_URL_TESTE")
pytestmark = pytest.mark.skipif(not URL, reason="defina DATABASE_URL_TESTE")

W = "http://www.wikidata.org/entity/"


def e(qid):
    return W + qid


def st(n):
    return f"{W}statement/Q9-{n}"


# --------------------------------------------------------------- Wikidata falso
def wikidata_falso(_self, sparql: str):
    if "SELECT DISTINCT ?p" in sparql:
        if "Q937857" in sparql:
            return [{"p": e("Q1001")}, {"p": e("Q1002")}, {"p": e("Q1003")}]
        return [{"p": e("Q1002")}, {"p": e("Q1004")}]
    if "wikibase:quantityAmount" in sparql:  # detalhes_pessoas
        return [
            {"p": e("Q1001"), "pLabel": "Zé Craque", "nasc": "1992-02-05T00:00:00Z", "nascPrec": "11",
             "alturaM": "1.83", "peItemLabel": "right-footed", "localItemLabel": "Itajubá",
             "imagem": "http://commons.wikimedia.org/wiki/Special:FilePath/Ze%20Craque.jpg"},
            {"p": e("Q1001"), "pLabel": "Zé Craque", "nasc": "1992-02-05T00:00:00Z", "nascPrec": "11",
             "imagem": "http://commons.wikimedia.org/wiki/Special:FilePath/Outra.jpg"},  # duplicata
            {"p": e("Q1002"), "pLabel": "João Ano", "nasc": "1985-01-01T00:00:00Z", "nascPrec": "9"},
            {"p": e("Q1003"), "pLabel": "Q1003"},  # sem rótulo: deve ser ignorado
            {"p": e("Q1004"), "pLabel": "Mister Tático"},
        ]
    if "SELECT ?p ?pais ?paisLabel" in sparql:
        return [
            {"p": e("Q1001"), "pais": e("Q155"), "paisLabel": "Brasil", "iso": "BR"},
            {"p": e("Q1002"), "pais": e("Q155"), "paisLabel": "Brasil", "iso": "BR"},
            {"p": e("Q1002"), "pais": e("Q414"), "paisLabel": "Argentina", "iso": "AR"},
        ]
    if "SELECT ?p ?pos" in sparql:
        return [
            {"p": e("Q1001"), "pos": e("Q201"), "posLabel": "atacante"},
            {"p": e("Q1002"), "pos": e("Q201"), "posLabel": "atacante"},
            {"p": e("Q1002"), "pos": e("Q202"), "posLabel": "zagueiro"},
        ]
    if "ps:P54" in sparql:
        return [
            {"st": st(1), "p": e("Q1001"), "time": e("Q2001"), "ini": "2010-01-01T00:00:00Z", "iniPrec": "9",
             "fim": "2014-06-30T00:00:00Z", "fimPrec": "11", "jogos": "100", "gols": "20", "camisa": "10"},
            {"st": st(1), "p": e("Q1001"), "time": e("Q2001"), "gols": "21"},  # mesma declaração repetida
            {"st": st(2), "p": e("Q1001"), "time": e("Q2002"), "ini": "2012-03-01T00:00:00Z", "iniPrec": "11",
             "fim": "2011-01-01T00:00:00Z", "fimPrec": "11", "camisa": "9?"},  # fim antes do início
            {"st": st(3), "p": e("Q1002"), "time": e("Q2001")},
            {"st": st(4), "p": e("Q1003"), "time": e("Q2001")},  # pessoa ignorada
        ]
    if "ps:P6087" in sparql:
        return [
            {"st": st(5), "p": e("Q1002"), "time": e("Q2001"), "ini": "2018-01-01T00:00:00Z", "iniPrec": "9",
             "fim": "2019-01-01T00:00:00Z", "fimPrec": "9"},
            {"st": st(6), "p": e("Q1002"), "time": e("Q2001"), "ini": "2018-01-01T00:00:00Z", "iniPrec": "9",
             "fim": "2019-01-01T00:00:00Z", "fimPrec": "9"},  # mesma passagem, outro caminho
            {"st": st(7), "p": e("Q1004"), "time": e("Q2003"), "ini": "2020-05-10T00:00:00Z", "iniPrec": "11"},
        ]
    if "SELECT ?t ?tLabel" in sparql:
        base = {
            "Q2001": {"t": e("Q2001"), "tLabel": "Clube A", "pais": e("Q155"), "paisLabel": "Brasil", "iso": "BR",
                      "fund": "1895-11-17T00:00:00Z", "estadioLabel": "Estádio A", "ehSelecao": "false",
                      "ehClube": "true", "nomeCurto": "Clube A FC", "nomeCurtoLang": "en",
                      "logo": "http://commons.wikimedia.org/wiki/Special:FilePath/Escudo%20A.svg"},
            "Q2002": {"t": e("Q2002"), "tLabel": "Seleção B", "pais": e("Q155"), "paisLabel": "Brasil",
                      "iso": "BR", "ehSelecao": "true", "ehClube": "false"},
            "Q2003": {"t": e("Q2003"), "tLabel": "Clube C", "ehSelecao": "false", "ehClube": "true"},
        }
        linhas = [v for k, v in base.items() if f"wd:{k}" in sparql]
        if "wd:Q2001" in sparql:
            linhas.append({"t": e("Q2001"), "tLabel": "Clube A", "nomeCurto": "Clubinho", "nomeCurtoLang": "pt",
                           "ehSelecao": "false", "ehClube": "true"})
        return linhas
    raise AssertionError("consulta inesperada:\n" + sparql[:200])


# -------------------------------------------------------------------- fixtures
@pytest.fixture()
def conn(monkeypatch):
    monkeypatch.setattr(ClienteWikidata, "consultar", wikidata_falso)
    c = psycopg2.connect(URL)
    with c.cursor() as cur:
        cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        cur.execute((Path(__file__).parent.parent / "db" / "schema.sql").read_text(encoding="utf-8"))
    c.commit()
    yield c
    c.close()


def rodar(*extra):
    return carga.main(["--database-url", URL, "--user-agent", "teste/0.1 (teste@email.com)",
                       "--pausa", "0", *extra])


def contar(conn, tabela):
    with conn.cursor() as cur:
        cur.execute(f"SELECT count(*) FROM {tabela}")
        return cur.fetchone()[0]


def consulta(conn, sql, *params):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


# ---------------------------------------------------------------------- testes
def test_carga_completa(conn):
    assert rodar() == 0
    conn.commit()

    assert contar(conn, "pessoa") == 3           # Q1001, Q1002, Q1004 (Q1003 sem rótulo ficou de fora)
    assert contar(conn, "jogador") == 2
    assert contar(conn, "treinador") == 2        # Q1002 é jogador e treinador
    assert contar(conn, "equipe") == 3
    assert contar(conn, "pais") == 2
    assert contar(conn, "vinculo") == 3 + 2      # 3 de jogador, 2 de treinador (a repetida foi descartada)

    (nome, nasc, prec, alt, pe, img), = consulta(
        conn, """SELECT p.nome, p.data_nascimento, p.precisao_nascimento, j.altura_cm, j.pe_preferido, p.imagem_commons
                   FROM pessoa p JOIN jogador j ON j.pessoa_id = p.id WHERE p.wikidata_id = 'Q1001'""")
    assert (nome, str(nasc), prec, alt, pe, img) == ("Zé Craque", "1992-02-05", 11, 183, "direito", "Ze Craque.jpg")

    (prec_ano,), = consulta(conn, "SELECT precisao_nascimento FROM pessoa WHERE wikidata_id = 'Q1002'")
    assert prec_ano == 9                         # só o ano: a precisão é preservada

    # fim antes do início foi descartado em vez de derrubar o lote
    (fim, camisa), = consulta(conn, "SELECT data_fim, numero_camisa FROM vinculo WHERE fonte_id = 'Q9-2'")
    assert fim is None and camisa == 9   # "9?" vira 9

    tipos = dict(consulta(conn, "SELECT wikidata_id, tipo FROM equipe"))
    assert tipos == {"Q2001": "clube", "Q2002": "selecao", "Q2003": "clube"}
    (curto,), = consulta(conn, "SELECT nome_curto FROM equipe WHERE wikidata_id = 'Q2001'")
    assert curto == "Clubinho"                   # prefere o nome curto em português

    # busca sem acento e a view de jogador
    assert consulta(conn, "SELECT nome FROM buscar_pessoas('ze craque')") == [("Zé Craque",)]
    (nacs, poss), = consulta(conn, "SELECT nacionalidades, posicoes FROM vw_jogador WHERE nome = 'João Ano'")
    assert nacs == ["Argentina", "Brasil"] and poss == ["atacante", "zagueiro"]


def test_reexecucao_e_idempotente(conn):
    assert rodar() == 0
    assert rodar() == 0                          # nada novo para carregar
    assert rodar("--atualizar") == 0             # reprocessa tudo, sem duplicar
    conn.commit()
    assert contar(conn, "pessoa") == 3
    assert contar(conn, "vinculo") == 5
    assert contar(conn, "pessoa_pais") == 3
    assert contar(conn, "jogador_posicao") == 3
    assert contar(conn, "carga_ingestao") == 3


def test_lote_que_falha_nao_deixa_lixo_e_a_proxima_rodada_recupera(conn, monkeypatch):
    original = carga.execute_values
    estado = {"falhou": False}

    def instavel(cur, sql, *args, **kwargs):
        if "INSERT INTO vinculo" in sql and not estado["falhou"]:
            estado["falhou"] = True
            raise psycopg2.errors.CheckViolation("falha injetada")
        return original(cur, sql, *args, **kwargs)

    monkeypatch.setattr(carga, "execute_values", instavel)
    assert rodar("--papel", "jogadores", "--lote", "2") == 0   # o lote 1 falha e é ignorado
    conn.commit()
    assert contar(conn, "pessoa") == 0                          # rollback completo, sem meia-carga

    assert rodar("--papel", "jogadores", "--lote", "2") == 0   # a nova rodada recupera
    conn.commit()
    assert contar(conn, "pessoa") == 2
    assert contar(conn, "vinculo") == 3
