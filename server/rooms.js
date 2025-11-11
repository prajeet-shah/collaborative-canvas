import { DrawingState } from "./drawing-state.js";

export class Rooms {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); 
    this.users = new Map(); 
  }

  ensureRoom(roomId = "lobby") {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        state: new DrawingState(),
        users: new Map(),
      });
    }
    return this.rooms.get(roomId);
  }

 usersPublic(roomId = "lobby") {
  const room = this.getRoom(roomId);
  return Array.from(room.users.values()).map(u => ({
    id: u.id,
    name: u.name,
    color: u.color
  }));
}

  addUser(socket, { username = "Guest", roomId = "lobby" } = {}) {
    const room = this.ensureRoom(roomId);
    const user = {
      id: socket.id,
      name: username,
      color: pickColorForUser(room.users.size),
      roomId,
    };
    room.users.set(user.id, user);
    this.users.set(socket.id, user);
    return user;
  }

  removeUser(socketId) {
    const user = this.users.get(socketId);
    if (!user) return null;
    const room = this.rooms.get(user.roomId);
    if (room) room.users.delete(user.id);
    this.users.delete(socketId);
    return user;
  }

  getUser(socketId) {
    return this.users.get(socketId);
  }

  getRoom(roomId = "lobby") {
    return this.ensureRoom(roomId);
  }
}

const PALETTE = [
  "#e74c3c",
  "#9b59b6",
  "#2980b9",
  "#16a085",
  "#f39c12",
  "#2ecc71",
  "#e84393",
  "#00b894",
];
function pickColorForUser(i) {
  return PALETTE[i % PALETTE.length];
}
