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
      console.log(`Created new room: ${roomId}`);
    }
    return this.rooms.get(roomId);
  }

  usersPublic(roomId = "lobby") {
    const room = this.getRoom(roomId);
    return Array.from(room.users.values()).map(u => ({
      id: u.id,
      name: u.name,
      color: u.color,
      avatar: u.avatar,
      supabaseUserId: u.supabaseUserId
    }));
  }

  addUser(socket, { username = "Guest", roomId = "lobby", supabaseUserId, avatar } = {}) {
    const room = this.ensureRoom(roomId);
    const user = {
      id: socket.id,
      supabaseUserId,
      name: username,
      color: pickColorForUser(supabaseUserId || socket.id),
      roomId,
      avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`,
      joinedAt: new Date()
    };
    
    room.users.set(user.id, user);
    this.users.set(socket.id, user);
    
    console.log(`User ${user.name} joined room ${roomId}`);
    return user;
  }

  removeUser(socketId) {
    const user = this.users.get(socketId);
    if (!user) return null;
    
    const room = this.rooms.get(user.roomId);
    if (room) {
      room.users.delete(user.id);
      console.log(`User ${user.name} left room ${user.roomId}`);
      
      // Clean up empty rooms (optional)
      if (room.users.size === 0) {
        this.rooms.delete(user.roomId);
        console.log(`Removed empty room: ${user.roomId}`);
      }
    }
    
    this.users.delete(socketId);
    return user;
  }

  getUser(socketId) {
    return this.users.get(socketId);
  }

  getRoom(roomId = "lobby") {
    return this.ensureRoom(roomId);
  }

  // Get room statistics
  getRoomStats(roomId) {
    const room = this.getRoom(roomId);
    return {
      userCount: room.users.size,
      strokeCount: room.state.history.length,
      activeUsers: Array.from(room.users.values()).map(u => u.name)
    };
  }
}

// Improved color picking with consistent colors for same users
const PALETTE = [
  "#e74c3c", "#9b59b6", "#3498db", "#1abc9c", 
  "#f39c12", "#2ecc71", "#e84393", "#00b894",
  "#0984e3", "#fd79a8", "#fdcb6e", "#636e72"
];

function pickColorForUser(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}