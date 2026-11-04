// Not: socket.io-client kütüphanesi index.html içine CDN <script> etiketiyle
// eklenir ve global `io` fonksiyonunu sağlar. Bu dosya onun ince bir sarmalayıcısıdır.
export class NetworkClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.roomCode = null;
  }

  connect() {
    if (typeof io === 'undefined') {
      throw new Error('socket.io-client yüklenmedi. index.html içindeki CDN script etiketini kontrol edin.');
    }
    this.socket = io(this.serverUrl, { transports: ['websocket'], reconnectionAttempts: 3 });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Sunucuya bağlanılamadı (zaman aşımı).')), 6000);
      this.socket.on('connect', () => {
        clearTimeout(timeout);
        resolve(this.socket);
      });
      this.socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  createRoom(character) {
    return new Promise((resolve) => {
      this.socket.emit('create_room', { character }, (res) => {
        if (res.success) this.roomCode = res.roomCode;
        resolve(res);
      });
    });
  }

  joinRoom(roomCode, character) {
    return new Promise((resolve) => {
      this.socket.emit('join_room', { roomCode, character }, (res) => {
        if (res.success) this.roomCode = roomCode;
        resolve(res);
      });
    });
  }

  setReady(ready) {
    this.socket.emit('player_ready', { roomCode: this.roomCode, ready });
  }

  sendInput(data) {
    this.socket.emit('player_input', { ...data, roomCode: this.roomCode });
  }

  sendBallUpdate(data) {
    this.socket.emit('ball_update', { ...data, roomCode: this.roomCode });
  }

  sendGoal(data) {
    this.socket.emit('goal_scored', { ...data, roomCode: this.roomCode });
  }

  on(event, handler) {
    this.socket.on(event, handler);
  }

  disconnect() {
    if (this.socket) this.socket.disconnect();
  }
}
