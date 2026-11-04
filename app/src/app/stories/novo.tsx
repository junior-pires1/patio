import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { MensagemDeErro } from '@/componentes/Estados';
import { Tela } from '@/componentes/Tela';
import { useSessao } from '@/sessao';
import { cores, espaco, estilosBase, raio } from '@/tema';
import { escolherImagem } from '@/utils/foto';
import { voltar } from '@/utils/navegacao';

/** Novo story: uma imagem com legenda opcional, visível por 24 horas para as conexões. */
export default function NovoStory() {
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const [imagem, setImagem] = useState<{ blob: Blob; uri: string } | null>(null);
  const [legenda, setLegenda] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function escolher() {
    try {
      const escolhida = await escolherImagem({ largura: 1080 });
      if (escolhida) setImagem(escolhida);
    } catch {
      setErro('Não foi possível abrir a imagem.');
    }
  }
  // Abre a galeria logo ao entrar.
  useEffect(() => {
    // A galeria responde depois; o estado muda só quando a pessoa escolhe.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void escolher();
  }, []);

  async function publicar() {
    if (!imagem) return;
    setErro(null);
    setEnviando(true);
    try {
      const enviada = await api.enviarImagem(imagem.blob);
      await api.post('/stories', {
        imagemId: enviada.id,
        legenda: legenda.trim() || undefined,
      });
      void queryClient.invalidateQueries({ queryKey: ['stories'] });
      voltar('/feed');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível publicar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela rolagem semTopo>
      <Text style={estilosBase.subtitulo}>
        Seu story fica 24 horas no ar e só as suas conexões veem.
      </Text>
      {imagem ? (
        <Pressable onPress={() => void escolher()} accessibilityLabel="Trocar a imagem">
          <Image source={{ uri: imagem.uri }} style={estilos.previa} resizeMode="cover" />
        </Pressable>
      ) : (
        <Pressable
          onPress={() => void escolher()}
          style={estilos.escolher}
          accessibilityRole="button"
        >
          <Ionicons name="image-outline" size={36} color={cores.textoSuave} />
          <Text style={estilosBase.subtitulo}>Escolher imagem</Text>
        </Pressable>
      )}
      <Campo
        rotulo="Legenda (opcional)"
        maxLength={200}
        value={legenda}
        onChangeText={setLegenda}
        ajuda={`${legenda.length}/200`}
      />
      <MensagemDeErro texto={erro} />
      <Botao
        titulo="Publicar story"
        aoTocar={publicar}
        carregando={enviando}
        desabilitado={!imagem}
      />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  previa: { width: '100%', aspectRatio: 9 / 16, borderRadius: raio.m, maxHeight: 480 },
  escolher: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.p,
    aspectRatio: 9 / 16,
    maxHeight: 480,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: cores.borda,
    borderRadius: raio.m,
  },
});
