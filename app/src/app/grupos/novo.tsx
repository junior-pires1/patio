import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ErroApi } from '@/api/cliente';
import type { Disciplina, Grupo } from '@/api/tipos';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Chip } from '@/componentes/Chip';
import { MensagemDeErro } from '@/componentes/Estados';
import { Tela } from '@/componentes/Tela';
import { useCorDaFaculdade, useSessao } from '@/sessao';
import { cores, estilosBase } from '@/tema';

/** RF22: criar grupo de estudo. */
export default function NovoGrupo() {
  const { api } = useSessao();
  const cor = useCorDaFaculdade();
  const queryClient = useQueryClient();
  const disciplinas = useQuery({
    queryKey: ['disciplinas', null],
    queryFn: () => api.get<Disciplina[]>('/disciplinas'),
  });
  const [form, setForm] = useState({ nome: '', descricao: '', encontro: '', local: '' });
  const [disciplinaId, setDisciplinaId] = useState<string | null>(null);
  const [vagas, setVagas] = useState(8);
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const muda = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function criar() {
    setErro(null);
    setCampos({});
    setEnviando(true);
    try {
      const g = await api.post<Grupo>('/grupos', {
        ...form,
        vagas,
        ...(disciplinaId ? { disciplinaId } : {}),
      });
      void queryClient.invalidateQueries({ queryKey: ['grupos'] });
      router.replace({ pathname: '/grupo/[id]', params: { id: g.id } });
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setCampos(e.campos);
      } else setErro('Não foi possível criar o grupo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela rolagem semTopo>
      <Campo
        rotulo="Nome do grupo"
        placeholder="Ex.: Cálculo de terça"
        maxLength={80}
        value={form.nome}
        onChangeText={muda('nome')}
        erro={campos.nome}
      />
      <Text style={estilosBase.rotulo}>Disciplina (opcional)</Text>
      <View style={estilos.chips}>
        {disciplinas.data?.map((d) => (
          <Chip
            key={d.id}
            texto={d.nome}
            ativo={disciplinaId === d.id}
            aoTocar={() => setDisciplinaId(disciplinaId === d.id ? null : d.id)}
          />
        ))}
      </View>
      <Campo
        rotulo="Objetivo"
        multiline
        maxLength={300}
        style={estilos.multilinha}
        value={form.descricao}
        onChangeText={muda('descricao')}
      />
      <Campo
        rotulo="Quando"
        placeholder="Ex.: Terças, 19h"
        maxLength={80}
        value={form.encontro}
        onChangeText={muda('encontro')}
      />
      <Campo
        rotulo="Onde"
        placeholder="Ex.: Biblioteca, sala 3"
        maxLength={80}
        value={form.local}
        onChangeText={muda('local')}
      />
      <Text style={estilosBase.rotulo}>Vagas (de 3 a 20)</Text>
      <View style={estilos.vagas}>
        <Pressable
          onPress={() => setVagas((v) => Math.max(3, v - 1))}
          style={[estilos.passo, { borderColor: cor }]}
          accessibilityLabel="Menos vagas"
        >
          <Text style={[estilos.passoTexto, { color: cor }]}>−</Text>
        </Pressable>
        <Text style={estilos.numero}>{vagas}</Text>
        <Pressable
          onPress={() => setVagas((v) => Math.min(20, v + 1))}
          style={[estilos.passo, { borderColor: cor }]}
          accessibilityLabel="Mais vagas"
        >
          <Text style={[estilos.passoTexto, { color: cor }]}>+</Text>
        </Pressable>
      </View>
      <MensagemDeErro texto={erro} />
      <Botao
        titulo="Criar grupo"
        aoTocar={criar}
        carregando={enviando}
        desabilitado={form.nome.trim().length < 3}
      />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  multilinha: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },
  vagas: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  passo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passoTexto: { fontSize: 22, fontWeight: '700' },
  numero: {
    fontSize: 22,
    fontWeight: '700',
    color: cores.texto,
    minWidth: 30,
    textAlign: 'center',
  },
});
