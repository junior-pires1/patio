# Pátio — instruções para assistentes de IA (Claude e outros)

Leia antes de mexer no código. Vale para qualquer integrante que use um assistente neste repositório.

## O projeto

Rede acadêmica multi-faculdade (multi-tenant) da disciplina Fábrica de Software (UNG). Mecânica de
curtir/pular: curtida recíproca vira conexão e libera o chat. **Não é app de namoro**: o foco é
estudo (afinidade por disciplinas, objetivos e horários). Só maiores de 18 anos, com e-mail
institucional. Textos da interface, nomes no código e mensagens de commit em **português**.

## Partes

- `api/`: Node 22, TypeScript estrito, Express 5, Zod 4, Prisma 7 (adapter pg), PostgreSQL com RLS,
  Socket.IO, Vitest + Supertest.
- `app/`: Expo SDK 58 (React Native + web), expo-router, TanStack Query. Leia `app/AGENTS.md`.
- `painel/`: Next.js 16 (App Router) + Tailwind 4. Coordenação de cada faculdade e área da plataforma.
- `painel/src/lib/cliente.ts` é cópia de `app/src/api/cliente.ts`: mudou um, mude o outro.

## Regras que não podem ser quebradas

1. **Isolamento entre faculdades.** Toda consulta a dados de uma faculdade passa por
   `naFaculdade(prisma, instituicaoId, tx => …)`, e o `instituicaoId` vem sempre do token
   (`quem(req)`), nunca de parâmetro da requisição. Tabela nova de dados de faculdade = coluna
   `instituicao_id`, chave composta e política RLS na migração (veja as migrações existentes).
2. **Migrações são SQL escrito à mão** em `api/prisma/migrations/<data>_<nome>/migration.sql`, com o
   `schema.prisma` atualizado junto. Nunca altere uma migração que já foi para o `main`: crie outra.
   Elas rodam sozinhas no banco de produção a cada publicação.
3. **Nunca envie direto para o `main`.** O `main` é publicado automaticamente (Render e Vercel).
   Trabalhe num ramo `tipo/descricao`, rode `npm run verificar` e abra um pull request
   (passo a passo em `CONTRIBUTING.md`). Só faça merge com a integração contínua verde.
4. **Toda mudança vem com testes** (API em `api/tests/integracao`). `npm run verificar` precisa
   passar: formatação, lint, tipos e testes.
5. **Segredos nunca no repositório.** Só nos `.env` locais (fora do Git) e nas variáveis do Render
   e da Vercel. Não peça nem cole senhas, tokens ou a URL do banco em conversas.
6. Commits no padrão Conventional Commits em português, ex.: `feat(app): filtro por turno`.

## Comandos (na raiz)

```
npm install                 # dependências de tudo
npm run db:migrar -w api    # aplica migrações no banco local
npm run db:semear -w api    # dados de demonstração (senha Patio2026)
npm run api                 # API em http://localhost:3333
npm run painel              # painel em http://localhost:3000
npm run app                 # Expo
npm run verificar           # tudo o que a integração contínua confere
```

Erros da API sempre no formato `{ erro, mensagem, campos }`, lançados com `ErroApp`.

Imagens (fotos de perfil e de publicações/mensagens) ficam no próprio banco (`fotos`, `imagens`), até
1 MB, já reduzidas pelo app. Mudança que outros alunos precisam ver na hora = evento em
`ctx.notificar` (veja `api/src/servicos/notificador.ts`) e o tratamento em `app/src/tempo-real.ts`.

## No ar

API https://patio-api-llzk.onrender.com · app https://patio-app-beta.vercel.app ·
painel https://patio-painel.vercel.app. O Render grátis dorme após 15 minutos (primeiro acesso
demora até 1 minuto).
