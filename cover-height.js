// Every project cover is as tall as the Amygdala cover (the one with the
// longest text beside it), so the four cards line up into one rhythm.
// Only in the side-by-side layout; stacked on small screens, covers keep
// their own 4:3.
(() => {
  const ref = document.querySelector("#amygdala .image");
  const covers = [...document.querySelectorAll(".project-card .image")];
  if (!ref || covers.length < 2) return;
  const sync = () => {
    covers.forEach((c) => (c.style.minHeight = ""));
    const card = ref.closest(".project-card");
    if (getComputedStyle(card).flexDirection !== "row") return;
    const h = ref.getBoundingClientRect().height;
    covers.forEach((c) => {
      if (c !== ref) c.style.minHeight = `${h}px`;
    });
  };
  let raf = 0;
  const queue = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(sync);
  };
  sync();
  window.addEventListener("resize", queue);
  document.fonts?.ready.then(queue);
  window.addEventListener("load", queue);
})();
