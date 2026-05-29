# Blueprint API (backend)

API backend para o projeto Blueprint — serviço leve em TypeScript usando Bun, Elysia e Drizzle ORM com PostgreSQL.

**Principais tecnologias:** Bun, TypeScript, Elysia, Drizzle ORM, Postgres

## Visão Geral

Este repositório contém a API responsável por criar sessões de chat, orquestrar chamadas a serviços de IA (ex.: Ollama) e acionar workflows no n8n para gerar artefatos. Inclui ferramentas para migração/seed do banco via Drizzle.

## Estrutura do projeto

- `src/` — código-fonte TypeScript
- `src/db/` — configuração do banco e schema
- `src/repositories/` — acesso a dados
- `src/services/` — integrações (Ollama, n8n, etc.)
- `drizzle/` — arquivos de migração e metadados
- `package.json` — scripts úteis (dev, db:push, db:seed, test, lint)

## Pré-requisitos

- Bun (recomendado) — https://bun.sh
- Docker & docker-compose (opcional, há um `docker-compose.yml` no repositório com PostgreSQL, Redis, Ollama e n8n)

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do backend com as variáveis abaixo:

### Desenvolvimento Local (sem Docker)
```
DATABASE_URL=postgres://admin:supersecretpassword@127.0.0.1:5432/blueprint_db
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_TIMEOUT=60000
N8N_GENERATE_URL=http://localhost:5678/webhook/generate
N8N_WEBHOOK_TOKEN=seu-token-secreto-super-seguro
NODE_ENV=development
PORT=3000
```

### Docker Compose (com serviços)
```
# PostgreSQL
POSTGRES_USER=admin
POSTGRES_PASSWORD=supersecretpassword
POSTGRES_DB=blueprint_db

# Redis
REDIS_VERSION=7-alpine
REDIS_PASSWORD=seu-redis-password

# Ollama
OLLAMA_VERSION=latest
OLLAMA_MODEL=llama2

# n8n
N8N_VERSION=latest
N8N_ENCRYPTION_KEY=seu-chave-encriptacao-n8n

# Curl (para ollama-init)
CURL_IMAGES_VERSION=latest

# Backend
DATABASE_URL=postgres://admin:supersecretpassword@postgres:5432/blueprint_db
OLLAMA_URL=http://ollama:11434
N8N_GENERATE_URL=http://n8n:5678/webhook/generate
NODE_ENV=development
PORT=3000
```

Observação: `DATABASE_URL` já possui um valor padrão no código, e `PORT` por padrão está configurado para `3000`.

## Comandos úteis

- Instalar dependências:

```bash
bun install
```

- Rodar em modo desenvolvimento (com watch):

```bash
bun run dev
```

- Rodar o servidor (execução direta):

```bash
bun run src/index.ts
```

- Migrar o esquema (Drizzle):

```bash
bun run db:generate    # gerar migrations a partir do schema
bun run db:push        # aplicar schema no banco
```

- Popular dados (seed):

```bash
bun run db:seed
```

- Testes e lint:

```bash
bun run test
bun run lint
```

## Docker Compose

O projeto inclui um `docker-compose.yml` com todos os serviços necessários:

- **PostgreSQL 16** — Banco de dados principal
- **Redis** — Cache e fila para o n8n (BullMQ)
- **Ollama** — Servidor de modelos LLM com download automático do modelo
- **n8n** — Orquestração de workflows e automações
- **ollama-init** — Serviço auxiliar para baixar o modelo Ollama automaticamente

### Iniciar todos os serviços:

```bash
docker-compose up -d
```

### Serviços e portas expostas:

- PostgreSQL: `localhost:5432` (interno `postgres:5432`)
- Redis: interno `redis:6379`
- Ollama: `localhost:11434`
- n8n: `localhost:5678`

### Verificar status dos serviços:

```bash
docker-compose ps
docker-compose logs -f [service_name]  # ex: docker-compose logs -f n8n
```

### Parar os serviços:

```bash
docker-compose down
```

### Limpar volumes e dados persistidos:

```bash
docker-compose down -v
```

**Nota:** O n8n está configurado para rodar em modo de fila única (simples). Descomente `EXECUTIONS_MODE=queue` no `docker-compose.yml` para ativar modo de fila distribuída quando escalar para múltiplas instâncias.

## Endpoints principais

- `POST /api/v1/chat/session` — cria uma nova sessão de chat
- `POST /api/v1/chat/stream` — envia mensagem e consome stream SSE com respostas
- `GET /api/v1/chat/session/:id/download` — baixa o artefato gerado (Markdown)

## Desenvolvimento

### Com Docker Compose (recomendado):

1. Configure o arquivo `.env` com as variáveis de Docker Compose.
2. Inicie os serviços: `docker-compose up -d`
3. Instale dependências do backend: `bun install`
4. Aplique as migrações: `bun run db:push`
5. (Opcional) Popular dados: `bun run db:seed`
6. Execute em modo desenvolvimento: `bun run dev`

### Desenvolvimento Local (sem Docker):

1. Instale dependências com `bun install`.
2. Configure o arquivo `.env` com as variáveis locais.
3. Execute `bun run dev` para desenvolver com recarregamento automático.

## Observações

- As integrações com Ollama e n8n são configuráveis via variáveis de ambiente. Veja `src/services/ollama.service.ts` e `src/services/n8n.service.ts` para detalhes.
- O banco padrão de desenvolvimento usa `postgres://admin:supersecretpassword@127.0.0.1:5432/blueprint_db` quando `DATABASE_URL` não é definido.

## Contribuição

Pull requests são bem-vindos. Abra issues para discutir mudanças maiores.
