# Pátio

Rede acadêmica multi-instituição: aproxima estudantes da **mesma faculdade** por afinidade acadêmica
(disciplinas, quem pode ajudar quem, horários livres, objetivos). A curtida recíproca cria uma conexão
que libera o chat. Cada faculdade é uma rede isolada, administrada pela própria coordenação em um painel web.

Projeto da disciplina **Fábrica de Software** — UNG, Ciências da Computação / Engenharia de Software.
Todas as ferramentas usadas são gratuitas.

## Estrutura do repositório

| Pasta     | Conteúdo                                                | Situação             |
| --------- | ------------------------------------------------------- | -------------------- |
| `api/`    | API em Node.js, Express, Socket.IO, Prisma e PostgreSQL | Em construção        |
| `app/`    | Aplicativo do aluno (React Native + Expo)               | Planejado (Sprint 4) |
| `painel/` | Painel web da coordenação e da plataforma (Next.js)     | Planejado (Sprint 5) |
| `docs/`   | Documentação do projeto                                 | —                    |

## Pré-requisitos

- [Node.js 22 LTS](https://nodejs.org) (há um `.nvmrc` na raiz)
- PostgreSQL 16 — pelo [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recomendado,
  usa o `docker-compose.yml` da raiz) ou pelo [instalador oficial](https://www.postgresql.org/download/)
- [Git](https://git-scm.com)
- VS Code com as extensões recomendadas (o VS Code sugere ao abrir a pasta)

## Primeiros passos

```bash
npm install                     # dependências de todo o repositório + ganchos do Git + cliente Prisma
docker compose up -d            # sobe o PostgreSQL 16 (usuário e senha: patio)
cp api/.env.example api/.env    # no Windows (PowerShell): Copy-Item api/.env.example api/.env
npm run db:migrar -w api        # cria as 24 tabelas, as regras e o isolamento por faculdade
npm run db:semear -w api        # grava as 3 faculdades de demonstração
npm run verificar               # formatação + análise estática + tipos + testes
npm run dev -w api              # API em http://localhost:3333/saude
```

Contas de demonstração (senha `Patio2026`): `ana.lima@aluno.horizonte.edu.br` (aluna),
`coordenacao@horizonte.edu.br` (coordenação) e `admin@patio.app` (plataforma). As outras faculdades
usam os domínios `atlantica.edu.br` e `ipe.edu.br`.

Sem Docker: instale o PostgreSQL 16, crie um usuário e os bancos `patio` e `patio_teste` e ajuste
`DATABASE_URL` e `DATABASE_URL_TESTE` no `api/.env`.

## Comandos da raiz

| Comando             | O que faz                                  |
| ------------------- | ------------------------------------------ |
| `npm run verificar` | Roda tudo o que a integração contínua roda |
| `npm run lint`      | Análise estática (ESLint)                  |
| `npm run formatar`  | Formata o código (Prettier)                |
| `npm run tipos`     | Confere os tipos (TypeScript)              |
| `npm test`          | Testes automatizados (Vitest)              |

## Banco de dados (`api/prisma`)

| Comando (`-w api`)         | O que faz                                                       |
| -------------------------- | --------------------------------------------------------------- |
| `npm run db:migrar`        | Aplica as migrações pendentes                                   |
| `npm run db:semear`        | Grava os dados de demonstração (só se o banco estiver vazio)    |
| `npm run db:resetar`       | Apaga tudo, reaplica as migrações e grava o seed                |
| `npm run db:nova-migracao` | Cria uma migração vazia para escrever o SQL                     |
| `npm run db:gerar`         | Gera o cliente tipado do Prisma (roda sozinho no `npm install`) |
| `npm run db:estudio`       | Abre o Prisma Studio para ver os dados                          |

As migrações são escritas em SQL (`prisma/migrations`) porque têm regras que o Prisma não expressa:
CHECKs, gatilhos e segurança em nível de linha (RLS). O `schema.prisma` descreve as mesmas tabelas
para gerar o cliente tipado; ao mudar o banco, altere os dois.

**Isolamento por faculdade:** toda consulta de uma faculdade passa por `naFaculdade(prisma, id, fn)`
(`api/src/banco/prisma.ts`), que abre uma transação com o papel restrito `patio_app` e a faculdade do
token. Mesmo uma consulta sem filtro só enxerga dados daquela faculdade; os testes em
`api/tests/banco` comprovam isso.

## Rotas da API (até a Sprint 4)

Respostas de erro sempre no formato `{ "erro": "codigo", "mensagem": "texto", "campos": { ... } }`.

| Método e rota         | Login? | O que faz                                                              |
| --------------------- | ------ | ---------------------------------------------------------------------- |
| `GET /saude`          | não    | Verifica se a API está no ar                                           |
| `POST /auth/codigo`   | não    | Envia código de 6 números ao e-mail institucional (vale 10 min)        |
| `POST /auth/cadastro` | não    | Cria a conta com o código (5 tentativas; 18 anos; senha forte)         |
| `POST /auth/login`    | não    | Entra com e-mail e senha; devolve token de acesso (15 min) e renovação |
| `POST /auth/renovar`  | não    | Troca o token de renovação por um novo par (rotação, 30 dias)          |
| `POST /auth/sair`     | não    | Encerra a sessão deste aparelho                                        |
| `GET /eu`             | sim    | Perfil próprio                                                         |
| `PATCH /eu`           | sim    | Atualiza o perfil                                                      |
| `PUT /eu/disciplinas` | sim    | Define cursando / posso ajudar / preciso de ajuda                      |
| `GET /usuarios/:id`   | sim    | Perfil público de um colega da mesma faculdade                         |
| `GET /cursos`         | sim    | Cursos da faculdade                                                    |
| `GET /disciplinas`    | sim    | Disciplinas da faculdade (`?cursoId=` filtra pelo curso)               |

| `GET /descobrir` | aluno | Cartas de colegas, da maior para a menor afinidade, com os motivos |
| `POST /curtidas` | aluno | Curte (`paraId`); se for recíproca, cria o match |
| `POST /pulos` | aluno | Pula um perfil (`paraId`) |
| `GET /matches` | aluno | Conexões, com contatos, última mensagem e não lidas |
| `DELETE /matches/:id` | aluno | Desfaz a conexão |
| `GET /matches/:id/mensagens` | aluno | Mensagens (`?antes=` pagina); marca como lidas |
| `POST /matches/:id/mensagens` | aluno | Envia mensagem |
| `GET/POST /bloqueios` | aluno | Lista / bloqueia (`usuarioId`); bloquear desfaz a conexão |
| `DELETE /bloqueios/:usuarioId` | aluno | Desbloqueia |
| `POST /denuncias` | aluno | Denuncia à coordenação (`denunciadoId`, `motivo`, `bloquear?`) |

**Tempo real:** o app conecta no Socket.IO na mesma porta da API com
`io(URL, { auth: { token: acessoToken } })` e recebe `match:novo`, `mensagem:nova` e `match:desfeito`.

Rotas com login usam o cabeçalho `Authorization: Bearer <acessoToken>`. Em desenvolvimento, o código
de verificação aparece no terminal da API em vez de ir por e-mail.

## Como trabalhamos

Veja [CONTRIBUTING.md](CONTRIBUTING.md): ramos, commits, revisão e Definição de Pronto.
