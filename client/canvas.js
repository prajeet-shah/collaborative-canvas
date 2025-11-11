export function setupCanvas(canvas) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  let w, h, ctx;


  const state = {
    tool: document.getElementById("tool"),
    color: document.getElementById("color"),
    width: document.getElementById("width"),
    brushStyle: document.getElementById("brushStyle"),
  };

 
  if (!state.brushStyle) {
    state.brushStyle = document.getElementById("brushStyle");
  }

  
  const api = {
    onStrokeStart: null,
    onStrokePoint: null,
    onStrokeEnd: null,
    onCursor: null,

    clear,
    replay,
    remoteStrokeStart,
    remoteStrokePoint,
    remoteStrokeEnd,
    renderRemoteCursor,
  };


  function resize() {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    redrawAll();
  }
  window.addEventListener("resize", debounce(resize, 150));
  requestAnimationFrame(resize);

 
  let drawing = false;
  let last = null;
  let localStroke = null;

  canvas.addEventListener("pointerdown", (e) => {
    const p = pos(e);
    drawing = true;
    last = p;

    localStroke = {
      tool: state.tool.value,
      color: state.color.value,
      width: parseInt(state.width.value, 10),
      brushStyle: state.brushStyle?.value || "solid", 
      points: [p],
    };

    api.onStrokeStart?.({
      tool: localStroke.tool,
      color: localStroke.color,
      width: localStroke.width,
      brushStyle: localStroke.brushStyle,
      start: withTime(p),
    });
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = pos(e);
    api.onCursor?.(p);

    if (!drawing) return;
    if (!last) last = p;

    drawSegment(localStroke, last, p, true);
    last = p;

  
    throttle(() => api.onStrokePoint?.(withTime(p)), 8)();
  });

  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);

  function end() {
    if (!drawing) return;
    drawing = false;
    last = null;
    localStroke = null;
    api.onStrokeEnd?.();
  }


  function drawSegment(stroke, a, b, isLocal) {
    if (!ctx) return;
    ctx.save();

   
    if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = stroke.color;
    }

    ctx.lineWidth = stroke.width;

    
    if (stroke.brushStyle === "dotted") {
      // Draw small circular dots evenly along the path
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const dotSpacing = stroke.width * 2.5;

      for (let i = 0; i < distance; i += dotSpacing) {
        const t = i / distance;
        const x = a.x + dx * t;
        const y = a.y + dy * t;

        ctx.beginPath();
        ctx.arc(x, y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
      }
    } else if (stroke.brushStyle === "dashed") {
      
      ctx.setLineDash([stroke.width * 4, stroke.width * 2]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]); 
    } else {
      // Solid continuous line
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.restore();

   
    if (isLocal) stroke.points.push(b);
  }

 

  function clear() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Re-render all strokes (undo/redo/history)
  function replay(history) {
    if (!ctx) return;
    for (const op of history) {
      const stroke = {
        tool: op.tool,
        color: op.color,
        width: op.width,
        brushStyle: op.brushStyle || "solid",
      };
      const pts = op.points;
      for (let i = 1; i < pts.length; i++) {
        drawSegment(stroke, pts[i - 1], pts[i], false);
      }
    }
  }

  function redrawAll() {
   
  }

 
  const remoteOps = new Map();

  function remoteStrokeStart(op) {
    const first = op.points?.[0];
    if (!first) return;
    remoteOps.set(op.opId, {
      tool: op.tool,
      color: op.color,
      width: op.width,
      brushStyle: op.brushStyle || "solid",
      last: first,
    });
  }

  function remoteStrokePoint({ opId, point }) {
    const r = remoteOps.get(opId);
    if (!r) return;
    drawSegment(r, r.last, point, false);
    r.last = point;
  }

  function remoteStrokeEnd({ opId }) {
    remoteOps.delete(opId);
  }


  const cursorLayer = document.createElement("div");
  Object.assign(cursorLayer.style, {
    position: "fixed",
    left: "0",
    top: "0",
    right: "0",
    bottom: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(cursorLayer);

  const cursors = new Map();

  function renderRemoteCursor({ userId, x, y, color }) {
    let cursor = cursors.get(userId);

    if (!cursor) {
      const el = document.createElement("div");
      el.className = "cursor";
      Object.assign(el.style, {
        width: "14px",
        height: "14px",
        borderRadius: "50%",
        background: color || "#000",
        border: `2px solid ${color || "#000"}`,
        opacity: "0.9",
        position: "absolute",
        willChange: "transform",
      });
      cursorLayer.appendChild(el);

      cursor = { el, x, y, targetX: x, targetY: y };
      cursors.set(userId, cursor);
    }

    cursor.targetX = x;
    cursor.targetY = y;
    cursor.el.style.borderColor = color || "#000";
    cursor.el.style.background = color || "#000";

    if (!cursor.raf) {
      const animate = () => {
        cursor.x += (cursor.targetX - cursor.x) * 0.25;
        cursor.y += (cursor.targetY - cursor.y) * 0.25;
        const rect = canvas.getBoundingClientRect();
        cursor.el.style.transform = `translate(${rect.left + cursor.x}px, ${
          rect.top + cursor.y
        }px)`;
        cursor.raf = requestAnimationFrame(animate);
      };
      cursor.raf = requestAnimationFrame(animate);
    }
  }

 
  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function withTime(p) {
    return { ...p, t: Date.now() };
  }

  function debounce(fn, ms) {
    let id;
    return (...args) => {
      clearTimeout(id);
      id = setTimeout(() => fn(...args), ms);
    };
  }

  function throttle(fn, ms) {
    let last = 0,
      pending = null;
    return (...args) => {
      const now = performance.now();
      if (now - last >= ms) {
        last = now;
        fn(...args);
      } else {
        pending = args;
        setTimeout(() => {
          if (pending) {
            last = performance.now();
            fn(...pending);
            pending = null;
          }
        }, ms - (now - last));
      }
    };
  }

  return api;
}
