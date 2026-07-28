document.addEventListener("DOMContentLoaded", () => {
  // A fixed, small column count (rows follow the box's own aspect ratio so
  // cells stay roughly square) - each cell becomes 2 clip-path shards, and
  // clip-path is expensive to rasterize per element, so the total count
  // has to stay low, especially since this recomputes live on mousemove.
  const GRID_COLS = 8;
  const PUSH_RADIUS_FRAC = 0.35; // fraction of the box's larger dimension
  const MAX_PUSH_FRAC = 0.12; // fraction of the box's smaller dimension
  const MAX_ROTATE = 18; // degrees

  // A cell's square boundary is walked as parameter t in [0,4): [0,1) top
  // edge TL->TR, [1,2) right edge TR->BR, [2,3) bottom edge BR->BL, [3,4)
  // left edge BL->TL. Returns the [x%, y%] point at that parameter.
  function edgePoint(t) {
    const seg = Math.floor(t) % 4;
    const frac = t - Math.floor(t);
    switch (seg) {
      case 0:
        return [frac * 100, 0];
      case 1:
        return [100, frac * 100];
      case 2:
        return [100 - frac * 100, 100];
      default:
        return [0, 100 - frac * 100];
    }
  }

  // Splits a cell into two irregular polygons by drawing a straight crack
  // between two random points on its boundary (rather than a clean
  // corner-to-corner diagonal), so shards read as jagged broken glass
  // instead of neat triangle halves.
  function crackPolygons() {
    const tP = Math.random() * 4;
    const tQ = (tP + 1.3 + Math.random() * 1.4) % 4; // keeps both pieces a reasonable size
    const landmarks = [0, 1, 2, 3, tP, tQ].sort((a, b) => a - b);
    const idxP = landmarks.indexOf(tP);
    const idxQ = landmarks.indexOf(tQ);
    const lo = Math.min(idxP, idxQ);
    const hi = Math.max(idxP, idxQ);
    const chainA = landmarks.slice(lo, hi + 1).map(edgePoint);
    const chainB = [...landmarks.slice(hi), ...landmarks.slice(0, lo + 1)].map(edgePoint);
    return [chainA, chainB];
  }

  function polygonCentroidPct(points) {
    const x = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const y = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    return [x, y];
  }

  document.querySelectorAll(".project-card .image").forEach((wrapper) => {
    const imgEl = wrapper.querySelector("img");
    if (!imgEl) return;

    const src = imgEl.getAttribute("src");
    const container = document.createElement("div");
    container.className = "shatter-tiles";
    imgEl.replaceWith(container);

    const source = new Image();
    source.src = src;

    let cols = 0;
    let rows = 0;
    let shards = [];
    let boxW = 0;
    let boxH = 0;

    const buildGrid = (newCols, newRows) => {
      cols = newCols;
      rows = newRows;
      container.innerHTML = "";
      shards = [];

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const [polyA, polyB] = crackPolygons();

          [polyA, polyB].forEach((poly) => {
            const el = document.createElement("div");
            el.className = "shatter-shard";
            el.style.backgroundImage = `url(${src})`;
            el.style.clipPath = `polygon(${poly.map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`).join(", ")})`;

            const [cxPct, cyPct] = polygonCentroidPct(poly);
            shards.push({
              el,
              row,
              col,
              cxPct,
              cyPct,
              centerX: 0,
              centerY: 0,
              rotSign: Math.random() < 0.5 ? -1 : 1,
            });
            container.appendChild(el);
          });
        }
      }
    };

    // Background-size/position use real pixels (matching the image's
    // natural aspect ratio scaled up to "cover" the box) rather than
    // percentages, so the image doesn't distort - this mirrors what
    // object-fit: cover does for a normal <img>, then slices that exact
    // cropped rectangle across the shard grid.
    const layout = () => {
      const naturalW = source.naturalWidth;
      const naturalH = source.naturalHeight;
      boxW = wrapper.clientWidth;
      boxH = wrapper.clientHeight;
      if (!naturalW || !naturalH || !boxW || !boxH) return;

      const newCols = GRID_COLS;
      const newRows = Math.min(12, Math.max(3, Math.round(GRID_COLS * (boxH / boxW))));
      if (newCols !== cols || newRows !== rows) {
        buildGrid(newCols, newRows);
      }

      const scale = Math.max(boxW / naturalW, boxH / naturalH);
      const coverW = naturalW * scale;
      const coverH = naturalH * scale;
      const cropX = (coverW - boxW) / 2;
      const cropY = (coverH - boxH) / 2;
      const tileW = boxW / cols;
      const tileH = boxH / rows;

      shards.forEach((s) => {
        const left = s.col * tileW;
        const top = s.row * tileH;
        s.centerX = left + (s.cxPct / 100) * tileW;
        s.centerY = top + (s.cyPct / 100) * tileH;
        s.el.style.left = `${left}px`;
        s.el.style.top = `${top}px`;
        s.el.style.width = `${tileW}px`;
        s.el.style.height = `${tileH}px`;
        s.el.style.backgroundSize = `${coverW}px ${coverH}px`;
        s.el.style.backgroundPosition = `${-(cropX + left)}px ${-(cropY + top)}px`;
      });
    };

    if (source.complete) {
      layout();
    } else {
      source.addEventListener("load", layout);
    }
    new ResizeObserver(layout).observe(wrapper);

    // Cursor-reactive shatter: shards near the pointer are pushed radially
    // away from it, falling off with distance, so only fragments right
    // under (or close to) the cursor react - farther ones stay settled.
    // Each shard reacts to its own centroid, so the two fragments that
    // share a cell can diverge instead of moving as one rigid square.
    // Recompute is throttled to at most once per animation frame regardless
    // of how many mousemove events fire in between.
    let scheduled = false;
    let pendingX = 0;
    let pendingY = 0;

    const applyPush = (mouseX, mouseY) => {
      const radius = Math.max(boxW, boxH) * PUSH_RADIUS_FRAC;
      const maxPush = Math.min(boxW, boxH) * MAX_PUSH_FRAC;

      shards.forEach((s) => {
        const dx = s.centerX - mouseX;
        const dy = s.centerY - mouseY;
        const dist = Math.hypot(dx, dy);
        let tx = 0;
        let ty = 0;
        let rot = 0;

        if (dist < radius) {
          const factor = 1 - dist / radius;
          const angle = Math.atan2(dy, dx);
          const push = factor * maxPush;
          tx = Math.cos(angle) * push;
          ty = Math.sin(angle) * push;
          rot = factor * MAX_ROTATE * s.rotSign;
        }

        s.el.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`;
      });
    };

    const resetShards = () => {
      shards.forEach((s) => {
        s.el.style.transform = "translate(0px, 0px) rotate(0deg)";
      });
    };

    wrapper.addEventListener("mousemove", (e) => {
      const rect = wrapper.getBoundingClientRect();
      pendingX = e.clientX - rect.left;
      pendingY = e.clientY - rect.top;
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          applyPush(pendingX, pendingY);
        });
      }
    });

    wrapper.addEventListener("mouseleave", resetShards);
  });
});
