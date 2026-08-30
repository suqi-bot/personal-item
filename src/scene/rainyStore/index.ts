import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { Kit, disposeGeoCache } from './kit'
import { PAL, disposeShared } from './materials'
import { disposeTextures, skyTex } from './textures'
import { L } from './layout'
import { buildGround } from './ground'
import { buildStoreShell } from './storeShell'
import { buildInterior } from './interior'
import { buildStreetProps } from './props'
import { buildAtmosphere } from './atmosphere'
import type { Anchor } from './storeShell'

const WATER_Y = 0.028
const MIRROR_TARGET = new THREE.Vector3(-1.35, 2.1, -1.1)

const gradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.95 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uVignette;
    varying vec2 vUv;
    float hash( vec2 p ) {
      return fract( sin( dot( p, vec2( 41.3, 289.1 ) ) ) * 43758.545 );
    }
    void main() {
      vec3 col = texture2D( tDiffuse, vUv ).rgb;
      float luma = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
      // 暗部压向冷蓝、亮部保留暖调：动画夜景常用的分离调色
      col = mix( col * vec3( 0.9, 0.97, 1.14 ), col * vec3( 1.06, 1.0, 0.92 ), smoothstep( 0.1, 0.8, luma ) );
      vec2 d = vUv - 0.5;
      float vig = smoothstep( 1.15, 0.12, dot( d, d ) * uVignette * 1.9 );
      col *= mix( 0.87, 1.0, vig );
      col += ( hash( vUv * 1024.0 + fract( uTime ) * 91.0 ) - 0.5 ) * uGrain;
      gl_FragColor = vec4( col, 1.0 );
    }
  `,
}

export class RainyStoreDiorama {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private composer: EffectComposer
  private bloom: UnrealBloomPass
  private grade: ShaderPass
  private kit = new Kit()
  private clock = new THREE.Clock()
  private raf = 0
  private disposed = false
  private ro?: ResizeObserver
  private fitDist = 26

  private reflRT: THREE.WebGLRenderTarget
  private mirrorCam: THREE.PerspectiveCamera
  private clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y - 0.004)
  private hideList: THREE.Object3D[] = []
  private water?: THREE.ShaderMaterial
  private updaters: ((t: number, dt: number) => void)[] = []
  private atmosphereUpdate: (t: number, dt: number, cam: THREE.Camera) => void = () => {}
  private dirLight!: THREE.DirectionalLight

  constructor(container: HTMLElement) {
    this.container = container
    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)

    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(w, h)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // 三渲二要的是色块干净、高光不掉饱和，ACES 会把亮部洗白，这里用 Neutral
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color(PAL.voidDeep)
    this.scene.fog = new THREE.FogExp2(0x121a30, 0.0085)

    this.camera = new THREE.PerspectiveCamera(30, w / h, 0.4, 400)
    this.camera.position.set(13.2, 9.2, 15.4)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.copy(MIRROR_TARGET)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.075
    this.controls.rotateSpeed = 0.72
    this.controls.zoomSpeed = 0.8
    this.controls.panSpeed = 0.55
    this.controls.minDistance = 7.5
    this.controls.maxDistance = 44
    this.controls.minPolarAngle = 0.12
    this.controls.maxPolarAngle = Math.PI * 0.47
    this.controls.autoRotate = true
    this.controls.autoRotateSpeed = 0.22
    // 自转只是闲置时的展示姿态，观众一上手就停，避免和拖拽抢视角
    const stopAutoRotate = () => {
      this.controls.autoRotate = false
      const el = this.renderer.domElement
      el.removeEventListener('pointerdown', stopAutoRotate)
      el.removeEventListener('wheel', stopAutoRotate)
    }
    this.renderer.domElement.addEventListener('pointerdown', stopAutoRotate)
    this.renderer.domElement.addEventListener('wheel', stopAutoRotate)
    this.frameCamera()

    this.buildSky()
    this.buildLights()

    // ---------- 世界内容 ----------
    const ground = buildGround(this.kit)
    const shell = buildStoreShell(this.kit)
    const interior = buildInterior(this.kit)
    const props = buildStreetProps(this.kit)
    this.kit.finalize()

    this.water = ground.water

    const anchors: Anchor[] = [...shell.anchors, ...interior.anchors, ...props.anchors]
    const atmosphere = buildAtmosphere(this.kit, {
      dripAnchors: [...shell.dripAnchors, ...props.dripAnchors],
      steamAnchors: interior.steamAnchors,
      glassPanels: shell.glassPanels,
      puddleSpots: ground.puddleSpots,
      anchors,
    })

    const noReflect: THREE.Object3D[] = []
    this.kit.root.traverse((o) => {
      if (o.userData.noReflect) noReflect.push(o)
    })
    const lineArt = this.kit.root.children.filter((c) => c.name.startsWith('lineart'))
    this.hideList = [
      ...new Set([...ground.hideForReflection, ...shell.hideForReflection, ...atmosphere.hideForReflection, ...lineArt, ...noReflect]),
    ]

    // 静态几何：阴影只烘一次，避免反射通道每帧重复渲染阴影图
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.shadowMap.needsUpdate = true

    this.scene.add(this.kit.root)

    this.updaters.push(ground.update)
    this.updaters.push((t, dt) => shell.update(t, dt))
    this.updaters.push((t, dt) => interior.update(t, dt))
    let signalColor = -1
    this.updaters.push((t, dt) => {
      props.update(t, dt)
      if (props.signal.color !== signalColor) {
        signalColor = props.signal.color
        atmosphere.setAnchorColor(props.signal)
      }
    })
    this.atmosphereUpdate = atmosphere.update

    // ---------- 反射通道 ----------
    this.mirrorCam = new THREE.PerspectiveCamera(this.camera.fov, w / h, 0.4, 400)
    this.reflRT = new THREE.WebGLRenderTarget(Math.max(2, Math.floor(w / 2)), Math.max(2, Math.floor(h / 2)), {
      type: THREE.HalfFloatType,
      depthBuffer: true,
    })
    this.reflRT.texture.generateMipmaps = false

    // ---------- 后期 ----------
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 })
    this.composer = new EffectComposer(this.renderer, rt)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.62, 0.55, 1.25)
    this.composer.addPass(this.bloom)
    this.grade = new ShaderPass(gradeShader)
    this.composer.addPass(this.grade)
    this.composer.addPass(new OutputPass())
    this.resize()

    window.addEventListener('resize', this.onWindowResize)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)

    this.loop()
  }

  /** 按视口比例取景：让正方形底座尽量充满画面，横竖屏都保持紧凑的微缩模型构图 */
  private frameCamera(keepDir = false) {
    // resize 时保留观众当前的推拉比例，否则每次改窗口尺寸都会被弹回默认机位
    const zoom = keepDir
      ? THREE.MathUtils.clamp(this.camera.position.distanceTo(this.controls.target) / this.fitDist, 0.24, 2.1)
      : 1
    const dir = keepDir
      ? this.camera.position.clone().sub(this.controls.target).normalize()
      : new THREE.Vector3(0.66, 0.32, 0.82).normalize()
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    const tanH = tanV * this.camera.aspect
    const inv = new THREE.Matrix4()
    const v = new THREE.Vector3()
    const place = (d: number) => {
      this.camera.position.copy(this.controls.target).addScaledVector(dir, d)
      this.camera.lookAt(this.controls.target)
      this.camera.updateMatrixWorld(true)
      inv.copy(this.camera.matrixWorld).invert()
    }
    let dist = 26
    for (let it = 0; it < 8; it++) {
      place(dist)
      let slack = 0
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? L.base.half : -L.base.half, i & 2 ? 7.4 : -0.62, i & 4 ? L.base.half : -L.base.half).applyMatrix4(inv)
        slack = Math.max(slack, v.z + Math.abs(v.x) / tanH, v.z + Math.abs(v.y) / tanV)
      }
      if (slack < 0.01) break
      dist += slack
    }
    // 收满画面：远处两角允许轻微出血，但底座是一个完整的方形台子，近边必须留在画面里
    dist *= 0.9
    this.fitDist = dist
    place(dist * zoom)
    this.controls.minDistance = dist * 0.16
    this.controls.maxDistance = dist * 2.1
    this.controls.update()
  }

  private buildSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(160, 32, 18),
      new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }),
    )
    sky.name = 'sky'
    sky.userData.noReflect = false
    this.scene.add(sky)

    // 远处城市剪影带，给雨夜增加纵深（自发光很低的暗块）
    const sil = new THREE.Group()
    sil.name = 'farCity'
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x1b2440), fog: false, transparent: true, opacity: 0.9 })
    const rand = (() => {
      let s = 99173
      return () => ((s = (s * 1664525 + 1013904223) >>> 0) >>> 0) / 4294967296
    })()
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const list: { pos: [number, number, number]; rot?: [number, number, number]; scale?: [number, number, number] }[] = []
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2
      const r = 34 + rand() * 12
      const hgt = 3 + rand() * 11
      list.push({
        pos: [Math.cos(a) * r, hgt / 2 - 1.2, Math.sin(a) * r],
        rot: [0, -a + (rand() - 0.5) * 0.6, 0],
        scale: [3 + rand() * 4, hgt, 3 + rand() * 4],
      })
    }
    const im = new THREE.InstancedMesh(geo, mat, list.length)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const p = new THREE.Vector3()
    const sc = new THREE.Vector3()
    list.forEach((it, i) => {
      p.fromArray(it.pos)
      e.set(...(it.rot ?? [0, 0, 0]))
      q.setFromEuler(e)
      sc.fromArray(it.scale ?? [1, 1, 1])
      m.compose(p, q, sc)
      im.setMatrixAt(i, m)
    })
    im.instanceMatrix.needsUpdate = true
    im.frustumCulled = false
    sil.add(im)
    // 远景窗光
    const winMat = new THREE.PointsMaterial({ color: 0xffd7a0, size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0.5, fog: false, depthWrite: false })
    const pts: number[] = []
    for (let i = 0; i < 240; i++) {
      const a = rand() * Math.PI * 2
      const r = 33 + rand() * 12
      pts.push(Math.cos(a) * r, -0.8 + rand() * 9, Math.sin(a) * r)
    }
    const pg = new THREE.BufferGeometry()
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const cloudLights = new THREE.Points(pg, winMat)
    cloudLights.frustumCulled = false
    sil.add(cloudLights)
    this.scene.add(sil)
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x6f8cc9, 0x171c2e, 0.82))
    this.scene.add(new THREE.AmbientLight(0x2a3557, 0.55))

    const dir = new THREE.DirectionalLight(0xa9c6ff, 0.72)
    dir.position.set(9.5, 15, 11)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.camera.near = 1
    dir.shadow.camera.far = 46
    dir.shadow.camera.left = -14
    dir.shadow.camera.right = 14
    dir.shadow.camera.top = 14
    dir.shadow.camera.bottom = -14
    dir.shadow.bias = -0.0007
    dir.shadow.normalBias = 0.022
    dir.shadow.radius = 1.4
    this.scene.add(dir)
    this.dirLight = dir

    // 店内洒出的暖光
    const spill = new THREE.PointLight(0xffbe86, 6.5, 9, 1.7)
    spill.position.set(-2.4, 2.5, -1.1)
    this.scene.add(spill)
    // 路灯冷光：灯头在挑臂末端（+Z 0.67），放在灯杆轴线上会把杆子照成一根白柱
    const lamp = new THREE.PointLight(0xb9d4ff, 7.5, 11, 1.85)
    lamp.position.set(L.spots.streetlight.x, 4.28, L.spots.streetlight.z + 0.67)
    this.scene.add(lamp)
    // 贩卖机光
    const vend = new THREE.PointLight(0xffd3a0, 9, 7, 1.7)
    vend.position.set(2.5, 1.5, -4.4)
    this.scene.add(vend)
    const warmCore = new THREE.PointLight(0xffe0b0, 12, 12, 1.6)
    warmCore.position.set(-3.0, 2.6, -5.4)
    this.scene.add(warmCore)

    this.updaters.push((t) => {
      // 基线必须与 buildLights 里构造时的值一致，否则每帧写回会覆盖掉调好的曝光
      spill.intensity = 6.5 + Math.sin(t * 0.9) * 0.35
      lamp.intensity = 7.5 + Math.sin(t * 1.7) * 0.35
    })
  }

  private onWindowResize = () => this.resize()
  private onVisibility = () => {
    if (document.hidden) {
      this.clock.getDelta()
    }
  }

  private resize() {
    if (this.disposed) return
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.mirrorCam.aspect = w / h
    this.mirrorCam.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    // composer.setSize 内部会乘 pixelRatio 并把 effective 尺寸下发给所有 pass，这里只给 CSS 像素
    this.composer.setSize(w, h)
    const pr = this.renderer.getPixelRatio()
    this.water?.uniforms.uRes.value.set(this.composer.renderTarget1.width, this.composer.renderTarget1.height)
    this.reflRT.setSize(Math.max(2, Math.floor(w * pr * 0.5)), Math.max(2, Math.floor(h * pr * 0.5)))
    // 取景距离跟 aspect 挂钩，窗口尺寸一变就得重新算一次，否则底座会被拉出画面
    this.frameCamera(true)
  }

  private camPos = new THREE.Vector3()
  private camDir = new THREE.Vector3()
  private mirrorTargetPt = new THREE.Vector3()

  private renderReflection() {
    const P = WATER_Y
    this.camera.getWorldPosition(this.camPos)
    this.camera.getWorldDirection(this.camDir)
    this.mirrorCam.position.set(this.camPos.x, 2 * P - this.camPos.y, this.camPos.z)
    this.mirrorTargetPt.set(this.camPos.x + this.camDir.x, 2 * P - (this.camPos.y + this.camDir.y), this.camPos.z + this.camDir.z)
    this.mirrorCam.up.set(0, -1, 0)
    this.mirrorCam.lookAt(this.mirrorTargetPt)
    this.mirrorCam.fov = this.camera.fov
    this.mirrorCam.near = this.camera.near
    this.mirrorCam.far = this.camera.far
    this.mirrorCam.updateProjectionMatrix()
    this.mirrorCam.updateMatrixWorld(true)

    for (const o of this.hideList) o.visible = false
    this.renderer.clippingPlanes = [this.clipPlane]
    this.renderer.setRenderTarget(this.reflRT)
    this.renderer.clear()
    this.renderer.render(this.scene, this.mirrorCam)
    this.renderer.setRenderTarget(null)
    this.renderer.clippingPlanes = []
    for (const o of this.hideList) o.visible = true
  }

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, this.clock.getDelta())
    const t = this.clock.elapsedTime
    // 不允许把视角拖离底座
    const tgt = this.controls.target
    tgt.x = THREE.MathUtils.clamp(tgt.x, -6, 6)
    tgt.y = THREE.MathUtils.clamp(tgt.y, 0.2, 4.2)
    tgt.z = THREE.MathUtils.clamp(tgt.z, -6, 6)
    this.controls.update()

    for (const u of this.updaters) u(t, dt)
    this.atmosphereUpdate(t, dt, this.camera)
    if (this.grade.uniforms.uTime) this.grade.uniforms.uTime.value = t

    this.renderReflection()
    if (this.water) this.water.uniforms.uRefl.value = this.reflRT.texture
    this.composer.render(dt)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onWindowResize)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.ro?.disconnect()
    this.controls.dispose()
    this.composer.dispose()
    this.bloom.dispose()
    this.reflRT.dispose()
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh || (mesh as unknown as THREE.LineSegments).isLine || (obj as unknown as THREE.Points).isPoints) {
        mesh.geometry?.dispose?.()
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        mats.forEach((mm) => mm?.dispose?.())
      }
    })
    this.scene.clear()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
    disposeShared()
    disposeTextures()
    disposeGeoCache()
  }
}
