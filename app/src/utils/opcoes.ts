import type { MotivoDenuncia, Relacao, Turno } from '@/api/tipos';

export const TURNOS: { valor: Turno; rotulo: string }[] = [
  { valor: 'MANHA', rotulo: 'Manhã' },
  { valor: 'TARDE', rotulo: 'Tarde' },
  { valor: 'NOITE', rotulo: 'Noite' },
  { valor: 'INTEGRAL', rotulo: 'Integral' },
];

export const OBJETIVOS = [
  { valor: 'GRUPO_ESTUDOS', rotulo: 'Grupo de estudos' },
  { valor: 'MONITORIA', rotulo: 'Monitoria' },
  { valor: 'PROJETOS', rotulo: 'Projetos' },
  { valor: 'AMIZADE', rotulo: 'Amizades' },
];

export const DIAS = [
  { valor: 'seg', rotulo: 'Seg' },
  { valor: 'ter', rotulo: 'Ter' },
  { valor: 'qua', rotulo: 'Qua' },
  { valor: 'qui', rotulo: 'Qui' },
  { valor: 'sex', rotulo: 'Sex' },
  { valor: 'sab', rotulo: 'Sáb' },
];

export const PERIODOS = [
  { valor: 'manha', rotulo: 'Manhã' },
  { valor: 'tarde', rotulo: 'Tarde' },
  { valor: 'noite', rotulo: 'Noite' },
];

export const RELACOES: { valor: Relacao; rotulo: string }[] = [
  { valor: 'CURSANDO', rotulo: 'Cursando' },
  { valor: 'POSSO_AJUDAR', rotulo: 'Posso ajudar' },
  { valor: 'PRECISO_AJUDA', rotulo: 'Preciso de ajuda' },
];

export const MOTIVOS: { valor: MotivoDenuncia; rotulo: string }[] = [
  { valor: 'PERFIL_FALSO', rotulo: 'Perfil falso' },
  { valor: 'ASSEDIO', rotulo: 'Assédio' },
  { valor: 'CONTEUDO_IMPROPRIO', rotulo: 'Conteúdo impróprio' },
  { valor: 'SPAM', rotulo: 'Spam' },
  { valor: 'VENDA_DE_TRABALHOS', rotulo: 'Venda de trabalhos' },
  { valor: 'OUTRO', rotulo: 'Outro motivo' },
];

export const rotuloTurno = (t: Turno | null) => TURNOS.find((x) => x.valor === t)?.rotulo;

/** "Bia, 3º semestre · Noite" */
export function resumo(p: {
  semestre: number | null;
  turno: Turno | null;
  curso: { nome: string } | null;
}) {
  return [
    p.curso?.nome,
    p.semestre ? `${p.semestre}º semestre` : null,
    rotuloTurno(p.turno),
  ]
    .filter(Boolean)
    .join(' · ');
}
