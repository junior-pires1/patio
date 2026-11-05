import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { ErroApi } from '@/api/cliente';
import type { Modalidade, TipoVaga, Vaga } from '@/api/tipos';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Chip } from '@/componentes/Chip';
import { MensagemDeErro } from '@/componentes/Estados';
import { Tela } from '@/componentes/Tela';
import { useSessao } from '@/sessao';
import { espaco } from '@/tema';
import { criarEstilos, useBase } from '@/tema-provedor';
import { dataBrParaIso, mascaraData } from '@/utils/datas';
import { MODALIDADES, TIPOS_VAGA } from '@/utils/opcoes';

/** Publicar uma vaga ou oportunidade. */
export default function NovaVaga() {
  const s = useEstilos();
  const b = useBase();
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    tipo: 'ESTAGIO' as TipoVaga,
    modalidade: 'PRESENCIAL' as Modalidade,
    titulo: '',
    organizacao: '',
    descricao: '',
    local: '',
    link: '',
    prazo: '',
  });
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const muda = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const publicar = useMutation({
    mutationFn: () => {
      const prazo = form.prazo ? dataBrParaIso(form.prazo) : null;
      if (form.prazo && !prazo)
        throw new ErroApi(400, 'data', 'Confira o prazo', { prazo: 'Use DD/MM/AAAA' });
      return api.post<Vaga>('/vagas', {
        tipo: form.tipo,
        modalidade: form.modalidade,
        titulo: form.titulo.trim(),
        organizacao: form.organizacao.trim() || null,
        descricao: form.descricao.trim(),
        local: form.local.trim() || null,
        link: form.link.trim() || null,
        prazo,
      });
    },
    onMutate: () => {
      setErro(null);
      setCampos({});
    },
    onSuccess: (v) => {
      void queryClient.invalidateQueries({ queryKey: ['vagas'] });
      router.replace({ pathname: '/vagas/[id]', params: { id: v.id } });
    },
    onError: (e) => {
      setErro(e.message);
      if (e instanceof ErroApi) setCampos(e.campos);
    },
  });

  return (
    <Tela rolagem semTopo>
      <Text style={b.rotulo}>Tipo</Text>
      <View style={s.chips}>
        {TIPOS_VAGA.map((t) => (
          <Chip
            key={t.valor}
            texto={t.rotulo}
            ativo={form.tipo === t.valor}
            aoTocar={() => muda('tipo', t.valor)}
          />
        ))}
      </View>
      <Campo
        rotulo="Título"
        placeholder="Ex.: Monitoria de Cálculo I"
        value={form.titulo}
        onChangeText={(v) => muda('titulo', v)}
        erro={campos.titulo}
        maxLength={100}
      />
      <Campo
        rotulo="Empresa, laboratório ou professor (opcional)"
        value={form.organizacao}
        onChangeText={(v) => muda('organizacao', v)}
        maxLength={100}
      />
      <Campo
        rotulo="Descrição"
        placeholder="O que a pessoa vai fazer, requisitos, carga horária, bolsa..."
        multiline
        maxLength={1500}
        style={s.multilinha}
        value={form.descricao}
        onChangeText={(v) => muda('descricao', v)}
        erro={campos.descricao}
      />
      <Text style={b.rotulo}>Modalidade</Text>
      <View style={s.chips}>
        {MODALIDADES.map((m) => (
          <Chip
            key={m.valor}
            texto={m.rotulo}
            ativo={form.modalidade === m.valor}
            aoTocar={() => muda('modalidade', m.valor)}
          />
        ))}
      </View>
      <View style={s.linha}>
        <View style={s.flex}>
          <Campo
            rotulo="Local (opcional)"
            placeholder="Ex.: Bloco C"
            value={form.local}
            onChangeText={(v) => muda('local', v)}
            maxLength={100}
          />
        </View>
        <View style={s.flex}>
          <Campo
            rotulo="Prazo (opcional)"
            placeholder="DD/MM/AAAA"
            keyboardType="number-pad"
            value={form.prazo}
            onChangeText={(v) => muda('prazo', mascaraData(v))}
            erro={campos.prazo}
          />
        </View>
      </View>
      <Campo
        rotulo="Link para mais informações (opcional)"
        placeholder="https://"
        autoCapitalize="none"
        keyboardType="url"
        value={form.link}
        onChangeText={(v) => muda('link', v)}
        erro={campos.link}
      />
      <MensagemDeErro texto={erro} />
      <Botao
        titulo="Publicar vaga"
        icone="briefcase"
        aoTocar={() => publicar.mutate()}
        carregando={publicar.isPending}
        desabilitado={form.titulo.trim().length < 3 || form.descricao.trim().length < 10}
      />
    </Tela>
  );
}

const useEstilos = criarEstilos(() => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  linha: { flexDirection: 'row', gap: espaco.m },
  flex: { flex: 1 },
  multilinha: { minHeight: 130, paddingTop: 12, textAlignVertical: 'top' },
}));
