import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ErroApi } from '@/api/cliente';
import type { Curso, Disciplina, MeuPerfil, Relacao, Turno } from '@/api/tipos';
import { Avatar } from '@/componentes/Avatar';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Chip } from '@/componentes/Chip';
import { MensagemDeErro } from '@/componentes/Estados';
import { Tela } from '@/componentes/Tela';
import { useCorDaFaculdade, useSessao, useUsuario } from '@/sessao';
import { cores, espaco, estilosBase, raio, suave } from '@/tema';
import { DIAS, OBJETIVOS, PERIODOS, RELACOES, TURNOS } from '@/utils/opcoes';
import { alerta } from '@/utils/alerta';
import { escolherFoto } from '@/utils/foto';

const alternar = (lista: string[], item: string) =>
  lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item];
const separar = (texto: string) =>
  texto
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export default function Perfil() {
  const { api, sair, atualizarUsuario } = useSessao();
  const eu = useUsuario();
  const cor = useCorDaFaculdade();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    apelido: eu.apelido,
    cursoId: eu.curso?.id ?? null,
    semestre: eu.semestre ? String(eu.semestre) : '',
    turno: eu.turno,
    frase: eu.frase ?? '',
    sobre: eu.sobre ?? '',
    objetivos: eu.objetivos,
    interesses: eu.interesses.join(', '),
    habilidades: eu.habilidades.join(', '),
    horariosLivres: eu.horariosLivres,
    instagram: eu.contatos.instagram ?? '',
    whatsapp: eu.contatos.whatsapp ?? '',
  });
  const [minhas, setMinhas] = useState<{ disciplinaId: string; relacao: Relacao }[]>(
    eu.disciplinas.map((d) => ({ disciplinaId: d.disciplina.id, relacao: d.relacao })),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const cursos = useQuery({
    queryKey: ['cursos'],
    queryFn: () => api.get<Curso[]>('/cursos'),
  });
  const disciplinas = useQuery({
    queryKey: ['disciplinas', form.cursoId],
    queryFn: () =>
      api.get<Disciplina[]>(
        `/disciplinas${form.cursoId ? `?cursoId=${form.cursoId}` : ''}`,
      ),
  });

  const muda = <K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));
  const temRelacao = (disciplinaId: string, relacao: Relacao) =>
    minhas.some((m) => m.disciplinaId === disciplinaId && m.relacao === relacao);
  const alternarRelacao = (disciplinaId: string, relacao: Relacao) =>
    setMinhas((lista) =>
      temRelacao(disciplinaId, relacao)
        ? lista.filter((m) => !(m.disciplinaId === disciplinaId && m.relacao === relacao))
        : [...lista, { disciplinaId, relacao }],
    );

  async function salvar() {
    setErro(null);
    setCampos({});
    setSalvando(true);
    try {
      await api.patch<MeuPerfil>('/eu', {
        apelido: form.apelido.trim(),
        cursoId: form.cursoId,
        semestre: form.semestre ? Number(form.semestre) : null,
        turno: form.turno,
        frase: form.frase.trim() || null,
        sobre: form.sobre.trim() || null,
        objetivos: form.objetivos,
        interesses: separar(form.interesses),
        habilidades: separar(form.habilidades),
        horariosLivres: form.horariosLivres,
        contatos: {
          ...(form.instagram.trim() ? { instagram: form.instagram.trim() } : {}),
          ...(form.whatsapp.trim() ? { whatsapp: form.whatsapp.trim() } : {}),
        },
      });
      const atualizado = await api.put<MeuPerfil>('/eu/disciplinas', { itens: minhas });
      atualizarUsuario(atualizado);
      // As cartas dependem do perfil: busca de novo com os dados atualizados.
      void queryClient.invalidateQueries({ queryKey: ['descobrir'] });
      alerta('Perfil salvo', 'Suas cartas vão levar isso em conta.');
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setCampos(e.campos);
      } else {
        setErro('Não foi possível salvar.');
      }
    } finally {
      setSalvando(false);
    }
  }

  const [enviandoFoto, setEnviandoFoto] = useState(false);
  async function trocarFoto() {
    try {
      const foto = await escolherFoto();
      if (!foto) return;
      setEnviandoFoto(true);
      await api.enviarArquivo('/eu/foto', foto, 'image/jpeg');
      atualizarUsuario(await api.get<MeuPerfil>('/eu'));
    } catch (e) {
      alerta('Não foi possível trocar a foto', e instanceof Error ? e.message : undefined);
    } finally {
      setEnviandoFoto(false);
    }
  }
  async function removerFoto() {
    await api.delete('/eu/foto');
    atualizarUsuario(await api.get<MeuPerfil>('/eu'));
  }

  const [senhas, setSenhas] = useState({ atual: '', nova: '' });
  const [errosSenha, setErrosSenha] = useState<Record<string, string>>({});
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  async function trocarSenha() {
    setErrosSenha({});
    setTrocandoSenha(true);
    try {
      await api.trocarSenha(senhas.atual, senhas.nova);
      setSenhas({ atual: '', nova: '' });
      alerta('Senha trocada', 'Os outros aparelhos vão precisar entrar de novo.');
    } catch (e) {
      setErrosSenha(
        e instanceof ErroApi
          ? { ...e.campos, _: e.message }
          : { _: 'Não foi possível trocar.' },
      );
    } finally {
      setTrocandoSenha(false);
    }
  }

  function confirmarSaida() {
    alerta('Sair da conta?', 'Você vai precisar entrar de novo neste aparelho.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => void sair() },
    ]);
  }

  return (
    <Tela rolagem semTopo>
      <View style={[estilos.cartao, { backgroundColor: suave(cor) }]}>
        <Pressable
          onPress={trocarFoto}
          disabled={enviandoFoto}
          accessibilityRole="button"
          accessibilityLabel="Trocar foto de perfil"
        >
          <Avatar nome={form.apelido || eu.nome} fotoUrl={eu.fotoUrl} tamanho={72} />
          <Text style={[estilos.trocarFoto, { color: cor }]}>
            {enviandoFoto ? 'Enviando…' : eu.fotoUrl ? 'Trocar foto' : 'Pôr foto'}
          </Text>
        </Pressable>
        <View style={estilos.flex}>
          <Text style={estilosBase.secao}>{eu.nome}</Text>
          <Text style={estilosBase.subtitulo}>{eu.email}</Text>
          <Text style={[estilos.faculdade, { color: cor }]}>
            {eu.instituicao.sigla} · {eu.instituicao.nome}
          </Text>
          {eu.fotoUrl ? (
            <Text
              onPress={removerFoto}
              style={estilos.removerFoto}
              accessibilityRole="button"
            >
              Remover foto
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={estilosBase.secao}>Sobre você</Text>
      <Campo
        rotulo="Como quer ser chamado"
        value={form.apelido}
        onChangeText={(v) => muda('apelido', v)}
        erro={campos.apelido}
      />
      <Campo
        rotulo="Frase da carta"
        placeholder="Ex.: Topo grupo de Cálculo toda terça!"
        maxLength={140}
        value={form.frase}
        onChangeText={(v) => muda('frase', v)}
        erro={campos.frase}
      />
      <Campo
        rotulo="Sobre"
        multiline
        maxLength={1000}
        style={estilos.multilinha}
        value={form.sobre}
        onChangeText={(v) => muda('sobre', v)}
      />

      <Text style={estilosBase.rotulo}>Curso</Text>
      <View style={estilos.chips}>
        {cursos.data?.map((c) => (
          <Chip
            key={c.id}
            texto={c.nome}
            ativo={form.cursoId === c.id}
            aoTocar={() => muda('cursoId', form.cursoId === c.id ? null : c.id)}
          />
        ))}
      </View>
      <Campo
        rotulo="Semestre"
        keyboardType="number-pad"
        maxLength={2}
        value={form.semestre}
        onChangeText={(v) => muda('semestre', v.replace(/\D/g, ''))}
        erro={campos.semestre}
      />
      <Text style={estilosBase.rotulo}>Turno</Text>
      <View style={estilos.chips}>
        {TURNOS.map((t) => (
          <Chip
            key={t.valor}
            texto={t.rotulo}
            ativo={form.turno === t.valor}
            aoTocar={() =>
              muda('turno', form.turno === t.valor ? null : (t.valor as Turno))
            }
          />
        ))}
      </View>

      <Text style={estilosBase.secao}>O que você procura</Text>
      <View style={estilos.chips}>
        {OBJETIVOS.map((o) => (
          <Chip
            key={o.valor}
            texto={o.rotulo}
            ativo={form.objetivos.includes(o.valor)}
            aoTocar={() => muda('objetivos', alternar(form.objetivos, o.valor))}
          />
        ))}
      </View>
      <Campo
        rotulo="Interesses"
        ajuda="Separe por vírgula: xadrez, música, games"
        value={form.interesses}
        onChangeText={(v) => muda('interesses', v)}
      />
      <Campo
        rotulo="Habilidades"
        ajuda="Separe por vírgula: Python, Excel, Figma"
        value={form.habilidades}
        onChangeText={(v) => muda('habilidades', v)}
      />

      <Text style={estilosBase.secao}>Horários livres</Text>
      {PERIODOS.map((p) => (
        <View key={p.valor} style={estilos.linha}>
          <Text style={estilos.periodo}>{p.rotulo}</Text>
          <View style={estilos.chips}>
            {DIAS.map((d) => {
              const valor = `${d.valor}-${p.valor}`;
              return (
                <Chip
                  key={valor}
                  texto={d.rotulo}
                  ativo={form.horariosLivres.includes(valor)}
                  aoTocar={() =>
                    muda('horariosLivres', alternar(form.horariosLivres, valor))
                  }
                />
              );
            })}
          </View>
        </View>
      ))}

      <Text style={estilosBase.secao}>Disciplinas</Text>
      <Text style={estilosBase.subtitulo}>
        Marque o que você cursa, em que pode ajudar e em que precisa de ajuda.
      </Text>
      {disciplinas.data?.map((d) => (
        <View key={d.id} style={estilos.disciplina}>
          <Text style={estilos.nomeDisciplina}>{d.nome}</Text>
          <View style={estilos.chips}>
            {RELACOES.map((r) => (
              <Chip
                key={r.valor}
                texto={r.rotulo}
                ativo={temRelacao(d.id, r.valor)}
                aoTocar={() => alternarRelacao(d.id, r.valor)}
              />
            ))}
          </View>
        </View>
      ))}

      <Text style={estilosBase.secao}>Contatos</Text>
      <Text style={estilosBase.subtitulo}>Só aparecem para quem virar sua conexão.</Text>
      <Campo
        rotulo="Instagram"
        autoCapitalize="none"
        placeholder="@seu.perfil"
        value={form.instagram}
        onChangeText={(v) => muda('instagram', v)}
      />
      <Campo
        rotulo="WhatsApp"
        keyboardType="phone-pad"
        value={form.whatsapp}
        onChangeText={(v) => muda('whatsapp', v)}
      />

      <MensagemDeErro texto={erro} />
      <Botao titulo="Salvar perfil" aoTocar={salvar} carregando={salvando} />

      <Text style={estilosBase.secao}>Trocar senha</Text>
      <Campo
        rotulo="Senha atual"
        secureTextEntry
        value={senhas.atual}
        onChangeText={(v) => setSenhas((x) => ({ ...x, atual: v }))}
        erro={errosSenha.senhaAtual}
      />
      <Campo
        rotulo="Nova senha"
        secureTextEntry
        ajuda="Pelo menos 8 caracteres, com letras e números"
        value={senhas.nova}
        onChangeText={(v) => setSenhas((x) => ({ ...x, nova: v }))}
        erro={errosSenha.novaSenha}
      />
      <MensagemDeErro texto={errosSenha._} />
      <Botao
        titulo="Trocar senha"
        variante="contorno"
        aoTocar={trocarSenha}
        carregando={trocandoSenha}
        desabilitado={!senhas.atual || !senhas.nova}
      />

      <Botao titulo="Sair da conta" variante="perigo" aoTocar={confirmarSaida} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  trocarFoto: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  removerFoto: { fontSize: 13, color: cores.erro, marginTop: 6 },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    padding: espaco.g,
    borderRadius: raio.g,
  },
  faculdade: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  multilinha: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.p },
  periodo: { width: 56, fontSize: 13, color: cores.textoSuave, fontWeight: '600' },
  disciplina: {
    backgroundColor: cores.superficie,
    borderRadius: raio.m,
    padding: espaco.m,
    gap: espaco.p,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  nomeDisciplina: { fontSize: 15, fontWeight: '600', color: cores.texto },
});
