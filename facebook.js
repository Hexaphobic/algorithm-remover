// Facebook. Strategy: redirect home to Facebook's own chronological "Feeds"
// view (friends + pages + groups you follow, no algorithmic injection), then
// hide the sponsored ads and suggested/reels/PYMK units that still inject.
(function () {
  const IAR = window.__IAR__;

  IAR.ifEnabled(function () {
    // --- 1. Redirect the algorithmic home feed to the chronological Feeds view
    const HOME_URL = "https://www.facebook.com/?sk=h_chr";
    const isHome = () => location.pathname === "/" || location.pathname === "/home.php";
    const onChrono = () => new URLSearchParams(location.search).get("sk") === "h_chr";

    // Fires at document_start and re-applies on soft-nav to Home. Facebook's
    // sk=h_chr is non-sticky (reverts to Top Stories otherwise), so re-enforcing
    // it on every Home visit is what keeps the feed chronological.
    if (isHome() && IAR.enforceHome(HOME_URL, onChrono())) return;

    IAR.onUrlChange(() => {
      IAR.setPage(isHome() ? "home" : "other");
      if (isHome()) IAR.enforceHome(HOME_URL, onChrono());
    });

    // ponytail: English-UI labels for the non-ad junk units. These render as
    // plain text; "Sponsored" does NOT — Facebook obfuscates it (decoy letters
    // that CSS renders as "Sponsored"), so ads are matched by ad-rendering markup.
    const TEXT_NEEDLES = ["Suggested for you", "Suggested for You", "People you may know", "People You May Know", "Reels and short videos", "Suggested Groups"];

    // A feed post is the direct child of the one many-child container (the feed
    // column) that is roughly the feed width. Found structurally because Facebook
    // strips every stable role / class / pagelet hook from feed units — verified
    // live: no [role=feed], no aria-posinset, no data-pagelet, empty [role=article].
    function feedCard(node) {
      let el = node;
      while (el && el.parentElement) {
        const p = el.parentElement;
        if (p.children.length >= 5 && el.getBoundingClientRect().width >= 400) return el;
        el = p;
      }
      return null;
    }
    function hideCard(anchor) {
      const card = feedCard(anchor);
      if (card && card.getAttribute("data-iar-hidden") !== "1") card.setAttribute("data-iar-hidden", "1");
    }

    // --- 2. Hide junk — HOME feed ONLY, so Groups/Events/profiles/search (where
    // these words legitimately appear) are never touched.
    IAR.onTick(() => {
      if (document.documentElement.dataset.iarPage !== "home") return;
      // Sponsored ads: identified by a call-to-action ad role ("Shop now" etc.),
      // which organic friend posts never carry — verified live that this hides the
      // ad card and spares friend posts. ponytail: FB-internal attribute; the
      // bulletproof route is reading the React `category` prop via a MAIN-world
      // script (see README) — deferred, add if these markers ever disappear.
      document.querySelectorAll('[data-ad-rendering-role^="cta"]').forEach(hideCard);
      // Suggested / People-you-may-know / Reels headers (plain text; rare on the
      // chronological feed, common if one leaks in). Scan headings only — cheap.
      const main = document.querySelector('[role="main"]') || document.body;
      for (const n of main.querySelectorAll('h2, h3, h4, [role="heading"]')) {
        const t = (n.textContent || "").trim();
        if (t && t.length <= 28 && TEXT_NEEDLES.some((s) => t.startsWith(s))) hideCard(n);
      }
    });

    // Left-nav entry points to algorithmic surfaces (Reels, Gaming, Watch) are
    // hidden in facebook.css by href.
  });
})();
