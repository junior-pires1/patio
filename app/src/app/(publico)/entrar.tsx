import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ErroApi } from '@/api/cliente';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { MensagemDeErro } from '@/componentes/Estados';
import { Tela } from '@/componentes/Tela';
import { useSessao } from '@/sessao';
import { cores, estilosBase } from '@/tema';

export default function Entrar() {
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
    <Tela rolagem>
      <View style={estilos.topo}>
        <Text style={estilos.marca}>Pátio</Text>
        <Text style={estilosBase.subtitulo}>
          A rede da sua faculdade para achar grupo de estudo, monitoria e gente com os
          mesmos interesses.
        </Text>
      </View>

      <Campo
        rotulo="E-mail institucional"
        placeholder="seu.nome@aluno.faculdade.edu.br"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Campo
        rotulo="Senha"
        secureTextEntry
        autoComplete="current-password"
        value={senha}
        onChangeText={setSenha}
        onSubmitEditing={enviar}
      />
      <MensagemDeErro texto={erro} />
      <Botao
        titulo="Entrar"
        aoTocar={enviar}
        carregando={enviando}
        desabilitado={!email || !senha}
      />

      <Link href="/esqueci" style={estilos.linkSimples}>
        Esqueci minha senha
      </Link>
      <Link href="/cadastro" style={estilos.link}>
        Primeira vez? <Text style={estilos.linkForte}>Criar conta</Text>
      </Link>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  topo: { marginTop: 48, marginBottom: 16, gap: 8 },
  marca: { fontSize: 40, fontWeight: '800', color: cores.padrao },
  linkSimples: { textAlign: 'center', color: cores.textoSuave, fontSize: 14 },
  link: { textAlign: 'center', marginTop: 8, color: cores.textoSuave, fontSize: 15 },
  linkForte: { color: cores.padrao, fontWeight: '700' },
});
