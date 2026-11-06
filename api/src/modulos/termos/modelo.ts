/**
 * Modelo padrão do termo (versão 1). A coordenação pode publicar um texto
 * próprio no painel; este é só o ponto de partida e deve ser revisado pelo
 * jurídico da faculdade.
 */
export function modeloDoTermo(faculdade: { nome: string; sigla: string }) {
  const { nome, sigla } = faculdade;
  return `TERMO DE USO E DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS
${nome} (${sigla}) · Pátio

Este termo explica como a ${nome} ("Faculdade") trata os seus dados pessoais no Pátio, a rede acadêmica usada pelos alunos da Faculdade, conforme a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD). Ao marcar a caixa de aceite, você declara que leu e concorda com o que está abaixo.

1. QUEM É RESPONSÁVEL PELOS SEUS DADOS
A Faculdade é a controladora dos dados pessoais tratados no Pátio: é ela quem decide para que os dados são usados. O Pátio é a plataforma tecnológica que opera esses dados em nome da Faculdade, seguindo as instruções dela.

2. QUAIS DADOS SÃO TRATADOS
• Dados de cadastro: nome completo, apelido, e-mail institucional, data de nascimento e senha (guardada só em forma cifrada).
• Dados acadêmicos: curso, semestre, turno e disciplinas que você cursa, em que pode ajudar ou em que precisa de ajuda.
• Dados de perfil que você escolher informar: foto, frase, "sobre", interesses, habilidades, horários livres, experiências, certificados, links e contatos.
• Conteúdo que você criar: publicações, comentários, stories, mensagens de texto e de voz, imagens, reações, curtidas, grupos de estudo e candidaturas a vagas.
• Dados de uso: curtidas e pulos no Descobrir, quem você segue, visitas a perfis, notificações e registros técnicos de acesso (data, hora e aparelho).

3. PARA QUE OS DADOS SÃO USADOS
• Criar e manter a sua conta e confirmar que você é aluno(a) maior de 18 anos da Faculdade.
• Sugerir colegas com afinidade acadêmica (disciplinas, objetivos e horários) e permitir conexões, conversas, grupos de estudo, publicações e vagas.
• Enviar notificações no aplicativo e no celular.
• Garantir a segurança da comunidade: moderação de denúncias, bloqueios, prevenção de fraudes e cumprimento das regras da Faculdade.
• Cumprir obrigações legais e atender pedidos de autoridades, quando exigido por lei.
Os dados não são vendidos e não são usados para publicidade.

4. BASE LEGAL
O tratamento se baseia no seu consentimento (art. 7º, I, da LGPD), dado ao aceitar este termo, e, quando aplicável, no cumprimento de obrigação legal ou regulatória (art. 7º, II), no exercício regular de direitos (art. 7º, VI) e no legítimo interesse da Faculdade em manter um ambiente seguro (art. 7º, IX).

5. QUEM PODE VER OS SEUS DADOS
• Colegas da sua faculdade veem o seu perfil público (apelido, foto, curso, semestre, disciplinas, interesses e o que você publicar). O seu nome completo, e-mail e data de nascimento não aparecem para eles.
• Mensagens privadas são vistas só por você e pela pessoa com quem você conversa.
• A coordenação da Faculdade pode acessar dados de cadastro e conteúdos denunciados, para moderação e suporte.
• Alunos de outras faculdades não têm acesso aos seus dados.
• Fornecedores de infraestrutura (hospedagem, banco de dados e envio de notificações e e-mails) tratam os dados só para operar o serviço, com obrigação de sigilo. Alguns desses serviços podem ficar fora do Brasil, com as garantias previstas na LGPD.

6. POR QUANTO TEMPO
Os dados ficam guardados enquanto a sua conta existir. Depois que a conta for excluída, os dados são apagados ou anonimizados, exceto os que a lei mandar guardar por mais tempo (como registros de acesso, por 6 meses, conforme o Marco Civil da Internet).

7. SEUS DIREITOS
Você pode, a qualquer momento: confirmar se tratamos os seus dados e acessá-los; corrigir dados incompletos ou errados; pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários; pedir a portabilidade; saber com quem os dados foram compartilhados; e revogar o consentimento (o que pode impedir o uso do Pátio). Muitas dessas ações podem ser feitas no próprio aplicativo; as demais, pelo contato abaixo.

8. SEGURANÇA
A Faculdade e o Pátio adotam medidas para proteger os dados, como senhas cifradas, conexões criptografadas e isolamento entre faculdades. Nenhum sistema é totalmente imune a incidentes; se acontecer algum que possa causar risco, você e a Autoridade Nacional de Proteção de Dados (ANPD) serão avisados.

9. SUAS RESPONSABILIDADES
Use o Pátio com respeito e para fins acadêmicos. Não publique dados pessoais de outras pessoas sem autorização, nem conteúdo ofensivo, discriminatório, ilegal ou que viole direitos autorais. O descumprimento pode levar à suspensão da conta, sem prejuízo das normas disciplinares da Faculdade.

10. CONTATO E ALTERAÇÕES
Dúvidas e pedidos sobre os seus dados devem ser enviados à coordenação da ${nome}, pelos canais oficiais da Faculdade. Este termo pode ser atualizado; quando isso acontecer, a nova versão ficará disponível no aplicativo.`;
}
