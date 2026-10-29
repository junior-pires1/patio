import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Aviso } from '@/api/tipos';
import { useCorDaFaculdade, useSessao } from '@/sessao';
import { cores, espaco, raio } from '@/tema';

/** RF21: avisos oficiais fixados pela coordenação. Tocar abre o texto completo. */
export function BlocoAvisos() {
  const { api } = useSessao();
  const cor = useCorDaFaculdade();
  const avisos = useQuery({
    queryKey: ['avisos'],
    queryFn: () => api.get<Aviso[]>('/avisos'),
  });
  const [aberto, setAberto] = useState<string | null>(null);
  const fixados = avisos.data?.filter((a) => a.fixado) ?? [];
  if (fixados.length === 0) return null;

  return (
    <View style={estilos.lista}>
      {fixados.map((aviso) => (
        <Pressable
          key={aviso.id}
          onPress={() => setAberto((atual) => (atual === aviso.id ? null : aviso.id))}
          accessibilityRole="button"
          accessibilityLabel={`Aviso da coordenação: ${aviso.titulo}`}
          style={[estilos.aviso, { borderColor: cor }]}
        >
          <Text style={[estilos.rotulo, { color: cor }]}>📢 Aviso da coordenação</Text>
          <Text style={estilos.titulo}>{aviso.titulo}</Text>
          {aberto === aviso.id ? <Text style={estilos.texto}>{aviso.texto}</Text> : null}
        </Pressable>
      ))}
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
});
