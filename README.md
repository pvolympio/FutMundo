# FutMundo • Football Intelligence & Tactical Analytics Platform

<div align="center">

![FutMundo Badge](https://img.shields.io/badge/Platform-FutMundo-07161A?style=for-the-badge&logo=target)
![PostgreSQL 18](https://img.shields.io/badge/PostgreSQL_18-Gold_Layer-336791?style=for-the-badge&logo=postgresql)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi)
![React 18](https://img.shields.io/badge/React_18-TypeScript_Strict-61DAFB?style=for-the-badge&logo=react)
![CI Status](https://img.shields.io/badge/CI-Passing_(40_Pytest_+_13_Vitest)-4caf50?style=for-the-badge&logo=githubactions)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**Plataforma de inteligência tática e análise avançada de futebol com design editorial, isolinhas topográficas de perigo (xG), linha do tempo interativa e engenharia de dados multi-fonte.**

[Arquitetura](#-arquitetura-do-sistema) •
[Funcionalidades](#-principais-funcionalidades) •
[Stack Tecnológica](#-stack-tecnológica) •
[Instalação & Docker](#-instalação--execução) •
[Segurança & Produção](#-segurança--alta-performance) •
[Testes & CI](#-testes--qualidade)

</div>

---

## 📌 Visão Geral do Projeto

O **FutMundo** é uma plataforma analítica de alta performance projetada para transformar eventos brutos de futebol em insights táticos acionáveis. Desenvolvido para a **Premier League 2024/25**, o ecossistema consolida dados multi-fonte (Opta, StatsBomb, FBref, Transfermarkt e Understat) através de uma modelagem relacional rigorosa com **Camada Gold reconciliada**, fornecendo análises em tempo real, visualização topográfica de chutes e comparativos por 90 minutos.

```
                    ┌───────────────────────────────────────────────┐
                    │               CLIENT (BROWSER)                │
                    │   React 18 • D3 Math • Code Splitting • A11y  │
                    └───────────────────────┬───────────────────────┘
                                            │ HTTP / JSON
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │               NGINX REVERSE PROXY             │
                    │   Rate Limit (20 r/s) • Static SPA • Cache    │
                    └───────────────────────┬───────────────────────┘
                                            │ /api/v1
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │               FASTAPI BACKEND                 │
                    │   AsyncPG Pool • Pydantic v2 • Health Probes  │
                    └───────────────────────┬───────────────────────┘
                                            │ Least Privilege (app_reader)
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │               POSTGRESQL 18 (GOLD)            │
                    │   Materialized Views • Trigram GIN • JSON RPC │
                    └───────────────────────────────────────────────┘
```

---

## ✨ Principais Funcionalidades

### 1. Carta Tática & Isolinhas de Finalização (KDE)
- **Topografia de Perigo**: Isolinhas de probabilidade de gol calculadas via *Kernel Density Estimation* (KDE) ponderadas por xG.
- **Scrubber Temporal Reativo**: Controle minuto a minuto da partida com suporte completo a teclado (`←`/`→` para 1 min, `Shift + ←`/`→` para 5 min, `Barra de Espaço` para play/pause).
- **Corrida de xG Acumulada**: Gráfico temporal de evolução cumulativa de probabilidade de gol ao longo dos 90 minutos.
- **Ritmo & Intensidade**: Volume de finalizações agrupadas em blocos de 5 minutos para identificação de pressão e transições.

### 2. Análise de Atletas & Comparação Radar
- **Métricas por 90 Minutos**: Gols, assistências, xG, xA, passes-chave e precisão calculados na camada SQL com tratamento para minutagem reduzida.
- **Radar Comparativo Dinâmico**: Comparação face a face entre qualquer par de atletas com normalização estatística.
- **Histórico Clínico e Contratual**: Rastreamento de lesões ativas, transferências e evolução de valor de mercado em EUR.

### 3. Raio-X de Clubes & Confronto Direto (H2H)
- **Elenco Estruturado por Linha Tática**: Goleiros, defensores, meio-campistas e atacantes sem valores arbitrários ou imputações falsas.
- **Classificação Retroativa**: Tabela da liga reconstituída dinamicamente para qualquer rodada do campeonato.
- **Histórico H2H Consolidado**: Retrospecto de vitórias, gols e confrontos diretos em uma única chamada RPC nativa.

### 4. Busca Global Rápida (Trigram GIN)
- Pesquisa instantânea de atletas e clubes indexada por `gin_trgm_ops`, tolerante a variações ortográficas e imune a injeções de wildcards `%`.

---

## 🛠 Stack Tecnológica

| Camada | Tecnologias Utilizadas |
|---|---|
| **Frontend** | React 18, TypeScript Strict, Vite, TanStack Query v5, D3 (*scale, contour, shape, array*), CSS Tokens sem dependência de Tailwind |
| **Backend** | FastAPI, Python 3.13 / 3.12, AsyncPG, Pydantic v2, Pydantic-Settings |
| **Banco de Dados** | PostgreSQL 18, Extensões `btree_gist`, `pg_trgm`, `unaccent`, `pgcrypto` |
| **Infraestrutura** | Docker Multi-Stage, Docker Compose, Nginx (Alpine), GitHub Actions CI |
| **Acessibilidade** | WCAG 2.1 AA, atributos `role="img"`, `<title>` e `<desc>` em SVGs, suporte a `prefers-reduced-motion` |

---

## 🚀 Instalação & Execução

### Pré-requisitos
- [Docker](https://www.docker.com/) e Docker Compose **ou**
- Python 3.12+ e Node.js 20+ com PostgreSQL 16+ local.

### Opção 1: Execução com Docker (Ambiente de Produção)

A infraestrutura de produção utiliza build multi-stage, fecha portas internas (PostgreSQL 5432 e FastAPI 8000) e expõe exclusivamente o Nginx na porta 80:

```bash
# 1. Clonar o repositório
git clone https://github.com/pvolympio/FutMundo.git
cd FutMundo

# 2. Configurar variáveis de ambiente
cp .env.example .env

# 3. Subir os serviços de produção
docker compose -f docker-compose.prod.yml up --build -d
```

Acesse no seu navegador: **`http://localhost`**

---

### Opção 2: Desenvolvimento Local

#### 1. Configurar o Banco de Dados
```bash
# Criar e semear o banco
psql -U postgres -c "CREATE DATABASE futfut;"
psql -U postgres -d futfut -f backend/schema.sql
```

#### 2. Iniciar o Backend FastAPI
```bash
# Criar ambiente virtual
python -m venv .venv
source .venv/bin/activate  # No Windows: .venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt

# Executar a API com reload
uvicorn backend.api.main:app --reload --port 8000
```

Documentação interativa disponível em: **`http://localhost:8000/docs`**

#### 3. Iniciar o Frontend Vite
```bash
cd frontend
npm install
npm run dev
```

Aplicação disponível em: **`http://localhost:3000`**

---

## 🔒 Segurança & Alta Performance

1. **Princípio do Menor Privilégio (`app_reader`)**:
   Em produção, a API conecta ao PostgreSQL através da role de leitura `app_reader`, impedindo qualquer operação de escrita ou manipulação acidental de DDL.
2. **Mitigação de Abusos (Nginx + Proxy-Aware Rate Limit)**:
   - Rate limiting de borda configurado no Nginx (`zone=api_limit rate=20r/s`).
   - Rate limiting secundário em FastAPI baseado no cabeçalho `X-Forwarded-For` com limpeza periódica em memória.
3. **Cache HTTP Inteligente**:
   Endpoints de dados históricos utilizam cabeçalhos `Cache-Control: public, max-age=300`, acelerando a experiência e reduzindo a carga do banco.
4. **Resiliência e Health Probes**:
   - `/health/live`: Probe de liveness que valida se o processo da API está ativo.
   - `/health/ready`: Probe de readiness que checa a conectividade com o banco sem falhar injeção de dependência (retorna `503 Degraded` sem erro 500).
5. **Prevenção de Falhas Gráficas (`ErrorBoundary`)**:
   Componentes de visualização D3 e mapas de finalizações são protegidos por fronteiras de erro, evitando que discrepâncias em dados corrompam a aplicação.

---

## 🧪 Testes & Qualidade

O projeto conta com automação contínua via **GitHub Actions** (`.github/workflows/ci.yml`), validando linting, testes de integração e builds em cada pull request.

### Executar Testes do Backend (Pytest)
```bash
pytest tests/ -v
# 40 testes cobrindo rotas, probes de health, métricas por 90 min e filtros de paginação
```

### Executar Testes do Frontend (Vitest & ESLint v9)
```bash
cd frontend
npm run lint   # ESLint v9 flat config
npm test       # 13 testes unitários de geometria, conversões e cores
npm run build  # Validação de compilação TypeScript strict e chunking
```

---

## 📂 Estrutura do Repositório

```
FutMundo/
├── .github/workflows/ci.yml       # Pipeline de integração contínua
├── backend/
│   ├── api/
│   │   ├── config.py             # Configurações Pydantic v2 com validação CORS
│   │   ├── database.py           # Gerenciamento de pool AsyncPG resiliente
│   │   ├── middleware.py         # Rate limit por IP real e headers de segurança
│   │   ├── main.py               # Instanciação FastAPI e probes /health
│   │   └── routers/              # Endpoints: matches, players, teams, standings
│   ├── schema.sql                # DDL PostgreSQL 18 com Gold Layer e Materialized Views
│   └── tests.sql                 # Suíte nativa de 43 testes de banco
├── frontend/
│   ├── src/
│   │   ├── charts/               # Pitch, ShotContours, ShotMarkers, XgRace, ShotTempo
│   │   ├── views/                # Match, Player, Team, League, Head2Head, Index
│   │   ├── ui/                   # ErrorBoundary, Scrubber, Tabs, Crest, Stat
│   │   └── lib/                  # Contratos de API, formatadores e cálculos geométricos
│   ├── Dockerfile.frontend       # Multi-stage build (Node -> Nginx)
│   └── eslint.config.js          # Configuração flat ESLint v9 + TypeScript
├── nginx/
│   └── nginx.conf                # Proxy reverso com rate limiting e fallback SPA
├── docker-compose.prod.yml       # Orquestração de produção com portas protegidas
└── tests/                        # Bateria de testes de integração e regressão Python
```

---

## 🏷️ Tópicos do Repositório

`football-analytics` • `soccer-data` • `expected-goals` • `tactical-analysis` • `fastapi` • `react` • `typescript` • `postgresql` • `d3-js` • `premier-league` • `data-engineering` • `sports-analytics`

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte `LICENSE` para mais informações.