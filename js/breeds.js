/* ============================================================
   breeds.js — 강아지 품종 도감  ★커스터마이징의 핵심
   ------------------------------------------------------------
   실제 품종의 생김새·특징·성격을 조사해 파라미터로 옮겼습니다.

   체형(body)  : len 몸길이 · girth 몸통 굵기 · legLen 다리 길이 · tuck 허리 조임
   머리(head)  : size 머리 크기 · muzzleLen 주둥이 길이 · muzzleW 주둥이 굵기
   귀(ears)    : erect 쫑긋 / floppyLong 늘어진 긴 귀 / floppyShort 짧게 접힌 귀 / dropFluffy 푸들 귀
   꼬리(tail)  : curl 말림 / sickle 낫모양 / straight 곧음 / stub 짤막 / pompom 방울
   무늬(marks) : urajiro 흰 배·가슴·볼 / saddle 등 안장 / mask 흰 얼굴 / blaze 이마 줄
                 brows 눈썹 점 / whiteTailTip 꼬리 끝 흰색 / whitePaws 흰 양말
   성격(mind)  : energy 흥분 잘함 · affection 애정 표현 · calm 편안해짐 ·
                 lazy 잘 잠듦 · barky 잘 짖음 · ticklish 간지럼 · flop 발라당 · wag 꼬리 힘
   ============================================================ */
console.log("[강아지벅벅3D] breeds.js 로드");

const BREEDS = [
  {
    id: "maltese", name: "말티즈", nameEn: "Maltese", emoji: "☁️",
    desc: "눈부신 순백 실크 털의 응석꾸러기. 품에 안기는 걸 세상에서 제일 좋아하는 컴패니언 독.",
    traits: ["#애교만렙", "#순둥이", "#무릎냥아니고무릎멍"],
    size: 0.85,
    colors: { main: "#f7f2e8", secondary: "#eae2d2", cream: "#fffdf6", nose: "#3a3a3a" },
    eyeColor: "#2f2620",
    body: { len: 1.7, girth: 0.4, legLen: 0.42, tuck: 0.95 },
    head: { size: 0.36, muzzleLen: 0.15, muzzleW: 0.95 },
    ears: { type: "floppyShort", size: 0.9 },
    tail: { type: "curl", size: 0.85 },
    fluff: { ruff: 0.7, cheeks: 0.9, topknot: false },
    marks: {},
    mind: { energy: 0.9, affection: 1.3, calm: 1.2, lazy: 1.1, barky: 1.1, ticklish: 1.1, flop: 1.2, wag: 1.0 },
  },
  {
    id: "pomeranian", name: "포메라니안", nameEn: "Pomeranian", emoji: "🦊",
    desc: "솜뭉치 같은 풍성한 이중모의 작은 여우. 몸집은 작아도 씩씩하고 자기주장이 강해요.",
    traits: ["#솜뭉치", "#여우상", "#작은고추가맵다"],
    size: 0.82,
    colors: { main: "#f3ddb4", secondary: "#e3c089", cream: "#fff7e8", nose: "#4a392c" },
    eyeColor: "#32281e",
    body: { len: 1.6, girth: 0.43, legLen: 0.38, tuck: 0.97 },
    head: { size: 0.34, muzzleLen: 0.17, muzzleW: 0.72 },
    ears: { type: "erect", size: 0.55 },
    tail: { type: "curl", size: 1.25 },
    fluff: { ruff: 1.2, cheeks: 1.0, topknot: false },
    marks: {},
    mind: { energy: 1.3, affection: 1.1, calm: 0.8, lazy: 0.8, barky: 1.4, ticklish: 1.2, flop: 0.9, wag: 1.2 },
  },
  {
    id: "shiba", name: "시바견", nameEn: "Shiba Inu", emoji: "🐕",
    desc: "쫑긋 귀에 동글 말린 꼬리, 우라지로(흰 배·볼)가 매력인 일본 국민견. 독립적이고 고집이 있어요.",
    traits: ["#독립적", "#도도", "#시바상"],
    size: 1.0,
    colors: { main: "#e09c54", secondary: "#cd8842", cream: "#fdf3e2", nose: "#3d2f24" },
    eyeColor: "#2e2218",
    body: { len: 2.0, girth: 0.4, legLen: 0.6, tuck: 0.86 },
    head: { size: 0.36, muzzleLen: 0.26, muzzleW: 0.8 },
    ears: { type: "erect", size: 0.85 },
    tail: { type: "curl", size: 1.0 },
    fluff: { ruff: 0.3, cheeks: 0.75, topknot: false },
    marks: { urajiro: true },
    mind: { energy: 0.9, affection: 0.8, calm: 0.9, lazy: 0.9, barky: 0.7, ticklish: 0.7, flop: 0.6, wag: 0.8 },
  },
  {
    id: "corgi", name: "웰시코기", nameEn: "Welsh Corgi", emoji: "🍞",
    desc: "여우 얼굴에 큰 쫑긋 귀, 숏다리 + 식빵 엉덩이! 꼬리가 짧아 엉덩이 전체로 반가움을 표현해요.",
    traits: ["#숏다리", "#식빵엉덩이", "#명랑"],
    size: 0.95,
    colors: { main: "#e69750", secondary: "#d5803a", cream: "#fffaf0", nose: "#43332a" },
    eyeColor: "#30251b",
    body: { len: 2.4, girth: 0.41, legLen: 0.28, tuck: 0.92 },
    head: { size: 0.35, muzzleLen: 0.24, muzzleW: 0.78 },
    ears: { type: "erect", size: 1.25 },
    tail: { type: "stub", size: 1.0 },
    fluff: { ruff: 0.35, cheeks: 0.6, topknot: false },
    marks: { urajiro: true, blaze: true, whitePaws: true },
    mind: { energy: 1.3, affection: 1.2, calm: 0.9, lazy: 0.85, barky: 1.0, ticklish: 1.3, flop: 1.1, wag: 1.3 },
  },
  {
    id: "dachshund", name: "닥스훈트", nameEn: "Dachshund", emoji: "🌭",
    desc: "원통처럼 긴 허리와 짧은 다리, 긴 주둥이의 블랙&탄 소시지. 몸은 작아도 용감한 사냥견 출신!",
    traits: ["#소시지", "#용감", "#호기심"],
    size: 0.92,
    colors: { main: "#453a33", secondary: "#332b26", cream: "#c98e54", nose: "#26201c" },
    eyeColor: "#241c15",
    body: { len: 2.6, girth: 0.34, legLen: 0.24, tuck: 0.95 },
    head: { size: 0.32, muzzleLen: 0.32, muzzleW: 0.72 },
    ears: { type: "floppyLong", size: 1.1 },
    tail: { type: "straight", size: 0.85 },
    fluff: { ruff: 0, cheeks: 0.3, topknot: false },
    marks: { urajiro: true, brows: true },
    mind: { energy: 1.0, affection: 1.0, calm: 1.0, lazy: 0.9, barky: 1.2, ticklish: 1.2, flop: 0.9, wag: 1.0 },
  },
  {
    id: "beagle", name: "비글", nameEn: "Beagle", emoji: "🐾",
    desc: "갈색·검정·흰색 삼색 코트, 둥글게 늘어진 큰 귀, 흰 꼬리 끝. 호기심 폭발 명랑 에너자이저!",
    traits: ["#3대악마견?", "#호기심왕", "#먹보"],
    size: 1.0,
    colors: { main: "#d8a368", secondary: "#4b4039", cream: "#fdf8ee", nose: "#332a24" },
    eyeColor: "#2c2118",
    body: { len: 2.1, girth: 0.42, legLen: 0.55, tuck: 0.9 },
    head: { size: 0.36, muzzleLen: 0.27, muzzleW: 0.92 },
    ears: { type: "floppyLong", size: 1.3 },
    tail: { type: "straight", size: 1.05 },
    fluff: { ruff: 0, cheeks: 0.5, topknot: false },
    marks: { urajiro: true, saddle: true, whitePaws: true, whiteTailTip: true },
    mind: { energy: 1.4, affection: 1.1, calm: 0.8, lazy: 0.8, barky: 1.3, ticklish: 1.4, flop: 1.0, wag: 1.2 },
  },
  {
    id: "poodle", name: "푸들", nameEn: "Poodle", emoji: "🎀",
    desc: "곱슬 파마 털과 긴 다리의 우아한 천재 (강아지 지능 2위). 머리 위 퐁퐁 토크노트가 포인트!",
    traits: ["#천재견", "#곱슬파마", "#우아"],
    size: 0.95,
    colors: { main: "#dba26e", secondary: "#cb9058", cream: "#f2dcbd", nose: "#4a3528" },
    eyeColor: "#2f241a",
    body: { len: 1.9, girth: 0.36, legLen: 0.72, tuck: 0.88 },
    head: { size: 0.33, muzzleLen: 0.24, muzzleW: 0.68 },
    ears: { type: "dropFluffy", size: 1.0 },
    tail: { type: "pompom", size: 1.0 },
    fluff: { ruff: 0.4, cheeks: 0.2, topknot: true },
    marks: {},
    mind: { energy: 1.0, affection: 1.1, calm: 1.1, lazy: 0.9, barky: 0.9, ticklish: 1.0, flop: 1.0, wag: 1.0 },
  },
  {
    id: "husky", name: "시베리안 허스키", nameEn: "Siberian Husky", emoji: "🐺",
    desc: "흰 얼굴 마스크에 파란 눈, 풍성한 낫모양 꼬리의 늑대상. 시크해 보여도 알고 보면 장난꾸러기.",
    traits: ["#늑대상", "#파란눈", "#하울링"],
    size: 1.15,
    colors: { main: "#9aa3ad", secondary: "#6e7780", cream: "#f5f7f8", nose: "#2c2a28" },
    eyeColor: "#8fd0f0",
    body: { len: 2.3, girth: 0.44, legLen: 0.7, tuck: 0.86 },
    head: { size: 0.38, muzzleLen: 0.3, muzzleW: 0.82 },
    ears: { type: "erect", size: 0.95 },
    tail: { type: "sickle", size: 1.1 },
    fluff: { ruff: 0.6, cheeks: 0.65, topknot: false },
    marks: { urajiro: true, mask: true },
    mind: { energy: 1.3, affection: 0.9, calm: 0.7, lazy: 0.7, barky: 1.2, ticklish: 0.6, flop: 0.8, wag: 0.9 },
  },
  {
    id: "golden", name: "골든 리트리버", nameEn: "Golden Retriever", emoji: "🌟",
    desc: "황금빛 털과 깃털 같은 꼬리의 대형 천사견 (지능 4위). 누구에게나 다정하고 발라당을 제일 잘해요.",
    traits: ["#천사견", "#대형견", "#무한애정"],
    size: 1.2,
    colors: { main: "#e3b873", secondary: "#d2a058", cream: "#f5e4bf", nose: "#3c2f26" },
    eyeColor: "#33271c",
    body: { len: 2.3, girth: 0.46, legLen: 0.68, tuck: 0.9 },
    head: { size: 0.39, muzzleLen: 0.3, muzzleW: 0.95 },
    ears: { type: "floppyShort", size: 1.15 },
    tail: { type: "straight", size: 1.25 },
    fluff: { ruff: 0.55, cheeks: 0.45, topknot: false },
    marks: {},
    mind: { energy: 1.0, affection: 1.4, calm: 1.3, lazy: 1.0, barky: 0.8, ticklish: 1.0, flop: 1.4, wag: 1.1 },
  },
];

function getBreed(id) {
  return BREEDS.find((b) => b.id === id) || BREEDS[0];
}

window.BREEDS = BREEDS;
window.getBreed = getBreed;
