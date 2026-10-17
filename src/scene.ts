import * as THREE from "three";
import {
  BLOCKS,
  STAGE,
  positionFor,
  seatPosition,
  type Selection,
} from "./model";

export class SeatScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(68, 1, 0.08, 230);
  private heading = 0;
  private pitch = 0;
  private selection: Selection;
  private frame = 0;
  private resizeObserver: ResizeObserver;
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  private transition = 0;
  private onMove: () => void;

  constructor(
    private container: HTMLElement,
    selection: Selection,
    onMove: () => void,
  ) {
    this.selection = selection;
    this.onMove = onMove;
    this.renderer = new THREE.WebGLRenderer({
      antialias: devicePixelRatio < 2,
      alpha: false,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setClearColor(0x151e22);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D view toward the stage. Drag to look around, or use arrow keys.",
    );
    this.renderer.domElement.tabIndex = 0;
    this.container.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.FogExp2(0x182027, 0.007);
    this.scene.add(new THREE.HemisphereLight(0xb6d3dc, 0x23212a, 2.0));
    const stageLight = new THREE.DirectionalLight(0xffd5ad, 2.6);
    stageLight.position.set(0, 18, -28);
    this.scene.add(stageLight);
    this.buildArena();
    this.buildStage();
    this.buildAudience();
    this.bindControls();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.setSelection(selection, false);
  }

  private material(color: number, roughness = 0.85) {
    return new THREE.MeshStandardMaterial({ color, roughness });
  }

  private box(
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material,
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    return mesh;
  }

  private buildArena() {
    this.box(114, 0.4, 132, 0, -0.4, 8, this.material(0x252f34));
    this.box(110, 37, 0.6, 0, 17, -44, this.material(0x11181f));
    this.box(110, 37, 0.6, 0, 17, 65, this.material(0x1a2429));
    this.box(0.6, 37, 110, -55, 17, 10, this.material(0x1b252c));
    this.box(0.6, 37, 110, 55, 17, 10, this.material(0x1b252c));
    this.box(110, 0.5, 112, 0, 35, 9, this.material(0x131c22));

    const trussMaterial = this.material(0x3a474c);
    for (let z = -32; z <= 60; z += 12) {
      this.box(105, 0.18, 0.18, 0, 31.5, z, trussMaterial);
      this.box(105, 0.18, 0.18, 0, 33.5, z, trussMaterial);
      for (let x = -48; x < 48; x += 6) {
        const brace = this.box(6.3, 0.12, 0.12, x + 3, 32.5, z, trussMaterial);
        brace.rotation.z = (Math.floor(x / 6) % 2 ? 1 : -1) * 0.32;
      }
    }
    for (const x of [-43, -23, 0, 23, 43])
      this.box(0.14, 0.14, 108, x, 32.5, 10, trussMaterial);

    const totalRows = BLOCKS.reduce((n, b) => n + b.rows, 0);
    const totalSeats = BLOCKS.reduce((n, b) => n + b.rows * b.seats, 0);
    const terraces = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      this.material(0x333e44),
      totalRows,
    );
    const seats = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      this.material(0x5a7278),
      totalSeats,
    );
    const backs = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      this.material(0x435d63),
      totalSeats,
    );
    const dummy = new THREE.Object3D();
    let rowIndex = 0,
      seatIndex = 0;
    for (const block of BLOCKS) {
      const angle = Math.atan2(-block.tangent.z, block.tangent.x);
      for (let row = 1; row <= block.rows; row++) {
        const depth = ((row - 0.5) * block.depth) / block.rows;
        const height = block.center.y + (row - 1) * block.rise;
        dummy.position.set(
          block.center.x + block.normal.x * depth,
          height - 0.2,
          block.center.z + block.normal.z * depth,
        );
        dummy.rotation.set(0, angle, 0);
        dummy.scale.set(block.width, 0.4, block.depth / block.rows + 0.015);
        dummy.updateMatrix();
        terraces.setMatrixAt(rowIndex++, dummy.matrix);
        for (let seat = 1; seat <= block.seats; seat++) {
          const p = seatPosition(block, row, seat);
          dummy.position.set(p.x, height + 0.34, p.z);
          dummy.scale.set((block.width / block.seats) * 0.79, 0.09, 0.32);
          dummy.updateMatrix();
          seats.setMatrixAt(seatIndex, dummy.matrix);
          dummy.position.set(
            p.x + block.normal.x * 0.13,
            height + 0.57,
            p.z + block.normal.z * 0.13,
          );
          dummy.scale.set((block.width / block.seats) * 0.79, 0.4, 0.06);
          dummy.updateMatrix();
          backs.setMatrixAt(seatIndex++, dummy.matrix);
        }
      }
    }
    this.scene.add(terraces, seats, backs);

    const barrierMaterial = this.material(0x636c6f);
    for (const x of [-21, 0, 21]) {
      this.box(0.07, 0.07, 49, x, 1.1, -3, barrierMaterial);
      for (let z = -27; z < 23; z += 3)
        this.box(0.05, 1.1, 0.05, x, 0.55, z, barrierMaterial);
    }
    this.box(42, 0.08, 0.08, 0, 1.1, -28.5, barrierMaterial);
    this.box(5, 2.1, 4.5, 0, 1.05, 22.5, this.material(0x151b20));
    this.box(5.7, 0.15, 5.2, 0, 3.5, 22.5, this.material(0x11161b));
    for (const x of [-2.5, 2.5])
      for (const z of [20.5, 24.5])
        this.box(0.08, 3.5, 0.08, x, 1.75, z, barrierMaterial);
  }

  private screenTexture(side = false) {
    const canvas = document.createElement("canvas");
    canvas.width = side ? 384 : 1536;
    canvas.height = 768;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 768);
    gradient.addColorStop(0, "#f3dbb8");
    gradient.addColorStop(0.43, "#eaa075");
    gradient.addColorStop(1, "#8e342c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, 768);
    ctx.fillStyle = "#f9e4bc";
    ctx.beginPath();
    ctx.arc(canvas.width * 0.5, 280, side ? 115 : 190, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = [
        "#c3765e",
        "#ad614e",
        "#994d40",
        "#814539",
        "#723d34",
        "#5b302c",
      ][i];
      ctx.beginPath();
      ctx.moveTo(0, 500 + i * 34);
      for (let x = 0; x <= canvas.width; x += 8)
        ctx.lineTo(
          x,
          480 +
            i * 35 +
            Math.sin(x / 220 + i * 0.8) * 35 +
            Math.cos(x / 93 + i) * 10,
        );
      ctx.lineTo(canvas.width, 768);
      ctx.lineTo(0, 768);
      ctx.fill();
    }
    ctx.fillStyle = "#322d24";
    ctx.textAlign = "center";
    ctx.font = `bold ${side ? 88 : 260}px Arial, sans-serif`;
    ctx.fillText("LANY", canvas.width / 2, side ? 342 : 360);
    if (!side) {
      ctx.font = "30px Georgia, serif";
      ctx.fillText("soft world tour", canvas.width / 2, 416);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private buildStage() {
    const dark = this.material(0x14191b);
    this.box(29, 1.6, 9, 0, 0.8, -35, dark);
    this.box(31, 19, 0.6, 0, 10, -40, this.material(0x0b1014));
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(25, 12.5),
      new THREE.MeshBasicMaterial({
        map: this.screenTexture(),
        toneMapped: false,
      }),
    );
    screen.position.set(0, 10.1, -39.55);
    this.scene.add(screen);
    for (const x of [-18.4, 18.4]) {
      this.box(6.3, 12, 0.5, x, 10.8, -36.7, dark);
      const side = new THREE.Mesh(
        new THREE.PlaneGeometry(5.6, 11.2),
        new THREE.MeshBasicMaterial({
          map: this.screenTexture(true),
          toneMapped: false,
        }),
      );
      side.position.set(x, 10.8, -36.4);
      this.scene.add(side);
    }
    const glow = new THREE.MeshBasicMaterial({ color: 0xf7c58d });
    this.box(29, 0.09, 0.09, 0, 1.65, -30.45, glow);
    for (const x of [-13.5, 13.5]) {
      for (let i = 0; i < 6; i++)
        this.box(1.2, 0.6, 1, x, 14.8 - i * 0.65, -30, dark);
    }
    this.box(29, 0.18, 0.18, 0, 19, -31, this.material(0x62676a));
    for (const x of [-12, -8, -4, 0, 4, 8, 12]) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), glow);
      bulb.position.set(x, 18.8, -31);
      this.scene.add(bulb);
      // Stylized lighting only; this is not the production's stage design.
      const start = new THREE.Vector3(x, 18.6, -31);
      const end = new THREE.Vector3(x * 1.7, 0.1, -5 + Math.abs(x) * 0.8);
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(2.1, start.distanceTo(end), 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: x % 8 === 0 ? 0xacc8ed : 0xffc587,
          transparent: true,
          opacity: 0.045,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      beam.position.copy(start).add(end).multiplyScalar(0.5);
      beam.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        start.clone().sub(end).normalize(),
      );
      this.scene.add(beam);
    }
    // Generic scale references: a mic, drum kit, and a performer silhouette.
    const mic = this.material(0x202326);
    this.box(0.035, 1.5, 0.035, 0, 2.35, -32.5, mic);
    this.box(0.45, 0.04, 0.04, 0.15, 3.09, -32.5, mic);
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.2, 0.72, 3, 6),
      this.material(0x252827),
    );
    body.position.set(0.5, 2.4, -33.3);
    this.scene.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      this.material(0x9d8a77),
    );
    head.position.set(0.5, 3.04, -33.3);
    this.scene.add(head);
    for (const x of [0.36, 0.64])
      this.box(0.12, 0.75, 0.12, x, 1.95, -33.3, mic);
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 0.5, 16),
      this.material(0x927353),
    );
    drum.rotation.x = Math.PI / 2;
    drum.position.set(-3, 2.3, -36.3);
    this.scene.add(drum);
    for (const x of [-4, -2]) {
      this.box(0.035, 1.2, 0.035, x, 2.2, -36.5, mic);
      const cymbal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.025, 16),
        this.material(0xb69a61),
      );
      cymbal.position.set(x, 2.8, -36.5);
      this.scene.add(cymbal);
    }
  }

  private buildAudience() {
    const count = 850;
    const bodies = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.17, 0.52, 2, 5),
      this.material(0x28343b),
      count,
    );
    const heads = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.13, 6, 4),
      this.material(0x6f716e),
      count,
    );
    const dummy = new THREE.Object3D();
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      const x = (i % 2 ? -1 : 1) * (1.5 + random() * 18.3);
      const z = -26.5 + random() * 45;
      const height = 0.9 + random() * 0.18;
      dummy.position.set(x, height, z);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      dummy.position.y = height + 0.52;
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(bodies, heads);
  }

  setSelection(selection: Selection, animate = true) {
    this.selection = selection;
    cancelAnimationFrame(this.transition);
    const position = positionFor(selection);
    const target = new THREE.Vector3(position.x, position.y, position.z);
    const from = this.camera.position.clone();
    this.heading = 0;
    this.pitch = 0;
    if (!animate || this.reducedMotion) {
      this.camera.position.copy(target);
      this.aim();
      return;
    }
    const start = performance.now();
    const move = (now: number) => {
      const t = Math.min((now - start) / 700, 1);
      this.camera.position.lerpVectors(from, target, 1 - Math.pow(1 - t, 3));
      this.aim();
      if (t < 1) this.transition = requestAnimationFrame(move);
    };
    this.transition = requestAnimationFrame(move);
  }

  private aim() {
    const p = this.camera.position;
    const dx = STAGE.x - p.x,
      dz = STAGE.z - p.z;
    const heading = Math.atan2(dx, -dz) + this.heading;
    const pitch =
      Math.atan2(STAGE.y + 2.4 - p.y, Math.hypot(dx, dz)) + this.pitch;
    this.camera.lookAt(
      p.x + Math.sin(heading) * Math.cos(pitch),
      p.y + Math.sin(pitch),
      p.z - Math.cos(heading) * Math.cos(pitch),
    );
    this.render();
  }

  reset() {
    this.heading = 0;
    this.pitch = 0;
    this.setFov(68);
    this.aim();
  }
  setFov(fov: number) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  private bindControls() {
    const canvas = this.renderer.domElement;
    let pointer: { id: number; x: number; y: number } | null = null;
    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add("is-dragging");
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!pointer || e.pointerId !== pointer.id) return;
      this.heading -= (e.clientX - pointer.x) * 0.004;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + (e.clientY - pointer.y) * 0.004,
        -0.9,
        0.9,
      );
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      this.aim();
      this.onMove();
    });
    const release = () => {
      pointer = null;
      canvas.classList.remove("is-dragging");
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("lostpointercapture", release);
    canvas.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
        return;
      e.preventDefault();
      if (e.key === "ArrowLeft") this.heading -= 0.07;
      if (e.key === "ArrowRight") this.heading += 0.07;
      if (e.key === "ArrowUp") this.pitch = Math.min(0.9, this.pitch + 0.07);
      if (e.key === "ArrowDown") this.pitch = Math.max(-0.9, this.pitch - 0.07);
      this.aim();
      this.onMove();
    });
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      containerMessage(
        this.container,
        "The 3D view was interrupted. Reload the page to reconnect.",
      );
    });
  }

  private resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.render();
  }

  private render() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderer.render(this.scene, this.camera);
    });
  }
}

export function containerMessage(container: HTMLElement, message: string) {
  const error = document.createElement("div");
  error.className = "scene-error";
  error.setAttribute("role", "status");
  const title = document.createElement("strong");
  title.textContent = "Your seat is saved. The 3D view is unavailable.";
  const text = document.createElement("p");
  text.textContent = message;
  error.append(title, text);
  container.replaceChildren(error);
}
