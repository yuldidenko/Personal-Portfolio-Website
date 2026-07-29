window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('drawingCanvas');
  const ctx = canvas.getContext('2d');

  const fillBtn = document.getElementById('fill-button');

  const lineWidthControlLabel = document.querySelector('.linewidth-control button[title="Line"]');
  const lineWidthPalette = document.querySelector('.linewidth-palette');
  const lineWidthSlider = document.getElementById('line-width-slider');

  // Shared by Fill, Line, and Text - a popover below the main toolbar, same
  // shape as Line/Eraser's own popovers. Picking a swatch here never selects
  // a tool itself (see its own click handler below): the workflow is color
  // first, then tool.
  const colorBtn = document.getElementById('color-picker-button');
  const colorControl = document.querySelector('.color-control');
  const colorPalette = document.querySelector('.color-palette');
  const colorOptions = colorPalette.querySelectorAll('.color-option');
  const colorBtnIcon = colorBtn.querySelector('img');

  // One pre-recolored icon file per swatch (media/) - swapping <img src>
  // avoids fetching/inlining the SVG just to recolor it, so this still
  // works when the page is opened directly as a file, not just served.
  const COLOR_ICONS = {
    '#000000': './media/Color dot.svg',
    '#31A0CD': './media/Color dot blue.svg',
    '#346B4C': './media/Color dot green.svg',
    '#DB572E': './media/Color dot red.svg',
    '#EBC93D': './media/Color dot yellow.svg',
  };

  const textBtn = document.getElementById('text-button');

  const clearBtn = document.getElementById('delete-button');
  const eraserBtn = document.getElementById('eraser-button');
  const eraserControl = document.querySelector('.eraser-control');
  const eraserPalette = document.querySelector('.eraser-palette');
  const eraserWidthSlider = document.getElementById('eraser-width-slider');
  const canvasSection = document.querySelector('section.canvas');

  let drawing = false;
  let isErasing = false;
  // Pencil and eraser thickness are independent sliders, not one value
  // derived from the other (previously the eraser was just lineWidth * 5).
  let lineWidth = parseInt(lineWidthSlider.value, 10);
  let eraserWidth = parseInt(eraserWidthSlider.value, 10);
  // One shared color for Fill, Line, and Text - picked from the global
  // color picker below the toolbar, independently of which tool (if any)
  // is currently selected.
  let currentColor = '#000000';
  let startX = 0;
  let startY = 0;
  let hasMoved = false;
  const DRAG_THRESHOLD = 3; // px - below this, a mousedown/up is treated as a fill click, not a stroke

  // Placed text stays selectable/movable indefinitely, not just while the
  // frame is still open: each committed item's canvas-space bounding box,
  // text, and color are kept here so a later click (with Text tool active)
  // on that same spot can reopen it as the same draggable/editable frame,
  // rather than the text becoming permanently fixed pixels the instant you
  // click away.
  const textItems = [];

  
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

  // Fill, line, text, and eraser are the four selectable tools - exactly
  // one of their buttons carries the "active" (selected-tool) look at a
  // time, and none is marked selected until the user actually picks one.
  // Routed through this one helper so every entry point (clicking a tool's
  // own icon, or picking an option from the palette it opens) agrees on
  // which single button is selected, instead of each handler managing its
  // own on/off logic independently.
  const toolButtons = [fillBtn, lineWidthControlLabel, textBtn, eraserBtn];
  function selectTool(selectedBtn) {
    toolButtons.forEach((btn) => {
      btn.classList.toggle('active', btn === selectedBtn);
    });
  }

  // Every popover (Line's, Eraser's, and Color's) opens/closes through
  // this one helper, which keeps its trigger button's aria-expanded in
  // sync alongside the visual .active class - a single source of truth
  // instead of each of the ~15 open/close call sites below (tool clicks
  // closing each other's popovers, the outside-click handler, etc.) having
  // to remember to update both.
  function setPaletteOpen(palette, trigger, open) {
    palette.classList.toggle('active', open);
    trigger.setAttribute('aria-expanded', String(open));
  }

  // Color trigger: opens/closes the swatch popover like Line/Eraser's own
  // triggers do. Deliberately never calls selectTool() - opening the color
  // popover doesn't pick a tool.
  colorBtn.addEventListener('click', () => {
    setPaletteOpen(colorPalette, colorBtn, !colorPalette.classList.contains('active'));
    setPaletteOpen(lineWidthPalette, lineWidthControlLabel, false);
    setPaletteOpen(eraserPalette, eraserBtn, false);
  });

  // Picking a swatch sets currentColor, updates which one shows as
  // selected, and swaps the trigger button's icon to match. Deliberately
  // does NOT close the popover (unlike the old discrete width buttons) -
  // closing instantly gave no time to actually see the active frame land
  // on the new swatch. It still closes normally via the outside-click
  // handler below, or by toggling the trigger again. Still never calls
  // selectTool(): the user picks a color first, then a tool to apply it.
  colorOptions.forEach(option => {
    option.addEventListener('click', () => {
      currentColor = option.dataset.color;
      colorOptions.forEach(o => o.classList.toggle('active', o === option));
      colorBtnIcon.src = COLOR_ICONS[currentColor];
    });
  });

  fillBtn.addEventListener('click', () => {
    drawing = false;
    isErasing = false;
    selectTool(fillBtn);
    setPaletteOpen(lineWidthPalette, lineWidthControlLabel, false);
    setPaletteOpen(eraserPalette, eraserBtn, false);
    setPaletteOpen(colorPalette, colorBtn, false);
  });

  lineWidthControlLabel.addEventListener('click', () => {
    setPaletteOpen(lineWidthPalette, lineWidthControlLabel, !lineWidthPalette.classList.contains('active'));
    setPaletteOpen(eraserPalette, eraserBtn, false);
    setPaletteOpen(colorPalette, colorBtn, false);
    isErasing = false;
    selectTool(lineWidthControlLabel);
  });


  lineWidthSlider.addEventListener('input', () => {
    // Not closing the popover here (unlike the discrete color/width
    // buttons below) - the slider is dragged continuously, so yanking the
    // popover away on the first input event would cut the drag short.
    lineWidth = parseInt(lineWidthSlider.value, 10);
    isErasing = false;
    selectTool(lineWidthControlLabel);
  });

  textBtn.addEventListener('click', () => {
    isErasing = false;
    selectTool(textBtn);
    setPaletteOpen(lineWidthPalette, lineWidthControlLabel, false);
    setPaletteOpen(eraserPalette, eraserBtn, false);
    setPaletteOpen(colorPalette, colorBtn, false);
  });

  eraserBtn.addEventListener('click', () => {
    isErasing = true;
    selectTool(eraserBtn);
    setPaletteOpen(eraserPalette, eraserBtn, !eraserPalette.classList.contains('active'));
    setPaletteOpen(lineWidthPalette, lineWidthControlLabel, false);
    setPaletteOpen(colorPalette, colorBtn, false);
  });

  eraserWidthSlider.addEventListener('input', () => {
    eraserWidth = parseInt(eraserWidthSlider.value, 10);
    isErasing = true;
    selectTool(eraserBtn);
  });

  canvas.addEventListener('mousedown', (e) => {
    const { x, y } = getCanvasCoordinates(e);
    const existingItem = findTextItemAt(x, y);
    if (existingItem || textBtn.classList.contains('active')) {
      // Clicking directly on already-placed text reopens it for
      // dragging/editing regardless of which tool currently happens to be
      // selected - it shouldn't matter that Text may have been deselected
      // (e.g. by clicking away to commit it in the first place) for the
      // text itself to stay grabbable later.
      //
      // Without this preventDefault, a real (trusted) mousedown's default
      // action re-focuses based on the original click target (the canvas,
      // which isn't focusable) right after this handler runs, stealing
      // focus back from the frame startTextFrame() just created and
      // focused - which immediately blurs and discards it before anything
      // can be typed. Synthetic/dispatched events don't trigger that
      // default action, which is why this only broke for real clicks, not
      // scripted tests.
      e.preventDefault();
      isErasing = false;
      selectTool(textBtn);
      setPaletteOpen(lineWidthPalette, lineWidthControlLabel, false);
      setPaletteOpen(eraserPalette, eraserBtn, false);
      startTextFrame(e.clientX, e.clientY, existingItem);
      return;
    }
    drawing = true;
    hasMoved = false;
    startX = x;
    startY = y;
    ctx.beginPath();
    ctx.moveTo(x, y);
  });

  canvas.addEventListener('mousemove', draw);

  canvas.addEventListener('mouseup', () => {
    // Gated to Fill specifically - a stationary click used to flood fill
    // unconditionally, regardless of which tool (if any) was actually
    // selected. That meant clicking the canvas with no tool selected (or
    // with Line/Text selected) silently flood-filled the whole canvas with
    // currentColor anyway - e.g. right after committing a text frame, since
    // nothing marks Text as deselected until a later click lands somewhere
    // that does, at which point that very click triggered the bug.
    // Eraser is deliberately excluded here (unlike Fill): flood-filling
    // white on a single click meant clicking anywhere on a solid-colored
    // canvas erased the entire thing at once, instead of behaving like a
    // normal eraser that only clears what you actually drag over (see
    // draw()).
    if (drawing && !hasMoved && fillBtn.classList.contains('active')) {
      floodFill(startX, startY, currentColor);
    }
    drawing = false;
  });

  canvas.addEventListener('mouseout', () => drawing = false);


  canvas.addEventListener('touchstart', (e) => {
    const { x, y } = getCanvasCoordinates(e);
    const existingItem = findTextItemAt(x, y);
    if (existingItem || textBtn.classList.contains('active')) {
      e.preventDefault();
      const touch = e.touches[0];
      isErasing = false;
      selectTool(textBtn);
      setPaletteOpen(lineWidthPalette, lineWidthControlLabel, false);
      setPaletteOpen(eraserPalette, eraserBtn, false);
      startTextFrame(touch.clientX, touch.clientY, existingItem);
      return;
    }
    drawing = true;
    hasMoved = false;
    startX = x;
    startY = y;
    ctx.beginPath();
    ctx.moveTo(x, y);
  });

  canvas.addEventListener('touchmove', draw);

  canvas.addEventListener('touchend', () => {
    // touchend carries no touch positions (e.touches is empty by then), so
    // the tap point is the stored start position - valid here since
    // !hasMoved means no movement occurred since touchstart. Gated to
    // Fill for the same reason as the mouseup handler above.
    if (drawing && !hasMoved && fillBtn.classList.contains('active')) {
      floodFill(startX, startY, currentColor);
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

  const TEXT_FONT_SIZE = 24;
  const TEXT_FRAME_PADDING = 12;

  // Text tool: rather than drawing immediately on click, a small Figma-like
  // frame is floated (position: fixed, so no positioned ancestor is needed)
  // right over the click point - a contenteditable div inside it gets the
  // native caret/blinking-cursor behavior for free, and the frame's own
  // border/padding (everywhere outside that contenteditable) doubles as a
  // drag handle for repositioning it before committing. The text is only
  // stamped onto the canvas as real pixels via fillText once committed -
  // matching how the other tools only mark the canvas once an action is
  // actually finished (a completed stroke, a flood fill).
  // Hit-tests already-placed text (canvas-space coordinates, same space as
  // getCanvasCoordinates()) so clicking back onto existing text with the
  // Text tool active reopens it instead of starting a blank new one.
  function findTextItemAt(x, y) {
    for (let i = textItems.length - 1; i >= 0; i--) {
      const item = textItems[i];
      if (x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height) {
        return item;
      }
    }
    return null;
  }

  // Renders a stored text item back onto the canvas at its own recorded
  // position - reconstructs the same fillText() call commit() originally
  // made, from the item's bounding box alone (no separate drawX/drawY need
  // to be stored). Used to restore an existing item's pixels if reopening
  // it gets cancelled.
  function renderTextItem(item) {
    ctx.font = `${TEXT_FONT_SIZE}px "MabryPro-Regular", sans-serif`;
    ctx.fillStyle = item.color;
    ctx.textBaseline = 'middle';
    ctx.fillText(item.text, item.x + TEXT_FRAME_PADDING, item.y + item.height / 2);
  }

  // Snapshots/restores whatever was on the canvas underneath a text item's
  // bounding box (CSS-pixel coordinates, converted to the raw backing-store
  // buffer the same way floodFill does) - taken right before that item's own
  // text pixels are stamped on top, and restored when the item is picked up
  // again. clearRect() alone can't do this: it always clears to transparent,
  // which then shows through as the canvas element's own white CSS
  // background rather than whatever was actually drawn there (e.g. a
  // flood-filled color), leaving a solid white box at the old position while
  // the text is being dragged elsewhere.
  function captureBackground(xCss, yCss, widthCss, heightCss) {
    const dpr = window.devicePixelRatio || 1;
    const x = Math.round(xCss * dpr);
    const y = Math.round(yCss * dpr);
    const width = Math.round(widthCss * dpr);
    const height = Math.round(heightCss * dpr);
    return { x, y, width, height, imageData: ctx.getImageData(x, y, width, height) };
  }

  function restoreBackground(background) {
    ctx.putImageData(background.imageData, background.x, background.y);
  }

  function startTextFrame(clientX, clientY, existingItem) {
    const frame = document.createElement('div');
    frame.className = 'text-frame';

    const content = document.createElement('div');
    content.className = 'text-frame-content';
    content.contentEditable = 'true';
    content.spellcheck = false;
    content.style.fontSize = `${TEXT_FONT_SIZE}px`;

    if (existingItem) {
      // Reopening previously-placed text: position the frame exactly where
      // that text already is (not the click-centered math below, which is
      // only for starting a brand new one), pre-fill its content/color, and
      // pull it out of textItems for now - findTextItemAt() must not keep
      // matching it while it's actively being edited/dragged here. cancel()
      // puts it back unchanged if the user backs out; commit() re-adds it
      // (possibly moved) after clearing its old pixels.
      const canvasRect = canvas.getBoundingClientRect();
      frame.style.left = `${canvasRect.left + existingItem.x}px`;
      frame.style.top = `${canvasRect.top + existingItem.y}px`;
      content.textContent = existingItem.text;
      content.style.color = existingItem.color;
      const idx = textItems.indexOf(existingItem);
      if (idx !== -1) textItems.splice(idx, 1);
      // Erase its old pixels immediately, not just at commit time - otherwise
      // the original rendering and the live draggable frame are both visible
      // at once (looking like two duplicate copies) for as long as it's
      // being edited/dragged. Restoring the pre-text background snapshot
      // (rather than clearRect) so whatever was actually behind the text
      // (e.g. a flood-filled color) reappears correctly instead of a
      // transparent hole showing the canvas's own white CSS background.
      // cancel() below redraws the text on top of it again if this is undone.
      restoreBackground(existingItem.background);
    } else {
      frame.style.left = `${clientX}px`;
      frame.style.top = `${clientY - TEXT_FONT_SIZE / 2 - TEXT_FRAME_PADDING}px`;
      content.style.color = currentColor;
    }

    frame.appendChild(content);
    // Figma-style corner handles - purely visual (see .text-frame-handle's
    // pointer-events: none), signaling "this is a movable container".
    ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach((corner) => {
      const handle = document.createElement('div');
      handle.className = `text-frame-handle ${corner}`;
      frame.appendChild(handle);
    });
    document.body.appendChild(frame);
    content.focus();
    if (existingItem) {
      // Land the caret at the end of the existing text rather than the
      // start, matching where you'd expect to keep typing from.
      const range = document.createRange();
      range.selectNodeContents(content);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // frame.remove() (via cancel(), or indirectly through commit()) would
    // otherwise still leave these document-level listeners registered.
    function cleanup() {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('keydown', handleEscape);
    }

    let committed = false;
    function commit() {
      if (committed) return;
      committed = true;
      const text = content.textContent;
      // If this was reopened from an existing item, its old pixels were
      // already cleared the moment it was reopened (see above) - nothing
      // left to erase here regardless of which branch below runs.
      if (text) {
        // Read the frame's current (possibly dragged-to) position rather
        // than the original click point, so dragging it actually moves
        // where the text ends up.
        const frameRect = frame.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        const drawX = frameRect.left + TEXT_FRAME_PADDING - canvasRect.left;
        const drawY = frameRect.top + frameRect.height / 2 - canvasRect.top;
        const color = existingItem ? existingItem.color : currentColor;
        const x = frameRect.left - canvasRect.left;
        const y = frameRect.top - canvasRect.top;

        // Snapshot whatever's already on the canvas at the destination
        // before stamping this item's own text pixels on top of it, so if
        // this item gets picked up and moved again later, the background
        // (e.g. a flood-filled color) it's covering can be restored exactly
        // instead of leaving a transparent/white hole behind.
        const background = captureBackground(x, y, frameRect.width, frameRect.height);

        ctx.font = `${TEXT_FONT_SIZE}px "MabryPro-Regular", sans-serif`;
        ctx.fillStyle = color;
        ctx.textBaseline = 'middle';
        ctx.fillText(text, drawX, drawY);

        textItems.push({
          x,
          y,
          width: frameRect.width,
          height: frameRect.height,
          text,
          color,
          background,
        });
      }
      frame.remove();
      cleanup();
    }

    function cancel() {
      committed = true;
      // An existing item's pixels were already cleared when it was
      // reopened, so backing out has to actually redraw them - simply
      // putting the item back in the array (without also redrawing) would
      // leave it silently missing from the canvas despite still being
      // "placed" as far as textItems/hit-testing is concerned.
      if (existingItem) {
        renderTextItem(existingItem);
        textItems.push(existingItem);
      }
      frame.remove();
      cleanup();
    }

    content.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault(); // single-line: stop typing, not insert a newline
        // Blur rather than commit(): this only stops active editing (hides
        // the blinking caret) - the frame stays on screen and still
        // draggable by its border, so the text can still be repositioned
        // afterward if it wasn't placed quite right. Clicking back into the
        // text resumes editing as normal (still contenteditable); it only
        // actually commits to the canvas once the user clicks away from it.
        content.blur();
      }
    });

    // Escape needs to work whether or not content is still focused (e.g.
    // after Enter has already blurred it and the frame is just sitting
    // there draggable), so it's a document-level listener rather than one
    // scoped to content itself.
    function handleEscape(ev) {
      if (ev.key === 'Escape') {
        cancel();
      }
    }
    document.addEventListener('keydown', handleEscape);

    // Dragging: only when the mousedown lands on the frame's own
    // border/padding chrome, not when it bubbles up from the contenteditable
    // (which needs plain clicks to just place the text cursor as usual).
    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let frameStartLeft = 0;
    let frameStartTop = 0;

    frame.addEventListener('mousedown', (ev) => {
      if (ev.target !== frame) return;
      ev.preventDefault();
      dragging = true;
      const rect = frame.getBoundingClientRect();
      dragStartX = ev.clientX;
      dragStartY = ev.clientY;
      frameStartLeft = rect.left;
      frameStartTop = rect.top;
    });

    function onDragMove(ev) {
      if (!dragging) return;
      frame.style.left = `${frameStartLeft + (ev.clientX - dragStartX)}px`;
      frame.style.top = `${frameStartTop + (ev.clientY - dragStartY)}px`;
    }
    function onDragEnd() {
      dragging = false;
    }
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);

    // Clicking anywhere outside the frame (including a fresh click on the
    // canvas to start a new text frame elsewhere) commits this one. Capture
    // phase so it runs before that fresh click's own mousedown handler.
    function handleOutsideClick(ev) {
      if (!frame.contains(ev.target)) {
        commit();
      }
    }
    document.addEventListener('mousedown', handleOutsideClick, true);
  }

  function draw(e) {
    if (!drawing) return;
    // Gated to Line/Eraser specifically - mousedown sets `drawing = true`
    // for any click that isn't on existing text (see below), regardless of
    // which tool, if any, is actually selected. Without this check, dragging
    // on the canvas always painted a stroke with whatever currentColor
    // happened to be - even with no tool selected at all, e.g. right after
    // committing a text frame.
    if (!lineWidthControlLabel.classList.contains('active') && !eraserBtn.classList.contains('active')) {
      return;
    }
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

    ctx.lineWidth = isErasing ? eraserWidth : lineWidth;
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
    // Otherwise stale entries kept their old canvas-space bounding boxes,
    // so a later click landing in one of those now-empty spots would still
    // hit-test as existing text and reopen/redraw it - bringing back
    // "deleted" text (and the solid backdrop it had captured) after a clear.
    textItems.length = 0;
  });

 
  document.addEventListener('click', (event) => {
    if (!lineWidthControlLabel.contains(event.target) &&
      !lineWidthPalette.contains(event.target)) {
      setPaletteOpen(lineWidthPalette, lineWidthControlLabel, false);
    }

    if (!eraserControl.contains(event.target)) {
      setPaletteOpen(eraserPalette, eraserBtn, false);
    }

    if (!colorControl.contains(event.target)) {
      setPaletteOpen(colorPalette, colorBtn, false);
    }

    // Clicking anywhere outside the whole canvas widget (toolbar + drawing
    // surface) deselects whichever tool was selected. A click ON the
    // canvas itself is still "inside", so drawing with the selected tool
    // never deselects it.
    if (!canvasSection.contains(event.target)) {
      selectTool(null);
    }
  });
});