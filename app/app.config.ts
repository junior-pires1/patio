/// <reference types="node" />
// Completa o app.json com o arquivo do Firebase (push no Android).
// O arquivo não vai para o Git: no EAS ele vem da variável GOOGLE_SERVICES_JSON
// (tipo arquivo); no computador, de app/google-services.json, se existir.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const local = join(__dirname, 'google-services.json');
  const arquivo =
    process.env.GOOGLE_SERVICES_JSON ?? (existsSync(local) ? local : undefined);
  return {
    ...(config as ExpoConfig),
    android: { ...config.android, ...(arquivo ? { googleServicesFile: arquivo } : {}) },
  };
};
