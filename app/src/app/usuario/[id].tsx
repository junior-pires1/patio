import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { PerfilSocial } from '@/componentes/PerfilSocial';
import { useUsuario } from '@/sessao';

/** Perfil de um colega (aberto do feed, da busca, das curtidas ou do chat). */
export default function PerfilDoColega() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eu = useUsuario();
  if (id === eu.id) return <Redirect href="/perfil" />;
  return (
    <>
      <Stack.Screen options={{ title: 'Perfil' }} />
      <PerfilSocial usuarioId={id} />
    </>
  );
}
