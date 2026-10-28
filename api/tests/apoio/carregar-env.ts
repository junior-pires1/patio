// Carrega api/.env (se existir) antes dos testes, para ler DATABASE_URL_TESTE.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const arquivo = join(__dirname, '..', '..', '.env');
if (existsSync(arquivo)) process.loadEnvFile(arquivo);
