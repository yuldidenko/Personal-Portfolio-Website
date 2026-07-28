let cursorDot = document.querySelector(".cursor-dot");
let cursorOutline = document.querySelector(".cursor-outline");

function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
function moveCursor(e) {
  let posX = e.clientX;
  let posY = e.clientY;

  cursorDot.style.left = `${posX}px`;
  cursorDot.style.top = `${posY}px`;

  cursorOutline.style.left = `${posX}px`;
  cursorOutline.style.top = `${posY}px`;

  cursorOutline.animate(
    {
      left: `${posX}px`,
      top: `${posY}px`,
    },
    { duration: 500, fill: "forwards" }
  );
}

if (!isTouchDevice()) {
  window.addEventListener("mousemove", moveCursor);

  // iframes (e.g. the Spotify embeds) are a separate document: our
  // mousemove listener never fires while the pointer is inside one, and
  // our `cursor: none` rule has no effect in there either, so the native
  // cursor reappears while our custom cursor freezes at its last position
  // - together that looks like two cursors at once. Hiding ours whenever
  // the pointer enters an iframe (detectable from the parent page even
  // though we can't see anything happening inside it) avoids the overlap.
  document.querySelectorAll("iframe").forEach((frame) => {
    frame.addEventListener("mouseenter", () => {
      cursorDot.style.display = "none";
      cursorOutline.style.display = "none";
    });
    frame.addEventListener("mouseleave", () => {
      cursorDot.style.display = "";
      cursorOutline.style.display = "";
    });
  });
} else {
  cursorDot.style.display = "none";
  cursorOutline.style.display = "none";
  document.body.style.cursor = "auto";
}