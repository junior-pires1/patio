import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, Text, View } from 'react-native';
import { ErroApi } from '@/api/cliente';
import type { CategoriaPost } from '@/api/tipos';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { SugestoesDeMencao } from '@/componentes/SugestoesDeMencao';
import { Chip } from '@/componentes/Chip';
import { MensagemDeErro } from '@/componentes/Estados';
import { Tela } from '@/componentes/Tela';
import { useSessao } from '@/sessao';
import { espaco, fonte, raio } from '@/tema';
import { criarEstilos, useBase, useTema } from '@/tema-provedor';
import { dataHoraBrParaIso, mascaraData, mascaraHora } from '@/utils/datas';
import { escolherImagem } from '@/utils/foto';
import { CATEGORIAS } from '@/utils/opcoes';
import { useMencoes } from '@/utils/mencoes';
import { voltar } from '@/utils/navegacao';

/** RF18: nova publicação. Evento pede data, hora e local. */
export default function Publicar() {
  const estilos = useEstilos();
  const { c } = useTema();
  const b = useBase();
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const [cat, setCat] = useState<CategoriaPost>('GERAL');
  const { texto, setTexto, mencoes, sugestoes, escolher: escolherMencao } = useMencoes();
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [local, setLocal] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [imagem, setImagem] = useState<{ blob: Blob; previa: string } | null>(null);
  const evento = cat === 'EVENTO';

  async function escolher() {
    try {
      const escolhida = await escolherImagem();
      if (escolhida) setImagem({ blob: escolhida.blob, previa: escolhida.uri });
    } catch {
      setErro('Não foi possível abrir a imagem.');
    }
  }

  async function enviar() {
    setErro(null);
    setCampos({});
    const inicio = evento ? dataHoraBrParaIso(data, hora) : null;
    if (evento && !inicio) {
      setCampos({ eventoInicio: 'Informe data (DD/MM/AAAA) e hora (HH:MM)' });
      return;
    }
    setEnviando(true);
    try {
      const enviada = imagem ? await api.enviarImagem(imagem.blob) : null;
      await api.post('/posts', {
        categoria: cat,
        texto: texto.trim(),
        mencoes,
        ...(enviada ? { imagemId: enviada.id } : {}),
        ...(evento ? { eventoInicio: inicio, eventoLocal: local.trim() || undefined } : {}),
      });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      voltar('/feed');
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setCampos(e.campos);
      } else setErro('Não foi possível publicar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela rolagem semTopo>
      <Text style={b.rotulo}>Categoria</Text>
      <View style={estilos.chips}>
        {CATEGORIAS.map((c) => (
          <Chip
            key={c.valor}
            texto={c.rotulo}
            ativo={cat === c.valor}
            aoTocar={() => setCat(c.valor)}
          />
        ))}
      </View>
      <Campo
        rotulo="O que você quer contar?"
        multiline
        maxLength={500}
        style={estilos.multilinha}
        value={texto}
        onChangeText={setTexto}
        erro={campos.texto}
        ajuda={`${texto.length}/500 · use @ para marcar colegas e # para hashtags`}
      />
      <SugestoesDeMencao sugestoes={sugestoes} aoEscolher={escolherMencao} />
      {imagem ? (
        <View>
          <Image
            source={{ uri: imagem.previa }}
            style={estilos.previa}
            resizeMode="cover"
          />
          <Pressable
            onPress={() => setImagem(null)}
            style={estilos.tirar}
            accessibilityRole="button"
            accessibilityLabel="Tirar a imagem"
          >
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => void escolher()}
          style={estilos.adicionar}
          accessibilityRole="button"
        >
          <Ionicons name="image-outline" size={22} color={c.textoSuave} />
          <Text style={estilos.adicionarTexto}>Adicionar imagem</Text>
        </Pressable>
      )}
      {evento ? (
        <>
          <View style={estilos.linha}>
            <View style={estilos.flex}>
              <Campo
                rotulo="Data"
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                value={data}
                onChangeText={(v) => setData(mascaraData(v))}
              />
            </View>
            <View style={estilos.flex}>
              <Campo
                rotulo="Hora"
                placeholder="HH:MM"
                keyboardType="number-pad"
                value={hora}
                onChangeText={(v) => setHora(mascaraHora(v))}
              />
            </View>
          </View>
          <MensagemDeErro texto={campos.eventoInicio} />
          <Campo
            rotulo="Local"
            placeholder="Ex.: Auditório 2"
            maxLength={120}
            value={local}
            onChangeText={setLocal}
          />
        </>
      ) : null}
      <MensagemDeErro texto={erro} />
      <Botao
        titulo="Publicar"
        aoTocar={enviar}
        carregando={enviando}
        desabilitado={!texto.trim() && !imagem}
      />
    </Tela>
  );
}

const useEstilos = criarEstilos((c) => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  multilinha: { minHeight: 120, paddingTop: 12, textAlignVertical: 'top' },
  linha: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  previa: { width: '100%', aspectRatio: 4 / 3, borderRadius: raio.m },
  tirar: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    padding: 4,
  },
  adicionar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.p,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.borda,
    borderRadius: raio.m,
    padding: espaco.m,
  },
  adicionarTexto: { color: c.textoSuave, fontFamily: fonte.regular, fontSize: 15 },
}));
