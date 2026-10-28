import { z } from 'zod';

// Toda a configuração vem de variáveis de ambiente, validadas na partida:
// é melhor a API falhar ao iniciar do que na primeira requisição em produção.
const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  CORS_ORIGENS: z.string().default('http://localhost:3000'),
});

export function lerAmbiente(variaveis: NodeJS.ProcessEnv = process.env) {
  const resultado = esquema.safeParse(variaveis);
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
