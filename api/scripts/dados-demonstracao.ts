/**
 * Conteúdo fictício para popular uma faculdade de demonstração (nomes,
 * cursos, disciplinas, publicações...). Nenhuma pessoa real.
 */

export const CURSOS = [
  'Ciência da Computação',
  'Sistemas de Informação',
  'Análise e Desenvolvimento de Sistemas',
  'Engenharia de Software',
  'Administração',
  'Design Gráfico',
];

/** [nome, índice do curso ou null quando é comum a todos] */
export const DISCIPLINAS: [string, number | null][] = [
  ['Algoritmos e Lógica de Programação', null],
  ['Cálculo I', 0],
  ['Cálculo II', 0],
  ['Estruturas de Dados', 0],
  ['Banco de Dados', null],
  ['Programação Orientada a Objetos', null],
  ['Desenvolvimento Web', 2],
  ['Engenharia de Requisitos', 3],
  ['Arquitetura de Software', 3],
  ['Fábrica de Software', 3],
  ['Redes de Computadores', 1],
  ['Sistemas Operacionais', 0],
  ['Inteligência Artificial', 0],
  ['Estatística', null],
  ['Gestão de Projetos', 1],
  ['Contabilidade Geral', 4],
  ['Marketing Digital', 4],
  ['Tipografia', 5],
  ['UX e Interfaces', 5],
  ['Metodologia Científica', null],
];

export const NOMES = [
  'Lucas',
  'Gabriela',
  'Rafael',
  'Mariana',
  'Thiago',
  'Beatriz',
  'Felipe',
  'Larissa',
  'Gustavo',
  'Camila',
  'Bruno',
  'Isabela',
  'Leonardo',
  'Juliana',
  'Matheus',
  'Amanda',
  'Pedro',
  'Fernanda',
  'Diego',
  'Letícia',
  'Vitor',
  'Natália',
  'Caio',
  'Bianca',
  'André',
  'Carolina',
  'Rodrigo',
  'Yasmin',
  'Henrique',
  'Sofia',
  'Eduardo',
  'Jéssica',
  'Murilo',
  'Patrícia',
  'Samuel',
  'Raquel',
  'Daniel',
  'Vanessa',
  'Igor',
  'Tainá',
  'Otávio',
  'Luana',
  'Renan',
  'Priscila',
  'Fábio',
  'Débora',
  'Wesley',
  'Lívia',
];

export const SOBRENOMES = [
  'Almeida',
  'Barbosa',
  'Cardoso',
  'Duarte',
  'Esteves',
  'Ferraz',
  'Gonçalves',
  'Henriques',
  'Lacerda',
  'Macedo',
  'Nogueira',
  'Oliveira',
  'Pacheco',
  'Queiroz',
  'Rezende',
  'Sampaio',
  'Teixeira',
  'Vasconcelos',
  'Moraes',
  'Prado',
  'Rocha',
  'Siqueira',
  'Toledo',
  'Viana',
];

export const FRASES = [
  'Bora montar um grupo de estudos pra prova?',
  'Curto backend, café e música alta.',
  'Procurando gente pra fechar o time do projeto integrador.',
  'Monitor nas horas vagas, estudante em tempo integral.',
  'Se tiver dúvida de SQL, me chama!',
  'Aprendendo React um componente por vez.',
  'Trabalho de dia, estudo à noite, sobrevivo de café.',
  'Quero conhecer o pessoal dos outros cursos.',
  'Designer em formação, pixel perfect sempre.',
  'Hackathon? Tô dentro.',
  'Cálculo é difícil, mas a gente vence junto.',
  'Ex-estagiário, atual caçador de vagas.',
];

export const SOBRE = [
  'Estou no meio do curso e quero transformar o que aprendo em projetos reais. Gosto de trabalhar em equipe e de explicar a matéria pros colegas.',
  'Entrei na faculdade depois de alguns anos trabalhando no comércio. Hoje estudo desenvolvimento e quero meu primeiro estágio na área.',
  'Gosto de dados, de estatística e de descobrir padrões. Nas horas vagas participo de maratonas de programação.',
  'Sou de Guarulhos, pego o ônibus cedo e uso o trajeto pra revisar a matéria. Sempre topo um grupo de estudos.',
  'Interessado em segurança da informação e redes. Estou montando um laboratório em casa com um servidor antigo.',
  'Faço freelas de design e quero juntar criatividade com tecnologia. Busco gente pra projetos de interface.',
];

export const INTERESSES = [
  'games',
  'música',
  'futebol',
  'séries',
  'leitura',
  'fotografia',
  'corrida',
  'xadrez',
  'anime',
  'cinema',
  'culinária',
  'viagens',
  'tecnologia',
  'skate',
  'teatro',
  'podcasts',
];

export const HABILIDADES = [
  'Python',
  'JavaScript',
  'TypeScript',
  'Java',
  'C#',
  'SQL',
  'React',
  'Node.js',
  'Git',
  'Excel',
  'Power BI',
  'Figma',
  'Docker',
  'Linux',
  'Scrum',
  'Photoshop',
  'Inglês',
  'C',
];

export const OBJETIVOS = ['GRUPO_ESTUDOS', 'MONITORIA', 'PROJETOS', 'AMIZADE'];
export const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
export const PERIODOS = ['manha', 'tarde', 'noite'];
export const TURNOS = ['MANHA', 'TARDE', 'NOITE', 'NOITE', 'NOITE'] as const;

export const EXPERIENCIAS: {
  tipo: string;
  titulo: string;
  organizacao: string | null;
  descricao: string | null;
}[] = [
  {
    tipo: 'ESTAGIO',
    titulo: 'Estágio em desenvolvimento web',
    organizacao: 'Agência Fictícia Digital',
    descricao: 'Manutenção de sites em React e integração com APIs.',
  },
  {
    tipo: 'MONITORIA',
    titulo: 'Monitoria de Algoritmos',
    organizacao: 'UNG',
    descricao: 'Plantão de dúvidas duas vezes por semana.',
  },
  {
    tipo: 'PROJETO',
    titulo: 'App de caronas para o campus',
    organizacao: null,
    descricao: 'Projeto em grupo com React Native e Firebase.',
  },
  {
    tipo: 'EMPREGO',
    titulo: 'Auxiliar administrativo',
    organizacao: 'Comércio Exemplo Ltda.',
    descricao: 'Controle de estoque em planilhas e atendimento.',
  },
  {
    tipo: 'PESQUISA',
    titulo: 'Iniciação científica em visão computacional',
    organizacao: 'Laboratório de IA (fictício)',
    descricao: 'Classificação de imagens com redes neurais.',
  },
  {
    tipo: 'VOLUNTARIADO',
    titulo: 'Aulas de informática para a comunidade',
    organizacao: 'ONG Bairro Conectado',
    descricao: null,
  },
  {
    tipo: 'CURSO',
    titulo: 'Curso de Banco de Dados com PostgreSQL',
    organizacao: 'Plataforma online',
    descricao: null,
  },
  {
    tipo: 'PROJETO',
    titulo: 'Bot de avisos para o Discord da turma',
    organizacao: null,
    descricao: 'Node.js, lembra das entregas e provas.',
  },
];

export const POSTS: {
  categoria: string;
  texto: string;
  evento?: { dias: number; local: string };
}[] = [
  {
    categoria: 'ESTUDOS',
    texto:
      'Alguém tem um resumo bom de Estruturas de Dados? Prova semana que vem e árvore AVL ainda não entrou.',
  },
  {
    categoria: 'ESTUDOS',
    texto:
      'Montei uma lista de exercícios de SQL com gabarito. Quem quiser, comenta que eu mando.',
  },
  {
    categoria: 'EVENTO',
    texto:
      'Maratona de programação no laboratório 3! Times de 3 pessoas, inscrição na hora.',
    evento: { dias: 5, local: 'Laboratório 3, Bloco B' },
  },
  {
    categoria: 'EVENTO',
    texto: 'Palestra sobre carreira em dados com ex-alunos. Vai ter coffee break.',
    evento: { dias: 9, local: 'Auditório principal' },
  },
  {
    categoria: 'EVENTO',
    texto: 'Grupo de estudos de Cálculo II na biblioteca, toda quinta.',
    evento: { dias: 2, local: 'Biblioteca, 2º andar' },
  },
  {
    categoria: 'VAGA',
    texto:
      'Vaga de estágio em suporte técnico perto do campus, 6 horas, aceita a partir do 3º semestre. Me chama que passo o contato.',
  },
  {
    categoria: 'VAGA',
    texto:
      'Projeto de extensão procurando 2 pessoas de design para redesenhar o site de uma ONG.',
  },
  {
    categoria: 'ACHADOS',
    texto: 'Achei um carregador de notebook no laboratório 5. Deixei na secretaria.',
  },
  {
    categoria: 'ACHADOS',
    texto:
      'Perdi uma garrafa azul com adesivos de banda no bloco A. Se alguém achar, me avisa!',
  },
  {
    categoria: 'GERAL',
    texto: 'Primeira semana de aula: qual a melhor lanchonete perto do campus?',
  },
  {
    categoria: 'GERAL',
    texto: 'Finalmente entreguei o projeto integrador. Obrigado time pelas madrugadas!',
  },
  {
    categoria: 'GERAL',
    texto: 'Dica: a sala de estudos do bloco C fica vazia depois das 21h.',
  },
  {
    categoria: 'ESTUDOS',
    texto: 'Quem entende de Docker? Meu container não sobe de jeito nenhum.',
  },
  {
    categoria: 'ESTUDOS',
    texto: 'Compartilhando meu mapa mental de Engenharia de Requisitos. Espero que ajude!',
  },
  {
    categoria: 'GERAL',
    texto: 'Alguém indo pro hackathon do fim de semana? Bora rachar o Uber.',
  },
  {
    categoria: 'ESTUDOS',
    texto:
      'Estudar Python com projetinhos pequenos funcionou muito pra mim. Fiz um controle de gastos.',
  },
  { categoria: 'GERAL', texto: 'O café da cantina subiu de preço de novo...' },
  {
    categoria: 'EVENTO',
    texto: 'Workshop de Figma para iniciantes, traga seu notebook.',
    evento: { dias: 12, local: 'Sala 204' },
  },
  {
    categoria: 'VAGA',
    texto: 'Monitoria de Banco de Dados com inscrições abertas até sexta.',
  },
  {
    categoria: 'ESTUDOS',
    texto: 'Alguém quer revisar POO comigo hoje à noite? Herança e polimorfismo.',
  },
];

export const COMENTARIOS = [
  'Me manda também, por favor!',
  'Tô dentro!',
  'Boa! Salvei aqui.',
  'Posso ajudar com isso, me chama no chat.',
  'Valeu pela dica!',
  'Que horas começa?',
  'Também preciso, prova na terça.',
  'Parabéns, ficou muito bom!',
  'Vou levar dois amigos.',
  'Kkkk verdade.',
];

export const GRUPOS = [
  {
    nome: 'Cálculo sem medo',
    disciplina: 'Cálculo I',
    encontro: 'Terças 19h',
    local: 'Biblioteca',
  },
  {
    nome: 'SQL na prática',
    disciplina: 'Banco de Dados',
    encontro: 'Quartas 20h',
    local: 'Laboratório 2',
  },
  {
    nome: 'Maratonistas UNG',
    disciplina: 'Algoritmos e Lógica de Programação',
    encontro: 'Sábados 10h',
    local: 'Laboratório 3',
  },
  {
    nome: 'POO para a P2',
    disciplina: 'Programação Orientada a Objetos',
    encontro: 'Quintas 19h30',
    local: 'Online',
  },
  {
    nome: 'Time do projeto integrador',
    disciplina: 'Fábrica de Software',
    encontro: 'Segundas 21h',
    local: 'Sala 108',
  },
  {
    nome: 'Estatística em grupo',
    disciplina: 'Estatística',
    encontro: 'Sextas 18h',
    local: 'Biblioteca',
  },
  {
    nome: 'UX e interfaces',
    disciplina: 'UX e Interfaces',
    encontro: 'Quartas 14h',
    local: 'Laboratório de design',
  },
  {
    nome: 'Redes: rumo à certificação',
    disciplina: 'Redes de Computadores',
    encontro: 'Sábados 14h',
    local: 'Online',
  },
];

export const MENSAGENS_GRUPO = [
  'Oi pessoal! Alguém já começou a lista?',
  'Fiz até o exercício 4, travei no 5.',
  'No 5 tem que usar a regra da cadeia.',
  'Amanhã no mesmo horário?',
  'Fechado, levo os resumos.',
  'Valeu, ajudou demais!',
];

export const CONVERSAS = [
  [
    'Oi! Vi que você também faz Banco de Dados.',
    'Oi! Faço sim, tá puxado esse semestre.',
    'Bora estudar junto pra prova?',
    'Bora! Quinta à noite fica bom?',
  ],
  [
    'E aí, curti seu projeto do app de caronas!',
    'Valeu! Ainda falta muita coisa haha',
    'Se precisar de alguém no front, tô dentro.',
  ],
  [
    'Oi, tudo bem? Você é monitor de Algoritmos, né?',
    'Sou sim! Pode mandar a dúvida.',
    'Recursão não entra na minha cabeça kkk',
    'Normal no começo, amanhã te explico com um exemplo.',
  ],
  ['Vai no hackathon?', 'Vou! Já tem time?', 'Ainda não, monta comigo?', 'Fechou!'],
];

export const AVISOS = [
  {
    titulo: 'Semana de provas',
    texto:
      'As provas do bimestre acontecem de 17 a 21 de novembro. Confira as salas no portal do aluno.',
    fixado: true,
  },
  {
    titulo: 'Inscrições para monitoria',
    texto:
      'Estão abertas as inscrições para monitoria de Algoritmos, Banco de Dados e Cálculo. Procure a coordenação até sexta.',
    fixado: false,
  },
  {
    titulo: 'Feira de estágios',
    texto:
      'Empresas da região estarão no campus no dia 25. Traga seu currículo atualizado.',
    fixado: false,
  },
];

export const LEGENDAS = [
  'Estudando pra prova',
  'Vista do laboratório hoje',
  'Café e código',
  'Grupo de estudos rendeu!',
  null,
  'Partiu hackathon',
  null,
  'Fim de projeto',
];
