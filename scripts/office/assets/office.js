// /office: the one enhancement the page makes (reference/office/office-contract-m0.md). The page is whole without this file: every card is in the HTML, and the search and the filters
// are switched on here. The state lives in the address (?q=&size=&fn=), and every other parameter of the address (a campaign's tags) is kept byte for byte. A button that would show nothing
// is disabled unless it is the one pressed. Plain script, no imports, nothing here asks the network for anything. The pure parts are exported as window.CIOffice for scripts/test-office-front.mts.
(function () {
  'use strict';
  var KEYS = ['q', 'size', 'fn'];
  var ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  // a count in words (a digit is never on this site's pages)
  function word(n) { return n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '') : String(n); }
  function decode(v) { try { return decodeURIComponent(String(v).replace(/\+/g, ' ')); } catch (e) { return String(v); } }
  function split(search) { return String(search || '').replace(/^\?/, '').split('&').filter(Boolean); }
  function keyOf(kv) { var i = kv.indexOf('='); return decode(i < 0 ? kv : kv.slice(0, i)); }

  /** the state an address carries: the first value of each of q, size and fn */
  function parseState(search) {
    var s = { q: '', size: '', fn: '' };
    split(search).forEach(function (kv) {
      var k = keyOf(kv);
      if (KEYS.indexOf(k) >= 0 && !s[k]) { var i = kv.indexOf('='); s[k] = i < 0 ? '' : decode(kv.slice(i + 1)); }
    });
    return s;
  }
  /** the address with this state in it: the parameters that are not ours stay as they were, in their order; ours follow */
  function writeSearch(search, state) {
    var kept = split(search).filter(function (kv) { return KEYS.indexOf(keyOf(kv)) < 0; });
    KEYS.forEach(function (k) { if (state[k]) kept.push(k + '=' + encodeURIComponent(state[k])); });
    return kept.length ? '?' + kept.join('&') : '';
  }
  function words(q) { return String(q || '').toLowerCase().split(/\s+/).filter(Boolean); }
  /** does the card (find, size, fn[]) show for the state? `skip` leaves one filter out (to count what a button would show) */
  function matches(card, state, skip) {
    if (skip !== 'q') { var w = words(state.q); for (var i = 0; i < w.length; i++) if (card.find.indexOf(w[i]) < 0) return false; }
    if (skip !== 'size' && state.size && card.size !== state.size) return false;
    if (skip !== 'fn' && state.fn && card.fn.indexOf(state.fn) < 0) return false;
    return true;
  }

  function init() {
    var grid = document.getElementById('grid');
    if (!grid) return;
    var cards = Array.prototype.map.call(grid.querySelectorAll('li.card'), function (li) {
      return { el: li, find: li.getAttribute('data-find') || '', size: li.getAttribute('data-size') || '', fn: (li.getAttribute('data-fn') || '').split(/\s+/).filter(Boolean) };
    });
    var input = document.getElementById('q'), live = document.getElementById('live'), empty = document.getElementById('empty');
    var clear = document.getElementById('clear'), clearEmpty = document.getElementById('clear-empty');
    var sizes = Array.prototype.slice.call(document.querySelectorAll('#sizes button')), jobs = Array.prototype.slice.call(document.querySelectorAll('#jobs button'));
    var present = function (list, attr) { return list.map(function (b) { return b.getAttribute(attr); }).filter(Boolean); };
    var state = parseState(window.location.search);
    // a value the page does not offer is not a filter
    if (state.size && present(sizes, 'data-size').indexOf(state.size) < 0) state.size = '';
    if (state.fn && present(jobs, 'data-fn').indexOf(state.fn) < 0) state.fn = '';
    if (input) input.value = state.q;

    function render() {
      var shown = 0;
      cards.forEach(function (c) { var ok = matches(c, state); c.el.hidden = !ok; if (ok) shown++; });
      var active = !!(state.q.trim() || state.size || state.fn);
      if (live) live.textContent = active ? (shown ? 'Showing ' + word(shown) + ' of ' + word(cards.length) : '') : '';
      if (empty) empty.hidden = shown > 0;
      if (clear) clear.hidden = !active;
      grid.hidden = shown === 0;
      sizes.forEach(function (b) {
        var v = b.getAttribute('data-size') || '', pressed = v === state.size;
        b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
        b.disabled = !pressed && !!v && !cards.some(function (c) { return c.size === v && matches(c, state, 'size'); });
      });
      jobs.forEach(function (b) {
        var v = b.getAttribute('data-fn') || '', pressed = v === state.fn;
        b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
        b.disabled = !pressed && !cards.some(function (c) { return c.fn.indexOf(v) >= 0 && matches(c, state, 'fn'); });
      });
      if (input) input.disabled = false;
      try { window.history.replaceState(null, '', window.location.pathname + writeSearch(window.location.search, state) + window.location.hash); } catch (e) { /* a sandboxed frame: the filter still works */ }
    }
    function reset() { state = { q: '', size: '', fn: '' }; if (input) input.value = ''; render(); }

    if (input) input.addEventListener('input', function () { state.q = input.value; render(); });
    sizes.forEach(function (b) { b.addEventListener('click', function () { state.size = b.getAttribute('data-size') || ''; render(); }); });
    jobs.forEach(function (b) { b.addEventListener('click', function () { state.fn = state.fn === b.getAttribute('data-fn') ? '' : (b.getAttribute('data-fn') || ''); render(); }); });
    if (clear) clear.addEventListener('click', reset);
    if (clearEmpty) clearEmpty.addEventListener('click', reset);
    document.addEventListener('keydown', function (e) {
      var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && input) { e.preventDefault(); input.focus(); }
      else if (e.key === 'Escape' && t === input && input.value) { input.value = ''; state.q = ''; render(); }
    });
    document.documentElement.setAttribute('data-office', '');
    render();
  }

  window.CIOffice = { parseState: parseState, writeSearch: writeSearch, matches: matches, word: word };
  if (typeof document !== 'undefined' && document.getElementById) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  }
})();
