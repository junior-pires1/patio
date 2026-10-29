import { createServer } from 'node:http';
import { criarApp } from './app';
import { criarPrisma } from './banco/prisma';
import { lerAmbiente } from './config/ambiente';
import { notificadorPush } from './modulos/push/servico';
import { emailNoTerminal, emailPeloBrevo } from './servicos/email';
import { combinar } from './servicos/notificador';
import { criarTempoReal } from './tempo-real';

const ambiente = lerAmbiente();
const prisma = criarPrisma(ambiente.DATABASE_URL);

const email =
  ambiente.BREVO_API_KEY && ambiente.EMAIL_REMETENTE
    ? emailPeloBrevo({ chave: ambiente.BREVO_API_KEY, remetente: ambiente.EMAIL_REMETENTE })
    : emailNoTerminal;
if (email === emailNoTerminal && ambiente.NODE_ENV === 'production') {
  console.warn(
    '[e-mail] BREVO_API_KEY/EMAIL_REMETENTE ausentes: os códigos vão aparecer só no log.',
  );
}

// O app recebe um notificador que repassa ao Socket.IO, criado logo depois
// sobre o mesmo servidor HTTP (mesma porta da API).
const ponte: { tempoReal?: ReturnType<typeof criarTempoReal> } = {};
const app = criarApp({
  origensPermitidas: ambiente.origensPermitidas,
  prisma,
  email,
  segredoJwt: ambiente.JWT_SEGREDO,
  notificar: combinar(
    { enviar: (...args) => ponte.tempoReal?.enviar(...args) },
    notificadorPush(prisma),
  ),
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
