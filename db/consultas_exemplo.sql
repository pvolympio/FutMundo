-- Consultas de exemplo. Rode com:  psql "$DATABASE_URL" -f db/consultas_exemplo.sql
-- (ou cole uma por vez no seu cliente SQL favorito)

-- 1) Trajetória de um jogador, em ordem cronológica.
--    A precisão diz se a data é confiável até o dia (11), mês (10) ou só o ano (9).
SELECT equipe, funcao, data_inicio, precisao_inicio, data_fim, precisao_fim, numero_camisa, jogos, gols
  FROM vw_carreira
 WHERE pessoa_id = (SELECT id FROM buscar_pessoas('neymar', 1))
 ORDER BY data_inicio NULLS LAST;

-- 2) Companheiros de equipe: quem dividiu clube com ele e por quanto tempo.
--    Só considera vínculos com data de início conhecida. GREATEST evita períodos invertidos.
SELECT p2.nome AS companheiro, e.nome AS equipe,
       GREATEST(v1.data_inicio, v2.data_inicio) AS de,
       LEAST(COALESCE(v1.data_fim, CURRENT_DATE), COALESCE(v2.data_fim, CURRENT_DATE)) AS ate
  FROM vinculo v1
  JOIN vinculo v2 ON v2.equipe_id = v1.equipe_id
                 AND v2.funcao = 'jogador'
                 AND v2.pessoa_id <> v1.pessoa_id
  JOIN pessoa  p2 ON p2.id = v2.pessoa_id
  JOIN equipe  e  ON e.id  = v1.equipe_id
 WHERE v1.pessoa_id = (SELECT id FROM buscar_pessoas('neymar', 1))
   AND v1.funcao = 'jogador'
   AND v1.data_inicio IS NOT NULL AND v2.data_inicio IS NOT NULL
   AND daterange(v1.data_inicio, GREATEST(COALESCE(v1.data_fim, CURRENT_DATE), v1.data_inicio), '[]')
    && daterange(v2.data_inicio, GREATEST(COALESCE(v2.data_fim, CURRENT_DATE), v2.data_inicio), '[]')
 ORDER BY de;

-- 3) Quem um treinador dirigiu: jogadores cujo vínculo se sobrepõe ao dele na mesma equipe.
SELECT pj.nome AS jogador, e.nome AS equipe
  FROM vinculo vt
  JOIN vinculo vj ON vj.equipe_id = vt.equipe_id AND vj.funcao = 'jogador'
  JOIN pessoa  pj ON pj.id = vj.pessoa_id
  JOIN equipe  e  ON e.id  = vt.equipe_id
 WHERE vt.pessoa_id = (SELECT id FROM buscar_pessoas('guardiola', 1))
   AND vt.funcao = 'treinador'
   AND vt.data_inicio IS NOT NULL AND vj.data_inicio IS NOT NULL
   AND daterange(vt.data_inicio, GREATEST(COALESCE(vt.data_fim, CURRENT_DATE), vt.data_inicio), '[]')
    && daterange(vj.data_inicio, GREATEST(COALESCE(vj.data_fim, CURRENT_DATE), vj.data_inicio), '[]')
 ORDER BY e.nome, pj.nome;

-- 4) Clubes que mais tiveram jogadores nascidos no Brasil.
SELECT e.nome AS clube, count(DISTINCT v.pessoa_id) AS jogadores
  FROM vinculo v
  JOIN equipe e        ON e.id = v.equipe_id AND e.tipo = 'clube'
  JOIN pessoa_pais pp  ON pp.pessoa_id = v.pessoa_id
  JOIN pais pa         ON pa.id = pp.pais_id AND pa.codigo_iso2 = 'BR'
 WHERE v.funcao = 'jogador'
 GROUP BY e.nome
 ORDER BY jogadores DESC
 LIMIT 20;

-- 5) Jogadores que também foram treinadores.
SELECT p.nome
  FROM pessoa p
  JOIN jogador   j ON j.pessoa_id = p.id
  JOIN treinador t ON t.pessoa_id = p.id
 ORDER BY p.nome
 LIMIT 50;

-- 6) Qualidade dos dados: quanto da base tem data de nascimento completa e foto.
SELECT count(*)                                              AS pessoas,
       count(*) FILTER (WHERE precisao_nascimento = 11)      AS nascimento_completo,
       count(*) FILTER (WHERE precisao_nascimento = 9)       AS so_o_ano,
       count(*) FILTER (WHERE data_nascimento IS NULL)       AS sem_nascimento,
       count(*) FILTER (WHERE imagem_commons IS NOT NULL)    AS com_foto
  FROM pessoa;

-- 7) Tamanho do banco (útil para saber se cabe no plano gratuito de hospedagem).
SELECT pg_size_pretty(pg_database_size(current_database())) AS tamanho_total;
SELECT relname AS tabela, pg_size_pretty(pg_total_relation_size(oid)) AS tamanho
  FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
 ORDER BY pg_total_relation_size(oid) DESC;
