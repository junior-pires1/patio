import { createServer } from 'node:http';
import { criarApp } from './app';
import { criarPrisma } from './banco/prisma';
import { lerAmbiente } from './config/ambiente';
import { emailNoTerminal } from './servicos/email';
import { criarTempoReal } from './tempo-real';

const ambiente = lerAmbiente();
const prisma = criarPrisma(ambiente.DATABASE_URL);

// O app recebe um notificador que repassa ao Socket.IO, criado logo depois
// sobre o mesmo servidor HTTP (mesma porta da API).
const ponte: { tempoReal?: ReturnType<typeof criarTempoReal> } = {};
const app = criarApp({
  origensPermitidas: ambiente.origensPermitidas,
  prisma,
  email: emailNoTerminal,
  segredoJwt: ambiente.JWT_SEGREDO,
  notificar: { enviar: (...args) => ponte.tempoReal?.enviar(...args) },
});
const servidor = createServer(app);
const tempoReal = criarTempoReal(servidor, {
  segredoJwt: ambiente.JWT_SEGREDO,
  origensPermitidas: ambiente.origensPermitidas,
});
ponte.tempoReal = tempoReal;

servidor.listen(ambiente.PORT, () => {
  console.warn(`API do Pátio em http://localhost:${ambiente.PORT}`);
});

// Encerramento limpo (Ctrl+C ou reinício da hospedagem)
for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sinal, () => {
    void tempoReal.fechar().then(() => prisma.$disconnect());
  });
}
