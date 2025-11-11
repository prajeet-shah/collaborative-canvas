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
    // no need to manually update here; handled globally by `room:updateUsers`
  },
  onUserLeft({ userId }) {
    // same here; server will broadcast `room:updateUsers`
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
  },
});

// Join a room
socket.emit("join", { username, roomId });

// Undo / Redo
ui.undo.onclick = () => socket.emit("history:undo");
ui.redo.onclick = () => socket.emit("history:redo");

// Local input → draw → stream
app.onStrokeStart = (s) => socket.emit("stroke:start", s);
app.onStrokePoint = (p) => socket.emit("stroke:point", p);
app.onStrokeEnd = () => socket.emit("stroke:end");

app.onCursor = (c) => socket.emit("cursor:move", c);

// ✅ Listen for updated user list from server (real-time sync)
socket.on("room:updateUsers", (users) => {
  renderUsers(users);
});

// ✅ Optional: when ping-pong latency updates, also refresh user count (fallback)
socket.on("pong:now", () => {
  socket.emit("ping:now");
});

// Display total online users
function renderUsers(users) {
  ui.users.innerHTML = `👥 ${users.length} online`;
}
