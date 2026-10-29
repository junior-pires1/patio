import { ErroApp } from '../erros';

/** Envio de e-mails (código de confirmação do cadastro). */
export interface EnviadorEmail {
  enviarCodigo(destino: string, codigo: string, faculdade: string): Promise<void>;
}

/** Desenvolvimento: mostra o código no terminal em vez de mandar e-mail. */
export const emailNoTerminal: EnviadorEmail = {
  async enviarCodigo(destino, codigo, faculdade) {
    console.warn(`[e-mail] Código para ${destino} (${faculdade}): ${codigo}`);
  },
};

export function textoDoCodigo(codigo: string, faculdade: string) {
  const assunto = `${codigo} é o seu código do Pátio`;
  const texto =
    `Olá! Use o código ${codigo} para confirmar o seu e-mail no Pátio (${faculdade}).\n` +
    'Ele vale por 10 minutos. Se não foi você, pode ignorar esta mensagem.';
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:16px;color:#14171A">` +
    `<p>Olá!</p><p>Use o código abaixo para confirmar o seu e-mail no <b>Pátio</b> (${faculdade}):</p>` +
    `<p style="font-size:32px;font-weight:bold;letter-spacing:6px">${codigo}</p>` +
    `<p>Ele vale por 10 minutos. Se não foi você, pode ignorar esta mensagem.</p></div>`;
  return { assunto, texto, html };
}

/**
 * Produção: envia pelo Brevo (plano gratuito, 300 e-mails por dia). O
 * remetente precisa estar verificado no painel do Brevo.
 */
export function emailPeloBrevo(opcoes: {
  chave: string;
  remetente: string;
  nome?: string;
  fetch?: typeof fetch;
}): EnviadorEmail {
  const buscar = opcoes.fetch ?? fetch;
  return {
    async enviarCodigo(destino, codigo, faculdade) {
      const { assunto, texto, html } = textoDoCodigo(codigo, faculdade);
      let resposta: Response;
      try {
        resposta = await buscar('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': opcoes.chave,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            sender: { email: opcoes.remetente, name: opcoes.nome ?? 'Pátio' },
            to: [{ email: destino }],
            subject: assunto,
            textContent: texto,
            htmlContent: html,
          }),
        });
      } catch {
        resposta = new Response(null, { status: 599 });
      }
      if (!resposta.ok) {
        console.error(
          `[e-mail] Brevo respondeu ${resposta.status} ao enviar para ${destino}`,
        );
        throw new ErroApp(
          503,
          'email_indisponivel',
          'Não conseguimos enviar o e-mail agora. Tente de novo em instantes.',
        );
      }
    },
  };
}
