import { Pressable, Text } from 'react-native';
import { fonte, raio } from '@/tema';
import { criarEstilos } from '@/tema-provedor';

type Props = {
  texto: string;
  ativo?: boolean;
  aoTocar?: () => void;
  tom?: 'neutro' | 'marca';
};

/** Etiqueta. Com `aoTocar`, vira uma opção que liga e desliga. */
export function Chip({ texto, ativo = false, aoTocar, tom = 'neutro' }: Props) {
  const s = useEstilos();
  return (
    <Pressable
      disabled={!aoTocar}
      onPress={aoTocar}
      accessibilityRole={aoTocar ? 'checkbox' : 'text'}
      accessibilityState={aoTocar ? { checked: ativo } : undefined}
      style={({ pressed }) => [
        s.chip,
        ativo ? s.ativo : tom === 'marca' ? s.marca : s.neutro,
        pressed && s.pressionado,
      ]}
    >
      <Text style={[s.texto, ativo ? s.textoAtivo : tom === 'marca' ? s.textoMarca : null]}>
        {texto}
      </Text>
    </Pressable>
  );
}

const useEstilos = criarEstilos((c) => ({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: raio.total,
    borderWidth: 1,
  },
  neutro: { backgroundColor: c.superficieAlta, borderColor: 'transparent' },
  marca: { backgroundColor: c.marcaSuave, borderColor: 'transparent' },
  ativo: { backgroundColor: c.texto, borderColor: c.texto },
  pressionado: { opacity: 0.8 },
  texto: { fontFamily: fonte.semi, fontSize: 13.5, color: c.texto },
  textoMarca: { color: c.marca },
  textoAtivo: { color: c.fundo },
}));
