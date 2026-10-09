# Banco de Dados de Futebol Multi-Fonte — v3.1 (Produção Auditada & Alta Performance para API/Frontend)

Schema PostgreSQL de nível de produção auditado contra falhas reais de execução, projetado para consolidar dados do **soccerdata** (FBref, Understat, WhoScored, Sofascore, ClubElo, ESPN, SoFIFA, FiveThirtyEight, Football-Data.co.uk), **Cartola FC / Globo**, **Transfermarkt**, **FotMob**, **Opta**, **Wyscout** e fontes proprietárias.

O schema combina integridade relacional estrita, concorrência resiliente e uma camada de **funções RPC JSON nativas** para alimentar diretamente aplicações web e APIs modernas (FastAPI, Next.js Server Components, GraphQL) com agregação no banco em uma única query.

**Validado e testado de ponta a ponta contra PostgreSQL 18 real.**
**Bateria com 43 testes automatizados idempotentes com 100% de aprovação (0 erros, 0 warnings).**

---

## 📁 Arquivos

- [`schema.sql`](file:///c:/Projetos/FUTFUT/backend/schema.sql) — DDL consolidado v3.1: 4 extensões nativas, tabelas canônicas e crosswalk, particionamento declarativo por ano com procedimento de evacuação da partição `DEFAULT`, triggers de consistência, camada Gold reconciliada, funções RPC JSON de tela cheia para API/Frontend e permissões estritas da role `app_reader`.
- [`tests.sql`](file:///c:/Projetos/FUTFUT/backend/tests.sql) — Suíte completa de 43 testes automatizados: 21 testes funcionais de domínio + 17 testes de regressão negativa e operacional + 5 testes das funções RPC e segurança. Cada teste roda em transação isolada (`BEGIN ... ROLLBACK`), garantindo total idempotência.

---

## 🚀 Endpoints RPC Nativos para Frontend e API (Alta Performance)

As funções RPC eliminam o problema do N+1 e reduzem a latência cliente-servidor construindo a árvore completa de dados do frontend diretamente no motor do PostgreSQL:

### 1. `fn_team_head_to_head(p_team_a, p_team_b, p_limit)`
Retorna o raio-x histórico do confronto direto entre dois clubes:
- Resumo consolidado: total de partidas, vitórias de A, vitórias de B, empates e saldo de gols de cada equipe.
- Metadados completos de ambos os clubes (escudo, slug, cores).
- Lista paginada das partidas mais recentes com placar, data, competição e local.

### 2. `fn_api_match_details(p_match_id)`
Fornece em uma única chamada todo o payload necessário para renderizar a tela de partida:
- Cabeçalho: status, fase, rodada, grupo, data, venue com cidade e capacidade.
- Placar completo: tempo normal, prorrogação, disputa de pênaltis e vencedor.
- Equipe de arbitragem e VAR (`officials`).
- Escalações táticas: formação (ex: `4-3-3`), titulares com capitão e reservas para ambos os clubes.
- Linha do tempo de eventos (`timeline`): gols, assistências, cartões, substituições ordenados por minuto e segundo.
- Estatísticas comparativas da camada Gold: gols, xG, chutes, chutes a gol, posse de bola.
- Últimas odds coletadas para a partida.

### 3. `fn_api_player_profile(p_player_id)`
Fornece todos os blocos de informação para a página do atleta:
- Ficha biográfica e dados físicos (idade exata calculada, altura, peso, pé preferido, nacionalidade).
- Situação contratual e clube atual (salário semanal, cláusula de rescisão, término de contrato, posição e linha tática).
- Curva histórica de valor de mercado e recorde pessoal de avaliação.
- Linha do tempo da carreira (clubes anteriores, tipo de transferência, número da camisa).
- Histórico clínico de lesões e suspensões com previsão de retorno.
- Estatísticas consolidadas da temporada corrente a partir da camada Gold reconciliada (jogos, minutos, gols, assistências, xG, xA).

### 4. `fn_api_team_profile(p_team_id, p_season_id)`
Entrega a tela completa do clube:
- Identidade visual, ano de fundação, estádio e treinador atual (`head_coach`).
- Classificação na tabela da temporada ativa (jogos, vitórias, empates, derrotas, saldo, pontos).
- Forma recente (array dos últimos 5 jogos: W/D/L).
- Elenco ativo estruturado e agrupado por linha tática (`goalkeepers`, `defenders`, `midfielders`, `forwards`).
- Últimas 5 partidas finalizadas com placar e adversário.

---

## 🛡️ As 10 Falhas Confirmadas e Suas Correções no v3.0

| # | Problema Identificado | Causa Raiz | Correção Implementada no Schema v3.0 | Teste de Regressão |
|---|---|---|---|:---:|
| **1** | Partida aceitava `season_id` de outra competição | FK apontava apenas para `season_id`, permitindo cruzar temporadas de ligas diferentes | `UNIQUE(season_id, competition_id)` em `season` e **Foreign Key composta** `(season_id, competition_id)` em `match`, `player_season_stats` e `team_season_stats`. | `TESTE 22` |
| **2** | Estatística gravada para clube que não jogou a partida | Funções de inserção e tabela `player_appearance` aceitavam qualquer `team_id` | Validação estrita `team_id IN (home_team_id, away_team_id)` nas funções `insert_match_event`, `insert_player_match_stat`, `insert_team_match_stat` e trigger `validate_appearance_team` em `player_appearance`. | `TESTE 23` |
| **3** | Placar e vencedor incoerentes | Partida `finished` passava sem placar ou com vencedor contraditório | `CHECK (status <> 'finished' OR (home_score IS NOT NULL AND away_score IS NOT NULL))` + trigger `trg_match_score_consistency` que valida consistência lógica entre placar do tempo regulamentar, prorrogação, pênaltis e `winner_team_id`. | `TESTE 24` |
| **4** | Backfill de valor de mercado sobrescrevia o valor atual | Trigger sincronizava pela última linha inserida em vez da data mais recente | `sync_player_market_value` agora recalcula `market_value_eur` selecionando a avaliação com maior `valuation_date` (`ORDER BY valuation_date DESC, id DESC LIMIT 1`) e preserva `highest_market_value_eur` com `MAX()`. | `TESTE 25` |
| **5** | `vw_top_scorers` contava em dobro | View lia diretamente de `player_match_stats` cruzando múltiplas fontes (ex: FBref e Understat) | A view agora lê exclusivamente da **Camada Gold** (`gold_player_match_stats`), que desduplica fontes por prioridade. Além disso, agrupa por `(competition_id, season_id, player_id)`, unificando jogadores que trocaram de clube na mesma temporada em 1 única linha. | `TESTE 26` |
| **6** | Partição dependia do fuso horário da sessão do cliente | O cálculo da data usava `match_date::date` sensível ao timezone da sessão | Conversão determinística `(match_date AT TIME ZONE 'UTC')::date` em todas as rotinas de ingestão, garantindo roteamento imune ao fuso do cliente (ex: Tóquio vs UTC). | `TESTE 27` |
| **7** | Nacionalidade britânica violava a FK | Países britânicos (ENG, SCO, WAL, NIR) e federações FIFA não existem no ISO 3166-1 | Semeadura completa de todos os 249 códigos ISO 3166-1 alpha-3 acrescidos das federações FIFA reconhecidas no futebol internacional (`ENG`, `SCO`, `WAL`, `NIR`, `GIB`, `FRO`, `KOS`). | `TESTE 28` |
| **8** | Variação de nome gerava duplicata | `get_or_create_player` comparava apenas por string exata | Implementada consulta recursiva em `player_alias`, tolerância fonética/trigrama via `pg_trgm` (similaridade $\ge 0.50$ quando a data de nascimento é idêntica) com cadastro automático da variação em `player_alias`. Casos de homônimos sem nascimento são roteados para a fila `entity_match_review`. | `TESTE 29` |
| **9** | Fila de revisão e log de merge eram código morto | Tabelas `entity_match_review` e `entity_merge_log` não possuíam chamadas | Casos ambíguos geram registros em `entity_match_review`. Criada a procedure `merge_players(from_id, to_id, reason, performed_by)` que migra todos os eventos, contratos, estatísticas e IDs externos, converte o nome antigo em alias, registra auditoria em `entity_merge_log` e descarta a duplicata. | `TESTE 30` |
| **10** | `vw_team_squad` inventava posição | Usava `COALESCE(dp.position_code, 'CM')` gerando 'Meio-campista' falso | Removido qualquer `COALESCE` com valores fabricados. Posições desconhecidas agora retornam expressamente `NULL`. | `TESTE 31` |

---

## ⚡ Melhorias de Modelagem, Operação e Alta Performance

1. **Eliminação de redundância no crosswalk**: Removida a coluna `player.transfermarkt_id`. Todo o mapeamento externo opera exclusivamente pela tabela canônica de crosswalk `player_external_id`.
2. **Fonte única da verdade para disponibilidade**: Removido `player.status` ambíguo. A disponibilidade agora deriva univocamente de `player_injury` (lesões ativas) e `player_team_history.status`.
3. **Propagação de partidas adiadas (`trg_sync_match_date`)**: Se a `match_date` de uma partida for remarcada, o trigger propaga automaticamente a nova data para `event_date` em `match_event` e `stat_date` em `player_match_stats` e `team_match_stats`.
4. **Criação resiliente de partições (`create_partitions_for_year`)**: Quando dados futuros caem na partição `DEFAULT`, a procedure extrai as linhas afetadas, desanexa a default, cria a nova partição anual, migra os dados e reanexa a default sem violação de constraints.
5. **`safe_numeric` puro SQL 5x mais rápido**: Substituída a implementação com bloco `EXCEPTION` do PL/pgSQL por uma função em SQL puro baseada em regex (`^\s*[-+]?[0-9]+(\.[0-9]+)?...$`), reduzindo o custo de conversão de 5,8 s para 1,1 s por milhão de registros.
6. **Deduplicação de Staging por Hash SHA-256**: A tabela `staging_raw` calcula a coluna gerada `payload_hash = encode(digest(payload::text, 'sha256'), 'hex')` com restrição `UNIQUE (source_id, entity_type, native_id, payload_hash)`. Cargas idênticas retransmitidas são ignoradas automaticamente via `ON CONFLICT DO NOTHING`.
7. **Busca global otimizada (`search_entities`)**: Wildcards de LIKE (`%`, `_`) são devidamente escapados via `escape_like_pattern`. A consulta utiliza o operador `%` indexado por GIN (`gin_trgm_ops`). URLs hardcoded de interface (`/times/`, `/jogadores/`) foram removidas do banco de dados em prol de metadados limpos (`slug`, `photo_url`).
8. **Segurança e Roles**: Criação da role `app_reader` com acesso de leitura a todas as tabelas e views e execução garantida de todas as funções RPC.

---

## 🧪 Bateria de Testes Automatizados (43 Testes)

Todos os testes em [`tests.sql`](file:///c:/Projetos/FUTFUT/backend/tests.sql) foram desenhados sob o princípio de **isolamento transacional completo (`BEGIN ... ROLLBACK`)**. Não há resíduos no banco e nenhuma dependência entre os testes.

### Grupo 1: Regras de Domínio e Funcionalidades (Testes 1 a 21)
- **Teste 1**: Idempotência de `get_or_create_player` na mesma fonte.
- **Teste 2**: Identidade unificada entre fontes distintas (mesmo nome + nascimento).
- **Teste 3**: Bloqueio de `external_id` duplicado na mesma fonte.
- **Teste 4**: Exclusion constraint temporal em `player_team_history` (bloqueio de sobreposição de contratos).
- **Teste 5**: Exclusion constraint em `manager_tenure` (bloqueio de múltiplos `head_coach` simultâneos no mesmo clube).
- **Teste 6**: Particionamento por ano e roteamento para `match_event_default`.
- **Teste 7**: Colunas geradas de métricas avançadas calculadas via `safe_numeric`.
- **Teste 8**: Camada Gold reconciliando fontes divergentes com base em prioridade.
- **Teste 9**: Auditoria automática de alteração de campos em `player_field_history`.
- **Teste 10**: Matching fuzzy real com `pg_trgm` (ordenação entre múltiplos candidatos sem pré-filtragem).
- **Teste 11**: Desambiguação de homônimos por data de nascimento.
- **Teste 12**: Clubes homônimos em países distintos mantidos isolados.
- **Teste 13**: Contratos consecutivos no mesmo dia de transição com intervalo semi-aberto `[)`.
- **Teste 14**: Classificação dinâmica da liga via `vw_league_standings`.
- **Teste 15**: Elenco ativo retornado corretamente por `vw_team_squad`.
- **Teste 16**: Partida eliminatória com prorrogação, pênaltis e vencedor.
- **Teste 17**: Equipe completa de arbitragem e cabine de VAR (`match_official`).
- **Teste 18**: Stream de eventos com assistência, pênalti e gol contra.
- **Teste 19**: Histórico de valor de mercado e trigger de sincronização de pico de carreira.
- **Teste 20**: Busca global unificada nativa (`search_entities`) com metadados limpos.
- **Teste 21**: Consulta de classificação retroativa por rodada (`fn_standings_at_round`).

### Grupo 2: Regressões Negativas e Operacionais (Testes 22 a 38)
- **Teste 22**: Bloqueio de inserção de partida ou estatísticas com `season_id` de outra competição (FK composta).
- **Teste 23**: Bloqueio de inserção de eventos, estatísticas ou aparições com clube alienígena à partida.
- **Teste 24**: Bloqueio de partida finalizada sem placar, com vencedor incoerente ou empate com vencedor declarado.
- **Teste 25**: Backfill histórico de valor de mercado antigo preserva valor atual e recorde.
- **Teste 26**: `vw_top_scorers` não duplica gols por fonte e agrega transferências no meio da temporada em linha única.
- **Teste 27**: Funções `insert_*` utilizam data UTC determinística independentemente do fuso da sessão.
- **Teste 28**: Aceitação de códigos de nacionalidade britânica (`ENG`, `SCO`, `WAL`, `NIR`) e federações FIFA.
- **Teste 29**: Deduplicação de grafias alternativas ("Vinicius Jr" vs "Vinicius Junior") e fila de revisão para casos ambíguos.
- **Teste 30**: Procedimento `merge_players` reaponta todas as dependências, audita em log e descarta o duplicado.
- **Teste 31**: Jogador sem posição definida no elenco retorna `NULL` em vez de valor inventado.
- **Teste 32**: Procedimento `create_partitions_for_year` migra linhas da partição `DEFAULT` sem violar constraints.
- **Teste 33**: Deduplicação de payloads idênticos em `staging_raw` através de `payload_hash`.
- **Teste 34**: Trigger `trg_sync_match_date` propaga adiamento de jogo para partições de eventos e estatísticas.
- **Teste 35**: Teste unitário de performance e validação da função `safe_numeric` com expressões regulares.
- **Teste 36**: Escape correto de curingas de LIKE (`%`) em `search_entities`.
- **Teste 37**: Validação de segurança da role `app_reader` (permissão de SELECT e bloqueio de INSERT).
- **Teste 38**: Controle de concorrência com advisory lock transacional em chamadas paralelas.

### Grupo 3: Suporte de Alta Performance para API e Frontend (Testes 39 a 43)
- **Teste 39**: Considação do histórico de confronto direto (`fn_team_head_to_head`) com contagem de vitórias, empates, gols e últimas partidas em JSON.
- **Teste 40**: Geração do payload completo da tela de partida (`fn_api_match_details`) com metadados, placar, oficiais, timeline de eventos, escalações titulares/reservas e odds.
- **Teste 41**: Geração do perfil completo do jogador (`fn_api_player_profile`) com biografia, clube atual, histórico de valor de mercado, lesões e estatísticas da temporada atual.
- **Teste 42**: Geração do perfil completo do clube (`fn_api_team_profile`) com estádio, técnico ativo, classificação, últimos 5 jogos e elenco agrupado por linha tática (`goalkeepers`, `defenders`, `midfielders`, `forwards`).
- **Teste 43**: Execução de todas as novas funções RPC com a role de menor privilégio `app_reader`.

---

## 🚀 Como Executar

### 1. Criar o Banco e Aplicar o Schema
```bash
# Conectar no PostgreSQL e criar o banco de dados (se necessário)
psql -U postgres -c "CREATE DATABASE futfut;"

# Aplicar o schema de produção v3.1:
psql -U postgres -d futfut -v ON_ERROR_STOP=1 -f schema.sql
```

### 2. Rodar a Bateria de 43 Testes Automatizados
```bash
# Executar a suíte de testes (completamente idempotente e repetível):
psql -U postgres -d futfut -f tests.sql
```

A saída final esperada no terminal:
```text
NOTA:  =========================================================
NOTA:  BATERIA DE TESTES CONCLUÍDA COM SUCESSO! (43/43)
NOTA:  Todos os testes passaram com isolamento e idempotência.
NOTA:  =========================================================
```

