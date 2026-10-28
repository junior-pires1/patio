import { idade } from '../../src/modulos/auth/esquemas';

describe('idade', () => {
  const hoje = new Date('2026-10-28T12:00:00Z');

  test('conta os anos completos', () => {
    expect(idade(new Date('2008-10-28'), hoje)).toBe(18);
    expect(idade(new Date('2008-10-29'), hoje)).toBe(17);
    expect(idade(new Date('2008-11-01'), hoje)).toBe(17);
    expect(idade(new Date('2008-09-30'), hoje)).toBe(18);
  });
});
