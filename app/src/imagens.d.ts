// Imagens importadas pelo Metro (viram um id de recurso no app e um endereço na web).
declare module '*.png' {
  const imagem: import('react-native').ImageSourcePropType;
  export default imagem;
}
