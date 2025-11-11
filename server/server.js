import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { Rooms } from "./rooms.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

const rooms = new Rooms(io);


app.use(express.static("client"));


io.on("connection", (socket) => {
  socket.on("ping:now", () => socket.emit("pong:now"));

  
  socket.on("join", ({ username, roomId } = {}) => {
    const user = rooms.addUser(socket, { username, roomId });
    socket.join(user.roomId);

    const room = rooms.getRoom(user.roomId);
    const state = room.state.getSnapshot();

    
    socket.emit("room:init", {
      roomId: user.roomId,
      users: rooms.usersPublic(user.roomId),
      history: state.history,
      nextOpId: state.nextOpId,
    });

    
    io.to(user.roomId).emit("room:updateUsers", rooms.usersPublic(user.roomId));
  });

 
  socket.on("cursor:move", (payload) => {
    const user = rooms.getUser(socket.id);
    if (!user) return;
    socket.to(user.roomId).emit("cursor:move", {
      userId: user.id,
      color: user.color,
      ...payload,
    });
  });

 
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

 
  socket.on("disconnect", () => {
    const user = rooms.removeUser(socket.id);
    if (!user) return;

    
    io.to(user.roomId).emit("room:updateUsers", rooms.usersPublic(user.roomId));
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(` Server listening on http://localhost:${PORT}`);
});
