// Xbox (ve standart eşlemeli diğer) kontrolcüler için Gamepad API girişi.
// Eşleme (standart mapping):
//   Sol analog çubuk / D-Pad : hareket
//   A  (0) : PAS
//   X  (2) : ARA PAS
//   B  (1) : ŞUT
//   Y  (3) : MÜDAHALE
//   RT (7) / RB (5) / LT (6) : SPRINT (basılı tut)
const DEADZONE = 0.18;

export class GamepadInput {
  constructor({ onPass, onThroughPass, onShoot, onTackle }) {
    this.handlers = { pass: onPass, through: onThroughPass, shoot: onShoot, tackle: onTackle };
    this.prev = {};
    this.move = { x: 0, z: 0 };
    this.sprint = false;
    this.active = false; // Kontrolcüden anlamlı bir hareket girdisi geliyor mu
    this.connected = false;

    window.addEventListener('gamepadconnected', (e) => {
      this.connected = true;
      console.log(`[Gamepad] Bağlandı: ${e.gamepad.id}`);
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.connected = false;
      this.move = { x: 0, z: 0 };
      this.sprint = false;
      this.active = false;
    });
  }

  getPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.connected) return p;
    }
    return null;
  }

  // Her karede çağrılmalı.
  poll() {
    const pad = this.getPad();
    if (!pad) {
      this.move = { x: 0, z: 0 };
      this.sprint = false;
      this.active = false;
      return;
    }

    let x = pad.axes[0] || 0;
    let y = pad.axes[1] || 0; // aşağı = pozitif (joystick ile aynı kural)

    // D-Pad (standart eşlemede 12 yukarı, 13 aşağı, 14 sol, 15 sağ)
    if (pad.buttons[12] && pad.buttons[12].pressed) y = -1;
    if (pad.buttons[13] && pad.buttons[13].pressed) y = 1;
    if (pad.buttons[14] && pad.buttons[14].pressed) x = -1;
    if (pad.buttons[15] && pad.buttons[15].pressed) x = 1;

    const mag = Math.sqrt(x * x + y * y);
    if (mag < DEADZONE) {
      x = 0; y = 0;
    } else {
      // Ölü bölgeyi çıkarıp 0..1'e yeniden ölçekle
      const scaled = Math.min(1, (mag - DEADZONE) / (1 - DEADZONE));
      x = (x / mag) * scaled;
      y = (y / mag) * scaled;
    }

    this.active = x !== 0 || y !== 0;
    this.move = { x, z: -y };

    const down = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    this.sprint = down(7) || down(5) || down(6);

    // Aksiyon butonları: sadece basıldığı an (kenar) tetiklenir
    this.edge(pad, 0, this.handlers.pass);
    this.edge(pad, 2, this.handlers.through);
    this.edge(pad, 1, this.handlers.shoot);
    this.edge(pad, 3, this.handlers.tackle);
  }

  edge(pad, index, handler) {
    const pressed = !!(pad.buttons[index] && pad.buttons[index].pressed);
    if (pressed && !this.prev[index] && handler) handler();
    this.prev[index] = pressed;
  }

  getMoveVector() { return this.move; }
  isSprinting() { return this.sprint; }
  isActive() { return this.active; }
}
