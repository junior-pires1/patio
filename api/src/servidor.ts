import { criarApp } from './app';
import { criarPrisma } from './banco/prisma';
import { lerAmbiente } from './config/ambiente';
import { emailNoTerminal } from './servicos/email';

const ambiente = lerAmbiente();
const prisma = criarPrisma(ambiente.DATABASE_URL);
const app = criarApp({
  origensPermitidas: ambiente.origensPermitidas,
  prisma,
  email: emailNoTerminal,
  segredoJwt: ambiente.JWT_SEGREDO,
});

const servidor = app.listen(ambiente.PORT, () => {
  console.warn(`API do Pátio em http://localhost:${ambiente.PORT}`);
});

// Encerramento limpo (Ctrl+C ou reinício da hospedagem)
for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sinal, () => {
    servidor.close(() => void prisma.$disconnect());
  });
}
