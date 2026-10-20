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
//   Link rules           portal/campaign.json (read by the tests below and by this script with one same-origin fetch, next to this file) is
//                        a short, authored list of run-time link mappings: {match, to, from, until}. It is how the owner can point
//                        https://ci.computer/core (Buy Companion Core) at another address for a while WITHOUT the built pages changing
//                        (they keep the four sanctioned addresses, portal:build checks it). The list ships EMPTY: with no rule nothing
//                        is mapped and no extra work is done. A rule applies on the days from..until (UTC dates, both ends included),
//                        so a stale one stops on its own, and portal:build refuses a rule that has expired or runs more than 180 days.
//                        `match` is one of the three sanctioned addresses and nothing else: the docs, privacy and terms links are
//                        never touched. `to` is an https address that is not itself one of the three. The link's own query and
//                        fragment are kept on the new address; the visitor's campaign tags are added to it when it is on ci.computer
//                        (a campaign's click ids are not sent to another host). A link is mapped when this script runs, as it
//                        arrives and at click time, so a link the player draws later is mapped too; before the file is read, or if
//                        it cannot be read, the link is as built. Nothing but an active, valid rule changes a link.
//   What it exports      window.CICampaign = { KEYS, params(), query(), decorate(url), apply(root), validate(data, today) } for a script
//                        that sets an address itself. decorate() takes a URL string and returns it with the tags added when it is one
//                        of the links above, or when it is relative (and mapped first when a rule says so). validate() is the strict
//                        check portal:build holds portal/campaign.json to (a list of problem strings; empty is valid).
//
// How a page loads it (the exact tag; the path prefix follows the page's depth, ../ in homes/ and family/, ./ at the root):
//   <script src="./portal/campaign.js" defer data-cfasync="false"></script>
//   <script src="../portal/campaign.js" defer data-cfasync="false"></script>
// It goes BEFORE any script that writes the address (gallery.js), so the tags are read before another script can drop them.
// portal:build adds ?v=<hash of the file> to that src, as it does to every portal script. data-cfasync="false" keeps Cloudflare's
// Rocket Loader from holding it back. A link that should carry the tags on its way into the site is marked data-campaign:
//   <a href="../room-creator?mode=view&amp;house=seraphine&amp;family=brennan" data-campaign>Take the tour</a>
// The player (room-creator.html?mode=view) loads it too: portal:build adds the same tag to that page's head (the source page is the editor's
// and is not touched), and the end card, the About panel and the header, which the player draws after the page loads, are tagged by the
// MutationObserver and, at the latest, when the link is clicked.
// No imports, no framework; its only request is the one same-origin portal/campaign.json (a failure is ignored): it runs on a page whose
// other scripts have not come.
(function (global) {
  'use strict';

  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'ttclid', 'gclid', 'msclkid'];
  var STORE_KEY = 'ci-campaign';
  var MAX_VALUE = 300;                              // a click id is about 100 to 150 characters; nothing longer is a tag
  var OUTBOUND_PATHS = ['', '/core', '/download'];  // on https://ci.computer: the main site, the Core, the download
  var RULE_KEYS = ['match', 'to', 'from', 'until'];
  var MAX_RULES = 20;
  var MAX_DAYS = 180;                               // a rule may run this long at most: nothing outlives its decision by being forgotten
  var MAX_TO = 2000;
  var DAY_MS = 86400000;

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

  var SCRIPT_SRC = (function () { try { var c = global.document && global.document.currentScript; return c && c.src ? String(c.src) : ''; } catch (e) { return ''; } })();
  var rules = [];     // the active, valid rules of portal/campaign.json (empty until it is read, and when it holds none)

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

  // ---- link rules (portal/campaign.json) ----
  function isDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var t = Date.parse(s + 'T00:00:00Z');
    return t === t && new Date(t).toISOString().slice(0, 10) === s;
  }
  function today() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return ''; } }
  // https://ci.computer plus the path as isOutbound reads it: the key two spellings of one link share
  function outboundKey(href) {
    var m = /^https:\/\/ci\.computer(\/[^?#]*)?(?:[?#]|$)/i.exec(String(href));
    return m ? 'https://ci.computer' + (m[1] || '').replace(/\/+$/, '').toLowerCase() : '';
  }
  // null when the rule is well formed, else what is wrong with it (the window is judged apart: ruleActive)
  function ruleProblem(r) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return 'is not an object';
    for (var k in r) if (has(r, k) && RULE_KEYS.indexOf(k) < 0) return 'has an unknown key "' + k + '"';
    if (typeof r.match !== 'string' || !isOutbound(r.match)) return '"match" must be https://ci.computer, https://ci.computer/core or https://ci.computer/download (the docs, privacy and terms links are never mapped)';
    if (typeof r.to !== 'string' || !/^https:\/\/[^\s\u0000-\u001f\u007f\/?#@]+([\/?#][^\s\u0000-\u001f\u007f]*)?$/.test(r.to) || r.to.length > MAX_TO) return '"to" must be one https address with no spaces';
    if (isOutbound(r.to)) return '"to" must not be one of the three sanctioned addresses (a link is mapped once)';
    if (!isDate(r.from) || !isDate(r.until)) return '"from" and "until" must be real YYYY-MM-DD dates';
    if (r.until < r.from) return '"until" is before "from"';
    if ((Date.parse(r.until + 'T00:00:00Z') - Date.parse(r.from + 'T00:00:00Z')) / DAY_MS > MAX_DAYS) return 'runs more than ' + MAX_DAYS + ' days (shorten it, or renew it on purpose)';
    return null;
  }
  function ruleActive(r, day) { return !!day && r.from <= day && day <= r.until; }
  // the rules of a parsed campaign.json that hold today: anything unreadable or out of its window is ignored, never an error
  function activeRules(data, day) {
    var out = [];
    if (!data || typeof data !== 'object' || data.version !== 1 || !Array.isArray(data.rules)) return out;
    for (var i = 0; i < data.rules.length && i < MAX_RULES; i++) {
      var r = data.rules[i];
      if (ruleProblem(r) === null && ruleActive(r, day)) out.push({ key: outboundKey(r.match), to: r.to });
    }
    return out;
  }
  // the strict check for portal:build: every problem as a string; a rule that has expired is a problem (remove it), so a stale rule fails the build
  function validate(data, day) {
    var out = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) return ['portal/campaign.json is not an object'];
    for (var k in data) if (has(data, k) && k !== 'version' && k !== 'rules') out.push('portal/campaign.json has an unknown key "' + k + '"');
    if (data.version !== 1) out.push('portal/campaign.json: "version" must be 1');
    if (!Array.isArray(data.rules)) return out.concat('portal/campaign.json: "rules" must be a list');
    if (data.rules.length > MAX_RULES) out.push('portal/campaign.json: more than ' + MAX_RULES + ' rules');
    for (var i = 0; i < data.rules.length; i++) {
      var r = data.rules[i], bad = ruleProblem(r), at = 'portal/campaign.json rule ' + (i + 1) + ' ';
      if (bad) { out.push(at + bad); continue; }
      if (r.until < day) out.push(at + 'expired on ' + r.until + ': remove it (or renew it on purpose)');
      for (var j = 0; j < i; j++) {
        var q = data.rules[j];
        if (ruleProblem(q) === null && outboundKey(q.match) === outboundKey(r.match) && q.from <= r.until && r.from <= q.until) out.push(at + 'overlaps rule ' + (j + 1) + ' on the same address');
      }
    }
    return out;
  }
  // href mapped by the first active rule for its address; the link's own query and fragment ride along. The same string without a rule.
  function mapHref(href) {
    if (!rules.length || typeof href !== 'string' || !isOutbound(href)) return href;
    var key = outboundKey(href);
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].key !== key) continue;
      var hashAt = href.indexOf('#'), frag = hashAt < 0 ? '' : href.slice(hashAt);
      var rest = hashAt < 0 ? href : href.slice(0, hashAt), qAt = rest.indexOf('?'), query = qAt < 0 ? '' : rest.slice(qAt + 1);
      var to = rules[i].to, toHash = to.indexOf('#'), toFrag = toHash < 0 ? '' : to.slice(toHash);
      var toRest = toHash < 0 ? to : to.slice(0, toHash);
      return toRest + (query ? (toRest.indexOf('?') < 0 ? '?' : '&') + query : '') + (toFrag || frag);
    }
    return href;
  }
  var onCiComputer = function (href) { return /^https:\/\/ci\.computer(?:[\/?#]|$)/i.test(String(href)); };

  // what a link should read: mapped by a rule, then given the visitor's tags when it stays on ci.computer (a mapped link to another host
  // gets none), or when it is one of the links above / a relative one the page marked (relativeOk)
  function rewrite(href, p, relativeOk) {
    var mapped = mapHref(href);
    if (mapped === href) return isOutbound(href) || (relativeOk && isRelative(href)) ? add(href, p) : href;
    return onCiComputer(mapped) ? add(mapped, p) : unTag(mapped);
  }
  // href without the campaign's keys in its query: a link that was tagged before a rule sent it to another host must not take the click ids along
  function unTag(href) {
    var hashAt = href.indexOf('#'), frag = hashAt < 0 ? '' : href.slice(hashAt), rest = hashAt < 0 ? href : href.slice(0, hashAt), qAt = rest.indexOf('?');
    if (qAt < 0) return href;
    var keep = rest.slice(qAt + 1).split('&').filter(function (pair) { var eq = pair.indexOf('='); return pair && KEYS.indexOf(decode(eq < 0 ? pair : pair.slice(0, eq))) < 0; });
    return rest.slice(0, qAt) + (keep.length ? '?' + keep.join('&') : '') + frag;
  }

  // a URL string, decorated when it leaves for the main site or stays inside this one
  function decorate(url, p) {
    if (typeof url !== 'string') return url;
    p = p || params;
    if (!count(p) && !rules.length) return url;
    return rewrite(url, p, true);
  }

  function fix(a) {
    if (!a || !a.getAttribute || String(a.nodeName).toUpperCase() !== 'A') return;
    var href = a.getAttribute('href');
    if (href == null) return;
    var next = rewrite(href, params, !!(a.hasAttribute && a.hasAttribute('data-campaign')));
    if (next !== href) a.setAttribute('href', next);
  }

  function apply(root) {
    if ((!count(params) && !rules.length) || !root) return;
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

  // portal/campaign.json, next to this script: one same-origin request, ignored when it fails; the page is as built until a valid, active rule arrives
  function loadRules(done) {
    var base = SCRIPT_SRC.replace(/[?#].*$/, '');
    if (!/campaign\.js$/.test(base) || typeof global.fetch !== 'function') return;
    try {
      global.fetch(base.replace(/campaign\.js$/, 'campaign.json'), { credentials: 'omit' })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (data) { var list = activeRules(data, today()); if (list.length) { rules = list; done(); } })
        .catch(function () { /* no rules: the links stay as built */ });
    } catch (e) { /* the same */ }
  }

  function start() {
    init();
    var doc = global.document;
    if (!doc) return;
    var started = false;
    var run = function () { apply(doc); if (!started) { started = true; watch(); wireClicks(); } };
    var ready = function () { if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', run); else run(); };
    if (count(params)) ready();          // an organic visit has nothing to carry and nothing to watch, until a rule says otherwise
    loadRules(ready);
  }

  global.CICampaign = {
    KEYS: KEYS.slice(),
    params: function () { return copy(params); },
    query: function () { return toQuery(params); },
    decorate: function (url) { return decorate(url, params); },
    apply: apply,
    validate: validate,
    // for the tests (scripts/test-campaign.mts): the pure pieces
    _pick: pick, _add: add, _isOutbound: isOutbound, _isRelative: isRelative, _activeRules: activeRules,
  };
  start();
})(typeof globalThis !== 'undefined' ? globalThis : window);
