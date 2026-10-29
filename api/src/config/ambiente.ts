import { z } from 'zod';

// Toda a configuração vem de variáveis de ambiente, validadas na partida:
// é melhor a API falhar ao iniciar do que na primeira requisição em produção.
const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  // 3000: painel web; 8081: app aberto no navegador pelo Expo (tecla w)
  CORS_ORIGENS: z.string().default('http://localhost:3000,http://localhost:8081'),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: 'informe a URL do PostgreSQL',
  }),
  // Assina os tokens de acesso. Gere um valor longo e aleatório para cada ambiente.
  JWT_SEGREDO: z.string().min(32, 'use pelo menos 32 caracteres'),
  // E-mail de verdade (opcional): sem eles, o código aparece no terminal.
  BREVO_API_KEY: z.string().min(10).optional(),
  EMAIL_REMETENTE: z.email().optional(),
});

export function lerAmbiente(variaveis: NodeJS.ProcessEnv = process.env) {
  // Variável em branco (comum nos painéis de hospedagem) conta como ausente.
  const preenchidas = Object.fromEntries(
    Object.entries(variaveis).filter(
      ([, valor]) => valor !== undefined && valor.trim() !== '',
    ),
  );
  const resultado = esquema.safeParse(preenchidas);
  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Configuração inválida: ${problemas}`);
  }
  const { CORS_ORIGENS, ...resto } = resultado.data;
  return {
    ...resto,
    origensPermitidas: CORS_ORIGENS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  };
}

export type Ambiente = ReturnType<typeof lerAmbiente>;
