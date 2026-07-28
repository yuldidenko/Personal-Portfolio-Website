window.addEventListener('DOMContentLoaded', () => {
  const hero = document.querySelector('.hero-screen');
  const parts = hero ? hero.querySelectorAll('[id^="part"], [id^="shard"]') : [];
  if (!hero || !parts.length) return;

  // Portrait's own center, in the SVG's viewBox/user-unit space (viewBox is
  // "0 0 2683 3408"), used below as the explosion's origin so every part
  // flies radially away from the middle of the image rather than back
  // along its arbitrary load-in direction.
  const CENTER_X = 1341.5;
  const CENTER_Y = 1704;

  // A part's burst travel distance is its own distance from center, scaled
  // up, plus a flat minimum so parts that start very close to the middle
  // still get a visible push instead of barely moving. The per-part random
  // multiplier keeps the burst from reading as a uniform outward zoom.
  const BURST_DISTANCE_SCALE = 3.5;
  const BURST_MIN_TRAVEL = 260;
  const BURST_MULT_MIN = 0.8;
  const BURST_MULT_MAX = 1.6;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  // Computed once up front (getBBox ignores any live CSS transform, so this
  // is safe to do immediately - no need to wait for the entrance animation
  // to finish). Stored as --bx/--by/--by custom properties alongside the
  // existing --x/--y/--r so the load-in keyframe is untouched and only the
  // scroll-driven disassembly formula (in main.css) reads the new ones.
  parts.forEach((part) => {
    let bbox;
    try {
      bbox = part.getBBox();
    } catch (e) {
      bbox = { x: 0, y: 0, width: 0, height: 0 };
    }
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    const dx = cx - CENTER_X;
    const dy = cy - CENTER_Y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const travel = (dist * BURST_DISTANCE_SCALE + BURST_MIN_TRAVEL) * rand(BURST_MULT_MIN, BURST_MULT_MAX);

    part.style.setProperty('--bx', (ux * travel).toFixed(1) + 'px');
    part.style.setProperty('--by', (uy * travel).toFixed(1) + 'px');
    part.style.setProperty('--br', rand(-540, 540).toFixed(0) + 'deg');
  });

  // Fraction of the hero's own height the user must scroll past before the
  // explosion starts. 0 = burst begins the instant scrolling starts.
  const SCROLL_START = 0;

  // How quickly the displayed progress chases the scroll-derived target
  // each frame (0-1). Lower = smoother/laggier, higher = snappier. Easing
  // here is what keeps fast/momentum scrolling from ever teleporting the
  // pieces straight to their end state.
  const SMOOTHING = 0.18;
  const SETTLE_EPSILON = 0.0005;

  // Read each part's real animation-delay/duration so we know exactly when
  // the load-time assembly animation finishes, without hardcoding a value
  // that could drift out of sync with the CSS/markup.
  //
  // Computed once and cached on window (see bg-shards.js, which runs first,
  // before bg-svg-shards.js resets 8 elements' animation to 'none' and
  // zeroes their computed animation-delay/duration as a side effect).
  // Recomputing independently here - this script runs after that reset -
  // would undercount the true max and flip assemblyDone slightly early.
  if (typeof window.__portraitAssemblyEndMs !== 'number') {
    let computed = 0;
    parts.forEach((part) => {
      const cs = getComputedStyle(part);
      const delay = parseFloat(cs.animationDelay) || 0;
      const duration = parseFloat(cs.animationDuration) || 0;
      computed = Math.max(computed, (delay + duration) * 1000);
    });
    window.__portraitAssemblyEndMs = computed;
  }
  const assemblyEndMs = window.__portraitAssemblyEndMs;

  let assemblyDone = false;
  let scrollActiveApplied = false;
  let displayedProgress = 0;
  let rafId = null;

  function targetProgress() {
    const rect = hero.getBoundingClientRect();
    const raw = Math.min(1, Math.max(0, -rect.top / rect.height));
    return Math.min(1, Math.max(0, (raw - SCROLL_START) / (1 - SCROLL_START)));
  }

  function tick() {
    const target = targetProgress();
    displayedProgress += (target - displayedProgress) * SMOOTHING;

    if (Math.abs(target - displayedProgress) < SETTLE_EPSILON) {
      displayedProgress = target;
    }

    hero.style.setProperty('--progress', displayedProgress.toFixed(4));

    if (displayedProgress !== target) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  }

  function requestTick() {
    if (!assemblyDone || rafId !== null) return;
    if (!scrollActiveApplied) {
      // Hand every part over from its load-time CSS animation to this
      // scroll-driven formula only once the user actually scrolls, instead
      // of unconditionally on a fixed timer right as assembly finishes.
      // Flipping ~300 elements off their animation simultaneously at that
      // exact instant - alongside the wind-sway and background-fall
      // effects starting - risked a visible repaint flicker even though
      // the computed opacity/transform matched.
      //
      // displayedProgress deliberately stays at its initial 0 here rather
      // than snapping to targetProgress(): this handler is now driven BY a
      // real 'scroll' event (unlike the old fixed-timer version), and if
      // the user scrolled far during the gated entrance - scroll events are
      // ignored entirely until assemblyDone - that event's target can
      // already be a long way from 0. Snapping straight to it instantly
      // blew the portrait apart in a single frame (hair, being farthest
      // from center, flies hardest and reads as "deleted"). Leaving it at
      // 0 lets the normal eased tick() loop below catch up smoothly over a
      // few frames instead, however large the jump.
      scrollActiveApplied = true;
      hero.classList.add('scroll-active');
    }
    rafId = requestAnimationFrame(tick);
  }

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);

  setTimeout(() => {
    assemblyDone = true;
  }, assemblyEndMs + 50);
});
