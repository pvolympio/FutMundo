# futebol-db

Base própria de jogadores, treinadores e equipes de futebol, carregada do Wikidata para um PostgreSQL local. É a fundação de uma plataforma maior: primeiro os dados, depois a API e o site.

Tudo aqui roda de graça: Postgres local, dados abertos do Wikidata (CC0) e Python.

## Como rodar

Usa o Postgres que você já tem instalado — sem Docker. Crie o papel e o banco, e rode o esquema:

```bash
psql -U postgres -c "CREATE ROLE futebol LOGIN PASSWORD 'futebol';"
psql -U postgres -c "CREATE DATABASE futebol OWNER futebol;"
psql -U futebol -d futebol -f db/schema.sql   # senha: futebol (ou a que você colocou acima)

python -m venv .venv && source .venv/bin/activate   # no Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                       # confira o DATABASE_URL e edite WDQS_USER_AGENT com seu contato real
python -m pipeline.carga --papel ambos --paises BR --limite 50
```

Se o seu Postgres já usa outro usuário, banco ou porta, ajuste os comandos acima e o `DATABASE_URL` no `.env` de acordo — não precisa ser exatamente `futebol`/`futebol`.

(O `docker-compose.yml` continua no repo como alternativa: `docker compose up -d` faz os três primeiros passos acima de uma vez, caso você queira usá-lo depois.)

Comece sempre com `--limite 50`. Confira o resultado, e só então aumente o escopo.

Para explorar os dados:

```bash
docker compose exec db psql -U futebol -c "SELECT * FROM buscar_pessoas('ronaldo');"
```

As consultas prontas estão em `db/consultas_exemplo.sql`.

### Opções da carga

| Opção | O que faz |
|---|---|
| `--papel jogadores\|treinadores\|ambos` | Quem carregar (padrão: ambos) |
| `--paises BR AR PT` | Filtra pela cidadania, com códigos ISO de 2 letras. Sem isso, carrega o mundo todo |
| `--limite N` | Máximo de pessoas por papel, para testes |
| `--atualizar` | Reprocessa quem já foi carregado (padrão: pula) |
| `--lote N` / `--pausa S` | Tamanho do lote e pausa entre consultas |

Se a lista de ids do mundo inteiro estourar o limite de tempo do serviço, use `--paises` para dividir o trabalho por país.

A carga é retomável: dá para interromper com Ctrl+C e rodar de novo. Cada lote é gravado numa transação, e um lote que falha é ignorado sem corromper nada.

### Quanto tempo leva

Depende do escopo e do humor do serviço do Wikidata. Um país costuma levar dezenas de minutos, o mundo inteiro várias horas. O pipeline respeita a pausa entre consultas e o `Retry-After` do servidor, e é sequencial de propósito.

## Modelo de dados

```
pais ─┐
      ├─ pessoa_pais ─ pessoa ─┬─ jogador ── jogador_posicao ── posicao
equipe ┘                       ├─ treinador
   └───────── vinculo ─────────┘
```

- **pessoa** é a base. Jogador e treinador são papéis sobre ela, então quem foi as duas coisas aparece uma vez só.
- **vinculo** guarda a carreira: pessoa, equipe, função e período. Não existe "time atual" dentro de jogador.
- **Datas com precisão.** O Wikidata registra "1998" como 1998-01-01. Guardamos a precisão junto (9 = ano, 10 = mês, 11 = dia) para nunca fingir que sabemos o dia.
- **equipe**, e não "time", porque TIME é um tipo nativo do SQL.
- `competicao` e `temporada` já existem no esquema, sem carga, para a fase de partidas.
- Busca sem acento e tolerante a erro de digitação, via `pg_trgm` (`buscar_pessoas`, `buscar_equipes`).

## Como a carga funciona

1. Uma consulta leve traz só os QIDs de quem tem a ocupação (jogador ou treinador de futebol).
2. Os detalhes vêm em lotes de 150, com uma consulta para cada tipo de dado. Isso evita o produto cartesiano entre nacionalidades, posições e clubes e mantém cada consulta bem abaixo do limite de 60 s do serviço.
3. As equipes citadas nos vínculos são buscadas e gravadas antes dos vínculos, para a chave estrangeira nunca ficar pendurada.
4. Tudo que o Wikidata devolve é gravado com o id da declaração de origem (`vinculo.fonte_id`), o que dá rastreabilidade.

Limitações conhecidas da v1:

- Não distingue empréstimo de contrato (a coluna `situacao` existe, vazia).
- Passagens de treinador vêm de dois caminhos no Wikidata (P6087 e P286). Duplicatas exatas são descartadas, mas datas ligeiramente diferentes podem gerar duas linhas.
- Pessoas sem nome em português ou inglês são ignoradas.

## Licenças e fotos

Os dados do Wikidata são CC0. As **fotos não**: `imagem_commons` guarda só o nome do arquivo no Wikimedia Commons, e cada imagem tem sua própria licença. Ao exibir uma foto, mostre a atribuição e o link `https://commons.wikimedia.org/wiki/File:<arquivo>`. A imagem em si pode ser servida por `https://commons.wikimedia.org/wiki/Special:FilePath/<arquivo>?width=400`.

## Hospedagem gratuita

Rodando em Docker na sua máquina, não custa nada. Para publicar, serviços como Neon ou Supabase têm plano gratuito de Postgres, mas com limite de armazenamento na casa de algumas centenas de MB (confira o valor atual). A base do mundo inteiro provavelmente não cabe; um recorte por país (`--paises`) costuma caber. Meça com a consulta 7 de `db/consultas_exemplo.sql`.

Nesses serviços, rode `db/schema.sql` uma vez e aponte `DATABASE_URL` para a string de conexão deles.

## API

Só leitura: busca e páginas de jogador, treinador e equipe. A carga continua sendo feita à parte pelo `pipeline.carga`.

```bash
uvicorn api.main:app --reload
```

| Rota | O que devolve |
|---|---|
| `GET /api/busca?q=termo` | Pessoas e equipes que combinam com o termo, misturadas e ordenadas por similaridade |
| `GET /api/jogadores/{slug}` | Dados do jogador + carreira (só vínculos como jogador) |
| `GET /api/treinadores/{slug}` | Dados do treinador + carreira (vínculos como treinador ou auxiliar) |
| `GET /api/equipes/{slug}` | Dados da equipe + elenco atual + comissão técnica atual |
| `GET /api/saude` | Healthcheck simples |

Se seu banco foi criado antes de `vw_treinador` existir no `schema.sql`, rode `db/002_vw_treinador.sql` uma vez (veja o comentário no arquivo).

Em produção, defina `API_CORS_ORIGENS` (domínios separados por vírgula) — sem isso, libera qualquer origem, o que serve para desenvolvimento local mas não deve ir para produção.

## Testes

```bash
pip install pytest
DATABASE_URL_TESTE=postgresql://futebol:futebol@localhost:5432/futebol pytest -q
```

O teste substitui o Wikidata por respostas fixas (com casos sujos de propósito) e usa um Postgres de verdade. **Ele apaga o schema `public` do banco apontado**: use um banco de teste, não o que tem seus dados.

## Se o esquema mudar

As tabelas usam `CREATE TABLE` simples (sem `IF NOT EXISTS`), então rodar `schema.sql` de novo num banco que já tem as tabelas dá erro. Para recomeçar do zero sem Docker, drope e recrie o banco antes: `psql -U postgres -c "DROP DATABASE futebol;" && psql -U postgres -c "CREATE DATABASE futebol OWNER futebol;"`, depois `psql -U futebol -d futebol -f db/schema.sql`. Com Docker: `docker compose down -v && docker compose up -d`.

## Estrutura

```
db/schema.sql              esquema, views e funções de busca
db/002_vw_treinador.sql    migração p/ bancos criados antes de vw_treinador existir
db/consultas_exemplo.sql   trajetória, companheiros, ranking, qualidade dos dados
pipeline/consultas.py      as consultas SPARQL
pipeline/cliente_wikidata.py   cliente HTTP com pausa e re-tentativas
pipeline/carga.py          CLI de carga
api/main.py                rotas da API (busca, jogador, treinador, equipe)
api/consultas.py           as consultas SQL da API
api/db.py                  pool de conexões
tests/                     teste ponta a ponta com Wikidata simulado
```
