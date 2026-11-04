// Formatos devolvidos pela API do Pátio (veja api/src/modulos).

export type Relacao = 'CURSANDO' | 'POSSO_AJUDAR' | 'PRECISO_AJUDA';
export type Turno = 'MANHA' | 'TARDE' | 'NOITE' | 'INTEGRAL';

export type Faculdade = { id: string; nome: string; sigla: string; corPrimaria: string };

export type DisciplinaDoPerfil = {
  relacao: Relacao;
  disciplina: { id: string; nome: string };
};

export type Contatos = { whatsapp?: string; instagram?: string; linkedin?: string };

/** Links que toda a faculdade vê no perfil. */
export type Links = {
  github?: string;
  linkedin?: string;
  portfolio?: string;
  lattes?: string;
};

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
  links: Links;
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
  imagemUrl: string | null;
  criadoEm: string;
  lidaEm: string | null;
  /** Publicação compartilhada na conversa (ou indisponível, se foi apagada). */
  post: PostCompartilhado | { id: string; indisponivel: true } | null;
};

export type PostCompartilhado = {
  id: string;
  texto: string;
  imagemUrl: string | null;
  autor: { id: string; apelido: string; fotoUrl: string | null };
};

export type Mencionado = { id: string; apelido: string };

export type TipoNotificacao =
  | 'POST_CURTIDO'
  | 'POST_COMENTADO'
  | 'COMENTARIO_RESPONDIDO'
  | 'COMENTARIO_CURTIDO'
  | 'MENCAO'
  | 'CONEXAO_NOVA'
  | 'RECOMENDACAO';

export type Notificacao = {
  id: string;
  tipo: TipoNotificacao;
  frase: string;
  texto: string | null;
  criadoEm: string;
  lida: boolean;
  matchId: string | null;
  comentarioId: string | null;
  ator: { id: string; apelido: string; fotoUrl: string | null } | null;
  post: { id: string; imagemUrl: string | null } | null;
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

export type Aviso = {
  id: string;
  titulo: string;
  texto: string;
  fixado: boolean;
  criadoEm: string;
  autor: { id: string; nome: string };
};

export type CategoriaPost = 'GERAL' | 'EVENTO' | 'ESTUDOS' | 'VAGA' | 'ACHADOS';

export type AutorResumo = {
  id: string;
  apelido: string;
  fotoUrl: string | null;
  papel: 'ALUNO' | 'COORDENACAO';
};

export type Post = {
  id: string;
  categoria: CategoriaPost;
  texto: string;
  imagemUrl: string | null;
  eventoInicio: string | null;
  eventoLocal: string | null;
  criadoEm: string;
  autor: AutorResumo;
  curtidas: number;
  comentarios: number;
  presencas: number;
  curti: boolean;
  vou: boolean;
  meu: boolean;
  salvo: boolean;
  mencoes: Mencionado[];
};

export type Comentario = {
  id: string;
  texto: string;
  criadoEm: string;
  paiId: string | null;
  autor: AutorResumo;
  meu: boolean;
  curtidas: number;
  curti: boolean;
  mencoes: Mencionado[];
  respostas: Comentario[];
};

export type Grupo = {
  id: string;
  nome: string;
  descricao: string | null;
  encontro: string | null;
  local: string | null;
  vagas: number;
  criadoEm: string;
  disciplina: { id: string; nome: string } | null;
  criador: { id: string; apelido: string };
  membros: number;
  vagasLivres: number;
  souMembro: boolean;
  naoLidas: number;
};

export type GrupoDetalhe = Grupo & {
  listaDeMembros: {
    papel: 'CRIADOR' | 'MEMBRO';
    entrouEm: string;
    usuario: { id: string; apelido: string; fotoUrl: string | null };
  }[];
};

export type MensagemGrupo = {
  id: string;
  texto: string;
  imagemUrl: string | null;
  criadoEm: string;
  autor: { id: string; apelido: string };
};

// ───────────── Perfil social ─────────────

export type TipoExperiencia =
  'ESTAGIO' | 'EMPREGO' | 'PROJETO' | 'MONITORIA' | 'PESQUISA' | 'VOLUNTARIADO' | 'CURSO';

export type Experiencia = {
  id: string;
  tipo: TipoExperiencia;
  titulo: string;
  organizacao: string | null;
  inicio: string;
  fim: string | null;
  descricao: string | null;
};

export type HabilidadeRecomendada = {
  habilidade: string;
  recomendacoes: number;
  euRecomendei: boolean;
};

export type PerfilCompleto = PerfilPublico & {
  experiencias: Experiencia[];
  habilidadesRecomendadas: HabilidadeRecomendada[];
  contadores: { publicacoes: number; conexoes: number; recomendacoes: number };
  relacao: {
    souEu: boolean;
    conexaoId: string | null;
    euCurti: boolean;
    meCurtiu: boolean;
  };
};

/** Resumo de uma pessoa em listas (busca, curtidas, quem viu o story). */
export type PessoaResumo = {
  id: string;
  apelido: string;
  fotoUrl: string | null;
  frase: string | null;
  semestre: number | null;
  curso: { nome: string } | null;
};

export type Story = {
  id: string;
  autorId: string;
  imagemUrl: string;
  legenda: string | null;
  criadoEm: string;
  expiraEm: string;
  visto: boolean;
};

export type StoriesDaPessoa = {
  autor: PessoaResumo;
  stories: Story[];
  meu: boolean;
  todosVistos: boolean;
};

export type DestaqueResumo = {
  id: string;
  titulo: string;
  capaUrl: string | null;
  total: number;
};

export type Destaque = {
  id: string;
  titulo: string;
  autor: PessoaResumo;
  meu: boolean;
  stories: Story[];
};

export type ResultadoBusca = {
  pessoas: (PessoaResumo & { habilidades: string[] })[];
  posts: Post[];
  grupos: {
    id: string;
    nome: string;
    vagas: number;
    membros: number;
    disciplina: { nome: string } | null;
  }[];
};

export type CurtidaFeita = { pessoa: PessoaResumo; curtidoEm: string; conexao: boolean };
export type CurtidaRecebida = { pessoa: PessoaResumo; curtidoEm: string };
