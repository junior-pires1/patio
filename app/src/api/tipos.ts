// Formatos devolvidos pela API do Pátio (veja api/src/modulos).

export type Relacao = 'CURSANDO' | 'POSSO_AJUDAR' | 'PRECISO_AJUDA';
export type Turno = 'MANHA' | 'TARDE' | 'NOITE' | 'INTEGRAL';

export type Faculdade = { id: string; nome: string; sigla: string; corPrimaria: string };

export type DisciplinaDoPerfil = {
  relacao: Relacao;
  disciplina: { id: string; nome: string };
};

export type Contatos = { whatsapp?: string; instagram?: string; linkedin?: string };

export type PerfilPublico = {
  id: string;
  apelido: string;
  semestre: number | null;
  turno: Turno | null;
  frase: string | null;
  sobre: string | null;
  fotoUrl: string | null;
  objetivos: string[];
  interesses: string[];
  habilidades: string[];
  horariosLivres: string[];
  curso: { id: string; nome: string } | null;
  disciplinas: DisciplinaDoPerfil[];
};

export type MeuPerfil = PerfilPublico & {
  instituicaoId: string;
  papel: 'ALUNO' | 'COORDENACAO';
  nome: string;
  email: string;
  contatos: Contatos;
  status: string;
  instituicao: Faculdade;
};

export type Sessao = {
  acessoToken: string;
  refreshToken: string;
  expiraEmSegundos: number;
  usuario: MeuPerfil;
};

export type Carta = PerfilPublico & {
  curtiuVoce: boolean;
  afinidade: { pontos: number; motivos: string[] };
};

export type Mensagem = {
  id: string;
  autorId: string;
  texto: string;
  criadoEm: string;
  lidaEm: string | null;
};

export type Conexao = {
  id: string;
  criadoEm: string;
  pessoa: PerfilPublico & { contatos: Contatos };
  ultimaMensagem: Mensagem | null;
  naoLidas: number;
};

export type Curso = { id: string; nome: string };
export type Disciplina = { id: string; nome: string; cursoId: string | null };

export type MotivoDenuncia =
  | 'PERFIL_FALSO'
  | 'ASSEDIO'
  | 'CONTEUDO_IMPROPRIO'
  | 'SPAM'
  | 'VENDA_DE_TRABALHOS'
  | 'OUTRO';
