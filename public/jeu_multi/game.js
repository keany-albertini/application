import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://anwgxemngmhdvdqowyry.supabase.co";
const SUPABASE_KEY = "sb_publishable_7yQB9C0DP7ZuQJFFjn9v9A_00Bl4K88";
const TARGET_SCORE = 10;
const STATE_INTERVAL = 75;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const canvas = document.querySelector("#game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.55;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x182028);
scene.fog = new THREE.Fog(0x182028, 42, 105);

const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.08, 180);
camera.position.set(0, 1.7, 8);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.object);

const ambient = new THREE.HemisphereLight(0xe8f2ff, 0x5b5148, 2.65);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 3.5);
sun.position.set(15, 24, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(sun);

const fillLight = new THREE.DirectionalLight(0x9dc8ff, 1.4);
fillLight.position.set(-14, 10, -16);
scene.add(fillLight);

const cameraLight = new THREE.PointLight(0xfff3dc, 2.4, 22, 1.45);
cameraLight.position.set(0, 0.2, 0.15);
camera.add(cameraLight);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const obstacleMeshes = [];
const colliders = [];
const mapObjects = [];

const ui = {
  login: document.querySelector("#login-screen"),
  home: document.querySelector("#home-screen"),
  queue: document.querySelector("#queue-screen"),
  hud: document.querySelector("#hud"),
  result: document.querySelector("#result-screen"),
  loginForm: document.querySelector("#login-form"),
  username: document.querySelector("#username"),
  password: document.querySelector("#password"),
  welcome: document.querySelector("#welcome"),
  play: document.querySelector("#play-button"),
  training: document.querySelector("#training-button"),
  createPrivate: document.querySelector("#create-private"),
  joinPrivate: document.querySelector("#join-private"),
  roomCode: document.querySelector("#room-code"),
  cancelQueue: document.querySelector("#cancel-queue"),
  queueTitle: document.querySelector("#queue-title"),
  queueInfo: document.querySelector("#queue-info"),
  shareCode: document.querySelector("#share-code"),
  shareCodeValue: document.querySelector("#share-code-value"),
  mapGrid: document.querySelector("#map-grid"),
  mapName: document.querySelector("#map-name"),
  enemyName: document.querySelector("#enemy-name"),
  scoreYou: document.querySelector("#score-you"),
  scoreEnemy: document.querySelector("#score-enemy"),
  health: document.querySelector("#health-value"),
  healthBar: document.querySelector("#health-bar"),
  ammo: document.querySelector("#ammo-value"),
  hitMarker: document.querySelector("#hit-marker"),
  killMessage: document.querySelector("#kill-message"),
  gameMessage: document.querySelector("#game-message"),
  resultTitle: document.querySelector("#result-title"),
  resultScore: document.querySelector("#result-score"),
  replay: document.querySelector("#replay-button"),
  menu: document.querySelector("#menu-button"),
  mobileControls: document.querySelector("#mobile-controls"),
  moveStick: document.querySelector("#move-stick"),
  moveKnob: document.querySelector("#move-knob"),
  lookStick: document.querySelector("#look-stick"),
  lookKnob: document.querySelector("#look-knob"),
  mobileFire: document.querySelector("#mobile-fire"),
  mobileJump: document.querySelector("#mobile-jump"),
  mobileReload: document.querySelector("#mobile-reload"),
};

const MAPS = [
  { name:"DOCKYARD", subtitle:"Containers · courtes lignes", gradient:"linear-gradient(135deg,#18364b,#121820)", sky:0x0d151c, fog:0x0d151c, floor:0x27313a, accent:0x1b6b8f, spawns:[[-13,1.7,13],[13,1.7,-13]], boxes:[[-9,1.5,-6,4,3,9],[8,1.5,7,4,3,9],[-1,1.5,-1,7,3,3],[-13,1.5,5,3,3,7],[13,1.5,-5,3,3,7],[-4,1,11,6,2,3],[4,1,-11,6,2,3]] },
  { name:"DESERT OUTPOST", subtitle:"Murs bas · duels ouverts", gradient:"linear-gradient(135deg,#6a4b2b,#1b1712)", sky:0x2a2118, fog:0x2a2118, floor:0x6f5a3c, accent:0x9a7040, spawns:[[-15,1.7,0],[15,1.7,0]], boxes:[[0,1.4,0,5,2.8,5],[-9,1,-8,6,2,2],[9,1,8,6,2,2],[-9,1,8,2,2,7],[9,1,-8,2,2,7],[-2,1,11,7,2,2],[2,1,-11,7,2,2]] },
  { name:"NEON GRID", subtitle:"Angles serrés · verticalité", gradient:"linear-gradient(135deg,#281647,#090b17)", sky:0x080914, fog:0x080914, floor:0x171828, accent:0x6e42d8, spawns:[[-14,1.7,-14],[14,1.7,14]], boxes:[[-7,2,-7,4,4,4],[7,2,7,4,4,4],[7,1.5,-7,5,3,2],[-7,1.5,7,5,3,2],[0,1,0,3,2,10],[0,2,14,10,4,2],[0,2,-14,10,4,2]] },
  { name:"ARCTIC BASE", subtitle:"Couloirs froids · visibilité nette", gradient:"linear-gradient(135deg,#75a8ba,#162128)", sky:0x17242b, fog:0x17242b, floor:0xa4bdc5, accent:0x6db5c9, spawns:[[0,1.7,15],[0,1.7,-15]], boxes:[[-10,1.5,0,4,3,12],[10,1.5,0,4,3,12],[0,1,-5,9,2,2],[0,1,5,9,2,2],[-5,2,14,7,4,2],[5,2,-14,7,4,2]] },
  { name:"RUINS", subtitle:"Piliers · lignes cassées", gradient:"linear-gradient(135deg,#4c4a3c,#121310)", sky:0x171712, fog:0x171712, floor:0x55564d, accent:0x77755e, spawns:[[-14,1.7,10],[14,1.7,-10]], boxes:[[-8,2,-8,2,4,2],[0,2,-8,2,4,2],[8,2,-8,2,4,2],[-8,2,8,2,4,2],[0,2,8,2,4,2],[8,2,8,2,4,2],[-12,1,0,4,2,2],[12,1,0,4,2,2],[0,1,0,6,2,4]] },
  { name:"FOUNDRY", subtitle:"Industriel · combat agressif", gradient:"linear-gradient(135deg,#5b251b,#17100d)", sky:0x1c0f0b, fog:0x1c0f0b, floor:0x332824, accent:0x9b3f23, spawns:[[-15,1.7,-5],[15,1.7,5]], boxes:[[-8,1.5,0,3,3,10],[8,1.5,0,3,3,10],[0,2,0,5,4,5],[-13,1,10,5,2,3],[13,1,-10,5,2,3],[-2,1,12,8,2,2],[2,1,-12,8,2,2]] }
];

MAPS.forEach((map, index) => {
  const card = document.createElement("article");
  card.className = "map-card";
  card.style.setProperty("--map-gradient", map.gradient);
  card.innerHTML = `<strong>${String(index + 1).padStart(2,"0")} · ${map.name}</strong><span>${map.subtitle}</span>`;
  ui.mapGrid.append(card);
});

const clientId = crypto.randomUUID();
let playerName = localStorage.getItem("duel:name") || "";
let queueChannel = null;
let roomChannel = null;
let roomCode = "";
let roomReady = false;
let matchmakingLocked = false;

let opponentId = null;
let opponentName = "ADVERSAIRE";
let currentMapIndex = 0;
let inGame = false;
let training = false;
let health = 100;
let alive = true;
let ammo = 30;
let reloading = false;
let lastShotAt = 0;
let scoreYou = 0;
let scoreEnemy = 0;
let spawnIndex = 0;
let verticalVelocity = 0;
let onGround = true;
let lastStateSend = 0;

const keys = {};
const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
const mobileMove = { x: 0, y: 0 };
const mobileLook = { x: 0, y: 0 };
let mobileFireTimer = null;
const PLAYER_RADIUS = 0.38;
const PLAYER_HEIGHT = 1.7;
const SPEED = 7;
const SPRINT_SPEED = 10.2;
const JUMP_SPEED = 7.2;
const GRAVITY = 21;

if (playerName) ui.username.value = playerName;

function setScreen(screen) {
  [ui.login, ui.home, ui.queue].forEach((el) => el.classList.remove("active"));
  if (screen) screen.classList.add("active");
}

function sanitizeCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function presencePlayers(channel) {
  const state = channel?.presenceState?.() || {};
  return Object.values(state)
    .flat()
    .map((entry) => ({
      id: entry.id || entry.clientId,
      name: entry.name || "Joueur",
      joinedAt: Number(entry.joinedAt || 0),
    }))
    .filter((entry) => entry.id)
    .sort((a, b) => a.joinedAt - b.joinedAt || String(a.id).localeCompare(String(b.id)));
}

async function cleanupQueue() {
  matchmakingLocked = false;
  if (!queueChannel) return;
  try { await queueChannel.untrack(); } catch {}
  try { await supabase.removeChannel(queueChannel); } catch {}
  queueChannel = null;
}

async function cleanupRoom(sendLeave = false) {
  if (!roomChannel) return;
  if (sendLeave) {
    try {
      await roomChannel.send({
        type: "broadcast",
        event: "leave",
        payload: { playerId: clientId }
      });
    } catch {}
  }
  try { await roomChannel.untrack(); } catch {}
  try { await supabase.removeChannel(roomChannel); } catch {}
  roomChannel = null;
  roomReady = false;
  roomCode = "";
}

async function startAutoMatchmaking() {
  await cleanupQueue();
  await cleanupRoom(false);

  matchmakingLocked = false;
  training = false;
  ui.queueTitle.textContent = "Recherche d'un adversaire…";
  ui.queueInfo.textContent = "File 1v1 en ligne.";
  ui.shareCode.classList.add("hidden");
  setScreen(ui.queue);

  queueChannel = supabase.channel("duel-matchmaking-v2", {
    config: { presence: { key: clientId } }
  });

  queueChannel.on("presence", { event: "sync" }, async () => {
    if (matchmakingLocked || !queueChannel) return;
    const players = presencePlayers(queueChannel);
    if (players.length < 2) {
      ui.queueInfo.textContent = "En attente d'un deuxième joueur…";
      return;
    }

    for (let i = 0; i + 1 < players.length; i += 2) {
      const pair = [players[i], players[i + 1]];
      if (!pair.some((p) => p.id === clientId)) continue;

      matchmakingLocked = true;
      const ids = pair.map((p) => String(p.id)).sort();
      const code = `AUTO-${ids[0].slice(0, 8)}-${ids[1].slice(0, 8)}`;
      await cleanupQueue();
      await joinRoom(code, false);
      break;
    }
  });

  queueChannel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await queueChannel.track({
        id: clientId,
        name: playerName,
        joinedAt: Date.now()
      });
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      ui.queueInfo.textContent = "Connexion Realtime impossible. Réessaie.";
    }
  });
}

async function joinRoom(code, showCode = true) {
  await cleanupRoom(false);
  roomCode = sanitizeCode(code.replace(/^AUTO-/, "")) || code;

  if (showCode) {
    ui.queueTitle.textContent = "Partie privée";
    ui.queueInfo.textContent = "En attente de ton ami…";
    ui.shareCodeValue.textContent = roomCode;
    ui.shareCode.classList.remove("hidden");
    setScreen(ui.queue);
  } else {
    ui.queueTitle.textContent = "Adversaire trouvé";
    ui.queueInfo.textContent = "Connexion à l'arène…";
    ui.shareCode.classList.add("hidden");
  }

  roomChannel = supabase.channel(`duel-room-${code}`, {
    config: {
      broadcast: { self: false },
      presence: { key: clientId }
    }
  });

  roomChannel
    .on("presence", { event: "sync" }, () => {
      if (!roomChannel) return;
      const players = presencePlayers(roomChannel);

      if (roomReady && players.length < 2 && inGame && !training) {
        showKillMessage("L'adversaire a quitté");
        setTimeout(() => leaveGameToMenu(false), 900);
        return;
      }

      if (roomReady || players.length < 2) return;

      const activePlayers = players.slice(0, 2);
      if (!activePlayers.some((p) => p.id === clientId)) {
        ui.queueInfo.textContent = "Cette partie est déjà pleine.";
        return;
      }

      const meIndex = activePlayers.findIndex((p) => p.id === clientId);
      const enemy = activePlayers[1 - meIndex];

      opponentId = enemy.id;
      opponentName = enemy.name;
      spawnIndex = meIndex;
      currentMapIndex = hashString(code) % MAPS.length;
      roomReady = true;
      startMatch();
    })
    .on("broadcast", { event: "state" }, ({ payload }) => {
      if (payload?.playerId !== clientId) updateOpponent(payload);
    })
    .on("broadcast", { event: "hit" }, ({ payload }) => {
      if (payload?.targetId === clientId) receiveHit(payload);
    })
    .on("broadcast", { event: "death" }, ({ payload }) => {
      handleDeath(payload);
    })
    .on("broadcast", { event: "respawn" }, ({ payload }) => {
      if (payload?.playerId === opponentId) resetOpponentToSpawn(1 - spawnIndex);
    })
    .on("broadcast", { event: "leave" }, ({ payload }) => {
      if (payload?.playerId === opponentId) {
        showKillMessage("L'adversaire a quitté");
        setTimeout(() => leaveGameToMenu(false), 900);
      }
    });

  roomChannel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await roomChannel.track({
        id: clientId,
        name: playerName,
        joinedAt: Date.now()
      });
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      ui.queueInfo.textContent = "Impossible de rejoindre cette partie.";
    }
  });
}

ui.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = ui.username.value.trim();
  if (!name || ui.password.value.length < 4) return;

  playerName = name.slice(0, 18);
  localStorage.setItem("duel:name", playerName);
  ui.welcome.textContent = `BIENVENUE · ${playerName.toUpperCase()}`;
  setScreen(ui.home);
});

ui.play.addEventListener("click", () => void startAutoMatchmaking());

ui.createPrivate.addEventListener("click", () => {
  const code = randomCode();
  ui.roomCode.value = code;
  void joinRoom(code, true);
});

ui.joinPrivate.addEventListener("click", () => {
  const code = sanitizeCode(ui.roomCode.value);
  if (code.length !== 6) {
    ui.roomCode.focus();
    return;
  }
  void joinRoom(code, true);
});

ui.roomCode.addEventListener("input", () => {
  ui.roomCode.value = sanitizeCode(ui.roomCode.value);
});

ui.cancelQueue.addEventListener("click", async () => {
  await cleanupQueue();
  await cleanupRoom(false);
  setScreen(ui.home);
});

ui.training.addEventListener("click", () => {
  training = true;
  currentMapIndex = (currentMapIndex + 1) % MAPS.length;
  opponentName = "BOT CIBLE";
  opponentId = "bot";
  spawnIndex = 0;
  startMatch();
});

ui.replay.addEventListener("click", () => {
  ui.result.classList.remove("active");
  if (training) {
    currentMapIndex = (currentMapIndex + 1) % MAPS.length;
    startMatch();
  } else {
    void startAutoMatchmaking();
  }
});

ui.menu.addEventListener("click", () => void leaveGameToMenu(true));

document.addEventListener("keydown", (event) => {
  keys[event.code] = true;
  if (event.code === "KeyR") reload();
  if (event.code === "Space" && inGame && alive && onGround) {
    verticalVelocity = JUMP_SPEED;
    onGround = false;
  }
});

document.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

document.addEventListener("mousedown", (event) => {
  if (!inGame || isTouch) return;
  if (!controls.isLocked) {
    controls.lock();
    return;
  }
  if (event.button === 0) shoot();
});

controls.addEventListener("lock", () => {
  ui.gameMessage.textContent = "";
});

controls.addEventListener("unlock", () => {
  if (inGame && !isTouch) ui.gameMessage.textContent = "Clique pour reprendre";
});

function bindStick(element, knob, output, sensitivity = 1) {
  let activePointer = null;
  let rect = null;

  function update(event) {
    if (event.pointerId !== activePointer || !rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width * 0.34;
    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;
    const length = Math.hypot(dx, dy);

    if (length > radius) {
      dx = (dx / length) * radius;
      dy = (dy / length) * radius;
    }

    output.x = (dx / radius) * sensitivity;
    output.y = (dy / radius) * sensitivity;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  function release(event) {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    rect = null;
    output.x = 0;
    output.y = 0;
    knob.style.transform = "translate(-50%, -50%)";
  }

  element.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    activePointer = event.pointerId;
    rect = element.getBoundingClientRect();
    element.setPointerCapture?.(event.pointerId);
    update(event);
  });
  element.addEventListener("pointermove", (event) => {
    event.preventDefault();
    update(event);
  });
  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
}

bindStick(ui.moveStick, ui.moveKnob, mobileMove);
bindStick(ui.lookStick, ui.lookKnob, mobileLook);

function mobileJump() {
  if (!inGame || !alive || !onGround) return;
  verticalVelocity = JUMP_SPEED;
  onGround = false;
}

ui.mobileJump.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  mobileJump();
});

ui.mobileReload.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  reload();
});

ui.mobileFire.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  shoot();
  clearInterval(mobileFireTimer);
  mobileFireTimer = setInterval(shoot, 125);
});

for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
  ui.mobileFire.addEventListener(eventName, () => {
    clearInterval(mobileFireTimer);
    mobileFireTimer = null;
  });
}

function clearMap() {
  for (const object of mapObjects) scene.remove(object);
  mapObjects.length = 0;
  obstacleMeshes.length = 0;
  colliders.length = 0;
}

function addBox(x, y, z, w, h, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color,
      roughness: .78,
      metalness: .08,
      emissive: new THREE.Color(color).multiplyScalar(.14),
      emissiveIntensity: .55
    })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  mapObjects.push(mesh);
  obstacleMeshes.push(mesh);
  colliders.push({ minX:x-w/2, maxX:x+w/2, minZ:z-d/2, maxZ:z+d/2 });
}

function buildMap(index) {
  clearMap();
  const map = MAPS[index];
  const skyColor = new THREE.Color(map.sky).offsetHSL(0, 0, .11);
  const fogColor = new THREE.Color(map.fog).offsetHSL(0, 0, .08);
  scene.background.copy(skyColor);
  scene.fog.color.copy(fogColor);
  scene.fog.near = 42;
  scene.fog.far = 105;

  const floorColor = new THREE.Color(map.floor).offsetHSL(0, 0, .08);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 46),
    new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness: .9,
      metalness: .03
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  mapObjects.push(floor);

  const grid = new THREE.GridHelper(
    46,
    23,
    new THREE.Color(map.accent).offsetHSL(0, 0, .28),
    0x7d8793
  );
  grid.position.y = .012;
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  gridMaterials.forEach((material) => {
    material.transparent = true;
    material.opacity = .24;
  });
  scene.add(grid);
  mapObjects.push(grid);

  const centerMarker = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 2.34, 48),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(map.accent).offsetHSL(0, 0, .35),
      transparent: true,
      opacity: .46,
      side: THREE.DoubleSide
    })
  );
  centerMarker.rotation.x = -Math.PI / 2;
  centerMarker.position.y = .022;
  scene.add(centerMarker);
  mapObjects.push(centerMarker);

  for (const box of map.boxes) addBox(...box, map.accent);

  const wallColor = new THREE.Color(map.accent).multiplyScalar(.55).getHex();
  addBox(0,2,-23,46,4,1,wallColor);
  addBox(0,2,23,46,4,1,wallColor);
  addBox(-23,2,0,1,4,46,wallColor);
  addBox(23,2,0,1,4,46,wallColor);

  if ([2,5].includes(index)) {
    for (let i = -2; i <= 2; i++) {
      const light = new THREE.PointLight(index === 2 ? 0x805cff : 0xff6b31, 8, 14, 2);
      light.position.set(i * 8, 3.5, i % 2 ? 7 : -7);
      scene.add(light);
      mapObjects.push(light);
    }
  }

  ui.mapName.textContent = map.name;
}

function createOpponent() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(.75,1.05,.45),
    new THREE.MeshStandardMaterial({ color:0xe2463b, roughness:.65 })
  );
  body.position.y = 1.05;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(.27,18,14),
    new THREE.MeshStandardMaterial({ color:0xd4a48e, roughness:.75 })
  );
  head.position.y = 1.78;

  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(.6,.75,.38),
    new THREE.MeshStandardMaterial({ color:0x252933, roughness:.85 })
  );
  legs.position.y = .4;

  [body, head, legs].forEach((mesh) => {
    mesh.castShadow = true;
    mesh.userData.isOpponent = true;
    group.add(mesh);
  });

  scene.add(group);
  return group;
}

const opponent = createOpponent();
opponent.visible = false;

function createWeapon() {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({
    color:0x3b424d,
    roughness:.32,
    metalness:.62
  });
  const accent = new THREE.MeshStandardMaterial({
    color:0xff5b4d,
    roughness:.34,
    metalness:.46,
    emissive:0x4b0d09,
    emissiveIntensity:.7
  });
  const lightMetal = new THREE.MeshStandardMaterial({
    color:0x8d98a8,
    roughness:.28,
    metalness:.72
  });

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(.23,.19,.72), dark);
  receiver.position.set(.31,-.24,-.68);
  group.add(receiver);

  const handguard = new THREE.Mesh(new THREE.BoxGeometry(.17,.14,.5), accent);
  handguard.position.set(.31,-.21,-1.17);
  group.add(handguard);

  const barrel = new THREE.Mesh(new THREE.BoxGeometry(.075,.075,.48), lightMetal);
  barrel.position.set(.31,-.19,-1.62);
  group.add(barrel);

  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(.11,.11,.16), dark);
  muzzle.position.set(.31,-.19,-1.92);
  group.add(muzzle);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(.12,.28,.14), dark);
  grip.position.set(.31,-.39,-.62);
  grip.rotation.x = -.27;
  group.add(grip);

  const sight = new THREE.Mesh(new THREE.BoxGeometry(.07,.08,.15), accent);
  sight.position.set(.31,-.10,-.76);
  group.add(sight);

  camera.add(group);
  group.position.set(.11,.015,0);
  group.scale.setScalar(isTouch ? 1.08 : 1);
  return group;
}

const weapon = createWeapon();
weapon.visible = false;

function resetOpponentToSpawn(index) {
  const spawn = MAPS[currentMapIndex].spawns[index];
  opponent.position.set(spawn[0], 0, spawn[2]);
  opponent.rotation.y = index === 0 ? Math.PI : 0;
  opponent.visible = true;
}

function respawn(index = spawnIndex) {
  const spawn = MAPS[currentMapIndex].spawns[index];
  camera.position.set(spawn[0], spawn[1], spawn[2]);
  camera.rotation.set(0, index === 0 ? 0 : Math.PI, 0);
  verticalVelocity = 0;
  onGround = true;
  health = 100;
  alive = true;
  ammo = 30;
  reloading = false;
  updateHud();
}

function startMatch() {
  setScreen(null);
  ui.result.classList.remove("active");
  ui.hud.classList.add("active");
  inGame = true;
  health = 100;
  alive = true;
  ammo = 30;
  scoreYou = 0;
  scoreEnemy = 0;

  buildMap(currentMapIndex);
  resetOpponentToSpawn(1 - spawnIndex);
  respawn(spawnIndex);

  ui.enemyName.textContent = opponentName.toUpperCase();
  weapon.visible = true;
  updateHud();
  if (isTouch) {
    ui.mobileControls.classList.add("active");
    ui.gameMessage.textContent = "";
  } else {
    setTimeout(() => controls.lock(), 120);
  }
}

async function leaveGameToMenu(sendLeave = true) {
  inGame = false;
  training = false;
  controls.unlock();
  ui.mobileControls.classList.remove("active");
  clearInterval(mobileFireTimer);
  mobileFireTimer = null;
  ui.hud.classList.remove("active");
  ui.result.classList.remove("active");
  weapon.visible = false;
  opponent.visible = false;
  await cleanupQueue();
  await cleanupRoom(sendLeave);
  setScreen(ui.home);
}

function finishMatch(won) {
  inGame = false;
  controls.unlock();
  ui.mobileControls.classList.remove("active");
  clearInterval(mobileFireTimer);
  mobileFireTimer = null;
  ui.hud.classList.remove("active");
  weapon.visible = false;
  ui.resultTitle.textContent = won ? "VICTOIRE" : "DÉFAITE";
  ui.resultTitle.style.color = won ? "#61e294" : "#ff6257";
  ui.resultScore.textContent = `${scoreYou} — ${scoreEnemy}`;
  ui.result.classList.add("active");
}

function updateHud() {
  ui.scoreYou.textContent = scoreYou;
  ui.scoreEnemy.textContent = scoreEnemy;
  ui.health.textContent = health;
  ui.healthBar.style.width = `${health}%`;
  ui.ammo.textContent = reloading ? "—" : ammo;
}

function showHitMarker() {
  ui.hitMarker.classList.add("show");
  setTimeout(() => ui.hitMarker.classList.remove("show"), 90);
}

function showKillMessage(text) {
  ui.killMessage.textContent = text;
  ui.killMessage.classList.add("show");
  setTimeout(() => ui.killMessage.classList.remove("show"), 850);
}

function reload() {
  if (!inGame || !alive || reloading || ammo === 30) return;
  reloading = true;
  updateHud();
  ui.gameMessage.textContent = "RECHARGEMENT…";
  setTimeout(() => {
    ammo = 30;
    reloading = false;
    updateHud();
    ui.gameMessage.textContent = controls.isLocked ? "" : "Clique pour reprendre";
  }, 1100);
}

async function sendRoom(event, payload) {
  if (!roomChannel) return;
  await roomChannel.send({ type:"broadcast", event, payload });
}

function shoot() {
  const now = performance.now();
  if (!inGame || !alive || now - lastShotAt < 120 || reloading || ammo <= 0) {
    if (ammo <= 0) reload();
    return;
  }

  lastShotAt = now;
  ammo -= 1;
  updateHud();

  weapon.rotation.x = .08;
  setTimeout(() => (weapon.rotation.x = 0), 70);

  raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
  const targets = [...obstacleMeshes];

  if (opponent.visible) {
    opponent.traverse((child) => {
      if (child.isMesh) targets.push(child);
    });
  }

  const first = raycaster.intersectObjects(targets, false)[0];

  if (first?.object?.userData?.isOpponent) {
    showHitMarker();

    if (training) {
      scoreYou += 1;
      showKillMessage("TOUCHÉ +1");
      updateHud();
      resetOpponentToSpawn(1);
    } else {
      void sendRoom("hit", {
        targetId: opponentId,
        shooterId: clientId,
        at: Date.now()
      });
    }
  }

  if (ammo === 0) setTimeout(reload, 160);
}

function receiveHit(payload) {
  if (!inGame || training || !alive) return;

  health = Math.max(0, health - 25);
  updateHud();

  if (health > 0) return;

  alive = false;
  const death = {
    killerId: payload.shooterId,
    victimId: clientId,
    id: `${clientId}-${Date.now()}`
  };

  handleDeath(death);
  void sendRoom("death", death);
}

function handleDeath(payload) {
  if (!payload?.killerId || !payload?.victimId) return;

  if (payload.killerId === clientId) {
    scoreYou += 1;
    showKillMessage("ÉLIMINATION +1");
  } else {
    scoreEnemy += 1;
    if (payload.victimId === clientId) showKillMessage("ÉLIMINÉ");
  }

  updateHud();

  if (payload.victimId === opponentId) opponent.visible = false;

  if (scoreYou >= TARGET_SCORE || scoreEnemy >= TARGET_SCORE) {
    finishMatch(scoreYou >= TARGET_SCORE);
    return;
  }

  if (payload.victimId === clientId) {
    setTimeout(() => {
      if (!roomChannel || !roomReady) return;
      respawn(spawnIndex);
      void sendRoom("respawn", { playerId: clientId });
    }, 1200);
  }
}

function canMoveTo(x, z) {
  if (Math.abs(x) > 21.8 || Math.abs(z) > 21.8) return false;

  for (const box of colliders) {
    if (
      x + PLAYER_RADIUS > box.minX &&
      x - PLAYER_RADIUS < box.maxX &&
      z + PLAYER_RADIUS > box.minZ &&
      z - PLAYER_RADIUS < box.maxZ
    ) return false;
  }
  return true;
}

function updateMovement(delta) {
  if (!inGame || !alive || (!isTouch && !controls.isLocked)) return;

  const keyboardForward =
    Number(keys.KeyW || keys.KeyZ || keys.ArrowUp) -
    Number(keys.KeyS || keys.ArrowDown);
  const keyboardRight =
    Number(keys.KeyD || keys.ArrowRight) -
    Number(keys.KeyA || keys.KeyQ || keys.ArrowLeft);

  const forward = THREE.MathUtils.clamp(
    keyboardForward + (isTouch ? -mobileMove.y : 0),
    -1,
    1
  );
  const right = THREE.MathUtils.clamp(
    keyboardRight + (isTouch ? mobileMove.x : 0),
    -1,
    1
  );
  const moving = Math.abs(forward) > 0.04 || Math.abs(right) > 0.04;

  if (isTouch) {
    camera.rotation.order = "YXZ";
    camera.rotation.y -= mobileLook.x * 1.9 * delta;
    camera.rotation.x -= mobileLook.y * 1.55 * delta;
    camera.rotation.x = THREE.MathUtils.clamp(
      camera.rotation.x,
      -Math.PI / 2 + 0.06,
      Math.PI / 2 - 0.06
    );
  }

  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  direction.y = 0;
  direction.normalize();

  const side = new THREE.Vector3().crossVectors(direction, camera.up).normalize();
  const move = new THREE.Vector3();
  move.addScaledVector(direction, forward);
  move.addScaledVector(side, right);
  if (move.lengthSq() > 0) move.normalize();

  const mobileMagnitude = Math.min(1, Math.hypot(mobileMove.x, mobileMove.y));
  const speed =
    keys.ShiftLeft || keys.ShiftRight || (isTouch && mobileMagnitude > 0.86)
      ? SPRINT_SPEED
      : SPEED;
  const current = camera.position.clone();
  const nextX = current.x + move.x * speed * delta;
  const nextZ = current.z + move.z * speed * delta;

  if (canMoveTo(nextX, current.z)) camera.position.x = nextX;
  if (canMoveTo(camera.position.x, nextZ)) camera.position.z = nextZ;

  verticalVelocity -= GRAVITY * delta;
  camera.position.y += verticalVelocity * delta;

  if (camera.position.y <= PLAYER_HEIGHT) {
    camera.position.y = PLAYER_HEIGHT;
    verticalVelocity = 0;
    onGround = true;
  }

  weapon.position.y = -.05 + (moving ? Math.sin(performance.now() * .012) * .012 : 0);
  weapon.position.x = .12 + (moving ? Math.cos(performance.now() * .009) * .008 : 0);

  if (training && opponent.visible) {
    const t = performance.now() * .00045;
    opponent.position.x = Math.sin(t) * 8;
    opponent.position.z = -9 + Math.cos(t * 1.3) * 4;
    opponent.rotation.y = Math.atan2(
      camera.position.x - opponent.position.x,
      camera.position.z - opponent.position.z
    );
  }

  if (!training && roomChannel && performance.now() - lastStateSend > STATE_INTERVAL) {
    lastStateSend = performance.now();
    void sendRoom("state", {
      playerId: clientId,
      position: [camera.position.x, camera.position.y, camera.position.z],
      yaw: camera.rotation.y,
      pitch: camera.rotation.x,
      moving
    });
  }
}

function updateOpponent(message) {
  if (!inGame || training || !Array.isArray(message.position)) return;
  const [x, y, z] = message.position;
  opponent.position.lerp(new THREE.Vector3(x, Math.max(0, y - 1.7), z), .55);
  opponent.rotation.y = message.yaw || 0;
  opponent.visible = true;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .05);
  updateMovement(delta);
  renderer.render(scene, camera);
}

animate();

addEventListener("beforeunload", () => {
  if (roomChannel) {
    roomChannel.send({
      type:"broadcast",
      event:"leave",
      payload:{ playerId:clientId }
    });
  }
});

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
