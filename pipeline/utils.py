"""Funções pequenas de apoio: parsing de datas do Wikidata, slugs, normalização."""
from __future__ import annotations

import re
import unicodedata
from datetime import date
from urllib.parse import unquote

_QID = re.compile(r"^Q\d+$")


def qid_de_uri(uri: str) -> str:
    """'http://www.wikidata.org/entity/Q615' -> 'Q615'."""
    return uri.rstrip("/").rsplit("/", 1)[-1]


def eh_qid(valor: str) -> bool:
    return bool(_QID.match(valor))


def id_declaracao(uri: str) -> str:
    """'http://www.wikidata.org/entity/statement/Q615-GUID' -> 'Q615-GUID'."""
    return uri.rsplit("/statement/", 1)[-1]


def slugify(nome: str, qid: str) -> str:
    """Slug único e estável: o QID no final garante que homônimos não colidem."""
    base = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    base = re.sub(r"[^a-zA-Z0-9]+", "-", base).strip("-").lower()
    return f"{base or 'sem-nome'}-{qid.lower()}"


def parse_data(valor: str | None, precisao: str | None) -> tuple[date | None, int | None]:
    """Converte uma data do Wikidata para (date, precisão).

    Precisão 9 = ano, 10 = mês, 11 = dia. Precisões menores (década, século) ou
    datas inválidas (ano 0, a.C.) viram (None, None): melhor vazio do que errado.
    """
    if not valor or not precisao:
        return None, None
    try:
        prec = int(precisao)
    except ValueError:
        return None, None
    if prec < 9:
        return None, None
    try:
        return date.fromisoformat(valor[:10]), min(prec, 11)
    except ValueError:
        return None, None


def normalizar_pe(rotulo: str | None) -> str | None:
    if not rotulo:
        return None
    r = rotulo.lower()
    if "ambi" in r or "both" in r or "ambos" in r:
        return "ambidestro"
    if "esquerd" in r or "left" in r:
        return "esquerdo"
    if "direit" in r or "right" in r:
        return "direito"
    return None


def arquivo_commons(uri: str | None) -> str | None:
    """'.../Special:FilePath/Neymar%20Jr.jpg' -> 'Neymar Jr.jpg'."""
    if not uri or "Special:FilePath/" not in uri:
        return None
    return unquote(uri.split("Special:FilePath/", 1)[1])


def inteiro(valor: str | None, minimo: int = 0, maximo: int = 10**9) -> int | None:
    """Extrai um inteiro plausível de textos como '10', '10.0' ou '9?'."""
    if not valor:
        return None
    m = re.search(r"\d+", valor)
    if not m:
        return None
    n = int(m.group())
    return n if minimo <= n <= maximo else None


def em_lotes(itens: list, tamanho: int):
    for i in range(0, len(itens), tamanho):
        yield itens[i : i + tamanho]
