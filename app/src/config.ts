/**
 * Endereço da API. No celular, "localhost" é o próprio celular: use o IP do
 * computador na rede (veja app/.env.example).
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333').replace(
  /\/$/,
  '',
);
