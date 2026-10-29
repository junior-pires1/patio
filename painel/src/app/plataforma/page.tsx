'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Botao, Cartao, Estado, Selo, Titulo } from '@/componentes/ui';
import { ErroApi } from '@/lib/cliente';
import { usePlataforma } from '@/lib/plataforma';
import { dataHora } from '@/lib/textos';

type Metricas = {
  faculdades: number;
  faculdadesAtivas: number;
  alunosAtivos: number;
  conexoesAtivas: number;
  mensagensUltimos30Dias: number;
  denunciasAbertas: number;
};
type Faculdade = {
  id: string;
  nome: string;
  sigla: string;
  corPrimaria: string;
  cidade: string;
  uf: string;
  ativa: boolean;
  criadoEm: string;
  dominios: string[];
  coordenacao: string[];
  alunosAtivos: number;
};
type Criada = {
  faculdade: Faculdade;
  coordenacao: { email: string; senhaProvisoria: string };
};

const VAZIO = {
  nome: '',
  sigla: '',
  corPrimaria: '#1F6FEB',
  cidade: '',
  uf: '',
  dominios: '',
  coordNome: '',
  coordEmail: '',
};

export default function PainelPlataforma() {
  const { estado, pedir, sair } = usePlataforma();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(VAZIO);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [criada, setCriada] = useState<Criada | null>(null);
  const logado = estado.tipo === 'logado';

  useEffect(() => {
    if (estado.tipo === 'anonimo') router.replace('/plataforma/entrar');
  }, [estado, router]);

  const metricas = useQuery({
    queryKey: ['plataforma', 'metricas'],
    queryFn: () => pedir<Metricas>('GET', '/plataforma/metricas'),
    enabled: logado,
  });
  const faculdades = useQuery({
    queryKey: ['plataforma', 'faculdades'],
    queryFn: () => pedir<Faculdade[]>('GET', '/plataforma/faculdades'),
    enabled: logado,
  });
  const atualizar = () => void queryClient.invalidateQueries({ queryKey: ['plataforma'] });

  const cadastrar = useMutation({
    mutationFn: () =>
      pedir<Criada>('POST', '/plataforma/faculdades', {
        nome: form.nome,
        sigla: form.sigla,
        corPrimaria: form.corPrimaria,
        cidade: form.cidade,
        uf: form.uf,
        dominios: form.dominios.split(/[\s,]+/).filter(Boolean),
        coordenacao: { nome: form.coordNome, email: form.coordEmail },
      }),
    onSuccess: (r) => {
      setCriada(r);
      setForm(VAZIO);
      setCampos({});
      atualizar();
    },
    onError: (e) =>
      setCampos(e instanceof ErroApi ? { ...e.campos, _: e.message } : { _: e.message }),
  });
  const ativar = useMutation({
    mutationFn: ({ id, ativa }: { id: string; ativa: boolean }) =>
      pedir('PATCH', `/plataforma/faculdades/${id}`, { ativa }),
    onSuccess: atualizar,
  });

  if (estado.tipo !== 'logado')
    return <p className="p-10 text-center text-slate-500">Carregando…</p>;

  const muda = (k: keyof typeof VAZIO) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const campo =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';
  const erroDe = (...chaves: string[]) => {
    const msg = chaves.map((c) => campos[c]).find(Boolean);
    return msg ? <span className="text-xs text-red-600">{msg}</span> : null;
  };
  function enviar(e: FormEvent) {
    e.preventDefault();
    setCriada(null);
    cadastrar.mutate();
  }

  return (
    <div className="min-h-screen" style={{ ['--cor' as string]: '#0f172a' }}>
      <header className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
        <p className="text-xl font-extrabold">
          Pátio <span className="font-normal text-slate-300">· Plataforma</span>
        </p>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-300">{estado.admin.email}</span>
          <button onClick={sair} className="font-semibold hover:underline">
            Sair
          </button>
        </div>
      </header>

      <main className="space-y-8 p-4 md:p-8">
        <section>
          <Titulo descricao="Somente totais: a equipe da plataforma não vê conversas nem perfis de alunos.">
            Métricas gerais
          </Titulo>
          <Estado carregando={metricas.isPending} erro={metricas.error} />
          {metricas.data ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
              {[
                [
                  'Faculdades',
                  `${metricas.data.faculdadesAtivas} de ${metricas.data.faculdades} ativas`,
                ],
                ['Alunos ativos', metricas.data.alunosAtivos],
                ['Conexões ativas', metricas.data.conexoesAtivas],
                ['Mensagens (30 dias)', metricas.data.mensagensUltimos30Dias],
                ['Denúncias abertas', metricas.data.denunciasAbertas],
              ].map(([rotulo, valor]) => (
                <Cartao key={rotulo}>
                  <p className="text-sm text-slate-600">{rotulo}</p>
                  <p className="mt-1 text-2xl font-bold">{valor}</p>
                </Cartao>
              ))}
            </div>
          ) : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-[3fr_2fr]">
          <div>
            <h2 className="mb-3 text-lg font-semibold">Faculdades parceiras</h2>
            <Estado carregando={faculdades.isPending} erro={faculdades.error} />
            <div className="space-y-3">
              {faculdades.data?.map((f) => (
                <Cartao key={f.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1 h-10 w-10 shrink-0 rounded-lg"
                        style={{ backgroundColor: f.corPrimaria }}
                        aria-hidden
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{f.nome}</h3>
                          <Selo>{f.sigla}</Selo>
                          {f.ativa ? (
                            <Selo tom="ok">Ativa</Selo>
                          ) : (
                            <Selo tom="perigo">Desativada</Selo>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">
                          {f.cidade}/{f.uf} · {f.alunosAtivos} aluno(s) ativo(s) · desde{' '}
                          {dataHora(f.criadoEm).slice(0, 10)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Domínios: {f.dominios.join(', ')}
                        </p>
                        <p className="text-xs text-slate-500">
                          Coordenação: {f.coordenacao.join(', ') || '—'}
                        </p>
                      </div>
                    </div>
                    <Botao
                      variante={f.ativa ? 'perigo' : 'principal'}
                      disabled={ativar.isPending}
                      onClick={() =>
                        (!f.ativa ||
                          confirm(
                            `Desativar ${f.nome}? Alunos e coordenação perdem o acesso na hora.`,
                          )) &&
                        ativar.mutate({ id: f.id, ativa: !f.ativa })
                      }
                    >
                      {f.ativa ? 'Desativar' : 'Reativar'}
                    </Botao>
                  </div>
                </Cartao>
              ))}
            </div>
          </div>

          <Cartao className="h-fit">
            <form onSubmit={enviar} className="space-y-3">
              <h2 className="text-lg font-semibold">Cadastrar faculdade</h2>
              <label className="block text-sm">
                Nome{' '}
                <input
                  className={campo}
                  value={form.nome}
                  onChange={muda('nome')}
                  required
                />
                {erroDe('nome')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="block text-sm">
                  Sigla{' '}
                  <input
                    className={campo}
                    value={form.sigla}
                    onChange={muda('sigla')}
                    required
                  />
                  {erroDe('sigla')}
                </label>
                <label className="block text-sm">
                  Cidade{' '}
                  <input
                    className={campo}
                    value={form.cidade}
                    onChange={muda('cidade')}
                    required
                  />
                </label>
                <label className="block text-sm">
                  UF{' '}
                  <input
                    className={campo}
                    value={form.uf}
                    maxLength={2}
                    onChange={muda('uf')}
                    required
                  />
                  {erroDe('uf')}
                </label>
              </div>
              <label className="block text-sm">
                Cor da marca
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.corPrimaria}
                    onChange={muda('corPrimaria')}
                    className="h-9 w-12 rounded border border-slate-300"
                  />
                  <input
                    className={campo}
                    value={form.corPrimaria}
                    onChange={muda('corPrimaria')}
                  />
                </span>
                {erroDe('corPrimaria')}
              </label>
              <label className="block text-sm">
                Domínios de e-mail aceitos
                <input
                  className={campo}
                  placeholder="faculdade.edu.br, aluno.faculdade.edu.br"
                  value={form.dominios}
                  onChange={muda('dominios')}
                  required
                />
                <span className="text-xs text-slate-500">
                  Subdomínios também são aceitos. Separe por vírgula.
                </span>
                {erroDe('dominios', 'dominios.0')}
              </label>
              <label className="block text-sm">
                Nome da coordenação{' '}
                <input
                  className={campo}
                  value={form.coordNome}
                  onChange={muda('coordNome')}
                  required
                />
              </label>
              <label className="block text-sm">
                E-mail da coordenação{' '}
                <input
                  type="email"
                  className={campo}
                  value={form.coordEmail}
                  onChange={muda('coordEmail')}
                  required
                />
                {erroDe('coordenacao.email')}
              </label>
              {campos._ ? (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{campos._}</p>
              ) : null}
              <Botao type="submit" carregando={cadastrar.isPending} className="w-full">
                Cadastrar
              </Botao>
              {criada ? (
                <div
                  role="status"
                  className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"
                >
                  <p className="font-semibold">{criada.faculdade.nome} cadastrada!</p>
                  <p>
                    Entregue à coordenação: <strong>{criada.coordenacao.email}</strong> /
                    senha provisória{' '}
                    <code className="rounded bg-white px-1 font-mono">
                      {criada.coordenacao.senhaProvisoria}
                    </code>
                  </p>
                  <p className="text-xs">
                    A senha aparece só agora. Anote antes de sair desta tela.
                  </p>
                </div>
              ) : null}
            </form>
          </Cartao>
        </section>
      </main>
    </div>
  );
}
