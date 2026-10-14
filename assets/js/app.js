function topo() {
	window.scrollTo(0, 0);
	const content = document.querySelector('.ov-content');
	if (content) content.scrollTop = 0;
}

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
}

// Este arquivo é carregado por último: todas as telas e ações já estão disponíveis.
load();
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