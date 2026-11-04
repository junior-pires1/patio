'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Botao, Cartao, Estado, Logo, SeletorDeTema, Selo, Titulo } from '@/componentes/ui';
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
  const [senhaNova, setSenhaNova] = useState<{ email: string; senha: string } | null>(null);
  const novaSenha = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      pedir<{ email: string; senhaProvisoria: string }>(
        'POST',
        `/plataforma/faculdades/${id}/coordenacao/senha`,
        { email },
      ),
    onSuccess: (r) => setSenhaNova({ email: r.email, senha: r.senhaProvisoria }),
    onError: (e) => alert(e.message),
  });
  const [minhaSenha, setMinhaSenha] = useState({ atual: '', nova: '' });
  const [avisoSenha, setAvisoSenha] = useState<{ ok: boolean; texto: string } | null>(null);
  const trocarMinha = useMutation({
    mutationFn: () =>
      pedir('PUT', '/plataforma/senha', {
        senhaAtual: minhaSenha.atual,
        novaSenha: minhaSenha.nova,
      }),
    onSuccess: () => {
      setMinhaSenha({ atual: '', nova: '' });
      setAvisoSenha({ ok: true, texto: 'Senha trocada!' });
    },
    onError: (e) =>
      setAvisoSenha({
        ok: false,
        texto:
          e instanceof ErroApi
            ? (Object.values(e.campos)[0] ?? e.message)
            : 'Não foi possível trocar.',
      }),
  });
  const ativar = useMutation({
    mutationFn: ({ id, ativa }: { id: string; ativa: boolean }) =>
      pedir('PATCH', `/plataforma/faculdades/${id}`, { ativa }),
    onSuccess: atualizar,
  });

  if (estado.tipo !== 'logado')
    return <p className="p-10 text-center text-suave">Carregando…</p>;

  const muda = (k: keyof typeof VAZIO) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const campo = 'campo';
  const erroDe = (...chaves: string[]) => {
    const msg = chaves.map((c) => campos[c]).find(Boolean);
    return msg ? <span className="text-xs text-erro">{msg}</span> : null;
  };
  function enviar(e: FormEvent) {
    e.preventDefault();
    setCriada(null);
    cadastrar.mutate();
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-borda bg-superficie/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Logo altura={32} />
            <span className="rounded-full bg-invertido px-2.5 py-1 text-[11px] font-bold tracking-wider text-sobre-invertido uppercase">
              Plataforma
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-suave sm:inline">{estado.admin.email}</span>
            <SeletorDeTema compacto />
            <Botao variante="neutro" onClick={sair} className="py-1.5">
              Sair
            </Botao>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 md:px-8">
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
                  <p className="text-sm text-suave">{rotulo}</p>
                  <p className="mt-1 text-2xl font-bold">{valor}</p>
                </Cartao>
              ))}
            </div>
          ) : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-[3fr_2fr]">
          <div>
            <h2 className="mb-3 text-lg font-semibold">Faculdades parceiras</h2>
            {senhaNova ? (
              <p
                role="status"
                className="mb-3 rounded-lg bg-sucesso-suave p-3 text-sm text-sucesso"
              >
                Nova senha provisória de <strong>{senhaNova.email}</strong>:{' '}
                <code className="rounded bg-superficie px-1 font-mono">
                  {senhaNova.senha}
                </code>
                . Ela aparece só agora.{' '}
                <button className="underline" onClick={() => setSenhaNova(null)}>
                  Ok
                </button>
              </p>
            ) : null}
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
                        <p className="text-sm text-suave">
                          {f.cidade}/{f.uf} · {f.alunosAtivos} aluno(s) ativo(s) · desde{' '}
                          {dataHora(f.criadoEm).slice(0, 10)}
                        </p>
                        <p className="mt-1 text-xs text-suave">
                          Domínios: {f.dominios.join(', ')}
                        </p>
                        <div className="text-xs text-suave">
                          Coordenação: {f.coordenacao.length === 0 ? '—' : null}
                          {f.coordenacao.map((email) => (
                            <span
                              key={email}
                              className="mr-2 inline-flex items-center gap-1"
                            >
                              {email}
                              <button
                                className="font-semibold text-texto underline disabled:opacity-50"
                                disabled={novaSenha.isPending}
                                onClick={() =>
                                  confirm(
                                    `Gerar nova senha provisória para ${email}? A senha atual deixa de valer.`,
                                  ) && novaSenha.mutate({ id: f.id, email })
                                }
                              >
                                nova senha
                              </button>
                            </span>
                          ))}
                        </div>
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
                  {erroDe('cidade')}
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
                    className="h-10 w-12 cursor-pointer rounded-lg border border-borda bg-superficie"
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
                <span className="text-xs text-suave">
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
                {erroDe('coordenacao.nome')}
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
                <p className="rounded-lg bg-erro-suave p-3 text-sm text-erro">{campos._}</p>
              ) : null}
              <Botao type="submit" carregando={cadastrar.isPending} className="w-full">
                Cadastrar
              </Botao>
              {criada ? (
                <div
                  role="status"
                  className="rounded-lg bg-sucesso-suave p-3 text-sm text-sucesso"
                >
                  <p className="font-semibold">{criada.faculdade.nome} cadastrada!</p>
                  <p>
                    Entregue à coordenação: <strong>{criada.coordenacao.email}</strong> /
                    senha provisória{' '}
                    <code className="rounded bg-superficie px-1 font-mono">
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

        <section className="max-w-md">
          <Cartao>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setAvisoSenha(null);
                trocarMinha.mutate();
              }}
            >
              <h2 className="text-lg font-semibold">Minha senha</h2>
              <p className="text-sm text-suave">
                Depois de trocar, a senha do Render (SENHA_ADMIN_PLATAFORMA) deixa de valer.
              </p>
              <label className="block text-sm">
                Senha atual
                <input
                  type="password"
                  className={campo}
                  value={minhaSenha.atual}
                  onChange={(e) => setMinhaSenha((m) => ({ ...m, atual: e.target.value }))}
                  required
                />
              </label>
              <label className="block text-sm">
                Nova senha
                <input
                  type="password"
                  className={campo}
                  value={minhaSenha.nova}
                  onChange={(e) => setMinhaSenha((m) => ({ ...m, nova: e.target.value }))}
                  required
                />
                <span className="text-xs text-suave">
                  Pelo menos 8 caracteres, com letras e números.
                </span>
              </label>
              {avisoSenha ? (
                <p
                  role="status"
                  className={`rounded-lg p-3 text-sm ${avisoSenha.ok ? 'bg-sucesso-suave text-sucesso' : 'bg-erro-suave text-erro'}`}
                >
                  {avisoSenha.texto}
                </p>
              ) : null}
              <Botao type="submit" carregando={trocarMinha.isPending}>
                Trocar minha senha
              </Botao>
            </form>
          </Cartao>
        </section>
      </main>
    </div>
  );
}
