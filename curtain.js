// Bead curtain over a project cover (cards marked data-curtain).
// Strands of crystal beads hang from the top edge in front of the design. The
// pointer parts them softly - beads near it are pushed aside and swing
// back with a little sway, like a real bead curtain. Verlet physics on a
// canvas; runs only while the card is on screen.
//  - First time a card scrolls into view, the curtain parts by itself for
//    a moment, so the work is seen even without hovering.
//  - Touch screens: it parts as the card passes the middle of the screen.
//  - Reduced motion: no curtain, the design is simply shown.
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotion.matches) return;

  const GRAVITY = 0.3;
  const DAMPING = 0.975;
  const END_GAP = 8; // px between every strand's tip and the cover's bottom
  const TIP = 2.2; // the last bead's reach below its centre, in bead sizes
  const OUTLINE = 1; // px, same as the divider under the project numbers
  const ITER = 8; // stiff enough that long strands don't stretch

  document.querySelectorAll(".project-card .image[data-curtain]").forEach((wrap) => {
    // "morning": clear glass with a pale aurora shimmer (iridescent AB
    // crystals) - light and airy. Default: the warm sunset palette.
    const morning = wrap.dataset.curtainPalette === "morning";
    // "planet": Cultural Planet's own violet, rose and pearl-grey glass.
    const planet = wrap.dataset.curtainPalette === "planet";
    const glassy = morning || planet; // clear, silvery strands
    // "food": Good Food's own lime and orange glass.
    const food = wrap.dataset.curtainPalette === "food";
    const canvas = document.createElement("canvas");
    canvas.className = "bead-curtain";
    canvas.setAttribute("aria-hidden", "true");
    wrap.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    let W = 0;
    let H = 0;
    let dpr = 1;
    let strands = []; // [{ pts: [{x,y,px,py}], rest }]
    let bead = 4;

    // Arched top (case: data-curtain-arch on the card): a half-ellipse as
    // wide as the cover, ARCH_K of its width tall.
    const ARCH_K = 0.3;
    const arched = wrap.hasAttribute("data-curtain-arch");
    const archY = (x) => {
      if (!arched) return 0;
      const rx = W / 2;
      const ry = W * ARCH_K;
      const u = Math.min(1, Math.abs(x - rx) / rx);
      return ry - ry * Math.sqrt(1 - u * u);
    };

    // Physics without pointer or wind: lets a strand hang still.
    const settle = (s, frames) => {
      const pts = s.pts;
      for (let f = 0; f < frames; f++) {
        for (let i = 1; i < pts.length; i++) {
          const p = pts[i];
          const nx = p.x + (p.x - p.px) * DAMPING;
          const ny = p.y + (p.y - p.py) * DAMPING + GRAVITY;
          p.px = p.x; p.py = p.y; p.x = nx; p.y = ny;
        }
        constrain(s);
      }
      for (const p of pts) { p.px = p.x; p.py = p.y; }
    };
    const constrain = (s) => {
      const pts = s.pts;
      for (let k = 0; k < ITER; k++) {
        pts[0].x = pts[0].ax;
        pts[0].y = s.y0;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const diff = (d - s.rest) / d;
          if (i === 1) {
            b.x -= dx * diff;
            b.y -= dy * diff;
          } else {
            a.x += dx * diff * 0.5;
            a.y += dy * diff * 0.5;
            b.x -= dx * diff * 0.5;
            b.y -= dy * diff * 0.5;
          }
        }
      }
    };

    const build = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const gap = Math.max(9, W / 46); // between strands
      bead = gap * 0.17;
      const step = bead * 2.2; // beads strung close together
      const cols = Math.floor(W / gap);
      const off = (W - (cols - 1) * gap) / 2;
      strands = [];
      for (let c = 0; c < cols; c++) {
        const x = off + c * gap;
        const y0 = archY(x); // strands hang from the arch's curve
        // Every strand's tip (its teardrop) ends the same distance above the
        // cover's bottom edge: END_GAP px, measured to the drop's lowest point.
        const tipY = H - END_GAP - bead * TIP;
        const n = Math.max(2, Math.round((tipY - y0) / step));
        const pts = [];
        for (let i = 0; i <= n; i++) {
          const y = y0 + i * step;
          pts.push({ x, y, px: x, py: y, ax: x });
        }
        strands.push({ pts, rest: (tipY - y0) / n, phase: Math.random() * 6.28, y0, tipY });
      }
      // Gravity stretches a strand a little, and longer ones more, so the
      // rest length is calibrated until each settled tip sits exactly at
      // tipY. Strands of the same length hang the same way, so each length
      // is simulated once and the result copied across (shifted sideways):
      // simulating every strand took seconds and held up the whole page.
      const solved = new Map();
      for (const s of strands) {
        const key = `${s.pts.length}|${Math.round(s.y0 * 10)}`;
        const ref = solved.get(key);
        if (ref) {
          s.rest = ref.rest;
          const dx = s.pts[0].ax - ref.pts[0].ax;
          s.pts.forEach((p, i) => {
            const q = ref.pts[i];
            p.x = p.px = q.x + dx;
            p.y = p.py = q.y;
          });
          continue;
        }
        for (let pass = 0; pass < 4; pass++) {
          settle(s, 260);
          const end = s.pts[s.pts.length - 1].y;
          s.rest *= (s.tipY - s.y0) / (end - s.y0);
        }
        settle(s, 260);
        solved.set(key, s);
      }
    };

    // Pointer in card coordinates.
    const ptr = { x: -9999, y: -9999, px: -9999, py: -9999, inside: false };
    let auto = null; // automatic parting {t0, dur}

    const step = (t) => {
      let energy = 0;
      const R = Math.max(W, H) * 0.13; // pointer radius
      const vx = ptr.x - ptr.px;
      const vy = ptr.y - ptr.py;
      ptr.px = ptr.x;
      ptr.py = ptr.y;

      // Automatic parting: a soft wide push from the middle outwards.
      let autoK = 0;
      if (auto) {
        const k = (t - auto.t0) / auto.dur;
        if (k >= 1) auto = null;
        else autoK = Math.sin(Math.PI * Math.min(1, k)) * 0.5;
      }

      for (const s of strands) {
        const pts = s.pts;
        for (let i = 1; i < pts.length; i++) {
          const p = pts[i];
          let nx = p.x + (p.x - p.px) * DAMPING;
          let ny = p.y + (p.y - p.py) * DAMPING + GRAVITY;
          p.px = p.x;
          p.py = p.y;
          // a breath of air so it never looks frozen
          nx += Math.sin(t * 0.0011 + s.phase + i * 0.15) * 0.012 * i * 0.08;
          if (ptr.inside) {
            const dx = nx - ptr.x;
            const dy = ny - ptr.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < R * R) {
              const d = Math.sqrt(d2) || 1;
              const f = (1 - d / R) ** 2;
              // soft: a gentle sideways nudge plus a little of the
              // pointer's own motion, so strands drift rather than fly
              nx += (dx / d) * f * 1.6 + vx * f * 0.12;
              ny += (dy / d) * f * 0.5 + vy * f * 0.05;
            }
          }
          if (autoK > 0) {
            const side = p.ax < W / 2 ? -1 : 1;
            const near = 1 - Math.min(1, Math.abs(p.ax - W / 2) / (W * 0.55));
            nx += side * autoK * near * 2.2 * (i / pts.length);
          }
          energy += Math.abs(nx - p.px) + Math.abs(ny - p.py);
          p.x = nx;
          p.y = ny;
        }
        constrain(s);
      }
      return energy > 0.5;
    };

    // Crystal curtain: strands of tiny clear glass beads with a faceted
    // crystal every few beads - teardrops and diamonds with an iridescent
    // (aurora borealis) shimmer, like a real crystal bead curtain.
    let clear = [];
    let crystals = [];
    const hsl = (h, s2, l, a) => `hsla(${h},${s2}%,${l}%,${a})`;
    const sprite = (size, paint) => {
      const cnv = document.createElement("canvas");
      cnv.width = cnv.height = Math.ceil(size * dpr);
      const g = cnv.getContext("2d");
      g.scale(dpr, dpr);
      paint(g, size / 2);
      return cnv;
    };
    const makePearl = () => {
      clear = [];
      crystals = [];
      // tiny clear beads
      const cr = bead * 0.75;
      for (let v = 0; v < 6; v++) {
        const tint = 22 + v * 6; // warm amber glass
        const cool = planet ? 255 + v * 9 : 200 + v * 12; // clear glass glint
        clear.push(
          sprite(cr * 2 + 2, (g, c) => {
            const body = g.createRadialGradient(c - cr * 0.3, c - cr * 0.35, cr * 0.1, c, c, cr);
            if (food) {
              const h = v % 2 ? 62 : 26; // lime / orange
              body.addColorStop(0, "rgba(255,250,225,0.95)");
              body.addColorStop(0.5, hsl(h, 80, 62, 0.55));
              body.addColorStop(1, hsl(h, 75, 44, 0.9));
            } else if (glassy) {
              body.addColorStop(0, "rgba(255,255,255,0.98)");
              body.addColorStop(0.5, hsl(cool, 30, 88, 0.45));
              body.addColorStop(1, hsl(cool, 18, 72, 0.85));
            } else {
              body.addColorStop(0, "rgba(255,244,220,0.95)");
              body.addColorStop(0.5, hsl(tint, 70, 62, 0.5));
              body.addColorStop(1, hsl(tint, 60, 45, 0.85));
            }
            g.fillStyle = body;
            g.beginPath();
            g.arc(c, c, cr, 0, Math.PI * 2);
            g.fill();
          })
        );
      }
      // faceted crystals: teardrop (0) or diamond (1). Sunset glass in the
      // portrait's palette - amber, honey, terracotta, brick red, copper -
      // with now and then a deep teal or olive for depth, as in old glass.
      // Every colour of the hero portrait and the Approach illustrations.
      const SITE = [
        "#B04830", "#CF5234", "#AF5B37", "#E06539", "#B03F13", "#EB8D59",
        "#CC8342", "#D29D28", "#CDA03B", "#EFB22C", "#EBC93D", "#FFE333",
        "#E7D893", "#E2B186", "#097DB0", "#036896", "#316A88", "#005971",
        "#49A7C0", "#94DBEF", "#2F6F52", "#3B825A",
      ];
      const toHsl = (hex) => {
        const n = parseInt(hex.slice(1), 16);
        const r0 = (n >> 16) / 255, g0 = ((n >> 8) & 255) / 255, b0 = (n & 255) / 255;
        const mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0);
        const l = (mx + mn) / 2;
        let h = 0, sa = 0;
        if (mx !== mn) {
          const d = mx - mn;
          sa = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
          h = mx === r0 ? (g0 - b0) / d + (g0 < b0 ? 6 : 0) : mx === g0 ? (b0 - r0) / d + 2 : (r0 - g0) / d + 4;
          h *= 60;
        }
        return [Math.round(h), Math.round(sa * 100), Math.round(l * 100)];
      };
      // Morning: clear crystals catching a pale rainbow - sky, lilac,
      // rose, mint, peach, lemon, aqua - plus plenty of plain clear glass.
      const MORNING = [
        "#9FD4FF", "#C9B6FF", "#FFB8D9", "#B6F0D8", "#FFD2A8", "#FFF3A6",
        "#A8ECF2", "#DCE6F2", "#E4EAF4", "#D8E2EE",
      ];
      const PLANET = [
        "#8C7CF2", "#6E5CD6", "#5A49B8", "#A99BF0", "#C6B2EC", "#B06CC8",
        "#D98BC0", "#E8B9D3", "#F2A9CF", "#E9E7EE", "#D9D4E4", "#F3F1F6",
      ];
      const PAL = morning ? MORNING : planet ? PLANET : SITE;
      const R = bead * 2.1;
      for (let v = 0; v < 44; v++) {
        const shape = v % 2;
        const [h0, sat, lum0] = toHsl(PAL[v % PAL.length]);
        const lum = morning ? Math.min(80, lum0) : planet ? Math.min(74, lum0) : Math.min(62, lum0);
        crystals.push(
          sprite(R * 2 + 4, (g, c) => {
            const path = () => {
              g.beginPath();
              if (shape === 0) {
                g.moveTo(c, c - R);
                g.bezierCurveTo(c + R * 0.75, c - R * 0.1, c + R * 0.7, c + R * 0.75, c, c + R * 0.8);
                g.bezierCurveTo(c - R * 0.7, c + R * 0.75, c - R * 0.75, c - R * 0.1, c, c - R);
              } else {
                g.moveTo(c, c - R);
                g.lineTo(c + R * 0.62, c);
                g.lineTo(c, c + R);
                g.lineTo(c - R * 0.62, c);
              }
              g.closePath();
            };
            const grad = g.createLinearGradient(c - R, c - R, c + R, c + R);
            // glowing like glass with the low sun behind it: bright warm
            // core, rich colour, deeper edge
            if (morning) {
              // clear glass: white light, the tint only in the middle,
              // and a second hue at the edge like an aurora coating
              grad.addColorStop(0, "rgba(255,255,255,0.95)");
              grad.addColorStop(0.45, hsl(h0, sat, lum, 0.7));
              grad.addColorStop(0.8, hsl(h0 + 60, sat * 0.8, lum + 4, 0.6));
              grad.addColorStop(1, hsl(h0 + 20, 20, 70, 0.85));
            } else {
              grad.addColorStop(0, hsl(h0 + 8, sat, lum + 28, 0.9));
              grad.addColorStop(0.4, hsl(h0, sat, lum + 8, 0.85));
              grad.addColorStop(0.75, hsl(h0 - 6, sat, lum, 0.9));
              grad.addColorStop(1, hsl(h0 - 10, sat, lum - 18, 0.95));
            }
            path();
            g.fillStyle = grad;
            g.fill();
            // facets
            g.save();
            path();
            g.clip();
            g.strokeStyle = glassy ? "rgba(255,255,255,0.6)" : "rgba(255,236,200,0.5)";
            g.lineWidth = 0.6;
            g.beginPath();
            g.moveTo(c - R, c - R * 0.15);
            g.lineTo(c + R, c + R * 0.25);
            g.moveTo(c, c - R);
            g.lineTo(c, c + R);
            g.stroke();
            g.fillStyle = glassy ? "rgba(255,255,255,0.9)" : "rgba(255,246,225,0.75)";
            g.beginPath();
            g.ellipse(c - R * 0.18, c - R * 0.45, R * 0.16, R * 0.28, -0.4, 0, Math.PI * 2);
            g.fill();
            g.restore();
            path();
            g.strokeStyle = morning ? "rgba(255,255,255,0.85)" : planet ? hsl(h0 + 10, 70, 88, 0.8) : hsl(h0 + 10, 90, 80, 0.8);
            g.lineWidth = 0.7;
            g.stroke();
          })
        );
      }
      strands.forEach((st) => {
        st.pts.forEach((p, i) => {
          p.cry = -1;
          p.spr = Math.floor(Math.random() * clear.length);
          // only tiny round beads - no larger crystals
        });
      });
    };

    // The first non-transparent background behind the cover.
    let bgCache = "";
    const pageBg = () => {
      if (bgCache) return bgCache;
      let el = wrap.parentElement;
      while (el) {
        const c = getComputedStyle(el).backgroundColor;
        if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) return (bgCache = c);
        el = el.parentElement;
      }
      return (bgCache = "#fffaed");
    };

    const draw = (t = performance.now()) => {
      ctx.clearRect(0, 0, W, H);
      // Above the arch the page shows through (the corners are filled with
      // the page's own background), so the cover itself is arch-shaped.
      if (arched) {
        ctx.fillStyle = pageBg();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for (let x = 0; x <= W; x += 3) ctx.lineTo(x, archY(x));
        ctx.lineTo(W, archY(W));
        ctx.lineTo(W, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = morning ? "rgba(232,238,248,0.35)" : planet ? "rgba(226,214,246,0.35)" : "rgba(255,214,160,0.3)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (const s of strands) {
        const pts = s.pts;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      const cs = clear[0].width / dpr;
      const co = cs / 2;
      const ks = crystals[0].width / dpr;
      const ko = ks / 2;
      for (const s of strands) {
        for (let i = 1; i < s.pts.length; i++) {
          const p = s.pts[i];
          if (p.cry < 0) {
            ctx.drawImage(clear[p.spr], p.x - co, p.y - co, cs, cs);
          } else {
            ctx.drawImage(crystals[p.cry], p.x - ko, p.y - ko, ks, ks);
          }
        }
      }
      // sparkles: crystals catch the light now and then, more when moving
      ctx.globalCompositeOperation = "lighter";
      for (const s of strands) {
        for (let i = 1; i < s.pts.length; i++) {
          const p = s.pts[i];
          if (p.cry < 0) continue;
          const v = Math.abs(p.x - p.px) + Math.abs(p.y - p.py);
          const k = Math.pow(Math.max(0, Math.sin(t * 0.0016 + p.sp + p.x * 0.02)), 24) + Math.min(1, v * 0.4);
          if (k < 0.05) continue;
          ctx.fillStyle = glassy
            ? `rgba(255,255,255,${Math.min(0.9, k * 0.8)})`
            : `rgba(255,232,180,${Math.min(0.9, k * 0.8)})`;
          ctx.beginPath();
          ctx.arc(p.x - bead * 0.4, p.y - bead * 0.9, bead * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "source-over";
      if (arched) {
        // The cover keeps its square outline: a thin dark line round all
        // four sides, and the arch itself drawn as a line inside it (the
        // strands hang from it). The corners above the arch stay page-light.
        const e = OUTLINE / 2;
        ctx.strokeStyle = "#1f1f1f";
        ctx.lineWidth = OUTLINE;
        ctx.strokeRect(e, e, W - OUTLINE, H - OUTLINE);
        ctx.beginPath();
        ctx.moveTo(e, archY(e) + e);
        for (let x = 4; x < W; x += 4) ctx.lineTo(x, archY(x) + e);
        ctx.lineTo(W - e, archY(W - e) + e);
        ctx.stroke();
      } else {
        // The rail the strands hang from.
        ctx.strokeStyle = morning ? "rgba(232,238,248,0.5)" : planet ? "rgba(226,214,246,0.5)" : food ? "rgba(222,226,120,0.5)" : "rgba(255,214,160,0.45)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0.75);
        ctx.lineTo(W, 0.75);
        ctx.stroke();
      }
    };

    let running = false;
    let visible = false;
    const loop = (t) => {
      if (!visible) {
        running = false;
        return;
      }
      const moved = step(t);
      draw(t); // always: crystals sparkle even when still
      requestAnimationFrame(loop);
    };
    const start = () => {
      if (!running && visible) {
        running = true;
        requestAnimationFrame(loop);
      }
    };

    const setPtr = (e) => {
      const r = wrap.getBoundingClientRect();
      ptr.x = e.clientX - r.left;
      ptr.y = e.clientY - r.top;
    };
    wrap.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      setPtr(e);
      ptr.px = ptr.x;
      ptr.py = ptr.y;
      ptr.inside = true;
    });
    wrap.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      setPtr(e);
    });
    wrap.addEventListener("pointerleave", () => {
      ptr.inside = false;
    });

    const part = (dur) => {
      auto = { t0: performance.now(), dur };
    };

    const coarse = window.matchMedia("(hover: none)");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          visible = en.isIntersecting;
          if (visible) start();
          // On desktop the curtain simply hangs down and waits for the
          // pointer; only touch screens (no hover) get a gentle parting.
          if (coarse.matches && en.intersectionRatio > 0.6) part(2600);
        });
      },
      { threshold: [0, 0.6] }
    );

    const init = () => {
      build();
      makePearl();
      draw();
      io.observe(wrap);
    };
    init();
    new ResizeObserver(() => {
      // The cover's height follows the text beside it, which can change
      // after web fonts load - rebuild on height as well as width, so the
      // strands always reach END_GAP above the bottom.
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (Math.abs(w - W) > 2 || Math.abs(h - H) > 2) {
        build();
        makePearl();
        draw();
      }
    }).observe(wrap);
  });
})();
