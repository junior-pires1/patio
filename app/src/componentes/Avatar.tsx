import { Image, StyleSheet, Text, View } from 'react-native';
import { useCorDaFaculdade } from '@/sessao';
import { suave } from '@/tema';

/** Foto da pessoa ou, sem foto, a inicial do apelido na cor da faculdade. */
export function Avatar({
  nome,
  fotoUrl,
  tamanho = 48,
}: {
  nome: string;
  fotoUrl?: string | null;
  tamanho?: number;
}) {
  const cor = useCorDaFaculdade();
  const dimensao = { width: tamanho, height: tamanho, borderRadius: tamanho / 2 };
  if (fotoUrl)
    return (
      <Image source={{ uri: fotoUrl }} style={dimensao} accessibilityIgnoresInvertColors />
    );
  return (
    <View style={[estilos.circulo, dimensao, { backgroundColor: suave(cor) }]}>
      <Text style={[estilos.inicial, { color: cor, fontSize: tamanho * 0.42 }]}>
        {nome.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  circulo: { alignItems: 'center', justifyContent: 'center' },
  inicial: { fontWeight: '700' },
});
