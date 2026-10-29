/**
 * Pontuação de afinidade entre dois alunos da mesma faculdade (RF de
 * descoberta). Quanto maior, mais alto a carta aparece. Cada ponto vem com
 * um motivo legível, mostrado na carta ("Pode te ajudar em Cálculo I").
 */

export type Relacao = 'CURSANDO' | 'POSSO_AJUDAR' | 'PRECISO_AJUDA';

export type PerfilAfinidade = {
  cursoId: string | null;
  turno: string | null;
  objetivos: string[];
  interesses: string[];
  horariosLivres: string[];
  disciplinas: { relacao: Relacao; disciplina: { id: string; nome: string } }[];
};

export const PESOS = {
  meAjuda: 5, // eu preciso de ajuda e a pessoa pode ajudar
  ajudoEla: 3, // a pessoa precisa e eu posso ajudar
  cursamJuntos: 3,
  mesmoCurso: 2,
  mesmoTurno: 1,
  objetivo: 2,
  interesse: 1,
  horario: 1,
} as const;

const OBJETIVOS: Record<string, string> = {
  GRUPO_ESTUDOS: 'grupo de estudos',
  MONITORIA: 'monitoria',
  PROJETOS: 'parceria em projetos',
  AMIZADE: 'amizades',
};

const comuns = (a: string[], b: string[]) => {
  const conjunto = new Set(a.map((x) => x.toLowerCase()));
  return [...new Set(b.filter((x) => conjunto.has(x.toLowerCase())))];
};

function porRelacao(p: PerfilAfinidade, relacao: Relacao) {
  return new Map(
    p.disciplinas
      .filter((d) => d.relacao === relacao)
      .map((d) => [d.disciplina.id, d.disciplina.nome]),
  );
}

export function calcularAfinidade(eu: PerfilAfinidade, outro: PerfilAfinidade) {
  let pontos = 0;
  const motivos: string[] = [];

  const preciso = porRelacao(eu, 'PRECISO_AJUDA');
  const possoAjudar = porRelacao(eu, 'POSSO_AJUDAR');
  const cursando = porRelacao(eu, 'CURSANDO');
  const eleAjuda = porRelacao(outro, 'POSSO_AJUDAR');
  const elePrecisa = porRelacao(outro, 'PRECISO_AJUDA');
  const eleCursa = porRelacao(outro, 'CURSANDO');

  for (const [id, nome] of preciso) {
    if (eleAjuda.has(id)) {
      pontos += PESOS.meAjuda;
      motivos.push(`Pode te ajudar em ${nome}`);
    }
  }
  for (const [id, nome] of possoAjudar) {
    if (elePrecisa.has(id)) {
      pontos += PESOS.ajudoEla;
      motivos.push(`Precisa de ajuda em ${nome}, que você domina`);
    }
  }
  for (const [id, nome] of cursando) {
    if (eleCursa.has(id)) {
      pontos += PESOS.cursamJuntos;
      motivos.push(`Também cursa ${nome}`);
    }
  }
  if (eu.cursoId && eu.cursoId === outro.cursoId) {
    pontos += PESOS.mesmoCurso;
    motivos.push('Mesmo curso');
  }
  if (eu.turno && eu.turno === outro.turno) {
    pontos += PESOS.mesmoTurno;
    motivos.push('Mesmo turno');
  }
  const objetivos = comuns(eu.objetivos, outro.objetivos);
  pontos += objetivos.length * PESOS.objetivo;
  if (objetivos.length > 0) {
    const nomes = objetivos.map((o) => OBJETIVOS[o.toUpperCase()] ?? o.toLowerCase());
    motivos.push(`Também procura ${nomes.join(' e ')}`);
  }
  const interesses = comuns(eu.interesses, outro.interesses);
  pontos += interesses.length * PESOS.interesse;
  if (interesses.length > 0) motivos.push(`Curte ${interesses.slice(0, 3).join(', ')}`);
  const horarios = comuns(eu.horariosLivres, outro.horariosLivres);
  pontos += horarios.length * PESOS.horario;
  if (horarios.length > 0) motivos.push(`${horarios.length} horário(s) livre(s) em comum`);

  return { pontos, motivos };
}
