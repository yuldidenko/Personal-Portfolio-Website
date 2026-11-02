// Factora project page.
// 1. The carousel: screens ride a horizontal wheel that turns with the
//    page scroll. They travel round the circle but always stay upright
//    and face the viewer. The current one is in front, large and sharp;
//    the next waits on the right, behind it, the previous one has gone
//    left and back - smaller, softly blurred, overlapping like a stack. Native scroll drives it - nothing
//    is hijacked. Small screens, reduced motion and no-JS get a plain list.
// 2. Lightbox: the current screen opens full size (Esc / click closes).
(() => {
  const root = document.documentElement;
  const drum = document.querySelector(".drum");
  if (!drum) return;
  const items = [...drum.querySelectorAll(".drum-item")];
  const strip = drum.querySelector(".drum-counter-strip");
  const videos = drum.querySelectorAll("video");
  // iPhone Safari keeps only a few videos decoded at a time: while the page
  // scrolls it lets go of the picture of paused ones, which then show
  // nothing - the whole phone blinks out and back. The poster painted as
  // the video's own background stays visible underneath in that moment.
  videos.forEach((v) => {
    const poster = v.getAttribute("poster");
    if (poster) {
      v.style.background = `url("${poster}") center / 100% 100% no-repeat`;
    }
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const wide = window.matchMedia("(min-width: 768px)");

  const ANGLE = 40; // degrees between two cabins on the wheel
  const STEP = 0.9; // scroll per screen, in viewport heights
  // Part of each step at either end where the carousel holds still, so a
  // screen rests in the middle for a good stretch of scrolling and the
  // visitor can stop to read or watch without anything moving.
  const HOLD = 0.22;

  let on = false;
  let top = 0;
  let step = 0;
  let radiusX = 0; // how far left/right the wheel reaches
  const RADIUS_Z = 900; // how deep it goes behind the current screen
  let current = -1;
  let ticking = false;

  // A video starts only once its whole phone/screen is in view (so it
  // doesn't run while the visitor is still reading the intro above), and
  // always from the beginning. Anything else is paused.
  const fullyInView = (el) => {
    const r = el.getBoundingClientRect();
    const slack = 8;
    return r.height > 0 && r.top >= -slack && r.bottom <= window.innerHeight + slack;
  };
  const startVideo = (video) => {
    if (!video.paused) return;
    if (!video.dataset.resume) video.currentTime = 0;
    delete video.dataset.resume;
    const p = video.play();
    if (p) p.catch(() => {});
  };
  const syncVideos = (index) => {
    items.forEach((item, i) => {
      const video = item.querySelector("video");
      if (!video) return;
      if (i === index && !reduceMotion.matches && fullyInView(video)) startVideo(video);
      else if (!video.paused) video.pause();
    });
  };

  const measure = () => {
    const vh = window.innerHeight;
    step = vh * STEP;
    // A page can spread the wheel wider (data-spread), e.g. phone slides
    // with text beside them, so neighbours don't reach the text.
    radiusX = window.innerWidth * (parseFloat(drum.dataset.spread) || 0.52);
    drum.style.height = `${vh + step * (items.length - 1)}px`;
    top = drum.getBoundingClientRect().top + window.scrollY;
  };

  // Carousel position for a scroll position: still - smooth move - still.
  const carouselAt = (y) => {
    const raw = Math.min(items.length - 1, Math.max(0, (y - top) / step));
    const base = Math.floor(raw);
    const frac = raw - base;
    const t = Math.min(1, Math.max(0, (frac - HOLD) / (1 - 2 * HOLD)));
    return base + t * t * (3 - 2 * t);
  };

  // How far things on screen have actually moved, in scroll pixels: the
  // page itself above and below the carousel, the carousel's own eased
  // motion inside it (where the page is pinned and screens hold still
  // between moves). The background flower follows this, so it never turns
  // while everything in front of it stands still.
  const visualY = (y) => {
    if (!on || y <= top) return y;
    const span = step * (items.length - 1);
    if (y >= top + span) return y;
    return top + carouselAt(y) * step;
  };

  const render = () => {
    ticking = false;
    const f = carouselAt(window.scrollY);
    items.forEach((item, i) => {
      const d = i - f;
      const a = Math.abs(d);
      if (a > 2.4) {
        item.style.visibility = "hidden";
        return;
      }
      item.style.visibility = "visible";
      // Position on the wheel; no rotation of the screen itself - it
      // stays upright like a hanging cabin.
      const t = (d * ANGLE * Math.PI) / 180;
      const x = radiusX * Math.sin(t);
      const z = -RADIUS_Z * (1 - Math.cos(t));
      item.style.transform =
        `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, 0, ${z.toFixed(1)}px)`;
      // Two neighbours swap which one is in front exactly half-way. To
      // keep that swap from snapping, only the edges that cross become
      // see-through while they pass each other: the right side of the
      // screen moving left, the left side of the one coming in. The rest
      // of each screen stays solid. Screens further back fade as before.
      const media = item.querySelector(".drum-media");
      if (a <= 1) {
        const dip = Math.max(0, 1 - Math.abs(a - 0.5) / 0.22); // 0..1, peak at 0.5
        const eased = dip * dip * (3 - 2 * dip); // smoothstep
        if (eased > 0.001) {
          const edge = (1 - eased * 0.3).toFixed(3); // at most ~30% see-through
          const dir = d > 0 ? "to right" : "to left"; // fade the side facing the centre
          const mask = `linear-gradient(${dir}, rgba(0,0,0,${edge}) 0%, #000 60%)`;
          media.style.webkitMaskImage = mask;
          media.style.maskImage = mask;
        } else {
          media.style.webkitMaskImage = "";
          media.style.maskImage = "";
        }
        item.style.opacity = "1";
      } else {
        media.style.webkitMaskImage = "";
        media.style.maskImage = "";
        item.style.opacity = String(Math.max(0, 1 - (a - 1) * 0.6));
      }
      // Only the front caption is readable; the others fade out fast.
      item.style.setProperty("--caption", String(Math.max(0, 1 - a * 2.5)));
      // Sharp in front, blur grows as a screen moves round to the back.
      const blur = Math.max(0, a - 0.5) * 4;
      item.style.filter = blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : "none";
      item.style.zIndex = String(100 - Math.round(a * 10));
    });
    const index = Math.round(f);
    if (index !== current) {
      if (items[current]) items[current].classList.remove("is-current");
      items[index].classList.add("is-current");
      current = index;
      if (strip) strip.style.setProperty("--active", index);
    }
    syncVideos(index);
  };

  // Settle on the nearest screen once scrolling stops, so the page never
  // rests half-way between two screens. Only nudges after the visitor
  // lets go - scrolling itself is never taken over.
  //
  // A mouse wheel scrolls in small separate notches, and the browser
  // reports "scroll ended" after every one of them - settling right then
  // would pull the page back after each notch (the jerking). So we wait
  // until the visitor has really stopped (no wheel, touch, key or scroll
  // for a moment), and we settle in the direction they were going: even a
  // small push forward moves on to the next screen, never back.
  const IDLE = 260; // ms of calm before settling
  let settleTimer = 0;
  let settled = 0; // index the carousel last came to rest on
  let snapping = false;
  let autoStep = false;
  let snapRaf = 0;
  let snapLast = false;
  let glideY = null; // the position our glide last set
  let snapFrom = 0;
  let snapTo = 0;
  // Is the page at y still on the settle's own path (between where it
  // started and where it is heading)? Anything else - a scrollbar drag,
  // a jump, a key - is the visitor, and ends the settle.
  const onSnapPath = (y) =>
    y >= Math.min(snapFrom, snapTo) - 2 && y <= Math.max(snapFrom, snapTo) + 2;

  // The carousel no longer moves the page by itself (visitors found it
  // pulling them on while they stopped to read); the still zones above
  // do that job instead. Kept as a no-op so the rest stays simple.
  const SETTLE = false;
  const settle = () => {
    if (!on || !SETTLE) return;
    const raw = (window.scrollY - top) / step;
    if (raw <= 0 || raw >= items.length - 1) {
      settled = Math.max(0, Math.min(items.length - 1, Math.round(raw)));
      return; // outside the carousel - leave the page alone
    }
    let target;
    if (raw - settled > 0.12) target = Math.ceil(raw);
    else if (settled - raw > 0.12) target = Math.floor(raw);
    else target = Math.round(raw);
    settled = target;
    if (Math.abs(raw - target) < 0.005) return;
    snapping = true;
    snapFrom = window.scrollY;
    snapTo = top + target * step;
    // Our own eased glide (not the browser's smooth scroll), so it can be
    // stopped instantly the moment the visitor scrolls again.
    // Start the clock on the first frame: a frame's timestamp can be a
    // little earlier than "now", which would give a negative progress and
    // nudge the page the wrong way for a frame.
    let t0 = null;
    const dur = Math.min(600, 250 + Math.abs(snapTo - snapFrom) * 0.6);
    const glide = (now) => {
      if (!snapping) return;
      if (t0 === null) t0 = now;
      const k = Math.min(1, Math.max(0, (now - t0) / dur));
      const e = 1 - Math.pow(1 - k, 3);
      glideY = Math.round(snapFrom + (snapTo - snapFrom) * e);
      window.scrollTo({ top: glideY, behavior: "instant" });
      if (k < 1) snapRaf = requestAnimationFrame(glide);
      else snapLast = true; // the scroll event of this final step is still ours
    };
    snapRaf = requestAnimationFrame(glide);
  };

  const armSettle = () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, IDLE);
  };
  // Any new input cancels a pending or running settle.
  const onInput = () => {
    if (snapping) {
      // Stop the settle's glide on the spot.
      snapping = false;
      snapLast = false;
      cancelAnimationFrame(snapRaf);
    }
    armSettle();
  };
  ["wheel", "touchmove", "keydown", "pointerdown"].forEach((type) =>
    window.addEventListener(type, onInput, { passive: true })
  );
  window.addEventListener("touchend", armSettle, { passive: true });

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(render);
    }
    if (snapping && !onSnapPath(window.scrollY)) snapping = false;
    // Tells the flower whether this scroll step was the settle's own -
    // also when the visitor has just cancelled it and this event is the
    // glide's last step still arriving.
    autoStep = snapping || (glideY !== null && Math.abs(window.scrollY - glideY) < 1);
    glideY = null;
    if (snapLast) {
      snapLast = false;
      snapping = false;
    }
    if (snapping) return; // our own settle glide is running
    armSettle();
  };

  const enable = () => {
    if (on) return;
    on = true;
    drum.classList.add("is-3d");
    measure();
    current = -1;
    render();
    window.addEventListener("scroll", onScroll, { passive: true });
  };

  const disable = () => {
    if (!on) return;
    on = false;
    drum.classList.remove("is-3d");
    window.removeEventListener("scroll", onScroll);
    drum.style.height = "";
    items.forEach((item) => {
      item.removeAttribute("style");
      const media = item.querySelector(".drum-media");
      if (media) media.removeAttribute("style");
      item.classList.remove("is-current");
    });
    current = -1;
  };

  // Flat list: play the video only while it's on screen.
  let flatIO = null;
  const watchFlatVideos = () => {
    if (flatIO || !("IntersectionObserver" in window)) return;
    flatIO = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, intersectionRatio }) => {
          if (on) return;
          // Resume where it stopped: rewinding a paused video makes iOS
          // show an empty frame until it has seeked, so it blinks.
          if (intersectionRatio >= 0.95 && !reduceMotion.matches) {
            if (target.currentTime > 0) target.dataset.resume = "1";
            startVideo(target);
          }
          else if (intersectionRatio < 0.5 && !target.paused) target.pause();
        });
      },
      { threshold: [0, 0.5, 0.95] }
    );
    videos.forEach((v) => flatIO.observe(v));
  };

  // The intro text is exactly as wide as the first screen.
  const firstScreen = drum.querySelector(".drum-item .drum-screen");
  const matchLead = () => {
    // A phone is much narrower than a desktop screen - then keep the
    // same text width as on the desktop projects (set in case.css).
    if (firstScreen && firstScreen.classList.contains("drum-phone")) return;
    if (firstScreen && firstScreen.offsetWidth) {
      root.style.setProperty("--lead-w", `${firstScreen.offsetWidth}px`);
    }
  };

  const update = () => {
    if (wide.matches && !reduceMotion.matches) enable();
    else disable();
    matchLead();
  };

  update();
  watchFlatVideos();
  wide.addEventListener("change", update);
  reduceMotion.addEventListener("change", update);
  window.addEventListener("resize", () => {
    matchLead();
    if (!on) return;
    measure();
    render();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (on) {
        measure();
        render();
      }
    });
  }

  // --- Sound: videos are muted (browsers only autoplay silently); a
  //     slide can offer a button that turns its sound on. It jumps to the
  //     moment the sound starts in the recording (data-sound-start), or -
  //     with data-sound-end - only when that moment has already gone. ---
  drum.querySelectorAll(".drum-sound").forEach((button) => {
    const item = button.closest(".drum-item");
    const video = item && item.querySelector("video");
    if (!video) return;
    const label = button.querySelector(".drum-sound-label");
    const set = (on) => {
      video.muted = !on;
      button.setAttribute("aria-pressed", String(on));
      if (label) label.textContent = on ? "Sound on" : "Play with sound";
    };
    button.addEventListener("click", () => {
      const on = video.muted;
      if (on) {
        // With data-sound-end the video keeps playing where it is and the
        // sound simply comes in at its moment; it only jumps back (to
        // data-sound-start) if that moment has already passed.
        const start = parseFloat(video.dataset.soundStart);
        const end = parseFloat(video.dataset.soundEnd);
        const passed = Number.isNaN(end) || video.currentTime > end;
        if (!Number.isNaN(start) && passed) video.currentTime = start;
        video.dataset.resume = "1";
        const p = video.play();
        if (p) p.catch(() => {});
      }
      set(on);
    });
    // Leaving the slide (it gets paused) silences it again.
    video.addEventListener("pause", () => set(false));
  });

  // --- Background illustration: its angle is a direct function of the
  //     scroll position - 0deg at the top of the page, exactly 360deg at
  //     the very bottom, at an even speed. Nothing else moves the page any more, so there is no
  //     smoothing or catching up: when scrolling stops, the flower stops. ---
  const spin = document.querySelector(".case-bg-spin");
  if (spin && !reduceMotion.matches) {
    const TURN = 360;
    const orbits = [...spin.querySelectorAll(".orbit")];
    orbits.forEach((g) => (g.k = parseFloat(g.dataset.k) || 1));
    let queued = false;
    const paint = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, visualY(window.scrollY) / max)) : 0;
      // Even speed: the same turn for every pixel things actually move.
      const angle = TURN * p;
      spin.style.setProperty("--spin", `${angle.toFixed(2)}deg`);
      // A drawn system (Cultural Planet): every orbit turns at its own
      // speed (data-k), set as an SVG transform so it works in every browser.
      orbits.forEach((g) => {
        g.setAttribute("transform", `rotate(${(angle * g.k).toFixed(2)} 500 500)`);
      });
    };
    const request = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(paint);
      }
    };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    paint();
  }

  // --- Good Food: fork and knife take a table-etiquette position for
  //     each flow. They follow the carousel itself (holding still while a
  //     screen rests, moving as it turns), so the change reads as part of
  //     the same motion. ---
  const cutlery = document.querySelector(".case-bg-cutlery");
  if (cutlery) {
    const fork = cutlery.querySelector(".cut-fork");
    const knife = cutlery.querySelector(".cut-knife");
    const labels = [...cutlery.querySelectorAll(".cut-label")];
    // [x, y, angle] for the fork and the knife; angle 0 = tips up.
    const POSES = [
      [[150, 500, 0], [850, 500, 0]], // ready to start: laid either side
      [[415, 520, 32], [585, 520, -32]], // pause: an upturned V
      [[500, 470, 0], [500, 525, -90]], // ready for the next course: a cross
      [[500, 445, -90], [500, 560, -90]], // excellent: side by side, across
      [[470, 500, -58], [545, 545, -58]], // finished: together at four o'clock
      [[150, 500, 0], [850, 500, 0]], // see you next time: laid again
    ];
    const last = POSES.length - 1;
    const lerp = (a, b, t) => a + (b - a) * t;
    const place = (g, a, b, t) =>
      g.setAttribute(
        "transform",
        `translate(${lerp(a[0], b[0], t).toFixed(1)} ${lerp(a[1], b[1], t).toFixed(1)}) rotate(${lerp(a[2], b[2], t).toFixed(1)})`
      );
    let queuedCut = false;
    const pose = () => {
      queuedCut = false;
      let f;
      if (on) f = carouselAt(window.scrollY) * (last / Math.max(1, items.length - 1));
      else {
        // Plain list (narrow screens): follow the flow nearest the middle
        // of the window, so the position always matches the caption read.
        const mid = window.innerHeight / 2;
        const cs = items.map((it) => {
          const r = it.getBoundingClientRect();
          return r.top + r.height / 2;
        });
        f = 0;
        if (mid >= cs[cs.length - 1]) f = cs.length - 1;
        else
          for (let k = 0; k < cs.length - 1; k++) {
            if (mid >= cs[k] && mid < cs[k + 1]) {
              const t = (mid - cs[k]) / (cs[k + 1] - cs[k]);
              const h = Math.min(1, Math.max(0, (t - 0.3) / 0.4));
              f = k + h * h * (3 - 2 * h);
              break;
            }
          }
        f *= last / Math.max(1, items.length - 1);
      }
      f = Math.min(last, Math.max(0, f));
      if (reduceMotion.matches) f = Math.round(f);
      // Above the carousel the drawing sits lower, clear of the title, and
      // rises to the centre as the visitor scrolls down to the first screen.
      const drumTop = drum.getBoundingClientRect().top + window.scrollY;
      const k = drumTop > 0 ? Math.min(1, Math.max(0, window.scrollY / drumTop)) : 1;
      cutlery.style.transform = `translateY(${((1 - k) * 0.24 * window.innerHeight).toFixed(1)}px)`;
      const i = Math.min(last - 1, Math.floor(f));
      const t = f - i;
      place(fork, POSES[i][0], POSES[i + 1][0], t);
      place(knife, POSES[i][1], POSES[i + 1][1], t);
      labels.forEach((el, k) => {
        el.style.opacity = (0.55 * Math.max(0, 1 - Math.abs(f - k) * 2.5)).toFixed(3);
      });
    };
    const requestCut = () => {
      if (!queuedCut) {
        queuedCut = true;
        requestAnimationFrame(pose);
      }
    };
    window.addEventListener("scroll", requestCut, { passive: true });
    window.addEventListener("resize", requestCut);
    pose();
  }

  // --- Lightbox ---
  const box = document.querySelector(".lightbox");
  const boxImg = box && box.querySelector(".lightbox-img");
  if (box && boxImg && typeof box.showModal === "function") {
    drum.querySelectorAll(".drum-zoom").forEach((button) => {
      button.addEventListener("click", () => {
        const img = button.querySelector("img");
        boxImg.src = button.dataset.full;
        boxImg.alt = img ? img.alt : "";
        box.showModal();
      });
    });
    // Any click closes it - the whole overlay is the "close" target.
    box.addEventListener("click", () => box.close());
    box.addEventListener("close", () => {
      boxImg.removeAttribute("src");
      // The custom cursor may still think it's over a screen.
      document.querySelector(".cursor-dot")?.classList.remove("cursor-view");
      document.querySelector(".cursor-outline")?.classList.remove("cursor-view-active");
    });
  }
})();
