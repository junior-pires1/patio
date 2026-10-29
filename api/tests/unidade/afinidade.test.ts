import {
  calcularAfinidade,
  PESOS,
  type PerfilAfinidade,
} from '../../src/modulos/conexoes/afinidade';

const vazio: PerfilAfinidade = {
  cursoId: null,
  turno: null,
  objetivos: [],
  interesses: [],
  horariosLivres: [],
  disciplinas: [],
};
const calculo = { id: 'd1', nome: 'Cálculo I' };
const bd = { id: 'd2', nome: 'Banco de Dados' };

describe('calcularAfinidade', () => {
  test('perfis sem nada em comum têm zero pontos', () => {
    expect(calcularAfinidade(vazio, vazio)).toEqual({ pontos: 0, motivos: [] });
  });

  test('quem pode ajudar no que eu preciso vale mais que tudo', () => {
    const eu = {
      ...vazio,
      disciplinas: [{ relacao: 'PRECISO_AJUDA' as const, disciplina: calculo }],
    };
    const ajuda = {
      ...vazio,
      disciplinas: [{ relacao: 'POSSO_AJUDAR' as const, disciplina: calculo }],
    };
    const colega = { ...vazio, cursoId: 'c1', turno: 'NOITE' };
    const r = calcularAfinidade(eu, ajuda);
    expect(r).toEqual({ pontos: PESOS.meAjuda, motivos: ['Pode te ajudar em Cálculo I'] });
    expect(r.pontos).toBeGreaterThan(
      calcularAfinidade({ ...eu, cursoId: 'c1', turno: 'NOITE' }, colega).pontos,
    );
  });

  test('soma ajuda mútua, disciplinas, curso, turno, objetivos, interesses e horários', () => {
    const eu: PerfilAfinidade = {
      cursoId: 'c1',
      turno: 'NOITE',
      objetivos: ['GRUPO_ESTUDOS'],
      interesses: ['Xadrez', 'música'],
      horariosLivres: ['ter-noite', 'qui-noite'],
      disciplinas: [
        { relacao: 'POSSO_AJUDAR', disciplina: bd },
        { relacao: 'CURSANDO', disciplina: calculo },
      ],
    };
    const outro: PerfilAfinidade = {
      cursoId: 'c1',
      turno: 'NOITE',
      objetivos: ['GRUPO_ESTUDOS', 'AMIZADE'],
      interesses: ['xadrez'],
      horariosLivres: ['ter-noite'],
      disciplinas: [
        { relacao: 'PRECISO_AJUDA', disciplina: bd },
        { relacao: 'CURSANDO', disciplina: calculo },
      ],
    };
    const r = calcularAfinidade(eu, outro);
    expect(r.pontos).toBe(
      PESOS.ajudoEla +
        PESOS.cursamJuntos +
        PESOS.mesmoCurso +
        PESOS.mesmoTurno +
        PESOS.objetivo +
        PESOS.interesse +
        PESOS.horario,
    );
    expect(r.motivos).toEqual([
      'Precisa de ajuda em Banco de Dados, que você domina',
      'Também cursa Cálculo I',
      'Mesmo curso',
      'Mesmo turno',
      'Também procura grupo de estudos',
      'Curte xadrez',
      '1 horário(s) livre(s) em comum',
    ]);
  });
});
