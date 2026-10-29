import { ACOES_AUDITORIA, dataHora } from './textos';

describe('textos do painel', () => {
  test('formata data e hora no padrão brasileiro', () => {
    const iso = new Date(2026, 9, 29, 14, 5).toISOString();
    expect(dataHora(iso)).toMatch(/^29\/10\/2026,? 14:05$/);
  });

  test('toda ação gravada pela API tem um nome legível', () => {
    for (const acao of [
      'denuncia_arquivada',
      'denuncia_advertencia',
      'denuncia_suspensao',
      'aluno_suspensao',
      'aluno_reativacao',
      'aviso_publicado',
      'aviso_removido',
    ]) {
      expect(ACOES_AUDITORIA[acao]).toBeDefined();
    }
  });
});
