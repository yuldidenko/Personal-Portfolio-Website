// My way tile mosaic: both tile groups (under Hobbies + Languages and
// under the CV) are 6 rows x 4 columns. A tile is a quarter of the
// column wide; if six rows of that size wouldn't fit between the last
// text block and the bottom of the video column, every tile shrinks
// just enough to fit, so the two groups always stay the same size.
(() => {
  const section = document.getElementById("my-way");
  if (!section) return;
  const groups = [...section.querySelectorAll(".mosaic")];
  const media = section.querySelector(".column-2");
  if (!groups.length || !media) return;
  const ROWS = 6;
  const COLS = 4;

  const fit = () => {
    if (getComputedStyle(section).display === "none") return;
    const floor = media.lastElementChild.getBoundingClientRect().bottom;
    let tile = Infinity;
    groups.forEach((group) => {
      const column = group.parentElement;
      const gap = parseFloat(getComputedStyle(column).rowGap) || 0;
      const above = group.previousElementSibling.getBoundingClientRect().bottom;
      const free = floor - above - gap;
      tile = Math.min(tile, column.clientWidth / COLS, free / ROWS);
    });
    if (!isFinite(tile) || tile <= 0) return;
    section.style.setProperty("--tile", `${Math.floor(tile * 2) / 2}px`);
  };

  fit();
  window.addEventListener("load", fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  if ("ResizeObserver" in window) new ResizeObserver(fit).observe(media);
})();
