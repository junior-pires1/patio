// Publica as telas novas para quem já tem o .apk instalado (EAS Update, canal preview).
// Uso (na pasta app): npm run atualizar -- "o que mudou"
// O endereço da API vai fixo aqui para o .env do computador (localhost) não entrar no app.
import { spawnSync } from 'node:child_process';

const mensagem = process.argv.slice(2).join(' ').trim() || 'Atualização do Pátio';
const resultado = spawnSync(
  'npx',
  [
    'eas-cli@latest',
    'update',
    '--channel',
    'preview',
    '--environment',
    'preview',
    '--message',
    JSON.stringify(mensagem),
    '--non-interactive',
  ],
  {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, EXPO_PUBLIC_API_URL: 'https://patio-api-llzk.onrender.com' },
  },
);
process.exit(resultado.status ?? 1);
