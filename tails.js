/* Optical spacing for headings with descenders (g, j, p, q, y).
   The site's spacing scale is measured between text boxes. Tan Pearl's
   tails hang into the space under a heading, so a title like "Languages"
   or "Amygdala" looks closer to what follows than "Education" does. Here
   each heading's last line is measured (canvas measureText → how far the
   letters reach below the baseline) and exactly that much is added under
   it, so the visible gap under every heading is the same. Recalculated
   when fonts load and on resize (sizes and line breaks change). */
(function () {
  // Headings of one series (all project cards, all My way blocks, all
  // captions of a page) are read one after another, so they must look
  // identical: every heading of a series gets the largest room any of
  // them needs. Single titles get exactly their own.
  const SERIES = [
    ".name-2", ".subheader", ".drum-caption-title",
    "#my-way h3", "#my-way-mobile h3",
  ];
  const SINGLE = [".name", ".case-title", ".case-next-label", ".case-next-title"];
  const SELECTOR = [...SERIES, ...SINGLE].join(",");
  const ctx = document.createElement("canvas").getContext("2d");

  // Visible characters on the heading's bottom line.
  const lastLine = (el) => {
    const chars = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.parentElement.closest(".sr-only, .case-arrow")) continue;
      for (let i = 0; i < n.length; i++) {
        range.setStart(n, i);
        range.setEnd(n, i + 1);
        const r = range.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) chars.push({ c: n.data[i], top: Math.round(r.top) });
      }
    }
    if (!chars.length) return "";
    const bottom = Math.max(...chars.map((ch) => ch.top));
    return chars.filter((ch) => Math.abs(ch.top - bottom) < 4).map((ch) => ch.c).join("");
  };

  const extraFor = (el) => {
    const text = lastLine(el);
    if (!/[gjpqyQ]/.test(text)) return 0;
    const cs = getComputedStyle(el);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const tails = ctx.measureText(text).actualBoundingBoxDescent;
    const base = ctx.measureText(text.replace(/[gjpqyQ]/g, "")).actualBoundingBoxDescent || 0;
    return Math.max(0, Math.round(tails - base));
  };

  const apply = () => {
    const els = [...document.querySelectorAll(SELECTOR)];
    els.forEach((el) => (el.style.paddingBottom = ""));
    const items = els
      .filter((el) => el.getClientRects().length)
      .map((el) => ({ el, extra: extraFor(el) }));
    const series = (el) => SERIES.find((s) => el.matches(s));
    items.forEach((it) => {
      const key = series(it.el);
      const group = key
        ? items.filter((o) => series(o.el) === key)
        : [it];
      const extra = Math.max(...group.map((o) => o.extra));
      if (extra < 1) return;
      const pb = parseFloat(getComputedStyle(it.el).paddingBottom);
      it.el.style.paddingBottom = `${pb + extra}px`;
    });
  };

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      apply();
      // The case pages place their carousel from the intro's height.
      window.dispatchEvent(new Event("tails:applied"));
    });
  };

  apply();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  window.addEventListener("resize", schedule);
})();
