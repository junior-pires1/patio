import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { Termo } from '@/api/tipos';
import { espaco, fonte, raio, tipo } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';
import { Botao } from './Botao';
import { Carregando } from './Estados';

/**
 * Caixa de aceite obrigatória do termo (LGPD): "Li e aceito…" com um link que
 * abre o texto completo. Quem lê até o fim pode aceitar direto pelo leitor.
 */
export function AceiteDoTermo({
  termo,
  aceito,
  aoMudar,
  erro,
}: {
  termo: Termo | undefined;
  aceito: boolean;
  aoMudar: (aceito: boolean) => void;
  erro?: string;
}) {
  const s = useEstilos();
  const { c } = useTema();
  const [lendo, setLendo] = useState(false);
  const faculdade = termo?.faculdade.nome ?? 'sua faculdade';
  return (
    <View style={s.caixa}>
      <View style={s.linha}>
        <Pressable
          onPress={() => aoMudar(!aceito)}
          disabled={!termo}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: aceito, disabled: !termo }}
          aria-checked={aceito}
          accessibilityLabel={`Li e aceito o Termo de Uso e Privacidade (LGPD) da ${faculdade}`}
          hitSlop={8}
          style={[
            s.quadrado,
            aceito && { backgroundColor: c.marca, borderColor: c.marca },
            erro && !aceito && { borderColor: c.erro },
          ]}
        >
          {aceito ? <Ionicons name="checkmark" size={16} color={c.sobreMarca} /> : null}
        </Pressable>
        <Text style={s.texto}>
          <Text onPress={() => termo && aoMudar(!aceito)}>Li e aceito o </Text>
          <Text
            style={s.link}
            onPress={() => setLendo(true)}
            accessibilityRole="link"
            suppressHighlighting
          >
            Termo de Uso e Privacidade (LGPD)
          </Text>
          <Text onPress={() => termo && aoMudar(!aceito)}> da {faculdade}.</Text>
        </Text>
      </View>
      {erro ? <Text style={s.erro}>{erro}</Text> : null}
      <LeitorDoTermo
        termo={termo}
        visivel={lendo}
        aoFechar={() => setLendo(false)}
        aoAceitar={() => {
          aoMudar(true);
          setLendo(false);
        }}
      />
    </View>
  );
}

/** Texto completo do termo numa folha que sobe da parte de baixo. */
export function LeitorDoTermo({
  termo,
  visivel,
  aoFechar,
  aoAceitar,
}: {
  termo: Termo | undefined;
  visivel: boolean;
  aoFechar: () => void;
  aoAceitar?: () => void;
}) {
  const s = useEstilos();
  const { c } = useTema();
  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={aoFechar}>
      <View style={s.fundo}>
        <View style={s.folha}>
          <View style={s.topo}>
            <Text style={s.titulo}>Termo de Uso e Privacidade</Text>
            <Pressable
              onPress={aoFechar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Fechar termo"
            >
              <Ionicons name="close" size={24} color={c.texto} />
            </Pressable>
          </View>
          {termo ? (
            <>
              <Text style={s.versao}>
                {termo.faculdade.nome} · versão {termo.versao}
                {termo.publicadoEm
                  ? ` · ${new Date(termo.publicadoEm).toLocaleDateString('pt-BR')}`
                  : ''}
              </Text>
              <ScrollView style={s.rolagem} contentContainerStyle={s.conteudo}>
                <Text style={s.corpo} selectable>
                  {termo.texto}
                </Text>
              </ScrollView>
              {aoAceitar ? (
                <Botao titulo="Li e aceito" icone="checkmark-circle" aoTocar={aoAceitar} />
              ) : (
                <Botao titulo="Fechar" variante="contorno" aoTocar={aoFechar} />
              )}
            </>
          ) : (
            <Carregando />
          )}
        </View>
      </View>
    </Modal>
  );
}

const useEstilos = criarEstilos((c) => ({
  caixa: { gap: 6 },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco.m },
  quadrado: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: c.textoSuave,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  texto: { flex: 1, ...tipo.corpo, fontSize: 14, lineHeight: 21, color: c.texto },
  link: { color: c.marca, fontFamily: fonte.semi, textDecorationLine: 'underline' },
  erro: { ...tipo.apoio, color: c.erro, marginLeft: 36 },
  fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(6,8,20,0.55)' },
  folha: {
    backgroundColor: c.superficie,
    borderTopLeftRadius: raio.gg,
    borderTopRightRadius: raio.gg,
    padding: espaco.g,
    paddingBottom: espaco.gg,
    gap: espaco.m,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { ...tipo.secao, color: c.texto },
  versao: { ...tipo.apoio, color: c.textoSuave },
  rolagem: { flexGrow: 0, flexShrink: 1 },
  conteudo: { paddingBottom: espaco.m },
  corpo: { ...tipo.corpo, fontSize: 14, lineHeight: 22, color: c.texto },
}));
