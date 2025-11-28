// main.js
import { setupCanvas } from "./canvas.js";
import { createSocket } from "./websocket.js";
import { AuthService } from "./auth.js";

const authService = new AuthService();
const appContainer = document.getElementById("app");
const authModal = document.getElementById("authModal");
const roomModal = document.getElementById("roomModal");

let currentUser = null;
let currentRoom = null;
let socket = null;
let app = null;

// ---------- SIMPLE VIEW HELPERS ----------

function showAuthModal() {
  authModal.style.display = "flex";
  roomModal.style.display = "none";
  appContainer.style.display = "none";
  resetAuthForms();
}

function showRoomSelection() {
  authModal.style.display = "none";
  roomModal.style.display = "flex";
  appContainer.style.display = "none";
}

function showApp() {
  authModal.style.display = "none";
  roomModal.style.display = "none";
  appContainer.style.display = "block";
}

function resetAuthForms() {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  if (loginForm) loginForm.reset();
  if (signupForm) signupForm.reset();
}

// ---------- MOBILE SIDEBAR (GLOBAL HELPERS) ----------

function openMobileSidebar() {
  const sidebar = document.getElementById("mobileSidebar");
  const overlay = document.getElementById("sidebarOverlay");
  if (sidebar) sidebar.classList.add("active");
  if (overlay) overlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeMobileSidebar() {
  const sidebar = document.getElementById("mobileSidebar");
  const overlay = document.getElementById("sidebarOverlay");
  if (sidebar) sidebar.classList.remove("active");
  if (overlay) overlay.classList.remove("active");
  document.body.style.overflow = "";
}

// ---------- INITIALIZE APP ----------

async function initApp() {
  console.log("🚀 Initializing app...");

  try {
    currentUser = await authService.getCurrentUser();
    console.log("👤 Current user:", currentUser);

    if (currentUser) {
      console.log("✅ User authenticated, showing room selection");
      showRoomSelection();
      setupUserProfile(currentUser);
      setupRoomHandlers();
    } else {
      console.log("❌ No user, showing auth modal");
      showAuthModal();
    }
  } catch (error) {
    console.error("💥 Error initializing app:", error);
    showAuthModal();
  }
}

// ---------- AUTH HANDLERS ----------

function setupAuthHandlers() {
  console.log("🔐 Setting up auth handlers...");

  // Tab switching
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    if (tab.dataset.tabBound === "true") return;
    tab.dataset.tabBound = "true";

    tab.addEventListener("click", () => {
      const targetTab = tab.dataset.tab;

      document
        .querySelectorAll(".auth-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      document.querySelectorAll(".auth-form").forEach((form) => {
        form.classList.remove("active");
      });

      const targetForm = document.getElementById(`${targetTab}Form`);
      if (targetForm) targetForm.classList.add("active");
    });
  });

  // Login form
  const loginForm = document.getElementById("loginForm");
  if (loginForm && loginForm.dataset.bound !== "true") {
    loginForm.dataset.bound = "true";

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("📝 Login form submitted");

      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;

      showNotification("Signing in...", "info");

      const result = await authService.signIn(email, password);
      if (result.success) {
        currentUser = result.user;
        console.log("✅ Login successful");
        showRoomSelection();
        setupUserProfile(currentUser);
        setupRoomHandlers();
        showNotification("Welcome back!", "success");
      } else {
        console.error("❌ Login failed:", result.error);
        showNotification(result.error, "error");
      }
    });
  }

  // Signup form
  const signupForm = document.getElementById("signupForm");
  if (signupForm && signupForm.dataset.bound !== "true") {
    signupForm.dataset.bound = "true";

    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("📝 Signup form submitted");

      const name = document.getElementById("signupName").value;
      const email = document.getElementById("signupEmail").value;
      const password = document.getElementById("signupPassword").value;

      showNotification("Creating account...", "info");

      const result = await authService.signUp(name, email, password);
      if (result.success) {
        currentUser = result.user;
        console.log("✅ Signup successful - User automatically signed in");
        showRoomSelection();
        setupUserProfile(currentUser);
        setupRoomHandlers();
        showNotification("Account created successfully! Welcome!", "success");
      } else {
        console.error("❌ Signup failed:", result.error);
        showNotification(result.error, "error");
      }
    });
  }
}

// ---------- LOGOUT HANDLERS ----------

function setupLogoutHandlers() {
  function bindLogout(id) {
    const el = document.getElementById(id);
    if (!el || el.dataset.logoutBound === "true") return;
    el.addEventListener("click", handleLogout);
    el.dataset.logoutBound = "true";
  }

  // Logout from room selection
  bindLogout("logoutBtn");

  // Logout from main app header
  bindLogout("logoutHeader");

  // Logout from mobile sidebar
  bindLogout("mobileLogout");
}

async function handleLogout() {
  console.log("🚪 Logging out...");

  try {
    await authService.signOut();
    currentUser = null;

    if (socket) {
      socket.disconnect();
      socket = null;
    }

    app = null;
    currentRoom = null;

    const notificationContainer = document.getElementById(
      "notificationContainer"
    );
    if (notificationContainer) {
      notificationContainer.innerHTML = "";
    }

    console.log("✅ Logout successful, reloading from server");

    // ⬇️ Do a fresh request to the server so SSR decides (no session → login)
    // Change "/" to "/login" if your login route is different.
    window.location.href = "/";
  } catch (error) {
    console.error("❌ Logout error:", error);
    showNotification("Error during logout", "error");
  }
}

// ---------- ROOM HANDLERS ----------

function setupRoomHandlers() {
  console.log("🚪 Setting up room handlers...");

  // Main Lobby
  const joinLobby = document.getElementById("joinLobby");
  if (joinLobby && joinLobby.dataset.bound !== "true") {
    joinLobby.dataset.bound = "true";
    joinLobby.addEventListener("click", () => {
      joinRoom("lobby");
    });
  }

  // Custom Room
  const joinCustomRoom = document.getElementById("joinCustomRoom");
  if (joinCustomRoom && joinCustomRoom.dataset.bound !== "true") {
    joinCustomRoom.dataset.bound = "true";
    joinCustomRoom.addEventListener("click", () => {
      const roomId = document.getElementById("customRoomId").value.trim();
      if (roomId) {
        joinRoom(roomId);
      } else {
        showNotification("Please enter a room ID", "error");
      }
    });
  }

  // Change room from main app
  const changeRoom = document.getElementById("changeRoom");
  if (changeRoom && changeRoom.dataset.bound !== "true") {
    changeRoom.dataset.bound = "true";
    changeRoom.addEventListener("click", () => {
      leaveRoom();
      showRoomSelection();
    });
  }

  const mobileRoomButton = document.getElementById("mobileRoomButton");
  if (mobileRoomButton && mobileRoomButton.dataset.bound !== "true") {
    mobileRoomButton.dataset.bound = "true";
    mobileRoomButton.addEventListener("click", () => {
      leaveRoom();
      showRoomSelection();
    });
  }
}

function leaveRoom() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  app = null;
}

function joinRoom(roomId) {
  console.log(`🎯 Joining room: ${roomId}`);
  currentRoom = roomId;

  // Update room display
  const currentRoomElement = document.getElementById("currentRoom");
  const mobileRoomElement = document.getElementById("mobileRoom");

  if (currentRoomElement) currentRoomElement.textContent = roomId.toUpperCase();
  if (mobileRoomElement) mobileRoomElement.textContent = roomId.toUpperCase();

  showApp();
  initializeCanvas();
}

// ---------- USER PROFILE ----------

function setupUserProfile(user) {
  console.log("👤 Setting up user profile:", user.email);

  const avatarUrl =
    user.user_metadata?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user.user_metadata?.name || user.email
    )}&background=random`;

  const userNameElement = document.getElementById("userName");
  const mobileUserNameElement = document.getElementById("mobileUserName");
  const userAvatarElement = document.getElementById("userAvatar");
  const headerAvatarElement = document.getElementById("headerAvatar");
  const mobileAvatarElement = document.getElementById("mobileAvatar");

  if (userNameElement)
    userNameElement.textContent = user.user_metadata?.name || user.email;
  if (mobileUserNameElement)
    mobileUserNameElement.textContent = user.user_metadata?.name || user.email;
  if (userAvatarElement) userAvatarElement.src = avatarUrl;
  if (headerAvatarElement) headerAvatarElement.src = avatarUrl;
  if (mobileAvatarElement) mobileAvatarElement.src = avatarUrl;
}

// ---------- CANVAS INITIALIZATION ----------

function initializeCanvas() {
  console.log("🎨 Initializing canvas for room:", currentRoom);

  const canvasEl = document.getElementById("canvas");

  if (!canvasEl) {
    console.error("❌ Canvas element not found!");
    return;
  }

  app = setupCanvas(canvasEl);

  socket = createSocket({
    onInit({ roomId, users, history }) {
      console.log("✅ Room initialized:", roomId, "Users:", users.length);
      app.clear();
      app.replay(history);
      renderUsers(users);
      updateRoomUsers(users.length);
      hideWelcomeMessage();
    },

    onUserJoin(user) {
      console.log("👋 User joined:", user.name);
      showNotification(`${user.name} joined the room`, "info");
      addFloatingUser(user);
    },

    onUserLeft({ userId, userName }) {
      console.log("👋 User left:", userName);
      showNotification(`${userName} left the room`, "info");
      removeFloatingUser(userId);
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
      const latencyElement = document.getElementById("latency");
      const mobileLatencyElement = document.getElementById("mobileLatency");

      if (latencyElement) latencyElement.innerHTML = `⏱️${ms}ms`;
      if (mobileLatencyElement) mobileLatencyElement.innerHTML = `⏱️${ms}ms`;
    },

    onRoomUpdateUsers(users) {
      console.log("👥 Room users updated:", users.length);
      renderUsers(users);
    },
  });

  // Join room with user data
  socket.emit("join", {
    user: {
      id: currentUser.id,
      name: currentUser.user_metadata?.name || currentUser.email,
      email: currentUser.email,
      avatar: currentUser.user_metadata?.avatar_url,
    },
    roomId: currentRoom,
  });

  // Tool event handlers
  setupToolHandlers();
  setupMobileHandlers();
}

// ---------- TOOL HANDLERS ----------

function setupToolHandlers() {
  const undoBtn = document.getElementById("undo");
  const redoBtn = document.getElementById("redo");
  const clearBtn = document.getElementById("clear");

  if (undoBtn && undoBtn.dataset.bound !== "true") {
    undoBtn.dataset.bound = "true";
    undoBtn.onclick = () => socket?.emit("history:undo");
  }

  if (redoBtn && redoBtn.dataset.bound !== "true") {
    redoBtn.dataset.bound = "true";
    redoBtn.onclick = () => socket?.emit("history:redo");
  }

  if (clearBtn && clearBtn.dataset.bound !== "true") {
    clearBtn.dataset.bound = "true";
    clearBtn.onclick = () => {
      app?.clear();
      socket?.emit("canvas:clear");
    };
  }

  // Mobile actions
  const mobileUndo = document.getElementById("mobileUndo");
  const mobileRedo = document.getElementById("mobileRedo");
  const mobileClear = document.getElementById("mobileClear");

  if (mobileUndo && mobileUndo.dataset.bound !== "true") {
    mobileUndo.dataset.bound = "true";
    mobileUndo.addEventListener("click", () => {
      socket?.emit("history:undo");
      closeMobileSidebar();
    });
  }

  if (mobileRedo && mobileRedo.dataset.bound !== "true") {
    mobileRedo.dataset.bound = "true";
    mobileRedo.addEventListener("click", () => {
      socket?.emit("history:redo");
      closeMobileSidebar();
    });
  }

  if (mobileClear && mobileClear.dataset.bound !== "true") {
    mobileClear.dataset.bound = "true";
    mobileClear.addEventListener("click", () => {
      app?.clear();
      socket?.emit("canvas:clear");
      closeMobileSidebar();
    });
  }

  // Tool synchronization
  setupToolSynchronization();
}

function setupToolSynchronization() {
  const toolSelect = document.getElementById("tool");
  const mobileToolSelect = document.getElementById("mobileTool");
  const brushStyleSelect = document.getElementById("brushStyle");
  const mobileBrushStyleSelect = document.getElementById("mobileBrushStyle");
  const colorInput = document.getElementById("color");
  const mobileColorInput = document.getElementById("mobileColor");
  const widthInput = document.getElementById("width");
  const mobileWidthInput = document.getElementById("mobileWidth");

  // Tool sync
  if (toolSelect && mobileToolSelect && !toolSelect.dataset.syncBound) {
    toolSelect.dataset.syncBound = "true";

    toolSelect.addEventListener("change", (e) => {
      mobileToolSelect.value = e.target.value;
    });

    mobileToolSelect.addEventListener("change", (e) => {
      toolSelect.value = e.target.value;
    });
  }

  // Brush style sync
  if (
    brushStyleSelect &&
    mobileBrushStyleSelect &&
    !brushStyleSelect.dataset.syncBound
  ) {
    brushStyleSelect.dataset.syncBound = "true";

    brushStyleSelect.addEventListener("change", (e) => {
      mobileBrushStyleSelect.value = e.target.value;
    });

    mobileBrushStyleSelect.addEventListener("change", (e) => {
      brushStyleSelect.value = e.target.value;
    });
  }

  // Color sync
  if (colorInput && mobileColorInput && !colorInput.dataset.syncBound) {
    colorInput.dataset.syncBound = "true";

    colorInput.addEventListener("input", (e) => {
      mobileColorInput.value = e.target.value;
    });

    mobileColorInput.addEventListener("input", (e) => {
      colorInput.value = e.target.value;
    });
  }

  // Width sync
  if (widthInput && mobileWidthInput && !widthInput.dataset.syncBound) {
    widthInput.dataset.syncBound = "true";

    widthInput.addEventListener("input", (e) => {
      mobileWidthInput.value = e.target.value;
      updateWidthDisplay(e.target.value);
    });

    mobileWidthInput.addEventListener("input", (e) => {
      widthInput.value = e.target.value;
      updateWidthDisplay(e.target.value);
    });
  }

  // Canvas events
  const canvasEl = document.getElementById("canvas");
  if (canvasEl && !canvasEl.dataset.contextMenuBound) {
    canvasEl.dataset.contextMenuBound = "true";

    canvasEl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      return false;
    });
  }

  // Stroke events
  if (app && !app._strokeBound) {
    app._strokeBound = true;
    app.onStrokeStart = (s) => socket?.emit("stroke:start", s);
    app.onStrokePoint = (p) => socket?.emit("stroke:point", p);
    app.onStrokeEnd = () => socket?.emit("stroke:end");
    app.onCursor = (c) => socket?.emit("cursor:move", c);
  }
}

function updateWidthDisplay(value) {
  const mobileWidthValue = document.getElementById("mobileWidthValue");
  const widthValue = document.getElementById("widthValue");

  if (mobileWidthValue) mobileWidthValue.textContent = value;
  if (widthValue) widthValue.textContent = value;
}

// ---------- MOBILE HANDLERS ----------

function setupMobileHandlers() {
  const menuButton = document.getElementById("mobileMenuButton");
  const overlay = document.getElementById("sidebarOverlay");
  const closeButton = document.querySelector(".close-sidebar");

  if (menuButton && menuButton.dataset.bound !== "true") {
    menuButton.dataset.bound = "true";
    menuButton.addEventListener("click", openMobileSidebar);
  }

  if (overlay && overlay.dataset.bound !== "true") {
    overlay.dataset.bound = "true";
    overlay.addEventListener("click", closeMobileSidebar);
  }

  if (closeButton && closeButton.dataset.bound !== "true") {
    closeButton.dataset.bound = "true";
    closeButton.addEventListener("click", closeMobileSidebar);
  }

  // Swipe to close
  let touchStartX = 0;
  const sidebar = document.getElementById("mobileSidebar");
  if (sidebar && !sidebar.dataset.swipeBound) {
    sidebar.dataset.swipeBound = "true";

    sidebar.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
    });

    sidebar.addEventListener("touchend", (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      const swipeDistance = touchEndX - touchStartX;

      if (swipeDistance < -50) {
        closeMobileSidebar();
      }
    });
  }
}

// ---------- USER MANAGEMENT ----------

function renderUsers(users) {
  const usersCount = users.length;
  const usersElement = document.getElementById("users");
  if (usersElement) usersElement.innerHTML = `👥 ${usersCount}`;
  updateRoomUsers(usersCount);

  // Update floating users
  const floatingUsers = document.getElementById("floatingUsers");
  if (floatingUsers) {
    floatingUsers.innerHTML = "";
    users.forEach((user) => addFloatingUser(user));
  }
}

function addFloatingUser(user) {
  const floatingUsers = document.getElementById("floatingUsers");
  if (!floatingUsers) return;

  const userEl = document.createElement("div");
  userEl.className = "floating-user";
  userEl.setAttribute("data-user", user.id);
  userEl.innerHTML = `
    <img src="${
      user.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        user.name
      )}&background=random`
    }" 
         alt="${user.name}" 
         title="${user.name}">
  `;
  floatingUsers.appendChild(userEl);
}

function removeFloatingUser(userId) {
  const floatingUsers = document.getElementById("floatingUsers");
  if (!floatingUsers) return;

  const userEl = floatingUsers.querySelector(`[data-user="${userId}"]`);
  if (userEl) {
    userEl.remove();
  }
}

function updateRoomUsers(count) {
  const roomUsers = document.getElementById("roomUsers");
  const mobileRoomUsers = document.getElementById("mobileRoomUsers");

  if (roomUsers) roomUsers.textContent = `${count} users`;
  if (mobileRoomUsers) mobileRoomUsers.textContent = `${count} users`;
}

function hideWelcomeMessage() {
  const welcomeMessage = document.getElementById("welcomeMessage");
  if (welcomeMessage) welcomeMessage.style.display = "none";
}

// ---------- NOTIFICATION SYSTEM ----------

function showNotification(message, type = "info") {
  const notificationContainer = document.getElementById(
    "notificationContainer"
  );
  if (!notificationContainer) return;

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <span class="notification-message">${message}</span>
    <button class="notification-close">&times;</button>
  `;

  notificationContainer.appendChild(notification);

  const closeButton = notification.querySelector(".notification-close");
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      notification.remove();
    });
  }

  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}

// ---------- DOM READY + ORIENTATION ----------

// Important: bind handlers first, then decide what to show based on Supabase session
document.addEventListener("DOMContentLoaded", () => {
  setupAuthHandlers();
  setupLogoutHandlers();
  initApp();
});

window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    const canvasEl = document.getElementById("canvas");
    if (canvasEl) {
      canvasEl.dispatchEvent(new Event("resize"));
    }
    closeMobileSidebar();
  }, 300);
});
