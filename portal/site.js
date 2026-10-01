// Shared by every page of the site: the phone's menu. Nothing else, and nothing here asks the network for anything.
const head = document.querySelector('.site-head');
const btn = head && head.querySelector('.menu-btn');
if (head && btn) {
  const set = (on) => {
    if (on) head.setAttribute('data-open', ''); else head.removeAttribute('data-open');
    btn.setAttribute('aria-expanded', String(on));
  };
  btn.addEventListener('click', () => set(!head.hasAttribute('data-open')));
  head.addEventListener('keydown', (e) => { if (e.key === 'Escape' && head.hasAttribute('data-open')) { set(false); btn.focus(); } });
  // choosing a destination closes the menu; so does leaving it
  head.querySelector('.site-nav').addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('click', (e) => { if (head.hasAttribute('data-open') && !head.contains(e.target)) set(false); });
}
