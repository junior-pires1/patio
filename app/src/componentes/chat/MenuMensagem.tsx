import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, Text, View } from 'react-native';
import type { Mensagem, Reacao } from '@/api/tipos';
import { espaco, fonte, raio } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { REACOES } from './reacoes';

/** Menu ao segurar uma mensagem: reagir, responder e apagar (só as suas). */
export function MenuMensagem({
  mensagem,
  minha,
  minhaReacao,
  aoFechar,
  aoReagir,
  aoResponder,
  aoApagar,
}: {
  mensagem: Mensagem | null;
  minha: boolean;
  minhaReacao: Reacao | null;
  aoFechar: () => void;
  aoReagir: (r: Reacao | null) => void;
  aoResponder: () => void;
  aoApagar: () => void;
}) {
  const s = useEstilos();
  const { c } = useTema();
  return (
    <Modal
      visible={mensagem !== null}
      transparent
      animationType="fade"
      onRequestClose={aoFechar}
    >
      <Pressable style={s.veu} onPress={aoFechar} accessibilityLabel="Fechar menu">
        <Pressable style={s.caixa} onPress={() => undefined}>
          <View style={s.reacoes} accessibilityRole="toolbar" accessibilityLabel="Reações">
            {REACOES.map((r) => {
              const ativa = minhaReacao === r.valor;
              return (
                <Pressable
                  key={r.valor}
                  onPress={() => aoReagir(ativa ? null : r.valor)}
                  style={({ pressed }) => [
                    s.reacao,
                    ativa && s.reacaoAtiva,
                    pressed && { transform: [{ scale: 1.15 }] },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    ativa ? `Tirar reação ${r.rotulo}` : `Reagir com ${r.rotulo}`
                  }
                >
                  <Ionicons name={r.icone} size={24} color={r.cor(c)} />
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={aoResponder}
            style={({ pressed }) => [s.opcao, pressed && s.pressionada]}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-undo-outline" size={20} color={c.texto} />
            <Text style={s.texto}>Responder</Text>
          </Pressable>
          {minha ? (
            <Pressable
              onPress={aoApagar}
              style={({ pressed }) => [s.opcao, pressed && s.pressionada]}
              accessibilityRole="button"
            >
              <Ionicons name="trash-outline" size={20} color={c.erro} />
              <Text style={[s.texto, { color: c.erro }]}>Apagar para todos</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useEstilos = criarEstilos((c) => ({
  veu: {
    flex: 1,
    backgroundColor: 'rgba(6,8,20,0.55)',
    justifyContent: 'center',
    padding: espaco.gg,
  },
  caixa: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    backgroundColor: c.superficie,
    borderRadius: raio.gg,
    padding: espaco.m,
    gap: 4,
  },
  reacoes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: c.superficieAlta,
    borderRadius: raio.total,
    padding: 6,
    marginBottom: espaco.p,
  },
  reacao: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reacaoAtiva: { backgroundColor: c.superficie },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.m,
    paddingVertical: 12,
    borderRadius: raio.m,
  },
  pressionada: { backgroundColor: c.superficieAlta },
  texto: { fontFamily: fonte.semi, fontSize: 15, color: c.texto },
}));
