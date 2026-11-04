import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { useTema } from '@/tema-provedor';
import logoClara from '../../assets/marca/logo-clara.png';
import logoEscura from '../../assets/marca/logo-escura.png';

// Letreiro em tinta para fundos claros; em branco para fundos escuros.
const LOGOS = { claro: logoEscura, escuro: logoClara };

/** Logo do Pátio (pato de capelo) na versão certa para o tema. */
export function Marca({
  altura = 56,
  estilo,
}: {
  altura?: number;
  estilo?: StyleProp<ImageStyle>;
}) {
  const { esquema } = useTema();
  return (
    <Image
      source={LOGOS[esquema]}
      style={[{ height: altura, width: altura * (176 / 82) }, estilo]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Pátio"
    />
  );
}
