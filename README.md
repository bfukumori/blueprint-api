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
- PostgreSQL (local ou via Docker)
- Docker & docker-compose (opcional, há um `docker-compose.yml` no repositório)

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do backend com as variáveis abaixo (valores de exemplo):

```
DATABASE_URL=postgres://admin:supersecretpassword@127.0.0.1:5432/blueprint_db
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_TIMEOUT=60000
N8N_GENERATE_URL=http://localhost:5678/webhook/generate
N8N_WEBHOOK_TOKEN=seu-token-secreto-super-seguro
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

- Iniciar serviços via Docker Compose (se aplicável):

```bash
docker-compose up -d
```

## Endpoints principais

- `POST /api/v1/chat/session` — cria uma nova sessão de chat
- `POST /api/v1/chat/stream` — envia mensagem e consome stream SSE com respostas
- `GET /api/v1/chat/session/:id/download` — baixa o artefato gerado (Markdown)

## Desenvolvimento

1. Instale dependências com `bun install`.
2. Crie/ajuste `.env` conforme necessário.
3. Execute `bun run dev` para desenvolver com recarregamento automático.

## Observações

- As integrações com Ollama e n8n são configuráveis via variáveis de ambiente. Veja `src/services/ollama.service.ts` e `src/services/n8n.service.ts` para detalhes.
- O banco padrão de desenvolvimento usa `postgres://admin:supersecretpassword@127.0.0.1:5432/blueprint_db` quando `DATABASE_URL` não é definido.

## Contribuição

Pull requests são bem-vindos. Abra issues para discutir mudanças maiores.
