"""Consultas SPARQL do Wikidata usadas pelo pipeline.

Estratégia em duas etapas, pensada para o limite de 60 s por consulta do WDQS:
  1. Uma consulta leve traz só os QIDs (ids_pessoas).
  2. Consultas em lotes pequenos, via VALUES, trazem os detalhes. Cada tipo de
     dado tem sua própria consulta para evitar produto cartesiano
     (nacionalidades x posições x clubes explodiriam o número de linhas).

Entidades e propriedades usadas
  Q937857 jogador de futebol · Q628099 treinador de futebol
  Q476028 clube de futebol   · Q6979593 seleção nacional de futebol
  P54 membro da equipe · P6087 treinador da equipe · P286 treinador principal
  P580 início · P582 fim · P1350 partidas · P1351 gols · P1618 número da camisa
  P569 nascimento · P570 morte · P19 local de nascimento · P27 cidadania
  P413 posição · P552 lateralidade (pé preferido) · P2048 altura · P18 imagem
  P17 país · P297 código ISO 3166-1 alfa-2 · P571 fundação · P115 estádio
  P154 logotipo · P1813 nome curto
"""
from __future__ import annotations

from .utils import eh_qid

IDIOMAS = "pt-br,pt,en"
OCUPACAO_JOGADOR = "Q937857"
OCUPACAO_TREINADOR = "Q628099"

_LABEL = f'SERVICE wikibase:label {{ bd:serviceParam wikibase:language "{IDIOMAS}". }}'

# Trecho reutilizado nas consultas de vínculos: datas com precisão.
_PERIODO = """
  OPTIONAL { ?st pqv:P580 ?iv . ?iv wikibase:timeValue ?ini ; wikibase:timePrecision ?iniPrec . }
  OPTIONAL { ?st pqv:P582 ?fv . ?fv wikibase:timeValue ?fim ; wikibase:timePrecision ?fimPrec . }
"""
_SEM_REJEITADAS = "?st wikibase:rank ?rk . FILTER(?rk != wikibase:DeprecatedRank)"
_SO_ITENS = 'FILTER(STRSTARTS(STR(?time), "http://www.wikidata.org/entity/Q"))'


def _valores(qids: list[str]) -> str:
    """Monta o conteúdo de um VALUES. Valida os QIDs para evitar injeção de SPARQL."""
    invalidos = [q for q in qids if not eh_qid(q)]
    if invalidos:
        raise ValueError(f"QIDs inválidos: {invalidos[:3]}")
    return " ".join(f"wd:{q}" for q in qids)


def ids_pessoas(ocupacao: str, paises_iso: list[str] | None = None, limite: int | None = None) -> str:
    """QIDs de todas as pessoas com a ocupação, opcionalmente filtradas por cidadania."""
    filtro = ""
    if paises_iso:
        iso = " ".join(f'"{p}"' for p in paises_iso)  # já validados na CLI
        filtro = f"?p wdt:P27 ?pais . ?pais wdt:P297 ?iso . VALUES ?iso {{ {iso} }}"
    consulta = f"SELECT DISTINCT ?p WHERE {{ ?p wdt:P106 wd:{ocupacao} . {filtro} }}"
    if limite:
        consulta += f" LIMIT {int(limite)}"
    return consulta


def detalhes_pessoas(qids: list[str]) -> str:
    return f"""
SELECT ?p ?pLabel ?nasc ?nascPrec ?obito ?obitoPrec ?localItemLabel ?alturaM ?peItemLabel ?imagem WHERE {{
  VALUES ?p {{ {_valores(qids)} }}
  OPTIONAL {{ ?p p:P569/psv:P569 ?nv . ?nv wikibase:timeValue ?nasc ; wikibase:timePrecision ?nascPrec . }}
  OPTIONAL {{ ?p p:P570/psv:P570 ?ov . ?ov wikibase:timeValue ?obito ; wikibase:timePrecision ?obitoPrec . }}
  OPTIONAL {{ ?p wdt:P19 ?localItem . }}
  OPTIONAL {{ ?p p:P2048/psn:P2048/wikibase:quantityAmount ?alturaM . }}
  OPTIONAL {{ ?p wdt:P552 ?peItem . }}
  OPTIONAL {{ ?p wdt:P18 ?imagem . }}
  {_LABEL}
}}"""


def nacionalidades(qids: list[str]) -> str:
    return f"""
SELECT ?p ?pais ?paisLabel ?iso WHERE {{
  VALUES ?p {{ {_valores(qids)} }}
  ?p wdt:P27 ?pais .
  OPTIONAL {{ ?pais wdt:P297 ?iso . }}
  {_LABEL}
}}"""


def posicoes(qids: list[str]) -> str:
    return f"""
SELECT ?p ?pos ?posLabel WHERE {{
  VALUES ?p {{ {_valores(qids)} }}
  ?p wdt:P413 ?pos .
  {_LABEL}
}}"""


def vinculos_jogador(qids: list[str]) -> str:
    return f"""
SELECT ?st ?p ?time ?ini ?iniPrec ?fim ?fimPrec ?jogos ?gols ?camisa WHERE {{
  VALUES ?p {{ {_valores(qids)} }}
  ?p p:P54 ?st .
  ?st ps:P54 ?time .
  {_SEM_REJEITADAS}
  {_SO_ITENS}
  {_PERIODO}
  OPTIONAL {{ ?st pq:P1350 ?jogos . }}
  OPTIONAL {{ ?st pq:P1351 ?gols . }}
  OPTIONAL {{ ?st pq:P1618 ?camisa . }}
}}"""


def vinculos_treinador(qids: list[str]) -> str:
    """Vínculos de treinador vistos dos dois lados: P6087 na pessoa e P286 na equipe."""
    return f"""
SELECT ?st ?p ?time ?ini ?iniPrec ?fim ?fimPrec WHERE {{
  VALUES ?p {{ {_valores(qids)} }}
  {{ ?p p:P6087 ?st . ?st ps:P6087 ?time . }}
  UNION
  {{ ?time p:P286 ?st . ?st ps:P286 ?p . }}
  {_SEM_REJEITADAS}
  {_SO_ITENS}
  {_PERIODO}
}}"""


def detalhes_equipes(qids: list[str]) -> str:
    return f"""
SELECT ?t ?tLabel ?nomeCurto (LANG(?nomeCurto) AS ?nomeCurtoLang) ?pais ?paisLabel ?iso
       ?fund ?estadioLabel ?logo ?ehSelecao ?ehClube WHERE {{
  VALUES ?t {{ {_valores(qids)} }}
  OPTIONAL {{ ?t wdt:P1813 ?nomeCurto . FILTER(LANG(?nomeCurto) IN ("pt", "pt-br", "en")) }}
  OPTIONAL {{ ?t wdt:P17 ?pais . OPTIONAL {{ ?pais wdt:P297 ?iso . }} }}
  OPTIONAL {{ ?t wdt:P571 ?fund . }}
  OPTIONAL {{ ?t wdt:P115 ?estadio . }}
  OPTIONAL {{ ?t wdt:P154 ?logo . }}
  BIND(EXISTS {{ ?t wdt:P31/wdt:P279* wd:Q6979593 }} AS ?ehSelecao)
  BIND(EXISTS {{ ?t wdt:P31/wdt:P279* wd:Q476028 }} AS ?ehClube)
  {_LABEL}
}}"""
