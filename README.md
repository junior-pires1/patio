# Pátio

Rede acadêmica multi-instituição: aproxima estudantes da **mesma faculdade** por afinidade acadêmica
(disciplinas, quem pode ajudar quem, horários livres, objetivos). A curtida recíproca cria uma conexão
que libera o chat. Cada faculdade é uma rede isolada, administrada pela própria coordenação em um painel web.

Projeto da disciplina **Fábrica de Software** — UNG, Ciências da Computação / Engenharia de Software.
Todas as ferramentas usadas são gratuitas.

## Estrutura do repositório

| Pasta | Conteúdo | Situação |
|---|---|---|
| `api/` | API em Node.js, Express, Socket.IO, Prisma e PostgreSQL | Em construção |
| `app/` | Aplicativo do aluno (React Native + Expo) | Planejado (Sprint 4) |
| `painel/` | Painel web da coordenação e da plataforma (Next.js) | Planejado (Sprint 5) |
| `docs/` | Documentação do projeto | — |

## Pré-requisitos

- [Node.js 22 LTS](https://nodejs.org) (há um `.nvmrc` na raiz)
- [PostgreSQL 16](https://www.postgresql.org/download/)
- [Git](https://git-scm.com)
- VS Code com as extensões recomendadas (o VS Code sugere ao abrir a pasta)

## Primeiros passos

```bash
npm install          # instala as dependências de todo o repositório e ativa os ganchos do Git
npm run verificar    # formatação + análise estática + tipos + testes
```

## Comandos da raiz

| Comando | O que faz |
|---|---|
| `npm run verificar` | Roda tudo o que a integração contínua roda |
| `npm run lint` | Análise estática (ESLint) |
| `npm run formatar` | Formata o código (Prettier) |
| `npm run tipos` | Confere os tipos (TypeScript) |
| `npm test` | Testes automatizados |

## Como trabalhamos

Veja [CONTRIBUTING.md](CONTRIBUTING.md): ramos, commits, revisão e Definição de Pronto.
