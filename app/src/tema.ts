import { StyleSheet } from 'react-native';

/** Cores neutras do app. A cor principal vem da faculdade (cor_primaria). */
export const cores = {
  fundo: '#F6F7F9',
  superficie: '#FFFFFF',
  texto: '#14171A',
  textoSuave: '#5B6470',
  borda: '#E2E5EA',
  erro: '#C62828',
  sucesso: '#2E7D32',
  padrao: '#1F6FEB',
};

export const espaco = { p: 8, m: 12, g: 16, gg: 24 };
export const raio = { p: 8, m: 14, g: 22 };

/** Fundo bem claro a partir da cor da faculdade (#RRGGBB + transparência). */
export const suave = (cor: string) => `${cor}1A`;

export const estilosBase = StyleSheet.create({
  titulo: { fontSize: 26, fontWeight: '700', color: cores.texto },
  subtitulo: { fontSize: 15, color: cores.textoSuave, lineHeight: 21 },
  rotulo: { fontSize: 13, fontWeight: '600', color: cores.textoSuave, marginBottom: 6 },
  secao: { fontSize: 17, fontWeight: '700', color: cores.texto, marginBottom: 8 },
});
