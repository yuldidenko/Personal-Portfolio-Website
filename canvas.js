window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('drawingCanvas');
  const ctx = canvas.getContext('2d');

  const colorControlLabel = document.querySelector('.color-control label[title="Choose color"]');
  const colorPalette = document.querySelector('.color-palette');
  const colorOptions = document.querySelectorAll('.color-option');

  const lineWidthControlLabel = document.querySelector('.linewidth-control label[title="Line width"]');
  const lineWidthPalette = document.querySelector('.linewidth-palette');
  const lineWidthOptions = document.querySelectorAll('.linewidth-option');

  const clearBtn = document.getElementById('delete-button');
  const eraserBtn = document.getElementById('eraser-button');

  let drawing = false;
  let isErasing = false;
  let lineWidth = 3;
  let currentColor = '#000000';
  let startX = 0;
  let startY = 0;
  let hasMoved = false;
  const DRAG_THRESHOLD = 3; // px - below this, a mousedown/up is treated as a fill click, not a stroke

  
  function resizeCanvasToDisplaySize(canvas, ctx) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
  
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
  }
  
  resizeCanvasToDisplaySize(canvas, ctx);

  window.addEventListener("resize", () => {
    resizeCanvasToDisplaySize(canvas, ctx);
  });

  
  colorControlLabel.addEventListener('click', () => {
    colorPalette.classList.toggle('active');
    lineWidthPalette.classList.remove('active');
  });

 
  colorOptions.forEach(option => {
    option.addEventListener('click', () => {
      drawing = false;
      isErasing = false;
      eraserBtn.classList.remove('active');
      const selectedColor = option.dataset.color;
      currentColor = selectedColor;
      ctx.beginPath();
      colorPalette.classList.remove('active');
    });
  });
  
  
  lineWidthControlLabel.addEventListener('click', () => {
    lineWidthPalette.classList.toggle('active');
    colorPalette.classList.remove('active');
  });

  
  lineWidthOptions.forEach(option => {
    option.addEventListener('click', () => {
      const selectedWidth = parseInt(option.dataset.width);
      lineWidth = selectedWidth;
      lineWidthPalette.classList.remove('active');
    });
  });

  eraserBtn.addEventListener('click', () => {
    isErasing = true;
    eraserBtn.classList.toggle('active', isErasing);
  });

  canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    hasMoved = false;
    const { x, y } = getCanvasCoordinates(e);
    startX = x;
    startY = y;
    ctx.beginPath();
    ctx.moveTo(x, y);
  });

  canvas.addEventListener('mousemove', draw);

  canvas.addEventListener('mouseup', () => {
    if (drawing && !hasMoved) {
      floodFill(startX, startY, isErasing ? '#ffffff' : currentColor);
    }
    drawing = false;
  });

  canvas.addEventListener('mouseout', () => drawing = false);


  canvas.addEventListener('touchstart', (e) => {
    drawing = true;
    hasMoved = false;
    const { x, y } = getCanvasCoordinates(e);
    startX = x;
    startY = y;
    ctx.beginPath();
    ctx.moveTo(x, y);
  });

  canvas.addEventListener('touchmove', draw);

  canvas.addEventListener('touchend', () => {
    // touchend carries no touch positions (e.touches is empty by then), so
    // the tap point is the stored start position - valid here since
    // !hasMoved means no movement occurred since touchstart.
    if (drawing && !hasMoved) {
      floodFill(startX, startY, isErasing ? '#ffffff' : currentColor);
    }
    drawing = false;
  });

  
  function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
    const x = clientX - rect.left;
    const y = clientY - rect.top;
  
    return { x, y };
  }
  
  function draw(e) {
    if (!drawing) return;
    e.preventDefault();

    const { x, y } = getCanvasCoordinates(e);

    if (!hasMoved) {
      // Below this, treat it as jitter within a stationary click, not a
      // drag - painting here would both leave a stray dot and poison the
      // flood fill's start-pixel color sample (making it think the target
      // area is already filled), so nothing is drawn until a real drag
      // is confirmed.
      if (Math.hypot(x - startX, y - startY) <= DRAG_THRESHOLD) return;
      hasMoved = true;
    }

    ctx.lineWidth = isErasing ? lineWidth * 5 : lineWidth;
    ctx.lineCap = 'round';
    ctx.strokeStyle = isErasing ? '#ffffff' : currentColor;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function hexToRgba(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
      255,
    ];
  }

  // Classic stack-based (4-directional) flood fill run directly on the
  // canvas's pixel buffer. Coordinates from getCanvasCoordinates() are in
  // CSS pixels, but ImageData indexes the raw backing-store buffer, which
  // is scaled up by devicePixelRatio (see resizeCanvasToDisplaySize) - so
  // the click point has to be converted to raw pixels first. A color-
  // distance tolerance (rather than an exact match) is used so the
  // anti-aliased edge pixels of a stroke get swallowed into the fill
  // instead of leaving a thin unfilled ring around it.
  function floodFill(xCss, yCss, fillColorHex) {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width;
    const height = canvas.height;
    const startPxX = Math.round(xCss * dpr);
    const startPxY = Math.round(yCss * dpr);
    if (startPxX < 0 || startPxY < 0 || startPxX >= width || startPxY >= height) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const startIdx = (startPxY * width + startPxX) * 4;
    const startR = data[startIdx];
    const startG = data[startIdx + 1];
    const startB = data[startIdx + 2];
    const startA = data[startIdx + 3];

    const [fr, fg, fb, fa] = hexToRgba(fillColorHex);
    if (startR === fr && startG === fg && startB === fb && startA === fa) return;

    const TOLERANCE = 32;
    const TOLERANCE_SQ = TOLERANCE * TOLERANCE;
    function matches(idx) {
      const dr = data[idx] - startR;
      const dg = data[idx + 1] - startG;
      const db = data[idx + 2] - startB;
      const da = data[idx + 3] - startA;
      return dr * dr + dg * dg + db * db + da * da <= TOLERANCE_SQ;
    }

    const visited = new Uint8Array(width * height);
    const stack = [[startPxX, startPxY]];

    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const pos = y * width + x;
      if (visited[pos]) continue;

      const idx = pos * 4;
      if (!matches(idx)) continue;

      visited[pos] = 1;
      data[idx] = fr;
      data[idx + 1] = fg;
      data[idx + 2] = fb;
      data[idx + 3] = fa;

      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
  }


  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

 
  document.addEventListener('click', (event) => {
    if (!colorControlLabel.contains(event.target) && 
      !colorPalette.contains(event.target) &&
      !lineWidthControlLabel.contains(event.target) && 
      !lineWidthPalette.contains(event.target)) {

      colorPalette.classList.remove('active');
      lineWidthPalette.classList.remove('active');
    }
  });
});