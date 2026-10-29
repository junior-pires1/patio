# Colocar o Pátio no ar (de graça)

Tudo usa planos gratuitos. Ordem: **banco (Neon) → API (Render) → painel e app web (Vercel)**.
Faça login em cada serviço com a sua conta do GitHub: fica mais fácil ligar o repositório.

| Parte                | Serviço | Endereço de exemplo                  |
| -------------------- | ------- | ------------------------------------ |
| Banco PostgreSQL     | Neon    | (só a URL de conexão, que é secreta) |
| API + tempo real     | Render  | `https://patio-api.onrender.com`     |
| Painel (coordenação) | Vercel  | `https://patio-painel.vercel.app`    |
| App (versão web)     | Vercel  | `https://patio-app.vercel.app`       |

> Os endereços reais dependem do nome que você escolher. Anote cada um ao criar.

## 1. Banco de dados — Neon

1. Entre em https://neon.tech e crie um projeto chamado `patio` (região mais próxima: **AWS São Paulo**, se aparecer).
2. Em **Connect**, desligue **Connection pooling** e copie a **connection string**.
   Ela é parecida com `postgresql://usuario:senha@ep-xxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require`.
3. Guarde essa URL: é a `DATABASE_URL`. **Não publique em lugar nenhum.**

## 2. API — Render

1. Entre em https://render.com → **New** → **Blueprint** → escolha o repositório `patio`.
   O Render lê o arquivo `render.yaml` da raiz e monta o serviço `patio-api`.
2. Ele pede os valores que não ficam no repositório:
   - `DATABASE_URL`: a URL do Neon.
   - `CORS_ORIGENS`: por enquanto `http://localhost:3000` (ajustamos no passo 5).
   - `BREVO_API_KEY` e `EMAIL_REMETENTE`: deixe em branco por enquanto (passo 6).
   - `JWT_SEGREDO` e `SENHA_ADMIN_PLATAFORMA` são gerados sozinhos.
3. Clique em **Apply**. O primeiro build leva uns 5 minutos: instala, compila, cria as tabelas e grava as faculdades de demonstração.
4. Quando ficar **Live**, abra `https://SEU-SERVICO.onrender.com/saude`. Deve aparecer `"status":"ok"`.

> **Plano gratuito do Render:** depois de 15 minutos sem uso a API "dorme". O primeiro acesso depois disso demora
> uns 50 segundos. Antes de uma apresentação, abra o `/saude` uns minutos antes para acordar.

## 3. Painel — Vercel

1. Entre em https://vercel.com → **Add New** → **Project** → importe o repositório `patio`.
2. Em **Root Directory**, escolha `painel`. O resto vem do `painel/vercel.json`.
3. Em **Environment Variables**, adicione `NEXT_PUBLIC_API_URL` = endereço da API (ex.: `https://patio-api.onrender.com`).
4. **Deploy**. Anote o endereço (ex.: `https://patio-painel.vercel.app`).

## 4. App (versão web) — Vercel

1. Na Vercel, **Add New** → **Project** → o mesmo repositório `patio` de novo.
2. **Root Directory**: `app`. O resto vem do `app/vercel.json`.
3. Variável `EXPO_PUBLIC_API_URL` = endereço da API.
4. **Deploy**. Esse endereço abre no navegador de qualquer celular: é o jeito mais fácil de a banca testar.

## 5. Liberar o painel e o app na API

No Render, em **patio-api → Environment**, troque `CORS_ORIGENS` pelos endereços da Vercel, separados por vírgula:

```
https://patio-painel.vercel.app,https://patio-app.vercel.app
```

Salve. O Render reinicia a API sozinho.

## 6. E-mail de verdade (opcional) — Brevo

Sem isso, o código de cadastro aparece só no **log** do Render (aba **Logs**), o que já serve para demonstração.

1. Crie a conta em https://www.brevo.com (300 e-mails por dia grátis).
2. Em **Senders**, cadastre e confirme o e-mail que vai enviar (pode ser o seu Gmail).
3. Em **SMTP & API → API Keys**, crie uma chave.
4. No Render, preencha `BREVO_API_KEY` (a chave) e `EMAIL_REMETENTE` (o e-mail confirmado).

## 7. App no celular apontando para a API online

No notebook, troque o endereço no `app\.env`:

```
EXPO_PUBLIC_API_URL=https://patio-api.onrender.com
```

e rode `npm run app` de novo. Agora o celular não precisa mais estar no mesmo Wi-Fi que o notebook
(o Expo ainda roda no notebook para entregar o app ao Expo Go).

## Atualizações

Cada `git push` no `main` faz o Render e a Vercel publicarem a versão nova sozinhos. Migrações novas do banco
são aplicadas no build da API.

## Contas de demonstração

As contas de alunos e coordenação do seed usam a senha `Patio2026` (estão no README e servem para a
apresentação). A conta da **plataforma** (`admin@patio.app`) no ar usa a senha gerada em
`SENHA_ADMIN_PLATAFORMA`: veja em **Render → patio-api → Environment**. Para uso real, apague os dados de
demonstração e cadastre as faculdades pela área da plataforma.
