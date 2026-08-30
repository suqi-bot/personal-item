import * as THREE from 'three'
import { Kit } from './kit'
import { glowTex, ringTex, dropTex } from './textures'
import { L } from './layout'
import type { GlassPanel, Anchor } from './storeShell'

export interface AtmosphereInput {
  dripAnchors: [number, number, number][]
  steamAnchors: [number, number, number][]
  glassPanels: GlassPanel[]
  puddleSpots: [number, number][]
  anchors: Anchor[]
}

export interface AtmosphereResult {
  update(t: number, dt: number, camera: THREE.Camera): void
  /** 锚点颜色/强度被外部改写后，把变更推送到光晕实例缓冲 */
  setAnchorColor(anchor: Anchor): void
  hideForReflection: THREE.Object3D[]
}

const FALL_RANGE = 17

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 落在建筑体块内或屋檐下的雨痕会被剔除，避免雨“下进店里” */
function isExposed(x: number, z: number, y: number) {
  const inStore = x > L.store.minX - 0.2 && x < L.store.maxX + 1.5 && z > L.store.minZ - 0.2 && z < L.store.maxZ + L.facade.awningDepth + 0.1
  if (inStore && y < L.y.roof + 0.3) return false
  const underAwning = z > L.store.maxZ && z < L.store.maxZ + L.facade.awningDepth + 0.05 && x > L.store.minX && x < L.store.maxX && y < L.facade.awningY
  if (underAwning) return false
  const n = L.neighbor
  const boxes: [number, number, number, number, number][] = [
    [n.left.minX, n.left.maxX + 0.9, n.left.minZ, n.left.maxZ, n.left.height],
    [n.back.minX, n.back.maxX, n.back.minZ, n.back.maxZ + 0.9, n.back.height],
    [n.acrossRight.minX - 0.9, n.acrossRight.maxX, n.acrossRight.minZ, n.acrossRight.maxZ, n.acrossRight.height],
    [n.acrossFront.minX, n.acrossFront.maxX, n.acrossFront.minZ - 0.9, n.acrossFront.maxZ, n.acrossFront.height],
  ]
  for (const [x0, x1, z0, z1, h] of boxes) {
    if (x > x0 && x < x1 && z > z0 && z < z1 && y < h) return false
  }
  return true
}

function linearFadeTex() {
  const cv = document.createElement('canvas')
  cv.width = 16
  cv.height = 256
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D
  const g = ctx.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.16, 'rgba(255,255,255,0.66)')
  g.addColorStop(0.52, 'rgba(255,255,255,0.22)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 16, 256)
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

const softFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 tex = texture2D( uMap, vUv );
    float a = tex.a * vAlpha * uOpacity;
    if ( a < 0.005 ) discard;
    gl_FragColor = vec4( vColor * tex.rgb * 1.35, a );
  }
`

/** 下落粒子：屋檐滴水 + 降雨共用，位置来自 instanceMatrix 的 XZ */
const fallVert = /* glsl */ `
  attribute vec4 aSeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uFall;
  uniform float uRange;
  uniform float uBase;
  uniform float uNear;
  uniform float uLen;
  uniform float uHold;
  uniform float uGrav;
  uniform float uOver;
  uniform float uFadeNear;
  uniform float uFadeFar;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 origin = instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
    float speed = uFall * ( 0.72 + aSeed.y * 0.7 );
    float startY = uBase + origin.y;
    float fall = max( 0.5, min( startY + uOver, uRange ) );
    float life = fract( aSeed.x + uTime * speed / fall );
    // uHold < 1 时水滴只走完前一段行程，剩下的周期空着：落地后 prog 钉在 1，透明度自然归零，
    // 于是这一路就变成「攒一滴、掉一滴」的间歇节奏，而不是一条连续水帘。
    float prog = min( life / uHold, 1.0 );
    float y = startY - fall * mix( prog, prog * prog, uGrav );
    vec3 wp = vec3( origin.x, y, origin.z );
    vec4 mv = viewMatrix * vec4( wp, 1.0 );
    float slant = aSeed.z * uNear;
    mv.xy += vec2( position.x + position.y * slant, position.y * uLen * ( 0.55 + aSeed.w * 0.9 ) );
    vUv = uv;
    vAlpha = smoothstep( 1.0, 0.86, prog ) * smoothstep( uFadeFar, uFadeNear, -mv.z ) * smoothstep( 1.4, 4.5, -mv.z );
    vColor = aColor;
    gl_Position = projectionMatrix * mv;
  }
`

const splashVert = /* glsl */ `
  attribute vec4 aSeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uScale;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 origin = instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
    float life = fract( aSeed.x + uTime * uSpeed * ( 0.6 + aSeed.y * 0.9 ) );
    float sc = mix( 0.05, uScale, life ) * ( 0.5 + aSeed.w * 1.2 );
    vec3 p = vec3( position.x * sc, 0.0, position.y * sc );
    vec4 mv = modelViewMatrix * vec4( origin.xyz + p, 1.0 );
    vUv = uv;
    vAlpha = pow( 1.0 - life, 2.0 ) * 0.9;
    vColor = aColor;
    gl_Position = projectionMatrix * mv;
  }
`

/** 玻璃上的雨痕：贴着幕墙平面下滑，axis 决定平面朝向 */
const glassVert = /* glsl */ `
  attribute vec4 aSeed;
  attribute vec4 aPanel;
  attribute vec3 aColor;
  uniform float uTime;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 origin = instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
    float speed = 0.05 + aSeed.y * 0.1;
    float travel = fract( aSeed.x + uTime * speed );
    float y = aPanel.x + aPanel.y * ( 1.0 - travel );
    vec3 center = vec3( origin.x, y, origin.z );
    center.x += sin( travel * 21.0 + aSeed.z * 9.0 ) * 0.03;
    center.z += sin( travel * 15.0 + aSeed.z * 6.0 ) * 0.022;
    vec3 right = aPanel.z < 0.5 ? vec3( 1.0, 0.0, 0.0 ) : vec3( 0.0, 0.0, 1.0 );
    float w = 0.028 + aSeed.w * 0.05;
    float h = w * 2.6;
    vec3 wp = center + right * ( position.x * w ) + vec3( 0.0, position.y * h, 0.0 );
    vec4 mv = viewMatrix * vec4( wp, 1.0 );
    vUv = uv;
    vAlpha = sin( travel * 3.14159 ) * 0.95;
    vColor = aColor;
    gl_Position = projectionMatrix * mv;
  }
`

const riseVert = /* glsl */ `
  attribute vec4 aSeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uRange;
  uniform float uSpeed;
  uniform float uGrow;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 origin = instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
    float life = fract( aSeed.x + uTime * uSpeed );
    vec3 wp = origin.xyz + vec3(
      sin( life * 5.2 + aSeed.z * 8.0 ) * 0.2 * life,
      life * uRange,
      cos( life * 4.4 + aSeed.z * 7.0 ) * 0.17 * life );
    vec4 mv = viewMatrix * vec4( wp, 1.0 );
    float sc = mix( 0.22, uGrow, life ) * ( 0.7 + aSeed.y * 0.8 );
    mv.xy += position.xy * sc;
    vUv = uv;
    vAlpha = sin( life * 3.14159 );
    vColor = aColor;
    gl_Position = projectionMatrix * mv;
  }
`

const haloVert = /* glsl */ `
  attribute vec4 aSeed;
  attribute vec3 aColor;
  uniform float uTime;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 origin = instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
    vec4 mv = viewMatrix * origin;
    float pulse = 0.84 + 0.16 * sin( uTime * 1.9 + aSeed.z * 22.0 ) + 0.05 * sin( uTime * 15.0 + aSeed.x * 31.0 );
    mv.xy += position.xy * aSeed.w * pulse;
    vUv = uv;
    vAlpha = aSeed.x * pulse;
    vColor = aColor;
    gl_Position = projectionMatrix * mv;
  }
`

function seedAttr(geo: THREE.BufferGeometry, count: number, rand: () => number, color: [number, number, number]) {
  const seeds = new Float32Array(count * 4)
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = rand()
    seeds[i * 4 + 1] = rand()
    seeds[i * 4 + 2] = rand()
    seeds[i * 4 + 3] = rand()
    colors[i * 3] = color[0]
    colors[i * 3 + 1] = color[1]
    colors[i * 3 + 2] = color[2]
  }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4))
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3))
  return { seeds, colors }
}

export function buildAtmosphere(kit: Kit, input: AtmosphereInput): AtmosphereResult {
  const rand = seeded(20260829)
  const group = new THREE.Group()
  group.name = 'atmosphere'
  kit.attach(group)
  const hideForReflection: THREE.Object3D[] = []
  const m4 = new THREE.Matrix4()

  const streak = (w = 0.02) => new THREE.PlaneGeometry(w, 1)

  interface FallOpts {
    opacity: number
    speed: number
    range: number
    base?: number
    slant?: number
    len?: number
    /** 一个周期里真正下落的时间占比，1 = 连续水帘 */
    hold?: number
    /** 0 = 匀速，1 = 全程重力加速 */
    grav?: number
    /** 落地后继续穿透地面的余量 */
    over?: number
    fadeNear?: number
    fadeFar?: number
  }

  const fallMat = (map: THREE.Texture, o: FallOpts) =>
    new THREE.ShaderMaterial({
      vertexShader: fallVert,
      fragmentShader: softFrag,
      uniforms: {
        uTime: { value: 0 },
        uFall: { value: o.speed },
        uRange: { value: o.range },
        uBase: { value: o.base ?? 0 },
        uNear: { value: o.slant ?? 0 },
        uLen: { value: o.len ?? 1 },
        uHold: { value: o.hold ?? 1 },
        uGrav: { value: o.grav ?? 0 },
        uOver: { value: o.over ?? 1.4 },
        uFadeNear: { value: o.fadeNear ?? 18 },
        uFadeFar: { value: o.fadeFar ?? 46 },
        uMap: { value: map },
        uOpacity: { value: o.opacity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

  // ==================== 降雨 ====================
  const rainMats: THREE.ShaderMaterial[] = []
  const makeRain = (count: number, area: number, opacity: number, speed: number, slant: number, tint: [number, number, number]) => {
    const geo = streak()
    seedAttr(geo, count, rand, tint)
    const mat = fallMat(dropTex(), { opacity, speed, range: FALL_RANGE, slant })
    const mesh = new THREE.InstancedMesh(geo, mat, count)
    for (let i = 0; i < count; i++) {
      let x = 0
      let z = 0
      for (let k = 0; k < 24; k++) {
        x = (rand() - 0.5) * area
        z = (rand() - 0.5) * area
        if (isExposed(x, z, 0.4)) break
      }
      m4.makeTranslation(x, rand() * 3.4, z)
      mesh.setMatrixAt(i, m4)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
    mesh.renderOrder = 30
    mesh.userData.noReflect = true
    group.add(mesh)
    rainMats.push(mat)
  }
  makeRain(2400, 34, 0.5, 17, 0.16, [0.66, 0.79, 1])
  makeRain(1000, 54, 0.3, 12, 0.1, [0.58, 0.7, 0.95])

  // ==================== 屋檐 / 雨棚 / 空调滴水 ====================
  const drips = input.dripAnchors.length ? input.dripAnchors : [[0, 3, 0]]
  const dripCount = Math.min(320, drips.length * 3)
  const dripGeo = streak(0.11)
  seedAttr(dripGeo, dripCount, rand, [0.74, 0.86, 1])
  // 滴水必须比雨更「实体」：雨靠数量堆出密度，而滴水只有几十颗，默认机位下 40 单位的视距
  // 既会把细线压成亚像素，也会被远处的淡出曲线吃掉，所以这里单独放宽淡出窗口、加粗拖尾。
  const dripMat = fallMat(dropTex(), {
    opacity: 0.5,
    speed: 2.1,
    range: 9,
    slant: 0.02,
    len: 0.46,
    hold: 0.42,
    grav: 0.5,
    over: 0.35,
    fadeNear: 30,
    fadeFar: 86,
  })
  const dripMesh = new THREE.InstancedMesh(dripGeo, dripMat, dripCount)
  for (let i = 0; i < dripCount; i++) {
    const a = drips[i % drips.length]
    m4.makeTranslation(a[0] + (rand() - 0.5) * 0.1, a[1], a[2] + (rand() - 0.5) * 0.1)
    dripMesh.setMatrixAt(i, m4)
  }
  dripMesh.instanceMatrix.needsUpdate = true
  dripMesh.frustumCulled = false
  dripMesh.renderOrder = 31
  dripMesh.userData.noReflect = true
  group.add(dripMesh)
  hideForReflection.push(dripMesh)

  // ==================== 积水涟漪 / 雨点溅射 ====================
  const splashCount = 460
  const ringGeo = new THREE.PlaneGeometry(1, 1)
  ringGeo.rotateX(-Math.PI / 2)
  seedAttr(ringGeo, splashCount, rand, [0.7, 0.82, 1])
  const splashMat = new THREE.ShaderMaterial({
    vertexShader: splashVert,
    fragmentShader: softFrag,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 0.7 },
      uScale: { value: 0.68 },
      uMap: { value: ringTex() },
      uOpacity: { value: 0.85 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const splashMesh = new THREE.InstancedMesh(ringGeo, splashMat, splashCount)
  const spots = input.puddleSpots.length ? input.puddleSpots : [[0, 4]]
  for (let i = 0; i < splashCount; i++) {
    let x: number
    let z: number
    if (i % 2 === 0) {
      const s = spots[i % spots.length]
      x = s[0] + (rand() - 0.5) * 3.2
      z = s[1] + (rand() - 0.5) * 3.2
    } else {
      x = (rand() - 0.5) * 19
      z = (rand() - 0.5) * 19
    }
    m4.makeTranslation(x, 0.035, z)
    splashMesh.setMatrixAt(i, m4)
  }
  splashMesh.instanceMatrix.needsUpdate = true
  splashMesh.frustumCulled = false
  splashMesh.renderOrder = 8
  splashMesh.userData.noReflect = true
  group.add(splashMesh)
  hideForReflection.push(splashMesh)

  // ==================== 玻璃雨痕 ====================
  const panels = input.glassPanels.length ? input.glassPanels : [{ center: [0, 1.5, 0] as [number, number, number], size: [3, 2.6] as [number, number], axis: 'z' as const, sign: 1 }]
  const gdCount = Math.min(320, panels.length * 26)
  const gdGeo = new THREE.PlaneGeometry(1, 1)
  seedAttr(gdGeo, gdCount, rand, [0.86, 0.93, 1])
  const gdPanel = new Float32Array(gdCount * 4)
  const gdMesh = new THREE.InstancedMesh(gdGeo, new THREE.ShaderMaterial({
    vertexShader: glassVert,
    fragmentShader: softFrag,
    uniforms: { uTime: { value: 0 }, uMap: { value: dropTex() }, uOpacity: { value: 0.7 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  }), gdCount)
  for (let i = 0; i < gdCount; i++) {
    const p = panels[i % panels.length]
    const along = (rand() - 0.5) * p.size[0] * 0.95
    if (p.axis === 'z') {
      m4.makeTranslation(p.center[0] + along, 0, p.center[2] + 0.05 * p.sign)
      gdPanel[i * 4] = L.y.storeFloor + 0.1
      gdPanel[i * 4 + 1] = p.size[1] * 0.92
      gdPanel[i * 4 + 2] = 0
    } else {
      m4.makeTranslation(p.center[0] + 0.05 * p.sign, 0, p.center[2] + along)
      gdPanel[i * 4] = L.y.storeFloor + 0.1
      gdPanel[i * 4 + 1] = p.size[1] * 0.92
      gdPanel[i * 4 + 2] = 1
    }
    gdPanel[i * 4 + 3] = 0
    gdMesh.setMatrixAt(i, m4)
  }
  gdMesh.instanceMatrix.needsUpdate = true
  gdGeo.setAttribute('aPanel', new THREE.InstancedBufferAttribute(gdPanel, 4))
  gdMesh.frustumCulled = false
  gdMesh.renderOrder = 32
  gdMesh.userData.noReflect = true
  const gdMat = gdMesh.material as THREE.ShaderMaterial
  group.add(gdMesh)
  hideForReflection.push(gdMesh)

  // ==================== 关东煮 / 咖啡蒸汽 ====================
  const steams = input.steamAnchors.length ? input.steamAnchors : [[0, 1, 0]]
  const steamCount = Math.min(140, steams.length * 14)
  const steamGeo = new THREE.PlaneGeometry(1, 1)
  seedAttr(steamGeo, steamCount, rand, [1, 0.94, 0.85])
  const steamMat = new THREE.ShaderMaterial({
    vertexShader: riseVert,
    fragmentShader: softFrag,
    uniforms: {
      uTime: { value: 0 },
      uRange: { value: 1.05 },
      uSpeed: { value: 0.2 },
      uGrow: { value: 0.85 },
      uMap: { value: glowTex() },
      uOpacity: { value: 0.16 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  })
  const steamMesh = new THREE.InstancedMesh(steamGeo, steamMat, steamCount)
  for (let i = 0; i < steamCount; i++) {
    const a = steams[i % steams.length]
    m4.makeTranslation(a[0] + (rand() - 0.5) * 0.16, a[1], a[2] + (rand() - 0.5) * 0.16)
    steamMesh.setMatrixAt(i, m4)
  }
  steamMesh.instanceMatrix.needsUpdate = true
  steamMesh.frustumCulled = false
  steamMesh.renderOrder = 33
  steamMesh.userData.noReflect = true
  group.add(steamMesh)
  hideForReflection.push(steamMesh)

  // ==================== 灯光光晕 ====================
  const haloCount = Math.max(1, input.anchors.length)
  const haloGeo = new THREE.PlaneGeometry(1, 1)
  const haloIndex = new Map<Anchor, number>()
  const haloSeeds = new Float32Array(haloCount * 4)
  const haloColors = new Float32Array(haloCount * 3)
  const haloMesh = new THREE.InstancedMesh(haloGeo, new THREE.ShaderMaterial({
    vertexShader: haloVert,
    fragmentShader: softFrag,
    uniforms: { uTime: { value: 0 }, uMap: { value: glowTex() }, uOpacity: { value: 0.15 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), haloCount)
  {
    const c = new THREE.Color()
    for (let i = 0; i < haloCount; i++) {
      const a = input.anchors[i]
      m4.makeTranslation(a.pos[0], a.pos[1], a.pos[2])
      haloMesh.setMatrixAt(i, m4)
      haloSeeds[i * 4] = Math.min(1, 0.3 + a.intensity * 0.45)
      haloSeeds[i * 4 + 1] = rand()
      haloSeeds[i * 4 + 2] = rand()
      haloSeeds[i * 4 + 3] = a.size * (0.3 + rand() * 0.22)
      c.set(a.color)
      haloColors[i * 3] = c.r
      haloColors[i * 3 + 1] = c.g
      haloColors[i * 3 + 2] = c.b
      haloIndex.set(a, i)
    }
  }
  const haloSeedAttr = new THREE.InstancedBufferAttribute(haloSeeds, 4)
  const haloColorAttr = new THREE.InstancedBufferAttribute(haloColors, 3)
  haloGeo.setAttribute('aSeed', haloSeedAttr)
  haloGeo.setAttribute('aColor', haloColorAttr)
  haloMesh.instanceMatrix.needsUpdate = true
  haloMesh.frustumCulled = false
  haloMesh.renderOrder = 34
  haloMesh.userData.noReflect = true
  const haloMat = haloMesh.material as THREE.ShaderMaterial
  group.add(haloMesh)

  // ==================== 湿地面霓虹拖影 ====================
  const smearTex = linearFadeTex()
  const smears: { mesh: THREE.Mesh; base: THREE.Vector3 }[] = []
  input.anchors
    .filter((a) => a.floorRef)
    .forEach((a) => {
      const len = THREE.MathUtils.clamp(a.size * 0.62, 1.6, 6.5)
      const wid = THREE.MathUtils.clamp(a.size * 0.16, 0.4, 1.3)
      const geo = new THREE.PlaneGeometry(wid, len)
      geo.translate(0, -len / 2, 0)
      geo.rotateX(-Math.PI / 2)
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(a.color).multiplyScalar(0.62 * a.intensity),
          map: smearTex,
          transparent: true,
          opacity: 0.42,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      const onWalk = a.pos[0] < L.road.rightMin && a.pos[2] < L.road.frontMin
      mesh.position.set(a.pos[0], onWalk ? L.y.walk + 0.016 : 0.036, a.pos[2])
      mesh.renderOrder = 6
      mesh.userData.noReflect = true
      group.add(mesh)
      smears.push({ mesh, base: new THREE.Vector3(a.pos[0], 0, a.pos[2]) })
      hideForReflection.push(mesh)
    })

  const camPos = new THREE.Vector3()
  const tmpColor = new THREE.Color()
  return {
    hideForReflection,
    setAnchorColor(anchor: Anchor) {
      const i = haloIndex.get(anchor)
      if (i === undefined) return
      tmpColor.set(anchor.color)
      haloColors[i * 3] = tmpColor.r
      haloColors[i * 3 + 1] = tmpColor.g
      haloColors[i * 3 + 2] = tmpColor.b
      haloSeeds[i * 4] = Math.min(1, 0.3 + anchor.intensity * 0.45)
      haloColorAttr.needsUpdate = true
      haloSeedAttr.needsUpdate = true
    },
    update(t: number, _dt: number, camera: THREE.Camera) {
      rainMats.forEach((m) => (m.uniforms.uTime.value = t))
      dripMat.uniforms.uTime.value = t
      splashMat.uniforms.uTime.value = t
      gdMat.uniforms.uTime.value = t
      steamMat.uniforms.uTime.value = t
      haloMat.uniforms.uTime.value = t
      camera.getWorldPosition(camPos)
      for (const s of smears) {
        const dx = camPos.x - s.base.x
        const dz = camPos.z - s.base.z
        s.mesh.rotation.y = Math.atan2(dx, dz)
        const dist = Math.hypot(dx, dz)
        s.mesh.scale.setScalar(THREE.MathUtils.clamp(0.6 + dist * 0.05, 0.6, 1.35))
      }
    },
  }
}
