import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Ambiente } from './config/ambiente';

/** Monta a aplicação Express. As dependências entram por parâmetro, o que facilita os testes. */
export function criarApp(ambiente: Pick<Ambiente, 'origensPermitidas'>) {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: ambiente.origensPermitidas }));
  app.use(express.json({ limit: '100kb' }));

  // Usada pela hospedagem para saber se o serviço está no ar
  app.get('/saude', (_req, res) => {
    res.json({ status: 'ok', horario: new Date().toISOString() });
  });

  app.use((_req, res) => {
    res.status(404).json({ erro: 'rota_inexistente', mensagem: 'Rota não encontrada.' });
  });

  return app;
}
