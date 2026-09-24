"""Consultas SQL da API. Reaproveita as views e funções de busca do schema.sql
em vez de duplicar a lógica de correspondência difusa (pg_trgm) aqui.
"""
from __future__ import annotations

BUSCAR_PESSOAS = "SELECT id, slug, nome, similaridade FROM buscar_pessoas(%s, %s)"
BUSCAR_EQUIPES = "SELECT id, slug, nome, similaridade FROM buscar_equipes(%s, %s)"

PAPEIS_DAS_PESSOAS = """
SELECT p.id,
       (j.pessoa_id IS NOT NULL) AS eh_jogador,
       (t.pessoa_id IS NOT NULL) AS eh_treinador
  FROM pessoa p
  LEFT JOIN jogador   j ON j.pessoa_id = p.id
  LEFT JOIN treinador t ON t.pessoa_id = p.id
 WHERE p.id = ANY(%s)
"""

JOGADOR_POR_SLUG = "SELECT * FROM vw_jogador WHERE slug = %s"
TREINADOR_POR_SLUG = "SELECT * FROM vw_treinador WHERE slug = %s"

CARREIRA_DA_PESSOA = """
SELECT vinculo_id, equipe_id, equipe, equipe_slug, tipo_equipe, funcao,
       data_inicio, precisao_inicio, data_fim, precisao_fim,
       numero_camisa, jogos, gols
  FROM vw_carreira
 WHERE pessoa_id = %s AND funcao = ANY(%s)
 ORDER BY data_inicio NULLS LAST, vinculo_id
"""

EQUIPE_POR_SLUG = """
SELECT e.id, e.slug, e.nome, e.nome_curto, e.tipo, e.ano_fundacao, e.estadio,
       e.escudo_commons, pa.nome AS pais
  FROM equipe e
  LEFT JOIN pais pa ON pa.id = e.pais_id
 WHERE e.slug = %s
"""

ELENCO_ATUAL = """
SELECT p.id AS pessoa_id, p.slug AS pessoa_slug, p.nome, v.numero_camisa,
       (SELECT array_agg(po.nome ORDER BY po.nome)
          FROM jogador_posicao jp JOIN posicao po ON po.id = jp.posicao_id
         WHERE jp.pessoa_id = p.id) AS posicoes,
       v.data_inicio, v.precisao_inicio
  FROM vinculo v
  JOIN pessoa p ON p.id = v.pessoa_id
 WHERE v.equipe_id = %s AND v.funcao = 'jogador' AND v.data_fim IS NULL
 ORDER BY p.nome
"""

COMISSAO_ATUAL = """
SELECT p.id AS pessoa_id, p.slug AS pessoa_slug, p.nome, v.funcao,
       v.data_inicio, v.precisao_inicio
  FROM vinculo v
  JOIN pessoa p ON p.id = v.pessoa_id
 WHERE v.equipe_id = %s AND v.funcao IN ('treinador', 'auxiliar') AND v.data_fim IS NULL
 ORDER BY v.funcao, p.nome
"""
