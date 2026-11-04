export const CHAVE_TEMA = 'patio.painel.tema';
export const EVENTO_TEMA = 'patio:tema';

/**
 * Roda no <head>, antes da página aparecer: aplica o tema salvo (ou o do sistema)
 * para não piscar branco no escuro, e acompanha a troca de tema do sistema.
 */
export const SCRIPT_TEMA = `(function(){try{
var d=document.documentElement,m=matchMedia('(prefers-color-scheme: dark)');
function aplicar(){var p=localStorage.getItem('${CHAVE_TEMA}')||'sistema';
d.dataset.preferencia=p;d.dataset.tema=p==='sistema'?(m.matches?'escuro':'claro'):p;}
aplicar();m.addEventListener('change',aplicar);window.addEventListener('${EVENTO_TEMA}',aplicar);
}catch(e){}})();`;
