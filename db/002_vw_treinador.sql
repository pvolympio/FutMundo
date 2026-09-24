-- Adiciona vw_treinador (espelho de vw_jogador) a um banco já criado.
-- Bancos novos já ganham essa view pelo schema.sql; rode este arquivo só se
-- o seu volume foi criado antes dela existir:
--   docker compose exec -T db psql -U futebol -d futebol -f - < db/002_vw_treinador.sql

CREATE OR REPLACE VIEW vw_treinador AS
SELECT p.id, p.slug, p.nome, p.data_nascimento, p.precisao_nascimento,
       p.local_nascimento, p.data_falecimento, p.imagem_commons,
       (SELECT array_agg(pa.nome ORDER BY pa.nome)
          FROM pessoa_pais pp JOIN pais pa ON pa.id = pp.pais_id
         WHERE pp.pessoa_id = p.id) AS nacionalidades
  FROM pessoa p
  JOIN treinador t ON t.pessoa_id = p.id;
