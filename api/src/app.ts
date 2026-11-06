import { createHash } from 'node:crypto';
import { z } from 'zod';
import cors from 'cors';
import express from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { Contexto } from './contexto';
import { ErroApp, tratarErros } from './erros';
import { rotasAuth } from './modulos/auth/rotas';
import { rotasAvisos } from './modulos/avisos/rotas';
import { rotasCatalogo } from './modulos/catalogo/rotas';
import { rotasChat } from './modulos/chat/rotas';
import { rotasConexoes } from './modulos/conexoes/rotas';
import { rotasCoordenacao } from './modulos/coordenacao/rotas';
import { rotasFeed } from './modulos/feed/rotas';
import { rotasFotos } from './modulos/fotos/rotas';
import { rotasGrupos } from './modulos/grupos/rotas';
import { rotasImagens } from './modulos/imagens/rotas';
import { rotasPerfil } from './modulos/perfil/rotas';
import { rotasPlataforma } from './modulos/plataforma/rotas';
import { rotasPush } from './modulos/push/rotas';
import { rotasProtecao } from './modulos/protecao/rotas';
import { rotasAudios } from './modulos/audios/rotas';
import { rotasNotificacoes } from './modulos/notificacoes/rotas';
import { rotasSocial } from './modulos/social/rotas';
import { rotasStories } from './modulos/stories/rotas';
import { rotasTermos } from './modulos/termos/rotas';
import { rotasVagas } from './modulos/vagas/rotas';

export type OpcoesApp = Contexto & {
  origensPermitidas: string[];
  /**
   * Requisições por minuto: `geral` por pessoa logada (ou por IP, sem login),
   * `porIp` por endereço e `credenciais` nas rotas de senha. Os testes usam valores maiores.
   */
  limites?: { geral: number; credenciais: number; porIp?: number };
};

const muitasRequisicoes = new ErroApp(
  429,
  'muitas_requisicoes',
  'Muitas tentativas em pouco tempo. Aguarde um minuto.',
);

// Mensagens de validação em português (as que não definimos uma a uma).
z.config(z.locales.ptBR());

/** Monta a aplicação Express. As dependências entram por parâmetro, o que facilita os testes. */
export function criarApp(opcoes: OpcoesApp) {
  const { origensPermitidas, limites = { geral: 300, credenciais: 10 }, ...ctx } = opcoes;
  // Numa faculdade, dezenas de alunos saem pelo mesmo IP: o limite por IP é bem maior.
  const limitePorIp = limites.porIp ?? limites.geral * 10;
  const app = express();
  app.set('trust proxy', 1); // a hospedagem (Render) fica atrás de um proxy
  app.use(helmet());
  app.use(cors({ origin: origensPermitidas }));
  app.use(express.json({ limit: '100kb' }));

  const limitar = (limite: number, chave: 'ip' | 'pessoa' | 'email') =>
    rateLimit({
      windowMs: 60_000,
      limit: limite,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      // RNF: rotas de credenciais contam por IP + e-mail; as demais, por pessoa
      // logada (pelo token) e, sem login, por IP.
      keyGenerator: (req) => {
        const ip = ipKeyGenerator(req.ip ?? '');
        if (chave === 'email') {
          const email: unknown = req.body?.email;
          return typeof email === 'string' ? `${ip}|${email.trim().toLowerCase()}` : ip;
        }
        const token = req.headers.authorization;
        if (chave === 'pessoa' && token) {
          return `token:${createHash('sha256').update(token).digest('base64url')}`;
        }
        return ip;
      },
      // Sem login (fotos, imagens, cadastro), vale só o limite por IP.
      skip: (req) => chave === 'pessoa' && !req.headers.authorization,
      handler: (_req, _res, next) => next(muitasRequisicoes),
    });

  // Página inicial: só confirma que é a API do Pátio
  app.get('/', (_req, res) => {
    res.json({ nome: 'API do Pátio', status: 'no ar', saude: '/saude' });
  });

  // Usada pela hospedagem para saber se o serviço está no ar
  app.get('/saude', (_req, res) => {
    res.json({ status: 'ok', horario: new Date().toISOString() });
  });

  app.use(limitar(limitePorIp, 'ip'));
  app.use(limitar(limites.geral, 'pessoa'));
  const limiteCredenciais = limitar(limites.credenciais, 'email');
  app.use('/auth', rotasAuth(ctx, limiteCredenciais));
  app.use(rotasPlataforma(ctx, limiteCredenciais));

  // Rotas que exigem login (cada rota declara o middleware `logado`)
  app.use(rotasPerfil(ctx));
  app.use(rotasCatalogo(ctx));
  app.use(rotasConexoes(ctx));
  app.use(rotasChat(ctx));
  app.use(rotasProtecao(ctx));
  app.use(rotasAvisos(ctx));
  app.use(rotasCoordenacao(ctx));
  app.use(rotasFeed(ctx));
  app.use(rotasFotos(ctx));
  app.use(rotasImagens(ctx));
  app.use(rotasPush(ctx));
  app.use(rotasGrupos(ctx));
  app.use(rotasSocial(ctx));
  app.use(rotasNotificacoes(ctx));
  app.use(rotasAudios(ctx));
  app.use(rotasStories(ctx));
  app.use(rotasVagas(ctx));
  app.use(rotasTermos(ctx));

  app.use((_req, res) => {
    res.status(404).json({ erro: 'rota_inexistente', mensagem: 'Rota não encontrada.' });
  });
  app.use(tratarErros);

  return app;
}
