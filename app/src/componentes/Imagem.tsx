import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ImageStyle,
} from 'react-native';
import { enderecoDaFoto } from '@/utils/endereco';

/**
 * Imagem de publicação ou mensagem. Tocar abre em tela cheia.
 * `url` é o endereço da API ("/imagens/<id>") ou um endereço local (prévia antes de enviar).
 */
export function Imagem({ url, style }: { url: string; style?: StyleProp<ImageStyle> }) {
  const [aberta, setAberta] = useState(false);
  const endereco = enderecoDaFoto(url) ?? url;
  return (
    <>
      <Pressable
        onPress={() => setAberta(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel="Abrir imagem"
      >
        <Image
          source={{ uri: endereco }}
          style={style}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      </Pressable>
      <Modal
        visible={aberta}
        transparent
        animationType="fade"
        onRequestClose={() => setAberta(false)}
      >
        <View style={estilos.fundo}>
          <Image
            source={{ uri: endereco }}
            style={estilos.cheia}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Pressable
            onPress={() => setAberta(false)}
            style={estilos.fechar}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Fechar imagem"
          >
            <Ionicons name="close" size={30} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const estilos = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cheia: { width: '100%', height: '85%' },
  fechar: { position: 'absolute', top: 40, right: 20 },
});
