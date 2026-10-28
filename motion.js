// Site-wide motion helpers.
//  1. Scroll reveal: project cards and Approach columns ease up into
//     place as they enter the viewport, one after another.
//  2. Offscreen pause: looping CSS decorations (floating shapes, hair
//     wind) stop animating while scrolled out of view.
// Both are skipped for visitors who prefer reduced motion.
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || !("IntersectionObserver" in window)) return;

  // --- 1. Scroll reveal ---
  const groups = [
    document.querySelectorAll("#projects .project-card"),
    document.querySelectorAll("#approach [class^='wrapper-']"),
  ];
  const items = [];
  groups.forEach((group) => {
    group.forEach((el, i) => {
      el.setAttribute("data-reveal", "");
      // Approach columns sit side by side, so they stagger; project cards
      // are stacked and each enters on its own as it's reached.
      if (el.className.startsWith("wrapper-")) el.style.setProperty("--reveal-index", i);
      items.push(el);
    });
  });

  // Anything already on screen at load is revealed straight away (no
  // flash of hidden content above the fold).
  const revealIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        revealIO.unobserve(entry.target);
        // Drop the reveal transition once finished, so it can't interfere
        // with the card's own hover effects later.
        const done = (e) => {
          if (e.target !== entry.target || e.propertyName !== "transform") return;
          entry.target.removeEventListener("transitionend", done);
          entry.target.removeAttribute("data-reveal");
        };
        entry.target.addEventListener("transitionend", done);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
  );
  document.documentElement.classList.add("reveal-ready");
  items.forEach((el) => revealIO.observe(el));

  // --- 2. Pause looping decorations offscreen ---
  const pauseIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("is-offscreen", !entry.isIntersecting);
    });
  });
  document.querySelectorAll(".hero-screen, #who-am-i").forEach((el) => pauseIO.observe(el));
})();
