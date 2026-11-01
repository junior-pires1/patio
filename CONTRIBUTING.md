# Como contribuir

## Ramos

- `main` guarda sempre uma versão que funciona. Ninguém dá push direto nela.
- Cada tarefa tem um ramo próprio no formato `tipo/descricao-curta`, por exemplo `feat/cadastro-email` ou `fix/limite-de-tentativas`.
- O `main` é protegido no GitHub: só entra por pull request com a integração contínua passando.

## Passo a passo de uma mudança (Prompt de Comando)

O `main` é o que está no ar: tudo que entra nele é publicado. Por isso cada mudança passa por um
ramo e por um pull request.

1. Atualize o seu `main`:

   ```
   cd C:\projetos\patio
   git checkout main
   git pull
   ```

2. Crie o ramo da tarefa (troque o nome):

   ```
   git checkout -b feat/minha-mudanca
   ```

3. Faça a mudança e confira se tudo passa:

   ```
   npm run verificar
   ```

4. Salve e envie o ramo (não o `main`):

   ```
   git add .
   git commit -m "feat(app): descreva a mudança"
   git push -u origin feat/minha-mudanca
   ```

5. Abra o endereço que o `git push` mostrar (ou o repositório no GitHub → **Compare & pull request**),
   preencha o modelo e clique em **Create pull request**.
6. Espere a integração contínua ficar verde (uns 3 minutos) e clique em **Squash and merge**.
   Se ficar vermelha, abra o erro, corrija no mesmo ramo e envie de novo (`git push`).
7. Depois do merge, volte ao `main` e apague o ramo local:

   ```
   git checkout main
   git pull
   git branch -d feat/minha-mudanca
   ```

Se o `git push` disser que o `main` está protegido, é porque você enviou o `main` por engano: refaça a
partir do passo 2. Se o pull request mostrar **conflito**, peça ajuda antes de resolver.

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
5. Com a integração contínua verde, faça _squash and merge_. Pedir revisão de um colega é bem-vindo, mas não obrigatório.

## Padrões de código

- Nomes de variáveis, funções, tabelas e rotas em português, sem acentos; `camelCase` no TypeScript e `snake_case` no banco.
- TypeScript no modo estrito; evite `any`.
- Segredos somente em variáveis de ambiente. O `.env` nunca é versionado.
- Dados de teste sempre fictícios.

## Regra de ouro do projeto

Toda consulta a dados de uma faculdade passa pela transação restrita àquela faculdade, e a faculdade **nunca** vem de um parâmetro da requisição: vem do token de acesso.
