import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ErroApi } from '@/api/cliente';
import type { Faculdade } from '@/api/tipos';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { MensagemDeErro } from '@/componentes/Estados';
import { Tela } from '@/componentes/Tela';
import { useSessao } from '@/sessao';
import { cores, estilosBase, suave } from '@/tema';
import { dataBrParaIso, mascaraData } from '@/utils/datas';

/** Cadastro em 2 passos: e-mail institucional → código + dados da conta. */
export default function Cadastro() {
  const { api, cadastrar } = useSessao();
  const [faculdade, setFaculdade] = useState<Faculdade | null>(null);
  const [email, setEmail] = useState('');
  const [dados, setDados] = useState({
    codigo: '',
    nome: '',
    apelido: '',
    nascimento: '',
    senha: '',
  });
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const mudar = (campo: keyof typeof dados) => (valor: string) =>
    setDados((d) => ({
      ...d,
      [campo]: campo === 'nascimento' ? mascaraData(valor) : valor,
    }));

  async function tentar(acao: () => Promise<void>) {
    setErro(null);
    setCampos({});
    setEnviando(true);
    try {
      await acao();
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setCampos(e.campos);
      } else {
        setErro('Algo deu errado. Tente novamente.');
      }
    } finally {
      setEnviando(false);
    }
  }

  const pedirCodigo = () =>
    tentar(async () => {
      const r = await api.post<{ faculdade: Faculdade }>('/auth/codigo', {
        email: email.trim(),
      });
      setFaculdade(r.faculdade);
    });

  const criarConta = () =>
    tentar(async () => {
      const dataNascimento = dataBrParaIso(dados.nascimento);
      if (!dataNascimento) {
        setCampos({ dataNascimento: 'Use o formato DD/MM/AAAA' });
        return;
      }
      await cadastrar({
        email: email.trim(),
        codigo: dados.codigo.trim(),
        nome: dados.nome.trim(),
        apelido: dados.apelido.trim(),
        senha: dados.senha,
        dataNascimento,
      });
      // A sessão muda e a navegação leva para as abas sozinha.
    });

  if (!faculdade) {
    return (
      <Tela rolagem>
        <View style={estilos.topo}>
          <Text style={estilosBase.titulo}>Criar conta</Text>
          <Text style={estilosBase.subtitulo}>
            Use o e-mail da sua faculdade. Vamos mandar um código de 6 números para
            confirmar.
          </Text>
        </View>
        <Campo
          rotulo="E-mail institucional"
          placeholder="seu.nome@aluno.faculdade.edu.br"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          erro={campos.email}
        />
        <MensagemDeErro texto={erro} />
        <Botao
          titulo="Enviar código"
          aoTocar={pedirCodigo}
          carregando={enviando}
          desabilitado={!email}
        />
        <Botao titulo="Já tenho conta" variante="contorno" aoTocar={() => router.back()} />
      </Tela>
    );
  }

  return (
    <Tela rolagem>
      <View style={[estilos.faculdade, { backgroundColor: suave(faculdade.corPrimaria) }]}>
        <Text style={[estilos.sigla, { color: faculdade.corPrimaria }]}>
          {faculdade.sigla}
        </Text>
        <Text style={estilos.nomeFaculdade}>{faculdade.nome}</Text>
        <Text style={estilosBase.subtitulo}>
          Código enviado para {email.trim()}. Vale por 10 minutos.
        </Text>
      </View>

      <Campo
        rotulo="Código"
        placeholder="000000"
        keyboardType="number-pad"
        maxLength={6}
        value={dados.codigo}
        onChangeText={mudar('codigo')}
        erro={campos.codigo}
      />
      <Campo
        rotulo="Nome completo"
        value={dados.nome}
        onChangeText={mudar('nome')}
        erro={campos.nome}
      />
      <Campo
        rotulo="Como quer ser chamado"
        ajuda="Aparece nas cartas para os colegas"
        value={dados.apelido}
        onChangeText={mudar('apelido')}
        erro={campos.apelido}
      />
      <Campo
        rotulo="Data de nascimento"
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        ajuda="Só para confirmar os 18 anos; ninguém vê"
        value={dados.nascimento}
        onChangeText={mudar('nascimento')}
        erro={campos.dataNascimento}
      />
      <Campo
        rotulo="Senha"
        secureTextEntry
        ajuda="Pelo menos 8 caracteres, com letras e números"
        value={dados.senha}
        onChangeText={mudar('senha')}
        erro={campos.senha}
      />
      <MensagemDeErro texto={erro} />
      <Botao
        titulo="Criar conta"
        cor={faculdade.corPrimaria}
        aoTocar={criarConta}
        carregando={enviando}
        desabilitado={dados.codigo.length !== 6 || !dados.senha}
      />
      <Botao
        titulo="Trocar e-mail"
        variante="contorno"
        cor={faculdade.corPrimaria}
        aoTocar={() => setFaculdade(null)}
      />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  topo: { marginTop: 24, gap: 8 },
  faculdade: { borderRadius: 16, padding: 16, gap: 4, marginTop: 8 },
  sigla: { fontSize: 22, fontWeight: '800' },
  nomeFaculdade: { fontSize: 16, fontWeight: '600', color: cores.texto },
});
