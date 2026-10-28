let cursorDot = document.querySelector(".cursor-dot");
let cursorOutline = document.querySelector(".cursor-outline");

function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
// The dot sits exactly on the pointer; the outline trails behind it with
// frame-rate-independent smoothing (lerp in a rAF loop) instead of the
// old per-event 500ms Web Animation, which re-started on every mousemove
// and animated left/top (layout). Position is written to the standalone
// `translate` property, so the scale transitions declared on `transform`
// in main.css keep working on top of it.
let pointerX = 0;
let pointerY = 0;
let outlineX = 0;
let outlineY = 0;
let lastFrame = 0;
let following = false;

// Eye pupil: drifts toward the direction the pointer is travelling and
// settles back to centre when it stops. Only rendered while the "View"
// badge is open; stays centred for reduced-motion visitors.
const eyeIris = document.querySelector(".cursor-eye-iris");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const PUPIL_MAX_X = 3.6;
const PUPIL_MAX_Y = 2.2;
let lastPointerX = 0;
let lastPointerY = 0;
let lookX = 0; // target, in eye units
let lookY = 0;
let pupilX = 0; // rendered
let pupilY = 0;

const clamp = (v, max) => Math.max(-max, Math.min(max, v));

function followLoop(now) {
  const dt = lastFrame ? Math.min(64, now - lastFrame) : 16;
  lastFrame = now;
  const ease = 1 - Math.pow(1 - 0.22, dt / 16.67);
  outlineX += (pointerX - outlineX) * ease;
  outlineY += (pointerY - outlineY) * ease;
  cursorOutline.style.translate = `${outlineX.toFixed(2)}px ${outlineY.toFixed(2)}px`;

  // The look target decays toward centre, so the eye relaxes once the
  // pointer rests; the pupil itself eases after the target.
  const decay = Math.pow(0.88, dt / 16.67);
  lookX *= decay;
  lookY *= decay;
  const follow = 1 - Math.pow(1 - 0.2, dt / 16.67);
  pupilX += (lookX - pupilX) * follow;
  pupilY += (lookY - pupilY) * follow;
  if (eyeIris) {
    eyeIris.style.transform = `translate(${pupilX.toFixed(2)}px, ${pupilY.toFixed(2)}px)`;
  }
  const eyeMoving = Math.abs(pupilX) > 0.02 || Math.abs(pupilY) > 0.02;

  if (eyeMoving || Math.abs(pointerX - outlineX) > 0.1 || Math.abs(pointerY - outlineY) > 0.1) {
    requestAnimationFrame(followLoop);
  } else {
    following = false;
    lastFrame = 0;
  }
}

function moveCursor(e) {
  pointerX = e.clientX;
  pointerY = e.clientY;

  if (cursorDot.classList.contains("cursor-view") && !reduceMotion.matches) {
    const dx = pointerX - lastPointerX;
    const dy = pointerY - lastPointerY;
    lookX = clamp(lookX + dx * 0.7, PUPIL_MAX_X);
    lookY = clamp(lookY + dy * 0.7, PUPIL_MAX_Y);
  }
  lastPointerX = pointerX;
  lastPointerY = pointerY;

  if (!cursorDot.classList.contains("is-visible")) {
    // First movement: start the outline on the pointer, not at 0,0.
    outlineX = pointerX;
    outlineY = pointerY;
    cursorDot.classList.add("is-visible");
    cursorOutline.classList.add("is-visible");
  }

  cursorDot.style.translate = `${pointerX}px ${pointerY}px`;

  if (!following) {
    following = true;
    requestAnimationFrame(followLoop);
  }
}

if (!isTouchDevice()) {
  window.addEventListener("mousemove", moveCursor, { passive: true });

  document.documentElement.addEventListener("mouseleave", () => {
    cursorDot.classList.remove("is-visible");
    cursorOutline.classList.remove("is-visible");
  });
  window.addEventListener("mousedown", () => cursorDot.classList.add("is-pressed"));
  window.addEventListener("mouseup", () => cursorDot.classList.remove("is-pressed"));

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

  // Project covers link out to Behance - the cursor itself becomes the
  // "this is clickable" affordance (rather than a label overlaid on the
  // artwork) by expanding into a badge reading "View" while over one.
  document.querySelectorAll(".project-card .image a").forEach((link) => {
    link.addEventListener("mouseenter", () => {
      cursorDot.classList.add("cursor-view");
      cursorOutline.classList.add("cursor-view-active");
    });
    link.addEventListener("mouseleave", () => {
      cursorDot.classList.remove("cursor-view");
      cursorOutline.classList.remove("cursor-view-active");
    });
  });
} else {
  cursorDot.style.display = "none";
  cursorOutline.style.display = "none";
  document.body.style.cursor = "auto";
}