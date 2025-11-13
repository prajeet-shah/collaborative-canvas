import { setupCanvas } from "./canvas.js";
import { createSocket } from "./websocket.js";

const username = "User-" + Math.floor(Math.random() * 1000);
const roomId = new URLSearchParams(location.search).get("room") || "lobby";


const ui = {
  
  tool: document.getElementById("tool"),
  color: document.getElementById("color"),
  width: document.getElementById("width"),
  undo: document.getElementById("undo"),
  redo: document.getElementById("redo"),
  latency: document.getElementById("latency"),
  users: document.getElementById("users"),

  
  mobileHeader: document.querySelector(".mobile-header"),
  mobileSidebar: document.getElementById("mobileSidebar"),
  mobileMenuButton: document.getElementById("mobileMenuButton"),
  sidebarOverlay: document.getElementById("sidebarOverlay"),
  mobileTool: document.getElementById("mobileTool"),
  mobileBrushStyle: document.getElementById("mobileBrushStyle"),
  mobileColor: document.getElementById("mobileColor"),
  mobileWidth: document.getElementById("mobileWidth"),
  mobileWidthValue: document.getElementById("mobileWidthValue"),
  mobileUndo: document.getElementById("mobileUndo"),
  mobileRedo: document.getElementById("mobileRedo"),
  mobileClear: document.getElementById("mobileClear"),
  mobileLatency: document.getElementById("mobileLatency"),
  mobileUsers: document.getElementById("mobileUsers"),
};

const canvasEl = document.getElementById("canvas");
const app = setupCanvas(canvasEl);

const socket = createSocket({
  onInit({ roomId, users, history }) {
    app.clear();
    app.replay(history);
    renderUsers(users);
  },
  onUserJoin(user) {
    
  },
  onUserLeft({ userId }) {
   
  },
  onStrokeStart(op) {
    app.remoteStrokeStart(op);
  },
  onStrokePoint(op) {
    app.remoteStrokePoint(op);
  },
  onStrokeEnd(op) {
    app.remoteStrokeEnd(op);
  },
  onCursorMove(payload) {
    app.renderRemoteCursor(payload);
  },
  onHistoryReplace({ history }) {
    app.clear();
    app.replay(history);
  },
  onPong(ms) {
    ui.latency.textContent = `⏱️${ms}ms`;
    ui.mobileLatency.textContent = `⏱️${ms}ms`;
  },
});


socket.emit("join", { username, roomId });


ui.undo.onclick = () => socket.emit("history:undo");
ui.redo.onclick = () => socket.emit("history:redo");


ui.mobileUndo.addEventListener("click", () => {
  socket.emit("history:undo");
  closeMobileSidebar();
});

ui.mobileRedo.addEventListener("click", () => {
  socket.emit("history:redo");
  closeMobileSidebar();
});

ui.mobileClear.addEventListener("click", () => {
  app.clear();
  closeMobileSidebar();
});


[ui.mobileUndo, ui.mobileRedo, ui.mobileClear, ui.mobileMenuButton].forEach(
  (btn) => {
    btn.addEventListener("touchstart", function () {
      this.style.transform = "scale(0.95)";
    });

    btn.addEventListener("touchend", function () {
      this.style.transform = "scale(1)";
    });
  }
);


ui.tool.addEventListener("change", (e) => {
  ui.mobileTool.value = e.target.value;
});

ui.mobileTool.addEventListener("change", (e) => {
  ui.tool.value = e.target.value;
});

const brushStyle = document.getElementById("brushStyle");
ui.mobileBrushStyle.addEventListener("change", (e) => {
  brushStyle.value = e.target.value;
});

brushStyle.addEventListener("change", (e) => {
  ui.mobileBrushStyle.value = e.target.value;
});

ui.color.addEventListener("input", (e) => {
  ui.mobileColor.value = e.target.value;
});

ui.mobileColor.addEventListener("input", (e) => {
  ui.color.value = e.target.value;
});

ui.width.addEventListener("input", (e) => {
  ui.mobileWidth.value = e.target.value;
  ui.mobileWidthValue.textContent = e.target.value;
});

ui.mobileWidth.addEventListener("input", (e) => {
  ui.width.value = e.target.value;
  ui.mobileWidthValue.textContent = e.target.value;
});


[ui.mobileTool, ui.mobileBrushStyle, ui.mobileColor, ui.mobileWidth].forEach(
  (input) => {
    input.addEventListener("touchstart", function () {
      this.style.transform = "scale(0.98)";
    });

    input.addEventListener("touchend", function () {
      this.style.transform = "scale(1)";
    });
  }
);


function openMobileSidebar() {
  ui.mobileSidebar.classList.add("active");
  ui.sidebarOverlay.classList.add("active");

  document.body.style.overflow = "hidden";
}

function closeMobileSidebar() {
  ui.mobileSidebar.classList.remove("active");
  ui.sidebarOverlay.classList.remove("active");

  document.body.style.overflow = "";
}

ui.mobileMenuButton.addEventListener("click", openMobileSidebar);
ui.sidebarOverlay.addEventListener("click", closeMobileSidebar);


ui.sidebarOverlay.addEventListener("touchstart", closeMobileSidebar);


let touchStartX = 0;
let touchEndX = 0;

ui.mobileSidebar.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].screenX;
});

ui.mobileSidebar.addEventListener("touchend", (e) => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
});

function handleSwipe() {
  const swipeThreshold = 50;
  const swipeDistance = touchEndX - touchStartX;

  if (swipeDistance < -swipeThreshold) {
    closeMobileSidebar();
  }
}


canvasEl.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  return false;
});


canvasEl.addEventListener(
  "touchmove",
  (e) => {
    if (e.scale !== 1) {
      e.preventDefault();
    }
  },
  { passive: false }
);


app.onStrokeStart = (s) => socket.emit("stroke:start", s);
app.onStrokePoint = (p) => socket.emit("stroke:point", p);
app.onStrokeEnd = () => socket.emit("stroke:end");

app.onCursor = (c) => socket.emit("cursor:move", c);


socket.on("room:updateUsers", (users) => {
  renderUsers(users);
});


socket.on("pong:now", () => {
  socket.emit("ping:now");
});

function renderUsers(users) {
  const usersText = `${users.length}`;
  ui.users.innerHTML = `👥 ${usersText}`;
  ui.mobileUsers.textContent = `👥 ${usersText}`;
}


window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    canvasEl.dispatchEvent(new Event("resize"));
 
    closeMobileSidebar();
  }, 300);
});


ui.mobileWidthValue.textContent = ui.mobileWidth.value;


function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}


if (isTouchDevice()) {
  document.body.classList.add("touch-device");

  
  const style = document.createElement("style");
  style.textContent = `
    .touch-device .action-btn {
      min-height: 56px;
    }
    .touch-device .mobile-tool-group select,
    .touch-device .mobile-tool-group input {
      min-height: 54px;
    }
  `;
  document.head.appendChild(style);
}
