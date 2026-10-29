# Pátio

Rede acadêmica multi-instituição: aproxima estudantes da **mesma faculdade** por afinidade acadêmica
(disciplinas, quem pode ajudar quem, horários livres, objetivos). A curtida recíproca cria uma conexão
que libera o chat. Cada faculdade é uma rede isolada, administrada pela própria coordenação em um painel web.

Projeto da disciplina **Fábrica de Software** — UNG, Ciências da Computação / Engenharia de Software.
Todas as ferramentas usadas são gratuitas.

## Estrutura do repositório

| Pasta     | Conteúdo                                                | Situação      |
| --------- | ------------------------------------------------------- | ------------- |
| `api/`    | API em Node.js, Express, Socket.IO, Prisma e PostgreSQL | Em construção |
| `app/`    | Aplicativo do aluno (React Native + Expo)               | Em construção |
| `painel/` | Painel web da coordenação e da plataforma (Next.js)     | Em construção |
| `docs/`   | Documentação do projeto                                 | —             |

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
| `npm run api`       | Liga a API em modo de desenvolvimento      |
| `npm run app`       | Liga o Expo para abrir o app no celular    |
| `npm run painel`    | Liga o painel da coordenação (porta 3000)  |

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

## Aplicativo do aluno (`app`)

Feito com Expo SDK 58 e Expo Router. Telas: entrar, criar conta (e-mail institucional + código),
descobrir colegas (cartas com os motivos da afinidade), feed da faculdade (publicações por
categoria, comentários, curtidas e eventos com "eu vou"), grupos de estudo com chat, conexões, chat
em tempo real, perfil (curso, turno, horários, disciplinas, contatos) e denúncia. As cores seguem a faculdade de quem entrou.

**Rodar no celular (Expo Go):**

1. Instale o **Expo Go** no celular (Play Store ou App Store).
2. Celular e computador na **mesma rede Wi-Fi**.
3. Descubra o IP do computador (Windows: `ipconfig`, linha "Endereço IPv4").
4. `copy app\.env.example app\.env` e troque o IP em `EXPO_PUBLIC_API_URL`.
5. Em um terminal: `npm run api`. Em outro: `npm run app`.
6. Leia o QR code com o Expo Go (Android) ou com a câmera (iPhone).

Se o Windows perguntar sobre o firewall do Node.js, permita em **redes privadas**.
Também dá para abrir no navegador apertando `w` no terminal do Expo.

## Painel da coordenação (`painel`)

Next.js 16 + Tailwind CSS 4. Com a API ligada (`npm run api`), rode `npm run painel` e abra
http://localhost:3000. Entre com `coordenacao@horizonte.edu.br` (senha `Patio2026`). Telas:
**Resumo** (indicadores e disciplinas em que os alunos pedem ajuda), **Denúncias** (arquivar,
advertir ou suspender), **Alunos** (buscar, suspender e reativar), **Avisos** (publicar e remover)
e **Auditoria**. Contas de aluno não entram no painel.

**Área da plataforma** (equipe do Pátio): http://localhost:3000/plataforma, com `admin@patio.app`
(senha `Patio2026`). Mostra as métricas gerais (só totais), lista as faculdades parceiras, cadastra
uma faculdade nova (domínios de e-mail + conta da coordenação com senha provisória) e ativa ou
desativa faculdades.

## Rotas da API

Respostas de erro sempre no formato `{ "erro": "codigo", "mensagem": "texto", "campos": { ... } }`.

| Método e rota                             | Quem        | O que faz                                                              |
| ----------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| `GET /saude`                              | público     | Verifica se a API está no ar                                           |
| `POST /auth/codigo`                       | público     | Envia código de 6 números ao e-mail institucional (vale 10 min)        |
| `POST /auth/cadastro`                     | público     | Cria a conta com o código (5 tentativas; 18 anos; senha forte)         |
| `POST /auth/login`                        | público     | Entra com e-mail e senha; devolve token de acesso (15 min) e renovação |
| `POST /auth/renovar`                      | público     | Troca o token de renovação por um novo par (rotação, 30 dias)          |
| `POST /auth/sair`                         | público     | Encerra a sessão deste aparelho                                        |
| `GET /eu`                                 | logado      | Perfil próprio                                                         |
| `PATCH /eu`                               | logado      | Atualiza o perfil                                                      |
| `PUT /eu/disciplinas`                     | logado      | Define cursando / posso ajudar / preciso de ajuda                      |
| `GET /usuarios/:id`                       | logado      | Perfil público de um colega da mesma faculdade                         |
| `GET /cursos`                             | logado      | Cursos da faculdade                                                    |
| `GET /disciplinas`                        | logado      | Disciplinas da faculdade (`?cursoId=` filtra pelo curso)               |
| `GET /descobrir`                          | aluno       | Cartas de colegas, da maior para a menor afinidade, com os motivos     |
| `POST /curtidas`                          | aluno       | Curte (`paraId`); se for recíproca, cria o match                       |
| `POST /pulos`                             | aluno       | Pula um perfil (`paraId`)                                              |
| `GET /matches`                            | aluno       | Conexões, com contatos, última mensagem e não lidas                    |
| `DELETE /matches/:id`                     | aluno       | Desfaz a conexão                                                       |
| `GET /matches/:id/mensagens`              | aluno       | Mensagens (`?antes=` pagina); marca como lidas                         |
| `POST /matches/:id/mensagens`             | aluno       | Envia mensagem                                                         |
| `GET/POST /bloqueios`                     | aluno       | Lista / bloqueia (`usuarioId`); bloquear desfaz a conexão              |
| `DELETE /bloqueios/:usuarioId`            | aluno       | Desbloqueia                                                            |
| `POST /denuncias`                         | aluno       | Denuncia à coordenação (`denunciadoId`, `motivo`, `bloquear?`)         |
| `GET /curtidas/recebidas`                 | aluno       | Quantas curtidas esperam resposta                                      |
| `GET /avisos`                             | logado      | Avisos oficiais da faculdade                                           |
| `GET /coordenacao/resumo`                 | coordenação | Indicadores da faculdade                                               |
| `GET /coordenacao/denuncias`              | coordenação | Fila de denúncias (`?status=ABERTA\|RESOLVIDA`)                        |
| `POST /coordenacao/denuncias/:id/decisao` | coordenação | `ARQUIVADA`, `ADVERTENCIA` ou `SUSPENSAO`                              |
| `GET /coordenacao/alunos`                 | coordenação | Busca (`?busca=&status=&pagina=`)                                      |
| `POST /coordenacao/alunos/:id/suspender`  | coordenação | Suspende e encerra as sessões                                          |
| `POST /coordenacao/alunos/:id/reativar`   | coordenação | Reativa a conta                                                        |
| `POST /coordenacao/avisos`                | coordenação | Publica aviso                                                          |
| `DELETE /coordenacao/avisos/:id`          | coordenação | Remove aviso                                                           |
| `GET /coordenacao/auditoria`              | coordenação | Registro das decisões                                                  |
| `GET /feed`                               | logado      | Publicações (`?categoria=&antes=`)                                     |
| `POST /posts` · `DELETE /posts/:id`       | logado      | Publica / remove (autor ou coordenação)                                |
| `PUT/DELETE /posts/:id/curtida`           | logado      | Curte / descurte                                                       |
| `PUT/DELETE /posts/:id/presenca`          | logado      | Confirma / desmarca presença em evento                                 |
| `GET/POST /posts/:id/comentarios`         | logado      | Comentários                                                            |
| `GET/POST /grupos` · `GET /grupos/:id`    | aluno       | Grupos de estudo (`?disciplinaId=&meus=true`)                          |
| `POST /grupos/:id/entrar` · `/sair`       | aluno       | Entra (respeita as vagas) / sai                                        |
| `GET/POST /grupos/:id/mensagens`          | aluno       | Chat do grupo (só membros)                                             |
| `POST /plataforma/login`                  | público     | Entrar como equipe da plataforma (token de 8 horas)                    |
| `GET /plataforma/metricas`                | plataforma  | Totais gerais (sem dados de alunos)                                    |
| `GET/POST /plataforma/faculdades`         | plataforma  | Lista / cadastra faculdade com domínios e coordenação                  |
| `PATCH /plataforma/faculdades/:id`        | plataforma  | Ativa ou desativa (`{ "ativa": false }`)                               |

**Tempo real:** o app conecta no Socket.IO na mesma porta da API com
`io(URL, { auth: { token: acessoToken } })` e recebe `curtida:nova`, `match:novo`, `mensagem:nova`, `match:desfeito` e `grupo:mensagem`.

Rotas com login usam o cabeçalho `Authorization: Bearer <acessoToken>`. Em desenvolvimento, o código
de verificação aparece no terminal da API em vez de ir por e-mail.

## Publicar na internet

Passo a passo em [docs/DEPLOY.md](docs/DEPLOY.md): banco no **Neon**, API no **Render** (`render.yaml`),
painel e versão web do app na **Vercel**, e-mail pelo **Brevo**. Tudo no plano gratuito.

## Como trabalhamos

Veja [CONTRIBUTING.md](CONTRIBUTING.md): ramos, commits, revisão e Definição de Pronto.
