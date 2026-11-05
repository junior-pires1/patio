import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ErroApi } from '@/api/cliente';
import type { Experiencia, PerfilCompleto, TipoExperiencia } from '@/api/tipos';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Chip } from '@/componentes/Chip';
import { Carregando, MensagemDeErro } from '@/componentes/Estados';
import { Tela } from '@/componentes/Tela';
import { useSessao, useUsuario } from '@/sessao';
import { espaco, fonte, raio } from '@/tema';
import { criarEstilos, useBase, useTema } from '@/tema-provedor';
import { alerta } from '@/utils/alerta';
import { isoParaMesAno, mascaraMesAno, mesAno, mesAnoParaIso } from '@/utils/datas';
import { rotuloExperiencia, TIPOS_EXPERIENCIA } from '@/utils/opcoes';

const VAZIO = {
  tipo: 'PROJETO' as TipoExperiencia,
  titulo: '',
  organizacao: '',
  inicio: '',
  fim: '',
  descricao: '',
  link: '',
};

/** Experiências do perfil (estilo LinkedIn): estágios, projetos, monitorias... */
export default function Experiencias() {
  const estilos = useEstilos();
  const { c } = useTema();
  const b = useBase();
  const { api } = useSessao();
  const eu = useUsuario();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(VAZIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);

  const perfil = useQuery({
    queryKey: ['perfil', eu.id],
    queryFn: () => api.get<PerfilCompleto>(`/usuarios/${eu.id}/perfil`),
  });
  const atualizar = () =>
    void queryClient.invalidateQueries({ queryKey: ['perfil', eu.id] });
  const muda = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const salvar = useMutation({
    mutationFn: async () => {
      const inicio = mesAnoParaIso(form.inicio);
      const fim = form.fim && form.tipo !== 'CERTIFICADO' ? mesAnoParaIso(form.fim) : null;
      if (!inicio)
        throw new ErroApi(400, 'data', 'Confira as datas', { inicio: 'Use MM/AAAA' });
      if (form.fim && !fim)
        throw new ErroApi(400, 'data', 'Confira as datas', { fim: 'Use MM/AAAA' });
      const corpo = {
        tipo: form.tipo,
        titulo: form.titulo.trim(),
        organizacao: form.organizacao.trim() || null,
        inicio,
        fim,
        descricao: form.descricao.trim() || null,
        link: form.link.trim() || null,
      };
      return editando
        ? api.put<Experiencia>(`/eu/experiencias/${editando}`, corpo)
        : api.post<Experiencia>('/eu/experiencias', corpo);
    },
    onMutate: () => {
      setErro(null);
      setCampos({});
    },
    onSuccess: () => {
      setForm(VAZIO);
      setEditando(null);
      atualizar();
    },
    onError: (e) => {
      setErro(e.message);
      if (e instanceof ErroApi) setCampos(e.campos);
    },
  });
  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/eu/experiencias/${id}`),
    onSuccess: atualizar,
  });

  function editar(e: Experiencia) {
    setEditando(e.id);
    setForm({
      tipo: e.tipo,
      titulo: e.titulo,
      organizacao: e.organizacao ?? '',
      inicio: isoParaMesAno(e.inicio),
      fim: e.fim ? isoParaMesAno(e.fim) : '',
      descricao: e.descricao ?? '',
      link: e.link ?? '',
    });
  }

  if (perfil.isPending) return <Carregando />;
  const certificado = form.tipo === 'CERTIFICADO';

  return (
    <Tela rolagem semTopo>
      {perfil.data?.experiencias.map((e) => (
        <View key={e.id} style={estilos.item}>
          <View style={estilos.flex}>
            <Text style={estilos.titulo}>{e.titulo}</Text>
            <Text style={estilos.meta}>
              {[rotuloExperiencia(e.tipo), e.organizacao].filter(Boolean).join(' · ')}
            </Text>
            <Text style={estilos.meta}>
              {e.tipo === 'CERTIFICADO'
                ? `Emitido em ${mesAno(e.inicio)}`
                : `${mesAno(e.inicio)} – ${e.fim ? mesAno(e.fim) : 'atual'}`}
            </Text>
            {e.link ? (
              <Text style={estilos.link} numberOfLines={1}>
                {e.link.replace(/^https?:\/\//, '')}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={() => editar(e)} hitSlop={8} accessibilityLabel="Editar">
            <Ionicons name="create-outline" size={20} color={c.textoSuave} />
          </Pressable>
          <Pressable
            onPress={() =>
              alerta('Apagar experiência?', e.titulo, [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Apagar',
                  style: 'destructive',
                  onPress: () => remover.mutate(e.id),
                },
              ])
            }
            hitSlop={8}
            accessibilityLabel="Apagar"
          >
            <Ionicons name="trash-outline" size={20} color={c.textoSuave} />
          </Pressable>
        </View>
      ))}

      <Text style={b.secao}>{editando ? 'Editar experiência' : 'Nova experiência'}</Text>
      <View style={estilos.chips}>
        {TIPOS_EXPERIENCIA.map((t) => (
          <Chip
            key={t.valor}
            texto={t.rotulo}
            ativo={form.tipo === t.valor}
            aoTocar={() => muda('tipo', t.valor)}
          />
        ))}
      </View>
      <Campo
        rotulo={certificado ? 'Nome do certificado' : 'Título'}
        placeholder={
          certificado ? 'Ex.: Git e GitHub' : 'Ex.: Estágio em desenvolvimento web'
        }
        value={form.titulo}
        onChangeText={(v) => muda('titulo', v)}
        erro={campos.titulo}
      />
      <Campo
        rotulo={
          certificado
            ? 'Quem emitiu (opcional)'
            : 'Empresa, laboratório ou organização (opcional)'
        }
        value={form.organizacao}
        onChangeText={(v) => muda('organizacao', v)}
      />
      <View style={estilos.linha}>
        <View style={estilos.flex}>
          <Campo
            rotulo={certificado ? 'Emitido em' : 'Início'}
            placeholder="MM/AAAA"
            keyboardType="number-pad"
            value={form.inicio}
            onChangeText={(v) => muda('inicio', mascaraMesAno(v))}
            erro={campos.inicio}
          />
        </View>
        {certificado ? null : (
          <View style={estilos.flex}>
            <Campo
              rotulo="Fim (vazio = atual)"
              placeholder="MM/AAAA"
              keyboardType="number-pad"
              value={form.fim}
              onChangeText={(v) => muda('fim', mascaraMesAno(v))}
              erro={campos.fim}
            />
          </View>
        )}
      </View>
      <Campo
        rotulo={certificado ? 'Link de validação (opcional)' : 'Link (opcional)'}
        placeholder="https://"
        autoCapitalize="none"
        keyboardType="url"
        value={form.link}
        onChangeText={(v) => muda('link', v)}
        erro={campos.link}
      />
      <Campo
        rotulo="O que você fez (opcional)"
        multiline
        maxLength={500}
        style={estilos.multilinha}
        value={form.descricao}
        onChangeText={(v) => muda('descricao', v)}
      />
      <MensagemDeErro texto={erro} />
      <Botao
        titulo={editando ? 'Salvar alterações' : 'Adicionar experiência'}
        aoTocar={() => salvar.mutate()}
        carregando={salvar.isPending}
        desabilitado={!form.titulo.trim() || !form.inicio}
      />
      {editando ? (
        <Botao
          titulo="Cancelar edição"
          variante="contorno"
          aoTocar={() => {
            setEditando(null);
            setForm(VAZIO);
          }}
        />
      ) : null}
    </Tela>
  );
}

const useEstilos = criarEstilos((c) => ({
  flex: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    backgroundColor: c.superficie,
    borderRadius: raio.m,
    borderWidth: 1,
    borderColor: c.borda,
    padding: espaco.m,
  },
  titulo: { fontSize: 15, fontFamily: fonte.negrito, color: c.texto },
  meta: { fontFamily: fonte.regular, fontSize: 13, color: c.textoSuave },
  link: { fontFamily: fonte.semi, fontSize: 13, color: c.marca },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  linha: { flexDirection: 'row', gap: espaco.m },
  multilinha: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
}));
