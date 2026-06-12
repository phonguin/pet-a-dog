/* ============================================================
   dog3d.js — 로프트(단면 스킨) 방식 절차적 3D 강아지  ★핵심
   ------------------------------------------------------------
   ※ 구(공)를 이어붙이는 방식을 완전히 버렸습니다.
   실제 캐릭터 모델링처럼 "척추 곡선을 따라 타원 단면을
   이어붙인 연속 곡면(loft)"으로 몸·머리·다리·꼬리·귀를 만듭니다.

   - 몸통: 엉덩이→허리(턱업)→흉곽(깊은 가슴)→어깨가 한 곡면
   - 머리: 두개골→스탑(이마 꺾임)→주둥이→코끝의 개 옆모습
   - 다리: 어깨/허벅지→무릎→발목→발끝, 뒷다리는 관절 각도(angulation)
   - 무늬: 우라지로·안장·마스크·양말을 버텍스 컬러로 표면에 페인팅
   - 모든 치수는 breeds.js의 품종 파라미터에서 나옴

   부위(zone) 5곳: head · body · legs · tail · hip
   ============================================================ */
console.log("[강아지벅벅3D] dog3d.js 로드 (loft)");

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const sstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/* 부위별 기본 감정 반응 계수 */
const ZONE_FX = {
  head: { excite: 0.5, comfort: 1.3, happy: 1.1, label: "머리" },
  body: { excite: 0.8, comfort: 1.1, happy: 1.0, label: "몸" },
  legs: { excite: 1.3, comfort: 0.5, happy: 0.9, label: "다리" },
  tail: { excite: 1.5, comfort: 0.4, happy: 1.1, label: "꼬리" },
  hip:  { excite: 1.1, comfort: 0.6, happy: 0.9, label: "엉덩이" },
  _def: { excite: 0.6, comfort: 0.8, happy: 0.8, label: "" },
};

/* ============================================================
   makeLoft — 단면(타원) 리스트를 따라 연속 곡면 생성
   secs: [{ c:Vector3 단면 중심, w 가로반경, h 세로반경, mod?(angle)->{w,h} }]
   radial: 단면당 정점 수, opts: { right:Vector3, colorFn(point)->Color }
   양 끝은 중심점 팬으로 둥글게 캡. 법선이 안쪽이면 자동으로 뒤집음.
   ============================================================ */
function makeLoft(secs, radial, opts) {
  opts = opts || {};
  const right = (opts.right || new THREE.Vector3(0, 0, 1)).clone().normalize();
  const N = secs.length;
  const pos = [], col = [], idx = [];
  const colorFn = opts.colorFn || null;
  const tmp = new THREE.Vector3(), up = new THREE.Vector3(), tan = new THREE.Vector3();

  for (let i = 0; i < N; i++) {
    const s = secs[i];
    const p0 = secs[Math.max(0, i - 1)].c, p1 = secs[Math.min(N - 1, i + 1)].c;
    tan.subVectors(p1, p0).normalize();
    up.crossVectors(right, tan).normalize();
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      let w = s.w, h = s.h;
      if (s.mod) { const m = s.mod(a); if (m.w != null) w *= m.w; if (m.h != null) h *= m.h; }
      tmp.copy(s.c)
        .addScaledVector(right, Math.cos(a) * w)
        .addScaledVector(up, Math.sin(a) * h);
      pos.push(tmp.x, tmp.y, tmp.z);
      if (colorFn) { const c = colorFn(tmp); col.push(c.r, c.g, c.b); }
    }
  }
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + (j + 1) % radial;
      const c2 = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial;
      idx.push(a, c2, b, b, c2, d);
    }
  }
  // 양 끝 캡 (중심점 팬)
  const c0 = pos.length / 3;
  pos.push(secs[0].c.x, secs[0].c.y, secs[0].c.z);
  if (colorFn) { const c = colorFn(secs[0].c); col.push(c.r, c.g, c.b); }
  for (let j = 0; j < radial; j++) idx.push(c0, j, (j + 1) % radial);
  const c1 = pos.length / 3;
  const sl = secs[N - 1];
  pos.push(sl.c.x, sl.c.y, sl.c.z);
  if (colorFn) { const c = colorFn(sl.c); col.push(c.r, c.g, c.b); }
  const base = (N - 1) * radial;
  for (let j = 0; j < radial; j++) idx.push(c1, base + (j + 1) % radial, base + j);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  if (colorFn) geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  // 법선 방향 검사 — 안쪽을 향하면 인덱스 뒤집고 재계산
  const midRing = Math.floor(N / 2) * radial;
  const v0 = new THREE.Vector3().fromBufferAttribute(geo.attributes.position, midRing);
  const n0 = new THREE.Vector3().fromBufferAttribute(geo.attributes.normal, midRing);
  const cm = secs[Math.floor(N / 2)].c;
  if (n0.dot(v0.clone().sub(cm)) < 0) {
    const ia = geo.index.array;
    for (let i = 0; i < ia.length; i += 3) { const t2 = ia[i + 1]; ia[i + 1] = ia[i + 2]; ia[i + 2] = t2; }
    geo.computeVertexNormals();
  }
  return geo;
}

class Dog3D {
  constructor(breed) {
    this.camera = null;
    this.audio = null;
    this.project = null;
    this.w = window.innerWidth;
    this.h = window.innerHeight;

    this.happiness = 0.3; this.comfort = 0.2;
    this.excitement = 0.0; this.sleepiness = 0.35;
    this.t = 0; this.idleTime = 0;
    this.scratching = false; this.curZone = null;

    this.fx = { head: 0, body: 0, legs: 0, tail: 0, hip: 0 };
    this.flop = 0;
    this._sinceBody = 99;
    this._jig = 0; this._jigV = 0;
    this._kickPrev = 0;
    this._blinkT = rand(1, 4); this._blink = 0;
    this._earFlickT = rand(2, 5); this._earFlick = 0;
    this._sneezeT = 0; this._sneeze = 0;
    this._excitePrev = 0;
    this._tongue = 0; this._eyeOpen = 1;

    this.particles = [];
    this.heartTimer = 0; this.sparkleTimer = 0; this.zzzTimer = 0;
    this._emojiTimer = 0;

    // 이동 (우클릭 명령)
    this.moveTarget = null;     // {x, z}
    this._yaw = -0.55;          // 현재 바라보는 방향 (기본: 3/4 시점)
    this._restYaw = -0.55;
    this._walk = 0;             // 걷기 게이지 (보행 애니메이션 블렌딩)
    this._walkPhase = 0;        // 다리 교차 위상
    this._pawStepT = 0;

    this.tool = window.TOOLS ? window.TOOLS[0] : { id: "hand", power: 1, comfortMul: 1, exciteMul: 1, happyMul: 1, sleepyAdd: 0, furBurst: 1, holdPower: 0, zoneBoost: {}, zoneText: {} };

    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._tmpV = new THREE.Vector3();

    this.root = new THREE.Group();
    this.rollG = new THREE.Group();   // 발라당 피벗
    this.root.add(this.rollG);
    this.dogG = new THREE.Group();
    this.rollG.add(this.dogG);
    this.root.rotation.y = -0.55;

    this.applyBreed(breed || (window.BREEDS ? window.BREEDS[0] : null));
  }

  /* ============================================================
     품종 적용 — 로프트 곡면들을 새로 생성
     ============================================================ */
  applyBreed(def) {
    if (!def) return;
    this.breed = def;
    this.mind = def.mind || {};

    while (this.dogG.children.length) {
      const c = this.dogG.children[0];
      c.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material.dispose) o.material.dispose();
      });
      this.dogG.remove(c);
    }
    this.zoneMeshes = [];
    this.legs = [];
    this.earGroups = [];

    const C = def.colors;
    const B = def.body, H = def.head, M = def.marks || {};
    const L = B.len, G = B.girth, LEG = B.legLen;
    const HR = H.size, ML = H.muzzleLen, MW = H.muzzleW;
    const tcY = LEG + G * 0.78;
    const ruff = def.fluff.ruff || 0;
    const cheeks = def.fluff.cheeks || 0;
    const urj = !!M.urajiro;

    // sRGB 출력 인코딩과 짝을 맞추기 위해 리니어로 변환해 넣음
    // (안 하면 이중 감마로 색이 하얗게 날아감 — 허스키 회색이 흰색으로 보였던 원인)
    const cMain = new THREE.Color(C.main).convertSRGBToLinear();
    const cSec = new THREE.Color(C.secondary).convertSRGBToLinear();
    const cCream = new THREE.Color(C.cream).convertSRGBToLinear();

    const vcMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    const flatMat = (color) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 });
      m.color.convertSRGBToLinear();
      return m;
    };
    const V = (x, y, z) => new THREE.Vector3(x, y, z || 0);
    const SPH = new THREE.SphereGeometry(1, 18, 14);
    const addTo = (mesh, zone, parent) => {
      mesh.castShadow = true;
      if (zone) { mesh.userData.zone = zone; this.zoneMeshes.push(mesh); }
      parent.add(mesh);
      return mesh;
    };

    /* ---------- 몸통: 한 장의 연속 곡면 ----------
       단면 스펙: [x(L/2 단위), 등높이 top(G), 배높이 bot(G), 폭 w(G)]
       토르소 로컬 좌표 (중심: tcY) — 등선과 배선이 진짜 개 옆모습을 만듦 */
    const tuckBot = -0.85 * B.tuck;        // 허리 턱업 (작을수록 잘록)
    const rf = 1 + ruff * 0.32;            // 목 주변 풍성한 털 → 앞쪽 단면 확대
    const torsoSpec = [
      [-1.04, 0.16, -0.06, 0.10],
      [-0.97, 0.38, -0.42, 0.46],
      [-0.78, 0.55, -0.74, 0.68],          // 엉덩이(rump)
      [-0.52, 0.55, -0.80, 0.72],
      [-0.18, 0.50, tuckBot, 0.62],        // 허리 턱업
      [0.14, 0.56, -0.86, 0.72],           // 흉곽 최대 (깊은 가슴)
      [0.52, 0.55 * rf, -0.84, 0.66 * rf],
      [0.80, 0.46 * rf, -0.60, 0.52 * rf], // 어깨
      [0.97, 0.36 * rf, -0.18, 0.34 * rf],
      [1.06, 0.30, 0.02, 0.16],            // 앞가슴 둥근 끝 (목에 묻힘)
    ];
    const torsoSecs = torsoSpec.map(([x, top, bot, w]) => ({
      c: V(x * L / 2, (top + bot) / 2 * G),
      h: (top - bot) / 2 * G,
      w: w * G,
    }));
    // 몸통 무늬 페인팅 (토르소 로컬 좌표 기준)
    const torsoColor = (p) => {
      const c = cMain.clone();
      if (M.saddle) { // 비글 등 안장
        const f = sstep(-0.5 * L / 2, -0.3 * L / 2, p.x) * (1 - sstep(0.25 * L / 2, 0.45 * L / 2, p.x))
          * sstep(-G * 0.15, G * 0.15, p.y);
        c.lerp(cSec, f);
      }
      if (urj) { // 흰 배 + 흰 앞가슴
        const belly = sstep(-G * 0.3, -G * 0.62, p.y);
        const chest = sstep(0.55 * L / 2, 0.85 * L / 2, p.x) * sstep(G * 0.35, -G * 0.1, p.y);
        c.lerp(cCream, Math.max(belly, chest));
      }
      return c;
    };
    this.torsoG = new THREE.Group();
    this.torsoG.position.set(0, tcY, 0);
    this.dogG.add(this.torsoG);
    this.torsoMesh = new THREE.Mesh(
      makeLoft(torsoSecs, 18, { colorFn: torsoColor }), vcMat());
    this.torsoMesh.userData.zone = "_torso";
    this.torsoMesh.castShadow = true;
    this.zoneMeshes.push(this.torsoMesh);
    this.torsoG.add(this.torsoMesh);
    this._hipSplitX = -L * 0.18;

    /* ---------- 목: 가슴에서 머리로 비스듬한 곡면 ---------- */
    const neckBase = V(L / 2 * 0.74, tcY + G * 0.08);
    const neckDir = V(0.58, 0.81).normalize();
    const NL = G * 1.05 + HR * 0.35;
    const neckSecs = [];
    for (let i = 0; i <= 3; i++) {
      const t = i / 3;
      neckSecs.push({
        c: neckBase.clone().addScaledVector(neckDir, NL * t),
        w: lerp(G * 0.52 * rf, G * 0.34, t),
        h: lerp(G * 0.58 * rf, G * 0.36, t),
      });
    }
    const neckColor = (p) => {
      const c = cMain.clone();
      if (urj || ruff > 0.5) c.lerp(cCream, sstep(tcY + G * 0.25, tcY - G * 0.3, p.y) * (urj ? 1 : 0.55));
      return c;
    };
    const neck = new THREE.Mesh(makeLoft(neckSecs, 14, { colorFn: neckColor }), vcMat());
    addTo(neck, "body", this.dogG);

    /* ---------- 머리: 두개골 → 스탑 → 주둥이 → 코끝 ----------
       headG 로컬 (피벗 = 목 위). 스탑(이마 꺾임)이 핵심. */
    const headPos = neckBase.clone().addScaledVector(neckDir, NL).add(V(HR * 0.12, HR * 0.18));
    this.headG = new THREE.Group();
    this.headG.position.copy(headPos);
    this.dogG.add(this.headG);
    this._baseHead = headPos.clone();

    const mzX = HR * 0.5;                 // 주둥이 시작(스탑) 위치
    const cheekMod = (a) => ({ w: 1 + Math.max(0, -Math.sin(a)) * cheeks * 0.3 });
    const headSpec = [ // [x, cy, w, h, mod?]
      [-HR * 0.92, -HR * 0.05, HR * 0.30, HR * 0.34],
      [-HR * 0.55, 0, HR * 0.68, HR * 0.70, cheekMod],
      [-HR * 0.05, HR * 0.03, HR * 0.78, HR * 0.78, cheekMod],   // 두개골 최대
      [mzX * 0.7, -HR * 0.02, HR * 0.66, HR * 0.66, cheekMod],   // 눈 부근
      [mzX, -HR * 0.24, HR * 0.40 * MW, HR * 0.34 * MW],         // ★스탑: 급격히 좁아짐
      [mzX + ML * 0.55, -HR * 0.27, HR * 0.36 * MW, HR * 0.29 * MW],
      [mzX + ML, -HR * 0.26, HR * 0.30 * MW, HR * 0.25 * MW],    // 코 부근
      [mzX + ML + HR * 0.08, -HR * 0.24, HR * 0.10, HR * 0.10],  // 둥근 끝
    ];
    const headSecs = headSpec.map(([x, cy, w, h, mod]) => ({ c: V(x, cy), w, h, mod }));
    const headColor = (p) => {
      const c = cMain.clone();
      if (M.mask) { // 허스키: 얼굴 아래·앞 흰색, 정수리는 본색
        const f = Math.max(
          sstep(HR * 0.1, -HR * 0.25, p.y),                       // 턱·볼
          sstep(mzX * 0.3, mzX * 0.8, p.x) * sstep(HR * 0.45, HR * 0.1, p.y) // 얼굴 앞
        );
        c.lerp(cCream, f);
      }
      if (M.blaze) { // 코기: 이마 흰 줄
        c.lerp(cCream, sstep(HR * 0.3, HR * 0.12, Math.abs(p.z)) * sstep(-HR * 0.3, HR * 0.1, p.x));
      }
      if (urj || M.brows) { // 주둥이·턱 밝게
        const mz = sstep(mzX - HR * 0.12, mzX + HR * 0.1, p.x);
        const jaw = sstep(-HR * 0.3, -HR * 0.55, p.y);
        c.lerp(cCream, Math.max(mz, jaw * (urj ? 0.9 : 0.6)));
      }
      return c;
    };
    const headMesh = new THREE.Mesh(makeLoft(headSecs, 16, { colorFn: headColor }), vcMat());
    this.headMesh = addTo(headMesh, "head", this.headG);

    // 푸들 토크노트 (머리 위 퐁퐁 — 푸들 상징이라 유지)
    if (def.fluff.topknot) {
      const tk = new THREE.Mesh(SPH, flatMat(C.main));
      tk.position.set(-HR * 0.15, HR * 0.78, 0);
      tk.scale.set(HR * 0.52, HR * 0.46, HR * 0.52);
      addTo(tk, "head", this.headG);
    }

    // 코 (둥근 코는 실제로 둥글어요)
    const nose = new THREE.Mesh(SPH, flatMat(C.nose));
    nose.material.roughness = 0.4;
    nose.position.set(mzX + ML + HR * 0.1, -HR * 0.16, 0);
    nose.scale.set(HR * 0.13, HR * 0.11, HR * 0.13);
    addTo(nose, "head", this.headG);

    // ----- 머리 곡면 위의 점 계산 (눈·볼터치·눈썹을 표면에 정확히 올리기 위함) -----
    const headSectionAt = (x) => {
      for (let i = 0; i < headSpec.length - 1; i++) {
        const a = headSpec[i], b = headSpec[i + 1];
        if (x >= a[0] && x <= b[0]) {
          const t = (x - a[0]) / ((b[0] - a[0]) || 1);
          return { cy: lerp(a[1], b[1], t), w: lerp(a[2], b[2], t), h: lerp(a[3], b[3], t) };
        }
      }
      const s = headSpec[headSpec.length - 1];
      return { cy: s[1], w: s[2], h: s[3] };
    };
    // ang: 0=옆구리, +위/-아래 · push: 1.0=표면
    const onHead = (x, ang, push, side) => {
      const s = headSectionAt(x);
      return V(x, s.cy + Math.sin(ang) * s.h * push, Math.cos(ang) * s.w * push * side);
    };

    // 눈 + 하이라이트 — 두개골이 주둥이로 좁아지는 앞면 표면 위에
    this._eyeS = HR * 0.17;
    const eyeMat = flatMat(def.eyeColor || "#33271e");
    eyeMat.roughness = 0.3;
    const eyeX = mzX * 0.82;
    const mkEye = (side) => {
      const e = new THREE.Mesh(SPH, eyeMat);
      e.position.copy(onHead(eyeX, 0.3, 0.95, side));
      e.scale.setScalar(this._eyeS);
      return addTo(e, "head", this.headG);
    };
    this.eyeL = mkEye(1); this.eyeR = mkEye(-1);
    const hlMat = flatMat("#ffffff");
    const mkHl = (side) => {
      const m = new THREE.Mesh(SPH, hlMat);
      m.position.copy(onHead(eyeX, 0.42, 1.04, side)).add(V(HR * 0.08, 0, HR * 0.02 * side));
      m.scale.setScalar(HR * 0.05);
      m.castShadow = false;
      this.headG.add(m);
      return m;
    };
    this.hlL = mkHl(1); this.hlR = mkHl(-1);

    // 눈썹 점 (닥스훈트 블랙&탄) — 눈 위 표면
    if (M.brows) {
      [1, -1].forEach((s) => {
        const b = new THREE.Mesh(SPH, flatMat(C.cream));
        b.position.copy(onHead(eyeX - HR * 0.06, 0.75, 0.98, s));
        b.scale.set(HR * 0.1, HR * 0.07, HR * 0.07);
        this.headG.add(b);
      });
    }

    // 볼터치 — 뺨 표면
    this.cheekMat = new THREE.MeshStandardMaterial({ color: "#ff9d9d", roughness: 1, transparent: true, opacity: 0 });
    [1, -1].forEach((s) => {
      const ck = new THREE.Mesh(SPH, this.cheekMat);
      ck.position.copy(onHead(eyeX - HR * 0.05, -0.42, 0.99, s));
      ck.scale.set(HR * 0.15, HR * 0.09, HR * 0.06);
      ck.castShadow = false;
      this.headG.add(ck);
    });

    // 입(벌어짐) + 혀
    this.mouthMesh = new THREE.Mesh(SPH, flatMat("#6e4438"));
    this.mouthMesh.position.set(mzX + ML * 0.75, -HR * 0.45, 0);
    this.mouthMesh.scale.setScalar(0.01);
    this.mouthMesh.castShadow = false;
    this.headG.add(this.mouthMesh);
    this._mouthS = HR;

    this.tongueG = new THREE.Group();
    this.tongueG.position.set(mzX + ML * 0.72, -HR * 0.5, HR * 0.03);
    this.headG.add(this.tongueG);
    const tongue = new THREE.Mesh(SPH, flatMat("#ff8fa3"));
    tongue.scale.set(HR * 0.13, HR * 0.24, HR * 0.09);
    tongue.position.set(HR * 0.03, -HR * 0.18, 0);
    this.tongueG.add(tongue);
    this.tongueG.scale.setScalar(0.01);

    /* ---------- 귀: 납작한 로프트 (삼각 쫑긋 / 늘어진 플랩) ---------- */
    const E = def.ears;
    const earMat = () => flatMat(E.type === "dropFluffy" ? C.main : C.secondary);
    const mkEar = (side) => {
      const g = new THREE.Group();
      g.position.set(-HR * 0.22, HR * 0.6, HR * 0.46 * side);
      this.headG.add(g);
      let secs, right;
      if (E.type === "erect") {
        // 위로 선 삼각형 — 폭은 넓고 두께는 얇게
        const eh = HR * 1.0 * E.size;
        secs = [
          { c: V(0, 0, 0), w: HR * 0.16, h: HR * 0.42 * E.size },
          { c: V(-HR * 0.04, eh * 0.45, HR * 0.06 * side), w: HR * 0.12, h: HR * 0.3 * E.size },
          { c: V(-HR * 0.08, eh * 0.85, HR * 0.12 * side), w: HR * 0.06, h: HR * 0.12 },
          { c: V(-HR * 0.1, eh, HR * 0.15 * side), w: HR * 0.015, h: HR * 0.015 },
        ];
        right = V(1, 0, 0);
      } else {
        // 늘어진 플랩 — 길이/두께를 타입별로
        const len = (E.type === "floppyLong" ? HR * 1.05 : E.type === "floppyShort" ? HR * 0.62 : HR * 0.72) * E.size;
        const wid = (E.type === "dropFluffy" ? HR * 0.3 : HR * 0.34);
        const thick = (E.type === "dropFluffy" ? HR * 0.2 : HR * 0.09);
        secs = [
          { c: V(0, HR * 0.05, 0), w: wid * 0.55, h: thick },
          { c: V(HR * 0.02, -len * 0.35, HR * 0.14 * side), w: wid, h: thick },
          { c: V(HR * 0.04, -len * 0.78, HR * 0.2 * side), w: wid * 0.85, h: thick * 0.9 },
          { c: V(HR * 0.05, -len, HR * 0.22 * side), w: wid * 0.3, h: thick * 0.6 },
          { c: V(HR * 0.05, -len - HR * 0.05, HR * 0.23 * side), w: HR * 0.02, h: HR * 0.02 },
        ];
        right = V(1, 0, 0);
      }
      const ear = new THREE.Mesh(makeLoft(secs, 10, { right }), earMat());
      addTo(ear, "head", g);
      g.userData = { side, baseRotZ: -0.06 };
      g.rotation.z = -0.06;
      this.earGroups.push(g);
    };
    mkEar(1); mkEar(-1);

    /* ---------- 꼬리: 곡선 경로 로프트 ---------- */
    const T = def.tail;
    this.hipG = new THREE.Group();
    this._baseHipY = tcY;
    this.hipG.position.set(-L / 2 + G * 0.3, tcY, 0);
    this.dogG.add(this.hipG);
    this.tailG = new THREE.Group();
    this.tailG.position.set(-G * 0.45, G * 0.5, 0);
    this.hipG.add(this.tailG);
    this.tailType = T.type;

    const tailPath = [];   // {c, r}
    if (T.type === "curl") {
      const R = 0.26 * T.size + G * 0.1;
      for (let i = 0; i <= 7; i++) {
        const a = -1.5 + (i / 7) * 3.1;
        tailPath.push({
          c: V(-0.02 + Math.cos(a) * R * 0.75, 0.16 + Math.sin(a) * R, G * 0.1),
          r: lerp(0.13 * T.size + G * 0.07, 0.05, i / 7),
        });
      }
    } else if (T.type === "sickle") {
      for (let i = 0; i <= 6; i++) {
        const t = i / 6, a = -0.3 + t * 1.75;
        tailPath.push({
          c: V(0.12 - Math.cos(a) * 0.55 * T.size, Math.sin(a) * 0.6 * T.size),
          r: (0.16 - t * 0.07) * T.size + G * 0.05,
        });
      }
    } else if (T.type === "straight") {
      for (let i = 0; i <= 5; i++) {
        const t = i / 5;
        const plume = 1 + Math.sin(t * Math.PI) * (T.size > 1.1 ? 0.45 : 0.1); // 골든 깃털꼬리
        tailPath.push({
          c: V(-t * 0.62 * T.size, t * 0.5 * T.size * (1 - 0.25 * t)),
          r: ((0.1 - t * 0.06) * T.size + G * 0.05) * plume,
        });
      }
    } else if (T.type === "pompom") {
      [[0, 0, 0.05], [-0.12, 0.18, 0.045], [-0.22, 0.34, 0.04], [-0.3, 0.46, 0.13 * T.size], [-0.36, 0.55, 0.1], [-0.38, 0.6, 0.02]]
        .forEach(([x, y, r]) => tailPath.push({ c: V(x, y), r }));
    } else { // stub
      tailPath.push({ c: V(0.02, -0.02), r: 0.11 }, { c: V(-0.06, 0.06), r: 0.1 }, { c: V(-0.1, 0.12), r: 0.04 });
    }
    const tailSecs = tailPath.map((p) => ({ c: p.c, w: p.r, h: p.r }));
    const tailColor = (p) => {
      const c = cMain.clone();
      const tipF = sstep(0.25, 0.55, p.y);   // 끝쪽
      if (M.whiteTailTip) c.lerp(cCream, tipF);
      else c.lerp(cSec, tipF * 0.6);
      return c;
    };
    const tail = new THREE.Mesh(makeLoft(tailSecs, 10, { colorFn: tailColor }), vcMat());
    addTo(tail, "tail", this.tailG);

    /* ---------- 다리: 관절 각도가 잡힌 로프트 ----------
       경로 (x=앞뒤, y=아래) + 단면(w=좌우폭, h=앞뒤두께)
       뒷다리는 허벅지가 크고 무릎(앞)→비절(뒤) 각도가 잡힘 */
    const sockF = (M.whitePaws || urj || M.brows) ? 1 : 0;
    const legColor = (TT) => (p) => {
      const c = cMain.clone();
      if (sockF) c.lerp(cCream, sstep(-TT * 0.62, -TT * 0.85, p.y));
      return c;
    };
    const mkLeg = (x, z, isRear) => {
      const g = new THREE.Group();
      g.position.set(x, tcY - G * 0.1, z);
      this.dogG.add(g);
      const TT = tcY - G * 0.1;          // 그룹 원점 → 바닥 길이
      let spec;                           // [x오프, y(0~1), w, h]
      if (isRear) {
        spec = [
          [0.10, -0.02, G * 0.30, G * 0.55],  // 허벅지 (앞뒤로 큼)
          [0.16, 0.30, G * 0.24, G * 0.40],   // 무릎(앞으로)
          [-0.10, 0.62, G * 0.15, G * 0.18],  // 비절(뒤로)
          [-0.04, 0.84, G * 0.13, G * 0.15],
          [0.10, 0.95, G * 0.17, G * 0.24],   // 발
          [0.22, 0.99, G * 0.12, G * 0.14],
        ];
      } else {
        spec = [
          [0.0, -0.02, G * 0.26, G * 0.36],   // 어깨쪽
          [0.03, 0.35, G * 0.20, G * 0.24],
          [-0.02, 0.65, G * 0.14, G * 0.16],
          [0.0, 0.84, G * 0.13, G * 0.15],
          [0.12, 0.95, G * 0.16, G * 0.23],   // 발
          [0.24, 0.99, G * 0.11, G * 0.13],
        ];
      }
      const secs = spec.map(([ox, ty, w, h]) => ({
        c: V(ox * G * 2.2, -ty * TT), w, h,
      }));
      const leg = new THREE.Mesh(makeLoft(secs, 10, { colorFn: legColor(TT) }), vcMat());
      addTo(leg, "legs", g);
      const pawAnchor = new THREE.Object3D();
      pawAnchor.position.set(spec[4][0] * G * 2.2, -TT, 0);
      g.add(pawAnchor);
      g.userData = { isRear, paw: pawAnchor };
      this.legs.push(g);
    };
    mkLeg(L / 2 - G * 0.62, G * 0.46, false);
    mkLeg(L / 2 - G * 0.62, -G * 0.46, false);
    mkLeg(-L / 2 + G * 0.66, G * 0.5, true);   // 뒷발 탁탁 담당
    mkLeg(-L / 2 + G * 0.66, -G * 0.5, true);

    /* ---------- 목걸이 ---------- */
    const collar = new THREE.Mesh(new THREE.TorusGeometry(G * 0.5, G * 0.085, 10, 26), flatMat("#e05a5a"));
    collar.position.copy(neckBase.clone().addScaledVector(neckDir, NL * 0.45));
    collar.quaternion.setFromUnitVectors(V(0, 0, 1), neckDir);
    collar.castShadow = true;
    this.dogG.add(collar);
    const tag = new THREE.Mesh(new THREE.SphereGeometry(G * 0.11, 10, 8), flatMat("#f5c542"));
    tag.position.copy(collar.position).add(V(G * 0.28, -G * 0.36));
    this.dogG.add(tag);

    /* ---------- 골격 베이스 ---------- */
    this._B = { L, G, LEG, HR, tcY };
    this.rollG.position.y = tcY;
    this.dogG.position.y = -tcY;
    this.root.scale.setScalar(def.size || 1);
  }

  setTool(tool) { if (tool) this.tool = tool; }
  resize(w, h) { this.w = w; this.h = h; }

  /* 우클릭 이동 명령 — 바닥 좌표(x, z)로 달려감 */
  moveTo(p) {
    this.moveTarget = { x: p.x, z: p.z };
    this.sleepiness = Math.min(this.sleepiness, 0.35); // 벌떡 일어남
    this.idleTime = 0;
  }

  /* ---------------- 부위 판정 ---------------- */
  zoneAt(px, py) {
    if (!this.camera) return null;
    this._ndc.x = (px / this.w) * 2 - 1;
    this._ndc.y = -(py / this.h) * 2 + 1;
    this._raycaster.setFromCamera(this._ndc, this.camera);
    const hits = this._raycaster.intersectObjects(this.zoneMeshes, false);
    for (const h of hits) {
      let o = h.object, vis = true;
      while (o) { if (!o.visible) { vis = false; break; } o = o.parent; }
      if (!vis) continue;
      const zone = h.object.userData.zone;
      if (zone === "_torso") {
        const local = this.torsoG.worldToLocal(h.point.clone());
        return local.x < this._hipSplitX ? "hip" : "body";
      }
      if (zone) return zone;
    }
    return null;
  }

  /* ---------------- 매 프레임 갱신 (성격 반영) ---------------- */
  update(dt, input) {
    this.t += dt;
    const tool = this.tool;
    const mind = this.mind;
    const scr = !!(input.scratching && input.zone);
    const spd = clamp(input.speed01 || 0);
    const zone = input.zone;
    const fx = ZONE_FX[zone] || ZONE_FX._def;
    const boost = scr ? (tool.zoneBoost[zone] || 1) : 1;
    this.scratching = scr;
    this.curZone = zone;

    const exT = scr ? clamp((0.22 + 0.78 * spd) * fx.excite * tool.exciteMul * (mind.energy || 1)) : 0;
    this.excitement = lerp(this.excitement, exT, 1 - Math.exp(-dt * (exT > this.excitement ? 7 : 1.6)));
    if (scr) this.comfort += fx.comfort * tool.comfortMul * (mind.calm || 1) * (0.85 - 0.4 * spd) * dt * 0.55;
    else this.comfort -= dt * 0.045;
    this.comfort = clamp(this.comfort);
    if (scr) this.happiness += fx.happy * tool.happyMul * (mind.affection || 1) * (0.5 + 0.5 * spd) * dt * 0.42;
    else this.happiness -= dt * 0.035;
    this.happiness = clamp(this.happiness, 0.12, 1);
    if (scr) this.idleTime = 0; else this.idleTime += dt;
    if (scr && tool.sleepyAdd > 0) this.sleepiness += dt * tool.sleepyAdd * 0.25 * (mind.lazy || 1);
    else if (scr && spd > 0.2) this.sleepiness -= dt * (0.8 + spd);
    else if (this.idleTime > 2.5) this.sleepiness += dt * 0.085 * (0.4 + this.comfort) * (mind.lazy || 1);
    else this.sleepiness -= dt * 0.08;
    this.sleepiness = clamp(this.sleepiness);

    for (const k in this.fx) {
      let target = (scr && zone === k) ? clamp(0.45 + spd * 0.55) * Math.min(1.6, boost * tool.power) : 0;
      if (k === "legs") target *= (mind.ticklish || 1);
      const up = target > this.fx[k];
      this.fx[k] = lerp(this.fx[k], clamp(target, 0, 1.4), 1 - Math.exp(-dt * (up ? 9 : 3)));
    }

    if (scr && (zone === "body" || zone === "hip")) {
      this._jigV += spd * dt * 38 * tool.power;
    }
    const K = 60, D = 7;
    this._jigV += (-K * this._jig - D * this._jigV) * dt;
    this._jig += this._jigV * dt;

    if (scr && zone === "body" && this.comfort > 0.35) {
      this.flop = clamp(this.flop + dt * 0.55 * (mind.flop || 1));
      this._sinceBody = 0;
    } else {
      this._sinceBody += dt;
      if (this._sinceBody > 1.6) this.flop = clamp(this.flop - dt * 0.4);
    }

    this._sneezeT -= dt;
    if (scr && zone === "head" && tool.id === "feather" && this._sneezeT <= 0 && Math.random() < dt * 0.8) {
      this._sneezeT = 2.2;
      this._sneeze = 1;
      this._spawnEmojiAt(this._headScreen(), "🤧", 26);
    }
    this._sneeze = Math.max(0, this._sneeze - dt * 2.4);

    /* ----- 이동 (우클릭): 목표를 향해 몸을 돌리고 타닥타닥 달려감 ----- */
    if (this.moveTarget) {
      this.flop = clamp(this.flop - dt * 2.2);          // 누워있었다면 벌떡
      this.sleepiness = Math.max(0, this.sleepiness - dt * 1.2);
      this.idleTime = 0;
      const dx = this.moveTarget.x - this.root.position.x;
      const dz = this.moveTarget.z - this.root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.14) {
        this.moveTarget = null;                          // 도착!
        this.happiness = clamp(this.happiness + 0.06, 0.12, 1);
      } else {
        // 진행 방향으로 회전 (모델 정면 = 로컬 +x)
        const desired = Math.atan2(-dz, dx);
        let diff = desired - this._yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = clamp(diff, -6 * dt, 6 * dt);
        this._yaw += turn;
        if (Math.abs(diff) < 0.7) {                      // 대충 방향 맞으면 전진
          const spd = 2.2 * (this.breed.size || 1) * (0.75 + this.excitement * 0.4);
          const step = Math.min(dist, spd * dt);
          this.root.position.x += (dx / dist) * step;
          this.root.position.z += (dz / dist) * step;
          this._walkPhase += dt * 11;
          // 달리는 동안 발도장 콩콩
          this._pawStepT -= dt;
          if (this._pawStepT <= 0 && this.project) {
            this._pawStepT = 0.3;
            const v = this._tmpV.set(this.root.position.x, 0.1, this.root.position.z);
            const sp = this.project(v);
            this._spawnEmojiAt({ x: sp.x, y: sp.y + 10 }, "🐾", 16);
          }
        }
      }
    } else {
      // 도착 후엔 천천히 카메라 쪽(기본 시점)으로 돌아봄
      let diff = this._restYaw - this._yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this._yaw += clamp(diff, -2.5 * dt, 2.5 * dt);
    }
    // yaw가 여러 바퀴 누적되지 않게 정규화
    while (this._yaw > Math.PI) this._yaw -= Math.PI * 2;
    while (this._yaw < -Math.PI) this._yaw += Math.PI * 2;
    this._walk = lerp(this._walk, this.moveTarget ? 1 : 0, 1 - Math.exp(-dt * 7));

    const barkAt = 0.86 - (mind.barky || 1) * 0.12;
    if (this.audio && this.excitement > barkAt && this._excitePrev <= barkAt) {
      this.audio.playBark(this.excitement);
    }
    this._excitePrev = this.excitement;

    this._animate(dt, scr, spd, tool, zone);
    this._spawnParticles(dt, scr, spd, input, tool, zone);
    this._updateParticles(dt);
  }

  /* ---------------- 애니메이션 ---------------- */
  _animate(dt, scr, spd, tool, zone) {
    const t = this.t;
    const fx = this.fx;
    const mind = this.mind;
    const { G, HR, tcY } = this._B;
    const sleepy = this.sleepiness;
    const awake = 1 - sleepy * 0.85;

    const breath = Math.sin(t * (1.5 + this.excitement * 2.2 - sleepy * 0.5)) * (0.022 + sleepy * 0.02);
    this.torsoG.scale.set(1 + breath + this._jig * 0.5, 1 + breath * 1.8 + this._jig, 1 + breath);

    const headTilt = Math.sin(t * 1.1) * 0.04 * awake
      + fx.head * Math.sin(t * 5.5) * 0.14
      + this._sneeze * Math.sin(t * 40) * 0.12;
    const headNod = fx.head * Math.abs(Math.sin(t * 11)) * 0.06
      - sleepy * 0.34
      - this._sneeze * 0.25;
    this.headG.rotation.x = headTilt;
    this.headG.rotation.z = headNod + this._jig * 0.3;
    this.headG.rotation.y = Math.sin(t * 0.7) * 0.06 * awake + fx.tail * Math.sin(t * 8) * 0.05;
    this.headG.position.y = this._baseHead.y - sleepy * HR * 0.7 + fx.legs * Math.abs(Math.sin(t * 8)) * 0.04;
    this.headG.position.x = this._baseHead.x + sleepy * HR * 0.12;

    this._earFlickT -= dt;
    if (this._earFlickT <= 0) { this._earFlickT = rand(2.5, 6); this._earFlick = 1; }
    this._earFlick = Math.max(0, this._earFlick - dt * 5);
    for (const g of this.earGroups) {
      const side = g.userData.side;
      const perk = fx.head * 0.3 + this.excitement * 0.18;
      const flick = this._earFlick * Math.sin(t * 35) * 0.18;
      g.rotation.z = g.userData.baseRotZ + perk + (side > 0 ? flick : flick * 0.3);
      g.rotation.x = fx.head * Math.sin(t * 13 + side) * 0.1 * side;
    }

    this._blinkT -= dt;
    if (this._blinkT <= 0) { this._blinkT = rand(1.8, 4.5); this._blink = 1; }
    this._blink = Math.max(0, this._blink - dt * 7);
    const blinkClose = this._blink > 0.5 ? (1 - this._blink) * 2 : this._blink * 2;
    const cozyClose = clamp(this.comfort * 0.45 + sleepy * 0.95 + fx.head * (tool.id === "massage" ? 0.65 : 0.35));
    const eyeOpenT = clamp(1 - Math.max(blinkClose, cozyClose), 0.08, 1);
    this._eyeOpen = lerp(this._eyeOpen, eyeOpenT, 1 - Math.exp(-dt * 14));
    this.eyeL.scale.y = this._eyeS * this._eyeOpen;
    this.eyeR.scale.y = this._eyeS * this._eyeOpen;
    this.hlL.scale.y = HR * 0.045 * this._eyeOpen;
    this.hlR.scale.y = HR * 0.045 * this._eyeOpen;
    this.hlL.visible = this.hlR.visible = this._eyeOpen > 0.25;

    const tongueT = (this.excitement > 0.55 || this.happiness > 0.82) ? 1 : 0;
    this._tongue = lerp(this._tongue, tongueT, 1 - Math.exp(-dt * 6));
    const ts = Math.max(0.01, this._tongue);
    this.tongueG.scale.set(ts, ts * (1 + Math.sin(t * 9) * 0.12 * this._tongue), ts);
    this.mouthMesh.scale.set(this._mouthS * 0.18 * ts, this._mouthS * 0.13 * ts, this._mouthS * 0.16 * ts);

    this.cheekMat.opacity = clamp(this.happiness - 0.35) * 0.8;

    const wagMul = mind.wag || 1;
    const wagHz = (3 + fx.tail * 16 + this.excitement * 7 + this.happiness * 3) * (0.8 + wagMul * 0.2);
    const wagAmp = (0.2 + fx.tail * 0.85 + this.happiness * 0.25 + this._walk * 0.3) * awake * wagMul;
    this.tailG.rotation.y = Math.sin(t * wagHz) * wagAmp;
    this.tailG.rotation.x = fx.tail * Math.sin(t * wagHz * 0.5) * 0.3;

    const hipAmt = fx.hip + (this.tailType === "stub" ? fx.tail * 0.8 + this.happiness * 0.2 * awake : 0);
    this.hipG.rotation.x = Math.sin(t * 15) * 0.2 * hipAmt + fx.tail * Math.sin(t * 9) * 0.06;
    this.hipG.position.y = this._baseHipY + Math.abs(Math.sin(t * 15)) * 0.05 * hipAmt;
    this.torsoG.rotation.x = Math.sin(t * 15) * 0.07 * hipAmt;

    /* 다리 — 간지럼 파닥 + 발라당 허우적 + 뒷발 탁탁 + 트로트 보행 */
    const wk = this._walk;
    const wph = this._walkPhase;
    const paddleAmp = fx.legs * (tool.id === "feather" ? 0.85 : 0.5);
    const kickGauge = fx.hip * (tool.id === "spoon" ? 1.5 : 0.9);
    for (let i = 0; i < this.legs.length; i++) {
      const g = this.legs[i];
      let rz = 0, rx = 0;
      rz += Math.sin(t * 14 + i * Math.PI * 0.7) * paddleAmp;
      rx += this.flop * (g.position.z > 0 ? 0.9 : -0.9);
      rz += this.flop * Math.sin(t * 10 + i) * 0.35;
      // 트로트: 대각선 다리 쌍(앞오른+뒤왼 / 앞왼+뒤오른)이 교차로 흔들림
      if (wk > 0.01) {
        const phase = (i === 0 || i === 3) ? 0 : Math.PI;
        rz += Math.sin(wph + phase) * 0.55 * wk;
      }
      if (g.userData.isRear && g.position.z > 0 && kickGauge > 0.12) {
        const kick = Math.sin(t * 19);
        rz += -0.45 * kickGauge + kick * 0.55 * kickGauge;
        if (this._kickPrev > 0 && kick <= 0 && kickGauge > 0.4) {
          if (this.audio) this.audio.playThump();
          this._spawnDustAt(this._legScreen(g));
        }
        this._kickPrev = kick;
      }
      g.rotation.z = rz;
      g.rotation.x = rx;
    }

    // 보행 중 몸 들썩임 + 앞뒤 출렁임
    const walkBob = Math.abs(Math.sin(wph)) * 0.05 * wk;
    this.dogG.rotation.z = Math.sin(wph) * 0.03 * wk;

    const hop = fx.legs * Math.abs(Math.sin(t * 8)) * 0.09
      + fx.tail * Math.abs(Math.sin(t * 10)) * 0.05;
    this.rollG.rotation.x = -this.flop * 1.25;
    this.root.position.y = hop + walkBob - this.flop * Math.max(0, tcY - G * 1.05);
    this.root.rotation.y = this._yaw + Math.sin(t * 0.5) * 0.03 * awake * (1 - wk) + hipAmt * Math.sin(t * 15) * 0.02;

    const massAmt = (tool.id === "massage" && this.scratching) ? 0.012 : 0;
    this.dogG.position.x = Math.sin(t * 61) * massAmt;
    this.dogG.position.y = -tcY + Math.sin(t * 53) * massAmt;
  }

  /* ---------------- 화면 좌표 헬퍼 ---------------- */
  _headScreen() {
    if (!this.project) return { x: this.w * 0.6, y: this.h * 0.35 };
    this.headG.getWorldPosition(this._tmpV);
    return this.project(this._tmpV);
  }
  _hipScreen() {
    if (!this.project) return { x: this.w * 0.4, y: this.h * 0.5 };
    this.hipG.getWorldPosition(this._tmpV);
    return this.project(this._tmpV);
  }
  _tailScreen() {
    if (!this.project) return { x: this.w * 0.35, y: this.h * 0.4 };
    this.tailG.getWorldPosition(this._tmpV);
    return this.project(this._tmpV);
  }
  _legScreen(g) {
    if (!this.project) return { x: this.w * 0.45, y: this.h * 0.7 };
    g.userData.paw.getWorldPosition(this._tmpV);
    return this.project(this._tmpV);
  }

  /* ---------------- 파티클 ---------------- */
  _spawnEmojiAt(pos, char, size) {
    this.particles.push({
      type: "emoji", char,
      x: pos.x + rand(-14, 14), y: pos.y - rand(4, 20),
      vx: rand(-12, 12), vy: rand(-50, -30),
      life: 0, max: rand(0.9, 1.3), size: size || 24,
    });
  }
  _spawnDustAt(pos) {
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        type: "dust",
        x: pos.x + rand(-10, 10), y: pos.y + rand(-4, 8),
        vx: rand(-50, 50), vy: rand(-35, -8),
        life: 0, max: rand(0.3, 0.55), size: rand(5, 11),
      });
    }
  }

  _spawnParticles(dt, scr, spd, input, tool, zone) {
    const scale = Math.min(this.w / 760, this.h / 640);
    const head = this._headScreen();

    const burst = tool.furBurst || 1;
    if (scr && spd > 0.25 && input.px != null && Math.random() < spd * 0.6 * burst) {
      const cnt = Math.max(1, Math.round(burst));
      for (let k = 0; k < cnt; k++) {
        this.particles.push({
          type: "fur", x: input.px + rand(-10, 10), y: input.py + rand(-10, 10),
          vx: rand(-40, 40), vy: rand(-70, -20),
          life: 0, max: rand(0.4, 0.8), size: rand(3, 6) * scale, rot: rand(0, 6.28),
          color: this.breed.colors.main,
        });
      }
    }

    this.heartTimer -= dt;
    if (scr && this.happiness > 0.5 && this.heartTimer <= 0) {
      this.heartTimer = lerp(0.7, 0.28, this.happiness);
      this.particles.push({
        type: "heart", x: head.x + rand(-30, 30), y: head.y - 50 * scale,
        vx: rand(-12, 12), vy: rand(-55, -35),
        life: 0, max: rand(1.1, 1.7), size: rand(11, 17) * scale, sway: rand(0, 6.28),
      });
      if (this.audio) this.audio.playHappy();
    }

    this.sparkleTimer -= dt;
    const sparkleReady = this.happiness > 0.8 || (scr && tool.id === "brush" && zone === "body");
    if (sparkleReady && this.sparkleTimer <= 0) {
      this.sparkleTimer = (scr && tool.id === "brush") ? rand(0.1, 0.25) : rand(0.25, 0.6);
      const sx = (scr && input.px != null) ? input.px : head.x;
      const sy = (scr && input.py != null) ? input.py : this.h * 0.45;
      this.particles.push({
        type: "sparkle", x: sx + rand(-90, 90) * scale, y: sy + rand(-70, 50) * scale,
        life: 0, max: rand(0.5, 0.9), size: rand(5, 11) * scale,
      });
    }

    this.zzzTimer -= dt;
    if (this.sleepiness > 0.7 && this.zzzTimer <= 0) {
      this.zzzTimer = rand(1.2, 2.0);
      this.particles.push({
        type: "zzz", x: head.x + 40 * scale, y: head.y - 35 * scale,
        vx: 14 * scale, vy: -24 * scale, life: 0, max: 2.2, size: rand(16, 24) * scale,
      });
    }

    this._emojiTimer -= dt;
    if (scr && input.px != null && this._emojiTimer <= 0) {
      const pick = (arr) => arr[(Math.random() * arr.length) | 0];
      let char = null;
      if (zone === "head") char = pick(["😊", "☺️", "🥰", "😚"]);
      else if (zone === "legs" && this.fx.legs > 0.5) char = pick(["😂", "🤣", "😆"]);
      else if (zone === "tail" && this.fx.tail > 0.5) char = pick(["💕", "🌀", "✨"]);
      else if (zone === "hip" && this.fx.hip > 0.5) char = pick(["🍑", "💨", "🐾"]);
      else if (zone === "body" && tool.id === "massage") char = "🫠";
      if (char) {
        this._emojiTimer = rand(0.5, 0.9);
        this._spawnEmojiAt({ x: input.px, y: input.py }, char, rand(20, 30) * scale);
      }
    }

    if (this.flop > 0.7 && Math.random() < dt * 1.5) {
      this._spawnEmojiAt({ x: this.w * 0.5 + rand(-140, 140) * scale, y: this.h * 0.5 + rand(-40, 80) * scale }, "🐾", rand(16, 24) * scale);
    }
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) { this.particles.splice(i, 1); continue; }
      if (p.vx != null) p.x += p.vx * dt;
      if (p.vy != null) p.y += p.vy * dt;
      if (p.type === "fur") p.vy += 140 * dt;
      if (p.type === "dust") p.vy += 60 * dt;
      if (p.type === "heart") { p.vy *= 0.99; p.x += Math.sin((p.life + p.sway) * 4) * 14 * dt; }
    }
    if (this.particles.length > 140) this.particles.splice(0, this.particles.length - 140);
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = clamp(a);
      if (p.type === "fur") {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.life * 6);
        ctx.fillStyle = p.color || "#f3e8d2";
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, 6.28); ctx.fill();
        ctx.restore();
      } else if (p.type === "dust") {
        ctx.fillStyle = "rgba(200,170,130,0.8)";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + p.life), 0, 6.28); ctx.fill();
      } else if (p.type === "heart") {
        drawHeart(ctx, p.x, p.y, p.size, p.life < 0.15 ? p.life / 0.15 : 1);
      } else if (p.type === "sparkle") {
        drawSparkle(ctx, p.x, p.y, p.size * (0.6 + Math.sin(p.life * 10) * 0.4));
      } else if (p.type === "zzz") {
        ctx.fillStyle = "rgba(120,150,200,0.9)";
        ctx.font = `${p.size}px sans-serif`;
        ctx.fillText("Z", p.x, p.y);
      } else if (p.type === "emoji") {
        const pop = p.life < 0.15 ? p.life / 0.15 : 1;
        ctx.font = `${Math.round(p.size * (0.7 + pop * 0.3))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(p.char, p.x, p.y);
        ctx.textAlign = "left";
      } else if (p.type === "ring") {
        // 우클릭 이동 목표 지점 리플 (납작한 타원 — 바닥 느낌)
        const f = p.life / p.max;
        ctx.strokeStyle = "rgba(255, 250, 235, " + (0.9 * (1 - f)) + ")";
        ctx.lineWidth = 3 * (1 - f) + 1;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size + f * 34, (p.size + f * 34) * 0.42, 0, 0, 6.28);
        ctx.stroke();
        ctx.strokeStyle = "rgba(232, 160, 120, " + (0.7 * (1 - f)) + ")";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, (p.size + f * 34) * 0.55, (p.size + f * 34) * 0.23, 0, 0, 6.28);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- 기분 텍스트 ---------------- */
  moodText() {
    const name = this.breed ? this.breed.name : "강아지";
    if (this.moveTarget) return "타다다닥! 달려가는 중 🐾";
    if (this.sleepiness > 0.72) return "쿨… 쿨… " + name + "는 꿈나라 💤";
    if (this.sleepiness > 0.45) return "스르륵 졸려요…";
    if (this.flop > 0.6) return "발라당~ 배도 만져줘 🐾";
    if (this.scratching && this.curZone) {
      const line = this.tool.zoneText && this.tool.zoneText[this.curZone];
      if (line) return line;
      const k = (ZONE_FX[this.curZone] || ZONE_FX._def).label || "거기";
      return "오… " + k + " 거기 좋아…";
    }
    if (this.excitement > 0.7) return "두근두근 신나요!";
    if (this.happiness > 0.82) return "헤헤 완전 행복해요!";
    if (this.happiness > 0.55) return "기분이 참 좋아요";
    if (this.comfort > 0.55) return "편안~ 노곤노곤";
    return "새근새근…";
  }
}

function drawHeart(ctx, x, y, s, alphaMul) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 16, s / 16); ctx.globalAlpha *= alphaMul;
  const g = ctx.createLinearGradient(0, -16, 0, 14);
  g.addColorStop(0, "#ff9fb2"); g.addColorStop(1, "#ff7d97");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, 12);
  ctx.bezierCurveTo(-16, -4, -10, -18, 0, -8);
  ctx.bezierCurveTo(10, -18, 16, -4, 0, 12);
  ctx.fill(); ctx.restore();
}
function drawSparkle(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "rgba(255,244,210,0.95)";
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    ctx.lineTo(Math.cos(a + Math.PI / 4) * s * 0.32, Math.sin(a + Math.PI / 4) * s * 0.32);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

window.Dog3D = Dog3D;
