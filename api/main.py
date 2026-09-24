"""API de leitura do futebol-db.

Rodar em dev (na raiz do projeto, com o Postgres já de pé via docker compose):
    uvicorn api.main:app --reload

Endpoints:
    GET /api/saude
    GET /api/busca?q=termo&limite=20
    GET /api/jogadores/{slug}
    GET /api/treinadores/{slug}
    GET /api/equipes/{slug}

Só leitura: a carga dos dados continua sendo feita pelo pipeline (pipeline/carga.py).
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import consultas as q
from . import db
from .config import origens_cors


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    db.iniciar_pool()
    yield
    db.encerrar_pool()


app = FastAPI(title="futebol-db", version="0.1.0", lifespan=ciclo_de_vida)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origens_cors(),
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/saude")
def saude() -> dict:
    with db.cursor() as cur:
        cur.execute("SELECT count(*) AS pessoas FROM pessoa")
        return {"status": "ok", "pessoas": cur.fetchone()["pessoas"]}


@app.get("/api/busca")
def busca(
    q_termo: str = Query(..., alias="q", min_length=1, description="Termo de busca"),
    limite: int = Query(20, ge=1, le=100),
) -> dict:
    with db.cursor() as cur:
        cur.execute(q.BUSCAR_PESSOAS, (q_termo, limite))
        pessoas = cur.fetchall()

        cur.execute(q.BUSCAR_EQUIPES, (q_termo, limite))
        equipes = cur.fetchall()

        papeis: dict[int, dict] = {}
        ids_pessoas = [p["id"] for p in pessoas]
        if ids_pessoas:
            cur.execute(q.PAPEIS_DAS_PESSOAS, (ids_pessoas,))
            papeis = {r["id"]: r for r in cur.fetchall()}

    resultados = []
    for p in pessoas:
        info = papeis.get(p["id"], {})
        tipos = [t for t, chave in (("jogador", "eh_jogador"), ("treinador", "eh_treinador"))
                 if info.get(chave)]
        resultados.append({
            "tipo": "pessoa", "id": p["id"], "slug": p["slug"], "nome": p["nome"],
            "papeis": tipos, "similaridade": p["similaridade"],
        })
    for e in equipes:
        resultados.append({
            "tipo": "equipe", "id": e["id"], "slug": e["slug"], "nome": e["nome"],
            "similaridade": e["similaridade"],
        })
    resultados.sort(key=lambda r: r["similaridade"], reverse=True)
    return {"termo": q_termo, "resultados": resultados}


@app.get("/api/jogadores/{slug}")
def jogador(slug: str) -> dict:
    with db.cursor() as cur:
        cur.execute(q.JOGADOR_POR_SLUG, (slug,))
        pessoa = cur.fetchone()
        if pessoa is None:
            raise HTTPException(404, "Jogador não encontrado.")
        cur.execute(q.CARREIRA_DA_PESSOA, (pessoa["id"], ["jogador"]))
        carreira = cur.fetchall()
        cur.execute(
            "SELECT (t.pessoa_id IS NOT NULL) AS eh_treinador FROM pessoa p "
            "LEFT JOIN treinador t ON t.pessoa_id = p.id WHERE p.id = %s",
            (pessoa["id"],),
        )
        pessoa["tambem_treinador"] = cur.fetchone()["eh_treinador"]
    pessoa["carreira"] = carreira
    return pessoa


@app.get("/api/treinadores/{slug}")
def treinador(slug: str) -> dict:
    with db.cursor() as cur:
        cur.execute(q.TREINADOR_POR_SLUG, (slug,))
        pessoa = cur.fetchone()
        if pessoa is None:
            raise HTTPException(404, "Treinador não encontrado.")
        cur.execute(q.CARREIRA_DA_PESSOA, (pessoa["id"], ["treinador", "auxiliar"]))
        carreira = cur.fetchall()
        cur.execute(
            "SELECT (j.pessoa_id IS NOT NULL) AS eh_jogador FROM pessoa p "
            "LEFT JOIN jogador j ON j.pessoa_id = p.id WHERE p.id = %s",
            (pessoa["id"],),
        )
        pessoa["tambem_jogador"] = cur.fetchone()["eh_jogador"]
    pessoa["carreira"] = carreira
    return pessoa


@app.get("/api/equipes/{slug}")
def equipe(slug: str) -> dict:
    with db.cursor() as cur:
        cur.execute(q.EQUIPE_POR_SLUG, (slug,))
        dados = cur.fetchone()
        if dados is None:
            raise HTTPException(404, "Equipe não encontrada.")
        cur.execute(q.ELENCO_ATUAL, (dados["id"],))
        elenco = cur.fetchall()
        cur.execute(q.COMISSAO_ATUAL, (dados["id"],))
        comissao = cur.fetchall()
    dados["elenco_atual"] = elenco
    dados["comissao_atual"] = comissao
    return dados
