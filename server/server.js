const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const RoomManager = require('./rooms/RoomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const roomManager = new RoomManager();

io.on('connection', (socket) => {
  console.log(`Oyuncu bağlandı: ${socket.id}`);

  socket.on('create_room', (data, callback) => {
    // Eski istemciler yalnızca callback gönderebilir; yeni istemci karakteri de gönderir.
    if (typeof data === 'function') { callback = data; data = {}; }
    const roomCode = roomManager.createRoom(socket.id, data?.character);
    socket.join(roomCode);
    callback({ success: true, roomCode, room: roomManager.getRoom(roomCode) });
  });

  socket.on('join_room', ({ roomCode, character }, callback) => {
    const result = roomManager.joinRoom(roomCode, socket.id, character);
    if (result.success) {
      socket.join(roomCode);
      io.to(roomCode).emit('update_lobby', result.room);
      callback({ success: true, room: result.room });
    } else {
      callback({ success: false, message: result.message });
    }
  });

  socket.on('player_ready', ({ roomCode, ready }) => {
    const room = roomManager.setReady(roomCode, socket.id, ready);
    if (!room) return;
    io.to(roomCode).emit('update_lobby', room);
    if (room.state === 'playing') {
      io.to(roomCode).emit('start_match', room);
    }
  });

  // İstemciden gelen hareket/aksiyon verisini odadaki diğer oyunculara ilet
  socket.on('player_input', (data) => {
    socket.to(data.roomCode).emit('remote_player_input', data);
  });

  // Top sahibi istemci (host) topun pozisyonunu diğer tarafa iletir (basit otorite modeli)
  socket.on('ball_update', (data) => {
    socket.to(data.roomCode).emit('remote_ball_update', data);
  });

  // Gol / skor senkronizasyonu
  socket.on('goal_scored', (data) => {
    io.to(data.roomCode).emit('remote_goal_scored', data);
  });

  // Host-authoritative maç durumu senkronizasyonu (top + tüm oyuncu pozisyonları + skor + süre)
  socket.on('match_state', (data) => {
    socket.to(data.roomCode).emit('remote_match_state', data);
  });

  socket.on('disconnect', () => {
    const room = roomManager.findRoomBySocket(socket.id);
    roomManager.removePlayer(socket.id);
    if (room) {
      io.to(room.code).emit('opponent_left');
    }
    console.log(`Oyuncu ayrıldı: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sunucu çalışıyor: ${PORT}`);
});
