import * as THREE from 'three'
import { colorsFor, PALETTES, type Theme } from './palette'
import { pointsFragment, pointsVertex, sparkFragment, sparkVertex } from './shaders'
import type { Shape } from './shapes'

/** Where the cloud is and what it is: GSAP's ScrollTrigger timeline animates this object. */
export interface StageState {
  /** 0 = first shape, 1 = second… fractional values are mid-morph. */
  morph: number
  /** Position as a fraction of the half viewport (-1..1). */
  nx: number
  ny: number
  /** World units per shape unit. */
  scale: number
  spin: number
  tilt: number
  opacity: number
}

const FOV = 35
const CAM_Z = 8
const SPARK_COUNT = 260

export class PointStage {
  readonly state: StageState = { morph: 0, nx: 0, ny: 0, scale: 1, spin: 0, tilt: 0, opacity: 1 }
  /** Animated by GSAP on first load. */
  readonly intro = { value: 0 }
  halfW = 1
  halfH = 1

  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)
  private group = new THREE.Group()
  private geo = new THREE.BufferGeometry()
  private mat: THREE.ShaderMaterial
  private sparkMat: THREE.ShaderMaterial
  private points: THREE.Points
  private spark: THREE.Points
  private seg = -1
  private theme: Theme
  private reach = 0
  private screenK = 1
  private paused = false
  private countK = 1
  private pulseV = 0
  private pointer = { x: 0, y: 0, has: false, last: -1e9 }
  private ray = new THREE.Raycaster()
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  private hit = new THREE.Vector3()
  private mouse = new THREE.Vector3(99, 99, 0)
  private gapLocal: THREE.Vector3
  private gapWorld = new THREE.Vector3()

  constructor(
    private canvas: HTMLCanvasElement,
    private shapes: Shape[],
    theme: Theme,
    private reduced: boolean,
  ) {
    this.theme = theme
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x000000, 0)
    this.camera.position.set(0, 0, CAM_Z)

    const n = shapes[0].tone.length
    const R = Math.random
    const rnd = new Float32Array(n * 4)
    for (let i = 0; i < rnd.length; i++) rnd[i] = R()
    const dyn = (size: number) => new THREE.BufferAttribute(new Float32Array(n * size), size).setUsage(THREE.DynamicDrawUsage)
    this.geo.setAttribute('position', dyn(3))
    this.geo.setAttribute('aTo', dyn(3))
    this.geo.setAttribute('aColA', dyn(3))
    this.geo.setAttribute('aColB', dyn(3))
    this.geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4))

    // Fewer points → bigger points; more points → finer grain and fainter each.
    const density = Math.min(1.6, Math.max(0.8, Math.sqrt(80000 / n)))
    this.countK = Math.min(1.3, Math.max(0.65, Math.sqrt(60000 / n)))
    this.mat = new THREE.ShaderMaterial({
      vertexShader: pointsVertex,
      fragmentShader: pointsFragment,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uMorph: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: 19 * density },
        uPR: { value: 1 },
        uCalm: { value: reduced ? 0 : 1 },
        uIntro: { value: 0 },
        uMetaA: { value: new THREE.Vector2(1, 1) },
        uMetaB: { value: new THREE.Vector2(1, 1) },
        uAlpha: { value: 0.5 },
        uOpacity: { value: 1 },
        uHeroW: { value: 1 },
        uGap: { value: new THREE.Vector3() },
        uReach: { value: 0 },
        uPulse: { value: 0 },
        uScale: { value: 1 },
      },
    })
    this.points = new THREE.Points(this.geo, this.mat)
    this.points.frustumCulled = false

    const hero = shapes[0]
    this.gapLocal = new THREE.Vector3(...(hero.gap ?? [0, 0, 0]))
    this.mat.uniforms.uGap.value.copy(this.gapLocal)

    const sg = new THREE.BufferGeometry()
    const srnd = new Float32Array(SPARK_COUNT * 4)
    for (let i = 0; i < srnd.length; i++) srnd[i] = R()
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARK_COUNT * 3), 3))
    sg.setAttribute('aRnd', new THREE.BufferAttribute(srnd, 4))
    this.sparkMat = new THREE.ShaderMaterial({
      vertexShader: sparkVertex,
      fragmentShader: sparkFragment,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPR: { value: 1 },
        uSize: { value: 70 },
        uGap: { value: this.gapLocal.clone() },
        uI: { value: 0 },
        uPulse: { value: 0 },
        uColor: { value: new THREE.Color(1, 0.86, 0.6) },
        uOpacity: { value: 0 },
      },
    })
    this.spark = new THREE.Points(sg, this.sparkMat)
    this.spark.frustumCulled = false

    this.group.add(this.points, this.spark)
    this.scene.add(this.group)

    this.setTheme(theme)
    this.resize()
    this.listen()
  }

  private listen() {
    window.addEventListener('pointermove', (e) => {
      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1
      this.pointer.has = true
      this.pointer.last = performance.now()
    }, { passive: true })
    document.documentElement.addEventListener('pointerleave', () => (this.pointer.has = false))
  }

  setTheme(theme: Theme) {
    this.theme = theme
    const dark = theme === 'dark'
    this.mat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending
    this.applyAlpha()
    this.mat.needsUpdate = true
    const c = PALETTES[theme].acid
    this.sparkMat.uniforms.uColor.value.setRGB(c[0], c[1], c[2])
    if (this.seg >= 0) this.applySegment(this.seg)
  }

  /** Additive points pile up on small screens, so they get fainter (and a bit smaller) there. */
  private applyAlpha() {
    const dark = this.theme === 'dark'
    this.mat.uniforms.uAlpha.value = (dark ? 0.46 : 0.78) * this.countK * (dark ? this.screenK : 0.5 + this.screenK * 0.5)
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    const pr = Math.min(window.devicePixelRatio || 1, 1.75)
    this.renderer.setPixelRatio(pr)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAM_Z
    this.halfW = this.halfH * this.camera.aspect
    this.screenK = Math.min(1, Math.max(0.5, Math.sqrt(w / 1200)))
    this.mat.uniforms.uPR.value = pr * (h / 900) ** 0.5 * (0.7 + 0.3 * this.screenK)
    this.applyAlpha()
    this.sparkMat.uniforms.uPR.value = pr
  }

  /** Screen position (CSS px) of a point given in the hero's shape space, for a given layout. */
  project(local: [number, number], s: Pick<StageState, 'nx' | 'ny' | 'scale'>) {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    const x = s.nx * this.halfW + local[0] * s.scale
    const y = s.ny * this.halfH + local[1] * s.scale
    return { x: (x / this.halfW * 0.5 + 0.5) * w, y: (0.5 - y / this.halfH * 0.5) * h }
  }

  /** Screen-space geometry of the hero for a given layout: used to place the DOM around it. */
  heroBox(s: Pick<StageState, 'nx' | 'ny' | 'scale'>) {
    const [lo, hi] = this.shapes[0].bounds ?? [-0.2, 0.2]
    const gap = this.project([this.gapLocal.x, this.gapLocal.y], s)
    return { gapX: gap.x, gapY: gap.y, top: this.project([0, hi], s).y, bottom: this.project([0, lo], s).y }
  }

  /** Freeze the idle motion (sway, breathing); scroll still drives the story. */
  setPaused(p: boolean) {
    this.paused = p
  }

  pulse() {
    this.pulseV = 1
  }

  private applySegment(i: number) {
    const a = this.shapes[i]
    const b = this.shapes[Math.min(i + 1, this.shapes.length - 1)]
    const at = (name: string) => this.geo.getAttribute(name) as THREE.BufferAttribute
    ;(at('position').array as Float32Array).set(a.pos)
    ;(at('aTo').array as Float32Array).set(b.pos)
    ;(at('aColA').array as Float32Array).set(colorsFor(a, this.theme))
    ;(at('aColB').array as Float32Array).set(colorsFor(b, this.theme))
    for (const name of ['position', 'aTo', 'aColA', 'aColB']) at(name).needsUpdate = true
    this.mat.uniforms.uMetaA.value.set(a.alpha, a.size)
    this.mat.uniforms.uMetaB.value.set(b.alpha, b.size)
    this.seg = i
  }

  frame(time: number, dt: number) {
    const s = this.state
    const last = this.shapes.length - 1
    const m = Math.min(Math.max(s.morph, 0), last)
    const seg = Math.min(Math.floor(m), last - 1)
    const t = m - seg
    if (seg !== this.seg) this.applySegment(seg)

    const u = this.mat.uniforms
    const calm = this.reduced || this.paused ? 0 : 1
    u.uTime.value = time
    u.uCalm.value = calm
    u.uMorph.value = t
    u.uIntro.value = this.intro.value
    u.uOpacity.value = s.opacity
    u.uHeroW.value = seg === 0 ? 1 : 0
    u.uScale.value = Math.max(0.2, s.scale)

    // Layout and slow sway. The fresco barely moves; objects turn to show their depth.
    const heroK = seg === 0 ? 1 - t : 0
    const sway = Math.sin(time * 0.23) * THREE.MathUtils.lerp(0.22, 0.03, heroK) * calm
    this.group.position.set(s.nx * this.halfW, s.ny * this.halfH, 0)
    this.group.scale.setScalar(s.scale)
    // The pointer no longer moves the points or the model; only scroll and a slow sway do.
    this.group.rotation.set(s.tilt, s.spin + sway, 0)
    this.group.updateMatrixWorld()

    // Pointer on the z = 0 plane: used only to light the spark near the fingertips.
    if (this.pointer.has) {
      this.ray.setFromCamera(new THREE.Vector2(this.pointer.x, this.pointer.y), this.camera)
      if (this.ray.ray.intersectPlane(this.plane, this.hit)) this.mouse.lerp(this.hit, 1 - Math.pow(0.0005, dt))
    }

    // The hands reach when the pointer comes close to the gap between the fingers.
    this.gapWorld.copy(this.gapLocal).applyMatrix4(this.group.matrixWorld)
    const dist = Math.hypot(this.mouse.x - this.gapWorld.x, this.mouse.y - this.gapWorld.y)
    const want = seg === 0 && this.pointer.has ? 1 - THREE.MathUtils.smoothstep(dist, 0.2, 1.8) : 0
    this.reach += (want - this.reach) * (1 - Math.pow(0.02, dt))
    this.pulseV *= Math.pow(0.08, dt)
    u.uReach.value = this.reach
    u.uPulse.value = this.pulseV

    const su = this.sparkMat.uniforms
    su.uTime.value = time
    su.uI.value = this.reach
    su.uPulse.value = this.pulseV
    su.uOpacity.value = heroK * Math.min(1, 0.3 + this.reach * 0.9 + this.pulseV) * this.intro.value
    this.spark.visible = su.uOpacity.value > 0.01

    this.points.visible = s.opacity > 0.004
    this.renderer.render(this.scene, this.camera)
  }
}
