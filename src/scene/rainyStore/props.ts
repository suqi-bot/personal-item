import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { L } from './layout'
import { PAL, glow, glowMap, toon, toonSoft } from './materials'
import type { Kit, PartOpts } from './kit'
import { boxGeo, catenary, coneGeo, cylGeo, planeGeo, rboxGeo, sphereGeo, torusGeo, tubeGeo } from './kit'
import {
  bannerTex,
  bulletinTex,
  glowTex,
  grateTex,
  lightboxTex,
  noiseTex,
  plasterTex,
  posterTex,
  stripTex,
  trafficSignTex,
  vendingFrontTex,
} from './textures'

/**
 * 雨夜便利店街角 —— 户外街角道具 + 框景邻家建筑
 *
 * 坐标严格遵循 layout.ts；所有零件通过 kit 追加，finalize() 由场景组装层统一调用。
 * 目标：三渲二剪影干净（大件线稿 / 小件批量实例化），确定性随机，update() 只做轻量动画。
 */

export interface PropsResult {
  /** 自发光锚点：用于潮湿地面的风格化反光与光晕 */
  anchors: { pos: [number, number, number]; color: number; size: number; intensity: number; floorRef?: boolean }[]
  /** 屋檐/道具滴水点（天气模块会生成下落水滴与涟漪） */
  dripAnchors: [number, number, number][]
  /** 信号灯光晕锚点：update 会改写它的颜色，需要由外部同步到光晕实例缓冲 */
  signal: { pos: [number, number, number]; color: number; size: number; intensity: number; floorRef?: boolean }
  /** 会随风或电流轻微摆动的物体（电线/のぼり/信号等），由 update 驱动 */
  update(t: number, dt: number): void
}

type P3 = [number, number, number]
type Opts = PartOpts & { r?: number }
type Scale = number | P3

/* =================================================================== */
/* 基础工具                                                            */
/* =================================================================== */

/** mulberry32：确定性伪随机，保证每次加载完全一致 */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function circleGeo(r: number, seg = 18) {
  return new THREE.CircleGeometry(r, seg)
}

/** 克隆 + 摆位（绝不改动 kit 的共享几何缓存） */
function xf(geo: THREE.BufferGeometry, pos: P3, rot?: P3, scale?: P3): THREE.BufferGeometry {
  const g = geo.clone()
  if (rot) {
    if (rot[0]) g.rotateX(rot[0])
    if (rot[1]) g.rotateY(rot[1])
    if (rot[2]) g.rotateZ(rot[2])
  }
  if (scale) g.scale(scale[0], scale[1], scale[2])
  g.translate(pos[0], pos[1], pos[2])
  return g
}

/** 多零件烘成一份几何 → 一个 mesh、一次线稿烘焙 */
function join(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const list = parts.map((p) => {
    const q = p.index ? p.toNonIndexed() : p
    if (q !== p) p.dispose()
    return q
  })
  const merged = mergeGeometries(list, false)
  list.forEach((g) => g.dispose())
  return merged ?? list[0]
}

const bl = (p: P3, w: number, h: number, d: number, rot?: P3) => xf(boxGeo(w, h, d), p, rot)
const rl = (p: P3, w: number, h: number, d: number, r = 0.03, rot?: P3) => xf(rboxGeo(w, h, d, r), p, rot)
const pv = (list: P3[]) => list.map((p) => new THREE.Vector3(p[0], p[1], p[2]))

/** 三点二次贝塞尔（路灯挑臂） */
function curve3(a: P3, b: P3, d: P3, n = 10): P3[] {
  const out: P3[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const w0 = (1 - t) * (1 - t)
    const w1 = 2 * t * (1 - t)
    const w2 = t * t
    out.push([
      a[0] * w0 + b[0] * w1 + d[0] * w2,
      a[1] * w0 + b[1] * w1 + d[1] * w2,
      a[2] * w0 + b[2] * w1 + d[2] * w2,
    ])
  }
  return out
}

interface Batch {
  geo: THREE.BufferGeometry
  mat: THREE.Material
  list: { pos: P3; rot?: P3; scale?: Scale }[]
}

interface Sway {
  obj: THREE.Object3D
  amp: number
  freq: number
  phase: number
}
interface Spin {
  mesh: THREE.Mesh
  speed: number
}
interface Wire {
  mesh: THREE.Mesh
  amp: number
  freq: number
  phase: number
}
interface Pulse {
  mat: THREE.MeshBasicMaterial
  base: THREE.Color
  phase: number
  amount: number
}

interface Ctx {
  kit: Kit
  anchors: PropsResult['anchors']
  drips: PropsResult['dripAnchors']
  rnd: () => number
  batches: Map<string, Batch>
  flat: THREE.BufferGeometry
}

function put(c: Ctx, geo: THREE.BufferGeometry, mat: THREE.Material, o: Opts = {}) {
  return c.kit.add(geo, mat, o)
}

function anchor(c: Ctx, pos: P3, color: number, size: number, intensity: number, floorRef = true) {
  const a = { pos, color, size, intensity, floorRef }
  c.anchors.push(a)
  return a
}

function batch(c: Ctx, key: string, geo: THREE.BufferGeometry, mat: THREE.Material, pos: P3, rot?: P3, scale?: Scale) {
  let b = c.batches.get(key)
  if (!b) {
    b = { geo, mat, list: [] }
    c.batches.set(key, b)
  }
  b.list.push({ pos, rot, scale })
}

/** 带父级变换的实例登记（自行车 / 滑板车等局部坐标系里的重复件） */
function batchAt(
  c: Ctx,
  key: string,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  parent: THREE.Matrix4,
  pos: P3,
  rot?: P3,
  scale?: Scale,
) {
  const s = typeof scale === 'number' ? ([scale, scale, scale] as P3) : scale
  const local = new THREE.Matrix4().compose(
    new THREE.Vector3(pos[0], pos[1], pos[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0)),
    new THREE.Vector3(s ? s[0] : 1, s ? s[1] : 1, s ? s[2] : 1),
  )
  const m = local.premultiply(parent)
  const p = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const sv = new THREE.Vector3()
  m.decompose(p, q, sv)
  const e = new THREE.Euler().setFromQuaternion(q)
  batch(c, key, geo, mat, [p.x, p.y, p.z], [e.x, e.y, e.z], [sv.x, sv.y, sv.z])
}

/** 局部坐标系分组：先按 kit 零件加入，再整体重挂到 group 上 */
function localFrame(c: Ctx, pos: P3, rot: P3, scale = 1) {
  const g = new THREE.Group()
  g.position.fromArray(pos)
  g.rotation.fromArray(rot)
  g.scale.setScalar(scale)
  c.kit.attach(g)
  const mtx = new THREE.Matrix4().compose(
    new THREE.Vector3(pos[0], pos[1], pos[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])),
    new THREE.Vector3(scale, scale, scale),
  )
  const owned: THREE.Object3D[] = []
  return {
    mtx,
    put(geo: THREE.BufferGeometry, mat: THREE.Material, o: Opts = {}) {
      const mesh = c.kit.add(geo, mat, o)
      owned.push(mesh)
      return mesh
    },
    rep(key: string, geo: THREE.BufferGeometry, mat: THREE.Material, p: P3, rot?: P3, sc?: Scale) {
      batchAt(c, key, geo, mat, mtx, p, rot, sc)
    },
    finish() {
      owned.forEach((o) => g.add(o))
      g.updateMatrixWorld(true)
      return g
    },
  }
}

/* =================================================================== */
/* 材质集                                                             */
/* =================================================================== */

function nTex(rx: number, ry: number) {
  const t = noiseTex().clone()
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rx, ry)
  t.needsUpdate = true
  return t
}

function makeMats() {
  const wet = { sheen: 0.14, sheenColor: 0x86a9dd, rimStrength: 0.2 }
  return {
    metal: toon(PAL.metal, { fx: { ...wet, rimStrength: 0.26 } }),
    metalDark: toon(PAL.metalDark, { fx: wet }),
    steel: toonSoft(PAL.metal, { map: nTex(5, 5), fx: wet }),
    concrete: toonSoft(PAL.concrete, { map: nTex(5, 5), fx: { sheen: 0.08 } }),
    concreteDark: toonSoft(PAL.asphaltDeep, { map: nTex(4, 4), fx: { sheen: 0.07 } }),
    curb: toonSoft(PAL.curb, { fx: wet }),
    asphaltDark: toonSoft(0x181e2e, { map: nTex(6, 6) }),
    paint: toon(PAL.paint, { fx: wet }),
    paintDim: toon(0xb6c1d5, { fx: wet }),
    rubber: toon(PAL.rubber, { fx: { rimStrength: 0.14 } }),
    wood: toon(PAL.wood, { fx: { sheen: 0.06 } }),
    rust: toon(PAL.rust, { fx: wet }),
    paper: toon(PAL.paper, { fx: { sheen: 0.06 } }),
    glassDark: toon(0x1a2233, { fx: { sheen: 0.34, rimStrength: 0.32, rimSize: 0.5 } }),
    glassWet: toonSoft(PAL.glassTint, { transparent: true, opacity: 0.17, fx: { sheen: 0.5, rimStrength: 0.4 } }),
    vanGlass: toon(0x27314a, { fx: { sheen: 0.44, rimStrength: 0.36, rimSize: 0.46 } }),
    teal: toon(PAL.teal, { fx: wet }),
    tealDeep: toon(PAL.tealDeep, { fx: wet }),
    blue: toon(PAL.blue, { fx: wet }),
    blueDeep: toon(PAL.blueDeep, { fx: wet }),
    red: toon(PAL.red, { fx: wet }),
    green: toon(PAL.green, { fx: wet }),
    yellow: toon(PAL.yellow, { fx: wet }),
    orange: toon(PAL.orange, { fx: wet }),
    bag: toon(0xd8dfe8, { transparent: true, opacity: 0.88, fx: { sheen: 0.3 } }),
    grate: toon(0xffffff, { map: grateTex() }),
    paneLit: glow(PAL.warmLight, 0.62),
    lensOff: toon(0x27304a, { fx: { sheen: 0.14 } }),
  }
}

type Mats = ReturnType<typeof makeMats>

/* =================================================================== */
/* 1. 自动贩卖机                                                       */
/* =================================================================== */

function vendingMachines(c: Ctx, m: Mats, pulses: Pulse[]) {
  const D = 0.44
  const H = 1.82
  const defs = [
    { x: 2.05, z: -6.4, kind: 'drink' as const, w: 0.98, body: 0xa8433f, strip: 'ドリンク', tint: PAL.red, base: L.y.walk },
    { x: 2.05, z: -5.1, kind: 'soda' as const, w: 0.98, body: 0x2c5a91, strip: 'スパーク', tint: PAL.blue, base: L.y.walk },
    { x: 2.05, z: -3.35, kind: 'soup' as const, w: 0.9, body: 0x9c5f28, strip: 'あたたか', tint: PAL.orange, base: L.y.walk },
    { x: -8.9, z: -3.6, kind: 'soda' as const, w: 0.86, body: 0x2c5a91, strip: 'ジュース', tint: PAL.neonCyan, base: 0.05 },
  ]
  for (const d of defs) {
    const yc = d.base + 0.12 + H / 2
    const bodyM = toon(d.body, { fx: { sheen: 0.16, rimStrength: 0.22 } })
    put(c, rboxGeo(D, H, d.w, 0.035), bodyM, { pos: [d.x, yc, d.z], line: 'dark' })

    const faceM = glowMap(0xffffff, vendingFrontTex(d.kind), 1.04)
    put(c, xf(planeGeo(d.w - 0.05, H - 0.06), [D / 2 + 0.005, 0, 0], [0, Math.PI / 2, 0]), faceM, { pos: [d.x, yc, d.z] })
    pulses.push({ mat: faceM, base: faceM.color.clone(), phase: c.rnd() * 6.28, amount: 0.045 })
    anchor(c, [d.x + 0.44, yc, d.z], d.tint, 1.75, 1.05)

    put(c, xf(planeGeo(d.w * 0.6, 0.84), [D / 2 + 0.016, 0.25, -0.02], [0, Math.PI / 2, 0]), m.glassWet, { pos: [d.x, yc, d.z] })
    // 侧板 / 基座 / 顶箱
    put(
      c,
      join([
        bl([0, 0, (d.w + 0.016) / 2], D + 0.02, H - 0.14, 0.03),
        bl([0, 0, -(d.w + 0.016) / 2], D + 0.02, H - 0.14, 0.03),
        bl([0, -H / 2 - 0.06, 0], D + 0.09, 0.14, d.w + 0.07),
        bl([0.02, H / 2 + 0.06, 0], D - 0.06, 0.13, d.w - 0.1),
      ]),
      m.metalDark,
      { pos: [d.x, yc, d.z], line: 'dark' },
    )
    // 投币口 / 按钮 / 取货 flap
    put(
      c,
      join([
        bl([D / 2 + 0.02, -H / 2 + 0.44, 0], 0.03, 0.22, d.w * 0.54),
        bl([D / 2 + 0.014, 0.16, d.w * 0.3], 0.05, 0.34, 0.15),
        bl([D / 2 + 0.036, 0.3, d.w * 0.3], 0.02, 0.06, 0.09),
        bl([D / 2 + 0.03, -H / 2 + 0.44, 0], 0.012, 0.16, d.w * 0.46),
      ]),
      m.metal,
      { pos: [d.x, yc, d.z] },
    )
    // 顶部灯条
    const barM = glow(d.tint, 1.7)
    put(c, xf(planeGeo(d.w - 0.2, 0.06), [D / 2 + 0.024, H / 2 + 0.06, 0], [0, Math.PI / 2, 0]), barM, { pos: [d.x, yc, d.z] })
    // 侧面品牌条
    put(c, planeGeo(0.3, 0.1), toon(0xffffff, { map: stripTex(d.strip, '#f4f7ff', '#2b3245', 64) }), {
      pos: [d.x + 0.02, yc + H / 2 - 0.16, d.z + d.w / 2 + 0.022],
    })
    c.drips.push([d.x + D / 2, yc + H / 2 + 0.11, d.z])
  }
}

/* =================================================================== */
/* 2. 自行车                                                           */
/* =================================================================== */

interface BikeSpec {
  x: number
  z: number
  ry: number
  roll?: number
  s?: number
  color: number
  basket?: boolean
  umbrella?: boolean
}

function bicycle(c: Ctx, m: Mats, o: BikeSpec) {
  const s = o.s ?? 1
  const R = 0.33
  // localFrame 已经整体缩放 s，零件一律写在原始局部坐标里，避免二次缩放导致 s≠1 时互相穿插
  const t = (p: P3): P3 => p
  const V = (p: P3) => new THREE.Vector3(...t(p))
  const local = localFrame(c, [o.x, L.y.walk, o.z], [0, o.ry, o.roll ?? 0], s)
  const bodyM = toon(o.color, { fx: { sheen: 0.2, rimStrength: 0.24 } })

  const A: P3 = [0, R, 0] // 后轴
  const B: P3 = [-0.26, 0.92, 0] // 座管顶
  const C: P3 = [-0.06, 0.28, 0] // 五通
  const D: P3 = [0.98, R, 0] // 前轴
  const E: P3 = [0.8, 0.9, 0] // 头管顶
  const F: P3 = [0.87, 0.44, 0] // 头管底

  local.put(
    join([
      tubeGeo([V(B), V([-0.16, 0.62, 0]), V(C), V([0.24, 0.26, 0]), V([0.55, 0.33, 0]), V(F)], 0.026),
      tubeGeo([V(C), V(B)], 0.024),
      tubeGeo([V(F), V(E)], 0.028),
      tubeGeo([V(E), V([0.9, 0.68, 0.05]), V(D)], 0.016),
      tubeGeo([V(E), V([0.9, 0.68, -0.05]), V(D)], 0.016),
      tubeGeo([V(B), V([0.12, 0.63, 0.045]), V(A)], 0.014),
      tubeGeo([V(B), V([0.12, 0.63, -0.045]), V(A)], 0.014),
      tubeGeo([V(C), V([-0.3, 0.3, 0.06]), V(A)], 0.014),
      tubeGeo([V(C), V([-0.3, 0.3, -0.06]), V(A)], 0.014),
      tubeGeo([V(E), V([0.76, 1.0, 0]), V([0.72, 1.05, -0.18])], 0.016),
      tubeGeo([V(E), V([0.76, 1.0, 0]), V([0.72, 1.05, 0.18])], 0.016),
      tubeGeo(V([0.5, 1.06, 0]) ? [V([-0.08, 0.27, -0.05]), V([-0.17, 0.03, -0.17])] : [], 0.012),
      tubeGeo([V([-0.02, 0.76, 0.14]), V([-0.36, 0.79, 0.12]), V([-0.4, 0.76, -0.12]), V([-0.02, 0.74, -0.14])], 0.011),
    ]),
    bodyM,
    { line: 'soft' },
  )

  const tire = torusGeo(R, 0.03, 22, 7)
  local.put(xf(tire, t(A)), m.rubber)
  local.put(xf(tire, t(D)), m.rubber)
  const spoke = cylGeo(0.005, 0.005, R * 1.8, 4)
  for (const hub of [A, D]) {
    for (let i = 0; i < 10; i++) local.rep('spoke', spoke, m.paintDim, t(hub), [0, 0, (i / 10) * Math.PI])
  }
  local.put(
    join([
      xf(torusGeo(R - 0.038, 0.013, 22, 5), t(A)),
      xf(torusGeo(R - 0.038, 0.013, 22, 5), t(D)),
      bl(t(A), 0.06, 0.06, 0.1, [Math.PI / 2, 0, 0]),
      bl(t(D), 0.06, 0.06, 0.1, [Math.PI / 2, 0, 0]),
      bl(t(C), 0.17, 0.014, 0.02),
      bl(t([0.04, 0.21, -0.1]), 0.12, 0.018, 0.05),
      bl(t([-0.12, 0.35, 0.1]), 0.12, 0.018, 0.05),
      bl(t([0.73, 1.05, 0]), 0.03, 0.03, 0.36),
    ]),
    m.metalDark,
  )
  local.put(xf(torusGeo(0.105, 0.011, 18, 5), t(C)), m.metal)
  local.put(rl(t([-0.25, 0.99, 0]), 0.16, 0.05, 0.22, 0.024), m.rubber)
  local.put(xf(cylGeo(0.05, 0.055, 0.07, 10), t([0.94, 0.63, 0]), [0, 0, Math.PI / 2]), m.paintDim)
  local.put(xf(circleGeo(0.04), t([0.98, 0.63, 0]), [0, Math.PI / 2, 0]), glow(PAL.warmLight, 1.5))
  local.put(bl(t([-0.4, 0.72, 0]), 0.012, 0.05, 0.06), glow(PAL.red, 1.1))
  if (o.basket !== false) {
    local.put(rl(t([-0.2, 0.87, 0]), 0.32, 0.18, 0.3, 0.022), toon(0x4d5670, { fx: { sheen: 0.18 } }), { line: 'soft' })
  }
  if (o.umbrella) {
    // 伞钩挂在横把上，伞尖垂到斜管上方；整把伞贴在 z 0.17，避开车架（|z|≤0.074）与两轮（|z|≤0.035）
    local.put(
      join([
        xf(cylGeo(0.011, 0.011, 0.427, 7), t([0.7085, 0.8125, 0.17]), [0, 0, -0.087]),
        xf(cylGeo(0.055, 0.016, 0.28, 9), t([0.7029, 0.7594, 0.17]), [0, 0, -0.087]),
        xf(torusGeo(0.034, 0.009, 12, 5), t([0.73, 1.045, 0.17])),
      ]),
      toon(0x9a5c74, { fx: { sheen: 0.24 } }),
    )
  }
  local.finish()
}

/* =================================================================== */
/* 3. 駐輪場                                                           */
/* =================================================================== */

function bikePark(c: Ctx, m: Mats) {
  const zc = -1.42
  const xs = [-5.35, -4.88, -4.41, -3.94]
  const hoop = tubeGeo(
    pv([
      [0, 0, 0.17],
      [0, 0.16, 0.172],
      [0, 0.3, 0.12],
      [0, 0.36, 0],
      [0, 0.3, -0.12],
      [0, 0.16, -0.172],
      [0, 0, -0.17],
    ]),
    0.021,
  )
  xs.forEach((x) => batch(c, 'rackHoop', hoop, m.metal, [x, L.y.walk, zc]))
  const legs = cylGeo(0.021, 0.021, 0.14, 6)
  xs.forEach((x) => {
    batch(c, 'rackLeg', legs, m.metal, [x, L.y.walk - 0.05, zc + 0.17])
    batch(c, 'rackLeg', legs, m.metal, [x, L.y.walk - 0.05, zc - 0.17])
  })
  const line = c.flat
  const lm = toon(PAL.paint, { fx: { sheen: 0.16 } })
  ;(
    [
      { pos: [-4.64, 0.175, zc + 0.46] as P3, sc: [2.06, 0.06, 1] as P3 },
      { pos: [-4.64, 0.175, zc - 0.5] as P3, sc: [2.06, 0.06, 1] as P3 },
      { pos: [-5.67, 0.175, zc - 0.02] as P3, sc: [0.06, 0.96, 1] as P3 },
      { pos: [-3.61, 0.175, zc - 0.02] as P3, sc: [0.06, 0.96, 1] as P3 },
    ] as { pos: P3; sc: P3 }[]
  ).forEach((s) => batch(c, 'roadLine', line, lm, s.pos, undefined, s.sc))
  put(c, xf(planeGeo(0.9, 0.3), [0, 0, 0], [-Math.PI / 2, 0, 0]), toon(0xffffff, { map: stripTex('自転車 駐輪場', '#2f6f9c', '#f2f7ff', 96) }), {
    pos: [-4.64, 0.178, zc - 0.86],
  })
  put(c, xf(cylGeo(0.035, 0.04, 0.68, 10), [0, 0.34, 0]), m.metalDark, { pos: [-5.72, L.y.walk, zc - 0.6] })
  put(c, xf(planeGeo(0.4, 0.13), [0, 0, 0], [0, 0.5, 0]), toon(0xffffff, { map: stripTex('駐輪禁止', '#f4f7ff', '#c94a45', 48) }), {
    pos: [-5.72, L.y.walk + 0.6, zc - 0.58],
    rot: [0, 0.5, 0],
  })
}

/* =================================================================== */
/* 4. 雨伞架 + 地上敞开的伞                                            */
/* =================================================================== */

function umbrellaStand(c: Ctx, m: Mats) {
  const x = 1.45
  const z = -1.5
  const y0 = L.y.walk
  put(
    c,
    join([
      xf(torusGeo(0.21, 0.017, 18, 6), [0, 0.56, 0]),
      xf(torusGeo(0.205, 0.015, 18, 6), [0, 0.2, 0]),
      xf(cylGeo(0.235, 0.24, 0.045, 16), [0, 0.02, 0]),
    ]),
    m.metalDark,
    { pos: [x, y0, z], line: 'soft' },
  )
  const slat = boxGeo(0.026, 0.5, 0.012)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    batch(c, 'umbSlat', slat, m.metal, [x + Math.cos(a) * 0.215, y0 + 0.33, z + Math.sin(a) * 0.215], [0, -a, 0])
  }
  const cols = [PAL.red, PAL.blue, PAL.teal, 0x6d5a86, 0xf0e6d2]
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.42
    const lean = 0.05 + c.rnd() * 0.05
    put(
      c,
      join([
        xf(cylGeo(0.013, 0.013, 0.64, 7), [0, 0.44, 0]),
        xf(coneGeo(0.06, 0.36, 9), [0, 0.3, 0], [Math.PI, 0, 0]),
        xf(cylGeo(0.018, 0.018, 0.13, 6), [0, 0.75, 0]),
        xf(torusGeo(0.04, 0.011, 10, 5), [0.035, 0.84, 0], [0, 0, Math.PI / 2]),
      ]),
      toon(cols[i], { fx: { sheen: 0.22 } }),
      { pos: [x + Math.cos(a) * 0.105, y0 + 0.03, z + Math.sin(a) * 0.105], rot: [Math.sin(a) * lean, 0, Math.cos(a) * lean] },
    )
  }
  // 地上一把敞开的伞：侧倒在湿路面上，伞缘最低点贴地，伞柄朝街心伸出
  const local = localFrame(c, [-2.5, L.y.walk + 0.4227, -1.66], [-1.4362, 0, -0.016], 0.8)
  local.put(coneGeo(0.52, 0.24, 16), toon(0x8f5f78, { fx: { sheen: 0.26, rimStrength: 0.28 }, side: THREE.DoubleSide }), {
    pos: [0, 0.02, 0],
    line: 'soft',
  })
  const rib = bl([0.26, -0.02, 0], 0.55, 0.012, 0.016, [0, 0, -0.44])
  for (let i = 0; i < 8; i++) local.rep('umbRib', rib, m.metalDark, [0, 0.0, 0], [0, (i / 8) * Math.PI * 2, 0])
  local.put(
    join([
      xf(cylGeo(0.015, 0.015, 0.58, 7), [0, -0.28, 0]),
      xf(torusGeo(0.042, 0.012, 10, 5), [0.04, -0.58, 0], [0, 0, Math.PI / 2]),
    ]),
    m.metalDark,
  )
  local.finish()
}

/* =================================================================== */
/* 5. 垃圾桶                                                           */
/* =================================================================== */

function trashCluster(c: Ctx, m: Mats) {
  const y0 = L.y.walk
  const bins = [
    { z: 1.16, r: 0.205, h: 0.62, lid: PAL.red },
    { z: 1.61, r: 0.205, h: 0.62, lid: PAL.blue },
    { z: 2.06, r: 0.19, h: 0.58, lid: PAL.green },
  ]
  put(
    c,
    join(bins.map((b) => xf(cylGeo(b.r, b.r * 0.88, b.h, 16), [2.32, y0 + b.h / 2, b.z]))),
    m.metalDark,
    { line: 'dark' },
  )
  bins.forEach((b) => {
    put(c, xf(cylGeo(b.r + 0.02, b.r + 0.02, 0.05, 16), [2.32, y0 + b.h + 0.02, b.z]), toon(b.lid, { fx: { sheen: 0.18 } }))
  })
  // 露出的纸袋 + 溢出的塑料袋堆
  put(
    c,
    join(bins.map((b) => xf(sphereGeo(0.115, 9), [2.32, y0 + b.h + 0.08, b.z + 0.02], [0, 0.4, 0], [1.15, 0.8, 1]))),
    m.paper,
  )
  put(
    c,
    join([
      xf(sphereGeo(0.19, 10), [1.92, y0 + 0.11, 2.44], [0, 0.4, 0], [1.2, 0.85, 1]),
      xf(sphereGeo(0.15, 10), [2.04, y0 + 0.25, 2.36], [0, 1.1, 0.2], [1.1, 0.8, 1]),
      xf(sphereGeo(0.12, 10), [1.84, y0 + 0.34, 2.5], [0, 2.1, -0.2], [1.15, 0.85, 1]),
    ]),
    m.bag,
  )
  put(c, bl([2.72, y0 + 0.32, 2.3], 0.05, 0.64, 0.05), m.metalDark)
  put(c, xf(planeGeo(0.42, 0.16), [0, 0, 0], [0, Math.PI / 2, 0]), toon(0xffffff, { map: stripTex('可燃 不燃 瓶缶', '#f4f7ff', '#2b3245', 48) }), {
    pos: [2.75, y0 + 0.58, 2.3],
  })
  // 街边高筒 PUBLIC 桶
  put(c, rboxGeo(0.4, 0.94, 0.4, 0.05), m.steel, { pos: [-6.0, L.y.walk + 0.47, 2.5], rot: [0, 0.42, 0], line: 'dark' })
  put(c, xf(cylGeo(0.19, 0.21, 0.07, 14), [0, 0.5, 0]), m.metalDark, { pos: [-6.0, L.y.walk + 0.94, 2.5], rot: [0, 0.42, 0] })
  put(c, xf(planeGeo(0.28, 0.08), [0, 0.14, 0.205], [0, Math.PI / 2, 0]), toon(0xffffff, { map: stripTex('PUBLIC', '#2b3245', '#e4ebf7', 32) }), {
    pos: [-6.0, L.y.walk + 0.5, 2.5],
    rot: [0, 0.42, 0],
  })
  c.drips.push([-6.0, L.y.walk + 0.9, 2.5])
}

/* =================================================================== */
/* 6. 路灯                                                            */
/* =================================================================== */

function streetlight(c: Ctx, m: Mats, x: number, z: number, h: number, arm: number, y0: number, cool: number) {
  const top = y0 + h
  put(c, xf(cylGeo(0.15, 0.2, 0.16, 14), [x, y0 + 0.08, z]), m.concrete)
  put(c, xf(cylGeo(0.082, 0.112, h, 12), [x, y0 + h / 2, z]), m.metal, { line: 'dark' })
  put(c, xf(cylGeo(0.1, 0.1, 0.06, 12), [x, y0 + h * 0.45, z]), m.metalDark)
  put(c, bl([x - 0.088, y0 + 0.62, z], 0.014, 0.22, 0.14), m.metalDark)
  const head = curve3([x, top - 0.34, z], [x, top + 0.16, z], [x, top + 0.06, z + arm], 10)
  put(c, tubeGeo(pv(head), 0.046), m.metal, { line: 'soft' })
  const hy = top + 0.04
  const hz = z + arm + 0.05
  put(c, rboxGeo(0.2, 0.11, 0.54, 0.03), m.metalDark, { pos: [x, hy, hz], rot: [0.1, 0, 0], line: 'dark' })
  put(c, xf(planeGeo(0.17, 0.46), [0, -0.062, 0], [-Math.PI / 2, 0, 0]), glow(cool, 1.32), { pos: [x, hy, hz] })
  put(c, xf(planeGeo(0.44, 0.1), [0.102, 0, 0], [0, Math.PI / 2, 0]), glow(cool, 0.95), { pos: [x, hy, hz] })
  anchor(c, [x, hy - 0.14, hz], cool, 1.5, 0.8)
  c.drips.push([x, hy - 0.08, hz - 0.28])
  return { pos: [x, hy, hz] as P3 }
}

function streetlights(c: Ctx, m: Mats) {
  const a = streetlight(c, m, L.spots.streetlight.x, L.spots.streetlight.z, 4.25, 0.62, 0.0, 0xd6e9ff)
  streetlight(c, m, -6.0, 3.55, 3.1, 0.46, 0.0, 0xc9e2ff)
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex(),
      color: new THREE.Color(0xd6e9ff),
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  halo.position.set(a.pos[0], a.pos[1] - 0.06, a.pos[2])
  halo.scale.set(1.2, 1.2, 1)
  halo.userData.noReflect = true
  c.kit.attach(halo)
}

/* =================================================================== */
/* 7. 电线杆 + 电线                                                    */
/* =================================================================== */

function utilityPole(c: Ctx, m: Mats, x: number, z: number, y0: number, h: number, big: boolean) {
  put(c, xf(cylGeo(big ? 0.115 : 0.095, big ? 0.18 : 0.15, h, 12), [x, y0 + h / 2, z]), m.concrete, { line: 'dark' })
  // 横担必须高过店铺女儿墙（y 4.5），否则一整捆导线会横切玻璃面，把店内的货架全挡住
  const arms = big ? [6.8, 7.7] : [6.3, 7.2]
  const armGeo: THREE.BufferGeometry[] = []
  const ins: P3[] = []
  arms.forEach((ay, ai) => {
    const w = ai === 0 ? 0.52 : 0.42
    armGeo.push(bl([x, y0 + ay, z], 0.1, 0.09, w * 2))
    if (ai === 0) armGeo.push(bl([x, y0 + ay + 0.17, z], 0.08, 0.07, w * 2 - 0.3))
    for (const sz of [-w, -w / 3, w / 3, w]) ins.push([x + 0.055, y0 + ay + 0.11, z + sz])
  })
  put(c, join(armGeo), m.metalDark, { line: 'dark' })
  const insGeo = cylGeo(0.033, 0.045, 0.12, 8)
  ins.forEach((p) => batch(c, 'insulator', insGeo, m.paintDim, p))
  if (big) {
    put(
      c,
      join([
        xf(cylGeo(0.19, 0.19, 0.54, 14), [0, 0, 0], [0, 0, Math.PI / 2]),
        bl([0.3, 0.14, 0], 0.09, 0.1, 0.16),
        bl([-0.3, 0.14, 0], 0.09, 0.1, 0.16),
      ]),
      m.metalDark,
      { pos: [x - 0.34, y0 + 4.05, z - 0.2], line: 'soft' },
    )
    put(c, xf(planeGeo(0.24, 0.12), [x + 0.12, y0 + 1.5, z], [0, Math.PI / 2, 0]), toon(0xffffff, { map: stripTex('注意', '#f3cf58', '#3c3a2a', 48) }))
    put(c, xf(planeGeo(0.11, 0.26), [x + 0.115, y0 + 1.12, z - 0.2], [0, Math.PI / 2, 0]), toon(0xffffff, { map: stripTex('38', '#f4f7ff', '#2b3245', 96) }))
    // 杆上小型電灯
    const head = curve3([x + 0.06, y0 + 4.75, z], [x + 0.3, y0 + 4.91, z], [x + 0.34, y0 + 4.79, z + 0.3], 8)
    put(c, join([tubeGeo(pv(head), 0.02), bl([x + 0.34, y0 + 4.75, z + 0.34], 0.12, 0.08, 0.22)]), m.metalDark)
    put(c, xf(planeGeo(0.16, 0.14), [x + 0.34, y0 + 4.7, z + 0.34], [-Math.PI / 2, 0, 0]), glow(0xffd9a0, 1.6))
    anchor(c, [x + 0.34, y0 + 4.61, z + 0.34], PAL.warmLight, 1.1, 0.75)
  }
  put(c, tubeGeo(pv([[x, y0 + h * 0.55, z], [x - 0.9, y0 + 0.03, z + 0.62]]), 0.013), m.metalDark)
  put(c, bl([x - 0.9, y0 + 0.05, z + 0.62], 0.1, 0.1, 0.1), m.concreteDark)
}

function powerWires(c: Ctx, m: Mats, wires: Wire[]) {
  const a = L.spots.utilityPole
  const b = L.spots.utilityPoleFar
  // 每一支横担四个瓷瓶各挂一根导线，全部抬高到女儿墙（y 4.5）以上，避开招牌与玻璃面
  const specs = [
    { ay: 6.8 + 0.11, by: 6.3 + 0.11, zo: -0.52, zo2: -0.52, sag: 0.45, r: 0.014 },
    { ay: 6.8 + 0.11, by: 6.3 + 0.11, zo: -0.52 / 3, zo2: -0.52 / 3, sag: 0.5, r: 0.014 },
    { ay: 6.8 + 0.11, by: 6.3 + 0.11, zo: 0.52 / 3, zo2: 0.52 / 3, sag: 0.42, r: 0.013 },
    { ay: 6.8 + 0.11, by: 6.3 + 0.11, zo: 0.52, zo2: 0.52, sag: 0.38, r: 0.013 },
    { ay: 7.7 + 0.11, by: 7.2 + 0.11, zo: -0.42, zo2: -0.42, sag: 0.3, r: 0.015 },
    { ay: 7.7 + 0.11, by: 7.2 + 0.11, zo: -0.42 / 3, zo2: -0.42 / 3, sag: 0.34, r: 0.015 },
    { ay: 7.7 + 0.11, by: 7.2 + 0.11, zo: 0.42 / 3, zo2: 0.42 / 3, sag: 0.28, r: 0.013 },
    { ay: 7.7 + 0.11, by: 7.2 + 0.11, zo: 0.42, zo2: 0.42, sag: 0.24, r: 0.012 },
  ]
  for (const s of specs) {
    const pa = new THREE.Vector3(a.x - 0.36, L.y.walk + s.ay, a.z + s.zo)
    const pb = new THREE.Vector3(b.x + 0.36, s.by, b.z + s.zo2)
    const mesh = put(c, tubeGeo(catenary(pa, pb, s.sag, 22), s.r), m.rubber)
    wires.push({ mesh, amp: 0.005 + c.rnd() * 0.006, freq: 0.5 + c.rnd() * 0.5, phase: c.rnd() * 6.28 })
  }
  // 跨前街的一档（引 contre 对向建筑）
  const p1 = new THREE.Vector3(b.x + 0.3, L.y.walk + 4.81, b.z - 0.3)
  const p2 = new THREE.Vector3(-6.2, 3.46, 7.7)
  const w2 = put(c, tubeGeo(catenary(p1, p2, 0.42, 20), 0.013), m.rubber)
  wires.push({ mesh: w2, amp: 0.011, freq: 0.66, phase: 1.2 })
  put(c, bl([-6.2, 3.5, 7.66], 0.12, 0.12, 0.08), m.metalDark)
  const p3 = new THREE.Vector3(a.x - 0.3, L.y.walk + 6.16, a.z + 0.52)
  const p4 = new THREE.Vector3(9.8, 4.15, 0.9)
  const w3 = put(c, tubeGeo(catenary(p3, p4, 0.5, 20), 0.013), m.rubber)
  wires.push({ mesh: w3, amp: 0.009, freq: 0.72, phase: 2.4 })
  put(c, bl([9.8, 4.16, 0.9], 0.12, 0.12, 0.1), m.metalDark)
}

/* =================================================================== */
/* 8. 路牌 / 町内名板                                                  */
/* =================================================================== */

function signs(c: Ctx, m: Mats) {
  const post = cylGeo(0.036, 0.042, 1, 10)
  type Rect = { kind: 'crosswalk' | 'oneway' | 'note'; p: P3; ry: number; h: number; w: number; hh: number; panel: P3 | null }
  const rects: Rect[] = [
    { kind: 'crosswalk', p: [4.52, L.y.walk, 2.45], ry: Math.PI / 2, h: 1.66, w: 0.4, hh: 0.4, panel: [0.44, 0.44, 0.03] },
    { kind: 'oneway', p: [0.5, 0.0, 3.42], ry: -Math.PI / 2, h: 1.9, w: 0.54, hh: 0.3, panel: [0.58, 0.34, 0.03] },
    { kind: 'note', p: [2.98, L.y.walk, 1.82], ry: Math.PI / 2, h: 1.36, w: 0.38, hh: 0.38, panel: null },
  ]
  rects.forEach((s) => {
    const nx = Math.sin(s.ry)
    const nz = Math.cos(s.ry)
    batch(c, 'signPost', post, m.metalDark, [s.p[0], s.p[1] + (s.h + 0.2) / 2, s.p[2]], undefined, [1, s.h + 0.2, 1])
    if (s.panel) {
      put(c, xf(rboxGeo(s.panel[0], s.panel[1], s.panel[2], 0.015), [s.p[0] + nx * 0.055, s.p[1] + s.h, s.p[2] + nz * 0.055], [0, s.ry, 0]), m.paintDim, {
        line: 'dark',
      })
    }
    put(
      c,
      xf(planeGeo(s.w, s.hh), [s.p[0] + nx * (s.panel ? 0.085 : 0.02), s.p[1] + s.h, s.p[2] + nz * (s.panel ? 0.085 : 0.02)], [0, s.ry, 0]),
      toon(0xffffff, { map: trafficSignTex(s.kind), transparent: true, side: THREE.DoubleSide, fx: { sheen: 0.08 } }),
    )
  })
  type Round = { kind: 'tomare' | 'speed'; p: P3; ry: number; h: number; r: number }
  ;(
    [
      { kind: 'tomare', p: [3.26, L.y.walk, 2.66], ry: 0.72, h: 0.78, r: 0.21 },
      { kind: 'speed', p: [4.52, L.y.walk, 2.45], ry: Math.PI / 2, h: 2.32, r: 0.19 },
    ] as Round[]
  ).forEach((s) => {
    const nx = Math.sin(s.ry)
    const nz = Math.cos(s.ry)
    batch(c, 'signPost', post, m.metalDark, [s.p[0], s.p[1] + (s.h + 0.14) / 2, s.p[2]], undefined, [1, s.h + 0.14, 1])
    put(
      c,
      xf(circleGeo(s.r), [s.p[0] + nx * 0.03, s.p[1] + s.h, s.p[2] + nz * 0.03], [0, s.ry, 0]),
      toon(0xffffff, { map: trafficSignTex(s.kind), transparent: true, side: THREE.DoubleSide }),
    )
  })
  // 角柱町内名板（两面）
  const cx = 2.02
  const cz = -2.52
  batch(c, 'signPost', post, m.metalDark, [cx, L.y.walk + 0.75, cz], undefined, [1, 1.5, 1])
  ;[Math.PI / 2, 0].forEach((ry, i) => {
    const nx = Math.sin(ry)
    const nz = Math.cos(ry)
    put(c, xf(rboxGeo(0.5, 0.12, 0.03, 0.012), [cx + nx * 0.035, 1.34, cz + nz * 0.035], [0, ry, 0]), m.paintDim)
    put(c, xf(planeGeo(0.46, 0.1), [cx + nx * 0.062, 1.34, cz + nz * 0.062], [0, ry, 0]), toon(0xffffff, { map: stripTex(i ? 'サンロード前' : '西町三丁目', '#f4f7ff', '#2b3245', 64) }))
  })
}

/* =================================================================== */
/* 9. 街角护栏                                                         */
/* =================================================================== */

function railRun(c: Ctx, m: Mats, axis: 'x' | 'z', a0: number, a1: number, fixed: number, y0: number) {
  const len = a1 - a0
  const mid = (a0 + a1) / 2
  put(
    c,
    join(
      axis === 'x'
        ? [bl([mid, y0 + 0.72, fixed], len, 0.06, 0.055), bl([mid, y0 + 0.36, fixed], len, 0.04, 0.04)]
        : [bl([fixed, y0 + 0.72, mid], 0.055, 0.06, len), bl([fixed, y0 + 0.36, mid], 0.04, 0.04, len)],
    ),
    m.metal,
    { line: 'dark' },
  )
  const bar = boxGeo(0.026, 0.68, 0.026)
  const n = Math.max(2, Math.round(len / 0.16))
  for (let i = 0; i <= n; i++) {
    const p = a0 + (len * i) / n
    batch(c, 'fenceBar', bar, m.metal, axis === 'x' ? [p, y0 + 0.41, fixed] : [fixed, y0 + 0.41, p])
  }
  const pn = Math.max(1, Math.round(len / 1.7))
  const postG = cylGeo(0.043, 0.05, 0.8, 10)
  for (let i = 0; i <= pn; i++) {
    const p = a0 + (len * i) / pn
    batch(c, 'fencePost', postG, m.concreteDark, axis === 'x' ? [p, y0 + 0.4, fixed] : [fixed, y0 + 0.4, p])
  }
}

function guardFences(c: Ctx, m: Mats) {
  const g = L.spots.guardFence
  railRun(c, m, 'x', g.x0, g.x1, g.z, L.y.walk)
  railRun(c, m, 'z', 0.4, 2.9, 2.95, L.y.walk)
  const cap = cylGeo(0.052, 0.058, 0.86, 10)
  batch(c, 'fencePost', cap, m.metal, [1.0, L.y.walk + 0.43, g.z])
  batch(c, 'fencePost', cap, m.metal, [2.95, L.y.walk + 0.43, 0.4])
}

/* =================================================================== */
/* 10. 交通信号灯                                                      */
/* =================================================================== */

const PHASE = [
  { color: 0x63c47a, lit: 0 },
  { color: 0xf2c14e, lit: 1 },
  { color: 0xd8544f, lit: 2 },
]

function trafficSignal(c: Ctx, m: Mats) {
  const x = L.spots.signal.x
  const z = L.spots.signal.z
  const y0 = 0.02
  put(c, xf(cylGeo(0.16, 0.21, 0.18, 14), [x, y0 + 0.09, z]), m.concrete)
  put(c, xf(cylGeo(0.072, 0.1, 3.2, 12), [x, y0 + 1.7, z]), m.metal, { line: 'dark' })
  put(c, rl([x, y0 + 3.28, z - 0.02], 0.32, 0.9, 0.26, 0.04), m.metalDark, { line: 'dark' })
  const lensGeo = xf(cylGeo(0.073, 0.073, 0.03, 14), [0, 0, 0], [Math.PI / 2, 0, 0])
  const on: THREE.Mesh[] = []
  const lensY = [3.58, 3.26, 2.94]
  lensY.forEach((ly, i) => {
    put(c, xf(lensGeo, [x, y0 + ly, z + 0.1]), m.lensOff)
    put(c, join([xf(torusGeo(0.086, 0.02, 14, 5), [0, 0, 0.12])]), m.metalDark, { pos: [x, y0 + ly, z] })
    const l = put(c, xf(lensGeo, [x, y0 + ly, z + 0.125]), glow(PHASE[i].color, 1.6), { visible: i === 2 })
    on.push(l)
  })
  // 行人信号箱（朝 +Z）
  put(c, rl([x - 0.13, y0 + 2.52, z + 0.06], 0.18, 0.44, 0.34, 0.03), m.metalDark, { rot: [0, 0.2, 0], line: 'soft' })
  const pedOn: THREE.Mesh[] = []
  ;[0, 1].forEach((i) => {
    const p = put(c, xf(planeGeo(0.13, 0.17), [x - 0.13, y0 + 2.62 - i * 0.2, z + 0.235]), glow(i ? 0x63c47a : PAL.warmLight, 1.3), {
      visible: i === 1,
    })
    pedOn.push(p)
  })
  // 按钮盒
  put(c, rl([x - 0.2, y0 + 1.02, z + 0.16], 0.15, 0.28, 0.12, 0.02), m.metalDark, { rot: [0, 0.2, 0] })
  put(c, xf(cylGeo(0.048, 0.048, 0.03, 10), [x - 0.22, y0 + 1.06, z + 0.21], [Math.PI / 2, 0, 0.2]), glow(PAL.yellow, 1.15))
  const sig = anchor(c, [x, y0 + 3.3, z + 0.3], PHASE[2].color, 1.2, 0.75, false)
  return { on, pedOn, sig }
}

/* =================================================================== */
/* 11. 空调外机                                                        */
/* =================================================================== */

function acUnit(c: Ctx, m: Mats, x: number, y: number, z: number, ry: number, w: number, h: number, d: number, spins: Spin[]) {
  const fx = Math.sin(ry)
  const fz = Math.cos(ry)
  put(c, rboxGeo(w, h, d, 0.03), m.steel, { pos: [x, y, z], rot: [0, ry, 0], line: 'dark' })
  const slat = boxGeo(w * 0.8, 0.017, 0.028)
  const n = Math.max(3, Math.round(h / 0.075))
  for (let i = 0; i < n; i++) {
    const oy = (i / (n - 1) - 0.5) * h * 0.76
    batch(c, 'acSlat', slat, m.metalDark, [x + fx * (d / 2 + 0.004) - fz * w * 0.26, y + oy, z + fz * (d / 2 + 0.004) + fx * w * 0.26], [0, ry, 0.12])
  }
  const gx = x + fx * (d / 2 + 0.008) + fz * w * 0.17
  const gz = z + fz * (d / 2 + 0.008) - fx * w * 0.17
  put(c, join([xf(torusGeo(h * 0.33, 0.016, 18, 5), [0, 0, 0], [0, ry, 0]), xf(planeGeo(h * 0.64, h * 0.64), [fx * 0.004, 0, fz * 0.004], [0, ry, 0])]), m.grate, { pos: [gx, y, gz] })
  const r = h * 0.3
  const fan = put(
    c,
    join([
      ...[0, 1, 2].map((i) => xf(boxGeo(r * 1.75, 0.008, r * 0.52), [0, 0, 0], [0, (i / 3) * Math.PI * 2, 0.26])),
      xf(cylGeo(0.03, 0.03, 0.045, 8), [0, 0, 0], [Math.PI / 2, 0, 0]),
    ]),
    m.metalDark,
    { pos: [gx - fx * 0.022, y, gz - fz * 0.022], rot: [Math.PI / 2, 0, ry] },
  )
  spins.push({ mesh: fan, speed: 1.5 + c.rnd() * 0.6 })
  put(
    c,
    join([
      bl([-w * 0.34, -h / 2 - 0.1, -d * 0.12], 0.05, 0.2, d * 0.78),
      bl([w * 0.34, -h / 2 - 0.1, -d * 0.12], 0.05, 0.2, d * 0.78),
      bl([0, -h / 2 - 0.03, 0], w * 0.96, 0.045, d * 0.92),
    ]),
    m.metalDark,
    { pos: [x, y, z], rot: [0, ry, 0] },
  )
  const bx = x - fx * (d * 0.55 + 0.06)
  const bz = z - fz * (d * 0.55 + 0.06)
  put(
    c,
    tubeGeo(
      pv([
        [x - fx * 0.02 - fz * w * 0.42, y - h * 0.38, z - fz * 0.02 + fx * w * 0.42],
        [bx - fz * w * 0.3, y - h * 0.42, bz + fx * w * 0.3],
        [bx, y - h * 0.72, bz],
      ]),
      0.026,
    ),
    m.paintDim,
  )
  c.drips.push([bx, y - h * 0.75, bz])
}

function acUnits(c: Ctx, m: Mats, spins: Spin[]) {
  const a = L.spots.acUnits
  acUnit(c, m, a.x - 0.02, 2.2, a.z, -Math.PI / 2, 0.82, 0.58, 0.32, spins)
  acUnit(c, m, a.x - 0.02, 3.1, a.z + 0.04, -Math.PI / 2, 0.82, 0.58, 0.32, spins)
  acUnit(c, m, -4.9, 2.8, -8.84, Math.PI, 0.86, 0.6, 0.34, spins)
  acUnit(c, m, -9.06, 2.44, -5.15, Math.PI / 2, 0.74, 0.52, 0.3, spins)
}

function smallAc(c: Ctx, m: Mats, x: number, y: number, z: number, ry: number) {
  put(c, rboxGeo(0.54, 0.4, 0.22, 0.025), m.steel, { pos: [x, y, z], rot: [0, ry, 0], line: 'soft' })
  const fx = Math.sin(ry)
  const fz = Math.cos(ry)
  put(c, xf(planeGeo(0.3, 0.3), [0, 0, 0], [0, ry, 0]), m.grate, { pos: [x + fx * 0.118, y, z + fz * 0.118] })
}

/* =================================================================== */
/* 12. 公告栏 / 広告柱 / A 字看板                                       */
/* =================================================================== */

function boards(c: Ctx, m: Mats) {
  const bx = -9.34
  const bz = -1.2
  put(c, bl([bx - 0.04, L.y.walk + 0.95, bz + 0.66], 0.1, 1.9, 0.1), m.metalDark)
  put(c, bl([bx - 0.04, L.y.walk + 0.95, bz - 0.66], 0.1, 1.9, 0.1), m.metalDark)
  put(c, rboxGeo(0.14, 1.16, 1.62, 0.03), m.tealDeep, { pos: [bx - 0.05, L.y.walk + 1.44, bz], line: 'dark' })
  put(c, xf(planeGeo(1.5, 1.04), [0, 0, 0], [0, Math.PI / 2, 0]), toon(0xffffff, { map: bulletinTex() }), {
    pos: [bx + 0.032, L.y.walk + 1.44, bz],
  })
  put(c, xf(planeGeo(1.56, 1.12), [0, 0, 0], [0, Math.PI / 2, 0]), m.glassWet, { pos: [bx + 0.046, L.y.walk + 1.44, bz] })
  put(c, rl([bx - 0.03, L.y.walk + 2.1, bz], 0.34, 0.07, 1.78, 0.02), m.metalDark, { line: 'soft' })
  put(c, xf(planeGeo(1.46, 0.13), [bx + 0.038, L.y.walk + 2.2, bz], [0, Math.PI / 2, 0]), toon(0xffffff, { map: stripTex('町内のお知らせ', '#f4f7ff', '#1f7f76', 48) }))
  // 小巷内の広告柱
  const px = -8.02
  const pz = -5.55
  put(c, xf(cylGeo(0.19, 0.21, 2.1, 14), [px, 1.1, pz]), m.concreteDark, { line: 'dark' })
  put(c, xf(cylGeo(0.25, 0.2, 0.13, 14), [px, 2.21, pz]), m.metalDark)
  ;(['recruit', 'bento', 'ice'] as const).forEach((k, i) => {
    const a = (i / 3) * Math.PI * 2 + 0.6
    put(c, xf(planeGeo(0.3, 0.44), [px + Math.sin(a) * 0.21, 1.32 + i * 0.15, pz + Math.cos(a) * 0.21], [0, a, 0.05]), toon(0xffffff, { map: posterTex(k) }))
  })
  // 店门前 A 字看板
  const ax = 0.72
  const az = -1.62
  const local = localFrame(c, [ax, L.y.walk, az], [0, -0.62, 0], 1)
  local.put(join([rl([0, 0.42, 0.03], 0.56, 0.8, 0.03, 0.02, [0.11, 0, 0]), rl([0, 0.42, -0.03], 0.56, 0.8, 0.03, 0.02, [-0.11, 0, 0])]), m.metalDark, {
    line: 'soft',
  })
  local.put(xf(planeGeo(0.5, 0.68), [0, 0.44, 0.055], [0.11, 0, 0]), toon(0xffffff, { map: posterTex('new') }))
  local.finish()
}

/* =================================================================== */
/* 13. 小巷                                                            */
/* =================================================================== */

function backAlley(c: Ctx, m: Mats, sway: Sway[]) {
  const al = L.alley
  const cx = (al.minX + al.maxX) / 2
  const cz = (al.minZ + al.maxZ) / 2
  put(c, xf(planeGeo(al.maxX - al.minX - 0.02, al.maxZ - al.minZ + 0.1), [cx, 0.03, cz - 0.05], [-Math.PI / 2, 0, 0]), m.asphaltDark)
  put(c, xf(planeGeo(1.24, 0.18), [cx, 0.042, al.maxZ + 0.07], [-Math.PI / 2, 0, 0]), m.curb)
  put(c, join([xf(planeGeo(0.32, 1.9), [-8.16, 0.05, -6.5], [-Math.PI / 2, 0, 0]), bl([-8.16, 0.028, -6.5], 0.38, 0.05, 1.96)]), m.grate)
  // 墙面管线
  put(
    c,
    join([
      tubeGeo(pv([[-9.03, 2.24, -8.4], [-9.03, 2.24, -3.3]]), 0.038),
      tubeGeo(pv([[-9.03, 2.38, -8.4], [-9.03, 2.38, -4.4]]), 0.024),
      tubeGeo(pv([[-9.0, 2.24, -5.4], [-9.0, 0.6, -5.4]]), 0.024),
    ]),
    m.metalDark,
  )
  put(c, join([bl([-9.0, 2.24, -6.6], 0.09, 0.18, 0.12), bl([-9.0, 1.66, -4.2], 0.11, 0.22, 0.11)]), m.rust)

  // 速可达
  const sx = -8.5
  const sz = -6.6
  const local = localFrame(c, [sx, 0.05, sz], [0, 1.95, 0.03], 1)
  local.put(
    join([rl([-0.02, 0.46, 0], 0.68, 0.26, 0.36, 0.08), rl([0.22, 0.56, 0], 0.34, 0.22, 0.3, 0.07), rl([-0.26, 0.3, 0], 0.5, 0.16, 0.3, 0.06)]),
    toon(0x33405c, { fx: { sheen: 0.22 } }),
    { line: 'dark' },
  )
  local.put(
    join([
      xf(cylGeo(0.17, 0.17, 0.08, 14), [0.5, 0.18, 0], [Math.PI / 2, 0, 0]),
      xf(cylGeo(0.17, 0.17, 0.08, 14), [-0.5, 0.18, 0], [Math.PI / 2, 0, 0]),
    ]),
    m.rubber,
  )
  local.put(
    join([
      rl([-0.06, 0.65, 0], 0.36, 0.09, 0.24, 0.04),
      tubeGeo(pv(curve3([0.36, 0.62, 0], [0.44, 0.92, 0], [0.34, 1.02, 0], 6)), 0.018),
      tubeGeo(pv([[0.34, 1.02, -0.2], [0.34, 1.02, 0.2]]), 0.015),
      bl([0.34, 1.04, 0.21], 0.05, 0.05, 0.02),
      bl([0.34, 1.04, -0.21], 0.05, 0.05, 0.02),
      bl([0.42, 0.86, 0], 0.05, 0.36, 0.26),
    ]),
    m.metalDark,
  )
  local.put(xf(circleGeo(0.05), [0.45, 0.84, 0], [0, Math.PI / 2, 0]), glow(PAL.warmLight, 1.3))
  local.put(xf(boxGeo(0.02, 0.07, 0.14), [-0.5, 0.5, 0]), glow(PAL.red, 1.2))
  local.finish()
  anchor(c, [sx + 0.3, 0.75, sz], PAL.warmLight, 0.6, 0.22)

  // 牛奶箱
  const crate = join([
    bl([0, 0, 0], 0.44, 0.028, 0.3),
    bl([0, 0.08, 0.145], 0.44, 0.16, 0.018),
    bl([0, 0.08, -0.145], 0.44, 0.16, 0.018),
    bl([0.21, 0.08, 0], 0.018, 0.16, 0.3),
    bl([-0.21, 0.08, 0], 0.018, 0.16, 0.3),
  ])
  const crateMat = toon(0x3a4a5e, { fx: { sheen: 0.12 } })
  const slots: { p: P3; ry: number }[] = [
    { p: [-8.8, 0.09, -7.85], ry: 0.06 },
    { p: [-8.8, 0.28, -7.85], ry: 0.02 },
    { p: [-8.82, 0.47, -7.86], ry: -0.09 },
    { p: [-8.32, 0.09, -7.9], ry: 0.3 },
    { p: [-8.32, 0.28, -7.9], ry: 0.24 },
    { p: [-8.82, 0.09, -7.38], ry: -0.05 },
  ]
  slots.forEach((s) => batch(c, 'crate', crate, crateMat, s.p, [0, s.ry, 0]))

  // 提灯（挂臂 + 轻摆）
  const lz = -2.74
  put(
    c,
    join([
      tubeGeo(pv(curve3([-9.02, 3.0, lz], [-8.7, 3.14, lz], [-8.56, 3.0, lz], 8)), 0.021),
      bl([-9.0, 3.04, lz], 0.08, 0.12, 0.08),
    ]),
    m.metalDark,
  )
  const lg = localFrame(c, [-8.56, 2.96, lz], [0, 0.4, 0], 1)
  lg.put(join([xf(cylGeo(0.116, 0.116, 0.09, 12), [0, 0.19, 0]), xf(cylGeo(0.1, 0.1, 0.03, 12), [0, -0.19, 0])]), toon(0x2c2430))
  lg.put(xf(sphereGeo(0.135, 14), [0, 0, 0], undefined, [1, 1.28, 1]), glow(0xffb066, 1.5))
  lg.put(xf(planeGeo(0.1, 0.2), [0, -0.02, 0.14]), glow(0xffd9a8, 1.1))
  lg.put(tubeGeo(pv([[0, 0.2, 0], [0, 0.42, 0]]), 0.008), m.metalDark)
  const lantern = lg.finish()
  sway.push({ obj: lantern, amp: 0.08, freq: 0.92, phase: 0.7 })
  anchor(c, [-8.56, 2.88, lz], PAL.orange, 1.2, 1.2)
  c.drips.push([-8.56, 2.7, lz])

  // 晾衣绳 + 两块小布
  const la = new THREE.Vector3(-9.04, 2.72, -4.6)
  const lb2 = new THREE.Vector3(-7.86, 2.64, -3.9)
  put(c, tubeGeo(catenary(la, lb2, 0.1, 12), 0.009), m.paintDim)
  put(c, join([bl([-9.04, 2.72, -4.6], 0.06, 0.06, 0.06), bl([-7.88, 2.64, -3.9], 0.05, 0.05, 0.05)]), m.metalDark)
  const cloth = planeGeo(0.22, 0.3)
  for (let i = 0; i < 3; i++) {
    const u = 0.24 + i * 0.26
    const p = new THREE.Vector3().lerpVectors(la, lb2, u)
    p.y -= Math.sin(Math.PI * u) * 0.1
    const cm = toon([0x8fa6c8, 0xb98aa8, 0x74a0a0][i], { fx: { sheen: 0.18 }, side: THREE.DoubleSide })
    const f = localFrame(c, [p.x, p.y - 0.01, p.z], [0, 0.5 + i * 0.7, 0], 1)
    f.put(cloth, cm, { pos: [0, -0.15, 0] })
    sway.push({ obj: f.finish(), amp: 0.11, freq: 1.15 + i * 0.14, phase: i * 1.7 })
  }
}

/* =================================================================== */
/* 14. 邻家建筑                                                        */
/* =================================================================== */

const FACE = {
  s: { rot: 0 as number, ox: 0, oz: 1 },
  n: { rot: Math.PI as number, ox: 0, oz: -1 },
  e: { rot: Math.PI / 2 as number, ox: 1, oz: 0 },
  w: { rot: -Math.PI / 2 as number, ox: -1, oz: 0 },
}

interface Win {
  face: keyof typeof FACE
  x: number
  y: number
  z: number
  w: number
  h: number
  lit?: boolean
  curtain?: boolean
}

interface Bldg {
  x0: number
  x1: number
  z0: number
  z1: number
  top: number
}

function placeWindows(c: Ctx, wins: Win[], m: Mats) {
  const unit = boxGeo(1, 1, 1)
  for (const w of wins) {
    const f = FACE[w.face]
    const rot: P3 = [0, f.rot, 0]
    const px = w.x + f.ox * 0.04
    const pz = w.z + f.oz * 0.04
    batch(c, 'winFrame', unit, m.metalDark, [px, w.y, pz], rot, [w.w + 0.09, w.h + 0.09, 0.1])
    batch(c, w.lit ? 'paneLit' : 'paneDark', unit, w.lit ? m.paneLit : m.glassDark, [px + f.ox * 0.025, w.y, pz + f.oz * 0.025], rot, [w.w, w.h, 0.06])
    if (w.curtain) batch(c, 'curtain', unit, m.paper, [px + f.ox * 0.055, w.y + w.h * 0.2, pz + f.oz * 0.055], rot, [w.w * 0.9, 0.028, 0.03])
    if (w.lit) anchor(c, [px + f.ox * 0.24, w.y - 0.1, pz + f.oz * 0.24], PAL.warmLight, 0.9, 0.4)
  }
}

function buildingTrim(c: Ctx, m: Mats, b: Bldg, face: 1 | -1, dp: number, drips: P3[]) {
  const w = b.x1 - b.x0
  const d = b.z1 - b.z0
  const cx = (b.x0 + b.x1) / 2
  const cz = (b.z0 + b.z1) / 2
  const t = b.top + 0.16
  const fz = face === 1 ? b.z1 + 0.06 : b.z0 - 0.06
  put(
    c,
    join([
      bl([cx, t + 0.07, cz], w + 0.24, 0.14, d + 0.24),
      bl([cx, t + 0.21, b.z0 - 0.05], w + 0.24, 0.17, 0.09),
      bl([cx, t + 0.21, b.z1 + 0.05], w + 0.24, 0.17, 0.09),
      bl([b.x0 - 0.05, t + 0.21, cz], 0.09, 0.17, d + 0.08),
      bl([b.x1 + 0.05, t + 0.21, cz], 0.09, 0.17, d + 0.08),
      bl([cx, t + 0.31, fz], w + 0.28, 0.05, 0.12),
    ]),
    m.concreteDark,
    { line: 'soft' },
  )
  put(c, tubeGeo(pv([[b.x0, t + 0.26, fz], [b.x1, t + 0.26, fz]]), 0.038), m.metalDark)
  put(c, tubeGeo(pv([[dp, t + 0.26, fz], [dp, t + 0.12, fz + face * 0.07], [dp, 0.22, fz + face * 0.07]]), 0.032), m.metalDark)
  put(c, bl([dp, 0.24, fz + face * 0.07], 0.1, 0.05, 0.16), m.metalDark)
  drips.push([dp, 0.2, fz + face * 0.1])
  drips.push([b.x0 + 0.12, t + 0.24, fz + face * 0.12])
}

function railBars(c: Ctx, m: Mats, axis: 'x' | 'z', a0: number, a1: number, fixed: number, y0: number, h: number) {
  const len = Math.abs(a1 - a0)
  const mid = (a0 + a1) / 2
  put(c, axis === 'x' ? bl([mid, y0 + h, fixed], len, 0.024, 0.024) : bl([fixed, y0 + h, mid], 0.024, 0.024, len), m.metal)
  const bar = boxGeo(0.016, h, 0.016)
  const n = Math.max(2, Math.round(len / 0.14))
  for (let i = 0; i <= n; i++) {
    const p = a0 + ((a1 - a0) * i) / n
    batch(c, 'balconyBar', bar, m.metalDark, axis === 'x' ? [p, y0 + h / 2, fixed] : [fixed, y0 + h / 2, p])
  }
}

function roofGear(c: Ctx, m: Mats, ax: number, ay: number, az: number, dx: number, dy: number, dz: number) {
  put(
    c,
    join([
      bl([ax, ay + 0.6, az], 0.04, 1.05, 0.04),
      bl([ax, ay + 1.06, az], 0.62, 0.028, 0.028),
      bl([ax, ay + 0.92, az], 0.46, 0.028, 0.028),
      bl([ax, ay + 0.76, az], 0.28, 0.028, 0.028),
    ]),
    m.metal,
    { line: 'soft' },
  )
  put(
    c,
    join([
      xf(sphereGeo(0.3, 14), [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 0.34]),
      bl([0, 0, 0.19], 0.03, 0.03, 0.24),
      bl([0, -0.2, 0.02], 0.05, 0.4, 0.05),
    ]),
    m.paintDim,
    { pos: [dx, dy + 0.44, dz], rot: [0, 0.7, 0], line: 'soft' },
  )
  put(c, bl([dx + 0.55, dy + 0.34, dz], 0.52, 0.36, 0.42), m.concreteDark)
}

function building(c: Ctx, m: Mats, b: Bldg, tint: string, twoLevel: boolean, face: 1 | -1, dp: number, drips: P3[]) {
  const w = b.x1 - b.x0
  const d = b.z1 - b.z0
  const cx = (b.x0 + b.x1) / 2
  const cz = (b.z0 + b.z1) / 2
  if (twoLevel) {
    put(c, rboxGeo(w, 1.9, d, 0.03), toonSoft(0xffffff, { map: plasterTex('#39415a'), fx: { sheen: 0.1 } }), {
      pos: [cx, 0.16 + 0.95, cz],
      line: 'soft',
    })
    put(c, rboxGeo(w - 0.4, b.top - 1.95, d - 0.24, 0.03), toonSoft(0xffffff, { map: plasterTex(tint), fx: { sheen: 0.13 } }), {
      pos: [cx, b.top - (b.top - 1.95) / 2 + 0.09, cz - face * 0.06],
      line: 'soft',
    })
    put(c, bl([cx, 2.06, cz + face * (d / 2 + 0.02)], w + 0.1, 0.14, 0.1), m.concreteDark)
  } else {
    put(c, rboxGeo(w, b.top, d, 0.03), toonSoft(0xffffff, { map: plasterTex(tint), fx: { sheen: 0.13 } }), {
      pos: [cx, 0.16 + b.top / 2, cz],
      line: 'soft',
    })
  }
  buildingTrim(c, m, b, face, dp, drips)
}

function signBoard(
  c: Ctx,
  m: Mats,
  x: number,
  y: number,
  z: number,
  ry: number,
  w: number,
  h: number,
  text: string,
  bg: string,
  fg: string,
  sub: string,
) {
  const nx = Math.sin(ry)
  const nz = Math.cos(ry)
  put(c, xf(rboxGeo(w, h, 0.14, 0.025), [x, y, z], [0, ry, 0]), m.metalDark, { line: 'dark' })
  put(c, xf(planeGeo(w * 0.92, h * 0.86), [x + nx * 0.08, y, z + nz * 0.08], [0, ry, 0]), glowMap(0xffffff, lightboxTex(text, bg, fg, sub), 1.08))
  anchor(c, [x + nx * 0.28, y - 0.08, z + nz * 0.28], parseInt(fg.slice(1), 16), Math.max(w, h) * 1.15, 0.9)
}

function neighbors(c: Ctx, m: Mats, drips: P3[]) {
  const nb = L.neighbor
  /* A 左邻家（小巷西墙 + 朝南立面） */
  const A: Bldg = { x0: nb.left.minX + 0.1, x1: nb.left.maxX, z0: nb.left.minZ + 0.35, z1: nb.left.maxZ, top: 5.4 }
  building(c, m, A, '#424a63', false, 1, A.x1 - 0.14, drips)
  placeWindows(
    c,
    [
      { face: 'e', x: A.x1 + 0.02, y: 1.8, z: -7.7, w: 0.6, h: 0.64 },
      { face: 'e', x: A.x1 + 0.02, y: 1.8, z: -6.2, w: 0.6, h: 0.64 },
      { face: 'e', x: A.x1 + 0.02, y: 1.8, z: -4.7, w: 0.6, h: 0.64, curtain: true },
      { face: 'e', x: A.x1 + 0.02, y: 3.45, z: -7.1, w: 0.64, h: 0.68 },
      { face: 'e', x: A.x1 + 0.02, y: 3.45, z: -5.1, w: 0.64, h: 0.68 },
      { face: 'e', x: A.x1 + 0.02, y: 4.45, z: -6.3, w: 0.56, h: 0.56 },
      { face: 's', x: -9.5, y: 3.4, z: A.z1 + 0.02, w: 0.54, h: 0.62 },
    ],
    m,
  )
  put(c, rl([-9.5, 0.98, A.z1 + 0.06], 0.72, 1.62, 0.08, 0.02), m.blueDeep, { line: 'soft' })
  const mb = boxGeo(0.3, 0.21, 0.16)
  for (let i = 0; i < 6; i++) batch(c, 'mailbox', mb, m.metal, [-9.72 + (i % 2) * 0.34, 1.18 + ((i / 2) | 0) * 0.25, A.z1 + 0.12])
  put(c, xf(boxGeo(0.62, 0.07, 0.5), [-9.5, 2.6, A.z1 + 0.26]), m.concreteDark)
  railBars(c, m, 'x', -9.78, -9.22, A.z1 + 0.48, 2.63, 0.42)
  put(c, xf(planeGeo(0.44, 0.12), [-9.5, 4.6, A.z1 + 0.05]), toon(0xffffff, { map: stripTex('西町自治会', '#f4f7ff', '#2b3245', 48) }))
  roofGear(c, m, -9.6, A.top + 0.16, -7.7, -9.4, A.top + 0.16, -4.3)

  /* B 后邻家 */
  const B: Bldg = { x0: nb.back.minX + 0.1, x1: nb.back.maxX, z0: nb.back.minZ + 0.1, z1: nb.back.maxZ, top: 4.1 }
  building(c, m, B, '#3b4359', false, 1, B.x1 - 0.2, drips)
  placeWindows(
    c,
    [
      { face: 's', x: -8.6, y: 1.7, z: B.z1 + 0.02, w: 0.72, h: 0.68, lit: true, curtain: true },
      { face: 's', x: -6.9, y: 1.7, z: B.z1 + 0.02, w: 0.72, h: 0.68 },
      { face: 's', x: -5.2, y: 1.7, z: B.z1 + 0.02, w: 0.72, h: 0.68, curtain: true },
      { face: 's', x: -3.4, y: 1.7, z: B.z1 + 0.02, w: 0.72, h: 0.68 },
      { face: 's', x: -7.8, y: 2.95, z: B.z1 + 0.02, w: 0.7, h: 0.64, lit: true },
      { face: 's', x: -4.4, y: 2.95, z: B.z1 + 0.02, w: 0.7, h: 0.64 },
    ],
    m,
  )
  put(c, join([bl([-6.2, 3.5, B.z1 - 0.08], 4.6, 0.09, 0.1), bl([-6.2, 3.56, B.z1 - 0.28], 4.6, 0.05, 0.3)]), m.metalDark)
  roofGear(c, m, -8.4, B.top + 0.16, B.z0 + 0.8, -4.2, B.top + 0.16, B.z0 + 1.0)

  /* C 右侧对向（两条街面 + 亮看板） */
  const C: Bldg = { x0: nb.acrossRight.minX, x1: nb.acrossRight.maxX - 0.9, z0: nb.acrossRight.minZ + 0.35, z1: nb.acrossRight.maxZ, top: 4.95 }
  building(c, m, C, '#454e66', true, 1, C.x0 + 0.18, drips)
  const cw: Win[] = []
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 4; i++) {
      cw.push({
        face: 'w',
        x: C.x0 - 0.02,
        y: 2.72 + r * 1.16,
        z: -8.5 + i * 1.95,
        w: 0.78,
        h: 0.72,
        lit: (r === 0 && i === 2) || (r === 1 && i === 1),
        curtain: (r + i) % 2 === 0,
      })
    }
  }
  // default 机位在 +X 一侧，C 真正入画的是 e / s 两面墙；只铺 'w' 面的话右三分之一会是一块黑体块
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 4; i++) {
      cw.push({
        face: 'e',
        x: C.x1 + 0.02,
        y: 2.72 + r * 1.16,
        z: -8.4 + i * 1.9,
        w: 0.8,
        h: 0.74,
        lit: (r === 0 && i === 1) || (r === 1 && i === 0) || (r === 1 && i === 3),
        curtain: (r + i) % 2 === 1,
      })
    }
  }
  cw.push({ face: 'e', x: C.x1 + 0.02, y: 1.22, z: -5.4, w: 0.92, h: 0.86, lit: true, curtain: true })
  cw.push({ face: 'e', x: C.x1 + 0.02, y: 1.22, z: -2.1, w: 0.92, h: 0.86 })
  cw.push({ face: 's', x: 6.86, y: 2.72, z: C.z1 + 0.02, w: 0.86, h: 0.78, curtain: true })
  cw.push({ face: 's', x: 8.66, y: 2.72, z: C.z1 + 0.02, w: 0.86, h: 0.78, lit: true })
  cw.push({ face: 's', x: 6.86, y: 3.88, z: C.z1 + 0.02, w: 0.86, h: 0.78 })
  cw.push({ face: 's', x: 8.66, y: 3.88, z: C.z1 + 0.02, w: 0.86, h: 0.78, curtain: true })
  cw.push({ face: 's', x: 7.16, y: 1.2, z: C.z1 + 0.02, w: 1.4, h: 0.9, lit: true })
  cw.push({ face: 's', x: 8.94, y: 1.16, z: C.z1 + 0.02, w: 0.72, h: 1.5, lit: true })
  placeWindows(c, cw, m)
  put(c, rl([C.x0 - 0.6, 2.72, -3.9], 0.06, 0.05, 3.1, 0.02), m.tealDeep, { rot: [0.12, 0, 0], line: 'soft' })
  signBoard(c, m, C.x0 - 0.05, 3.36, -5.5, -Math.PI / 2, 1.5, 0.44, '酒店', '#12233c', '#7fe9ff', 'LIQUOR')
  signBoard(c, m, C.x0 - 0.05, 2.16, -1.62, -Math.PI / 2, 0.6, 1.2, '麺', '#2a1c22', '#f2914a', 'RAMEN')
  put(c, xf(planeGeo(0.5, 1.5), [C.x0 + 0.02, 1.95, C.z1 + 0.04], [0, 0, 0]), toon(0xffffff, { map: bannerTex('オープン', '#e0665c'), side: THREE.DoubleSide }))
  for (const bz of [-7.6, -4.6]) {
    put(c, xf(boxGeo(0.5, 0.07, 1.5), [C.x0 - 0.26, 2.52, bz]), m.concreteDark)
    railBars(c, m, 'z', bz - 0.7, bz + 0.7, C.x0 - 0.48, 2.55, 0.44)
  }
  smallAc(c, m, C.x0 - 0.13, 3.78, -6.6, -Math.PI / 2)
  smallAc(c, m, C.x0 - 0.13, 3.78, -3.4, -Math.PI / 2)
  put(c, tubeGeo(pv([[C.x0 - 0.06, 5.15, C.z0], [C.x0 - 0.06, 5.15, C.z1]]), 0.036), m.metalDark)
  roofGear(c, m, 7.1, C.top + 0.16, -8.9, 8.9, C.top + 0.16, -2.6)
  // s 面（正对前街）：雨棚 + 横看板，把一层变成一间亮着的店
  put(c, rl([7.16, 1.86, C.z1 + 0.28], 1.96, 0.07, 0.54, 0.025), m.blueDeep, { rot: [0.11, 0, 0], line: 'soft' })
  signBoard(c, m, 7.16, 2.14, C.z1 + 0.06, 0, 2.0, 0.28, '松風', '#12233c', '#7fe9ff', 'SNACK')
  // e 面（default 机位看到的大侧墙）：竖看板、阳台、外挂冷气、勝手口、落水管
  signBoard(c, m, C.x1 + 0.05, 3.42, -1.3, Math.PI / 2, 0.5, 1.15, '酒', '#2a1c22', '#f2914a', 'SAKE')
  for (const bz of [-6.5, -2.7]) {
    put(c, xf(boxGeo(0.5, 0.07, 1.7), [C.x1 + 0.26, 2.52, bz]), m.concreteDark)
    railBars(c, m, 'z', bz - 0.8, bz + 0.8, C.x1 + 0.46, 2.55, 0.44)
  }
  smallAc(c, m, C.x1 + 0.13, 4.5, -4.6, Math.PI / 2)
  smallAc(c, m, C.x1 + 0.13, 4.5, -7.6, Math.PI / 2)
  put(c, xf(planeGeo(0.66, 1.34), [C.x1 + 0.03, 0.85, -7.6], [0, Math.PI / 2, 0]), m.paintDim)
  put(c, tubeGeo(pv([[C.x1 + 0.06, 0.16, C.z1 - 0.16], [C.x1 + 0.06, C.top + 0.1, C.z1 - 0.16]]), 0.055), m.concreteDark)

  /* D 前街对向：压在 default camera 视线上，檐口压低并把窗开到 s/e 两个观赏面，否则左下只剩一块黑屋顶 */
  const D: Bldg = { x0: nb.acrossFront.minX + 0.1, x1: nb.acrossFront.maxX + 0.1, z0: nb.acrossFront.minZ, z1: nb.acrossFront.maxZ - 0.15, top: 3.18 }
  building(c, m, D, '#4a5270', true, -1, D.x0 + 0.3, drips)
  const dw: Win[] = []
  for (let i = 0; i < 6; i++) {
    dw.push({ face: 'n', x: -8.9 + i * 1.42, y: 2.48, z: D.z0 - 0.02, w: 0.8, h: 0.66, lit: i === 1 || i === 4, curtain: i % 2 === 0 })
  }
  for (let i = 0; i < 4; i++) {
    dw.push({
      face: 's',
      x: -8.7 + i * 2.16,
      y: 1.06,
      z: D.z1 + 0.02,
      w: 0.92,
      h: 0.82,
      lit: i === 0 || i === 2,
      curtain: i === 1 || i === 2,
    })
  }
  dw.push({ face: 's', x: -2.4, y: 2.48, z: D.z1 + 0.02, w: 0.78, h: 0.62, lit: true, curtain: true })
  dw.push({ face: 's', x: -5.1, y: 2.48, z: D.z1 + 0.02, w: 0.78, h: 0.62 })
  for (let i = 0; i < 3; i++) {
    dw.push({ face: 'e', x: D.x1 + 0.02, y: 2.48, z: 8.06 + i * 0.66, w: 0.5, h: 0.6, lit: i === 1 })
  }
  dw.push({ face: 'e', x: D.x1 + 0.02, y: 1.06, z: 8.7, w: 0.86, h: 0.82, lit: true, curtain: true })
  placeWindows(c, dw, m)
  put(c, rl([-3.1, 2.6, D.z0 - 0.32], 3.6, 0.09, 0.62, 0.03), m.blueDeep, { rot: [0.1, 0, 0], line: 'soft' })
  signBoard(c, m, -6.6, 2.34, D.z0 - 0.06, Math.PI, 1.05, 0.4, 'パン', '#3a2b1e', '#f0d78c', 'BAKERY')
  for (const px of [-4.3, -2.3]) {
    put(c, xf(planeGeo(0.9, 1.3), [px, 1.2, D.z0 - 0.05]), m.paneLit)
    put(c, xf(planeGeo(0.94, 1.34), [px, 1.2, D.z0 - 0.02]), m.glassWet)
    anchor(c, [px, 1.1, D.z0 - 0.36], PAL.warmLight, 1.1, 0.5)
  }
  railBars(c, m, 'x', -9.4, -7.4, D.z0 - 0.06, 2.05, 0.34)
  const mb2 = boxGeo(0.3, 0.21, 0.16)
  for (let i = 0; i < 3; i++) batch(c, 'mailbox', mb2, m.metal, [-8.9 + i * 0.34, 1.2, D.z0 - 0.14])
  signBoard(c, m, -6.6, 1.74, D.z1 + 0.06, 0, 1.7, 0.38, '松栄荘', '#22304d', '#ffd9a0', 'SHOEIU')
  smallAc(c, m, -7.4, 2.56, D.z1 - 0.05, 0)
  smallAc(c, m, -3.9, 2.56, D.z1 - 0.05, 0)
  put(c, xf(planeGeo(0.62, 1.34), [-1.8, 0.86, D.z1 + 0.03]), m.paneLit)
  put(c, bl([-1.8, 1.58, D.z1 + 0.05], 0.78, 0.1, 0.06), m.metalDark)
  anchor(c, [-1.8, 1.0, D.z1 + 0.24], PAL.warmLight, 1.0, 0.45)
  roofGear(c, m, -8.3, D.top + 0.16, 9.2, -3.4, D.top + 0.16, 9.4)
}

/* =================================================================== */
/* 15. 停车位 + 軽バン                                                 */
/* =================================================================== */

function keiVan(c: Ctx, m: Mats) {
  const len = 2.72
  const wid = 1.28
  const cx = -9.14 + len / 2
  const cz = 4.44
  const vanM = toon(0xb9c4d6, { fx: { sheen: 0.24, rimStrength: 0.24 } })
  const f = localFrame(c, [cx, 0, cz], [0, 0, 0], 1)
  f.put(join([rl([0, 0.86, 0], len - 0.04, 0.94, wid, 0.08), rl([1.18, 0.78, 0], 0.34, 0.6, wid - 0.04, 0.09)]), vanM, { line: 'dark' })
  f.put(rl([-0.16, 1.55, 0], 2.16, 0.52, wid - 0.08, 0.1), vanM, { line: 'dark' })
  f.put(
    join([
      bl([0, 0.36, 0], len + 0.04, 0.2, wid - 0.02),
      bl([1.36, 0.98, 0], 0.06, 0.24, wid - 0.1),
      bl([-1.36, 0.98, 0], 0.06, 0.24, wid - 0.1),
      bl([0.98, 1.56, wid / 2 - 0.02], 0.02, 0.36, 0.24),
      bl([0.98, 1.56, -wid / 2 + 0.02], 0.02, 0.36, 0.24),
      bl([-0.72, 1.56, wid / 2 - 0.02], 1.28, 0.34, 0.02),
      bl([-0.72, 1.56, -wid / 2 + 0.02], 1.28, 0.34, 0.02),
      bl([0, 1.86, 0], 1.6, 0.04, 1.02),
      bl([-0.4, 1.89, 0.34], 0.02, 0.02, 0.66),
      bl([-0.4, 1.89, -0.34], 0.02, 0.02, 0.66),
      bl([-0.34, 1.84, 0.5], 0.7, 0.03, 0.03),
      bl([-0.34, 1.84, -0.5], 0.7, 0.03, 0.03),
    ]),
    m.metalDark,
  )
  f.put(
    join([
      bl([0.96, 1.56, 0], 0.03, 0.4, 1.02, [0, 0, -0.12]),
      bl([-0.72, 1.56, wid / 2 - 0.035], 1.2, 0.3, 0.01),
      bl([-0.72, 1.56, -wid / 2 + 0.035], 1.2, 0.3, 0.01),
      bl([-1.37, 1.56, 0], 0.02, 0.3, 0.8),
      bl([1.39, 0.86, 0], 0.02, 0.32, 0.9),
    ]),
    m.vanGlass,
  )
  f.put(join([bl([1.39, 0.66, 0.4], 0.03, 0.13, 0.22), bl([1.39, 0.66, -0.4], 0.03, 0.13, 0.22)]), glow(PAL.warmLight, 1.5))
  f.put(join([bl([-1.39, 1.0, 0.46], 0.03, 0.16, 0.14), bl([-1.39, 1.0, -0.46], 0.03, 0.16, 0.14)]), glow(PAL.red, 1.35))
  f.put(
    join([
      ...[-0.85, 0.85].flatMap((wx) => [
        xf(cylGeo(0.235, 0.235, 0.115, 16), [wx, 0.235, wid / 2 - 0.05], [Math.PI / 2, 0, 0]),
        xf(cylGeo(0.235, 0.235, 0.115, 16), [wx, 0.235, -wid / 2 + 0.05], [Math.PI / 2, 0, 0]),
      ]),
    ]),
    m.rubber,
  )
  f.put(
    join([
      ...[-0.85, 0.85].flatMap((wx) => [
        xf(cylGeo(0.115, 0.115, 0.03, 12), [wx, 0.235, wid / 2 - 0.005], [Math.PI / 2, 0, 0]),
        xf(cylGeo(0.115, 0.115, 0.03, 12), [wx, 0.235, -wid / 2 + 0.005], [Math.PI / 2, 0, 0]),
      ]),
      bl([1.39, 0.42, -0.2], 0.02, 0.1, 0.22),
    ]),
    m.paintDim,
  )
  f.finish()
}

function parking(c: Ctx, m: Mats) {
  const y = 0.012
  const lm = toon(PAL.paint, { fx: { sheen: 0.18 } })
  const bays: { pos: P3; sc: P3 }[] = [
    { pos: [-7.87, y, 3.62], sc: [2.6, 0.055, 1] },
    { pos: [-4.95, y, 3.62], sc: [3.0, 0.055, 1] },
    { pos: [-7.87, y, 5.46], sc: [2.6, 0.055, 1] },
    { pos: [-4.95, y, 5.46], sc: [3.0, 0.055, 1] },
    { pos: [-9.18, y, 4.54], sc: [0.055, 1.84, 1] },
    { pos: [-6.55, y, 4.54], sc: [0.055, 1.84, 1] },
    { pos: [-3.43, y, 4.54], sc: [0.055, 1.84, 1] },
  ]
  bays.forEach((s) => batch(c, 'roadLine', c.flat, lm, s.pos, undefined, s.sc))
  const stop = join([rl([0, 0, 0], 1.0, 0.11, 0.15, 0.04), bl([0, 0.06, 0.03], 1.04, 0.02, 0.06)])
  batch(c, 'wheelStop', stop, m.yellow, [-7.9, 0.055, 5.3])
  batch(c, 'wheelStop', stop, m.yellow, [-5.3, 0.055, 5.3])
  const post = cylGeo(0.036, 0.042, 1, 10)
  batch(c, 'signPost', post, m.metalDark, [-6.55, 0.16 + 0.66, 5.56], undefined, [1, 1.32, 1])
  put(c, xf(circleGeo(0.18), [-6.55, 1.5, 5.56]), toon(PAL.blue, { map: trafficSignTex('parking'), transparent: true, side: THREE.DoubleSide }))
  keiVan(c, m)
}

/* =================================================================== */
/* 组装                                                              */
/* =================================================================== */

export function buildStreetProps(kit: Kit): PropsResult {
  const c: Ctx = {
    kit,
    anchors: [],
    drips: [],
    rnd: mulberry32(0x51ad7),
    batches: new Map(),
    flat: xf(planeGeo(1, 1), [0, 0, 0], [-Math.PI / 2, 0, 0]),
  }
  const m = makeMats()
  const sway: Sway[] = []
  const spins: Spin[] = []
  const wires: Wire[] = []
  const pulses: Pulse[] = []

  vendingMachines(c, m, pulses)
  bicycle(c, m, { x: 2.62, z: 0.02, ry: Math.PI / 2 + 0.2, roll: 0.15, color: 0x3d5a7a })
  bicycle(c, m, { x: -4.62, z: -1.42, ry: Math.PI / 2, roll: 0.05, color: 0x5a6a86, umbrella: true })
  bicycle(c, m, { x: -8.02, z: -4.2, ry: 1.5, roll: 0.12, s: 0.72, color: PAL.red, basket: true })
  bikePark(c, m)
  umbrellaStand(c, m)
  trashCluster(c, m)
  streetlights(c, m)
  utilityPole(c, m, L.spots.utilityPole.x, L.spots.utilityPole.z, L.y.walk, 8.6, true)
  utilityPole(c, m, L.spots.utilityPoleFar.x, L.spots.utilityPoleFar.z, 0.0, 7.9, false)
  powerWires(c, m, wires)
  signs(c, m)
  guardFences(c, m)
  const sig = trafficSignal(c, m)
  acUnits(c, m, spins)
  boards(c, m)
  backAlley(c, m, sway)
  neighbors(c, m, c.drips)
  parking(c, m)

  c.batches.forEach((b) => {
    if (b.list.length) kit.instanced(b.geo, b.mat, b.list, b.geo.type === '' ? undefined : undefined)
  })

  // 巷内提灯光晕
  const halo2 = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex(),
      color: new THREE.Color(PAL.orange),
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  halo2.position.set(-8.56, 2.9, -2.74)
  halo2.scale.set(1.2, 1.2, 1)
  halo2.userData.noReflect = true
  kit.attach(halo2)

  let phase = -1
  const update = (t: number, dt: number) => {
    for (const s of spins) s.mesh.rotation.z += dt * s.speed
    for (const w of wires) {
      const a = t * w.freq + w.phase
      w.mesh.position.y = Math.sin(a) * w.amp
      w.mesh.position.x = Math.cos(a * 0.61) * w.amp * 0.6
      w.mesh.position.z = Math.sin(a * 0.83) * w.amp * 0.4
    }
    for (const s of sway) {
      const a = t * s.freq + s.phase
      s.obj.rotation.x = Math.sin(a) * s.amp
      s.obj.rotation.z = Math.cos(a * 0.73) * s.amp * 0.8
    }
    for (const p of pulses) {
      p.mat.color.copy(p.base).multiplyScalar(1 + Math.sin(t * 1.6 + p.phase) * p.amount)
    }
    const tt = (t % 9 + 9) % 9
    const next = tt < 4 ? 0 : tt < 5 ? 1 : 2
    if (next !== phase) {
      phase = next
      sig.on.forEach((o, i) => (o.visible = i === next))
      sig.pedOn.forEach((o, i) => (o.visible = i === (next === 2 ? 1 : 0)))
      sig.sig.color = PHASE[next].color
      sig.sig.intensity = next === 2 ? 0.9 : 0.7
    }
    const lit = sig.on[next]
    if (lit) {
      const mm = lit.material as THREE.MeshBasicMaterial
      const k = 1.12 + Math.sin(t * 9.1) * 0.08
      mm.color.setHex(PHASE[next].color).multiplyScalar(k)
    }
  }

  return { anchors: c.anchors, dripAnchors: c.drips, signal: sig.sig, update }
}
