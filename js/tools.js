/* ============================================================
   tools.js — 교감 도구 시스템
   ------------------------------------------------------------
   손 · 빗 · 깃털 · 숟가락 · 마사지건 — 도구마다
   세기/음색/파티클이 다르고, 부위(머리·몸·다리·꼬리·엉덩이)와
   조합하면 특별한 반응이 나옵니다.

   도구 필드:
    power      : 긁는 세기 배수 (출렁임/리액션 게이지 속도)
    comfortMul : 편안함 증가 배수
    exciteMul  : 흥분 증가 배수
    happyMul   : 행복 증가 배수
    sleepyAdd  : 누를수록 졸림 증가(마사지건)
    furBurst   : 털 파티클 양 배수
    holdPower  : 움직이지 않고 "지긋이 대고만" 있어도 나는 세기 (마사지건)
    tone       : 긁는 소리 음색 {baseFreq, freqRange, q, gain, type, tremolo}
    zoneBoost  : 부위별 리액션 증폭 {head, body, legs, tail, hip}
    zoneText   : 부위별 특수 대사 (기분 텍스트에 사용)
   ============================================================ */
console.log("[강아지벅벅3D] tools.js 로드");

const TOOLS = [
  {
    id: "hand", name: "손", emoji: "🖐️",
    power: 1.0, comfortMul: 1.0, exciteMul: 1.0, happyMul: 1.0,
    sleepyAdd: 0, furBurst: 1.0, holdPower: 0,
    tone: { baseFreq: 900, freqRange: 3600, q: 0.8, gain: 0.16, type: "bandpass" },
    zoneBoost: { head: 1.3, body: 1.0, legs: 1.0, tail: 1.0, hip: 1.0 },
    zoneText: {
      head: "쓰담쓰담… 손길이 제일 좋아 🥰",
      body: "몸을 부드럽게 쓰다듬어요",
      legs: "발을 조물조물~ 발 마사지!",
      tail: "꼬리를 살살 만져요",
      hip: "엉덩이 팡팡! 좋아해요",
    },
  },
  {
    id: "brush", name: "빗", emoji: "🪮",
    power: 0.9, comfortMul: 1.6, exciteMul: 0.7, happyMul: 1.2,
    sleepyAdd: 0.15, furBurst: 2.2, holdPower: 0,
    tone: { baseFreq: 700, freqRange: 2600, q: 0.5, gain: 0.15, type: "highpass" },
    zoneBoost: { head: 1.1, body: 1.6, legs: 0.8, tail: 1.2, hip: 1.0 },
    zoneText: {
      head: "머리 빗질~ 미용실 온 것 같아",
      body: "슥슥 빗질… 털에 윤기가 자르르 ✨",
      legs: "다리 털도 곱게 빗어요",
      tail: "꼬리털이 풍성해져요!",
      hip: "엉덩이 털 정리 중~",
    },
  },
  {
    id: "feather", name: "깃털", emoji: "🪶",
    power: 0.6, comfortMul: 0.5, exciteMul: 1.8, happyMul: 1.3,
    sleepyAdd: 0, furBurst: 0.4, holdPower: 0,
    tone: { baseFreq: 2200, freqRange: 4800, q: 1.4, gain: 0.1, type: "bandpass" },
    zoneBoost: { head: 1.0, body: 1.3, legs: 2.0, tail: 1.4, hip: 1.2 },
    zoneText: {
      head: "코끝이 간질간질… 에취!",
      body: "간지러워서 몸을 비틀어요 😆",
      legs: "발바닥 간지럼은 못 참아!! 파닥파닥",
      tail: "꼬리가 깃털을 잡으려고 빙빙~",
      hip: "엉덩이가 움찔움찔!",
    },
  },
  {
    id: "spoon", name: "숟가락", emoji: "🥄",
    power: 1.7, comfortMul: 1.2, exciteMul: 1.1, happyMul: 1.1,
    sleepyAdd: 0, furBurst: 1.3, holdPower: 0,
    tone: { baseFreq: 500, freqRange: 1800, q: 1.6, gain: 0.19, type: "lowpass" },
    zoneBoost: { head: 0.9, body: 1.4, legs: 0.9, tail: 0.8, hip: 1.9 },
    zoneText: {
      head: "숟가락으로 머리를 토닥토닥",
      body: "등을 숟가락으로 벅벅!! 시원해~",
      legs: "다리를 꾹꾹 눌러줘요",
      tail: "꼬리는 살살 해줘요…",
      hip: "엉덩이 벅벅!! 뒷발이 저절로 탁탁탁 🦵",
    },
  },
  {
    id: "massage", name: "마사지건", emoji: "📳",
    power: 1.2, comfortMul: 1.9, exciteMul: 0.4, happyMul: 0.9,
    sleepyAdd: 0.6, furBurst: 0.3, holdPower: 0.45,
    tone: { baseFreq: 130, freqRange: 240, q: 2.0, gain: 0.22, type: "lowpass", tremolo: true },
    zoneBoost: { head: 1.2, body: 1.3, legs: 1.0, tail: 0.6, hip: 1.1 },
    zoneText: {
      head: "우웅— 머리 마사지… 스르르 눈이 감겨요",
      body: "온몸이 노곤노곤… 녹아내려요 🫠",
      legs: "다리 근육이 풀려요~",
      tail: "꼬리는 간지러운가 봐요",
      hip: "엉덩이 마사지… 세상 편안",
    },
  },
];

class ToolManager {
  constructor(dog, audio) {
    this.dog = dog;
    this.audio = audio;
    this.tools = TOOLS;
    this.index = 0;
    this.current = this.tools[0];
    this._apply();
  }

  select(idOrIndex) {
    const i = (typeof idOrIndex === "number")
      ? idOrIndex
      : this.tools.findIndex((t) => t.id === idOrIndex);
    if (i < 0 || i >= this.tools.length) return;
    this.index = i;
    this.current = this.tools[i];
    this._apply();
  }

  _apply() {
    if (this.dog && this.dog.setTool) this.dog.setTool(this.current);
    if (this.audio && this.audio.setScratchTone) this.audio.setScratchTone(this.current.tone);
    // 이모지를 커서로 (도구 끝이 hotspot)
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">` +
      `<text x="4" y="38" font-size="38">${this.current.emoji}</text></svg>`;
    const url = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
    const c3d = document.getElementById("game3d");
    if (c3d) c3d.style.cursor = `url('${url}') 6 42, grab`;
  }

  /* 하단 도구바 UI */
  buildBar() {
    let bar = document.getElementById("toolbar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "toolbar";
      document.body.appendChild(bar);
    }
    bar.innerHTML = "";
    this.tools.forEach((t, i) => {
      const btn = document.createElement("button");
      btn.className = "tool-btn" + (i === this.index ? " active" : "");
      btn.title = t.name;
      btn.innerHTML = `<span class="tool-emoji">${t.emoji}</span><span class="tool-name">${t.name}</span>`;
      btn.addEventListener("click", () => {
        this.select(i);
        [...bar.querySelectorAll(".tool-btn")].forEach((b, j) =>
          b.classList.toggle("active", j === this.index));
      });
      bar.appendChild(btn);
    });
    return bar;
  }
}

window.TOOLS = TOOLS;
window.ToolManager = ToolManager;
