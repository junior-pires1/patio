import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Escolhe uma foto da galeria, recorta quadrada e reduz para 512 px em JPG
 * (fica com poucos KB, bem abaixo do limite de 1 MB da API).
 * Devolve null se a pessoa cancelar.
 */
export async function escolherFoto(): Promise<Blob | null> {
  const escolha = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  const original = escolha.canceled ? undefined : escolha.assets[0];
  if (!original) return null;

  const contexto = ImageManipulator.manipulate(original.uri).resize({ width: 512 });
  const imagem = await contexto.renderAsync();
  const reduzida = await imagem.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  const resposta = await fetch(reduzida.uri);
  return resposta.blob();
}
