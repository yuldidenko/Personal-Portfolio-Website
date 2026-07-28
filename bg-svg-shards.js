window.addEventListener('DOMContentLoaded', () => {
  const hero = document.querySelector('.hero-screen');
  const svg = hero ? hero.querySelector('svg') : null;
  if (!hero || !svg) return;

  // These specific pre-existing decorative fragments are identified by
  // their exact path data, since their ids collide with other parts.
  const TARGET_D = [
    'M2903 1145.82L3044.38 1179L3133 1027.38L2955.35 953L2903 1145.82Z',
    'M3309.06 1473.41C3295.5 1637.49 3279.29 1726.63 3169.95 1838.85C3096.12 1618.11 3180.6 1622.35 3309.06 1473.41Z',
    'M3122.91 2747.31C3091.1 2482.21 2798.56 2381.85 2978.38 2151.28C3069.75 2435.44 3229.03 2469.19 3165.05 2754.34L3122.91 2747.31Z',
    'M3684.36 2904.65L3722.1 3069.38L3862.4 3019L3882.74 2771.99L3779.17 2729.12L3684.36 2904.65Z',
    'M-12.82 818.03L-52.37 798.617L15.94 703.427L112.42 716.189L-12.82 818.03Z',
    'M-750.716 1549.53L-769.541 1685.42L-750.112 1732.14L-636.908 1771.03L-545.72 1751L-637.501 1619.37L-750.716 1549.53Z',
    'M28.69 2411.95L-227.63 2216.12L-178.69 2501.65L28.69 2411.95Z',
    'M-451.99 2739.6L-821.521 2864.31L-740.612 3099.66L-652.82 3047.25L-451.99 2739.6Z',
  ];

  const allPaths = Array.from(svg.querySelectorAll('path'));
  const targets = TARGET_D.map((d) => allPaths.find((p) => p.getAttribute('d') === d)).filter(Boolean);
  if (!targets.length) return;

  const DEFAULT_SIZE_SCALE = 1.2; // slightly larger overall
  const MIN_OPACITY = 0.35; // smallest/farthest fragments never fully vanish

  // Per-fragment size multiplier, keyed by d-string. This is an explicit
  // customization requested separately and takes precedence over
  // DEFAULT_SIZE_SCALE rather than being multiplied by it.
  const SIZE_OVERRIDES = {
    'M3122.91 2747.31C3091.1 2482.21 2798.56 2381.85 2978.38 2151.28C3069.75 2435.44 3229.03 2469.19 3165.05 2754.34L3122.91 2747.31Z': 0.5,
  };

  // Start falling the instant the portrait finishes assembling, reading its
  // real animation-delay/duration (same method hero-scroll.js uses) so
  // this stays in sync if that timing ever changes - and so it fires at the
  // same moment as hair-wind.js's wind-sway trigger.
  let assemblyEndMs = 0;
  document.querySelectorAll('[id^="part"], [id^="shard"]').forEach((part) => {
    const cs = getComputedStyle(part);
    const delay = parseFloat(cs.animationDelay) || 0;
    const duration = parseFloat(cs.animationDuration) || 0;
    assemblyEndMs = Math.max(assemblyEndMs, (delay + duration) * 1000);
  });
  const fallStartMs = assemblyEndMs;
  const startTime = performance.now();

  // The face sits roughly in this horizontal band, regardless of fall
  // height. Falling behind her, across the wider hair area to either
  // side, or outside the portrait entirely is fine - only the face itself
  // must stay clear. This matters even more here than for the div shards:
  // these fragments are re-appended to the end of the svg for depth
  // ordering (see below), which puts them in front of the whole portrait,
  // so keeping them off the face has to be enforced positionally.
  const FACE_X_MIN_FRAC = 0.4;
  const FACE_X_MAX_FRAC = 0.6;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  // At the base rand(12,28) speed range's average (20px/s), a fall across
  // the full viewport height takes h/20 seconds. Scale speed up so that
  // reference fall takes exactly 1s less, however tall the viewport is.
  const BASE_AVG_VY = 20;
  function fallSpeedMultiplier(h) {
    const baseTime = h / BASE_AVG_VY;
    const targetTime = Math.max(1, baseTime - 1);
    return baseTime / targetTime;
  }

  // Picks a baseX whose full sway range (baseX +/- swayAmp) never enters
  // the face band, so a fragment's fall path can't drift across the face.
  function pickBaseXAvoidingFace(swayAmp) {
    const w = hero.clientWidth;
    const margin = swayAmp + 20;
    const faceLeft = w * FACE_X_MIN_FRAC - margin;
    const faceRight = w * FACE_X_MAX_FRAC + margin;
    const leftRange = Math.max(0, faceLeft);
    const rightRange = w - Math.min(w, faceRight);
    if (leftRange <= 0 && rightRange <= 0) return rand(0, w); // viewport too narrow to avoid it
    if (leftRange <= 0) return rand(Math.min(w, faceRight), w);
    if (rightRange <= 0) return rand(0, faceLeft);
    return Math.random() < leftRange / (leftRange + rightRange) ? rand(0, faceLeft) : rand(Math.min(w, faceRight), w);
  }

  // These paths live in the SVG's own viewBox (user-unit) space, which is
  // scaled to fit the viewport. Convert desired on-screen pixel motion into
  // that local unit space via the live screen CTM, so they fall/sway at the
  // same real, visible speed as the bg-shards div particles.
  let unitsPerPx = 1;
  function updateScale() {
    const ctm = svg.getScreenCTM();
    if (ctm && ctm.a) unitsPerPx = 1 / ctm.a;
  }

  // Each path's own drawn ("rest") position and size, measured in
  // hero-local CSS pixels with no transform applied. Position is used as
  // the base point for the transform delta (see resetItem); size feeds the
  // depth-based opacity below.
  function measureNatural(el) {
    const prev = el.style.transform;
    el.style.transform = 'translate(0px, 0px) scale(1) rotate(0deg)';
    const heroRect = hero.getBoundingClientRect();
    const pathRect = el.getBoundingClientRect();
    el.style.transform = prev;
    return {
      x: pathRect.left - heroRect.left + pathRect.width / 2,
      y: pathRect.top - heroRect.top + pathRect.height / 2,
      width: pathRect.width,
      height: pathRect.height,
    };
  }

  function resetItem(s) {
    const h = hero.clientHeight;

    // Main drift plus a smaller, faster secondary wave layered on top -
    // reads as organic air drift rather than one clean metronomic sway.
    s.swayAmp = rand(20, 60);
    s.swayFreq = rand(0.3, 0.8);
    s.swayPhase = rand(0, Math.PI * 2);
    s.swayAmp2 = s.swayAmp * rand(0.2, 0.35);
    s.swayFreq2 = s.swayFreq * rand(2.2, 3.2);
    s.swayPhase2 = rand(0, Math.PI * 2);

    s.baseX = pickBaseXAvoidingFace(s.swayAmp + s.swayAmp2);
    // Always above the top of the viewport (never inside it), spread
    // across a tall range so the page loads with a clear screen and
    // fragments cascade in gradually rather than all popping in at once.
    s.y = -80 - rand(0, h * 1.4);

    // Gravity: starts slow and accelerates (ease-in), capped at a terminal
    // velocity like a light object with air resistance - not a constant,
    // linear fall speed. Both scaled by the same "make it snappier"
    // multiplier established earlier for the base rand(12,28) range.
    const speedMul = fallSpeedMultiplier(h);
    s.vy = rand(4, 10) * speedMul;
    s.gravity = rand(20, 40) * speedMul; // px/s^2
    s.terminalVy = rand(50, 90) * speedMul;

    s.rot = rand(0, 360);
    s.rotSpeed = rand(-20, 20); // deg/s, continuous spin/flip around z

    // Soft 3D tilt: oscillating rotateX/rotateY (a wobble, not a full
    // spin) layered on top of the z-axis flip for a tumbling-through-air
    // feel rather than a flat 2D rotation.
    s.tiltAmpX = rand(15, 35);
    s.tiltFreqX = rand(0.2, 0.5);
    s.tiltPhaseX = rand(0, Math.PI * 2);
    s.tiltAmpY = rand(15, 35);
    s.tiltFreqY = rand(0.2, 0.5);
    s.tiltPhaseY = rand(0, Math.PI * 2);

    // Per-fragment multiplier on the scroll-driven burst distance below, so
    // the whole layer doesn't scatter as one uniform outward zoom.
    s.burstMult = rand(0.8, 1.6);

    s.time = rand(0, 100);
    return s;
  }

  const items = targets.map((el) => {
    // Opt this element out of the assemble/disassemble keyframe system
    // entirely so our own transform/opacity fully own it from frame one.
    el.style.animation = 'none';
    el.style.transformBox = 'fill-box';
    el.style.transformOrigin = '50% 50%';
    el.style.willChange = 'transform';
    // One of these paths (id="part259", fill="#E7D893") carries a
    // pre-existing stroke="black" in the markup - invisible while static
    // in the portrait, but a visible dark outline once it's animating on
    // its own. Strip stroke on all 8 so none can ever show a border.
    el.style.stroke = 'none';

    const natural = measureNatural(el);
    const sizeScale = SIZE_OVERRIDES[el.getAttribute('d')] || DEFAULT_SIZE_SCALE;
    const effectiveSize = Math.max(natural.width, natural.height) * sizeScale;
    return resetItem({ el, natural, sizeScale, effectiveSize });
  });

  // Depth cue: bigger fragments read as closer (fully solid), smaller ones
  // as farther away (semi-transparent). SVG has no z-index for plain
  // shapes - paint order is document order - so bigger fragments are also
  // re-appended in ascending size order (biggest last/on top) so a
  // smaller, more-transparent one can never paint over a bigger one.
  const minSize = Math.min(...items.map((s) => s.effectiveSize));
  const maxSize = Math.max(...items.map((s) => s.effectiveSize));
  items
    .slice()
    .sort((a, b) => a.effectiveSize - b.effectiveSize)
    .forEach((s) => {
      const sizeFrac = maxSize > minSize ? (s.effectiveSize - minSize) / (maxSize - minSize) : 1;
      s.opacity = MIN_OPACITY + (1 - MIN_OPACITY) * sizeFrac;
      svg.appendChild(s.el);
    });

  function remeasureAll() {
    updateScale();
    items.forEach((s) => {
      const natural = measureNatural(s.el);
      s.natural = natural;
    });
  }
  window.addEventListener('resize', remeasureAll);
  updateScale();

  let lastTime = performance.now();

  function tick(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (now - startTime < fallStartMs) {
      requestAnimationFrame(tick);
      return; // not time to start falling yet, stay hidden
    }

    const rect = hero.getBoundingClientRect();
    const heroVisible = rect.bottom > 0 && rect.top < window.innerHeight;

    if (heroVisible) {
      const h = hero.clientHeight;
      const w = hero.clientWidth;
      // Same --progress the portrait's own burst reads (set by
      // hero-scroll.js), so these fragments scatter outward in sync with
      // it rather than on their own independent timeline.
      const progress = parseFloat(getComputedStyle(hero).getPropertyValue('--progress')) || 0;
      const burstReach = Math.max(w, h) * 0.9;
      const centerX = w / 2;
      const centerY = h / 2;

      items.forEach((s) => {
        s.time += dt;
        s.vy = Math.min(s.terminalVy, s.vy + s.gravity * dt); // ease-in acceleration, capped
        s.y += s.vy * dt;
        s.rot += s.rotSpeed * dt;

        if (s.y - 80 > h) resetItem(s);

        const sway =
          Math.sin(s.time * s.swayFreq + s.swayPhase) * s.swayAmp +
          Math.sin(s.time * s.swayFreq2 + s.swayPhase2) * s.swayAmp2;
        const targetX = s.baseX + sway;
        const targetY = s.y;

        // Burst outward from the hero's own center, radially, same as the
        // portrait pieces - added on top of the normal fall/sway rather
        // than replacing it.
        let burstX = 0;
        let burstY = 0;
        if (progress > 0) {
          const ddx = targetX - centerX;
          const ddy = targetY - centerY;
          const dist = Math.hypot(ddx, ddy) || 1;
          const travel = burstReach * s.burstMult * progress;
          burstX = (ddx / dist) * travel;
          burstY = (ddy / dist) * travel;
        }

        const dxPx = targetX + burstX - s.natural.x;
        const dyPx = targetY + burstY - s.natural.y;

        const tiltX = Math.sin(s.time * s.tiltFreqX + s.tiltPhaseX) * s.tiltAmpX;
        const tiltY = Math.sin(s.time * s.tiltFreqY + s.tiltPhaseY) * s.tiltAmpY;

        s.el.style.transform = `translate(${(dxPx * unitsPerPx).toFixed(2)}px, ${(dyPx * unitsPerPx).toFixed(2)}px) rotateZ(${s.rot.toFixed(1)}deg) rotateX(${tiltX.toFixed(1)}deg) rotateY(${tiltY.toFixed(1)}deg) scale(${s.sizeScale})`;
        s.el.style.opacity = (s.opacity * (1 - progress)).toFixed(2);
      });
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
});
