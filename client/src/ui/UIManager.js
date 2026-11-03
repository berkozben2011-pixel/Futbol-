import { Joystick } from './Joystick.js';

export class UIManager {
  constructor() {
    this.scoreBoard = document.getElementById('score-board');
    this.matchTimer = document.getElementById('match-timer');
    this.goalToast = document.getElementById('goal-toast');
    this.endOverlay = document.getElementById('end-match-overlay');
    this.endOverlayText = document.getElementById('end-match-text');

    this.joystick = new Joystick(
      document.getElementById('joystick'),
      document.getElementById('joystick-knob'),
      { radius: 45 }
    );

    this._sprintHeld = false;
    this.bindSprintButton();
  }

  bindSprintButton() {
    const btn = document.getElementById('btn-sprint');
    const setHeld = (val) => { this._sprintHeld = val; };
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); setHeld(true); }, { passive: false });
    btn.addEventListener('touchend', () => setHeld(false));
    btn.addEventListener('touchcancel', () => setHeld(false));
    btn.addEventListener('mousedown', () => setHeld(true));
    btn.addEventListener('mouseup', () => setHeld(false));
    btn.addEventListener('mouseleave', () => setHeld(false));
  }

  isSprinting() {
    return this._sprintHeld;
  }

  getMoveVector() {
    return this.joystick.getMoveVector();
  }

  bindActionButtons({ onPass, onThroughPass, onShoot, onTackle }) {
    document.getElementById('btn-pass').addEventListener('click', onPass);
    document.getElementById('btn-through').addEventListener('click', onThroughPass);
    document.getElementById('btn-shoot').addEventListener('click', onShoot);
    document.getElementById('btn-tackle').addEventListener('click', onTackle);
  }

  updateScore(score) {
    this.scoreBoard.textContent = `EV ${score.home} - ${score.away} DEP`;
  }

  updateTimer(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    this.matchTimer.textContent = `${m}:${s}`;
  }

  showGoalToast(scoringTeam, scorerName, durationMs = 6000) {
    const teamLabel = scoringTeam === 'home' ? '(EV)' : '(DEPLASMAN)';
    this.goalToast.innerHTML = scorerName
      ? `GOOOL! ${teamLabel}<br><span style="font-size:22px;">${scorerName}</span>`
      : `GOOOL! ${teamLabel}`;
    this.goalToast.style.opacity = '1';
    clearTimeout(this._goalTimeout);
    this._goalTimeout = setTimeout(() => {
      this.goalToast.style.opacity = '0';
    }, durationMs);
  }

  showEndOverlay(result, score) {
    let text = 'BERABERE';
    if (result === 'home') text = 'KAZANDIN! 🏆';
    else if (result === 'away') text = 'KAYBETTİN';
    this.endOverlayText.textContent = `${text}\nSkor: EV ${score.home} - ${score.away} DEP`;
    this.endOverlay.style.display = 'flex';
  }

  hideEndOverlay() {
    this.endOverlay.style.display = 'none';
  }

  showGameHUD() {
    document.getElementById('ui-container').style.display = 'flex';
  }

  hideGameHUD() {
    document.getElementById('ui-container').style.display = 'none';
  }
}
