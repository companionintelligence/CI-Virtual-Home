// Campaign passthrough: the ad's tags survive the whole visit. A visitor who lands from a social ad arrives with utm_source,
// fbclid and the like in the address; they click from the front page to a family's page to the tour, and then to ci.computer.
// This script keeps those tags and puts them back on the links that leave for the main site, so the click that matters
// carries them.
//
//   What it reads        utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, ttclid, gclid, msclkid, from the
//                        address. A visit that arrives with any of them starts a new set (the last ad wins); a visit without
//                        any uses the set it stored. Nothing else in the address is read or kept.
//   Where it keeps them  sessionStorage under one key, "ci-campaign" (a JSON object of those keys). Every storage call is in a
//                        try/catch: with storage blocked (a private window, an in-app browser) the page still works, and the tags
//                        still ride on this page's links and on the address of the next page, which is read again there.
//   What it rewrites     at run time, in the page's DOM, never in the built HTML (portal:build holds those hrefs to exactly
//                        https://ci.computer, https://ci.computer/core and https://ci.computer/download):
//                          1. every link to https://ci.computer, https://ci.computer/core or https://ci.computer/download
//                             (not the docs, not privacy, not terms, not another host);
//                          2. every relative link (or a full address on this page's own origin) that carries the attribute data-campaign: the front page's cards, the hero's
//                             tour link, a family page's way into the tour, so a campaign survives a click inside the site.
//                        A tag a link already has is left as it is (no double append), and links added or changed later (the
//                        gallery draws cards after it loads) are rewritten as they arrive.
//   What it exports      window.CICampaign = { KEYS, params(), query(), decorate(url), apply(root) } for a script that sets an
//                        address itself. decorate() takes a URL string and returns it with the tags added when it is one of the
//                        links above, or when it is relative.
//
// How a page loads it (the exact tag; the path prefix follows the page's depth, ../ in homes/ and family/, ./ at the root):
//   <script src="./portal/campaign.js" defer data-cfasync="false"></script>
//   <script src="../portal/campaign.js" defer data-cfasync="false"></script>
// It goes BEFORE any script that writes the address (gallery.js), so the tags are read before another script can drop them.
// portal:build adds ?v=<hash of the file> to that src, as it does to every portal script. data-cfasync="false" keeps Cloudflare's
// Rocket Loader from holding it back. A link that should carry the tags on its way into the site is marked data-campaign:
//   <a href="../room-creator?mode=view&amp;house=seraphine&amp;family=brennan" data-campaign>Take the tour</a>
// No imports, no framework, no network: it runs on a page whose other scripts have not come.
(function (global) {
  'use strict';

  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'ttclid', 'gclid', 'msclkid'];
  var STORE_KEY = 'ci-campaign';
  var MAX_VALUE = 300;                              // a click id is about 100 to 150 characters; nothing longer is a tag
  var OUTBOUND_PATHS = ['', '/core', '/download'];  // on https://ci.computer: the main site, the Core, the download

  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var count = function (o) { var n = 0; for (var k in o) if (has(o, k)) n++; return n; };
  var decode = function (s) { try { return decodeURIComponent(String(s).replace(/\+/g, ' ')); } catch (e) { return String(s); } };
  var clean = function (v) { return String(v).replace(/[\u0000-\u001f\u007f]/g, '').replace(/^\s+|\s+$/g, '').slice(0, MAX_VALUE); };

  // the listed keys of a query string ("?a=b&c=d" or "a=b&c=d"), the first of each, as {key: value}
  function pick(search) {
    var out = {};
    var q = String(search || '').replace(/^\?/, '');
    if (!q) return out;
    var pairs = q.split('&');
    for (var i = 0; i < pairs.length; i++) {
      if (!pairs[i]) continue;
      var at = pairs[i].indexOf('=');
      var key = decode(at < 0 ? pairs[i] : pairs[i].slice(0, at));
      if (KEYS.indexOf(key) < 0 || has(out, key)) continue;
      var value = clean(at < 0 ? '' : decode(pairs[i].slice(at + 1)));
      if (value) out[key] = value;
    }
    return out;
  }

  // what a stored object may hold: the listed keys, with string values, cleaned
  function sanitise(o) {
    var out = {};
    if (!o || typeof o !== 'object') return out;
    for (var i = 0; i < KEYS.length; i++) {
      var v = o[KEYS[i]];
      if (typeof v === 'string' && clean(v)) out[KEYS[i]] = clean(v);
    }
    return out;
  }

  function readStore() {
    try {
      var raw = global.sessionStorage.getItem(STORE_KEY);
      return raw ? sanitise(JSON.parse(raw)) : {};
    } catch (e) { return {}; }
  }
  function writeStore(p) {
    try { global.sessionStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) { /* storage is blocked: the address still carries them */ }
  }

  var params = {};
  function init() {
    var fromUrl = pick(global.location && global.location.search);
    if (count(fromUrl)) { params = fromUrl; writeStore(params); } else params = readStore();
    return params;
  }

  function copy(o) { var out = {}; for (var k in o) if (has(o, k)) out[k] = o[k]; return out; }
  function toQuery(p) {
    var out = [];
    for (var i = 0; i < KEYS.length; i++) if (has(p, KEYS[i])) out.push(encodeURIComponent(KEYS[i]) + '=' + encodeURIComponent(p[KEYS[i]]));
    return out.join('&');
  }

  // https://ci.computer, /core or /download, with or without a trailing slash, query or fragment; nothing else
  function isOutbound(href) {
    var m = /^https:\/\/ci\.computer(\/[^?#]*)?(?:[?#]|$)/i.exec(String(href));
    if (!m) return false;
    var path = (m[1] || '').replace(/\/+$/, '').toLowerCase();
    return OUTBOUND_PATHS.indexOf(path) >= 0;
  }
  // a link inside the site: no scheme, not protocol-relative, not a bare fragment; or an absolute one to this page's own origin
  // (the 404 page links the gallery by its full address, because it is served at any depth)
  function isRelative(href) {
    var h = String(href);
    var origin = global.location && global.location.origin;
    if (origin && origin !== 'null' && (h === origin || h.indexOf(origin + '/') === 0 || h.indexOf(origin + '?') === 0)) return true;
    return h !== '' && h.charAt(0) !== '#' && !/^[a-z][a-z0-9+.\-]*:/i.test(h) && h.slice(0, 2) !== '//';
  }

  // href with the tags it does not have yet added to its query (before any fragment); the same string when there is nothing to add
  function add(href, p) {
    href = String(href);
    var hashAt = href.indexOf('#');
    var frag = hashAt < 0 ? '' : href.slice(hashAt);
    var rest = hashAt < 0 ? href : href.slice(0, hashAt);
    var qAt = rest.indexOf('?');
    var path = qAt < 0 ? rest : rest.slice(0, qAt);
    var query = qAt < 0 ? '' : rest.slice(qAt + 1);
    var have = {};
    var pairs = query ? query.split('&') : [];
    for (var i = 0; i < pairs.length; i++) { var eq = pairs[i].indexOf('='); have[decode(eq < 0 ? pairs[i] : pairs[i].slice(0, eq))] = true; }
    var missing = {};
    for (var j = 0; j < KEYS.length; j++) if (has(p, KEYS[j]) && !has(have, KEYS[j])) missing[KEYS[j]] = p[KEYS[j]];
    var extra = toQuery(missing);
    if (!extra) return href;
    return path + '?' + (query ? query + '&' : '') + extra + frag;
  }

  // a URL string, decorated when it leaves for the main site or stays inside this one
  function decorate(url, p) {
    if (typeof url !== 'string') return url;
    p = p || params;
    if (!count(p)) return url;
    return isOutbound(url) || isRelative(url) ? add(url, p) : url;
  }

  function fix(a) {
    if (!a || !a.getAttribute || String(a.nodeName).toUpperCase() !== 'A') return;
    var href = a.getAttribute('href');
    if (href == null) return;
    var wanted = isOutbound(href) || (isRelative(href) && a.hasAttribute && a.hasAttribute('data-campaign'));
    if (!wanted) return;
    var next = add(href, params);
    if (next !== href) a.setAttribute('href', next);
  }

  function apply(root) {
    if (!count(params) || !root) return;
    if (root.matches && root.matches('a[href]')) fix(root);
    var list = root.querySelectorAll ? root.querySelectorAll('a[href]') : [];
    for (var i = 0; i < list.length; i++) fix(list[i]);
  }

  function watch() {
    if (typeof global.MutationObserver !== 'function') return;
    var doc = global.document;
    new global.MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === 'attributes') { fix(r.target); continue; }
        for (var j = 0; j < (r.addedNodes ? r.addedNodes.length : 0); j++) if (r.addedNodes[j].nodeType === 1) apply(r.addedNodes[j]);
      }
    }).observe(doc.documentElement || doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  }
  // a click, a middle click and a long press read the link's href when they happen: set it right before, whatever changed it
  function wireClicks() {
    var doc = global.document;
    var handler = function (e) {
      var t = e.target;
      while (t && t.nodeType === 1 && String(t.nodeName).toUpperCase() !== 'A') t = t.parentNode;
      if (t && t.nodeType === 1) fix(t);
    };
    ['click', 'auxclick', 'contextmenu', 'touchstart'].forEach(function (ev) { doc.addEventListener(ev, handler, { capture: true, passive: true }); });
  }

  function start() {
    init();
    var doc = global.document;
    if (!doc || !count(params)) return;     // an organic visit: nothing to carry, nothing to watch
    var run = function () { apply(doc); watch(); wireClicks(); };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', run); else run();
  }

  global.CICampaign = {
    KEYS: KEYS.slice(),
    params: function () { return copy(params); },
    query: function () { return toQuery(params); },
    decorate: function (url) { return decorate(url, params); },
    apply: apply,
    // for the tests (scripts/test-campaign.mts): the pure pieces
    _pick: pick, _add: add, _isOutbound: isOutbound, _isRelative: isRelative,
  };
  start();
})(typeof globalThis !== 'undefined' ? globalThis : window);
