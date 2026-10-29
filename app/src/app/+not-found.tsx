import { Redirect } from 'expo-router';
import { useSessao } from '@/sessao';

/** Endereço desconhecido: volta para o início (ou para o login). */
export default function NaoEncontrada() {
  const { estado } = useSessao();
  return <Redirect href={estado.tipo === 'logado' ? '/' : '/entrar'} />;
}
