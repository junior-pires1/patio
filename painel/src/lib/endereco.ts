const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333').replace(
  /\/$/,
  '',
);

/** A API guarda imagens e fotos como "/imagens/<id>"; o navegador precisa do endereço completo. */
export const enderecoDaApi = (caminho: string) =>
  caminho.startsWith('/') ? `${API_URL}${caminho}` : caminho;
