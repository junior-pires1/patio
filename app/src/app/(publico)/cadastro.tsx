import { useState } from 'react';
import { Text, View } from 'react-native';
import { ErroApi } from '@/api/cliente';
import type { Faculdade } from '@/api/tipos';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { MensagemDeErro } from '@/componentes/Estados';
import { TelaPublica } from '@/componentes/TelaPublica';
import { useSessao } from '@/sessao';
import { fonte, suave } from '@/tema';
import { criarEstilos } from '@/tema-provedor';
import { dataBrParaIso, mascaraData } from '@/utils/datas';
import { voltar } from '@/utils/navegacao';

/** Cadastro em 2 passos: e-mail institucional → código + dados da conta. */
export default function Cadastro() {
  const estilos = useEstilos();
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
      <TelaPublica
        etapa="Passo 1 de 2"
        titulo="Criar conta"
        subtitulo="Use o e-mail da sua faculdade. Vamos mandar um código de 6 números para confirmar."
      >
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
        <Botao
          titulo="Já tenho conta"
          variante="contorno"
          aoTocar={() => voltar('/entrar')}
        />
      </TelaPublica>
    );
  }

  return (
    <TelaPublica
      etapa="Passo 2 de 2"
      titulo="Quase lá"
      subtitulo={`Mandamos um código para ${email.trim()}. Ele vale por 10 minutos.`}
    >
      <View style={estilos.faculdade}>
        <View
          style={[estilos.selo, { backgroundColor: suave(faculdade.corPrimaria, '26') }]}
        >
          <Text style={[estilos.sigla, { color: faculdade.corPrimaria }]}>
            {faculdade.sigla}
          </Text>
        </View>
        <View style={estilos.flex}>
          <Text style={estilos.rotuloFaculdade}>Sua faculdade</Text>
          <Text style={estilos.nomeFaculdade}>{faculdade.nome}</Text>
        </View>
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
        aoTocar={criarConta}
        carregando={enviando}
        desabilitado={dados.codigo.length !== 6 || !dados.senha}
      />
      <Botao
        titulo="Trocar e-mail"
        variante="contorno"
        aoTocar={() => setFaculdade(null)}
      />
    </TelaPublica>
  );
}

const useEstilos = criarEstilos((c) => ({
  faculdade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: c.superficieAlta,
  },
  selo: {
    minWidth: 52,
    height: 52,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigla: { fontSize: 16, fontFamily: fonte.extra },
  flex: { flex: 1 },
  rotuloFaculdade: { fontSize: 12, fontFamily: fonte.medio, color: c.textoSuave },
  nomeFaculdade: { fontSize: 15, fontFamily: fonte.negrito, color: c.texto },
}));
