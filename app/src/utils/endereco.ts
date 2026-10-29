import { API_URL } from '@/config';

/** A API guarda a foto como "/fotos/<id>"; o app precisa do endereço completo. */
export function enderecoDaFoto(fotoUrl: string | null | undefined): string | null {
  if (!fotoUrl) return null;
  return fotoUrl.startsWith('/') ? `${API_URL}${fotoUrl}` : fotoUrl;
}
