// Formatos devolvidos pela API (rotas /coordenacao e /avisos).

export type Faculdade = { id: string; nome: string; sigla: string; corPrimaria: string };

export type Usuario = {
  id: string;
  nome: string;
  apelido: string;
  email: string;
  papel: 'ALUNO' | 'COORDENACAO';
  instituicao: Faculdade;
};

export type Sessao = {
  acessoToken: string;
  refreshToken: string;
  expiraEmSegundos: number;
  usuario: Usuario;
};

export type Pagina<T> = { total: number; pagina: number; porPagina: number; itens: T[] };

export type Resumo = {
  periodoEmDias: number;
  alunos: { ativos: number; suspensos: number; novosNoPeriodo: number };
  conexoesAtivas: number;
  mensagensNoPeriodo: number;
  denunciasAbertas: number;
  disciplinasComPedidos: {
    disciplinaId: string;
    nome: string;
    precisamDeAjuda: number;
    podemAjudar: number;
  }[];
};

export type Pessoa = {
  id: string;
  nome: string;
  apelido: string;
  email: string;
  status: 'ATIVA' | 'SUSPENSA' | 'EXCLUIDA';
  advertencias: number;
};

export type Acao = 'ARQUIVADA' | 'ADVERTENCIA' | 'SUSPENSAO';

export type Denuncia = {
  id: string;
  motivo: string;
  detalhe: string | null;
  status: 'ABERTA' | 'RESOLVIDA';
  acao: Acao | null;
  criadoEm: string;
  resolvidaEm: string | null;
  denunciante: Pessoa;
  denunciado: Pessoa & { totalDeDenuncias: number };
  resolvidaPor: { id: string; nome: string } | null;
};

export type Aluno = Pessoa & {
  semestre: number | null;
  criadoEm: string;
  curso: { nome: string } | null;
  totalDeDenuncias: number;
};

export type Aviso = {
  id: string;
  titulo: string;
  texto: string;
  fixado: boolean;
  criadoEm: string;
  autor: { id: string; nome: string };
};

export type RegistroAuditoria = {
  id: string;
  acao: string;
  alvoTipo: string | null;
  alvoId: string | null;
  detalhes: Record<string, unknown>;
  criadoEm: string;
  atorNome: string | null;
};
