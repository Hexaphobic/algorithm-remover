// Shared helpers for both sites. Injected first, at document_start.
// Meta ships hashed/rotating class names, so nothing here selects by class —
// only by page path, element role, href, and visible text.
(function () {
  const IAR = (window.__IAR__ = {});

  // Tag the <html> element with the current logical page so CSS can react.
  // documentElement exists at document_start, so this beats the first paint.
  IAR.setPage = function (name) {
    document.documentElement.dataset.iarPage = name;
  };

  // Run cb() now and on every SPA navigation (Instagram/Facebook are single-page
  // apps — most "page changes" are history.pushState calls, not real loads).
  IAR.onUrlChange = function (cb) {
    let last = location.href;
    const fire = () => { last = location.href; cb(); };
    for (const m of ["pushState", "replaceState"]) {
      const orig = history[m];
      history[m] = function () {
        const r = orig.apply(this, arguments);
        queueMicrotask(fire);
        return r;
      };
    }
    window.addEventListener("popstate", fire);
    // Fallback: some in-app nav swaps the URL without a history event.
    const mo = new MutationObserver(() => {
      if (location.href !== last) fire();
    });
    const startMo = () => mo.observe(document.documentElement, { subtree: true, childList: true });
    if (document.body) startMo(); else addEventListener("DOMContentLoaded", startMo);
    cb();
  };

  // Run cb() now, on throttled DOM changes, and on a slow interval. This is how
  // feed units get hidden as they stream in and how the reels scroller (which
  // appears after the <video> loads) gets caught.
  IAR.onTick = function (cb) {
    let queued = false;
    const run = () => { queued = false; try { cb(); } catch (e) {} };
    const schedule = () => { if (!queued) { queued = true; setTimeout(run, 200); } };
    const mo = new MutationObserver(schedule);
    const startMo = () => mo.observe(document.documentElement, { subtree: true, childList: true });
    if (document.body) startMo(); else addEventListener("DOMContentLoaded", startMo);
    setInterval(run, 1000); // ponytail: cheap safety net; drop if the observer proves enough
    run();
  };

  // Hide feed units that carry a needle as a SHORT, standalone label (e.g. a
  // "Sponsored" / "Suggested for you" header) — never a needle merely buried in
  // a friend's caption or comment, which would wrongly hide a wanted post.
  // Collapsed, not removed: removing nodes confuses Meta's virtualized scroller.
  IAR.hideByText = function (units, needles) {
    for (const el of units) {
      if (el.getAttribute("data-iar-hidden") === "1") continue;
      if (hasLabel(el, needles)) el.setAttribute("data-iar-hidden", "1");
    }
  };
  function hasLabel(unit, needles) {
    for (const n of unit.querySelectorAll("span, a, h1, h2, h3, h4, div")) {
      const t = (n.textContent || "").trim();
      if (!t) continue;
      for (const needle of needles) {
        // Short element that starts with the label ⇒ it's the label itself,
        // not prose that happens to contain the word.
        if (t.length <= needle.length + 6 && t.startsWith(needle)) return true;
      }
    }
    return false;
  }

  // Enforce a non-algorithmic home URL. Returns true if it triggered a redirect
  // (caller should stop). hasParam=true means we're already on the good view →
  // clear the counter and do nothing. A sessionStorage loop-breaker (max 3
  // redirects / 5s) guards against a pathological site that keeps stripping the
  // param — after that it gives up and lets the hide-pass do what it can.
  IAR.enforceHome = function (targetUrl, hasParam) {
    const key = "iar_home_redirect";
    if (hasParam) { try { sessionStorage.removeItem(key); } catch (e) {} return false; }
    let rec = null;
    try { rec = JSON.parse(sessionStorage.getItem(key)); } catch (e) {}
    const now = Date.now();
    if (!rec || now - rec.t > 5000) rec = { n: 0, t: now };
    if (rec.n >= 3) return false;
    rec.n++;
    try { sessionStorage.setItem(key, JSON.stringify(rec)); } catch (e) {}
    location.replace(targetUrl);
    return true;
  };
})();
