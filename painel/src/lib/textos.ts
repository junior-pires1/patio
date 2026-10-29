export const MOTIVOS: Record<string, string> = {
  PERFIL_FALSO: 'Perfil falso',
  ASSEDIO: 'Assédio',
  CONTEUDO_IMPROPRIO: 'Conteúdo impróprio',
  SPAM: 'Spam',
  VENDA_DE_TRABALHOS: 'Venda de trabalhos',
  OUTRO: 'Outro motivo',
};

export const ACOES: Record<string, string> = {
  ARQUIVADA: 'Arquivada',
  ADVERTENCIA: 'Advertência',
  SUSPENSAO: 'Suspensão',
};

/** Nome legível das ações registradas na auditoria. */
export const ACOES_AUDITORIA: Record<string, string> = {
  denuncia_arquivada: 'Arquivou denúncia',
  denuncia_advertencia: 'Advertiu aluno (denúncia)',
  denuncia_suspensao: 'Suspendeu aluno (denúncia)',
  aluno_suspensao: 'Suspendeu aluno',
  aluno_reativacao: 'Reativou aluno',
  aviso_publicado: 'Publicou aviso',
  aviso_removido: 'Removeu aviso',
  post_removido: 'Removeu publicação do feed',
};

/** 29/10/2026 14:05 */
export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
