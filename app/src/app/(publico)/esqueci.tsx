import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ErroApi } from '@/api/cliente';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { MensagemDeErro } from '@/componentes/Estados';
import { Tela } from '@/componentes/Tela';
import { useSessao } from '@/sessao';
import { estilosBase } from '@/tema';

/** RF39: esqueci minha senha (e-mail → código de 6 números → senha nova). */
export default function Esqueci() {
  const { api, entrarComSessao } = useSessao();
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

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
      } else setErro('Algo deu errado. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  const pedir = () =>
    tentar(async () => {
      await api.post('/auth/senha/codigo', { email: email.trim() });
      setEnviado(true);
    });

  const redefinir = () =>
    tentar(async () => {
      entrarComSessao(
        await api.redefinirSenha({ email: email.trim(), codigo: codigo.trim(), senha }),
      );
    });

  return (
    <Tela rolagem>
      <View style={estilos.topo}>
        <Text style={estilosBase.titulo}>Esqueci minha senha</Text>
        <Text style={estilosBase.subtitulo}>
          {enviado
            ? `Se ${email.trim()} tiver conta, chegou um código de 6 números. Ele vale por 10 minutos.`
            : 'Informe o seu e-mail institucional. Vamos mandar um código para você criar uma senha nova.'}
        </Text>
      </View>

      {!enviado ? (
        <>
          <Campo
            rotulo="E-mail institucional"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            erro={campos.email}
          />
          <MensagemDeErro texto={erro} />
          <Botao
            titulo="Enviar código"
            aoTocar={pedir}
            carregando={enviando}
            desabilitado={!email}
          />
        </>
      ) : (
        <>
          <Campo
            rotulo="Código"
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            value={codigo}
            onChangeText={setCodigo}
            erro={campos.codigo}
          />
          <Campo
            rotulo="Nova senha"
            secureTextEntry
            ajuda="Pelo menos 8 caracteres, com letras e números"
            value={senha}
            onChangeText={setSenha}
            erro={campos.senha}
          />
          <MensagemDeErro texto={erro} />
          <Botao
            titulo="Criar senha nova"
            aoTocar={redefinir}
            carregando={enviando}
            desabilitado={codigo.length !== 6 || !senha}
          />
          <Botao
            titulo="Pedir outro código"
            variante="contorno"
            aoTocar={() => setEnviado(false)}
          />
        </>
      )}
      <Botao
        titulo="Voltar para entrar"
        variante="contorno"
        aoTocar={() => router.back()}
      />
    </Tela>
  );
}

const estilos = StyleSheet.create({ topo: { marginTop: 24, gap: 8 } });
