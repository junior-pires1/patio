import type {
  CategoriaPost,
  Modalidade,
  MotivoDenuncia,
  Relacao,
  StatusCandidatura,
  TipoExperiencia,
  TipoVaga,
  Turno,
} from '@/api/tipos';

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

export const CATEGORIAS: { valor: CategoriaPost; rotulo: string }[] = [
  { valor: 'GERAL', rotulo: 'Geral' },
  { valor: 'ESTUDOS', rotulo: 'Estudos' },
  { valor: 'EVENTO', rotulo: 'Evento' },
  { valor: 'VAGA', rotulo: 'Vagas' },
  { valor: 'ACHADOS', rotulo: 'Achados' },
];

export const categoria = (valor: CategoriaPost) =>
  CATEGORIAS.find((c) => c.valor === valor) ?? CATEGORIAS[0]!;

export const TIPOS_EXPERIENCIA: { valor: TipoExperiencia; rotulo: string }[] = [
  { valor: 'ESTAGIO', rotulo: 'Estágio' },
  { valor: 'EMPREGO', rotulo: 'Emprego' },
  { valor: 'PROJETO', rotulo: 'Projeto' },
  { valor: 'MONITORIA', rotulo: 'Monitoria' },
  { valor: 'PESQUISA', rotulo: 'Pesquisa' },
  { valor: 'VOLUNTARIADO', rotulo: 'Voluntariado' },
  { valor: 'CURSO', rotulo: 'Curso' },
  { valor: 'CERTIFICADO', rotulo: 'Certificado' },
];
export const rotuloExperiencia = (t: TipoExperiencia) =>
  TIPOS_EXPERIENCIA.find((x) => x.valor === t)?.rotulo ?? t;

// ───────────── Vagas ─────────────

export const TIPOS_VAGA: {
  valor: TipoVaga;
  rotulo: string;
  icone: 'briefcase' | 'school' | 'flask' | 'construct' | 'business' | 'heart-circle';
}[] = [
  { valor: 'ESTAGIO', rotulo: 'Estágio', icone: 'briefcase' },
  { valor: 'MONITORIA', rotulo: 'Monitoria', icone: 'school' },
  { valor: 'PESQUISA', rotulo: 'Iniciação científica', icone: 'flask' },
  { valor: 'PROJETO', rotulo: 'Projeto', icone: 'construct' },
  { valor: 'EMPREGO', rotulo: 'Emprego', icone: 'business' },
  { valor: 'VOLUNTARIADO', rotulo: 'Voluntariado', icone: 'heart-circle' },
];
export const tipoVaga = (t: TipoVaga) => TIPOS_VAGA.find((x) => x.valor === t)!;

export const MODALIDADES: { valor: Modalidade; rotulo: string }[] = [
  { valor: 'PRESENCIAL', rotulo: 'Presencial' },
  { valor: 'HIBRIDO', rotulo: 'Híbrido' },
  { valor: 'REMOTO', rotulo: 'Remoto' },
];
export const rotuloModalidade = (m: Modalidade) =>
  MODALIDADES.find((x) => x.valor === m)?.rotulo ?? m;

export const STATUS_CANDIDATURA: Record<StatusCandidatura, string> = {
  ENVIADA: 'Enviada',
  EM_ANALISE: 'Em análise',
  APROVADA: 'Aprovada',
  RECUSADA: 'Não seguiu',
};
