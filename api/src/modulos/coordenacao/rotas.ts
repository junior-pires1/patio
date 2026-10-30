import { Router } from 'express';
import { z } from 'zod';
import type { Contexto } from '../../contexto';
import { autenticar, exigirPapel, quem } from '../../seguranca/autenticar';
import { dataNascimento, email } from '../auth/esquemas';
import * as cadastros from './cadastros';
import * as servico from './servico';

const pagina = z.coerce.number().int().min(1).max(1000).default(1);
const id = z.object({ id: z.uuid('Identificador inválido') });
const filtroDenuncias = z.object({
  status: z.enum(['ABERTA', 'RESOLVIDA']).default('ABERTA'),
  pagina,
});
const decisao = z.object({ acao: z.enum(['ARQUIVADA', 'ADVERTENCIA', 'SUSPENSAO']) });
const filtroAlunos = z.object({
  busca: z.string().trim().max(80).optional(),
  status: z.enum(['ATIVA', 'SUSPENSA']).optional(),
  pagina,
});

const nome = z.string().trim().min(2, 'Informe o nome').max(120, 'Nome muito longo');
const novoCurso = z.object({ nome });
const novaDisciplina = z.object({ nome, cursoId: z.uuid().nullable().optional() });
const novoAluno = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo').max(120),
  apelido: z.string().trim().min(1, 'Informe como quer ser chamado').max(40),
  email,
  dataNascimento,
  cursoId: z.uuid().nullable().optional(),
});

/** Painel da coordenação (RF28–RF33). Tudo restrito à própria faculdade (RN14). */
export function rotasCoordenacao(ctx: Contexto) {
  const r = Router();
  const coordenacao = [autenticar(ctx), exigirPapel('COORDENACAO')];

  r.get('/coordenacao/resumo', ...coordenacao, async (req, res) => {
    res.json(await servico.resumo(ctx, quem(req)));
  });

  r.get('/coordenacao/denuncias', ...coordenacao, async (req, res) => {
    res.json(
      await servico.listarDenuncias(ctx, quem(req), filtroDenuncias.parse(req.query)),
    );
  });

  r.post('/coordenacao/denuncias/:id/decisao', ...coordenacao, async (req, res) => {
    const { acao } = decisao.parse(req.body);
    res.json(await servico.decidirDenuncia(ctx, quem(req), id.parse(req.params).id, acao));
  });

  r.get('/coordenacao/alunos', ...coordenacao, async (req, res) => {
    res.json(await servico.listarAlunos(ctx, quem(req), filtroAlunos.parse(req.query)));
  });

  r.post('/coordenacao/alunos', ...coordenacao, async (req, res) => {
    res
      .status(201)
      .json(await cadastros.criarAluno(ctx, quem(req), novoAluno.parse(req.body)));
  });

  r.post('/coordenacao/alunos/:id/senha', ...coordenacao, async (req, res) => {
    res.json(await cadastros.novaSenhaDoAluno(ctx, quem(req), id.parse(req.params).id));
  });

  r.post('/coordenacao/cursos', ...coordenacao, async (req, res) => {
    const { nome } = novoCurso.parse(req.body);
    res.status(201).json(await cadastros.criarCurso(ctx, quem(req), nome));
  });

  r.delete('/coordenacao/cursos/:id', ...coordenacao, async (req, res) => {
    await cadastros.removerCurso(ctx, quem(req), id.parse(req.params).id);
    res.status(204).end();
  });

  r.post('/coordenacao/disciplinas', ...coordenacao, async (req, res) => {
    res
      .status(201)
      .json(
        await cadastros.criarDisciplina(ctx, quem(req), novaDisciplina.parse(req.body)),
      );
  });

  r.delete('/coordenacao/disciplinas/:id', ...coordenacao, async (req, res) => {
    await cadastros.removerDisciplina(ctx, quem(req), id.parse(req.params).id);
    res.status(204).end();
  });

  r.post('/coordenacao/alunos/:id/suspender', ...coordenacao, async (req, res) => {
    res.json(
      await servico.mudarStatusDoAluno(ctx, quem(req), id.parse(req.params).id, 'SUSPENSA'),
    );
  });

  r.post('/coordenacao/alunos/:id/reativar', ...coordenacao, async (req, res) => {
    res.json(
      await servico.mudarStatusDoAluno(ctx, quem(req), id.parse(req.params).id, 'ATIVA'),
    );
  });

  r.get('/coordenacao/auditoria', ...coordenacao, async (req, res) => {
    res.json(await servico.listarAuditoria(ctx, quem(req), pagina.parse(req.query.pagina)));
  });

  return r;
}
