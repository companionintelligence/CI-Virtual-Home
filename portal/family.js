// A family's page (family/<slug>): the one enhancement it makes. The page is whole without this file: every word is in the HTML, the person nav is a
// row of plain links, a screenshot is a link to the picture itself (portal/shots.js opens it larger) and "More about this moment" is a native <details>.
//
// The person nav follows the scroll. The chip of the person whose section is on screen gets aria-current="location"; a phone's row of chips scrolls
// sideways to keep it in view. It changes colour only, never size, so nothing shifts.
//
// Plain script, no imports, nothing here asks the network for anything.
(function () {
  'use strict';
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var nav = document.querySelector('.who-nav');
  if (nav && 'IntersectionObserver' in window) {
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var sections = Object.keys(byId).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var current = '';
    var list = nav.querySelector('ul');
    var show = function (id) {
      if (id === current) return;
      current = id;
      links.forEach(function (a) { if (a === byId[id]) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
      var a = byId[id];
      // (a phone shows a few chips at a time: bring the current one in, along the row only; the page is not moved)
      if (a && list && list.scrollWidth > list.clientWidth + 1) {
        var left = a.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft - (list.clientWidth - a.offsetWidth) / 2;
        try { list.scrollTo({ left: Math.max(0, left), behavior: reduced ? 'auto' : 'smooth' }); } catch (e) { list.scrollLeft = Math.max(0, left); }
      }
    };
    var io = null;
    // The reference line is a little under the bars (the site header and this nav, stuck): the person whose section holds that line is the one being read. The
    // observer's root is a band two pixels high at that line, so a section intersects it exactly while it holds the line; between two sections nothing does and
    // the last one stays. Above the first person nothing is current. Made again when the window changes size.
    var watch = function () {
      if (io) io.disconnect();
      var head = document.querySelector('.site-head');
      var line = Math.round((head ? head.getBoundingClientRect().height : 56) + nav.getBoundingClientRect().height + 40);
      var below = Math.max(0, window.innerHeight - line - 2);
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) show(e.target.id); });
        if (sections.length && sections[0].getBoundingClientRect().top > line) { current = ''; links.forEach(function (a) { a.removeAttribute('aria-current'); }); }
      }, { rootMargin: '-' + line + 'px 0px -' + below + 'px 0px', threshold: 0 });
      sections.forEach(function (s) { io.observe(s); });
    };
    watch();
    var timer = 0;
    window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(watch, 150); });
  }
})();
