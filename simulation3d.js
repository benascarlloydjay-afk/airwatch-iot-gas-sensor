import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.getElementById("sensor-canvas");
const sceneView = document.getElementById("scene-view");
const sceneMessage = document.getElementById("scene-message");
const temperatureOutput = document.getElementById("scene-temperature");
const humidityOutput = document.getElementById("scene-humidity");
const gasOutput = document.getElementById("scene-gas");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeaf2ec);
scene.fog = new THREE.Fog(0xeaf2ec, 16, 30);

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
camera.position.set(6, 5.2, 7.4);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (error) {
  sceneMessage.textContent =
    "3D preview is unavailable in this browser. The dashboard controls still work.";
  console.error("Unable to create the 3D sensor view:", error);
}

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(sceneView.clientWidth, sceneView.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.72, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = false;
  controls.enablePan = true;
  controls.minDistance = 4.5;
  controls.maxDistance = 24;
  controls.minPolarAngle = 0.05;
  controls.maxPolarAngle = Math.PI - 0.05;
  controls.update();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x87978b, 2.1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(-4, 8, 6);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xbce8d0, 1.7);
  fillLight.position.set(5, 4, -5);
  scene.add(fillLight);

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5f8f5,
    roughness: 0.92,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.13;
  scene.add(floor);

  const grid = new THREE.GridHelper(14, 28, 0xb9cfc0, 0xd5e2d8);
  grid.position.y = -0.125;
  grid.material.transparent = true;
  grid.material.opacity = 0.48;
  scene.add(grid);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(4.05, 4.15, 0.12, 64),
    new THREE.MeshStandardMaterial({ color: 0xe2ebe4, roughness: 0.7 }),
  );
  platform.position.y = -0.015;
  scene.add(platform);

  const board = new THREE.Group();
  scene.add(board);

  const boardMaterial = new THREE.MeshStandardMaterial({
    color: 0x0876b9,
    roughness: 0.64,
    metalness: 0.08,
  });
  const traceMaterial = new THREE.MeshStandardMaterial({
    color: 0x65b8d7,
    roughness: 0.46,
  });
  const silkMaterial = new THREE.MeshStandardMaterial({
    color: 0xdcecf3,
    roughness: 0.72,
  });
  const socketMaterial = new THREE.MeshStandardMaterial({
    color: 0x111b22,
    roughness: 0.5,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x17202a,
    roughness: 0.52,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0xb7c4c0,
    metalness: 0.7,
    roughness: 0.32,
  });
  const goldMaterial = new THREE.MeshStandardMaterial({
    color: 0xd3a653,
    metalness: 0.62,
    roughness: 0.3,
  });
  const paleMaterial = new THREE.MeshStandardMaterial({
    color: 0xf1f5f3,
    roughness: 0.52,
  });
  const redMaterial = new THREE.MeshStandardMaterial({
    color: 0xb93632,
    roughness: 0.42,
  });
  const capacitorMaterial = new THREE.MeshStandardMaterial({
    color: 0x263b32,
    roughness: 0.38,
  });

  function addBox(parent, material, size, position) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }

  function addCylinder(parent, material, radius, height, position, sides = 20) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, sides),
      material,
    );
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }

  addBox(board, boardMaterial, [3.55, 0.16, 2.5], [0, 0.2, 0]);

  // USB-B port and DC barrel jack at the edge of the Uno board.
  addBox(board, metalMaterial, [0.52, 0.4, 0.66], [-1.82, 0.39, -0.52]);
  addBox(board, metalMaterial, [0.48, 0.32, 0.52], [-1.82, 0.4, -0.52]);
  addBox(board, darkMaterial, [0.025, 0.18, 0.38], [-2.085, 0.41, -0.52]);
  addBox(board, socketMaterial, [0.39, 0.34, 0.43], [1.82, 0.37, -0.52]);
  const powerJack = addCylinder(
    board,
    darkMaterial,
    0.2,
    0.3,
    [1.88, 0.41, -0.52],
    24,
  );
  powerJack.rotation.z = Math.PI / 2;
  const jackRing = addCylinder(
    board,
    metalMaterial,
    0.135,
    0.035,
    [2.04, 0.41, -0.52],
    24,
  );
  jackRing.rotation.z = Math.PI / 2;

  // Main ATmega328P DIP, its two rows of leads, and the programming IC.
  addBox(board, socketMaterial, [1.0, 0.2, 0.54], [0.02, 0.38, -0.03]);
  addBox(board, darkMaterial, [0.92, 0.14, 0.48], [0.02, 0.49, -0.03]);
  const chipNotch = addCylinder(
    board,
    socketMaterial,
    0.09,
    0.018,
    [-0.43, 0.565, -0.03],
    20,
  );
  chipNotch.rotation.x = Math.PI / 2;
  for (let index = 0; index < 14; index += 1) {
    const x = -0.4 + index * 0.065;
    for (const z of [-0.32, 0.26]) {
      addBox(board, metalMaterial, [0.035, 0.035, 0.13], [x, 0.35, z]);
    }
  }
  addBox(board, darkMaterial, [0.44, 0.14, 0.34], [-1.02, 0.35, -0.37]);
  addBox(board, darkMaterial, [0.4, 0.12, 0.28], [0.88, 0.34, 0.45]);

  // Reset switch, crystal, capacitors, and small through-hole parts.
  addBox(board, redMaterial, [0.2, 0.14, 0.2], [-1.25, 0.36, -0.2]);
  addBox(board, metalMaterial, [0.12, 0.045, 0.12], [-1.25, 0.45, -0.2]);
  const crystal = addCylinder(
    board,
    metalMaterial,
    0.075,
    0.36,
    [-0.83, 0.34, 0.12],
    16,
  );
  crystal.rotation.z = Math.PI / 2;
  for (const [x, z] of [
    [-1.42, 0.36],
    [-1.18, 0.38],
    [1.38, 0.4],
  ]) {
    addCylinder(board, capacitorMaterial, 0.105, 0.24, [x, 0.37, z], 20);
    addCylinder(board, metalMaterial, 0.11, 0.035, [x, 0.5, z], 20);
  }

  // Pale circuit traces and silkscreen outlines on the blue solder mask.
  function addBoardLine(points, material, radius = 0.012) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((point) => new THREE.Vector3(...point)),
    );
    const line = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, radius, 6, false),
      material,
    );
    board.add(line);
  }
  addBoardLine(
    [
      [-1.35, 0.286, -0.68],
      [-1.12, 0.287, -0.54],
      [-0.68, 0.287, -0.48],
      [-0.48, 0.287, -0.28],
    ],
    traceMaterial,
  );
  for (let mark = 0; mark < 5; mark += 1) {
    addBox(
      board,
      silkMaterial,
      [0.1 + (mark % 2) * 0.035, 0.012, 0.018],
      [-1.28 + mark * 0.14, 0.29, 0.72],
    );
  }
  for (let mark = 0; mark < 4; mark += 1) {
    addBox(
      board,
      silkMaterial,
      [0.13, 0.012, 0.018],
      [0.82 + mark * 0.15, 0.29, -0.7],
    );
  }
  addBoardLine(
    [
      [0.6, 0.286, 0.06],
      [0.9, 0.287, 0.08],
      [1.18, 0.287, 0.3],
      [1.42, 0.287, 0.3],
    ],
    traceMaterial,
  );
  addBoardLine(
    [
      [0.52, 0.286, -0.28],
      [0.82, 0.287, -0.44],
      [1.12, 0.287, -0.44],
      [1.38, 0.287, -0.28],
    ],
    traceMaterial,
  );

  for (const [x, z] of [
    [-1.48, -0.96],
    [1.48, -0.96],
    [-1.48, 0.96],
    [1.48, 0.96],
  ]) {
    addCylinder(board, goldMaterial, 0.105, 0.025, [x, 0.293, z], 28);
    addCylinder(board, darkMaterial, 0.065, 0.028, [x, 0.306, z], 28);
  }

  const ledMaterials = {
    temperature: new THREE.MeshStandardMaterial({
      color: 0x42bd82,
      emissive: 0x16834c,
      emissiveIntensity: 1.3,
      roughness: 0.28,
    }),
    gas: new THREE.MeshStandardMaterial({
      color: 0x42bd82,
      emissive: 0x16834c,
      emissiveIntensity: 1.3,
      roughness: 0.28,
    }),
  };
  const statusLedMaterials = [
    0x49bd82,
    0xe1cb49,
    0xe89a42,
    0xe35b52,
  ].map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.08,
        roughness: 0.25,
      }),
  );
  const statusLedLenses = [];
  addCylinder(board, goldMaterial, 0.065, 0.1, [-1.25, 0.29, -0.86], 12);
  addCylinder(board, goldMaterial, 0.065, 0.1, [-1.05, 0.29, -0.86], 12);
  const temperatureLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 16, 12),
    ledMaterials.temperature,
  );
  temperatureLed.position.set(0.25, 0.32, 0.78);
  board.add(temperatureLed);
  const gasLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 16, 12),
    ledMaterials.gas,
  );
  gasLed.position.set(0.5, 0.32, 0.78);
  board.add(gasLed);

  for (const z of [-1.03, 1.03]) {
    addBox(board, socketMaterial, [2.45, 0.13, 0.17], [0, 0.31, z]);
    for (let index = 0; index < 12; index += 1) {
      const x = -1.08 + index * 0.196;
      addBox(board, goldMaterial, [0.075, 0.045, 0.1], [x, 0.4, z]);
    }
  }

  const dht = new THREE.Group();
  dht.position.set(-3.25, 0.56, -0.05);
  scene.add(dht);
  const dhtShellMaterial = new THREE.MeshStandardMaterial({
    color: 0xf1f5f3,
    roughness: 0.52,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  addBox(dht, boardMaterial, [0.88, 0.09, 0.7], [0, 0.04, -0.01]);
  addBox(dht, darkMaterial, [0.2, 0.07, 0.17], [0.29, 0.11, -0.15]);
  addBox(dht, redMaterial, [0.12, 0.045, 0.12], [-0.28, 0.11, -0.15]);
  addBox(dht, dhtShellMaterial, [0.72, 0.82, 0.34], [0, 0.45, 0]);
  addBox(
    dht,
    new THREE.MeshStandardMaterial({ color: 0xdce7df }),
    [0.48, 0.45, 0.035],
    [0, 0.45, 0.19],
  );
  for (let index = 0; index < 5; index += 1) {
    addBox(
      dht,
      new THREE.MeshStandardMaterial({ color: 0x9cad9f }),
      [0.035, 0.35, 0.035],
      [-0.16 + index * 0.08, 0.45, 0.215],
    );
  }
  for (let index = 0; index < 4; index += 1) {
    addCylinder(
      dht,
      goldMaterial,
      0.035,
      0.13,
      [-0.22 + index * 0.145, 0, 0],
      10,
    );
  }
  for (let index = 0; index < 3; index += 1) {
    addCylinder(
      dht,
      goldMaterial,
      0.027,
      0.3,
      [-0.24 + index * 0.24, -0.17, -0.28],
      10,
    );
  }

  const mq2 = new THREE.Group();
  mq2.position.set(3.25, 0.38, -0.05);
  scene.add(mq2);
  addBox(mq2, darkMaterial, [1.02, 0.18, 0.94], [0, 0.02, 0]);
  addBox(mq2, boardMaterial, [0.98, 0.1, 0.9], [0, 0.14, 0]);
  addBox(mq2, darkMaterial, [0.2, 0.1, 0.18], [-0.34, 0.26, 0.28]);
  addBox(mq2, capacitorMaterial, [0.1, 0.12, 0.1], [-0.36, 0.27, -0.27]);
  addBox(mq2, redMaterial, [0.09, 0.07, 0.08], [-0.16, 0.24, 0.32]);
  const trimmer = addBox(
    mq2,
    new THREE.MeshStandardMaterial({ color: 0x1578bb, roughness: 0.5 }),
    [0.23, 0.14, 0.2],
    [0.34, 0.28, 0.27],
  );
  trimmer.rotation.y = -0.12;
  addCylinder(mq2, metalMaterial, 0.055, 0.035, [0.34, 0.37, 0.27], 16);
  addCylinder(mq2, darkMaterial, 0.018, 0.038, [0.34, 0.39, 0.27], 8);
  addCylinder(mq2, goldMaterial, 0.025, 0.28, [-0.3, -0.02, 0.4], 10);
  addCylinder(mq2, goldMaterial, 0.025, 0.28, [-0.1, -0.02, 0.4], 10);
  addCylinder(mq2, goldMaterial, 0.025, 0.28, [0.1, -0.02, 0.4], 10);
  addCylinder(mq2, goldMaterial, 0.025, 0.28, [0.3, -0.02, 0.4], 10);

  const canCenter = new THREE.Vector3(-0.06, 0.62, -0.1);
  addCylinder(mq2, darkMaterial, 0.36, 0.12, [-0.06, 0.27, -0.1]);
  addCylinder(mq2, metalMaterial, 0.34, 0.73, canCenter.toArray(), 32);
  addCylinder(mq2, darkMaterial, 0.3, 0.16, [-0.06, 1.06, -0.1], 32);
  addCylinder(mq2, metalMaterial, 0.19, 0.11, [-0.06, 1.2, -0.1], 24);
  const grilleMaterial = new THREE.MeshStandardMaterial({
    color: 0x7f8f8c,
    metalness: 0.76,
    roughness: 0.3,
  });
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const grille = addCylinder(
      mq2,
      grilleMaterial,
      0.022,
      0.56,
      [-0.06 + Math.cos(angle) * 0.31, 0.63, -0.1 + Math.sin(angle) * 0.31],
      8,
    );
    grille.rotation.z = Math.cos(angle) * 0.12;
    grille.rotation.x = Math.sin(angle) * 0.12;
  }
  for (const height of [0.36, 0.48, 0.6, 0.72, 0.84, 0.94]) {
    const meshRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.322, 0.014, 6, 32),
      grilleMaterial,
    );
    meshRing.rotation.x = Math.PI / 2;
    meshRing.position.set(-0.06, height, -0.1);
    mq2.add(meshRing);
  }

  function addWire(points, color) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((point) => new THREE.Vector3(...point)),
    );
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.32,
      metalness: 0.08,
    });
    const wire = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 32, 0.032, 8, false),
      material,
    );
    scene.add(wire);
    [points[0], points.at(-1)].forEach((point) => {
      const connector = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 10, 8),
        material,
      );
      connector.position.set(...point);
      scene.add(connector);
    });
  }

  // DHT22: power, data (D2), and ground. Each jumper ends at a visible pin.
  addWire(
    [
      [-3.47, 0.39, -0.33],
      [-3.47, 0.52, 1.48],
      [-1.08, 0.52, 1.48],
      [-1.08, 0.4, 1.03],
    ],
    0xd9554d,
  );
  addWire(
    [
      [-3.325, 0.39, -0.33],
      [-3.325, 0.62, 1.68],
      [-0.884, 0.62, 1.68],
      [-0.884, 0.4, 1.03],
    ],
    0xf0c84b,
  );
  addWire(
    [
      [-3.035, 0.39, -0.33],
      [-3.035, 0.72, 1.88],
      [-0.688, 0.72, 1.88],
      [-0.688, 0.4, 1.03],
    ],
    0x242b29,
  );

  // MQ-2: 5V, ground, and analog output. These route behind the Uno.
  addWire(
    [
      [2.95, 0.36, 0.35],
      [2.95, 0.56, -1.62],
      [0.49, 0.56, -1.62],
      [0.49, 0.4, -1.03],
    ],
    0xd9554d,
  );
  addWire(
    [
      [3.15, 0.36, 0.35],
      [3.15, 0.66, -1.82],
      [0.688, 0.66, -1.82],
      [0.688, 0.4, -1.03],
    ],
    0x242b29,
  );
  addWire(
    [
      [3.55, 0.36, 0.35],
      [3.55, 0.76, -2.02],
      [0.884, 0.76, -2.02],
      [0.884, 0.4, -1.03],
    ],
    0x3e9c6d,
  );

  // I2C LCD module spaced in front of the Arduino with four exposed terminals.
  const lcdModule = new THREE.Group();
  lcdModule.position.set(-1.2, 0.28, 2.55);
  scene.add(lcdModule);
  addBox(lcdModule, boardMaterial, [1.9, 0.1, 0.68], [0, 0.04, 0]);
  const lcdPins = [-0.36, -0.12, 0.12, 0.36];
  lcdPins.forEach((x) =>
    addCylinder(lcdModule, goldMaterial, 0.027, 0.2, [x, -0.08, -0.27], 10),
  );
  addBox(lcdModule, darkMaterial, [1.82, 0.68, 0.12], [0, 0.52, 0.24]);
  addBox(lcdModule, metalMaterial, [1.66, 0.54, 0.035], [0, 0.52, 0.32]);

  const lcdCanvas = document.createElement("canvas");
  lcdCanvas.width = 640;
  lcdCanvas.height = 180;
  const lcdContext = lcdCanvas.getContext("2d");
  const lcdTexture = new THREE.CanvasTexture(lcdCanvas);
  lcdTexture.colorSpace = THREE.SRGBColorSpace;
  const lcdScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.48, 0.32),
    new THREE.MeshBasicMaterial({ map: lcdTexture }),
  );
  lcdScreen.position.set(0, 0.52, 0.342);
  lcdModule.add(lcdScreen);

  function updateLcd(temperature, humidity, gasPpm) {
    lcdContext.fillStyle = "#102b20";
    lcdContext.fillRect(0, 0, lcdCanvas.width, lcdCanvas.height);
    lcdContext.fillStyle = "#a6ffbd";
    lcdContext.font = "46px monospace";
    lcdContext.textBaseline = "middle";
    lcdContext.fillText(`H:${humidity.toFixed(3)}%`, 14, 48);
    lcdContext.fillText(
      `T:${temperature.toFixed(1)}C G:${gasPpm}`,
      14,
      132,
    );
    lcdTexture.needsUpdate = true;
  }

  // Four threshold LEDs on their own board, separated from the LCD module.
  const indicatorBoard = new THREE.Group();
  indicatorBoard.position.set(1.35, 0.26, 2.55);
  scene.add(indicatorBoard);
  addBox(indicatorBoard, boardMaterial, [1.35, 0.09, 0.68], [0, 0.03, 0]);
  const indicatorOffsets = [-0.48, -0.16, 0.16, 0.48];
  indicatorOffsets.forEach((x, index) => {
    addCylinder(indicatorBoard, darkMaterial, 0.09, 0.08, [x, 0.11, 0.12]);
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 16, 12),
      statusLedMaterials[index],
    );
    lens.position.set(x, 0.18, 0.12);
    indicatorBoard.add(lens);
    statusLedLenses.push(lens);

    const resistor = addCylinder(
      indicatorBoard,
      paleMaterial,
      0.035,
      0.18,
      [x, 0.12, -0.16],
      12,
    );
    resistor.rotation.x = Math.PI / 2;
  });

  const indicatorPins = [-0.48, -0.16, 0.16, 0.48];
  const indicatorColors = [0x49bd82, 0xe1cb49, 0xe89a42, 0xe35b52];
  indicatorPins.forEach((offset, index) => {
    const startX = [-0.1, 0.1, 0.296, 0.492][index];
    const endX = indicatorBoard.position.x + offset;
    addWire(
      [
        [startX, 0.4, 1.03],
        [startX, 0.72, 1.42 + index * 0.08],
        [endX, 0.72, 1.9 + index * 0.08],
        [endX, 0.38, 2.39],
      ],
      indicatorColors[index],
    );
  });

  // I2C LCD: four separate color-coded jumpers from the Uno's header row.
  const lcdColors = [0xd9554d, 0x242b29, 0xf0c84b, 0xe89a42];
  const lcdBoardPins = [-1.08, -0.884, -0.688, -0.492];
  lcdPins.forEach((pinX, index) => {
    const lcdX = lcdModule.position.x + pinX;
    const boardX = lcdBoardPins[index];
    addWire(
      [
        [lcdX, 0.2, 2.28],
        [lcdX, 0.88, 1.98 + index * 0.08],
        [boardX, 0.88, 1.48 + index * 0.08],
        [boardX, 0.4, 1.03],
      ],
      lcdColors[index],
    );
  });

  function addComponentLabel(text, position, color) {
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 512;
    labelCanvas.height = 96;
    const context = labelCanvas.getContext("2d");
    context.fillStyle = "rgba(255, 255, 255, 0.94)";
    context.strokeStyle = `#${color.toString(16).padStart(6, "0")}`;
    context.lineWidth = 5;
    context.beginPath();
    context.roundRect(3, 3, 506, 90, 22);
    context.fill();
    context.stroke();
    context.fillStyle = "#172b27";
    context.font = "700 38px Inter, Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 256, 49);

    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true }),
    );
    label.position.set(...position);
    label.scale.set(1.45, 0.28, 1);
    scene.add(label);
  }

  addComponentLabel("DHT22 · TEMP / HUMIDITY", [-3.25, 1.5, -0.05], 0x438fc5);
  addComponentLabel("MQ-2 · GAS", [3.25, 1.95, -0.05], 0x45a67d);
  addComponentLabel("I2C LCD", [-1.2, 1.5, 2.55], 0x438fc5);
  addComponentLabel("GAS LEVEL LEDs", [1.35, 0.92, 2.55], 0xdf9852);

  const particleMaterial = new THREE.MeshBasicMaterial({
    color: 0x66bb8b,
    transparent: true,
    opacity: 0.28,
  });
  const particles = [];
  for (let index = 0; index < 15; index += 1) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.045 + (index % 3) * 0.012, 10, 8),
      particleMaterial,
    );
    particle.userData = {
      angle: (index / 15) * Math.PI * 2,
      radius: 0.48 + (index % 4) * 0.14,
      height: 1.22 + (index % 5) * 0.18,
      speed: 0.36 + (index % 4) * 0.08,
    };
    scene.add(particle);
    particles.push(particle);
  }

  // Pointer-driven effect particles can reach the MQ-2 or DHT22.
  function makeEffectTexture(innerColor, outerColor) {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 128;
    textureCanvas.height = 128;
    const context = textureCanvas.getContext("2d");
    const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
    gradient.addColorStop(0, innerColor);
    gradient.addColorStop(0.42, outerColor);
    gradient.addColorStop(1, outerColor.replace(/, [\d.]+\)$/, ", 0)"));
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(textureCanvas);
  }
  const effectTextures = {
    smoke: makeEffectTexture(
      "rgba(92, 101, 94, 0.84)",
      "rgba(119, 129, 121, 0.58)",
    ),
    fire: makeEffectTexture(
      "rgba(255, 241, 148, 0.96)",
      "rgba(244, 91, 34, 0.76)",
    ),
    water: makeEffectTexture(
      "rgba(210, 244, 255, 0.92)",
      "rgba(46, 145, 214, 0.66)",
    ),
  };
  const effectColors = { smoke: 0xffffff, fire: 0xff873d, water: 0x69c7ff };
  const hazardPuffs = [];
  const hazardOptions = [...document.querySelectorAll("[data-hazard]")];
  const sceneHint = document.getElementById("scene-hint");
  const smokeLevelInput = document.getElementById("smoke-level");
  const smokeLevelOutput = document.getElementById("smoke-level-output");
  const smokeRaycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const smokePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.08);
  const smokePlanePoint = new THREE.Vector3();
  const mq2SensorPosition = mq2.localToWorld(new THREE.Vector3(-0.06, 0.62, -0.1));
  const mq2DetectionRadius = 0.92;
  const dhtDetectionPosition = dht.localToWorld(new THREE.Vector3(0, 0.55, 0.2));
  const dhtDetectionRadius = 1.05;
  let selectedHazard = "smoke";
  let lastEffectAt = 0;
  let effectDragPointer = null;
  let lastFrameTime = performance.now();
  let lastResponseDispatch = 0;
  const sensorResponse = { smoke: 0, fire: 0, water: 0 };
  const lastSentResponse = { smoke: 0, fire: 0, water: 0 };

  function selectHazard(hazard) {
    selectedHazard = hazard;
    hazardOptions.forEach((button) => {
      const selected = button.dataset.hazard === hazard;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    const targets = {
      smoke: "Drag to orbit · guide smoke toward MQ-2",
      fire: "Drag to orbit · guide heat toward DHT22",
      water: "Drag to orbit · guide moisture toward DHT22",
    };
    sceneHint.textContent = targets[hazard];
  }
  hazardOptions.forEach((button) => {
    button.addEventListener("click", () => selectHazard(button.dataset.hazard));
  });

  function addHazardPuff(clientX, clientY) {
    const bounds = sceneView.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    smokeRaycaster.setFromCamera(pointer, camera);
    if (!smokeRaycaster.ray.intersectPlane(smokePlane, smokePlanePoint)) return;

    const hazard = selectedHazard;
    const level = Number(smokeLevelInput.value);
    const strength = level / 5;
    const material = new THREE.SpriteMaterial({
      map: effectTextures[hazard],
      color: effectColors[hazard],
      transparent: true,
      opacity: 0.42 + strength * 0.48,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const puff = new THREE.Sprite(material);
    puff.position.copy(smokePlanePoint);
    const size =
      (hazard === "fire" ? 0.3 : hazard === "water" ? 0.33 : 0.4) *
      (0.82 + strength * 0.6 + Math.random() * 0.25);
    puff.scale.set(size, size, 1);
    puff.userData = {
      hazard,
      level,
      born: performance.now(),
      lifetime:
        (hazard === "water" ? 4300 : hazard === "fire" ? 3600 : 4600) +
        level * 150 +
        Math.random() * 350,
      driftX: (Math.random() - 0.5) * 0.22 * (1.2 - strength * 0.55),
      driftZ: (Math.random() - 0.5) * 0.22 * (1.2 - strength * 0.55),
      rise:
        (hazard === "fire" ? 0.55 : hazard === "water" ? 0.03 : 0.28) *
        (1.2 - strength * 0.45),
      size,
    };
    scene.add(puff);
    hazardPuffs.push(puff);
    if (hazardPuffs.length > 140) {
      const oldestPuff = hazardPuffs.shift();
      scene.remove(oldestPuff);
      oldestPuff.material.dispose();
    }
  }

  sceneView.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    effectDragPointer = event.pointerId;
    renderer.domElement.setPointerCapture(event.pointerId);
    lastEffectAt = 0;
    addHazardPuff(event.clientX, event.clientY);
    event.preventDefault();
  });
  function finishEffectDrag(event) {
    if (effectDragPointer !== event.pointerId) return;
    effectDragPointer = null;
  }
  sceneView.addEventListener("pointerup", finishEffectDrag);
  sceneView.addEventListener("pointercancel", finishEffectDrag);

  sceneView.addEventListener("pointerenter", (event) => {
    addHazardPuff(event.clientX, event.clientY);
  });
  sceneView.addEventListener("pointermove", (event) => {
    const now = performance.now();
    const level = Number(smokeLevelInput.value);
    const emissionDelay = 155 - level * 18;
    if (now - lastEffectAt < emissionDelay) return;
    lastEffectAt = now;
    addHazardPuff(event.clientX, event.clientY);
  });
  smokeLevelInput.addEventListener("input", () => {
    smokeLevelOutput.value = smokeLevelInput.value;
    smokeLevelOutput.textContent = smokeLevelInput.value;
    const percent =
      ((Number(smokeLevelInput.value) - Number(smokeLevelInput.min)) /
        (Number(smokeLevelInput.max) - Number(smokeLevelInput.min))) *
      100;
    smokeLevelInput.style.setProperty("--pct", `${percent}%`);
  });
  smokeLevelInput.dispatchEvent(new Event("input"));

  function applyReadings(readings) {
    const temperature = Number(readings.temperature);
    const humidity = Number(readings.humidity);
    const gas = Number(readings.gas);
    const simulatedPpm = Math.round(
      (Math.max(0, Math.min(1023, gas)) / 1023) * 10000,
    );
    const threshold = Number(
      document.getElementById("gas-threshold")?.value ?? 450,
    );
    const gasAlert = readings.gasAlert ?? gas >= threshold;
    const temperatureHigh =
      readings.temperatureHigh ?? temperature >= 45;
    const humidityHigh = readings.humidityHigh ?? humidity >= 70;
    const temperatureOut =
      readings.temperatureOut ?? (temperature < 18 || temperature > 26);
    const humidityOut =
      readings.humidityOut ?? (humidity < 30 || humidity > 60);
    const fireDetected = Boolean(readings.fireDetected);
    const waterDetected = Boolean(readings.waterDetected);

    temperatureOutput.textContent = `${temperature.toFixed(1)} °C`;
    humidityOutput.textContent = `${humidity.toFixed(3)}%`;
    gasOutput.textContent = `${simulatedPpm.toLocaleString()} ppm`;
    updateLcd(temperature, humidity, simulatedPpm);

    const temperatureColor = temperatureHigh
      ? 0xe35b52
      : temperature < 18
        ? 0x64a9db
        : temperature > 26
          ? 0xe59c4d
          : 0x49bd82;
    ledMaterials.temperature.color.setHex(temperatureColor);
    ledMaterials.temperature.emissive.setHex(temperatureColor);
    const dhtEffectColor = fireDetected
      ? 0xff713d
      : humidityHigh
        ? 0xe35b52
      : waterDetected
        ? 0x438fc5
        : 0x000000;
    dhtShellMaterial.emissive.setHex(dhtEffectColor);
    dhtShellMaterial.emissiveIntensity =
      fireDetected || humidityHigh || waterDetected ? 0.75 : 0;
    const gasColor = gasAlert ? 0xe35b52 : 0x49bd82;
    ledMaterials.gas.color.setHex(gasColor);
    ledMaterials.gas.emissive.setHex(gasColor);
    particleMaterial.color.setHex(gasAlert ? 0xe35b52 : 0x66bb8b);
    particleMaterial.opacity = gasAlert ? 0.52 : 0.16 + (gas / 1023) * 0.28;
    const particleScale = 0.72 + (gas / 1023) * 0.65;
    particles.forEach((particle) => particle.scale.setScalar(particleScale));

    const activeStatusLed = gas < 250 ? 0 : gas < 450 ? 1 : gas < 650 ? 2 : 3;
    statusLedMaterials.forEach((material, index) => {
      material.emissiveIntensity = index === activeStatusLed ? 2.2 : 0.08;
      statusLedLenses[index].scale.setScalar(index === activeStatusLed ? 1.18 : 1);
    });

    sceneMessage.textContent = readings.smokeDetected
      ? "Smoke detected · MQ-2 response"
      : gasAlert
        ? "Gas alert · MQ-2 threshold reached"
        : temperatureHigh
          ? "High temperature alert · 45 °C threshold reached"
        : humidityHigh
          ? "High humidity alert · 70% threshold reached"
        : readings.fireDetected
          ? "Heat detected · DHT22 temperature rising"
          : readings.waterDetected
            ? "Moisture detected · DHT22 humidity rising"
            : temperatureOut || humidityOut
              ? "Check environment · reading outside range"
              : "Station status · readings in range";
    sceneMessage.classList.toggle(
      "is-alert",
      gasAlert || temperatureHigh || humidityHigh,
    );
    sceneMessage.classList.toggle(
      "is-warning",
      !gasAlert &&
        !temperatureHigh &&
        !humidityHigh &&
        (temperatureOut || humidityOut),
    );
  }

  window.addEventListener("sensor-readings-change", (event) => {
    applyReadings(event.detail);
  });
  applyReadings({
    temperature: document.getElementById("temp-control").value,
    humidity: document.getElementById("humidity-control").value,
    gas: document.getElementById("gas-control").value,
  });

  function updateTheme() {
    const dark = document.documentElement.dataset.theme === "dark";
    const background = dark ? 0x17231d : 0xeaf2ec;
    scene.background.setHex(background);
    scene.fog.color.setHex(background);
    floorMaterial.color.setHex(dark ? 0x1b2922 : 0xf5f8f5);
    platform.material.color.setHex(dark ? 0x25382d : 0xe2ebe4);
    grid.material.opacity = dark ? 0.2 : 0.48;
  }

  new MutationObserver(updateTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  function resizeRenderer() {
    const width = sceneView.clientWidth;
    const height = sceneView.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  const resizeObserver = new ResizeObserver(resizeRenderer);
  resizeObserver.observe(sceneView);
  window.addEventListener("resize", resizeRenderer);
  resizeRenderer();

  const listenerForward = new THREE.Vector3();
  const listenerUp = new THREE.Vector3();
  renderer.setAnimationLoop((time) => {
    if (document.hidden || sceneView.clientWidth === 0) return;
    const seconds = time * 0.001;
    const deltaSeconds = Math.min(
      Math.max((time - lastFrameTime) / 1000, 0),
      0.1,
    );
    lastFrameTime = time;
    particles.forEach((particle) => {
      const { angle, radius, height, speed } = particle.userData;
      const orbit = seconds * speed + angle;
      particle.position.set(
        3.25 + Math.cos(orbit) * radius,
        height + Math.sin(orbit * 0.7) * 0.14,
        0.2 + Math.sin(orbit) * radius,
      );
    });
    const now = performance.now();
    const targets = { smoke: 0, fire: 0, water: 0 };
    for (let index = hazardPuffs.length - 1; index >= 0; index -= 1) {
      const puff = hazardPuffs[index];
      const age = now - puff.userData.born;
      const progress = age / puff.userData.lifetime;
      if (progress >= 1) {
        scene.remove(puff);
        puff.material.dispose();
        hazardPuffs.splice(index, 1);
        continue;
      }

      puff.position.x += puff.userData.driftX * 0.016;
      puff.position.z += puff.userData.driftZ * 0.016;
      puff.position.y += puff.userData.rise * 0.016;
      const flicker = puff.userData.hazard === "fire"
        ? 0.78 + Math.sin(seconds * 19 + index) * 0.18
        : 1;
      puff.material.opacity = Math.sin(Math.PI * progress) * 0.75 * flicker;
      const isSmoke = puff.userData.hazard === "smoke";
      const distance = puff.position.distanceTo(
        isSmoke ? mq2SensorPosition : dhtDetectionPosition,
      );
      const detectionRadius = isSmoke
        ? mq2DetectionRadius
        : dhtDetectionRadius;
      const proximity = Math.max(0, 1 - distance / detectionRadius);
      const strength = puff.userData.level / 5;
      const visibleAmount = Math.min(1, puff.material.opacity / 0.6);
      const contribution = strength * proximity * visibleAmount;
      const hazard = puff.userData.hazard;
      targets[hazard] =
        1 - (1 - targets[hazard]) * (1 - Math.min(1, contribution));
    }

    Object.keys(sensorResponse).forEach((hazard) => {
      const target = hazard === "smoke" ? targets[hazard] : targets[hazard] * 5;
      const responseTime = target > sensorResponse[hazard] ? 1.35 : 3.6;
      const blend = 1 - Math.exp(-deltaSeconds / responseTime);
      sensorResponse[hazard] += (target - sensorResponse[hazard]) * blend;
      if (target === 0 && sensorResponse[hazard] < 0.012) {
        sensorResponse[hazard] = 0;
      }
    });

    const responseChanged = Object.keys(sensorResponse).some(
      (hazard) => Math.abs(sensorResponse[hazard] - lastSentResponse[hazard]) >= 0.012,
    );
    if (responseChanged && time - lastResponseDispatch >= 150) {
      window.dispatchEvent(
        new CustomEvent("sensor-effect-response", {
          detail: { ...sensorResponse },
        }),
      );
      Object.assign(lastSentResponse, sensorResponse);
      lastResponseDispatch = time;
    }
    controls.update();
    camera.getWorldDirection(listenerForward);
    listenerUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    window.dispatchEvent(
      new CustomEvent("sensor-audio-listener-move", {
        detail: {
          position: camera.position,
          forward: listenerForward,
          up: listenerUp,
        },
      }),
    );
    renderer.render(scene, camera);
  });

  updateTheme();
  sceneMessage.textContent = "Station status · readings in range";
}
