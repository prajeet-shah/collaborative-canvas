export function setupCanvas(canvas) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  let w, h, ctx;

  const state = {
    tool: document.getElementById("tool"),
    color: document.getElementById("color"),
    width: document.getElementById("width"),
    brushStyle: document.getElementById("brushStyle"),
  };

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

  let drawing = false;
  let last = null;
  let localStroke = null;
  let shapeStart = null;
  let currentShape = null;

  function resize() {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }
  
  window.addEventListener("resize", debounce(resize, 150));
  requestAnimationFrame(resize);

  // Event Listeners
  canvas.addEventListener("pointerdown", (e) => {
    const p = pos(e);
    drawing = true;
    last = p;
    shapeStart = p;

    const currentTool = state.tool.value;

    // Handle shape tools
    if (isShapeTool(currentTool)) {
      currentShape = {
        type: currentTool,
        start: p,
        color: state.color.value,
        width: parseInt(state.width.value, 10),
        brushStyle: state.brushStyle?.value || "solid"
      };
      return;
    }

    // Handle drawing tools (brush, eraser)
    localStroke = {
      tool: currentTool,
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

    const currentTool = state.tool.value;

    // Handle shape preview
    if (isShapeTool(currentTool) && shapeStart) {
      redrawAll();
      drawShapePreview(shapeStart, p, currentTool);
      return;
    }

    // Handle drawing tools
    if (!last) last = p;
    drawSegment(localStroke, last, p, true);
    last = p;

    throttle(() => api.onStrokePoint?.(withTime(p)), 8)();
  });

  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);

  function end() {
    if (!drawing) return;

    const currentTool = state.tool.value;

    // Handle shape finalization
    if (isShapeTool(currentTool) && shapeStart && currentShape) {
      const endPoint = last || shapeStart;
      finalizeShape(shapeStart, endPoint, currentTool);
    }

    drawing = false;
    last = null;
    localStroke = null;
    shapeStart = null;
    currentShape = null;
    
    if (!isShapeTool(currentTool)) {
      api.onStrokeEnd?.();
    }
  }

  function isShapeTool(tool) {
    return ['rectangle', 'triangle', 'circle', 'square', 'line'].includes(tool);
  }

  function drawShapePreview(start, end, shapeType) {
    ctx.save();
    ctx.strokeStyle = state.color.value;
    ctx.lineWidth = parseInt(state.width.value, 10);
    ctx.setLineDash(getDashPattern(state.brushStyle?.value || "solid"));
    
    drawShape(ctx, start, end, shapeType, false);
    ctx.restore();
  }

  function finalizeShape(start, end, shapeType) {
    // Convert shape to stroke points for collaboration
    const shapePoints = getShapePoints(start, end, shapeType);
    if (shapePoints.length > 0) {
      localStroke = {
        tool: shapeType,
        color: currentShape.color,
        width: currentShape.width,
        brushStyle: currentShape.brushStyle,
        points: shapePoints,
      };

      api.onStrokeStart?.({
        tool: localStroke.tool,
        color: localStroke.color,
        width: localStroke.width,
        brushStyle: localStroke.brushStyle,
        start: withTime(shapePoints[0]),
      });

      // Draw the final shape
      ctx.save();
      ctx.strokeStyle = currentShape.color;
      ctx.lineWidth = currentShape.width;
      ctx.setLineDash(getDashPattern(currentShape.brushStyle));
      
      drawShape(ctx, start, end, shapeType, true);
      ctx.restore();

      // Emit points for collaboration
      shapePoints.forEach((point, index) => {
        if (index > 0) {
          throttle(() => api.onStrokePoint?.(withTime(point)), 8)();
        }
      });

      api.onStrokeEnd?.();
    }
  }

  function drawShape(context, start, end, shapeType, isFinal) {
    const x1 = start.x;
    const y1 = start.y;
    const x2 = end.x;
    const y2 = end.y;
    
    const width = x2 - x1;
    const height = y2 - y1;

    context.beginPath();

    switch (shapeType) {
      case 'rectangle':
        context.rect(x1, y1, width, height);
        break;
      
      case 'square':
        const size = Math.max(Math.abs(width), Math.abs(height));
        const squareX = width < 0 ? x1 - size : x1;
        const squareY = height < 0 ? y1 - size : y1;
        context.rect(squareX, squareY, size, size);
        break;
      
      case 'circle':
        const radius = Math.sqrt(width * width + height * height) / 2;
        const centerX = x1 + width / 2;
        const centerY = y1 + height / 2;
        context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        break;
      
      case 'triangle':
        context.moveTo(x1 + width / 2, y1);
        context.lineTo(x2, y2);
        context.lineTo(x1, y2);
        context.closePath();
        break;
      
      case 'line':
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        break;
    }

    if (isFinal) {
      context.stroke();
    } else {
      context.stroke();
    }
  }

  function getShapePoints(start, end, shapeType) {
    const points = [];
    const steps = 20;
    
    const x1 = start.x;
    const y1 = start.y;
    const x2 = end.x;
    const y2 = end.y;
    const width = x2 - x1;
    const height = y2 - y1;

    switch (shapeType) {
      case 'rectangle':
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          let x, y;
          
          if (t < 0.25) {
            x = x1 + width * (t * 4);
            y = y1;
          } else if (t < 0.5) {
            x = x2;
            y = y1 + height * ((t - 0.25) * 4);
          } else if (t < 0.75) {
            x = x2 - width * ((t - 0.5) * 4);
            y = y2;
          } else {
            x = x1;
            y = y2 - height * ((t - 0.75) * 4);
          }
          points.push({ x, y });
        }
        break;
      
      case 'square':
        const size = Math.max(Math.abs(width), Math.abs(height));
        const squareX = width < 0 ? x1 - size : x1;
        const squareY = height < 0 ? y1 - size : y1;
        
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          let x, y;
          
          if (t < 0.25) {
            x = squareX + size * (t * 4);
            y = squareY;
          } else if (t < 0.5) {
            x = squareX + size;
            y = squareY + size * ((t - 0.25) * 4);
          } else if (t < 0.75) {
            x = squareX + size - size * ((t - 0.5) * 4);
            y = squareY + size;
          } else {
            x = squareX;
            y = squareY + size - size * ((t - 0.75) * 4);
          }
          points.push({ x, y });
        }
        break;
      
      case 'circle':
        const radius = Math.sqrt(width * width + height * height) / 2;
        const centerX = x1 + width / 2;
        const centerY = y1 + height / 2;
        
        for (let i = 0; i <= steps; i++) {
          const angle = (i / steps) * 2 * Math.PI;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          points.push({ x, y });
        }
        break;
      
      case 'triangle':
        points.push({ x: x1 + width / 2, y: y1 }); // Top
        points.push({ x: x2, y: y2 }); // Bottom right
        points.push({ x: x1, y: y2 }); // Bottom left
        points.push({ x: x1 + width / 2, y: y1 }); // Back to top
        break;
      
      case 'line':
        points.push({ x: x1, y: y1 });
        points.push({ x: x2, y: y2 });
        break;
      
      default:
        points.push(start);
        points.push(end);
    }
    
    return points;
  }

  function getDashPattern(brushStyle) {
    switch (brushStyle) {
      case 'dashed':
        return [10, 5];
      case 'dotted':
        return [2, 2];
      default:
        return [];
    }
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
    ctx.setLineDash(getDashPattern(stroke.brushStyle));

    if (stroke.brushStyle === "dotted") {
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
    } else {
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

  function replay(history) {
    if (!ctx) return;
    clear();
    for (const op of history) {
      if (isShapeTool(op.tool)) {
        // For shapes, we need at least 2 points
        if (op.points.length >= 2) {
          const start = op.points[0];
          const end = op.points[op.points.length - 1];
          
          ctx.save();
          if (op.tool === "eraser") {
            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "rgba(0,0,0,1)";
          } else {
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = op.color;
          }
          ctx.lineWidth = op.width;
          ctx.setLineDash(getDashPattern(op.brushStyle));
          
          drawShape(ctx, start, end, op.tool, true);
          ctx.restore();
        }
      } else {
        // Regular stroke drawing
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
  }

  function redrawAll() {
    // This would redraw the entire canvas from history
    // For now, we'll just clear and let the stroke system handle redrawing
  }

  // Remote operations
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
    
    if (isShapeTool(r.tool)) {
      // For shapes, we might handle differently, but for now use segment drawing
      drawSegment(r, r.last, point, false);
    } else {
      drawSegment(r, r.last, point, false);
    }
    r.last = point;
  }

  function remoteStrokeEnd({ opId }) {
    remoteOps.delete(opId);
  }

  // Cursor system
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

  // Utility functions
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