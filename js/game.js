/* ============================================================
   game.js — 메인: 3D 씬 + 배경 + 파티클 + 품종 선택 UI + 루프
   ------------------------------------------------------------
   - bg 캔버스(2D): 따뜻한 방 배경
   - game3d 캔버스(WebGL): 품종별 3D 강아지 + 방석 + 조명/그림자
   - fx 캔버스(2D): 하트/털/반짝임 파티클
   - 품종 선택 패널: 9품종 카드 → 클릭 즉시 변신 (자동 저장)
   - 유대감(Lv): 품종마다 따로 쌓임
   ============================================================ */
(function () {
  const bgCanvas = document.getElementById("bg");
  const bgCtx = bgCanvas.getContext("2d");
  const canvas3d = document.getElementById("game3d");
  const fxCanvas = document.getElementById("fx");
  const fxCtx = fxCanvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;

  /* ---------------- 3D 씬 ---------------- */
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas3d, alpha: true, antialias: true, preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 1.9, 7.1);
  camera.lookAt(0, 1.0, 0);

  scene.add(new THREE.HemisphereLight(0xfff4e0, 0xc7a17a, 0.9));
  const sun = new THREE.DirectionalLight(0xffeecf, 0.85);
  sun.position.set(3.5, 6, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -5; sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 5; sun.shadow.camera.bottom = -5;
  scene.add(sun);

  // 방석
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0xe8b09a, roughness: 1 });
  cushionMat.color.convertSRGBToLinear();
  const cushion = new THREE.Mesh(new THREE.CircleGeometry(2.7, 48), cushionMat);
  cushion.rotation.x = -Math.PI / 2;
  cushion.position.y = 0.01;
  cushion.receiveShadow = true;
  scene.add(cushion);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd9967f, roughness: 1 });
  rimMat.color.convertSRGBToLinear();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.28, 14, 48), rimMat);
  rim.rotation.x = -Math.PI / 2;
  rim.scale.z = 0.45;
  rim.position.y = 0.06;
  rim.receiveShadow = true;
  scene.add(rim);

  // 방석 밖에서도 그림자가 떨어지게 — 보이지 않는 그림자 전용 바닥
  const shadowGround = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 12),
    new THREE.ShadowMaterial({ opacity: 0.2 })
  );
  shadowGround.rotation.x = -Math.PI / 2;
  shadowGround.position.y = 0.004;
  shadowGround.receiveShadow = true;
  scene.add(shadowGround);

  /* ---------------- 강아지 + 시스템 ---------------- */
  const BREED_KEY = "bb2_breed_v1";
  let savedBreed = "";
  try { savedBreed = localStorage.getItem(BREED_KEY) || ""; } catch (_) {}

  const dog = new Dog3D(getBreed(savedBreed || "maltese"));
  dog.camera = camera;
  scene.add(dog.root);
  dog.root.position.set(0, 0.05, 0);

  const audio = new AudioEngine();
  dog.audio = audio;

  const _projV = new THREE.Vector3();
  dog.project = (v3) => {
    _projV.copy(v3).project(camera);
    return { x: (_projV.x + 1) / 2 * W, y: (-_projV.y + 1) / 2 * H };
  };

  const tools = new ToolManager(dog, audio);
  tools.buildBar();

  const input = new ScratchInput(canvas3d, dog, () => tools.current);

  // 우클릭 → 바닥(y=0) 교차점으로 강아지 이동
  const _moveRay = new THREE.Raycaster();
  const _moveNdc = new THREE.Vector2();
  input.onMoveCommand = (px, py) => {
    _moveNdc.set((px / W) * 2 - 1, -(py / H) * 2 + 1);
    _moveRay.setFromCamera(_moveNdc, camera);
    const dirY = _moveRay.ray.direction.y;
    if (Math.abs(dirY) < 1e-4) return;
    const t = -_moveRay.ray.origin.y / dirY;
    if (t <= 0) return;                       // 바닥과 안 만남 (하늘 클릭)
    const pt = _moveRay.ray.origin.clone().addScaledVector(_moveRay.ray.direction, t);
    // 화면 안 활동 반경으로 제한
    const r = Math.hypot(pt.x, pt.z);
    const maxR = 2.8;
    if (r > maxR) { pt.x *= maxR / r; pt.z *= maxR / r; }
    dog.moveTo(pt);
    // 클릭 지점 리플 표시
    dog.particles.push({ type: "ring", x: px, y: py, life: 0, max: 0.6, size: 8 });
  };

  /* ---------------- UI ---------------- */
  const moodEl = document.getElementById("mood");
  const hintEl = document.getElementById("hint");
  const btnSound = document.getElementById("btnSound");
  const btnShot = document.getElementById("btnShot");
  const btnBreed = document.getElementById("btnBreed");
  const bondBar = document.getElementById("bondBar");
  const bondLv = document.getElementById("bondLv");
  const bondHeart = document.getElementById("bondHeart");

  const toast = document.createElement("div");
  toast.id = "toast";
  toast.style.display = "none";
  document.body.appendChild(toast);
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.style.display = "block";
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.display = "none"; }, 2400);
  }

  /* ---------------- 유대감(레벨) — 품종별 저장 ---------------- */
  const BOND_KEY = "bb2_bond_v1";
  let bondMap = {};
  try { bondMap = JSON.parse(localStorage.getItem(BOND_KEY) || "{}"); } catch (_) {}
  let bond = 0, bondLevel = 1;
  const needFor = (lv) => 18 * Math.pow(lv, 1.35);

  function loadBond() {
    const saved = bondMap[dog.breed.id] || { p: 0, lv: 1 };
    bond = saved.p; bondLevel = saved.lv;
  }
  function saveBond() {
    bondMap[dog.breed.id] = { p: bond, lv: bondLevel };
    try { localStorage.setItem(BOND_KEY, JSON.stringify(bondMap)); } catch (_) {}
  }
  const HEARTS = ["🤍", "💛", "🧡", "❤️", "💖", "💞", "💝"];
  function refreshBondUI() {
    const need = needFor(bondLevel);
    bondBar.style.width = Math.min(100, (bond / need) * 100) + "%";
    bondLv.textContent = "Lv." + bondLevel;
    bondHeart.textContent = HEARTS[Math.min(HEARTS.length - 1, bondLevel - 1)];
  }
  function addBond(amount) {
    bond += amount;
    const need = needFor(bondLevel);
    if (bond >= need) {
      bond -= need;
      bondLevel++;
      audio.playLevelUp();
      audio.playBark(1);
      for (let i = 0; i < 14; i++) {
        dog.particles.push({
          type: "heart",
          x: W / 2 + (Math.random() - 0.5) * 260,
          y: H * 0.4 + (Math.random() - 0.5) * 140,
          vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60,
          life: 0, max: 1.2 + Math.random() * 0.8,
          size: 12 + Math.random() * 10, sway: Math.random() * 6.28,
        });
      }
      showToast(`💖 유대감 Lv.${bondLevel} 달성! ${dog.breed.name}가 더 좋아해요`);
      saveBond();
    }
    refreshBondUI();
  }
  let bondSaveT = 0;

  /* ---------------- 품종 선택 패널 ---------------- */
  const picker = document.getElementById("breedPicker");
  const grid = document.getElementById("breedGrid");

  function selectBreed(id, silent) {
    const def = getBreed(id);
    dog.applyBreed(def);
    try { localStorage.setItem(BREED_KEY, def.id); } catch (_) {}
    btnBreed.textContent = def.emoji + " " + def.name;
    loadBond();
    refreshBondUI();
    [...grid.querySelectorAll(".breed-card")].forEach((c) =>
      c.classList.toggle("on", c.dataset.id === def.id));
    if (!silent) {
      audio.playBark(0.7);
      showToast(`${def.emoji} ${def.name} 등장! ${def.traits[0]}`);
    }
  }

  function buildPicker() {
    grid.innerHTML = "";
    window.BREEDS.forEach((b) => {
      const card = document.createElement("button");
      card.className = "breed-card";
      card.dataset.id = b.id;
      const lv = (bondMap[b.id] && bondMap[b.id].lv) || 1;
      card.innerHTML =
        `<span class="bc-emoji">${b.emoji}</span>` +
        `<span class="bc-name">${b.name}</span>` +
        `<span class="bc-en">${b.nameEn} · Lv.${lv}</span>` +
        `<span class="bc-dots">` +
        [b.colors.main, b.colors.secondary, b.colors.cream]
          .map((c) => `<i style="background:${c}"></i>`).join("") +
        `</span>` +
        `<span class="bc-traits">${b.traits.join(" ")}</span>` +
        `<span class="bc-desc">${b.desc}</span>`;
      card.addEventListener("click", () => selectBreed(b.id));
      grid.appendChild(card);
    });
  }

  btnBreed.addEventListener("click", () => {
    const open = picker.style.display !== "none";
    if (open) { picker.style.display = "none"; return; }
    buildPicker(); // 레벨 갱신 반영
    [...grid.querySelectorAll(".breed-card")].forEach((c) =>
      c.classList.toggle("on", c.dataset.id === dog.breed.id));
    picker.style.display = "block";
  });
  document.getElementById("breedClose").addEventListener("click", () => {
    picker.style.display = "none";
  });

  /* ---------------- 리사이즈 ---------------- */
  let motes = [];
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    for (const [cv, cx] of [[bgCanvas, bgCtx], [fxCanvas, fxCtx]]) {
      cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR);
      cv.style.width = W + "px"; cv.style.height = H + "px";
      cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    renderer.setSize(W, H);
    camera.aspect = W / H;
    camera.position.z = (W / H < 0.8) ? 9.6 : 7.1;
    camera.updateProjectionMatrix();
    dog.resize(W, H);

    motes = [];
    const n = Math.round((W * H) / 90000);
    for (let i = 0; i < n; i++) motes.push({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 2 + 0.6, s: Math.random() * 10 + 5, ph: Math.random() * 6.28,
    });
  }
  window.addEventListener("resize", resize);

  /* ---------------- 배경 (따뜻한 방) ---------------- */
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function drawBackground(time) {
    const ctx = bgCtx;
    const wall = ctx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, "#f6ddb4"); wall.addColorStop(0.55, "#f0cf9f"); wall.addColorStop(1, "#e6bd86");
    ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
    const floorY = H * 0.66;
    const floor = ctx.createLinearGradient(0, floorY, 0, H);
    floor.addColorStop(0, "#d8a874"); floor.addColorStop(1, "#c8945e");
    ctx.fillStyle = floor; ctx.fillRect(0, floorY, W, H - floorY);
    const x = W * 0.07, y = H * 0.09, w = Math.min(W * 0.26, 320), h = Math.min(H * 0.36, 360);
    const wg = ctx.createLinearGradient(x, y, x, y + h);
    wg.addColorStop(0, "#fff6d8"); wg.addColorStop(1, "#ffe7ad");
    roundRect(ctx, x, y, w, h, 14); ctx.fillStyle = wg; ctx.fill();
    ctx.strokeStyle = "rgba(150,110,70,0.5)"; ctx.lineWidth = 8; ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + h * 0.5); ctx.lineTo(x + w, y + h * 0.5); ctx.stroke();
    const glow = ctx.createRadialGradient(W * 0.22, H * 0.26, 20, W * 0.22, H * 0.26, Math.max(W, H) * 0.7);
    glow.addColorStop(0, "rgba(255,247,220,0.45)"); glow.addColorStop(1, "rgba(255,247,220,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,250,235,0.5)";
    for (const m of motes) {
      m.y -= m.s * 0.016; m.x += Math.sin(time * 0.0006 + m.ph) * 0.2;
      if (m.y < -5) m.y = H + 5;
      ctx.globalAlpha = 0.35 + Math.sin(time * 0.002 + m.ph) * 0.25;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.28); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(40,25,12,0)"); v.addColorStop(1, "rgba(40,25,12,0.28)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  /* ---------------- 메인 루프 ---------------- */
  let last = performance.now(), moodTimer = 0;
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;

    input.update(dt);
    const state = input.getState();
    dog.update(dt, state);
    audio.setScratch(state.scratching ? state.speed01 : 0);
    audio.setSleepy(dog.sleepiness);

    if (state.scratching) {
      addBond(dt * (0.5 + state.speed01) * (tools.current.happyMul || 1));
      bondSaveT += dt;
      if (bondSaveT > 3) { bondSaveT = 0; saveBond(); }
    }

    drawBackground(now);
    renderer.render(scene, camera);
    fxCtx.clearRect(0, 0, W, H);
    dog.drawParticles(fxCtx);

    moodTimer -= dt;
    if (moodTimer <= 0) { moodEl.textContent = dog.moodText(); moodTimer = 0.35; }
    requestAnimationFrame(frame);
  }

  /* ---------------- 버튼 ---------------- */
  input.onFirstInput = () => {
    audio.start();
    hintEl.classList.add("hidden");
    updateSoundLabel();
  };
  function updateSoundLabel() { btnSound.textContent = audio.muted ? "소리 켜기" : "소리 끄기"; }
  btnSound.addEventListener("click", () => {
    if (!audio.ready) audio.start(); else audio.toggleMute();
    updateSoundLabel();
  });

  btnShot.addEventListener("click", () => {
    try {
      const tmp = document.createElement("canvas");
      tmp.width = bgCanvas.width; tmp.height = bgCanvas.height;
      const tc = tmp.getContext("2d");
      tc.drawImage(bgCanvas, 0, 0);
      renderer.render(scene, camera);
      tc.drawImage(canvas3d, 0, 0, tmp.width, tmp.height);
      tc.drawImage(fxCanvas, 0, 0);
      const a = document.createElement("a");
      a.href = tmp.toDataURL("image/png");
      a.download = dog.breed.name + " 벅벅.png";
      a.click();
    } catch (e) { alert("사진 저장 실패: " + e.message); }
  });

  // 음원 출처 (CC BY-SA 표기 의무)
  const credit = document.createElement("button");
  credit.id = "creditBtn";
  credit.textContent = "ⓘ 음원 출처";
  document.body.appendChild(credit);
  credit.addEventListener("click", () => {
    alert(
      "동물 울음소리 출처 (Wikimedia Commons)\n\n" +
      '• 강아지: "Barking dog in Rome.ogg" (CC BY-SA 3.0)\n' +
      "  https://upload.wikimedia.org/wikipedia/commons/f/f0/Barking_dog_in_Rome.ogg\n\n" +
      "※ CC BY-SA 음원은 동일조건 변경허락 라이선스입니다."
    );
  });

  window.addEventListener("beforeunload", saveBond);

  /* ---------------- 시작 ---------------- */
  resize();
  selectBreed(dog.breed.id, true);
  moodEl.textContent = dog.moodText();
  requestAnimationFrame(frame);

  window.__dog = dog; // 디버그용
  // 디버그: 창이 숨겨져 rAF가 멈춰도 한 프레임 강제 렌더
  window.__renderOnce = (simT) => {
    if (simT) { // 애니메이션 포즈를 잡기 위해 가상으로 시간을 흘림
      for (let i = 0; i < Math.round(simT / 0.016); i++) {
        dog.update(0.016, input.getState());
      }
    }
    drawBackground(performance.now());
    renderer.render(scene, camera);
    fxCtx.clearRect(0, 0, W, H);
    dog.drawParticles(fxCtx);
  };
  console.log("[강아지벅벅3D] 게임 시작 — 품종 " + window.BREEDS.length + "종 / 부위 5곳 / 도구 5종");
})();
