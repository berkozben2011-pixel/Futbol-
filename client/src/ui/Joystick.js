export class Joystick {
  constructor(areaEl, knobEl, { radius = 50 } = {}) {
    this.area = areaEl;
    this.knob = knobEl;
    this.radius = radius;
    this.active = false;
    this.center = { x: 0, y: 0 };
    this.value = { x: 0, y: 0 }; // -1..1, y ekseni ekranda aşağı pozitif

    this.onStart = this.onStart.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onEnd = this.onEnd.bind(this);

    this.area.addEventListener('touchstart', this.onStart, { passive: false });
    this.area.addEventListener('touchmove', this.onMove, { passive: false });
    this.area.addEventListener('touchend', this.onEnd);
    this.area.addEventListener('touchcancel', this.onEnd);

    // Masaüstünde test edebilmek için fare desteği
    this.area.addEventListener('mousedown', this.onStart);
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('mouseup', this.onEnd);
  }

  getPoint(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  onStart(e) {
    e.preventDefault();
    const rect = this.area.getBoundingClientRect();
    this.center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.active = true;
    this.onMove(e);
  }

  onMove(e) {
    if (!this.active) return;
    e.preventDefault();
    const p = this.getPoint(e);
    let dx = p.x - this.center.x;
    let dy = p.y - this.center.y;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), this.radius);
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * dist;
    const knobY = Math.sin(angle) * dist;

    if (this.knob) {
      this.knob.style.transform = `translate(${knobX}px, ${knobY}px)`;
    }

    this.value.x = knobX / this.radius;
    this.value.y = knobY / this.radius;
  }

  onEnd() {
    if (!this.active) return;
    this.active = false;
    this.value.x = 0;
    this.value.y = 0;
    if (this.knob) this.knob.style.transform = 'translate(0px, 0px)';
  }

  // Oyun dünyası hareket vektörü: x = sağ/sol, z = ileri/geri (joystick yukarı -> ileri)
  getMoveVector() {
    return { x: this.value.x, z: -this.value.y };
  }
}
