/** Envio de e-mails. Em produção será um provedor gratuito (ex.: Brevo ou Resend). */
export interface EnviadorEmail {
  enviarCodigo(destino: string, codigo: string, faculdade: string): Promise<void>;
}

/** Desenvolvimento: mostra o código no terminal em vez de mandar e-mail. */
export const emailNoTerminal: EnviadorEmail = {
  async enviarCodigo(destino, codigo, faculdade) {
    console.warn(`[e-mail] Código para ${destino} (${faculdade}): ${codigo}`);
  },
};
