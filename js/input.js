/* ============================================================
   input.js — 긁기 입력 (마우스 + 터치 + 펜 통합)
   ------------------------------------------------------------
   - 포인터를 누른 채 움직이면 "긁는 중"
   - 이동 속도를 0~1(speed01)로 환산 → 손맛/리액션 강도
   - 마사지건처럼 holdPower가 있는 도구는
     움직이지 않고 지긋이 대고만 있어도 동작
   ============================================================ */
console.log("[강아지벅벅3D] input.js 로드");

const SPEED_MAX = 1700; // 이 속도(px/초)면 강도 1.0

class ScratchInput {
  constructor(canvas, dog, getTool) {
    this.canvas = canvas;
    this.dog = dog;
    this.getTool = getTool || (() => null);

    this.down = false;
    this.px = 0; this.py = 0;
    this._lastX = 0; this._lastY = 0;
    this._lastT = 0;
    this._instSpeed = 0;
    this._movedThisFrame = false;

    this.speed01 = 0;
    this.scratching = false;
    this.zone = null;

    this.onFirstInput = null;
    this.onMoveCommand = null;   // 우클릭 이동 명령 (game.js가 꽂음)
    this._firstDone = false;

    this._bind();
  }

  _bind() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => this._onDown(e));
    c.addEventListener("pointermove", (e) => this._onMove(e));
    c.addEventListener("pointerup", (e) => this._onUp(e));
    c.addEventListener("pointercancel", (e) => this._onUp(e));
    c.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    this.px = e.clientX - r.left;
    this.py = e.clientY - r.top;
  }

  _onDown(e) {
    this._pos(e);
    if (!this._firstDone) {
      this._firstDone = true;
      if (this.onFirstInput) this.onFirstInput();
    }
    // 우클릭(버튼 2) = 이동 명령 — 도구 긁기와 분리
    if (e.button === 2) {
      if (this.onMoveCommand) this.onMoveCommand(this.px, this.py);
      return;
    }
    this.down = true;
    this._lastX = this.px; this._lastY = this.py;
    this._lastT = performance.now();
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
  }

  _onMove(e) {
    this._pos(e);
    if (!this.down) return;
    const now = performance.now();
    const dt = Math.max(0.001, (now - this._lastT) / 1000);
    const dist = Math.hypot(this.px - this._lastX, this.py - this._lastY);
    this._instSpeed = Math.min(1, (dist / dt) / SPEED_MAX);
    this._movedThisFrame = true;
    this._lastX = this.px; this._lastY = this.py;
    this._lastT = now;
  }

  _onUp() {
    this.down = false;
    this._instSpeed = 0;
  }

  /* 매 프레임 호출 */
  update(dt) {
    const tool = this.getTool();
    const holdPower = (tool && tool.holdPower) || 0;

    let target = (this.down && this._movedThisFrame) ? this._instSpeed : 0;
    // 마사지건: 대고만 있어도 최소 세기 보장
    if (this.down && holdPower > 0) target = Math.max(target, holdPower);

    const rate = target > this.speed01 ? 18 : 8;
    this.speed01 += (target - this.speed01) * (1 - Math.exp(-dt * rate));
    this._movedThisFrame = false;

    this.zone = this.down ? this.dog.zoneAt(this.px, this.py) : null;
    this.scratching = this.down && this.zone != null && this.speed01 > 0.04;
  }

  getState() {
    return {
      scratching: this.scratching,
      speed01: this.speed01,
      zone: this.zone,
      px: this.scratching ? this.px : null,
      py: this.scratching ? this.py : null,
    };
  }
}

window.ScratchInput = ScratchInput;
