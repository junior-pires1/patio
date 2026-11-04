import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { elevacao, espaco, raio, tipo } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { Marca } from './Marca';
import { AlternarTema } from './SeletorDeTema';
import { Tela } from './Tela';

type Props = {
  titulo: string;
  subtitulo?: string;
  /** Texto pequeno acima do título (ex.: "Passo 2 de 2"). */
  etapa?: string;
  children: ReactNode;
  rodape?: ReactNode;
};

/** Moldura das telas de quem não entrou: logo, título e o formulário num cartão. */
export function TelaPublica({ titulo, subtitulo, etapa, children, rodape }: Props) {
  const s = useEstilos();
  const { esquema, c } = useTema();
  return (
    <Tela rolagem>
      <View style={s.coluna}>
        <View style={s.barra}>
          <Marca altura={46} />
          <AlternarTema />
        </View>
        <View style={s.cabeca}>
          {etapa ? <Text style={s.etapa}>{etapa}</Text> : null}
          <Text style={s.titulo}>{titulo}</Text>
          {subtitulo ? <Text style={s.subtitulo}>{subtitulo}</Text> : null}
        </View>
        <View style={[s.cartao, esquema === 'claro' ? elevacao(c, 2) : null]}>
          {children}
        </View>
        {rodape ? <View style={s.rodape}>{rodape}</View> : null}
      </View>
    </Tela>
  );
}

const useEstilos = criarEstilos((c) => ({
  coluna: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: espaco.gg,
    paddingBottom: espaco.gg,
  },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: espaco.p,
  },
  cabeca: { gap: espaco.p, marginTop: espaco.p },
  etapa: { ...tipo.sobrescrito, color: c.marca },
  titulo: { ...tipo.display, color: c.texto },
  subtitulo: { ...tipo.corpo, color: c.textoSuave },
  cartao: {
    backgroundColor: c.superficie,
    borderRadius: raio.gg,
    borderWidth: 1,
    borderColor: c.borda,
    padding: espaco.gg - 4,
    gap: espaco.g,
  },
  rodape: { gap: espaco.m, alignItems: 'center' },
}));
