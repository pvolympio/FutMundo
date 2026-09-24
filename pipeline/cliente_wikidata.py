"""Cliente mínimo e educado do Wikidata Query Service (SPARQL)."""
from __future__ import annotations

import logging
import time

import requests

URL = "https://query.wikidata.org/sparql"
log = logging.getLogger(__name__)


class ErroWikidata(RuntimeError):
    pass


class ClienteWikidata:
    """Faz consultas SPARQL sequenciais, com pausa entre chamadas e re-tentativas.

    A política do Wikimedia exige um User-Agent que identifique você. Use algo
    como: "futebol-db/0.1 (https://github.com/seu-usuario/futebol-db; voce@email.com)".
    """

    def __init__(self, user_agent: str, pausa: float = 1.0, tentativas: int = 5, timeout: int = 90):
        self.pausa = pausa
        self.tentativas = tentativas
        self.timeout = timeout
        self.sessao = requests.Session()
        self.sessao.headers.update(
            {"User-Agent": user_agent, "Accept": "application/sparql-results+json"}
        )

    def consultar(self, sparql: str) -> list[dict[str, str]]:
        """Executa a consulta e devolve uma lista de {variavel: valor_em_texto}."""
        ultimo_erro = "desconhecido"
        for tentativa in range(1, self.tentativas + 1):
            try:
                resp = self.sessao.post(URL, data={"query": sparql}, timeout=self.timeout)
            except requests.RequestException as exc:
                ultimo_erro = f"rede: {exc}"
                espera = 5 * tentativa
            else:
                if resp.status_code == 200:
                    linhas = resp.json()["results"]["bindings"]
                    time.sleep(self.pausa)
                    return [{k: v["value"] for k, v in linha.items()} for linha in linhas]
                ultimo_erro = f"HTTP {resp.status_code}: {resp.text[:200]!r}"
                if resp.status_code == 429:
                    espera = int(resp.headers.get("Retry-After", 30))
                elif resp.status_code in (500, 502, 503, 504):
                    espera = 10 * tentativa
                else:
                    raise ErroWikidata(ultimo_erro)  # 400 etc.: re-tentar não adianta
            log.warning("Consulta falhou (%s). Tentativa %d/%d, aguardando %ds.",
                        ultimo_erro, tentativa, self.tentativas, espera)
            time.sleep(espera)
        raise ErroWikidata(f"Desistindo após {self.tentativas} tentativas: {ultimo_erro}")
