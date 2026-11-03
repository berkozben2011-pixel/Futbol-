class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(socketId) {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.rooms.set(roomCode, {
      code: roomCode,
      host: socketId,
      players: [{ id: socketId, team: 'home', character: 'berk', ready: false }],
      state: 'lobby' // lobby, playing, ended
    });
    return roomCode;
  }

  joinRoom(roomCode, socketId) {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, message: 'Oda bulunamadı!' };
    if (room.state !== 'lobby') return { success: false, message: 'Maç zaten başladı!' };
    if (room.players.length >= 2) return { success: false, message: 'Oda dolu!' };

    room.players.push({ id: socketId, team: 'away', character: 'yigit', ready: false });
    return { success: true, room };
  }

  setReady(roomCode, socketId, ready) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const player = room.players.find(p => p.id === socketId);
    if (player) player.ready = ready;

    // İki oyuncu da hazırsa maçı başlat
    if (room.players.length === 2 && room.players.every(p => p.ready)) {
      room.state = 'playing';
    }
    return room;
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  findRoomBySocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.id === socketId)) return room;
    }
    return null;
  }

  removePlayer(socketId) {
    for (let [code, room] of this.rooms.entries()) {
      const wasInRoom = room.players.some(p => p.id === socketId);
      room.players = room.players.filter(p => p.id !== socketId);
      if (room.players.length === 0) {
        this.rooms.delete(code);
      } else if (wasInRoom && room.host === socketId) {
        room.host = room.players[0].id; // Yeni host atama
      }
    }
  }
}

module.exports = RoomManager;
