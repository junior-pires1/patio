import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

type Opcoes = {
  /** Recorta quadrada (foto de perfil). */
  quadrada?: boolean;
  /** Largura máxima em pixels. */
  largura?: number;
};

/**
 * Escolhe uma imagem da galeria e reduz em JPG (fica com poucas centenas de
 * KB, abaixo do limite de 1 MB da API). Devolve null se a pessoa cancelar.
 */
export async function escolherImagem({
  quadrada = false,
  largura = 1280,
}: Opcoes = {}): Promise<{ blob: Blob; uri: string } | null> {
  const escolha = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: quadrada,
    ...(quadrada ? { aspect: [1, 1] as [number, number] } : {}),
    quality: 1,
  });
  const original = escolha.canceled ? undefined : escolha.assets[0];
  if (!original) return null;

  const contexto = ImageManipulator.manipulate(original.uri);
  if (!original.width || original.width > largura) contexto.resize({ width: largura });
  const imagem = await contexto.renderAsync();
  const reduzida = await imagem.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  const resposta = await fetch(reduzida.uri);
  // `uri` serve para mostrar a prévia antes de enviar.
  return { blob: await resposta.blob(), uri: reduzida.uri };
}

/** Foto de perfil: quadrada, 512 px. */
export async function escolherFoto(): Promise<Blob | null> {
  const escolhida = await escolherImagem({ quadrada: true, largura: 512 });
  return escolhida?.blob ?? null;
}
