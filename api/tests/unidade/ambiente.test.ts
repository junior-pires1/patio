import { lerAmbiente } from '../../src/config/ambiente';

const BANCO = 'postgresql://patio:patio@localhost:5432/patio';

describe('lerAmbiente', () => {
  test('usa os valores padrão quando nada é informado', () => {
    const a = lerAmbiente({ DATABASE_URL: BANCO });
    expect(a.PORT).toBe(3333);
    expect(a.NODE_ENV).toBe('development');
    expect(a.origensPermitidas).toEqual(['http://localhost:3000']);
  });

  test('separa várias origens por vírgula', () => {
    const a = lerAmbiente({
      DATABASE_URL: BANCO,
      CORS_ORIGENS: 'http://a.com, http://b.com',
    });
    expect(a.origensPermitidas).toEqual(['http://a.com', 'http://b.com']);
  });

  test('recusa uma porta inválida', () => {
    expect(() => lerAmbiente({ DATABASE_URL: BANCO, PORT: 'abc' })).toThrow(
      /Configuração inválida/,
    );
  });

  test('exige a URL do banco de dados', () => {
    expect(() => lerAmbiente({})).toThrow(/DATABASE_URL/);
    expect(() => lerAmbiente({ DATABASE_URL: 'mysql://x@y/z' })).toThrow(/DATABASE_URL/);
  });
});
