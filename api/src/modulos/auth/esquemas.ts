import { z } from 'zod';

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('E-mail inválido').max(160, 'E-mail muito longo'));

/** RN: pelo menos 8 caracteres, com letras e números. */
export const senha = z
  .string()
  .min(8, 'A senha precisa de pelo menos 8 caracteres')
  .max(72, 'A senha pode ter no máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'A senha precisa ter letras')
  .regex(/[0-9]/, 'A senha precisa ter números')
  // O bcrypt só usa os primeiros 72 bytes: com acentos e emojis (2 a 4 bytes
  // cada), uma senha de 72 caracteres passaria disso e o final seria ignorado.
  .refine(
    (s) => new TextEncoder().encode(s).length <= 72,
    'Senha longa demais: acentos e emojis ocupam mais espaço. Use até 72 letras sem acento.',
  );

/** Idade completa em anos na data de hoje. */
export function idade(nascimento: Date, hoje = new Date()): number {
  let anos = hoje.getUTCFullYear() - nascimento.getUTCFullYear();
  const antesDoAniversario =
    hoje.getUTCMonth() < nascimento.getUTCMonth() ||
    (hoje.getUTCMonth() === nascimento.getUTCMonth() &&
      hoje.getUTCDate() < nascimento.getUTCDate());
  if (antesDoAniversario) anos--;
  return anos;
}

export const dataNascimento = z.iso
  .date('Use o formato AAAA-MM-DD')
  .transform((texto) => new Date(`${texto}T00:00:00Z`))
  .refine((d) => idade(d) >= 18, 'É preciso ter pelo menos 18 anos')
  .refine((d) => idade(d) <= 120, 'Data de nascimento inválida');

const dispositivo = z.string().trim().max(120).optional();

export const pedirCodigo = z.object({ email });

export const cadastro = z.object({
  email,
  codigo: z.string().regex(/^\d{6}$/, 'O código tem 6 números'),
  nome: z.string().trim().min(3, 'Informe o nome completo').max(120),
  apelido: z.string().trim().min(1, 'Informe como quer ser chamado').max(40),
  senha,
  dataNascimento,
  cursoId: z.uuid().optional(),
  // LGPD: o aceite do termo da faculdade é obrigatório (e precisa ser da versão atual).
  termo: z.object(
    {
      aceito: z.literal(true, 'Aceite o termo de uso e privacidade para continuar'),
      versao: z.number().int().min(1),
    },
    'Aceite o termo de uso e privacidade para continuar',
  ),
  dispositivo,
});

export const login = z.object({
  email,
  senha: z.string().min(1, 'Informe a senha').max(72),
  dispositivo,
});

export const renovacao = z.object({ refreshToken: z.string().min(10).max(200) });

export const redefinirSenha = z.object({
  email,
  codigo: z.string().regex(/^\d{6}$/, 'O código tem 6 números'),
  senha,
  dispositivo,
});

// Trocar a senha logado: a nova tem de ser diferente da atual (vale para aluno,
// coordenação e equipe da plataforma). Na redefinição por código, quem esqueceu
// a senha pode voltar a usar a mesma.
export const trocarSenha = z
  .object({
    senhaAtual: z.string().min(1, 'Informe a senha atual').max(72),
    novaSenha: senha,
  })
  .refine((d) => d.novaSenha !== d.senhaAtual, {
    message: 'A nova senha precisa ser diferente da atual',
    path: ['novaSenha'],
  });
