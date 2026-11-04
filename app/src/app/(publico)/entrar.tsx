import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { ErroApi } from '@/api/cliente';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { MensagemDeErro } from '@/componentes/Estados';
import { TelaPublica } from '@/componentes/TelaPublica';
import { useSessao } from '@/sessao';
import { fonte } from '@/tema';
import { criarEstilos } from '@/tema-provedor';

export default function Entrar() {
  const estilos = useEstilos();
  const { entrar } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível entrar.');
      setEnviando(false);
    }
  }

  return (
    <TelaPublica
      titulo="Sua turma, mais perto."
      subtitulo="Ache grupo de estudo, monitoria e gente com os mesmos interesses na sua faculdade."
      rodape={
        <Link href="/cadastro" style={estilos.link}>
          Primeira vez? <Text style={estilos.linkForte}>Criar conta</Text>
        </Link>
      }
    >
      <Campo
        rotulo="E-mail institucional"
        placeholder="seu.nome@aluno.faculdade.edu.br"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <View>
        <Campo
          rotulo="Senha"
          secureTextEntry
          autoComplete="current-password"
          value={senha}
          onChangeText={setSenha}
          onSubmitEditing={enviar}
        />
        <Link href="/esqueci" style={estilos.esqueci}>
          Esqueci minha senha
        </Link>
      </View>
      <MensagemDeErro texto={erro} />
      <Botao
        titulo="Entrar"
        aoTocar={enviar}
        carregando={enviando}
        desabilitado={!email || !senha}
      />
    </TelaPublica>
  );
}

const useEstilos = criarEstilos((c) => ({
  esqueci: {
    alignSelf: 'flex-end',
    marginTop: 10,
    color: c.marca,
    fontFamily: fonte.semi,
    fontSize: 14,
  },
  link: { textAlign: 'center', color: c.textoSuave, fontFamily: fonte.medio, fontSize: 15 },
  linkForte: { color: c.marca, fontFamily: fonte.negrito },
}));
