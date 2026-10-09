# FUTFUT API

API profissional para consumo de dados do banco FUTFUT - Dados de futebol multi-fonte.

## Status

🚧 **Em desenvolvimento** - A API está sendo implementada com os endpoints principais do banco de dados PostgreSQL.

## Tecnologias

- **FastAPI** - Framework web moderno e rápido
- **asyncpg** - Driver PostgreSQL assíncrono
- **psycopg3** - Pool de conexões
- **Pydantic** - Validação de dados

## Installation

```bash
pip install -r requirements.txt
```

## Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` baseado em `.env.example`:

```bash
cp .env.example .env
```

Configure as variáveis:
- `DATABASE_URL` - URL de conexão PostgreSQL
- `CORS_ORIGINS` - Origens permitidas para CORS

## Endpoints

### Teams (`/teams`)

| Endpoint | Método | Descrição |
|----------|--------|-------------|
| `/teams/{team_id}` | GET | Perfil completo do clube |
| `/teams/{team_id}/head-to-head/{team_b_id}` | GET | Histórico de confrontos |

### Players (`/players`)

| Endpoint | Método | Descrição |
|----------|--------|-------------|
| `/players/{player_id}` | GET | Perfil completo do jogador |

### Matches (`/matches`)

| Endpoint | Método | Descrição |
|----------|--------|-------------|
| `/matches/{match_id}` | GET | Detalhes completos da partida |

### Search (`/search`)

| Endpoint | Método | Descrição |
|----------|--------|-------------|
| `/search?q=query&limit=N` | GET | Busca global por times e jogadores |

### Standings (`/standings`)

| Endpoint | Método | Descrição |
|----------|--------|-------------|
| `/standings/{competition_id}/{season_id}` | GET | Classificação da liga |

## Executando a API

### Desenvolvimento

```bash
# Do diretório raiz do projeto
uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000
```

### Produção

```bash
# Do diretório raiz do projeto
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
```

## Documentação

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI JSON**: `http://localhost:8000/openapi.json`

## Health Check

```bash
curl http://localhost:8000/health
```

Resposta:
```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

## Database Requirements

A API requer o banco de dados FUTFUT com as funções RPC instaladas:

- `fn_api_team_profile(p_team_id, p_season_id)`
- `fn_api_player_profile(p_player_id)`
- `fn_api_match_details(p_match_id)`
- `fn_team_head_to_head(p_team_a, p_team_b, p_limit)`
- `fn_standings_at_round(p_competition_id, p_season_id, p_max_round)`
- `search_entities(p_query, p_limit)`

## Arquitetura

```
api/
├── __init__.py
├── config.py           # Configurações
├── main.py             # Aplicação FastAPI
├── database.py         # Conexão com PostgreSQL
├── models.py           # Schemas Pydantic
├── dependencies.py     # Dependency injection
└── routers/            # Endpoints
    ├── __init__.py
    ├── teams.py
    ├── players.py
    ├── matches.py
    ├── search.py
    └── standings.py
```

## Rate Limiting

A API possui rate limiting por padrão:
- **Limite padrão**: 100 requisições a cada 60 segundos por IP

Headers retornados:
- `X-RateLimit-Limit` - Limite máximo
- `X-RateLimit-Remaining` - Requisições restantes

## CORS

Origens permitidas (padrão):
- http://localhost:3000
- http://localhost:5173

Configure em `.env`:
```
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## Contribuição

1. Fork o repositório
2. Crie uma branch para suas alterações
3. Commit suas mudanças
4. Faça push para a branch
5. Abra um Pull Request

## Licença

MIT