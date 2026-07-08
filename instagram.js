// Instagram. Strategy: redirect the home feed to Instagram's own chronological
// "Following" view, hide anything algorithmic that leaks through, strip the
// Explore grid down to its search bar, and stop Reels from advancing.
(function () {
  const IAR = window.__IAR__;

  IAR.ifEnabled(function () {
    // ponytail: English-UI strings. Other languages → add the translated phrases here.
    const FEED_NEEDLES = ["Suggested for you", "Suggested Posts", "Suggested posts", "Sponsored"];

    // --- 1. Redirect the algorithmic home feed to the Following feed --------
    const HOME_URL = "https://www.instagram.com/?variant=following";
    const onFollowing = () => new URLSearchParams(location.search).get("variant") === "following";

    // Fires at document_start, before the For You feed renders. Also re-applied
    // on soft in-app navigation to Home (below), because clicking the Home icon
    // does a pushState that drops the variant and would otherwise show For You.
    if (location.pathname === "/" && IAR.enforceHome(HOME_URL, onFollowing())) return;

    // --- 2. Classify the current page for the CSS in instagram.css ----------
    function classify() {
      const p = location.pathname;
      if (p === "/") return "home";
      if (p === "/explore/") return "explore";      // the grid only; /explore/tags/… /explore/search/… stay usable
      // Live IG uses /reels/{id}/ while a reel plays (not just /reels/ or the
      // older /reel/{id}/) — match the whole section, verified against the DOM.
      if (p.startsWith("/reels/") || p.startsWith("/reel/")) return "reels";
      return "other";
    }
    IAR.onUrlChange(() => {
      IAR.setPage(classify());
      if (location.pathname === "/") IAR.enforceHome(HOME_URL, onFollowing());
    });

    // --- 3. Continuously hide leaked units and pin the reels player ---------
    IAR.onTick(() => {
      const page = document.documentElement.dataset.iarPage;
      if (page === "home") IAR.hideByText(document.querySelectorAll("article"), FEED_NEEDLES);
      hideSuggestedAccounts();
      if (page === "explore") hideExploreGrid();
      pinReels();
    });

    // Hide the "Suggested for you" accounts module wherever it appears (home
    // right rail, profile carousels). Walk up from the header while the block
    // still starts with the label — that grabs the whole module and stops before
    // the neighbouring profile card. Feed "Suggested" POSTS live inside <article>
    // and are handled by hideByText, so those headers are skipped.
    function hideSuggestedAccounts() {
      for (const h of document.querySelectorAll("span, h2, h3, h4")) {
        if ((h.textContent || "").trim() !== "Suggested for you") continue;
        if (h.closest("article")) continue;
        let mod = h, el = h;
        while (el.parentElement && (el.parentElement.textContent || "").trim().startsWith("Suggested for you")) {
          el = el.parentElement; mod = el;
        }
        if (mod.getAttribute("data-iar-hidden") !== "1") mod.setAttribute("data-iar-hidden", "1");
      }
    }

    // Explore: collapse the media grid but KEEP the in-page search bar. The grid
    // is the highest ancestor of a tile (below <main>) that doesn't contain the
    // search input; the search bar sits in a sibling block and stays usable.
    function hideExploreGrid() {
      const main = document.querySelector("main");
      if (!main) return;
      const search = main.querySelector("input");
      const tile = main.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]');
      if (!tile) return;
      let grid = null, el = tile;
      while (el.parentElement && el.parentElement !== main) {
        el = el.parentElement;
        if (!search || !el.contains(search)) grid = el;
      }
      if (grid && grid.getAttribute("data-iar-hidden") !== "1") grid.setAttribute("data-iar-hidden", "1");
    }

    // On the Reels page, freeze the vertical scroll-snap container so wheel/drag
    // can't advance. Found structurally (nearest scrollable ancestor of the
    // <video>), never by class name. Belt-and-suspenders with the event blocking.
    function pinReels() {
      if (document.documentElement.dataset.iarPage !== "reels") return;
      const v = document.querySelector("video");
      if (!v) return;
      let el = v.parentElement;
      while (el) {
        const s = getComputedStyle(el);
        if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4) {
          if (!el.dataset.iarPinned) { el.dataset.iarPinned = "1"; el.style.overflow = "hidden"; }
          return;
        }
        el = el.parentElement;
      }
    }

    // --- 4. Block Reels advancement: scroll, swipe, keyboard ----------------
    // Selector-free and therefore robust to Meta's DOM churn — every advance
    // vector funnels through these events. Interactions inside a dialog / text
    // field (e.g. the comments panel) are left alone so they still scroll & type.
    const onReels = () => document.documentElement.dataset.iarPage === "reels";
    const inScrollableUI = (t) =>
      t && t.closest && t.closest('[role="dialog"], [role="textbox"], textarea, input, [contenteditable="true"]');

    function blockScroll(e) {
      if (!onReels() || inScrollableUI(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    }
    addEventListener("wheel", blockScroll, { capture: true, passive: false });
    addEventListener("touchmove", blockScroll, { capture: true, passive: false });

    const ADVANCE_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar", "j", "k"];
    addEventListener("keydown", (e) => {
      if (!onReels() || inScrollableUI(e.target)) return;
      if (ADVANCE_KEYS.includes(e.key)) { e.preventDefault(); e.stopPropagation(); }
    }, { capture: true });

    // The on-screen next/prev chevron buttons are hidden by instagram.css using
    // their verified aria-labels ("Navigate to next/previous Reel"). This event
    // blocking is the redundant backup that also stops wheel/trackpad/keyboard.
  });
})();
