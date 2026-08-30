import * as THREE from 'three'
import { L } from './layout'
import { PAL, glow, glowMap, toon, toonSoft } from './materials'
import { Kit, boxGeo, coneGeo, cylGeo, planeGeo, sphereGeo, type PartOpts } from './kit'
import {
  bannerTex,
  clockTex,
  coffeeMenuTex,
  doormatTex,
  guideArrowTex,
  lightboxTex,
  magazineTex,
  posterTex,
  storeFloorTex,
  stripTex,
  wallTileTex,
} from './textures'

export interface InteriorResult {
  /** 湿润地面反光需要的自发光锚点（位置 + 颜色 + 半径 + 强度） */
  anchors: { pos: [number, number, number]; color: number; size: number; intensity: number; floorRef?: boolean }[]
  /** 关东煮 / 咖啡蒸汽发射点，供天气模块生成蒸汽 */
  steamAnchors: [number, number, number][]
  /** 需要缓慢闪烁的灯箱材质（招牌/灯箱故障感） */
  flickerMats: THREE.MeshBasicMaterial[]
  update(t: number, dt: number): void
}

/** 确定性 PRNG：保证每次 reload 店内摆位一致 */
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

type Vec3 = [number, number, number]
type Inst = { pos: Vec3; rot?: Vec3; scale?: number | Vec3 }
type Merch = 'cube' | 'bag' | 'pouch' | 'bottle' | 'can' | 'cup'

/**
 * 雨夜便利店 —— 明亮店内（透过两面玻璃看到的“发光盒子”）
 *
 * 严格留在店内体积：X ∈ [-7.65,1.65]  Z ∈ [-8.45,-2.55]  Y ∈ [0.2,3.35]
 * 结构件 / 商品全部按「几何 + 材质」合批成 InstancedMesh（单位盒 + 逐实例 scale），
 * 只有饮料柜体、收银台、关东煮台、冰柜这类主角件走非批量 mesh 并烘焙线稿。
 */
export function buildInterior(kit: Kit): InteriorResult {
  // 店内物件统一启用图层 1：店内点光只照店内，不会穿透屋顶与外墙
  kit.lightLayer = 1
  const anchors: InteriorResult['anchors'] = []
  const steamAnchors: [number, number, number][] = []
  const flickerMats: THREE.MeshBasicMaterial[] = []

  const rnd = mulberry32(0x51b7a3)
  const jit = (a: number) => (rnd() - 0.5) * a
  const anchor = (pos: Vec3, color: number, size: number, intensity: number, floorRef = false) =>
    void anchors.push({ pos, color, size, intensity, floorRef })

  // ---------------------------------------------------------- 体积
  const X0 = L.store.minX + 0.15
  const X1 = L.store.maxX - 0.15
  const Z0 = L.store.minZ + 0.15
  const Z1 = L.store.maxZ - 0.15
  const fy = L.y.storeFloor + 0.02
  const CY = L.y.ceiling
  const W = X1 - X0
  const D = Z1 - Z0
  const CX = (X0 + X1) / 2
  const CZ = (Z0 + Z1) / 2
  const WH = CY - fy

  // ---------------------------------------------------------- 材质
  const floorTex = storeFloorTex().clone()
  floorTex.repeat.set(9, 6)
  floorTex.needsUpdate = true
  const tileTex = wallTileTex().clone()
  tileTex.repeat.set(10, 3)
  tileTex.needsUpdate = true

  const mFloor = toonSoft(PAL.interiorFloor, { map: floorTex, fx: { rimStrength: 0.07, sheen: 0.16 } })
  const mWall = toonSoft(PAL.wallTile, { map: tileTex, fx: { rimStrength: 0.06 } })
  const mWallS = toonSoft(PAL.wallSide, { fx: { rimStrength: 0.07 } })
  const mCeil = toonSoft(PAL.paper, { fx: { rimStrength: 0.04 } })
  const mShelf = toonSoft(PAL.shelf, { fx: { rimStrength: 0.1 } })
  const mCream = toon(PAL.fascia)
  const mPaper = toon(PAL.paper)
  const mSteel = toon(PAL.metal)
  const mDark = toon(PAL.metalDark)
  const mRubber = toon(PAL.rubber)
  const mWood = toon(PAL.wood)
  const mTeal = toon(PAL.teal)
  const mTealD = toon(PAL.tealDeep)
  const mBlue = toon(PAL.blue)
  const mBlueD = toon(PAL.blueDeep)
  const mOrange = toon(PAL.orange)
  const mRed = toon(PAL.red)
  const mPink = toon(PAL.pink)
  const mGreen = toon(PAL.green)
  const mYellow = toon(PAL.yellow)
  const mWarm = toon(PAL.warmLight)
  const mLeaf = toon(PAL.green)
  const mLeaf2 = toon(PAL.tealDeep)
  const mGlass = toon(PAL.glassTint, {
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
    fx: { rimStrength: 0.6, sheen: 0.35 },
  })
  const mBroth = toonSoft(0x8a5a26, { fx: { rimStrength: 0.1, sheen: 0.55, sheenColor: 0xffc98a } })
  const mLitW = glow(PAL.warmLight, 1.06)
  const mLitC = glow(0xdcf3ff, 1.2)
  const mLitSoft = glow(PAL.fascia, 1.05)
  const mPanel = glow(PAL.warmLight, 1.12)
  const mScreen = glow(0xbfe9ff, 1.15)
  const mScan = glow(PAL.red, 1.4, 0.9)
  const mCaseWarm = glow(PAL.orange, 1.0, 0.85)

  // ---------------------------------------------------------- 合批
  const groups = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material; list: Inst[] }>()
  const geoId = new Map<THREE.BufferGeometry, string>()
  const matId = new Map<THREE.Material, string>()
  let idN = 0
  const gid = (g: THREE.BufferGeometry) => {
    let n = geoId.get(g)
    if (!n) {
      n = 'g' + idN++
      geoId.set(g, n)
    }
    return n
  }
  const mid = (m: THREE.Material) => {
    let n = matId.get(m)
    if (!n) {
      n = 'm' + idN++
      matId.set(m, n)
    }
    return n
  }
  const item = (geo: THREE.BufferGeometry, mat: THREE.Material, it: Inst) => {
    const key = gid(geo) + '|' + mid(mat)
    let g = groups.get(key)
    if (!g) {
      g = { geo, mat, list: [] }
      groups.set(key, g)
    }
    g.list.push(it)
  }

  const UB = boxGeo(1, 1, 1)
  const UP = planeGeo(1, 1)
  const gBot = cylGeo(0.026, 0.05, 0.2, 8)
  const gCan = cylGeo(0.034, 0.034, 0.1, 9)
  const gCup = cylGeo(0.048, 0.036, 0.1, 9)
  const gOni = coneGeo(0.062, 0.078, 3)
  const gEgg = sphereGeo(0.036, 9)
  const gDai = cylGeo(0.045, 0.045, 0.035, 10)
  const gBowl = cylGeo(0.072, 0.05, 0.052, 10)
  const gHand = cylGeo(0.013, 0.013, 0.46, 6)
  const gPot = cylGeo(0.15, 0.11, 0.26, 10)
  const gPlant = coneGeo(0.21, 0.44, 7)
  const gUmb = cylGeo(0.014, 0.014, 0.62, 6)
  const gRod = cylGeo(0.011, 0.011, 1.15, 6)

  /** 结构件：单位盒 + 逐实例缩放（同材质自动并批） */
  const slab = (mat: THREE.Material, pos: Vec3, size: Vec3, rot?: Vec3) =>
    item(UB, mat, { pos, scale: size, rot })
  /** 灯片 / 价签条 / 地贴 */
  const face = (mat: THREE.Material, pos: Vec3, w: number, h: number, rot: Vec3) =>
    item(UP, mat, { pos, scale: [w, h, 1], rot })

  const stripMats = new Map<string, THREE.MeshBasicMaterial>()
  const stripMap = (text: string, bg = '#ffffff', fg = '#2f6f66', hh = 64) => {
    const k = `${text}|${bg}|${fg}|${hh}`
    let m = stripMats.get(k)
    if (!m) {
      m = glowMap(0xffffff, stripTex(text, bg, fg, hh), 1.05)
      stripMats.set(k, m)
    }
    return m
  }
  const printMats = new Map<string, THREE.MeshToonMaterial>()
  const printMap = (key: string, map: THREE.Texture, color = PAL.paper) => {
    let m = printMats.get(key)
    if (!m) {
      m = toon(color, { map, fx: { rimStrength: 0.08 } })
      printMats.set(key, m)
    }
    return m
  }

  const flickers: { m: THREE.MeshBasicMaterial; c: THREE.Color; ph: number }[] = []
  const addFlicker = (m: THREE.MeshBasicMaterial) => {
    flickers.push({ m, c: m.color.clone(), ph: rnd() * 6.283 })
    flickerMats.push(m)
  }

  const box = (w: number, h: number, d: number, mat: THREE.Material, p: Vec3, o: PartOpts = {}) =>
    kit.box(w, h, d, mat, { pos: p, receive: true, ...o })
  const rbox = (w: number, h: number, d: number, mat: THREE.Material, p: Vec3, o: PartOpts & { r?: number } = {}) =>
    kit.rbox(w, h, d, mat, { pos: p, receive: true, ...o })
  const quad = (w: number, h: number, mat: THREE.Material, p: Vec3, rot: Vec3, o: PartOpts = {}) =>
    kit.plane(w, h, mat, { pos: p, rot, ...o })

  /** 商品规格 */
  const MERCH: Record<Merch, { geo: THREE.BufferGeometry; step: number; h: number; size: Vec3 }> = {
    cube: { geo: UB, step: 0.185, h: 0.25, size: [0.1, 0.25, 0.165] },
    bag: { geo: UB, step: 0.235, h: 0.29, size: [0.075, 0.29, 0.21] },
    pouch: { geo: UB, step: 0.155, h: 0.21, size: [0.08, 0.21, 0.135] },
    bottle: { geo: gBot, step: 0.115, h: 0.2, size: [1, 1, 1] },
    can: { geo: gCan, step: 0.085, h: 0.1, size: [1, 1, 1] },
    cup: { geo: gCup, step: 0.11, h: 0.1, size: [1, 1, 1] },
  }
  /** 沿 axis 排一列商品，位置/朝向/高度都有微量抖动 */
  const stock = (
    kind: Merch,
    mat: THREE.Material,
    x: number,
    shelfY: number,
    z: number,
    axis: 'x' | 'z',
    n: number,
    tall = 1,
  ) => {
    const p = MERCH[kind]
    const cube = kind === 'cube' || kind === 'bag' || kind === 'pouch'
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * p.step + jit(0.012)
      const f = 0.9 + rnd() * 0.18
      const h = p.h * f * tall
      item(p.geo, mat, {
        pos: [x + (axis === 'x' ? o : jit(0.008)), shelfY + h / 2 + 0.03, z + (axis === 'z' ? o : jit(0.008))],
        rot: [jit(0.03), (axis === 'x' ? Math.PI / 2 : 0) + jit(0.16), jit(0.05)],
        scale: cube ? [p.size[0], h, p.size[2]] : [f, h / p.h, f],
      })
    }
  }

  const goodsA: THREE.Material[] = [mYellow, mBlue, mPink, mGreen, mRed, mTeal]

  // ========================================================== 1. 楼板 / 墙 / 吊顶
  kit.box(W, 0.06, D, mFloor, { pos: [CX, fy - 0.03, CZ], cast: true, receive: true })
  quad(W, WH, mWall, [CX, fy + WH / 2, Z0 + 0.004], [0, 0, 0])
  quad(D, WH, mWallS, [X0 + 0.004, fy + WH / 2, CZ], [0, Math.PI / 2, 0])
  box(W, 0.34, 0.16, mCream, [CX, CY - 0.18, Z1 + 0.05], { line: 'soft' })
  box(0.16, 0.34, D, mCream, [X1 - 0.06, CY - 0.18, CZ])
  quad(W, D, mCeil, [CX, CY - 0.015, CZ], [Math.PI / 2, 0, 0])
  // 窗上遮光带的下沿灯槽（把暖光洒向店门方向）
  face(mLitW, [CX, CY - 0.36, Z1 - 0.06], W - 0.5, 0.12, [Math.PI / 2, 0, 0])
  face(mLitW, [X1 - 0.12, CY - 0.36, CZ], 0.12, D - 0.5, [Math.PI / 2, 0, 0])

  const LX = [-6.2, -4.4, -2.6, -0.8, 0.95]
  const LZ = [-7.7, -6.2, -4.7, -3.15]
  for (const z of LZ) for (const x of LX) face(mPanel, [x, CY - 0.05, z], 1.2, 0.6, [Math.PI / 2, 0, 0])
  for (const z of [-8.05, -7.4, -6.5, -5.9, -5.0, -4.4, -3.48, -2.85]) slab(mDark, [CX, CY - 0.06, z], [W - 0.1, 0.07, 0.05])
  for (const x of [-6.8, -5.6, -5.0, -3.8, -3.2, -2.0, -1.4, -0.2, 0.35, 1.55])
    slab(mDark, [x, CY - 0.06, CZ], [0.05, 0.07, D - 0.5])
  anchor([-6.2, CY - 0.2, -4.7], PAL.warmLight, 2.6, 0.9, true)
  anchor([-2.6, CY - 0.2, -4.7], PAL.warmLight, 2.6, 0.9, true)
  anchor([0.95, CY - 0.2, -3.15], PAL.warmLight, 2.2, 0.8, true)

  // ========================================================== 2. gondola 货架（L.interior.aisle）
  const A = L.interior.aisle
  const zc = (A.z0 + A.z1) / 2
  const rl = A.z1 - A.z0
  const tiers = [0.5, 0.95, 1.4, 1.85]
  const rowLabel = ['おかし', 'ドリンク', 'パン', 'カップめん']
  const rowStrip = ['SNACK 98', 'COLD 89', 'BREAD 68', 'CUP NOODLE']
  const rowTop = [mTeal, mBlue, mOrange, mRed]
  const rowPlan: Merch[][] = [
    ['bag', 'cube', 'bag', 'pouch'],
    ['bottle', 'bottle', 'can', 'pouch'],
    ['cube', 'bag', 'cube', 'pouch'],
    ['cup', 'cup', 'cube', 'can'],
  ]
  const rowCols: THREE.Material[][] = [
    [mRed, mGreen, mYellow],
    [mTeal, mBlue, mPink],
    [mPink, mOrange, mTeal],
    [mBlue, mYellow, mRed],
  ]
  for (let i = 0; i < A.count; i++) {
    const rx = A.x0 + A.dx * i
    slab(mShelf, [rx, fy + 0.09, zc], [0.52, 0.16, rl - 0.04])
    slab(mShelf, [rx, fy + 1.06, zc], [0.07, 1.95, rl - 0.06])
    for (const zz of [A.z0 + 0.05, A.z1 - 0.05]) {
      slab(mShelf, [rx - 0.25, fy + 1.06, zz], [0.05, 1.95, 0.05])
      slab(mShelf, [rx + 0.25, fy + 1.06, zz], [0.05, 1.95, 0.05])
    }
    for (const ty of tiers) slab(mShelf, [rx, fy + ty, zc], [0.56, 0.04, rl - 0.08])
    // 顶部看板：主角件，给勾线
    rbox(0.64, 0.36, rl - 0.02, rowTop[i], [rx, fy + 2.12, zc], { line: 'dark', r: 0.03 })
    quad(0.52, 0.15, stripMap(rowLabel[i], '#ffffff', '#20313f'), [rx, fy + 2.14, A.z1 + 0.005], [0, 0, 0])
    const stripMat = stripMap(rowStrip[i], '#f7f7f2', '#c85a3c')
    for (let t = 0; t < tiers.length; t++) {
      const ty = tiers[t]
      for (const s of [1, -1]) {
        face(stripMat, [rx + s * 0.278, fy + ty + 0.06, zc], rl - 0.12, 0.075, [0, s * Math.PI / 2, 0])
        const kind = rowPlan[i][t]
        stock(kind, rowCols[i][(t + (s > 0 ? 0 : 1)) % 3], rx + s * 0.2, fy + ty, zc, 'z', Math.floor((rl - 0.34) / MERCH[kind].step))
      }
    }
    anchor([rx, fy + 1.25, zc], PAL.warmLight, 1.6, 0.42, true)
  }

  // ========================================================== 3. 饮料柜墙（L.interior.fridgeWall）
  const FW = L.interior.fridgeWall
  const fL = -6.35
  const fR = -0.7
  const fcx = (fL + fR) / 2
  const bodyZ = -8.26 // 实体背箱
  const glassZ = -7.87
  box(fR - fL, 2.24, 0.36, mCream, [fcx, fy + 1.2, bodyZ], { line: 'dark', hull: 0.008 })
  slab(mDark, [fcx, fy + 0.07, bodyZ + 0.02], [fR - fL + 0.04, 0.14, 0.42])
  box(fR - fL, 0.44, 0.4, mTealD, [fcx, fy + 2.54, bodyZ], { line: 'dark' })
  const bandM = stripMap('DRINK  COLD  BEER  DRINK', '#f2fbff', '#1f7f76', 96)
  quad(fR - fL - 0.2, 0.32, bandM, [fcx, fy + 2.54, bodyZ + 0.21], [0, 0, 0])
  addFlicker(bandM)
  slab(mCream, [fL - 0.03, fy + 1.4, bodyZ + 0.04], [0.06, 2.5, 0.44])
  slab(mCream, [fR + 0.03, fy + 1.4, bodyZ + 0.04], [0.06, 2.5, 0.44])

  const doorW = 1.1
  const doorN = 5
  const dStep = doorW + 0.0375
  const firstDoor = fL + doorW / 2 + 0.02
  const inZ = bodyZ + 0.2 // 柜内背板前
  for (let i = 0; i < doorN; i++) {
    const cx = firstDoor + dStep * i
    // 门框四边（避免整块面板挡死内部）
    slab(mWall, [cx - doorW / 2 + 0.03, fy + 1.24, glassZ - 0.02], [0.06, 2.0, 0.07])
    slab(mWall, [cx + doorW / 2 - 0.03, fy + 1.24, glassZ - 0.02], [0.06, 2.0, 0.07])
    slab(mWall, [cx, fy + 2.21, glassZ - 0.02], [doorW, 0.07, 0.07])
    slab(mWall, [cx, fy + 0.27, glassZ - 0.02], [doorW, 0.07, 0.07])
    slab(mGlass, [cx, fy + 1.24, glassZ], [doorW - 0.1, 1.88, 0.025])
    face(mLitC, [cx, fy + 1.28, inZ], doorW - 0.12, 1.94, [0, 0, 0])
    const kinds: Merch[] = ['bottle', 'can', 'pouch', 'bottle']
    for (let t = 0; t < 4; t++) {
      const sy = fy + 0.5 + t * 0.4
      slab(mSteel, [cx, sy, inZ + 0.09], [doorW - 0.18, 0.025, 0.18])
      stock(kinds[t], goodsA[(i * 2 + t) % 6], cx, sy, inZ + 0.09, 'x', 7, t === 2 ? 1.1 : 1)
    }
    item(gHand, mSteel, { pos: [cx + doorW / 2 - 0.08, fy + 1.26, glassZ + 0.05] })
    if (i % 2 === 0) anchor([cx, fy + 1.3, glassZ + 0.12], PAL.neonCyan, 1.5, 0.7, true)
  }
  anchor([FW.x0 + 3.5, fy + 2.4, FW.z + 0.55], PAL.warmLight, 3.2, 0.85, true)

  // ========================================================== 4. 便当 / 沙拉 冷柜（左壁）
  const bx = -7.28
  slab(mCream, [bx, fy + 0.25, -4.95], [0.58, 0.5, 2.6])
  slab(mCream, [bx - 0.28, fy + 1.05, -4.95], [0.06, 1.1, 2.6])
  slab(mCream, [bx - 0.02, fy + 1.65, -6.22], [0.6, 0.4, 0.06])
  slab(mCream, [bx - 0.02, fy + 1.65, -3.68], [0.6, 0.4, 0.06])
  slab(mTeal, [bx - 0.04, fy + 1.86, -4.95], [0.56, 0.1, 2.64])
  face(mLitC, [bx - 0.24, fy + 1.06, -4.95], 2.5, 1.06, [0, Math.PI / 2, 0])
  face(stripMap('お弁当 BENTO', '#fff6e6', '#b95a2c'), [bx + 0.26, fy + 1.62, -4.95], 2.46, 0.22, [0, Math.PI / 2, 0])
  const bentoCols = [mRed, mTeal, mYellow, mPink]
  for (let t = 0; t < 3; t++) {
    const sy = fy + 0.62 + t * 0.33
    const tx = bx + 0.14 - t * 0.09
    slab(mSteel, [tx, sy, -4.95], [0.44, 0.03, 2.5], [0, 0, -0.24])
    slab(mSteel, [tx + 0.2, sy + 0.09, -4.95], [0.02, 0.14, 2.5])
    const n = 11
    for (let i = 0; i < n; i++) {
      const c = bentoCols[(t + i) % 4]
      const pz = -4.95 + (i - (n - 1) / 2) * 0.215 + jit(0.012)
      slab(c, [tx + 0.03, sy + 0.045, pz], [0.12, 0.055, 0.19], [0, jit(0.09), -0.24])
    }
  }
  anchor([bx + 0.35, fy + 1.1, -4.95], PAL.warmLight, 1.7, 0.6, true)

  // ========================================================== 5. 饭团陈列 + 零食 gondola（窗边）
  const ox = -1.66
  slab(mCream, [ox, fy + 0.25, -3.1], [0.86, 0.5, 1.0])
  slab(mTeal, [ox, fy + 0.54, -3.1], [0.9, 0.06, 1.04])
  const noriM = [mDark, mRed, mGreen]
  for (let t = 0; t < 3; t++) {
    const sy = fy + 0.62 + t * 0.22
    const bz = -2.82 - t * 0.26
    slab(mShelf, [ox, sy, bz], [0.8, 0.035, 0.5], [0.26, 0, 0])
    slab(mShelf, [ox, sy + 0.06, bz - 0.24], [0.8, 0.12, 0.03], [0.26, 0, 0])
    const n = 7
    for (let i = 0; i < n; i++) {
      const px = ox + (i - (n - 1) / 2) * 0.108 + jit(0.006)
      const py = sy + 0.055 + jit(0.004)
      const ry = jit(0.18)
      item(gOni, rnd() < 0.5 ? mPaper : mWarm, {
        pos: [px, py, bz + 0.01],
        rot: [0, ry, 0],
        scale: [1, 0.9 + rnd() * 0.2, 1],
      })
      item(UB, noriM[(i + t) % 3], { pos: [px, py - 0.024, bz + 0.055], rot: [0.26, ry, 0], scale: [0.055, 0.034, 0.014] })
    }
  }
  slab(mDark, [ox - 0.41, fy + 0.9, -3.34], [0.04, 0.7, 0.04])
  face(stripMap('おにぎり 120', '#e9f6e9', '#2f7a4a'), [ox, fy + 1.28, -3.36], 0.82, 0.2, [0, 0, 0])

  const snx = -3.2
  slab(mCream, [snx, fy + 0.25, -3.0], [1.34, 0.5, 0.56])
  slab(mOrange, [snx, fy + 1.22, -3.0], [1.36, 0.32, 0.12])
  face(stripMap('おかし PROMO', '#ffffff', '#c85a3c'), [snx, fy + 1.22, -2.93], 1.2, 0.26, [0, 0, 0])
  const snStrip = stripMap('PROMA 100', '#ffffff', '#2f7a4a')
  for (let t = 0; t < 3; t++) {
    const sy = fy + 0.54 + t * 0.24
    slab(mShelf, [snx, sy, -3.0], [1.3, 0.035, 0.52])
    face(snStrip, [snx, sy + 0.06, -2.75], 1.28, 0.07, [0, 0, 0])
    const kinds: Merch[] = ['bag', 'cube', 'pouch']
    stock(kinds[t], rowCols[t % 4][t], snx, sy, -3.0, 'x', 6)
  }

  // ========================================================== 6. 收银台（L.interior.register）
  const R = L.interior.register
  const rgx0 = R.x - R.w / 2
  const rgx1 = 0.82
  const rgcx = (rgx0 + rgx1) / 2
  const rgw = rgx1 - rgx0
  rbox(rgw, 0.92, 0.95, mCream, [rgcx, fy + 0.47, -4.28], { line: 'dark', r: 0.03 })
  rbox(rgw + 0.1, 0.06, 1.06, mSteel, [rgcx, fy + 0.96, -4.28], { line: 'soft', r: 0.025 })
  slab(mBlueD, [rgcx, fy + 0.04, -4.28], [rgw, 0.08, 0.9])
  rbox(0.68, 0.92, 1.15, mCream, [-1.09, fy + 0.47, -5.35], { line: 'dark', r: 0.03 })
  rbox(0.76, 0.06, 1.24, mSteel, [-1.09, fy + 0.96, -5.35], { r: 0.025 })
  for (const px of [-0.6, 0.2]) {
    slab(mSteel, [px, fy + 1.08, -4.42], [0.34, 0.18, 0.26])
    slab(mDark, [px, fy + 1.3, -4.44], [0.06, 0.3, 0.06])
    face(mScreen, [px, fy + 1.47, -4.38], 0.3, 0.2, [-0.18, 0, 0])
    slab(mDark, [px + 0.26, fy + 1.0, -4.02], [0.16, 0.05, 0.12])
    face(mScan, [px + 0.26, fy + 1.032, -4.02], 0.12, 0.014, [-Math.PI / 2, 0, 0])
    slab(mSteel, [px - 0.34, fy + 0.38, -3.79], [0.5, 0.26, 0.03])
  }
  slab(mDark, [0.5, fy + 1.0, -4.05], [0.5, 0.03, 0.4])
  anchor([0.1, fy + 1.15, -3.7], PAL.neonCyan, 1.3, 0.5, true)

  // 香烟墙（柜台后侧）
  box(2.05, 1.12, 0.34, mCream, [0.575, fy + 1.98, -8.28], { line: 'dark' })
  slab(mShelf, [0.575, fy + 0.62, -8.26], [2.05, 1.16, 0.38])
  face(stripMap('TOBACCO', '#f7f2e4', '#8b5a2b'), [0.575, fy + 2.6, -8.1], 1.9, 0.2, [0, 0, 0])
  const tobCols = [mRed, mBlue, mPaper, mTeal]
  for (let t = 0; t < 3; t++) {
    const sy = fy + 1.6 + t * 0.28
    slab(mSteel, [0.575, sy, -8.12], [1.95, 0.03, 0.3])
    const n = 16
    for (let i = 0; i < n; i++) {
      const c = tobCols[(i + t) % 4]
      item(UB, c, {
        pos: [0.575 + (i - (n - 1) / 2) * 0.114 + jit(0.006), sy + 0.07, -8.07],
        rot: [0, jit(0.1), jit(0.03)],
        scale: [0.088, 0.115, 0.055],
      })
    }
  }
  // 口香糖转架 / 报纸架 / 篮筐
  slab(mSteel, [-1.52, fy + 0.62, -3.95], [0.06, 1.2, 0.06])
  const gumCols = [mTeal, mPink, mYellow]
  for (let t = 0; t < 4; t++) {
    const sy = fy + 0.42 + t * 0.28
    slab(mShelf, [-1.52, sy, -3.95], [0.34, 0.025, 0.3])
    for (let i = 0; i < 5; i++) {
      item(UB, gumCols[(i + t) % 3], {
        pos: [-1.52, sy + 0.07, -3.95 + (i - 2) * 0.056 + jit(0.004)],
        rot: [0, Math.PI / 2 + jit(0.1), jit(0.04)],
        scale: [0.09, 0.115, 0.02],
      })
    }
  }
  slab(mTealD, [1.14, fy + 1.05, -4.5], [0.3, 0.04, 0.44], [-0.32, 0, 0])
  for (let i = 0; i < 9; i++) {
    item(UB, mPaper, {
      pos: [1.14 + (i - 4) * 0.034, fy + 1.09 - i * 0.004, -4.34 + i * 0.012],
      rot: [-0.32 + jit(0.05), jit(0.08), jit(0.02)],
      scale: [0.3, 0.012, 0.42],
    })
  }
  for (let i = 0; i < 6; i++) {
    item(UB, i % 4 === 3 ? mTeal : mRed, {
      pos: [-1.5, fy + 0.07 + i * 0.1, -4.66],
      rot: [0, Math.PI / 2 + jit(0.12), 0],
      scale: [0.4, 0.09, 0.28],
    })
  }

  // ========================================================== 7+8. 关东煮 / 咖啡（L.interior.oden）
  const O = L.interior.oden
  const ocx = 1.24
  const ocLen = O.d - 0.5
  const ocy = fy + 0.96
  rbox(O.w - 0.14, 0.9, ocLen, mCream, [ocx, fy + 0.45, O.z - 0.2], { line: 'dark', r: 0.03 })
  rbox(O.w, 0.06, ocLen + 0.06, mSteel, [ocx, ocy, O.z - 0.2], { line: 'soft', r: 0.02 })
  slab(mBlueD, [ocx, fy + 0.04, O.z - 0.2], [O.w - 0.2, 0.08, ocLen])
  face(stripMap('おでん 大根 玉子', '#f7ecdd', '#8b5a2b'), [ocx - 0.44, ocy + 0.42, -5.35], 0.9, 0.2, [0, -Math.PI / 2, 0])
  const caseZ = -5.15
  slab(mDark, [ocx, ocy + 0.06, caseZ], [0.62, 0.06, 1.02])
  slab(mDark, [ocx - 0.3, ocy + 0.2, caseZ], [0.03, 0.26, 1.02])
  slab(mDark, [ocx + 0.3, ocy + 0.2, caseZ], [0.03, 0.26, 1.02])
  slab(mDark, [ocx, ocy + 0.2, caseZ - 0.51], [0.62, 0.26, 0.03])
  slab(mDark, [ocx, ocy + 0.2, caseZ + 0.51], [0.62, 0.26, 0.03])
  face(mCaseWarm, [ocx + 0.28, ocy + 0.22, caseZ], 0.98, 0.28, [0, -Math.PI / 2, 0])
  box(0.64, 0.3, 1.04, mGlass, [ocx, ocy + 0.34, caseZ])
  const cellX = [ocx - 0.19, ocx, ocx + 0.19]
  const cellZ = [caseZ - 0.31, caseZ, caseZ + 0.31]
  for (const a of cellX) for (const b of cellZ) face(mBroth, [a, ocy + 0.24, b], 0.16, 0.26, [Math.PI / 2, 0, 0])
  for (const a of [ocx - 0.095, ocx + 0.095]) slab(mSteel, [a, ocy + 0.24, caseZ], [0.012, 0.06, 0.96])
  for (const b of [caseZ - 0.155, caseZ + 0.155]) slab(mSteel, [ocx, ocy + 0.24, b], [0.58, 0.06, 0.012])
  for (let i = 0; i < 4; i++)
    item(gRod, mWood, { pos: [cellX[i % 3], ocy + 0.42, cellZ[(i + 1) % 3] - 0.04], rot: [0.1, 0, jit(0.12)], scale: [0.7, 0.55, 0.7] })
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const cnt = 2 + ((i + j) % 2)
      for (let k = 0; k < cnt; k++) {
        const px = cellX[i] + jit(0.05)
        const pz = cellZ[j] + jit(0.09)
        const mode = (i + j) % 3
        if (mode === 0) item(gEgg, mWarm, { pos: [px, ocy + 0.29, pz], rot: [0, jit(2), 0] })
        else if (mode === 1) item(gDai, mPaper, { pos: [px, ocy + 0.285, pz], rot: [0, jit(2), 0] })
        else item(UB, mDark, { pos: [px, ocy + 0.29, pz], rot: [0, jit(2), 0], scale: [0.075, 0.04, 0.095] })
      }
    }
  }
  for (let s = 0; s < 2; s++)
    for (let i = 0; i < 6; i++)
      item(gBowl, s ? mWarm : mPaper, { pos: [ocx - 0.14 + s * 0.28, ocy + 0.06 + i * 0.052, -5.9], rot: [0, jit(1.4), 0] })
  steamAnchors.push([ocx - 0.12, ocy + 0.6, caseZ - 0.31], [ocx + 0.16, ocy + 0.6, caseZ + 0.31])
  anchor([ocx - 0.34, ocy + 0.3, caseZ], PAL.orange, 1.6, 1.0, true)

  const cfz = -6.85
  rbox(0.6, 0.62, 0.58, mSteel, [ocx + 0.02, ocy + 0.37, cfz], { line: 'soft', r: 0.03 })
  slab(mDark, [ocx + 0.02, ocy + 0.71, cfz], [0.62, 0.06, 0.6])
  slab(mDark, [ocx - 0.29, ocy + 0.32, cfz], [0.03, 0.3, 0.42])
  kit.cyl(0.02, 0.016, 0.11, mRubber, { pos: [ocx - 0.34, ocy + 0.22, cfz] })
  slab(mSteel, [ocx - 0.31, ocy + 0.05, cfz], [0.22, 0.05, 0.4])
  face(mScreen, [ocx - 0.276, ocy + 0.46, cfz + 0.13], 0.1, 0.05, [0, -Math.PI / 2, 0])
  for (let s = 0; s < 3; s++)
    for (let i = 0; i < 7; i++)
      item(gCup, mPaper, { pos: [ocx + 0.22, ocy + 0.06 + i * 0.055, -6.2 - s * 0.16], rot: [0, jit(1.6), 0] })
  steamAnchors.push([ocx - 0.34, ocy + 0.36, cfz])
  anchor([ocx - 0.45, ocy + 0.4, cfz], PAL.paintWarm, 1.1, 0.7, true)
  slab(mCream, [1.56, fy + 2.65, -6.95], [0.14, 1.36, 1.1])
  const cafeM = glowMap(0xffffff, lightboxTex('CAFÉ', '#fff3d6', '#8b5a2b', 'COFFEE ¥120'), 1.12)
  quad(0.86, 0.36, cafeM, [1.47, fy + 2.9, -6.95], [0, -Math.PI / 2, 0])
  addFlicker(cafeM)
  quad(0.9, 0.5, printMap('menu', coffeeMenuTex(), 0xffffff), [1.48, fy + 2.35, -6.95], [0, -Math.PI / 2, 0])
  anchor([1.2, fy + 2.8, -6.95], PAL.warmLight, 1.4, 0.85)

  // ========================================================== 9. 冰柜岛（L.interior.freezer）
  const FR = L.interior.freezer
  const fzList = [-4.225, -2.775, -5.675]
  for (let i = 0; i < fzList.length; i++) {
    const x = fzList[i]
    if (i === 0) rbox(0.76, 0.34, 1.7, mCream, [x, fy + 0.17, FR.z], { line: 'dark', r: 0.035 })
    else slab(mCream, [x, fy + 0.17, FR.z], [0.76, 0.34, 1.7])
    slab(mCream, [x, fy + 0.6, FR.z - 0.855], [0.76, 0.56, 0.05])
    slab(mCream, [x, fy + 0.6, FR.z + 0.855], [0.76, 0.56, 0.05])
    slab(mCream, [x - 0.355, fy + 0.6, FR.z], [0.05, 0.56, 1.71])
    slab(mCream, [x + 0.355, fy + 0.6, FR.z], [0.05, 0.56, 1.71])
    slab(mSteel, [x, fy + 0.33, FR.z], [0.7, 0.03, 1.66])
    slab(mSteel, [x, fy + 0.9, FR.z], [0.8, 0.06, 1.74])
    slab(mGlass, [x, fy + 0.94, FR.z], [0.72, 0.02, 1.68])
    face(mLitC, [x, fy + 0.36, FR.z], 0.66, 1.6, [Math.PI / 2, 0, 0])
    face(stripMap('ICE CREAM', '#e5f0fb', '#33608f'), [x, fy + 0.66, FR.z + 0.885], 0.66, 0.14, [0, 0, 0])
    const cols = [mPink, mBlue, mWarm]
    for (let r2 = 0; r2 < 2; r2++)
      for (let k = 0; k < 7; k++)
        item(UB, cols[(k + r2) % 3], {
          pos: [x + (r2 - 0.5) * 0.3 + jit(0.01), fy + 0.47, FR.z - 0.7 + k * 0.22 + jit(0.02)],
          rot: [0, jit(0.14), jit(0.02)],
          scale: [0.26, 0.14, 0.18],
        })
    anchor([x, fy + 0.95, FR.z], PAL.neonCyan, 1.2, 0.4, true)
  }
  // 冰淇凌立柜（左前角）
  const icx = -7.06
  slab(mCream, [icx, fy + 0.2, -2.95], [0.84, 0.4, 0.66])
  slab(mCream, [icx, fy + 1.05, -3.25], [0.84, 1.3, 0.06])
  slab(mCream, [icx - 0.39, fy + 1.05, -2.95], [0.06, 1.3, 0.62])
  slab(mCream, [icx + 0.39, fy + 1.05, -2.95], [0.06, 1.3, 0.62])
  slab(mCream, [icx, fy + 1.72, -2.95], [0.84, 0.08, 0.66])
  slab(mGlass, [icx, fy + 1.05, -2.6], [0.72, 1.2, 0.025])
  face(mLitC, [icx, fy + 1.03, -3.21], 0.7, 1.16, [0, 0, 0])
  for (let t = 0; t < 3; t++) {
    const sy = fy + 0.55 + t * 0.38
    slab(mSteel, [icx, sy, -2.92], [0.7, 0.03, 0.2])
    for (let i = 0; i < 5; i++)
      item(UB, bentoCols[(i + t) % 4], {
        pos: [icx - 0.28 + i * 0.14 + jit(0.008), sy + 0.11, -2.92],
        rot: [0, jit(0.12), jit(0.03)],
        scale: [0.11, 0.18, 0.13],
      })
  }
  slab(mBlue, [icx, fy + 1.88, -2.95], [0.88, 0.26, 0.7])
  face(stripMap('ICE', '#e5f0fb', '#33608f'), [icx, fy + 1.88, -2.59], 0.7, 0.2, [0, 0, 0])
  anchor([icx, fy + 1.1, -2.6], PAL.neonCyan, 1.2, 0.6, true)

  // ========================================================== 10. 杂志架 / 海报 / 柱子 / 吊幟
  const mx = 1.36
  const mz = -3.05
  slab(mSteel, [mx, fy + 0.5, mz - 0.42], [0.42, 1.0, 0.035], [0, 0, -0.22])
  slab(mSteel, [mx, fy + 0.5, mz + 0.42], [0.42, 1.0, 0.035], [0, 0, -0.22])
  for (let t = 0; t < 3; t++) {
    const sy = fy + 0.28 + t * 0.3
    slab(mSteel, [mx, sy, mz], [0.4, 0.02, 0.84], [0, 0, -0.32])
    slab(mSteel, [mx - 0.18, sy + 0.07, mz], [0.02, 0.14, 0.82])
    for (let i = 0; i < 8; i++) {
      const gi = (t * 3 + i) % 4
      item(UB, printMap('mag' + gi, magazineTex(gi), 0xffffff), {
        pos: [mx - 0.02, sy + 0.12 + jit(0.006), mz + (i - 3.5) * 0.1 + jit(0.006)],
        rot: [0, jit(0.06), -0.32 + jit(0.05)],
        scale: [0.018, 0.24, 0.09],
      })
    }
  }

  for (const cxx of [-5.675, -2.775]) slab(mWallS, [cxx, fy + WH / 2, -6.95], [0.4, WH, 0.4])
  slab(mShelf, [CX, fy + WH - 0.12, -6.95], [W - 0.4, 0.22, 0.3])
  quad(0.3, 0.44, printMap('p-new', posterTex('new')), [-2.775, fy + 1.85, -6.73], [0, 0, 0])
  quad(0.3, 0.44, printMap('p-drink', posterTex('drink')), [-5.675, fy + 1.85, -6.73], [0, 0, 0])
  quad(0.34, 0.5, printMap('p-ice', posterTex('ice')), [X0 + 0.03, fy + 2.4, -3.1], [0, Math.PI / 2, 0])
  quad(0.34, 0.5, printMap('p-bento', posterTex('bento')), [X0 + 0.03, fy + 2.4, -4.4], [0, Math.PI / 2, 0])
  quad(0.32, 0.48, printMap('p-new2', posterTex('new')), [X0 + 0.03, fy + 2.4, -5.5], [0, Math.PI / 2, 0])
  quad(0.32, 0.48, printMap('p-rec', posterTex('recruit')), [-6.02, fy + 1.55, Z0 + 0.05], [0, 0, 0])

  const bXs = [-5.675, -4.225, -2.775]
  const banTex = ['新入荷', 'おでん', 'アイス']
  const banCol = ['#e0665c', '#f0a84a', '#3a7ec0']
  for (let i = 0; i < 3; i++) {
    quad(0.42, 0.98, printMap('ban' + i, bannerTex(banTex[i], banCol[i]), 0xffffff), [bXs[i], CY - 0.92, -6.05], [0, 0, 0])
    slab(mDark, [bXs[i], CY - 0.36, -6.05], [0.46, 0.04, 0.04])
    slab(mDark, [bXs[i], CY - 0.2, -6.05], [0.02, 0.34, 0.02])
  }

  // ========================================================== 11. 天花板 category 灯箱
  const catText = ['おかし', 'ドリンク', 'パン']
  const catBg = ['#fff3d6', '#e6f6ff', '#f7ecdd']
  const catFg = ['#b0603a', '#2a6c9c', '#8b5a2b']
  for (let i = 0; i < 3; i++) {
    const x = bXs[i]
    slab(mCream, [x, CY - 0.5, -4.2], [0.56, 0.34, 0.1])
    const m = glowMap(0xffffff, lightboxTex(catText[i], catBg[i], catFg[i]), 1.15)
    quad(0.5, 0.28, m, [x, CY - 0.5, -4.13], [0, 0, 0])
    if (i < 2) addFlicker(m)
    slab(mDark, [x - 0.2, CY - 0.19, -4.2], [0.02, 0.3, 0.02])
    slab(mDark, [x + 0.2, CY - 0.19, -4.2], [0.02, 0.3, 0.02])
    anchor([x, CY - 0.5, -4.2], PAL.warmLight, 0.9, 0.7)
  }

  // ========================================================== 12. 地面导视
  quad(2.0, 0.85, printMap('mat', doormatTex(), 0xffffff), [0.0, fy + 0.008, -3.0], [Math.PI / 2, 0, 0])
  quad(0.62, 0.62, printMap('guide', guideArrowTex(), 0xffffff), [-1.05, fy + 0.012, -3.25], [Math.PI / 2, 0, 0])
  slab(mBlue, [-0.1, fy + 0.011, -3.66], [2.4, 0.004, 0.06])
  slab(mYellow, [0.0, fy + 0.011, -7.62], [5.6, 0.004, 0.05])
  slab(mYellow, [-5.675, fy + 0.011, -6.35], [0.86, 0.004, 0.05])
  anchor([0.0, fy + 0.03, -3.0], PAL.warmLight, 2.6, 0.6, true)

  // ========================================================== 13. 后场门 / 储物柜 / 清洁角
  const B = L.interior.backDoor
  slab(mShelf, [B.x - 0.58, fy + 1.05, Z0 + 0.06], [0.12, 2.1, 0.14])
  slab(mShelf, [B.x + 0.58, fy + 1.05, Z0 + 0.06], [0.12, 2.1, 0.14])
  slab(mShelf, [B.x, fy + 2.16, Z0 + 0.06], [1.28, 0.14, 0.14])
  slab(mWallS, [B.x - 0.28, fy + 1.0, Z0 + 0.05], [0.58, 2.0, 0.05])
  slab(mWallS, [B.x + 0.29, fy + 1.0, Z0 + 0.05], [0.58, 2.0, 0.05])
  slab(mGlass, [B.x - 0.28, fy + 1.45, Z0 + 0.09], [0.34, 0.4, 0.02])
  slab(mGlass, [B.x + 0.29, fy + 1.45, Z0 + 0.09], [0.34, 0.4, 0.02])
  slab(mDark, [B.x, fy + 2.42, Z0 + 0.1], [0.52, 0.22, 0.09])
  face(glowMap(0xffffff, lightboxTex('EXIT', '#0b6b3a', '#e6ffef'), 1.2), [B.x, fy + 2.42, Z0 + 0.16], 0.46, 0.17, [0, 0, 0])
  anchor([B.x, fy + 2.42, Z0 + 0.35], PAL.green, 0.8, 0.45)

  const lkz = -7.62
  slab(mShelf, [-7.42, fy + 0.82, lkz], [0.4, 1.6, 1.05])
  slab(mSteel, [-7.42, fy + 1.66, lkz], [0.44, 0.08, 1.1])
  const lockCols = [mTeal, mBlue, mOrange, mPink, mYellow, mGreen]
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++) {
      const m = lockCols[(r * 3 + c) % 6]
      const dy = fy + 0.45 + r * 0.75
      const dz = lkz - 0.34 + c * 0.34
      slab(m, [-7.2, dy, dz], [0.03, 0.7, 0.31])
      slab(mSteel, [-7.18, dy, dz - 0.12], [0.025, 0.1, 0.025])
      face(mLitSoft, [-7.183, dy + 0.27, dz], 0.12, 0.06, [0, Math.PI / 2, 0])
    }
  anchor([-7.1, fy + 0.9, lkz], PAL.teal, 0.9, 0.3, true)

  // 后场角落：塑料托盘 + 周转筐 + 水桶 + 拖把
  slab(mBlueD, [-7.36, fy + 0.06, -6.75], [0.54, 0.12, 0.56])
  for (let s = 0; s < 2; s++)
    for (let i = 0; i < 2 + s; i++)
      slab(s ? mGreen : mTeal, [-7.48 + s * 0.24, fy + 0.2 + i * 0.17, -6.82], [0.24, 0.14, 0.34])
  kit.cyl(0.12, 0.1, 0.24, mRed, { pos: [-7.3, fy + 0.24, -6.55], receive: true })
  slab(mTeal, [-7.3, fy + 0.36, -6.55], [0.24, 0.02, 0.24])
  kit.tube([new THREE.Vector3(-7.3, fy + 0.34, -6.55), new THREE.Vector3(-7.16, fy + 1.25, -6.5)], 0.014, mWood, {
    receive: true,
  })
  kit.tube([new THREE.Vector3(-7.54, fy + 0.1, -6.44), new THREE.Vector3(-7.48, fy + 1.3, -6.36)], 0.013, mWood, {
    receive: true,
  })
  slab(mYellow, [-7.55, fy + 0.09, -6.43], [0.1, 0.17, 0.06])

  // ========================================================== 14. 生活感小物
  quad(0.44, 0.44, printMap('clock', clockTex(), 0xffffff), [0.72, CY - 0.52, Z0 + 0.05], [0, 0, 0])
  kit.torus(0.23, 0.02, mDark, { pos: [0.72, CY - 0.52, Z0 + 0.04] })
  const plants: [number, number][] = [
    [-6.28, -2.8],
    [1.34, -3.95],
  ]
  for (const p of plants) {
    item(gPot, mOrange, { pos: [p[0], fy + 0.13, p[1]], rot: [0, jit(1.4), 0] })
    item(gPlant, mLeaf, { pos: [p[0], fy + 0.5, p[1]], rot: [0, jit(2), 0], scale: [1, 1.1, 1] })
    item(gPlant, mLeaf2, { pos: [p[0], fy + 0.72, p[1]], rot: [0, jit(2), 0], scale: [0.68, 0.8, 0.68] })
  }
  kit.cyl(0.16, 0.14, 0.42, mSteel, { pos: [1.5, fy + 0.21, -2.78], receive: true })
  for (let i = 0; i < 4; i++)
    item(gUmb, i % 2 ? mBlue : mRed, { pos: [1.5 + jit(0.06), fy + 0.55, -2.78 + jit(0.06)], rot: [jit(0.14), 0, jit(0.14)] })
  const afx = 0.45
  const afz = -3.42
  slab(mYellow, [afx, fy + 0.3, afz], [0.44, 0.58, 0.025], [0.13, 0, 0.09])
  slab(mYellow, [afx, fy + 0.3, afz + 0.12], [0.44, 0.58, 0.025], [-0.13, 0, -0.09])
  quad(0.4, 0.5, printMap('p-af1', posterTex('new')), [afx, fy + 0.32, afz - 0.018], [0.13, 0, 0])
  quad(0.4, 0.5, printMap('p-af2', posterTex('oden')), [afx, fy + 0.32, afz + 0.138], [-0.13, Math.PI, 0])
  kit.sphere(0.09, mGlass, { pos: [-0.45, CY - 0.11, -3.15], scale: [1, 0.75, 1] })
  slab(mDark, [-0.45, CY - 0.04, -3.15], [0.16, 0.06, 0.16])
  for (let i = 0; i < 4; i++)
    item(UB, mBlue, {
      pos: [0.95, fy + 0.07 + i * 0.1, -3.3],
      rot: [0, Math.PI / 2 + jit(0.15), 0],
      scale: [0.4, 0.09, 0.28],
    })

  // ========================================================== 店内点光（最多 4 个）
  const lights: { p: Vec3; c: number; i: number; d: number }[] = [
    { p: [-5.2, CY - 0.35, -5.0], c: 0xffe6bd, i: 5.6, d: 6.5 },
    { p: [-1.6, CY - 0.35, -4.1], c: 0xffe0b0, i: 5.0, d: 6.0 },
    { p: [0.85, CY - 0.45, -6.3], c: 0xffdca8, i: 4.2, d: 5.0 },
    { p: [-3.3, fy + 2.2, -7.6], c: 0xcdefff, i: 3.0, d: 5.0 },
  ]
  for (const d of lights) {
    const pl = new THREE.PointLight(d.c, d.i, d.d, 2)
    pl.position.set(d.p[0], d.p[1], d.p[2])
    pl.castShadow = false
    kit.attach(pl)
  }
  anchor([-3.0, CY - 0.5, -2.9], PAL.warmLight, 6.5, 1.35, true)
  anchor([0.8, CY - 0.6, -5.6], PAL.warmLight, 4.0, 1.1, true)
  anchor([-6.5, CY - 0.6, -5.2], PAL.warmLight, 3.6, 0.95, true)

  // ========================================================== 输出合批
  groups.forEach((g, key) => {
    if (g.list.length) kit.instanced(g.geo, g.mat, g.list, 'i' + key)
  })

  let acc = 0
  const update = (t: number, dt: number) => {
    acc += Math.min(dt, 0.05)
    const tt = t + acc * 0.03
    for (const f of flickers) {
      let k = 0.93 + 0.07 * Math.sin(tt * 21 + f.ph * 4)
      const g = Math.sin(tt * 1.6 + f.ph) + Math.sin(tt * 3.7 + f.ph * 2.1)
      if (g < -1.72) k *= 0.4
      f.m.color.copy(f.c).multiplyScalar(k)
    }
  }

  kit.lightLayer = 0
  return { anchors, steamAnchors, flickerMats, update }
}
