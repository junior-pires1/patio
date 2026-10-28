import { lerAmbiente } from '../../src/config/ambiente';

describe('lerAmbiente', () => {
  test('usa os valores padrão quando nada é informado', () => {
    const a = lerAmbiente({});
    expect(a.PORT).toBe(3333);
    expect(a.NODE_ENV).toBe('development');
    expect(a.origensPermitidas).toEqual(['http://localhost:3000']);
  });

  test('separa várias origens por vírgula', () => {
    const a = lerAmbiente({ CORS_ORIGENS: 'http://a.com, http://b.com' });
    expect(a.origensPermitidas).toEqual(['http://a.com', 'http://b.com']);
  });

  test('recusa uma porta inválida', () => {
    expect(() => lerAmbiente({ PORT: 'abc' })).toThrow(/Configuração inválida/);
  });
});
