/**
 * Dados de demonstração: 3 faculdades fictícias, cada uma com cursos,
 * disciplinas, uma conta da coordenação e alunos com perfil preenchido,
 * além de um administrador da plataforma.
 *
 * Senha de todas as contas: Patio2026
 *
 * Uso: `npm run db:semear` (ou automaticamente em `npm run db:resetar`),
 * que executa prisma/semear.ts.
 * Só grava se o banco estiver vazio, para nunca duplicar dados.
 */
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '../src/generated/prisma/client';

export const SENHA_DEMONSTRACAO = 'Patio2026';

type Aluno = {
  nome: string;
  apelido: string;
  usuarioEmail: string;
  curso: number;
  semestre: number;
  turno: 'MANHA' | 'TARDE' | 'NOITE' | 'INTEGRAL';
  frase: string;
  interesses: string[];
  habilidades: string[];
  objetivos: string[];
  horarios: string[];
  cursando: number[];
  ajudo: number[];
  preciso: number[];
};

type Faculdade = {
  nome: string;
  sigla: string;
  cor: string;
  cidade: string;
  uf: string;
  dominio: string;
  cursos: string[];
  // [nome, índice do curso ou null quando é comum a todos]
  disciplinas: [string, number | null][];
  alunos: Aluno[];
};

const CURSOS = ['Ciência da Computação', 'Engenharia de Software', 'Administração'];
const DISCIPLINAS: [string, number | null][] = [
  ['Cálculo I', 0],
  ['Estruturas de Dados', 0],
  ['Banco de Dados', 1],
  ['Engenharia de Requisitos', 1],
  ['Contabilidade Geral', 2],
  ['Metodologia Científica', null],
];

function alunos(prefixo: string): Aluno[] {
  return [
    {
      nome: 'Ana Beatriz Lima',
      apelido: 'Bia',
      usuarioEmail: `ana.lima@aluno.${prefixo}`,
      curso: 0,
      semestre: 3,
      turno: 'NOITE',
      frase: 'Topo grupo de estudos de Cálculo toda terça!',
      interesses: ['games', 'música', 'xadrez'],
      habilidades: ['Python', 'Excel'],
      objetivos: ['GRUPO_ESTUDOS', 'AMIZADE'],
      horarios: ['ter-noite', 'qui-noite'],
      cursando: [0, 1],
      ajudo: [5],
      preciso: [0],
    },
    {
      nome: 'Bruno Carvalho Souza',
      apelido: 'Bruno',
      usuarioEmail: `bruno.souza@aluno.${prefixo}`,
      curso: 0,
      semestre: 5,
      turno: 'NOITE',
      frase: 'Posso ajudar em Cálculo e Estruturas de Dados.',
      interesses: ['futebol', 'séries'],
      habilidades: ['Java', 'C', 'Git'],
      objetivos: ['MONITORIA', 'PROJETOS'],
      horarios: ['ter-noite', 'sab-manha'],
      cursando: [1],
      ajudo: [0, 1],
      preciso: [],
    },
    {
      nome: 'Carla Mendes Rocha',
      apelido: 'Carla',
      usuarioEmail: `carla.rocha@aluno.${prefixo}`,
      curso: 1,
      semestre: 4,
      turno: 'MANHA',
      frase: 'Procurando time para o projeto integrador.',
      interesses: ['design', 'fotografia'],
      habilidades: ['Figma', 'React'],
      objetivos: ['PROJETOS'],
      horarios: ['seg-tarde', 'qua-tarde'],
      cursando: [2, 3],
      ajudo: [],
      preciso: [2],
    },
    {
      nome: 'Diego Fernandes Alves',
      apelido: 'Diego',
      usuarioEmail: `diego.alves@aluno.${prefixo}`,
      curso: 1,
      semestre: 6,
      turno: 'MANHA',
      frase: 'SQL é comigo. Bora montar um grupo de Banco de Dados?',
      interesses: ['corrida', 'tecnologia'],
      habilidades: ['SQL', 'Node.js', 'Docker'],
      objetivos: ['MONITORIA', 'GRUPO_ESTUDOS'],
      horarios: ['seg-tarde', 'sex-manha'],
      cursando: [3],
      ajudo: [2],
      preciso: [],
    },
    {
      nome: 'Eduarda Santos Pereira',
      apelido: 'Duda',
      usuarioEmail: `eduarda.pereira@aluno.${prefixo}`,
      curso: 2,
      semestre: 2,
      turno: 'TARDE',
      frase: 'Primeira vez no campus, quero conhecer gente nova!',
      interesses: ['teatro', 'viagens'],
      habilidades: ['Comunicação', 'Canva'],
      objetivos: ['AMIZADE', 'GRUPO_ESTUDOS'],
      horarios: ['qua-tarde', 'qui-tarde'],
      cursando: [4, 5],
      ajudo: [],
      preciso: [4],
    },
  ];
}

export const FACULDADES: Faculdade[] = [
  {
    nome: 'Faculdade Horizonte',
    sigla: 'FH',
    cor: '#1F6FEB',
    cidade: 'São Paulo',
    uf: 'SP',
    dominio: 'horizonte.edu.br',
    cursos: CURSOS,
    disciplinas: DISCIPLINAS,
    alunos: alunos('horizonte.edu.br'),
  },
  {
    nome: 'Universidade Atlântica',
    sigla: 'UA',
    cor: '#0E7C66',
    cidade: 'Santos',
    uf: 'SP',
    dominio: 'atlantica.edu.br',
    cursos: CURSOS,
    disciplinas: DISCIPLINAS,
    alunos: alunos('atlantica.edu.br'),
  },
  {
    nome: 'Centro Universitário Ipê',
    sigla: 'UNIPÊ',
    cor: '#B5462F',
    cidade: 'Campinas',
    uf: 'SP',
    dominio: 'ipe.edu.br',
    cursos: CURSOS,
    disciplinas: DISCIPLINAS,
    alunos: alunos('ipe.edu.br'),
  },
];

/** Grava os dados de demonstração. Devolve false se o banco já tinha dados. */
export async function semear(
  prisma: PrismaClient,
  opcoes: { senhaAdmin?: string } = {},
): Promise<boolean> {
  if ((await prisma.instituicao.count()) > 0) return false;

  // Custo menor que o da API (12): o seed cria dezenas de contas de uma vez.
  const senhaHash = await bcrypt.hash(SENHA_DEMONSTRACAO, 10);
  const nascimento = new Date('2003-05-10');

  await prisma.$transaction(async (tx) => {
    await tx.administrador.create({
      data: {
        nome: 'Administração Pátio',
        email: 'admin@patio.app',
        // Na internet a senha da plataforma vem do ambiente, não do README.
        senhaHash: opcoes.senhaAdmin ? await bcrypt.hash(opcoes.senhaAdmin, 10) : senhaHash,
      },
    });

    for (const f of FACULDADES) {
      const inst = await tx.instituicao.create({
        data: {
          nome: f.nome,
          sigla: f.sigla,
          corPrimaria: f.cor,
          cidade: f.cidade,
          uf: f.uf,
          dominios: { create: [{ dominio: f.dominio }] },
        },
      });

      const cursos: { id: string }[] = [];
      for (const nome of f.cursos) {
        cursos.push(await tx.curso.create({ data: { instituicaoId: inst.id, nome } }));
      }
      const disciplinas: { id: string }[] = [];
      for (const [nome, curso] of f.disciplinas) {
        disciplinas.push(
          await tx.disciplina.create({
            data: {
              instituicaoId: inst.id,
              nome,
              cursoId: curso === null ? null : cursos[curso]?.id,
            },
          }),
        );
      }

      await tx.usuario.create({
        data: {
          instituicaoId: inst.id,
          papel: 'COORDENACAO',
          nome: `Coordenação ${f.sigla}`,
          apelido: 'Coordenação',
          email: `coordenacao@${f.dominio}`,
          senhaHash,
          emailVerificadoEm: new Date(),
        },
      });

      for (const a of f.alunos) {
        const relacoes = [
          ...a.cursando.map((d) => ({ d, relacao: 'CURSANDO' as const })),
          ...a.ajudo.map((d) => ({ d, relacao: 'POSSO_AJUDAR' as const })),
          ...a.preciso.map((d) => ({ d, relacao: 'PRECISO_AJUDA' as const })),
        ];
        const aluno = await tx.usuario.create({
          data: {
            instituicaoId: inst.id,
            cursoId: cursos[a.curso]?.id,
            nome: a.nome,
            apelido: a.apelido,
            email: a.usuarioEmail,
            senhaHash,
            dataNascimento: nascimento,
            semestre: a.semestre,
            turno: a.turno,
            frase: a.frase,
            interesses: a.interesses,
            habilidades: a.habilidades,
            objetivos: a.objetivos,
            horariosLivres: a.horarios,
            emailVerificadoEm: new Date(),
          },
        });
        await tx.usuarioDisciplina.createMany({
          data: relacoes.map(({ d, relacao }) => ({
            instituicaoId: inst.id,
            usuarioId: aluno.id,
            disciplinaId: disciplinas[d]!.id,
            relacao,
          })),
        });
      }
    }
  });
  return true;
}
