import { StyleSheet, type TextStyle } from 'react-native';

/**
 * Identidade visual do Pátio: azul do capelo, amarelo das faíscas e tinta azul-marinho.
 * Dois temas com os mesmos nomes de cor; as telas pegam as cores com `useTema()` ou com
 * estilos criados por `criarEstilos()` (veja `tema-provedor.tsx`).
 */
export type Esquema = 'claro' | 'escuro';

export type Cores = {
  fundo: string;
  superficie: string;
  /** Campos, etiquetas e blocos dentro de cartões. */
  superficieAlta: string;
  texto: string;
  textoSuave: string;
  textoFraco: string;
  borda: string;
  marca: string;
  marcaForte: string;
  marcaSuave: string;
  sobreMarca: string;
  destaque: string;
  destaqueSuave: string;
  sobreDestaque: string;
  erro: string;
  erroSuave: string;
  sucesso: string;
  sucessoSuave: string;
  /** Avisos que descem do topo e bolhas escuras. */
  invertido: string;
  sobreInvertido: string;
  sombra: string;
  /** Véu sobre imagens e telas cheias (stories). */
  veu: string;
};

export const paletas: Record<Esquema, Cores> = {
  claro: {
    fundo: '#F4F5FA',
    superficie: '#FFFFFF',
    superficieAlta: '#ECEEF6',
    texto: '#0E1330',
    textoSuave: '#585F80',
    textoFraco: '#646A8B',
    borda: '#E2E5F0',
    marca: '#2A44C4',
    marcaForte: '#1E34A3',
    marcaSuave: '#E7EBFC',
    sobreMarca: '#FFFFFF',
    destaque: '#F4C82E',
    destaqueSuave: '#FFF5D1',
    sobreDestaque: '#2B2100',
    erro: '#C42F2F',
    erroSuave: '#FDECEC',
    sucesso: '#0F7A50',
    sucessoSuave: '#E2F5EC',
    invertido: '#0E1330',
    sobreInvertido: '#FFFFFF',
    sombra: '#0E1330',
    veu: 'rgba(8,10,22,0.92)',
  },
  escuro: {
    fundo: '#090C18',
    superficie: '#121628',
    superficieAlta: '#1B2036',
    texto: '#ECEEF8',
    textoSuave: '#A3A9C4',
    textoFraco: '#868DAD',
    borda: '#242A43',
    marca: '#8199FF',
    marcaForte: '#6A84F7',
    marcaSuave: '#1C244D',
    sobreMarca: '#090C18',
    destaque: '#FFD54A',
    destaqueSuave: '#352D10',
    sobreDestaque: '#2B2100',
    erro: '#FF7070',
    erroSuave: '#3A1B21',
    sucesso: '#43D592',
    sucessoSuave: '#11301F',
    invertido: '#ECEEF8',
    sobreInvertido: '#090C18',
    sombra: '#000000',
    veu: 'rgba(4,5,12,0.94)',
  },
};

/** Plus Jakarta Sans: cada peso é uma família (não use fontWeight junto). */
export const fonte = {
  regular: 'PlusJakartaSans_400Regular',
  medio: 'PlusJakartaSans_500Medium',
  semi: 'PlusJakartaSans_600SemiBold',
  negrito: 'PlusJakartaSans_700Bold',
  extra: 'PlusJakartaSans_800ExtraBold',
} as const;

export const espaco = { pp: 4, p: 8, m: 12, g: 16, gg: 24, ggg: 32 };
export const raio = { p: 10, m: 14, g: 20, gg: 28, total: 999 };

/** Escala de texto. Cores ficam de fora: cada tela aplica a do tema. */
export const tipo = {
  display: { fontFamily: fonte.extra, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  titulo: { fontFamily: fonte.extra, fontSize: 26, lineHeight: 32, letterSpacing: -0.6 },
  secao: { fontFamily: fonte.negrito, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  nome: { fontFamily: fonte.negrito, fontSize: 15, lineHeight: 20 },
  corpo: { fontFamily: fonte.regular, fontSize: 15, lineHeight: 22 },
  corpoForte: { fontFamily: fonte.semi, fontSize: 15, lineHeight: 22 },
  apoio: { fontFamily: fonte.medio, fontSize: 13, lineHeight: 18 },
  rotulo: { fontFamily: fonte.semi, fontSize: 13, lineHeight: 18 },
  sobrescrito: {
    fontFamily: fonte.negrito,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

/** Cor #RRGGBB com transparência (ex.: fundo suave de uma cor). */
export const suave = (cor: string, alfa = '1F') =>
  cor.length === 7 ? `${cor}${alfa}` : cor;

/** Sombra leve de cartão no tema claro; no escuro, a borda faz esse papel. */
export const elevacao = (c: Cores, nivel: 1 | 2 = 1) => ({
  shadowColor: c.sombra,
  shadowOpacity: nivel === 1 ? 0.06 : 0.14,
  shadowRadius: nivel === 1 ? 14 : 24,
  shadowOffset: { width: 0, height: nivel === 1 ? 4 : 10 },
  elevation: nivel === 1 ? 2 : 6,
});

/** Estilos usados em várias telas. */
export const base = (c: Cores) =>
  StyleSheet.create({
    titulo: { ...tipo.titulo, color: c.texto },
    subtitulo: { ...tipo.corpo, color: c.textoSuave },
    rotulo: { ...tipo.rotulo, color: c.textoSuave, marginBottom: 6 },
    secao: { ...tipo.secao, color: c.texto, marginTop: 12, marginBottom: 4 },
    cartao: {
      backgroundColor: c.superficie,
      borderRadius: raio.g,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      padding: espaco.g,
    },
  });
