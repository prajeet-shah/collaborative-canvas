import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { Rooms } from "./rooms.js";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { 
    origin: "*",
    methods: ["GET", "POST"]
  },
});

const rooms = new Rooms(io);

// Serve static files from client folder
app.use(express.static(path.join(__dirname, '../client')));

// Handle all routes by serving index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client', 'index.html'));
});

io.on("connection", (socket) => {
  console.log('✅ User connected:', socket.id);

  socket.on("ping:now", () => socket.emit("pong:now"));

  // Join room with user authentication
  socket.on("join", ({ user, roomId } = {}) => {
    if (!user || !user.id) {
      socket.emit("error", { message: "Authentication required" });
      return;
    }

    // Leave any previous rooms
    const previousRoom = Array.from(socket.rooms).find(room => room !== socket.id);
    if (previousRoom && previousRoom !== roomId) {
      socket.leave(previousRoom);
      console.log(`🚪 User ${user.name} left room: ${previousRoom}`);
    }

    const roomUser = rooms.addUser(socket, { 
      username: user.name || user.email, 
      roomId,
      supabaseUserId: user.id,
      avatar: user.avatar
    });
    
    socket.join(roomUser.roomId);

    const room = rooms.getRoom(roomUser.roomId);
    const state = room.state.getSnapshot();

    console.log(`🎯 User ${user.name} joined room: ${roomId}`);

    // Send room initialization data
    socket.emit("room:init", {
      roomId: roomUser.roomId,
      users: rooms.usersPublic(roomUser.roomId),
      history: state.history,
      nextOpId: state.nextOpId,
    });

    // Notify other users in the room
    socket.to(roomUser.roomId).emit("user:joined", roomUser);
    io.to(roomUser.roomId).emit("room:updateUsers", rooms.usersPublic(roomUser.roomId));
  });

  // Cursor movement
  socket.on("cursor:move", (payload) => {
    const user = rooms.getUser(socket.id);
    if (!user) return;
    socket.to(user.roomId).emit("cursor:move", {
      userId: user.id,
      color: user.color,
      ...payload,
    });
  });

  // Drawing operations
  socket.on("stroke:start", (stroke) => {
    const user = rooms.getUser(socket.id);
    if (!user) return;
    const op = rooms.getRoom(user.roomId).state.beginStroke(user, stroke);
    io.to(user.roomId).emit("stroke:start", op);
  });

  socket.on("stroke:point", (segment) => {
    const user = rooms.getUser(socket.id);
    if (!user) return;
    const op = rooms.getRoom(user.roomId).state.appendPoint(user, segment);
    if (!op) return;
    io.to(user.roomId).emit("stroke:point", op);
  });

  socket.on("stroke:end", () => {
    const user = rooms.getUser(socket.id);
    if (!user) return;
    const op = rooms.getRoom(user.roomId).state.endStroke(user);
    if (!op) return;
    io.to(user.roomId).emit("stroke:end", op);
  });

  // Canvas clearing
  socket.on("canvas:clear", () => {
    const user = rooms.getUser(socket.id);
    if (!user) return;
    const room = rooms.getRoom(user.roomId);
    room.state.history = [];
    room.state.redoStack = [];
    io.to(user.roomId).emit("canvas:cleared");
    io.to(user.roomId).emit("history:replace", room.state.getSnapshot());
  });

  // History operations
  socket.on("history:undo", () => {
    const user = rooms.getUser(socket.id);
    if (!user) return;
    const change = rooms.getRoom(user.roomId).state.undo();
    if (!change) return;
    io.to(user.roomId).emit("history:replace", change);
  });

  socket.on("history:redo", () => {
    const user = rooms.getUser(socket.id);
    if (!user) return;
    const change = rooms.getRoom(user.roomId).state.redo();
    if (!change) return;
    io.to(user.roomId).emit("history:replace", change);
  });

  // Disconnection
  socket.on("disconnect", () => {
    const user = rooms.removeUser(socket.id);
    if (!user) return;

    // Notify other users
    socket.to(user.roomId).emit("user:left", { 
      userId: user.id, 
      userName: user.name 
    });
    io.to(user.roomId).emit("room:updateUsers", rooms.usersPublic(user.roomId));
    
    console.log('❌ User disconnected:', user.name);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});