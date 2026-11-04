import { Image, Text, View } from 'react-native';
import { fonte } from '@/tema';
import { useTema } from '@/tema-provedor';
import { enderecoDaFoto } from '@/utils/endereco';

// Fundos das iniciais: tons da marca, escolhidos pelo nome (sempre o mesmo para a pessoa).
const TONS = {
  claro: [
    ['#E7EBFC', '#2A44C4'],
    ['#FFF1C7', '#8A6400'],
    ['#E2F5EC', '#0F7A50'],
    ['#FCE7F0', '#B4316B'],
    ['#EAE6FD', '#5B3CC4'],
    ['#E0F2FA', '#1F6E96'],
  ],
  escuro: [
    ['#1C244D', '#9FB2FF'],
    ['#3A3112', '#FFD54A'],
    ['#11301F', '#5FE0A4'],
    ['#3B1A2A', '#FF8DBA'],
    ['#251D4D', '#B5A2FF'],
    ['#0F2C3B', '#7CCBEF'],
  ],
} as const;

const tomDe = (nome: string) =>
  [...nome].reduce((soma, letra) => soma + letra.charCodeAt(0), 0) % TONS.claro.length;

/** Foto da pessoa ou, sem foto, a inicial do apelido num fundo colorido. */
export function Avatar({
  nome,
  fotoUrl,
  tamanho = 48,
}: {
  nome: string;
  fotoUrl?: string | null;
  tamanho?: number;
}) {
  const { esquema, c } = useTema();
  const dimensao = { width: tamanho, height: tamanho, borderRadius: tamanho / 2 };
  const endereco = enderecoDaFoto(fotoUrl);
  if (endereco) {
    return (
      <Image
        source={{ uri: endereco }}
        style={[dimensao, { backgroundColor: c.superficieAlta }]}
        accessibilityIgnoresInvertColors
      />
    );
  }
  const [fundo, frente] = TONS[esquema][tomDe(nome)] ?? TONS[esquema][0];
  return (
    <View
      style={[
        dimensao,
        { backgroundColor: fundo, alignItems: 'center', justifyContent: 'center' },
      ]}
    >
      <Text style={{ color: frente, fontSize: tamanho * 0.4, fontFamily: fonte.extra }}>
        {nome.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}
