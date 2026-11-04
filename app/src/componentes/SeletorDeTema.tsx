import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { fonte, raio } from '@/tema';
import { criarEstilos, useTema, type Preferencia } from '@/tema-provedor';
import type { NomeIcone } from './Info';

const OPCOES: { valor: Preferencia; rotulo: string; icone: NomeIcone }[] = [
  { valor: 'sistema', rotulo: 'Automático', icone: 'phone-portrait-outline' },
  { valor: 'claro', rotulo: 'Claro', icone: 'sunny-outline' },
  { valor: 'escuro', rotulo: 'Escuro', icone: 'moon-outline' },
];

/** Escolha do tema: segue o aparelho ou fica fixo no claro/escuro. */
export function SeletorDeTema() {
  const { c, preferencia, definirPreferencia } = useTema();
  const s = useEstilos();
  return (
    <View style={s.trilho} accessibilityRole="radiogroup" accessibilityLabel="Tema">
      {OPCOES.map((o) => {
        const ativo = preferencia === o.valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => definirPreferencia(o.valor)}
            accessibilityRole="radio"
            accessibilityState={{ checked: ativo }}
            accessibilityLabel={`Tema ${o.rotulo}`}
            style={[s.opcao, ativo && s.ativa]}
          >
            <Ionicons name={o.icone} size={16} color={ativo ? c.texto : c.textoSuave} />
            <Text style={[s.texto, ativo && s.textoAtivo]}>{o.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Botão redondo que alterna claro/escuro (telas de entrada). */
export function AlternarTema() {
  const { c, esquema, definirPreferencia } = useTema();
  const s = useEstilos();
  const proximo = esquema === 'escuro' ? 'claro' : 'escuro';
  return (
    <Pressable
      onPress={() => definirPreferencia(proximo)}
      style={({ pressed }) => [s.redondo, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={esquema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}
      hitSlop={8}
    >
      <Ionicons name={esquema === 'escuro' ? 'sunny' : 'moon'} size={18} color={c.texto} />
    </Pressable>
  );
}

const useEstilos = criarEstilos((c) => ({
  trilho: {
    flexDirection: 'row',
    backgroundColor: c.superficieAlta,
    borderRadius: raio.m,
    padding: 4,
    gap: 4,
  },
  opcao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: raio.p,
  },
  ativa: {
    backgroundColor: c.superficie,
    shadowColor: c.sombra,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  texto: { fontFamily: fonte.semi, fontSize: 13, color: c.textoSuave },
  textoAtivo: { color: c.texto },
  redondo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.superficie,
    borderWidth: 1,
    borderColor: c.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
