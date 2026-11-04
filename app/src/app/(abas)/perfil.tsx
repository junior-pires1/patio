import { PerfilSocial } from '@/componentes/PerfilSocial';
import { useUsuario } from '@/sessao';
import EditarPerfil from '../perfil/editar';

/** Meu perfil, como os colegas veem (com Editar perfil e Atividade). */
export default function MeuPerfil() {
  const eu = useUsuario();
  // A coordenação não tem perfil social: vê só os dados da conta.
  if (eu.papel !== 'ALUNO') return <EditarPerfil />;
  return <PerfilSocial usuarioId={eu.id} />;
}
