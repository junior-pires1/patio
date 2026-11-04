import { Pressable, Text, View } from 'react-native';
import type { PessoaResumo } from '@/api/tipos';
import { espaco, fonte, raio } from '@/tema';
import { criarEstilos } from '@/tema-provedor';
import { Avatar } from './Avatar';

/** Lista de pessoas para completar um @ enquanto a pessoa digita. */
export function SugestoesDeMencao({
  sugestoes,
  aoEscolher,
}: {
  sugestoes: PessoaResumo[];
  aoEscolher: (p: PessoaResumo) => void;
}) {
  const s = useEstilos();
  if (sugestoes.length === 0) return null;
  return (
    <View style={s.caixa} accessibilityRole="menu">
      {sugestoes.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => aoEscolher(p)}
          style={({ pressed }) => [s.linha, pressed && s.pressionada]}
          accessibilityRole="menuitem"
          accessibilityLabel={`Marcar ${p.apelido}`}
        >
          <Avatar nome={p.apelido} fotoUrl={p.fotoUrl} tamanho={30} />
          <Text style={s.nome}>{p.apelido}</Text>
          {p.curso ? (
            <Text style={s.curso} numberOfLines={1}>
              {p.curso.nome}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const useEstilos = criarEstilos((c) => ({
  caixa: {
    backgroundColor: c.superficie,
    borderRadius: raio.m,
    borderWidth: 1,
    borderColor: c.borda,
    paddingVertical: 4,
    marginHorizontal: espaco.p,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.m,
    paddingVertical: 8,
  },
  pressionada: { backgroundColor: c.superficieAlta },
  nome: { fontFamily: fonte.negrito, fontSize: 14, color: c.texto },
  curso: { flex: 1, fontFamily: fonte.regular, fontSize: 12.5, color: c.textoSuave },
}));
