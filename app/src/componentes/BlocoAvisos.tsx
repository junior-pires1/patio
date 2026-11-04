import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Aviso } from '@/api/tipos';
import { useCorDaFaculdade, useSessao } from '@/sessao';
import { cores, espaco, raio } from '@/tema';

/**
 * RF21: avisos oficiais da coordenação. Os fixados ficam sempre à vista; os
 * outros aparecem ao tocar em "Ver mais avisos". Tocar num aviso abre o texto.
 */
export function BlocoAvisos() {
  const { api } = useSessao();
  const cor = useCorDaFaculdade();
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
          style={[estilos.aviso, { borderColor: cor }]}
        >
          <Text style={[estilos.rotulo, { color: cor }]}>Aviso da coordenação</Text>
          <Text style={estilos.titulo}>{aviso.titulo}</Text>
          {aberto === aviso.id ? <Text style={estilos.texto}>{aviso.texto}</Text> : null}
        </Pressable>
      ))}
      {outros.length > 0 ? (
        <Pressable
          onPress={() => setTodos((t) => !t)}
          accessibilityRole="button"
          hitSlop={6}
        >
          <Text style={[estilos.mais, { color: cor }]}>
            {todos
              ? 'Mostrar só os fixados'
              : `Ver mais ${outros.length} aviso(s) da coordenação`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco.p },
  aviso: {
    backgroundColor: cores.superficie,
    borderWidth: 1.5,
    borderRadius: raio.m,
    padding: espaco.m,
    gap: 2,
  },
  rotulo: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  titulo: { fontSize: 15, fontWeight: '700', color: cores.texto },
  texto: { fontSize: 14, color: cores.texto, marginTop: 4, lineHeight: 20 },
  mais: { fontSize: 14, fontWeight: '600', paddingVertical: 2 },
});
