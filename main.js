import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.154.0/build/three.module.js';

// ============= ELEMENTOS HTML =============
const startUI = document.getElementById('ui-start');
const btnStart = document.getElementById('btn-start');
const hud = document.getElementById('hud');
const livesEl = document.getElementById('lives-value');
const scoreEl = document.getElementById('score-value');
const timeEl = document.getElementById('time-value');
const collectedEl = document.getElementById('collected');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const flashlightStatus = document.getElementById('flashlight-text');
const feedbackEl = document.getElementById('feedback');
const endUI = document.getElementById('ui-end');
const endTitle = document.getElementById('end-title');
const endMsg = document.getElementById('end-msg');
const btnRestart = document.getElementById('btn-restart');
const canvas = document.getElementById('c');
const hint = document.getElementById('hint');
const minimap = document.getElementById('minimap');
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');
minimapCanvas.width = 180;
minimapCanvas.height = 180;

// ============= CONFIGURAÇÃO DA CENA =============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e1a);
scene.fog = new THREE.FogExp2(0x0a0e1a, 0.015);

// ============= CÂMERA (PRIMEIRA PESSOA) =============
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.7, 0);

// ============= RENDERER =============
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============= ILUMINAÇÃO =============
const ambLight = new THREE.AmbientLight(0x3a4a6a, 0.35);
scene.add(ambLight);

const dirLight = new THREE.DirectionalLight(0x8ab4f8, 1.2);
dirLight.position.set(15, 25, 10);
dirLight.castShadow = true;
dirLight.shadow.camera.left = dirLight.shadow.camera.right = dirLight.shadow.camera.top = dirLight.shadow.camera.bottom = 40;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 100;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

const fillLight = new THREE.PointLight(0xffa94d, 0.6, 30);
fillLight.position.set(-10, 8, -10);
scene.add(fillLight);

const spotlight = new THREE.SpotLight(0xffffee, 2.5, 35, Math.PI / 7, 0.4, 1.8);
spotlight.castShadow = true;
spotlight.shadow.mapSize.set(1024, 1024);
spotlight.shadow.bias = -0.0001;
scene.add(spotlight);
scene.add(spotlight.target);

// ============= CHÃO COM MATERIAL PBR =============
const floorSize = 120;
const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x1a2838,
  roughness: 0.95,
  metalness: 0.05,
  side: THREE.DoubleSide
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const gridHelper = new THREE.GridHelper(floorSize, 60, 0x2dd4bf, 0x1a2838);
gridHelper.material.opacity = 0.15;
gridHelper.material.transparent = true;
scene.add(gridHelper);

// Paredes invisíveis
const wallMat = new THREE.MeshBasicMaterial({ visible: false });
const wallThickness = 1;
const wallHeight = 10;
const halfSize = floorSize / 2;

const walls = [
  new THREE.Mesh(new THREE.BoxGeometry(floorSize, wallHeight, wallThickness), wallMat),
  new THREE.Mesh(new THREE.BoxGeometry(floorSize, wallHeight, wallThickness), wallMat),
  new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, floorSize), wallMat),
  new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, floorSize), wallMat)
];
walls[0].position.set(0, wallHeight / 2, halfSize);
walls[1].position.set(0, wallHeight / 2, -halfSize);
walls[2].position.set(halfSize, wallHeight / 2, 0);
walls[3].position.set(-halfSize, wallHeight / 2, 0);
walls.forEach(w => scene.add(w));

// ============= JOGADOR =============
const playerGroup = new THREE.Group();
scene.add(playerGroup);
playerGroup.position.set(0, 0, 0);
const PLAYER_RADIUS = 0.6;
const EYE_HEIGHT = 1.7;

// ============= OBSTÁCULOS =============
const obstacles = [];

function spawnObstacles(count = 25) {
  const obstacleMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.8,
    metalness: 0.2,
    emissive: 0x330000,
    emissiveIntensity: 0.1
  });

  for (let i = 0; i < count; i++) {
    const w = 1.2 + Math.random() * 2;
    const h = 1.5 + Math.random() * 3;
    const d = 1.2 + Math.random() * 2;

    const geometry = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, obstacleMat.clone());

    let x, z, valid;
    let attempts = 0;
    do {
      x = (Math.random() - 0.5) * 50;
      z = (Math.random() - 0.5) * 50;
      valid = Math.sqrt(x * x + z * z) > 8;
      attempts++;
    } while (!valid && attempts < 100);

    mesh.position.set(x, h / 2, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    scene.add(mesh);
    obstacles.push({
      mesh,
      radius: Math.max(w, d) / 2,
      hit: false,
      originalColor: 0xef4444
    });
  }
}

// ============= COLETÁVEIS =============
const collectibles = [];
const TOTAL_COLLECTIBLES = 12;

function spawnCollectibles(count = TOTAL_COLLECTIBLES) {
  const collectibleMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    roughness: 0.15,
    metalness: 0.9,
    emissive: 0xffaa00,
    emissiveIntensity: 0.4
  });

  for (let i = 0; i < count; i++) {
    const radius = 0.45;
    const geometry = new THREE.SphereGeometry(radius, 20, 20);
    const mesh = new THREE.Mesh(geometry, collectibleMat.clone());

    let x, z, valid;
    let attempts = 0;
    do {
      x = (Math.random() - 0.5) * 45;
      z = (Math.random() - 0.5) * 45;
      valid = true;

      for (const obs of obstacles) {
        const dx = x - obs.mesh.position.x;
        const dz = z - obs.mesh.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < obs.radius + 3) {
          valid = false;
          break;
        }
      }
      attempts++;
    } while (!valid && attempts < 100);

    mesh.position.set(x, 1.2, z);
    mesh.castShadow = true;

    const pointLight = new THREE.PointLight(0xffd700, 0.8, 5);
    pointLight.position.copy(mesh.position);
    scene.add(pointLight);

    scene.add(mesh);
    collectibles.push({
      mesh,
      light: pointLight,
      radius,
      initialY: 1.2,
      phase: Math.random() * Math.PI * 2
    });
  }
}

// ============= ESTADO DO JOGO =============
let keys = {};
let lives = 3;
let score = 0;
let collected = 0;
let running = false;
let startTime = 0;
let velocityY = 0;
const GRAVITY = -25;
const JUMP_FORCE = 9;
const MOVE_SPEED = 8;
let lastTime = performance.now();
let yaw = 0;
let pitch = 0;
let pointerLocked = false;
let flashlightOn = true;
let minimapVisible = false;

// ============= CONTROLES =============
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;

  if (e.key.toLowerCase() === 'f') {
    flashlightOn = !flashlightOn;
    spotlight.visible = flashlightOn;
    flashlightStatus.textContent = flashlightOn ? 'LIGADA' : 'DESLIGADA';
    flashlightStatus.parentElement.style.color = flashlightOn ? '#fbbf24' : '#64748b';
    showFeedback(flashlightOn ? 'Lanterna ligada' : 'Lanterna desligada', 'success');
  }

  if (e.key.toLowerCase() === 'm') {
    minimapVisible = !minimapVisible;
    minimap.classList.toggle('hidden', !minimapVisible);
    showFeedback(minimapVisible ? 'Mini-mapa ativado' : 'Mini-mapa desativado', 'success');
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// ============= POINTER LOCK =============
canvas.addEventListener('click', () => {
  if (!pointerLocked && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = (document.pointerLockElement === canvas);
  hint.classList.toggle('hidden', pointerLocked);
});

document.addEventListener('mousemove', (e) => {
  if (!pointerLocked || !running) return;
  yaw -= e.movementX * 0.002;
  pitch -= e.movementY * 0.002;
  pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
});

// ============= FUNÇÕES AUXILIARES =============
function showFeedback(message, type = 'success') {
  feedbackEl.textContent = message;
  feedbackEl.className = `show ${type}`;
  setTimeout(() => feedbackEl.classList.remove('show'), 2000);
}

function updateHUD() {
  livesEl.textContent = lives;
  scoreEl.textContent = score;
  timeEl.textContent = Math.floor((performance.now() - startTime) / 1000);
  collectedEl.textContent = collected;

  const progress = (collected / TOTAL_COLLECTIBLES) * 100;
  progressFill.style.width = progress + '%';
  progressText.textContent = Math.floor(progress) + '%';
}

function dist2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function drawMinimap() {
  if (!minimapVisible || !running) return;

  const ctx = minimapCtx;
  const size = 180;
  const scale = 2.5;

  ctx.fillStyle = 'rgba(10, 14, 26, 0.95)';
  ctx.fillRect(0, 0, size, size);

  const centerX = size / 2;
  const centerY = size / 2;

  // Obstáculos
  ctx.fillStyle = '#ef4444';
  obstacles.forEach(obs => {
    if (!obs.mesh.visible) return;
    const x = centerX + (obs.mesh.position.x - playerGroup.position.x) * scale;
    const z = centerY + (obs.mesh.position.z - playerGroup.position.z) * scale;
    ctx.beginPath();
    ctx.arc(x, z, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Coletáveis
  ctx.fillStyle = '#ffd700';
  collectibles.forEach(col => {
    const x = centerX + (col.mesh.position.x - playerGroup.position.x) * scale;
    const z = centerY + (col.mesh.position.z - playerGroup.position.z) * scale;
    ctx.beginPath();
    ctx.arc(x, z, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Jogador
  ctx.fillStyle = '#2dd4bf';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Direção
  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + Math.sin(yaw) * 15, centerY - Math.cos(yaw) * 15);
  ctx.stroke();

  // Borda
  ctx.strokeStyle = 'rgba(45, 212, 191, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
}

// ============= LOOP PRINCIPAL =============
function tick(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (running) {
    // Movimento
    const forward = (keys['w'] || keys['arrowup']) ? 1 : (keys['s'] || keys['arrowdown']) ? -1 : 0;
    const right = (keys['d'] || keys['arrowright']) ? 1 : (keys['a'] || keys['arrowleft']) ? -1 : 0;

    if (forward !== 0 || right !== 0) {
      const moveDir = new THREE.Vector3(right, 0, -forward);
      moveDir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

      const newX = playerGroup.position.x + moveDir.x * MOVE_SPEED * dt;
      const newZ = playerGroup.position.z + moveDir.z * MOVE_SPEED * dt;

      const limit = floorSize / 2 - 2;
      playerGroup.position.x = Math.max(-limit, Math.min(limit, newX));
      playerGroup.position.z = Math.max(-limit, Math.min(limit, newZ));
    }

    // Pulo e gravidade
    const isGrounded = Math.abs(playerGroup.position.y) < 0.1;
    if ((keys[' '] || keys['space']) && isGrounded) velocityY = JUMP_FORCE;

    velocityY += GRAVITY * dt;
    playerGroup.position.y += velocityY * dt;
    if (playerGroup.position.y < 0) {
      playerGroup.position.y = 0;
      velocityY = 0;
    }

    // Câmera
    camera.position.set(playerGroup.position.x, playerGroup.position.y + EYE_HEIGHT, playerGroup.position.z);
    const lookDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    camera.lookAt(camera.position.clone().add(lookDir));

    // Lanterna segue o olhar
    spotlight.position.copy(camera.position);
    spotlight.target.position.copy(camera.position.clone().add(lookDir));

    // Colisão com obstáculos
    for (const obs of obstacles) {
      if (!obs.mesh.visible || obs.hit) continue;
      if (dist2D(obs.mesh.position, playerGroup.position) < obs.radius + PLAYER_RADIUS) {
        obs.hit = true;
        lives--;
        obs.mesh.material.color.setHex(0x1a1a1a);
        obs.mesh.material.emissive.setHex(0xff0000);
        obs.mesh.material.emissiveIntensity = 1;
        showFeedback('Colisão! -1 Vida', 'danger');
        scene.background.setHex(0x330000);
        setTimeout(() => scene.background.setHex(0x0a0e1a), 100);
        setTimeout(() => obs.mesh.visible = false, 600);
      }
    }

    // Coleta
    for (let i = collectibles.length - 1; i >= 0; i--) {
      const col = collectibles[i];
      if (dist2D(col.mesh.position, playerGroup.position) < col.radius + PLAYER_RADIUS) {
        score += 10;
        collected++;
        showFeedback('+10 Pontos!', 'success');
        scene.remove(col.mesh);
        scene.remove(col.light);
        collectibles.splice(i, 1);
      } else {
        const time = now * 0.001;
        col.mesh.position.y = col.initialY + Math.sin(time * 2.5 + col.phase) * 0.2;
        col.mesh.rotation.y += dt * 2.5;
        col.light.position.copy(col.mesh.position);
        col.light.intensity = 0.6 + Math.sin(time * 3 + col.phase) * 0.3;
      }
    }

    updateHUD();
    drawMinimap();

    // Condições de fim
    if (collected >= TOTAL_COLLECTIBLES) endGame(true, 'Parabéns! Você coletou todos os itens!');
    else if (lives <= 0) endGame(false, 'Game Over! Todas as vidas perdidas.');
    else if ((performance.now() - startTime) > 180000) endGame(true, 'Tempo esgotado! Você sobreviveu!');
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ============= INICIAR / FINALIZAR =============
function startGame() {
  lives = 3; score = 0; collected = 0; velocityY = 0; yaw = 0; pitch = 0; flashlightOn = true; minimapVisible = false;
  playerGroup.position.set(0, 0, 0);

  obstacles.forEach(o => scene.remove(o.mesh));
  obstacles.length = 0;
  collectibles.forEach(c => { scene.remove(c.mesh); scene.remove(c.light); });
  collectibles.length = 0;

  spawnObstacles(25);
  spawnCollectibles(TOTAL_COLLECTIBLES);

  startTime = performance.now();
  lastTime = performance.now();
  running = true;

  startUI.classList.add('hidden');
  hud.classList.remove('hidden');
  hint.classList.remove('hidden');
  minimap.classList.add('hidden');
  endUI.classList.add('hidden');

  spotlight.visible = true;
  flashlightStatus.textContent = 'LIGADA';
  updateHUD();
  showFeedback('Jogo iniciado! Boa sorte!', 'success');
}

function endGame(won, message) {
  running = false;
  hud.classList.add('hidden');
  hint.classList.add('hidden');
  minimap.classList.add('hidden');
  endUI.classList.remove('hidden');

  endTitle.textContent = won ? 'VITÓRIA!' : 'DERROTA';
  endMsg.textContent = message;

  document.getElementById('final-score').textContent = score;
  document.getElementById('final-time').textContent = Math.floor((performance.now() - startTime) / 1000);
  document.getElementById('final-collected').textContent = collected;
  document.getElementById('final-lives').textContent = lives;

  if (document.pointerLockElement) document.exitPointerLock();
}

// ============= EVENTOS =============
btnStart.addEventListener('click', startGame);
btnRestart.addEventListener('click', startGame);

// ============= LOOP =============
requestAnimationFrame(tick);