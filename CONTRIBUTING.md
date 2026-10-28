# Como contribuir

## Ramos

- `main` guarda sempre uma versão que funciona. Ninguém dá push direto nela.
- Cada tarefa tem um ramo próprio no formato `tipo/descricao-curta`, por exemplo `feat/cadastro-email` ou `fix/limite-de-tentativas`.
- Ative em **Settings → Branches** a proteção do `main`: exigir pull request, 1 aprovação e a integração contínua passando.

## Commits

Seguimos o padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br), conferido automaticamente pelo `commitlint`:

```
feat(api): cadastro com e-mail institucional
fix(banco): corrige chave composta de curtidas
docs: atualiza o README
```

Tipos usados: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`.

## Fluxo de uma tarefa

1. Pegue um item do Product Backlog (aba _Product Backlog_ da planilha) e mova o cartão para **Em andamento**.
2. Crie o ramo a partir do `main` atualizado.
3. Escreva o código **e os testes**. `npm run verificar` precisa passar.
4. Abra o pull request preenchendo o modelo. Outro desenvolvedor revisa.
5. Depois da aprovação e da integração contínua verde, faça _squash and merge_.

## Padrões de código

- Nomes de variáveis, funções, tabelas e rotas em português, sem acentos; `camelCase` no TypeScript e `snake_case` no banco.
- TypeScript no modo estrito; evite `any`.
- Segredos somente em variáveis de ambiente. O `.env` nunca é versionado.
- Dados de teste sempre fictícios.

## Regra de ouro do projeto

Toda consulta a dados de uma faculdade passa pela transação restrita àquela faculdade, e a faculdade **nunca** vem de um parâmetro da requisição: vem do token de acesso.
