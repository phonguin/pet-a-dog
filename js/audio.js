/* ============================================================
   audio.js — 사운드 엔진 (Web Audio API)
   ------------------------------------------------------------
   - 긁는 소리(ASMR): 화이트노이즈를 필터링한 "벅벅" 마찰음
     → 도구마다 음색(필터 종류/주파수/Q)이 다름
   - 배경음: 따뜻한 화음 패드
   - 효과음: 행복할 때 "딩", 뒷발 탁탁 "통통", 레벨업 멜로디
   - 멍멍: models/sounds/dog.ogg (Wikimedia Commons, CC BY-SA)
   ------------------------------------------------------------
   브라우저 정책상 첫 클릭/터치 후에 소리가 켜집니다.
   ============================================================ */
console.log("[강아지벅벅3D] audio.js 로드");

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = true;
    this._lastHappy = 0;
    this._lastThump = 0;
    this._sleepy = 0;
    this._tone = null;

    // 멍멍 소리 (오디오 파일 — file:// 에서도 <audio>는 동작)
    this._bark = new Audio("models/sounds/dog.ogg");
    this._bark.preload = "auto";
    this._bark.volume = 0.55;
    this._lastBark = 0;
    this._barkStopTimer = null;
  }

  /* 첫 사용자 입력 때 호출 — 오디오 컨텍스트 생성 */
  start() {
    if (this.ready) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    this._buildAmbient();
    this._buildScratch();

    this.ready = true;
    this.setMuted(false);
  }

  /* ---------- 배경음: 따뜻한 화음 패드 ---------- */
  _buildAmbient() {
    const ctx = this.ctx;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.0;
    const padLow = ctx.createBiquadFilter();
    padLow.type = "lowpass";
    padLow.frequency.value = 900;
    this.ambientGain.connect(padLow).connect(this.master);

    const chord = [130.81, 196.0, 261.63, 329.63]; // C3 G3 C4 E4
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;
      osc.detune.value = (i - 1.5) * 4;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      osc.connect(g).connect(this.ambientGain);
      osc.start();
    });

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.18;
    lfo.connect(lfoGain).connect(this.ambientGain.gain);
    this.ambientGain.gain.value = 0.32;
    lfo.start();
  }

  /* ---------- 긁는 소리: 필터링한 노이즈 ---------- */
  _buildScratch() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.noise = ctx.createBufferSource();
    this.noise.buffer = buf;
    this.noise.loop = true;

    this.scratchFilter = ctx.createBiquadFilter();
    this.scratchFilter.type = "bandpass";
    this.scratchFilter.frequency.value = 1200;
    this.scratchFilter.Q.value = 0.8;

    this.scratchGain = ctx.createGain();
    this.scratchGain.gain.value = 0.0;

    this.noise.connect(this.scratchFilter).connect(this.scratchGain).connect(this.master);
    this.noise.start();

    // 마사지건용 진동 트레몰로 (소리 크기를 빠르게 떨리게)
    this._tremolo = ctx.createOscillator();
    this._tremolo.frequency.value = 26;
    this._tremGain = ctx.createGain();
    this._tremGain.gain.value = 0; // 평소엔 영향 없음
    this._tremolo.connect(this._tremGain).connect(this.scratchGain.gain);
    this._tremolo.start();
  }

  /* 도구별 음색 프로파일 (tools.js가 도구 바꿀 때 호출)
     tone: { baseFreq, freqRange, q, gain, type, tremolo } */
  setScratchTone(tone) {
    this._tone = tone || null;
    if (this.ready && this.scratchFilter && tone) {
      this.scratchFilter.type = tone.type || "bandpass";
      this.scratchFilter.Q.setTargetAtTime(tone.q || 0.8, this.ctx.currentTime, 0.05);
      this._tremGain.gain.setTargetAtTime(tone.tremolo ? 0.07 : 0, this.ctx.currentTime, 0.05);
    }
  }

  /* 매 프레임 — 긁기 강도(0~1)에 맞춰 소리 크기/음색 변경 */
  setScratch(intensity) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const tone = this._tone;
    const baseFreq = tone ? tone.baseFreq : 900;
    const freqRange = tone ? tone.freqRange : 3600;
    const gainMul = tone ? tone.gain : 0.16;
    const vol = Math.max(0, Math.min(1, intensity)) * gainMul;
    const freq = baseFreq + intensity * freqRange;
    this.scratchGain.gain.setTargetAtTime(vol, t, 0.04);
    this.scratchFilter.frequency.setTargetAtTime(freq, t, 0.05);
  }

  /* 행복 효과음 — 부드러운 "딩" */
  playHappy() {
    if (!this.ready || this.muted) return;
    const now = performance.now();
    if (now - this._lastHappy < 220) return;
    this._lastHappy = now;

    const ctx = this.ctx;
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0];
    const f = scale[(Math.random() * scale.length) | 0];
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  /* 뒷발 탁탁 — 낮은 "통" 소리 (엉덩이 긁기 반사) */
  playThump() {
    if (!this.ready || this.muted) return;
    const now = performance.now();
    if (now - this._lastThump < 110) return;
    this._lastThump = now;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /* 레벨업 멜로디 — 도미솔도 ✨ */
  playLevelUp() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.11;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  /* 멍멍! — 실제 강아지 소리 1.4초만 재생 후 페이드아웃 */
  playBark(intensity) {
    if (this.muted) return;
    const now = performance.now();
    if (now - this._lastBark < 2500) return;
    this._lastBark = now;
    const a = this._bark;
    try {
      a.currentTime = 0;
      a.volume = 0.4 + Math.min(1, intensity || 0.5) * 0.35;
      a.playbackRate = 0.95 + Math.random() * 0.15;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
      clearTimeout(this._barkStopTimer);
      this._barkStopTimer = setTimeout(() => {
        const fade = setInterval(() => {
          if (a.volume > 0.06) a.volume = Math.max(0, a.volume - 0.08);
          else { clearInterval(fade); a.pause(); a.currentTime = 0; }
        }, 40);
      }, 1400);
    } catch (_) {}
  }

  /* 졸림 정도(0~1) — 배경음을 더 나른하게 */
  setSleepy(s) {
    this._sleepy = Math.max(0, Math.min(1, s));
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.ambientGain.gain.setTargetAtTime(0.32 - this._sleepy * 0.14, t, 1.2);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(m ? 0.0 : 0.9, t, 0.2);
  }
  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }
}

window.AudioEngine = AudioEngine;
