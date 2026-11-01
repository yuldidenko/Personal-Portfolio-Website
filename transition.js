// Page curtain between the home page and the project pages.
// A click on a link to another page of the site (a project cover, "Next
// project", "All projects") first sweeps a dark rounded curtain in from
// the right; once the page is covered, the browser navigates. The next
// page starts covered (html.curtain-in, set in its <head>) and the
// curtain carries on out to the left. Reduced motion: plain navigation.
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Arrival: drop the classes once the curtain has gone.
  if (root.classList.contains("curtain-in")) {
    const clear = () => {
      setTimeout(() => root.classList.remove("curtain-in"), 1000);
      setTimeout(() => root.classList.remove("vt-enter"), 2000);
    };
    // The page's <head> holds the curtain until fonts and scripts are in.
    if (root.classList.contains("curtain-hold")) {
      document.addEventListener("curtain:release", clear, { once: true });
    } else clear();
  }

  const PAGES = /(^|\/)(index|factora|amygdala|cultural-planet|good-food)\.html$/;
  const isSitePage = (a) => {
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return false;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return false;
    const samePage = url.pathname === location.pathname;
    if (samePage) return false; // in-page anchors scroll as usual
    return PAGES.test(url.pathname) || url.pathname.endsWith("/");
  };

  let leaving = false;
  document.addEventListener("click", (e) => {
    if (leaving || e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab etc.
    const a = e.target.closest("a[href]");
    if (!isSitePage(a) || reduceMotion.matches) return;
    e.preventDefault();
    leaving = true;
    const curtain = document.createElement("div");
    const toHome = /(^|\/)(index\.html)?$/.test(new URL(a.href, location.href).pathname);
    curtain.className = toHome ? "page-curtain page-curtain--light" : "page-curtain";
    curtain.setAttribute("aria-hidden", "true");
    document.body.appendChild(curtain);
    const go = () => {
      try {
        sessionStorage.setItem("curtain", "1");
      } catch (err) {}
      location.href = a.href;
    };
    curtain.addEventListener("animationend", go, { once: true });
    setTimeout(go, 900); // in case animationend never fires
  });

  // Back/forward restores pages from memory: take any curtain away.
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    leaving = false;
    document.querySelectorAll(".page-curtain").forEach((c) => c.remove());
    root.classList.remove("curtain-in");
  });
})();
