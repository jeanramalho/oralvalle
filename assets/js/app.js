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
      sv: view.sv, ag: view.ag, q: typeof q === 'string' ? q : '',
      clinicId: window.OralCloud?.clinicId || null, userId: ME.id || null };
    sessionStorage.setItem(OV_NAV_KEY, JSON.stringify(state));
  } catch (_) {}
}
function ovRestoreNavigation() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(OV_NAV_KEY) || 'null');
    if (!saved || saved.clinicId !== (window.OralCloud?.clinicId || null) || saved.userId !== (ME?.id || null)) return;
    if (typeof saved.h === 'string' && saved.h.length < 24) view.h = saved.h;
    if (saved.id != null && db.p.some(p => String(p.id) === String(saved.id))) view.id = saved.id;
    if (typeof saved.tab === 'string' && saved.tab.length < 32) view.tab = saved.tab;
    if (typeof saved.agDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.agDate)) view.agDate = saved.agDate;
    if (typeof saved.sv === 'string') view.sv = saved.sv;
    if (typeof saved.ag === 'string') view.ag = saved.ag;
    if (typeof saved.q === 'string') q = saved.q.slice(0, 150);
  } catch (_) {}
}
window.addEventListener('pagehide', ovSaveNavigation);
function render() {
	applyTheme();
	if (LOCKED) return;
	sanitizeView();

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

new MutationObserver(() => removerConfirmacaoAutomatica()).observe(document.body, {
	childList: true,
	subtree: true,
});

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
