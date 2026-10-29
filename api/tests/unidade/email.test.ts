import { emailPeloBrevo, textoDoCodigo } from '../../src/servicos/email';

describe('e-mail', () => {
  test('o texto traz o código e a faculdade', () => {
    const t = textoDoCodigo('482913', 'Faculdade Horizonte');
    expect(t.assunto).toBe('482913 é o seu código do Pátio');
    expect(t.texto).toContain('Faculdade Horizonte');
    expect(t.html).toContain('482913');
  });

  test('envia pelo Brevo com a chave e o remetente', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 201 }));
    const enviador = emailPeloBrevo({
      chave: 'chave-de-teste',
      remetente: 'patio@exemplo.com',
      fetch,
    });
    await enviador.enviarCodigo('aluno@faculdade.edu.br', '123456', 'Faculdade X');

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe('chave-de-teste');
    const corpo = JSON.parse(init.body as string);
    expect(corpo.to).toEqual([{ email: 'aluno@faculdade.edu.br' }]);
    expect(corpo.sender).toEqual({ email: 'patio@exemplo.com', name: 'Pátio' });
  });

  test('falha do Brevo ou da rede vira erro 503 amigável', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const fetch of [
      vi.fn(async () => new Response('{}', { status: 401 })),
      vi.fn(async () => {
        throw new TypeError('rede');
      }),
    ]) {
      const enviador = emailPeloBrevo({
        chave: 'chave-de-teste',
        remetente: 'patio@exemplo.com',
        fetch,
      });
      await expect(enviador.enviarCodigo('a@b.edu.br', '1', 'X')).rejects.toMatchObject({
        status: 503,
        codigo: 'email_indisponivel',
      });
    }
    erro.mockRestore();
  });
});
