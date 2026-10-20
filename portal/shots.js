// A real screenshot, larger. Every screenshot on a page is a link to the picture itself (<a data-shot href="...">) with its caption in the <figure>; without this
// file a click opens the picture on its own. With it, the click opens the page's native <dialog id="shot-dialog"> with the same picture, its caption and a link
// to the file at full size (a phone shows 960 px pictures small). Esc closes the dialog (the browser's own), so does the Close button and a click on the dark
// area; focus goes back to the link that opened it. A click with a modifier key keeps the link's own meaning (a new tab). Used by the front page and by a
// family's page. Plain script, no imports; nothing here asks the network for anything but the picture the link already names.
(function () {
  'use strict';
  var dlg = document.getElementById('shot-dialog');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  var fig = dlg.querySelector('.shot-dialog-fig');
  var cap = dlg.querySelector('.shot-dialog-cap');
  var full = dlg.querySelector('.shot-full');
  var closeBtn = dlg.querySelector('.shot-close');
  var opener = null;
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-shot]') : null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var img = a.querySelector('img');
    var figure = a.closest('figure');
    var caption = figure && figure.querySelector('figcaption');
    if (!img) return;
    e.preventDefault();
    opener = a;
    var big = document.createElement('img');
    big.src = a.getAttribute('href');
    big.alt = img.getAttribute('alt') || '';
    big.width = Number(img.getAttribute('width')) || 960;
    big.height = Number(img.getAttribute('height')) || 540;
    fig.replaceChildren(big);
    cap.textContent = caption ? caption.textContent : '';
    full.setAttribute('href', a.getAttribute('href'));
    dlg.showModal();
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  });
  closeBtn.addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', function () {
    fig.replaceChildren();
    if (opener && document.contains(opener)) { try { opener.focus({ preventScroll: true }); } catch (err) { /* gone */ } }
    opener = null;
  });
})();
