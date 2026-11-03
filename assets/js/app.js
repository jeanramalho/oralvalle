function topo() {
	window.scrollTo(0, 0);
	const content = document.querySelector('.ov-content');
	if (content) content.scrollTop = 0;
}

// Guarda somente o contexto de navegação desta aba (nunca dados clínicos).
const OV_NAV_KEY = 'oralvalle:navigation:v1';
function ovSaveNavigation() {
  if (LOCKED || !ME) return;
  try {
    const state = { h: view.h, id: view.id, tab: view.tab, agDate: view.agDate,
      sv: view.sv, ag: view.ag, // A pesquisa de pacientes não é armazenada na sessão.
      clinicId: window.OralCloud?.clinicId || null, userId: ME.id || null };
    sessionStorage.setItem(OV_NAV_KEY, JSON.stringify(state));
  } catch (_) {}
}
function ovRestoreNavigation() {
  // Ao entrar no sistema, abrir sempre a Agenda, sem restaurar paciente/aba anterior.
  view.id = null;
  view.h = 'ag';
  q = '';
}
window.addEventListener('pagehide', ovSaveNavigation);
function render() {
	applyTheme();
	if (LOCKED) return;
	sanitizeView();
	// Não conservar o último nome quando sair da lista de pacientes.
	if (view.id || view.h !== 'pac') q = '';

	const sidebar = document.querySelector('.ov-sidebar');
	const content = document.querySelector('.ov-content');
	const sidebarScroll = sidebar ? sidebar.scrollTop : 0;
	const contentScroll = content ? content.scrollTop : 0;
	const body = view.id
		? `<div class="ov-content-inner ov-patient-wrap">${patient()}</div>`
		: home();

	$('app').innerHTML = ovShell(body, view.id ? 'pac' : (view.h || 'pac'));
	initSig();
	initEvolSig();
	removerConfirmacaoAutomatica();
	fmtMoney(document);

	// A reconstrução da tela não deve perder a posição de leitura.
	const nextSidebar = document.querySelector('.ov-sidebar');
	const nextContent = document.querySelector('.ov-content');
	if (nextSidebar) nextSidebar.scrollTop = sidebarScroll;
	if (nextContent) nextContent.scrollTop = contentScroll;
	applyRO();
	ovSaveNavigation();
}

// Este arquivo é carregado por último: todas as telas e ações já estão disponíveis.
if (!window.OralCloud?.enabled) load();
authBoot();

document.addEventListener('toggle', (event) => {
	if (event.target && event.target.id === 'avsBox') view.avsOpen = event.target.open;
}, true);

avsTickStart();
setTimeout(avsCheck, 2500);
document.addEventListener('visibilitychange', () => {
	if (!document.hidden) avsCheck();
});
window.addEventListener('focus', avsCheck);

// A limpeza da navegação ocorre uma única vez em render();
// Não observar todo o prontuário: mutações frequentes podem bloquear a interface.

if (window.claude && claude.use) {
	claude.use('downloads').then((downloads) => {
		dl = downloads || null;
		if (dl && view.h === 'bk' && !view.id) render();
	}).catch(() => {});
}
// Navegação móvel: usa delegação para sobreviver aos renders da aplicação.
document.addEventListener('click', function(e) {
  const toggle=e.target.closest('.ov-mobile-menu');
  const nav=document.getElementById('oral-mobile-nav');
  if(toggle && nav){
    const opened=nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(opened));
    toggle.innerHTML=opened?'✕ <span>Fechar</span>':'☰ <span>Menu</span>';
    return;
  }
  if(nav && nav.classList.contains('is-open') && (e.target.closest('.ov-mobile-nav .ov-nav-btn') || !e.target.closest('.ov-mobile-nav'))){
    nav.classList.remove('is-open');
    const btn=document.querySelector('.ov-mobile-menu');
    if(btn){btn.setAttribute('aria-expanded','false');btn.innerHTML='☰ <span>Menu</span>';}
  }
});
