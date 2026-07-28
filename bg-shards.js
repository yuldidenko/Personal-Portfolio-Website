window.addEventListener('DOMContentLoaded', () => {
  const hero = document.querySelector('.hero-screen');
  if (!hero) return;

  const COLORS = ['#B04830', '#AF5B37', '#CDA03B', '#C09B67', '#E4D9B4', '#316A88', '#097DB0', '#2F6F52'];
  const SIZE_SCALE = 3; // bolder, more readable fragments
  const MIN_SIZE = 16 * SIZE_SCALE;
  const MAX_SIZE = 46 * SIZE_SCALE;
  const MIN_OPACITY = 0.35; // smallest/farthest shards never fully vanish

  // Start falling the instant the portrait finishes assembling, reading its
  // real animation-delay/duration (same method hero-scroll.js uses) so
  // this stays in sync if that timing ever changes - and so it fires at the
  // same moment as hair-wind.js's wind-sway trigger.
  //
  // Computed once and cached on window: this script runs first (see the
  // <script> order in index.html), before bg-svg-shards.js resets 8 of
  // these elements' animation to 'none' (which zeroes their computed
  // animation-delay/duration as a side effect of the shorthand reset). Any
  // script that recomputes this AFTER that mutation would undercount the
  // true max and start touching still-mid-flight elements early - caching
  // the first (correct, pre-mutation) result here means every script reads
  // the same true value regardless of when it happens to run.
  if (typeof window.__portraitAssemblyEndMs !== 'number') {
    let computed = 0;
    document.querySelectorAll('[id^="part"], [id^="shard"]').forEach((part) => {
      const cs = getComputedStyle(part);
      const delay = parseFloat(cs.animationDelay) || 0;
      const duration = parseFloat(cs.animationDuration) || 0;
      computed = Math.max(computed, (delay + duration) * 1000);
    });
    window.__portraitAssemblyEndMs = computed;
  }
  const assemblyEndMs = window.__portraitAssemblyEndMs;
  const fallStartMs = assemblyEndMs;
  const startTime = performance.now();

  // The face sits roughly in this horizontal band, regardless of fall
  // height. Falling behind her, across the wider hair area to either
  // side, or outside the portrait entirely is fine - only the face itself
  // must stay clear.
  const FACE_X_MIN_FRAC = 0.4;
  const FACE_X_MAX_FRAC = 0.6;

  const container = document.createElement('div');
  container.className = 'bg-shards';
  container.setAttribute('aria-hidden', 'true');
  hero.insertBefore(container, hero.firstChild);

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

  // Picks a baseX on the given side (never the other side, and never in
  // the face band), so the left/right split assigned at creation - 3
  // shards each - holds for every fall, not just the first one.
  function pickBaseXForSide(side, swayAmp) {
    const w = hero.clientWidth;
    const margin = swayAmp + 20;
    const faceLeft = w * FACE_X_MIN_FRAC - margin;
    const faceRight = w * FACE_X_MAX_FRAC + margin;
    if (side === 'left') {
      return faceLeft > 0 ? rand(0, faceLeft) : rand(0, w * 0.5);
    }
    return faceRight < w ? rand(faceRight, w) : rand(w * 0.5, w);
  }

  // Procedural jagged glass-shard silhouette: an irregular polygon with
  // 5-8 vertices, alternating long spikes and pulled-in notches so it
  // reads as a sharp broken fragment rather than a symmetric quad/diamond.
  function makeJaggedPolygon() {
    const points = Math.floor(rand(5, 9));
    const angleStep = (Math.PI * 2) / points;
    const verts = [];
    for (let i = 0; i < points; i++) {
      const angle = i * angleStep + rand(-angleStep * 0.4, angleStep * 0.4);
      const spike = Math.random() < 0.4;
      const radius = spike ? rand(42, 50) : rand(18, 34);
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;
      verts.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
    }
    return `polygon(${verts.join(', ')})`;
  }

  // A second, distinct shard silhouette: a single clean sharp triangle
  // (irregular, not equilateral) rather than a many-point jagged star -
  // so the fall is a visible mix of two shapes, not one shape repeated.
  function makeTrianglePolygon() {
    const baseAngle = rand(0, Math.PI * 2);
    const verts = [0, 1, 2].map((i) => {
      const angle = baseAngle + (i * Math.PI * 2) / 3 + rand(-0.35, 0.35);
      const radius = rand(42, 50);
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;
      return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
    });
    return `polygon(${verts.join(', ')})`;
  }

  // Two different shard "types" fall together rather than a single
  // repeated shape.
  function makeShardPolygon() {
    return Math.random() < 0.5 ? makeJaggedPolygon() : makeTrianglePolygon();
  }

  function resetShard(s) {
    const h = hero.clientHeight;

    // Re-roll shape/size/color on every respawn so looping fragments feel
    // freshly broken off rather than the same piece cycling forever.
    s.size = rand(16, 46) * SIZE_SCALE;
    const elongation = rand(0.55, 1.4);
    const height = Math.max(10, s.size * elongation);
    s.el.style.width = s.size + 'px';
    s.el.style.height = height + 'px';
    s.el.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
    s.el.style.clipPath = makeShardPolygon();
    s.bounds = Math.max(s.size, height);

    // Depth cue: bigger shards read as closer (fully solid), smaller ones
    // as farther away (semi-transparent). z-index tracks size directly so
    // a smaller/more-transparent shard can never paint over a bigger one.
    const sizeFrac = (s.size - MIN_SIZE) / (MAX_SIZE - MIN_SIZE);
    s.opacity = MIN_OPACITY + (1 - MIN_OPACITY) * sizeFrac;
    s.el.style.zIndex = Math.round(s.size);

    // Main drift plus a smaller, faster secondary wave layered on top -
    // reads as organic air drift rather than one clean metronomic sway.
    s.swayAmp = rand(20, 60);
    s.swayFreq = rand(0.3, 0.8);
    s.swayPhase = rand(0, Math.PI * 2);
    s.swayAmp2 = s.swayAmp * rand(0.2, 0.35);
    s.swayFreq2 = s.swayFreq * rand(2.2, 3.2);
    s.swayPhase2 = rand(0, Math.PI * 2);

    s.baseX = pickBaseXForSide(s.side, s.swayAmp + s.swayAmp2);
    // Always above the top of the viewport (never inside it), spread
    // across a tall range so the page loads with a clear screen and
    // shards cascade in gradually rather than all popping in at once.
    s.y = -s.bounds - rand(0, h * 1.4);

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

    // Per-shard multiplier on the scroll-driven burst distance below, so
    // the whole layer doesn't scatter as one uniform outward zoom.
    s.burstMult = rand(0.8, 1.6);

    s.time = rand(0, 100);
    return s;
  }

  function makeShard(side) {
    const el = document.createElement('div');
    el.className = 'bg-shard';
    el.style.opacity = '0'; // hidden until fallStartMs, when tick() starts driving real opacity
    // Left as a real CSS transition (not a JS-computed ramp) so the initial
    // fade-in is driven by the compositor: it plays out correctly even if
    // the main thread is briefly busy (several other scripts fire at this
    // same instant) and the first post-threshold tick() lands late - a
    // JS-timed ramp would just collapse to a hard pop-in in that case.
    el.style.transition = 'opacity 0.4s ease-out';
    container.appendChild(el);

    return resetShard({ el, size: 0, side });
  }

  // Exactly 6 shards spawn (and keep respawning) on each side, never in
  // the middle over the face.
  const shards = [];
  for (let i = 0; i < 6; i++) shards.push(makeShard('left'));
  for (let i = 0; i < 6; i++) shards.push(makeShard('right'));

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
      // hero-scroll.js), so these particles scatter outward in sync with
      // it rather than on their own independent timeline.
      const progress = parseFloat(getComputedStyle(hero).getPropertyValue('--progress')) || 0;
      const burstReach = Math.max(w, h) * 0.9;
      const centerX = w / 2;
      const centerY = h / 2;

      shards.forEach((s) => {
        s.time += dt;
        s.vy = Math.min(s.terminalVy, s.vy + s.gravity * dt); // ease-in acceleration, capped
        s.y += s.vy * dt;
        s.rot += s.rotSpeed * dt;

        if (s.y - s.bounds > h) resetShard(s);

        const sway =
          Math.sin(s.time * s.swayFreq + s.swayPhase) * s.swayAmp +
          Math.sin(s.time * s.swayFreq2 + s.swayPhase2) * s.swayAmp2;
        const x = s.baseX + sway;

        const tiltX = Math.sin(s.time * s.tiltFreqX + s.tiltPhaseX) * s.tiltAmpX;
        const tiltY = Math.sin(s.time * s.tiltFreqY + s.tiltPhaseY) * s.tiltAmpY;

        // Burst outward from the hero's own center, radially, same as the
        // portrait pieces - added on top of the normal fall/sway rather
        // than replacing it.
        let burstX = 0;
        let burstY = 0;
        if (progress > 0) {
          const ddx = x - centerX;
          const ddy = s.y - centerY;
          const dist = Math.hypot(ddx, ddy) || 1;
          const travel = burstReach * s.burstMult * progress;
          burstX = (ddx / dist) * travel;
          burstY = (ddy / dist) * travel;
        }

        s.el.style.transform = `translate3d(${x + burstX}px, ${s.y + burstY}px, 0) rotateZ(${s.rot}deg) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
        s.el.style.opacity = (s.opacity * (1 - progress)).toFixed(2);
      });
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
});
