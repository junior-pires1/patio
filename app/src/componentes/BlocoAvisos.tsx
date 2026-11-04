import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import type { Aviso } from '@/api/tipos';
import { useSessao } from '@/sessao';
import { espaco, fonte, raio, tipo } from '@/tema';
import { criarEstilos, useTema } from '@/tema-provedor';

/**
 * RF21: avisos oficiais da coordenação. Os fixados ficam sempre à vista; os
 * outros aparecem ao tocar em "Ver mais avisos". Tocar num aviso abre o texto.
 */
export function BlocoAvisos() {
  const { api } = useSessao();
  const { c } = useTema();
  const estilos = useEstilos();
  const avisos = useQuery({
    queryKey: ['avisos'],
    queryFn: () => api.get<Aviso[]>('/avisos'),
  });
  const [aberto, setAberto] = useState<string | null>(null);
  const [todos, setTodos] = useState(false);
  const lista = avisos.data ?? [];
  const fixados = lista.filter((a) => a.fixado);
  const outros = lista.filter((a) => !a.fixado);
  if (lista.length === 0) return null;
  const visiveis = todos ? lista : fixados;

  return (
    <View style={estilos.lista}>
      {visiveis.map((aviso) => (
        <Pressable
          key={aviso.id}
          onPress={() => setAberto((atual) => (atual === aviso.id ? null : aviso.id))}
          accessibilityRole="button"
          accessibilityLabel={`Aviso da coordenação: ${aviso.titulo}`}
          style={({ pressed }) => [estilos.aviso, pressed && { opacity: 0.85 }]}
        >
          <View style={estilos.icone}>
            <Ionicons name="megaphone" size={18} color={c.sobreDestaque} />
          </View>
          <View style={estilos.corpo}>
            <Text style={estilos.rotulo}>Aviso da coordenação</Text>
            <Text style={estilos.titulo}>{aviso.titulo}</Text>
            {aberto === aviso.id ? <Text style={estilos.texto}>{aviso.texto}</Text> : null}
          </View>
          <Ionicons
            name={aberto === aviso.id ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={c.textoSuave}
          />
        </Pressable>
      ))}
      {outros.length > 0 ? (
        <Pressable
          onPress={() => setTodos((t) => !t)}
          accessibilityRole="button"
          hitSlop={6}
        >
          <Text style={estilos.mais}>
            {todos
              ? 'Mostrar só os fixados'
              : `Ver mais ${outros.length} aviso(s) da coordenação`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useEstilos = criarEstilos((c) => ({
  lista: { gap: espaco.p },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espaco.m,
    backgroundColor: c.destaqueSuave,
    borderRadius: raio.g,
    padding: espaco.m + 2,
  },
  icone: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: c.destaque,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corpo: { flex: 1, gap: 2 },
  rotulo: { ...tipo.sobrescrito, color: c.textoSuave },
  titulo: { ...tipo.nome, color: c.texto },
  texto: { ...tipo.corpo, fontSize: 14, color: c.texto, marginTop: 4 },
  mais: { fontFamily: fonte.semi, fontSize: 14, color: c.marca, paddingVertical: 2 },
}));
