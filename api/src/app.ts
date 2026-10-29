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
import { rotasPerfil } from './modulos/perfil/rotas';
import { rotasPlataforma } from './modulos/plataforma/rotas';
import { rotasProtecao } from './modulos/protecao/rotas';

export type OpcoesApp = Contexto & {
  origensPermitidas: string[];
  /** Requisições por minuto. Os testes usam valores maiores. */
  limites?: { geral: number; credenciais: number };
};

const muitasRequisicoes = new ErroApp(
  429,
  'muitas_requisicoes',
  'Muitas tentativas em pouco tempo. Aguarde um minuto.',
);

/** Monta a aplicação Express. As dependências entram por parâmetro, o que facilita os testes. */
export function criarApp(opcoes: OpcoesApp) {
  const { origensPermitidas, limites = { geral: 300, credenciais: 10 }, ...ctx } = opcoes;
  const app = express();
  app.set('trust proxy', 1); // a hospedagem (Render) fica atrás de um proxy
  app.use(helmet());
  app.use(cors({ origin: origensPermitidas }));
  app.use(express.json({ limit: '100kb' }));

  const limitar = (limite: number, porEmail: boolean) =>
    rateLimit({
      windowMs: 60_000,
      limit: limite,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      // RNF: rotas de credenciais contam por IP + e-mail; as demais, por IP.
      keyGenerator: (req) => {
        const ip = ipKeyGenerator(req.ip ?? '');
        const email: unknown = porEmail ? req.body?.email : undefined;
        return typeof email === 'string' ? `${ip}|${email.trim().toLowerCase()}` : ip;
      },
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

  app.use(limitar(limites.geral, false));
  const limiteCredenciais = limitar(limites.credenciais, true);
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
  app.use(rotasGrupos(ctx));

  app.use((_req, res) => {
    res.status(404).json({ erro: 'rota_inexistente', mensagem: 'Rota não encontrada.' });
  });
  app.use(tratarErros);

  return app;
}
