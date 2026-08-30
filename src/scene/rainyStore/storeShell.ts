import * as THREE from 'three'
import { Kit, boxGeo, planeGeo, rboxGeo, cylGeo, sphereGeo, torusGeo } from './kit'
import { PAL, toon, toonSoft, glow, glowMap } from './materials'
import { fasciaTex, fasciaSideTex, tallSignTex, lightboxTex, doormatTex, stripTex, glowTex } from './textures'
import { L } from './layout'

export interface GlassPanel {
  center: [number, number, number]
  size: [number, number]
  axis: 'z' | 'x'
  sign: number
}

export interface Anchor {
  pos: [number, number, number]
  color: number
  size: number
  intensity: number
  floorRef?: boolean
}

export interface ShellResult {
  anchors: Anchor[]
  dripAnchors: [number, number, number][]
  glassPanels: GlassPanel[]
  flickerMats: THREE.MeshBasicMaterial[]
  hideForReflection: THREE.Object3D[]
  update(t: number, dt: number): void
}

const S = L.store
const Y = L.y

const glassVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4( position, 1.0 );
    vWorld = wp.xyz;
    vNormal = normalize( mat3( modelMatrix ) * normal );
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const glassFrag = /* glsl */ `
  precision highp float;
  uniform vec3 uTint;
  uniform vec3 uWarm;
  uniform float uTime;
  uniform float uWarmMix;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;

  float hash11(float p){ return fract(sin(p * 127.1) * 43758.5453); }

  // 雨水沿玻璃滑落：一列列独立的挂流，头部聚成水珠，身后拖一道渐细的水痕
  float rivulets(float hx, float vy, float t){
    float colId = floor(hx * 3.4);
    float r = hash11(colId);
    if (r < 0.3) return 0.0;
    float cx = (colId + 0.5 + (r - 0.5) * 0.55) / 3.4;
    float w = mix( 0.013, 0.038, hash11(colId + 7.3) );
    float sp = mix( 0.075, 0.2, hash11(colId + 3.1) );
    float ph = fract(t * sp + r * 3.7);
    float dy = vy - (1.06 - ph * 1.2);
    float dx = abs( hx - cx + sin(vy * 13.0 + r * 29.0) * 0.022 ) / w;
    float line = exp( -dx * dx );
    float tail = (1.0 - smoothstep( 0.0, mix(0.22, 0.62, r), dy )) * step( 0.0, dy );
    float bead = exp( -dx * dx * 1.1 ) * exp( -pow(dy * 30.0, 2.0) );
    return clamp( line * tail * 0.42 + bead, 0.0, 1.0 );
  }

  void main() {
    vec3 V = normalize( cameraPosition - vWorld );
    float ndv = clamp( dot( normalize( vNormal ), V ), 0.0, 1.0 );
    float fres = pow( 1.0 - ndv, 3.0 );

    // 三渲二玻璃：大面积保持通透，只在掠射角与斜向高光带上出现一点冷色反光
    float band = sin( ( vUv.x * 1.6 + vUv.y * 0.85 ) * 9.0 - uTime * 0.06 );
    float sheen = smoothstep( 0.93, 1.0, band ) * 0.22;
    float bandB = sin( ( vUv.x * 0.7 - vUv.y * 1.4 ) * 5.4 + uTime * 0.04 );
    sheen += smoothstep( 0.965, 1.0, bandB ) * 0.15;

    // 列网格走世界距离而不是 UV：正面墙与侧面幕墙的窗宽窄不同，用 UV 会让水痕疏密不一
    float horiz = mix( vWorld.x, vWorld.z, step( 0.5, abs( vNormal.x ) ) );
    float rv = rivulets( horiz, vUv.y, uTime );

    vec3 col = mix( uTint, uWarm, clamp( uWarmMix * ( 0.35 + 0.65 * vUv.y ), 0.0, 1.0 ) );
    col += vec3( 0.66, 0.79, 1.0 ) * sheen;
    col += vec3( 0.52, 0.66, 0.88 ) * rv * 0.52;
    float alpha = 0.07 + fres * 0.26 + sheen * 0.24 + rv * 0.36;
    gl_FragColor = vec4( col, clamp( alpha, 0.0, 0.62 ) );
  }
`

function makeGlassMat(warmMix: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: glassVert,
    fragmentShader: glassFrag,
    uniforms: {
      uTint: { value: new THREE.Color(PAL.glassTint) },
      uWarm: { value: new THREE.Color(0xffcf96) },
      uWarmMix: { value: warmMix },
      uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

export function buildStoreShell(kit: Kit): ShellResult {
  const g = new THREE.Group()
  g.name = 'storeShell'
  kit.attach(g)
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], opts: { rot?: [number, number, number]; cast?: boolean; receive?: boolean; line?: string; hull?: number } = {}) => {
    const m = kit.add(geo, mat, { pos, ...opts })
    return m
  }

  const wallMat = toonSoft(PAL.wallTile, {
    fx: { rimStrength: 0.12 },
  })
  const wallSideMat = toonSoft(PAL.wallSide, { fx: { rimStrength: 0.14 } })
  const frameMat = toon(PAL.metal, { fx: { rimStrength: 0.26, sheen: 0.1 } })
  const darkMetal = toon(PAL.metalDark, { fx: { rimStrength: 0.18 } })
  const roofMat = toon(PAL.metalDark, { fx: { rimStrength: 0.16, sheen: 0.22 } })
  const fasciaMat = glowMap(0xffffff, fasciaTex(), 0.62)
  const fasciaSideMat = glowMap(0xffffff, fasciaSideTex(), 0.72)
  const tallMat = glowMap(0xffffff, tallSignTex(), 0.86)
  const glassFront = makeGlassMat(0.5)
  const glassSide = makeGlassMat(0.42)
  const glassDoorMat = makeGlassMat(0.62)
  const hideForReflection: THREE.Object3D[] = []

  // ==================== 体块 / 墙 ====================
  const w = S.maxX - S.minX
  const d = S.maxZ - S.minZ
  const cx = (S.minX + S.maxX) / 2
  const cz = (S.minZ + S.maxZ) / 2
  const bodyH = Y.roof - 0.16
  const bodyCY = 0.16 + bodyH / 2
  const wallT = 0.14
  // 墙壳：只有背墙与左墙是实墙，正/右两个主立面整面交给玻璃幕墙，否则店内陈设会被实心体块挡死
  put(boxGeo(w, bodyH, wallT), wallMat, [cx, bodyCY, S.minZ + wallT / 2], { cast: true, receive: true, line: 'dark', hull: 0.01 })
  put(boxGeo(wallT, bodyH, d), wallSideMat, [S.minX + wallT / 2, bodyCY, cz], { cast: true, receive: true, line: 'dark', hull: 0.01 })
  // 玻璃顶以上到檐口的实墙带
  const bandH = Y.roof - L.facade.glassMaxY
  const bandCY = L.facade.glassMaxY + bandH / 2
  put(boxGeo(w, bandH, wallT), wallMat, [cx, bandCY, S.maxZ - wallT / 2], { cast: true, line: 'dark' })
  put(boxGeo(wallT, bandH, d), wallSideMat, [S.maxX - wallT / 2, bandCY, cz], { cast: true, line: 'dark' })
  // 内部掏空由正面 / 右面玻璃承担：贴一圈内衬墙裙，让店内看起来有明确边界
  kit.lightLayer = 1
  put(boxGeo(w - 0.3, Y.ceiling - Y.storeFloor, 0.12), toonSoft(PAL.wallTile, { fx: { rimStrength: 0.06 } }), [cx, (Y.ceiling + Y.storeFloor) / 2, S.minZ + 0.2], { receive: true })
  put(boxGeo(0.12, Y.ceiling - Y.storeFloor, d - 0.4), toonSoft(PAL.wallSide, { fx: { rimStrength: 0.06 } }), [S.minX + 0.2, (Y.ceiling + Y.storeFloor) / 2, cz], { receive: true })
  // 店内地板
  const floor = put(boxGeo(w - 0.1, 0.06, d - 0.1), toon(0xd7dae4, { fx: { rimStrength: 0.05 } }), [cx, Y.storeFloor, cz], { receive: true })
  kit.lightLayer = 0
  floor.name = 'storeFloor'
  // 建筑基座台阶
  put(boxGeo(w + 0.5, 0.2, d + 0.5), toon(PAL.concreteLit, { fx: { rimStrength: 0.14 } }), [cx, 0.1, cz], { receive: true, line: 'soft' })

  // ==================== 女儿墙 / 屋面 ====================
  const parapetH = Y.parapet - Y.roof
  const pMat = toonSoft(PAL.wallSide, { fx: { rimStrength: 0.16 } })
  const capMat = toon(PAL.metal, { fx: { rimStrength: 0.3 } })
  const parapet = (x: number, z: number, pw: number, pd: number) => {
    put(boxGeo(pw, parapetH, pd), pMat, [x, Y.roof + parapetH / 2, z], { cast: true, line: 'soft' })
    put(boxGeo(pw + 0.08, 0.08, pd + 0.08), capMat, [x, Y.roof + parapetH + 0.02, z])
  }
  parapet(cx, S.minZ + 0.1, w, 0.2)
  parapet(cx, S.maxZ - 0.1, w, 0.2)
  parapet(S.minX + 0.1, cz, 0.2, d)
  parapet(S.maxX - 0.1, cz, 0.2, d)
  const deck = put(boxGeo(w - 0.3, 0.1, d - 0.3), roofMat, [cx, Y.roof - 0.02, cz], { receive: true, cast: true })
  deck.name = 'roofDeck'
  // 屋面设备带：俯视时屋顶是主画面，必须按真实日式店屋排满管线与机组
  const ry = Y.roof + 0.03
  const ventMat = toon(PAL.metal, { fx: { rimStrength: 0.24 } })
  const sheetMat = toon(0xd7dbe6, { fx: { rimStrength: 0.22, sheen: 0.1 } })
  const ballastMat = toon(PAL.concrete, { fx: { rimStrength: 0.14 } })
  // 排气管群（不同高度形成错落轮廓）
  ;([[-6.1, -6.3, 0.52], [-0.9, -5.6, 0.72], [1.05, -6.6, 0.44], [-4.4, -5.2, 0.6]] as [number, number, number][]).forEach(([x, z, hh], i) => {
    put(cylGeo(0.1, 0.1, hh, 8), darkMetal, [x, ry + hh / 2, z], { cast: true, line: 'soft' })
    put(cylGeo(0.18, 0.15, 0.13, 8), ventMat, [x, ry + hh + 0.05, z], { cast: true })
    if (i === 1) put(torusGeo(0.13, 0.02, 10, 5), ventMat, [x, ry + hh + 0.13, z], { rot: [Math.PI / 2, 0, 0] })
  })
  // 楼梯间（屋上出入口）
  const hx = -2.85, hz = -7.45
  put(boxGeo(1.9, 1.32, 1.5), toonSoft(PAL.wallSide, { fx: { rimStrength: 0.18 } }), [hx, ry + 0.66, hz], { cast: true, receive: true, line: 'dark' })
  put(boxGeo(2.06, 0.1, 1.66), capMat, [hx, ry + 1.37, hz], { cast: true })
  put(boxGeo(0.62, 0.94, 0.05), toon(PAL.metalDark, { fx: { rimStrength: 0.22 } }), [hx + 0.36, ry + 0.5, hz + 0.77], { line: 'soft' })
  put(boxGeo(0.14, 0.028, 0.028), frameMat, [hx + 0.14, ry + 0.54, hz + 0.81])
  const steps: { pos: [number, number, number] }[] = []
  for (let i = 0; i < 4; i++) steps.push({ pos: [hx + 0.36, ry + 0.16 + i * 0.24, hz + 1.02 - i * 0.24] })
  kit.instanced(boxGeo(0.52, 0.035, 0.2), darkMetal, steps, 'roofSteps')
  put(cylGeo(0.022, 0.022, 1.5, 6), frameMat, [hx - 0.02, ry + 0.62, hz + 0.95], { rot: [0.32, 0, 0] })
  // 受水槽（白色 FRP 水箱，屋面上最亮的体块）
  const tx = 0.52, tz = -7.35
  const legs: { pos: [number, number, number] }[] = []
  for (const [lx, lz] of [[-0.33, -0.33], [0.33, -0.33], [-0.33, 0.33], [0.33, 0.33]] as [number, number][])
    legs.push({ pos: [tx + lx, ry + 0.16, tz + lz] })
  kit.instanced(boxGeo(0.09, 0.32, 0.09), darkMetal, legs, 'tankLegs')
  put(cylGeo(0.48, 0.48, 0.86, 16), sheetMat, [tx, ry + 0.75, tz], { cast: true, line: 'soft' })
  put(cylGeo(0.5, 0.5, 0.07, 16), ventMat, [tx, ry + 1.21, tz], { cast: true })
  put(cylGeo(0.05, 0.05, 0.86, 6), darkMetal, [tx - 0.52, ry + 0.6, tz], { rot: [0, 0, 0.1] })
  put(boxGeo(0.34, 0.26, 0.24), toon(PAL.metalDark, { fx: { rimStrength: 0.2 } }), [tx + 0.62, ry + 0.2, tz])
  // 屋顶空调室外机（合批格栅）
  const slats: { pos: [number, number, number] }[] = []
  const feet: { pos: [number, number, number] }[] = []
  ;([[-6.6, -7.9], [-5.25, -7.9]] as [number, number][]).forEach(([ax, az]) => {
    put(boxGeo(1.06, 0.06, 0.78), ballastMat, [ax, ry + 0.03, az])
    for (const [fx, fz] of [[-0.4, -0.28], [0.4, -0.28], [-0.4, 0.28], [0.4, 0.28]] as [number, number][])
      feet.push({ pos: [ax + fx, ry + 0.11, az + fz] })
    put(rboxGeo(0.94, 0.5, 0.64, 0.03), sheetMat, [ax, ry + 0.39, az], { cast: true, line: 'dark' })
    for (let i = 0; i < 6; i++) slats.push({ pos: [ax, ry + 0.2 + i * 0.062, az + 0.325] })
    put(cylGeo(0.032, 0.032, 0.9, 6), toon(PAL.rust, { fx: { rimStrength: 0.2 } }), [ax + 0.4, ry + 0.5, az - 0.42], { rot: [Math.PI / 2, 0, 0] })
  })
  kit.instanced(boxGeo(0.76, 0.018, 0.02), darkMetal, slats, 'roofAcSlats')
  kit.instanced(boxGeo(0.1, 0.1, 0.1), toon(PAL.rubber, { fx: { rimStrength: 0.1 } }), feet, 'roofAcFeet')
  // 天线 / 避雷针 / 杂物堆
  const antX = -7.05, antZ = -3.3
  put(cylGeo(0.035, 0.05, 1.05, 8), darkMetal, [antX, ry + 0.52, antZ], { cast: true })
  put(cylGeo(0.02, 0.02, 1.25, 6), ventMat, [antX, ry + 1.35, antZ], { cast: true })
  const arms: { pos: [number, number, number]; rot?: [number, number, number]; scale?: [number, number, number] }[] = []
  for (let i = 0; i < 4; i++) {
    const ll = 0.62 - i * 0.11
    arms.push({ pos: [antX, ry + 1.05 + i * 0.11, antZ], rot: [0, 0, Math.PI / 2] , scale: [ll / 1.2, 1, 1] })
  }
  kit.instanced(cylGeo(0.014, 0.014, 1.2, 5), ventMat, arms, 'antennaArms')
  put(sphereGeo(0.07, 8), toon(PAL.metal, { fx: { rimStrength: 0.3 } }), [antX, ry + 1.98, antZ])
  put(boxGeo(0.86, 0.44, 0.62), toon(PAL.blueDeep, { fx: { rimStrength: 0.16 } }), [-6.4, ry + 0.22, -3.4], { cast: true, line: 'soft' })
  put(boxGeo(0.94, 0.1, 0.7), toon(PAL.tealDeep, { fx: { rimStrength: 0.2, sheen: 0.12 } }), [-6.4, ry + 0.48, -3.4], { cast: true })
  const crates: { pos: [number, number, number]; rot?: [number, number, number] }[] = []
  for (let i = 0; i < 3; i++) crates.push({ pos: [1.0, ry + 0.09 + i * 0.15, -3.5 + i * 0.03], rot: [0, i * 0.34, 0] })
  kit.instanced(boxGeo(0.42, 0.14, 0.32), toon(0xbcd0e4, { fx: { rimStrength: 0.16 } }), crates, 'roofCrates')
  // 沿女儿墙走的管线与支架
  put(boxGeo(w - 1.2, 0.07, 0.07), darkMetal, [cx - 0.2, ry + 0.1, S.minZ + 0.42])
  put(boxGeo(0.07, 0.07, d - 1.4), darkMetal, [S.minX + 0.44, ry + 0.1, cz])
  const clips: { pos: [number, number, number] }[] = []
  for (let i = 0; i < 5; i++) clips.push({ pos: [S.minX + 0.44, ry + 0.05, S.minZ + 0.9 + i * 1.1] })
  kit.instanced(boxGeo(0.13, 0.1, 0.13), ballastMat, clips, 'pipeClips')
  // 天窗 / 防水布 / 积水痕
  put(boxGeo(1.5, 0.06, 1.0), toon(PAL.glassTint, { transparent: true, opacity: 0.55, fx: { rimStrength: 0.3 } }), [-3.9, ry + 0.05, -3.55])
  put(boxGeo(1.62, 0.02, 1.12), frameMat, [-3.9, ry + 0.02, -3.55])
  put(boxGeo(2.6, 0.02, 1.9), toon(0x2b3450, { transparent: true, opacity: 0.5, fx: { rimStrength: 0.1, sheen: 0.3 } }), [-1.4, ry + 0.045, -4.6])
  // 屋面落水管 → 滴水点
  put(cylGeo(0.07, 0.07, 3.9, 8), darkMetal, [S.maxX - 0.35, 2.1, S.minZ + 0.4])

  // ==================== 正面玻璃幕墙（朝 +Z） ====================
  const glassY0 = Y.storeFloor + 0.06
  const glassY1 = L.facade.glassMaxY
  const glassH = glassY1 - glassY0
  const glassCY = (glassY0 + glassY1) / 2
  const frontZ = S.maxZ + 0.02
  const glassPanels: GlassPanel[] = []

  const mullion = (x: number, z: number, axis: 'x' | 'z', h = glassH) => {
    if (axis === 'x') put(boxGeo(0.1, h, 0.12), frameMat, [x, glassCY, z], { line: 'soft' })
    else put(boxGeo(0.12, h, 0.1), frameMat, [x, glassCY, z], { line: 'soft' })
  }
  // 左段橱窗
  const segL: [number, number] = [S.minX + 0.35, L.facade.doorMinX]
  const segLw = segL[1] - segL[0]
  const paneL = put(planeGeo(segLw, glassH), glassFront, [(segL[0] + segL[1]) / 2, glassCY, frontZ])
  paneL.userData.noReflect = true
  glassPanels.push({ center: [(segL[0] + segL[1]) / 2, glassCY, frontZ], size: [segLw, glassH], axis: 'z', sign: 1 })
  for (let i = 0; i <= 4; i++) mullion(segL[0] + (segLw * i) / 4, frontZ + 0.03, 'x')
  put(boxGeo(segLw, 0.1, 0.14), frameMat, [(segL[0] + segL[1]) / 2, glassY1 + 0.05, frontZ])
  put(boxGeo(segLw, 0.14, 0.16), darkMetal, [(segL[0] + segL[1]) / 2, glassY0 - 0.05, frontZ])
  // 橱窗腰线贴纸（营业宣传条）
  const sticker = put(planeGeo(segLw * 0.98, 0.34), glowMap(0xffffff, stripTex('SORA MART  ·  24 時間営業  ·  ALWAYS OPEN', '#ffffff', '#2f6f66', 64), 1.15), [(segL[0] + segL[1]) / 2, 1.28, frontZ + 0.03])
  sticker.userData.noReflect = true

  // 右段小橱窗（门与角柱之间）
  const segR: [number, number] = [L.facade.doorMaxX, S.maxX - 0.35]
  const segRw = segR[1] - segR[0]
  const paneR = put(planeGeo(segRw, glassH), glassFront, [(segR[0] + segR[1]) / 2, glassCY, frontZ])
  paneR.userData.noReflect = true
  glassPanels.push({ center: [(segR[0] + segR[1]) / 2, glassCY, frontZ], size: [segRw, glassH], axis: 'z', sign: 1 })
  mullion(segR[1], frontZ + 0.03, 'x')

  // ==================== 右侧玻璃幕墙（朝 +X） ====================
  const sideX = S.maxX + 0.02
  const segSide: [number, number] = [S.minZ + 0.5, S.maxZ - 0.6]
  const sideLen = segSide[1] - segSide[0]
  const paneS = put(planeGeo(sideLen, glassH), glassSide, [sideX, glassCY, (segSide[0] + segSide[1]) / 2], { rot: [0, Math.PI / 2, 0] })
  paneS.userData.noReflect = true
  glassPanels.push({ center: [sideX, glassCY, (segSide[0] + segSide[1]) / 2], size: [sideLen, glassH], axis: 'x', sign: 1 })
  for (let i = 0; i <= 4; i++) mullion(sideX + 0.03, segSide[0] + ((segSide[1] - segSide[0]) * i) / 4, 'z')
  put(boxGeo(0.14, 0.1, sideLen), frameMat, [sideX + 0.04, glassY1 + 0.05, (segSide[0] + segSide[1]) / 2])
  put(boxGeo(0.16, 0.14, sideLen), darkMetal, [sideX + 0.04, glassY0 - 0.05, (segSide[0] + segSide[1]) / 2])

  // 角柱
  put(boxGeo(0.42, Y.roof, 0.42), toonSoft(PAL.wallSide, { fx: { rimStrength: 0.18 } }), [S.maxX - 0.1, Y.roof / 2, S.maxZ - 0.1], { cast: true, line: 'dark' })

  // ==================== 自动门 ====================
  const doorGroup = new THREE.Group()
  doorGroup.name = 'autoDoor'
  kit.attach(doorGroup)
  const openW = L.facade.doorMaxX - L.facade.doorMinX
  const leafW = openW / 2
  const doorCY = (glassY0 + 2.62) / 2
  const doorH = 2.62 - glassY0
  const doorCX = (L.facade.doorMinX + L.facade.doorMaxX) / 2
  const leafEdge = toon(PAL.curb, { fx: { rimStrength: 0.42, sheen: 0.14 } })
  const mkLeaf = (side: number) => {
    const leaf = new THREE.Group()
    leaf.position.set(doorCX + side * (leafW / 2), doorCY, frontZ)
    const pane = new THREE.Mesh(planeGeo(leafW - 0.08, doorH - 0.1), glassDoorMat)
    pane.userData.noReflect = true
    leaf.add(pane)
    const frameColor = frameMat
    const v1 = new THREE.Mesh(boxGeo(0.07, doorH, 0.09), frameColor)
    v1.position.x = side * (leafW / 2 - 0.05)
    leaf.add(v1)
    // 中挺：闭合时两扇在洞口正中并成一道双竖线，开启后各自把线拖向两侧，是自动门唯一读得出来的动作
    const v2 = new THREE.Mesh(boxGeo(0.08, doorH, 0.11), leafEdge)
    v2.position.x = -side * (leafW / 2 - 0.06)
    leaf.add(v2)
    leaf.add(new THREE.Mesh(boxGeo(leafW, 0.14, 0.12), leafEdge).translateY(-doorH / 2 + 0.12))
    leaf.add(new THREE.Mesh(boxGeo(leafW, 0.08, 0.09), frameColor).translateY(doorH / 2 - 0.04))
    const midBand = new THREE.Mesh(planeGeo(leafW - 0.1, 0.14), glowMap(0xffffff, stripTex('', '#e8f2f8', '#2f6f66', 32), 0.9))
    midBand.position.set(0, 0.35, 0.055)
    midBand.userData.noReflect = true
    leaf.add(midBand)
    doorGroup.add(leaf)
    return leaf
  }
  const leafL = mkLeaf(-1)
  const leafR = mkLeaf(1)
  // 门框 + 感应器 + 顶部灯箱
  put(boxGeo(0.16, doorH + 0.2, 0.18), darkMetal, [L.facade.doorMinX - 0.06, doorCY, frontZ], { line: 'soft' })
  put(boxGeo(0.16, doorH + 0.2, 0.18), darkMetal, [L.facade.doorMaxX + 0.06, doorCY, frontZ], { line: 'soft' })
  const headerMat = glowMap(0xffffff, stripTex('自動ドア  ·  AUTOMATIC DOOR', '#1f6f68', '#eafff8', 48), 1.2)
  const header = put(planeGeo(openW + 0.4, 0.32), headerMat, [doorCX, 2.86, frontZ + 0.06])
  header.userData.noReflect = true
  put(boxGeo(openW + 0.5, 0.44, 0.22), frameMat, [doorCX, 2.86, frontZ + 0.02], { line: 'soft' })
  put(boxGeo(0.16, 0.1, 0.16), toon(PAL.rubber, { fx: { rimStrength: 0.3 } }), [doorCX - 0.7, 2.66, frontZ + 0.12])
  const ledMat = glow(0x7dffc0, 1.9)
  put(boxGeo(openW + 0.2, 0.05, 0.05), ledMat, [doorCX, 3.08, frontZ + 0.1])
  // 门前台阶 + 地垫
  put(boxGeo(openW + 1.2, 0.06, 1.0), toon(PAL.concreteLit, { fx: { rimStrength: 0.12 } }), [doorCX, 0.17, S.maxZ + 0.55], { receive: true })
  const mat = put(planeGeo(2.6, 0.95), toon(0xffffff, { map: doormatTex(), fx: { rimStrength: 0.08 } }), [L.spots.doormat.x, 0.192, L.spots.doormat.z], { rot: [-Math.PI / 2, 0, 0] })
  mat.receiveShadow = true
  mat.userData.noReflect = true
  // 门开时泄到门口地面的暖光：缩略视角下这是自动门最主要的可读信号
  const doorSpillMat = new THREE.MeshBasicMaterial({
    map: glowTex(),
    color: new THREE.Color(0xffc98a),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const doorSpill = put(planeGeo(openW + 0.7, 2.1), doorSpillMat, [doorCX, 0.215, frontZ + 1.2], { rot: [-Math.PI / 2, 0, 0] })
  doorSpill.userData.noReflect = true

  // ==================== 雨棚 ====================
  const awningMat = toon(PAL.blueDeep, { fx: { rimStrength: 0.2, sheen: 0.12 } })
  const awningLip = glowMap(0xffffff, stripTex('ソラマート  24h  OPEN', '#1f6f68', '#f2fff9', 48), 1.0)
  const dripAnchors: [number, number, number][] = []
  const buildAwning = (axis: 'z' | 'x', from: number, to: number, wallPos: number, y: number, depth: number) => {
    const len = to - from
    const mid = (from + to) / 2
    const slope = 0.13
    if (axis === 'z') {
      const panel = put(boxGeo(len, 0.1, depth), awningMat, [mid, y, wallPos + depth / 2 + 0.02], { cast: true, line: 'dark' })
      panel.rotation.x = -slope * 0.25
      const lip = put(planeGeo(len, 0.26), awningLip, [mid, y - 0.12, wallPos + depth + 0.06])
      lip.userData.noReflect = true
      put(boxGeo(len + 0.1, 0.06, 0.06), frameMat, [mid, y + 0.06, wallPos + depth + 0.05])
      for (let i = 0; i <= 5; i++) {
        const x = from + (len * i) / 5
        put(cylGeo(0.035, 0.035, depth * 0.9, 6), darkMetal, [x, y - 0.16, wallPos + depth * 0.5], { rot: [Math.PI / 2, 0, 0] })
        dripAnchors.push([x, y - 0.2, wallPos + depth + 0.05])
      }
    } else {
      const panel = put(boxGeo(depth, 0.1, len), awningMat, [wallPos + depth / 2 + 0.02, y, mid], { cast: true, line: 'dark' })
      panel.rotation.z = slope * 0.25
      const lip = put(planeGeo(depth, 0.2), awningLip, [wallPos + depth + 0.05, y - 0.1, mid], { rot: [0, Math.PI / 2, 0] })
      lip.userData.noReflect = true
      for (let i = 0; i <= 4; i++) {
        const z = from + (len * i) / 4
        dripAnchors.push([wallPos + depth + 0.04, y - 0.2, z])
      }
    }
  }
  buildAwning('z', S.minX + 0.1, S.maxX - 0.1, S.maxZ, L.facade.awningY, L.facade.awningDepth)
  buildAwning('x', S.minZ + 0.4, S.maxZ - 0.9, S.maxX, L.facade.awningY - 0.06, 1.05)
  // 屋檐滴水（女儿墙外挑）
  for (let i = 0; i < 6; i++) dripAnchors.push([S.minX + 0.1 + i * 1.6, Y.parapet + 0.02, S.maxZ - 0.02])

  // ==================== 招牌 ====================
  const signH = 1.0
  const signY = 3.72
  const fascia = put(planeGeo(w - 0.2, signH), fasciaMat, [cx, signY, S.maxZ + 0.175])
  fascia.name = 'fasciaFront'
  put(boxGeo(w - 0.1, signH + 0.14, 0.22), toon(PAL.fascia, { fx: { rimStrength: 0.2 } }), [cx, signY, S.maxZ + 0.04], { line: 'dark', hull: 0.008 })
  const fasciaSide = put(planeGeo(sideLen - 1.2, 0.8), fasciaSideMat, [S.maxX + 0.175, signY, (segSide[0] + segSide[1]) / 2 - 0.3], { rot: [0, Math.PI / 2, 0] })
  fasciaSide.name = 'fasciaSide'
  put(boxGeo(0.22, 0.94, sideLen - 1.1), toon(PAL.fascia, { fx: { rimStrength: 0.2 } }), [S.maxX + 0.04, signY, (segSide[0] + segSide[1]) / 2 - 0.3], { line: 'dark' })
  // 招牌投光灯
  const floodMat = glow(0xfff0cf, 1.55)
  const anchors: Anchor[] = []
  ;[-5.6, -3.0, -0.4, 1.4].forEach((x) => {
    put(boxGeo(0.34, 0.1, 0.16), darkMetal, [x, signY + 0.66, S.maxZ + 0.2])
    const glowQuad = put(planeGeo(0.3, 0.12), floodMat, [x, signY + 0.6, S.maxZ + 0.29])
    glowQuad.userData.noReflect = true
  })
  anchors.push({ pos: [cx, signY, S.maxZ + 0.3], color: 0xfff3d8, size: 9.4, intensity: 1.05, floorRef: true })
  anchors.push({ pos: [S.maxX + 0.3, signY, -5.4], color: 0xf4ead6, size: 5.2, intensity: 0.7, floorRef: true })

  // 墙面灯箱
  const lbMatA = glowMap(0xffffff, lightboxTex('お弁当', '#fff4dd', '#b9562c', 'できたて'), 1.25)
  const lbMatB = glowMap(0xffffff, lightboxTex('雑誌', '#eaf4ff', '#2a5f9c', 'NEW'), 1.2)
  const lb1 = put(planeGeo(1.5, 0.78), lbMatA, [-6.9, 3.35, S.maxZ + 0.17])
  const lb2 = put(planeGeo(1.3, 0.68), lbMatB, [S.maxX + 0.17, 3.4, -7.6], { rot: [0, Math.PI / 2, 0] })
  ;[lb1, lb2].forEach((m) => (m.userData.noReflect = true))
  put(boxGeo(1.6, 0.88, 0.14), frameMat, [-6.9, 3.35, S.maxZ + 0.09], { line: 'soft' })
  put(boxGeo(0.14, 0.78, 1.4), frameMat, [S.maxX + 0.09, 3.4, -7.6], { line: 'soft' })
  const lb3Mat = glowMap(0xffffff, lightboxTex('ATM', '#e9f6ef', '#1f7f76', '24h'), 1.3)
  const lb3 = put(planeGeo(1.0, 0.44), lb3Mat, [1.0, 3.4, S.maxZ + 0.16])
  lb3.userData.noReflect = true
  const flickerMats: THREE.MeshBasicMaterial[] = [lbMatA, lb3Mat]

  // 转角立柱看板（三面看板）
  const pylon = put(boxGeo(1.15, 2.5, 0.34), tallMat, [S.maxX + 0.1, Y.parapet + 1.35, S.maxZ - 0.18], { line: 'dark' })
  pylon.name = 'pylonSign'
  put(boxGeo(0.22, 1.0, 0.22), darkMetal, [S.maxX + 0.1, Y.parapet + 0.15, S.maxZ - 0.18])
  const pylonCapMat = glow(0xffd9a0, 1.5)
  put(boxGeo(1.2, 0.08, 0.4), pylonCapMat, [S.maxX + 0.1, Y.parapet + 2.64, S.maxZ - 0.18])
  anchors.push({ pos: [S.maxX + 0.1, Y.parapet + 1.35, S.maxZ - 0.2], color: 0xfff0d0, size: 2.6, intensity: 0.95, floorRef: false })

  // 门口立灯 /  bollards
  ;[-2.4, 1.6].forEach((x) => {
    put(cylGeo(0.08, 0.1, 0.6, 8), toon(PAL.metalDark, { fx: { rimStrength: 0.24 } }), [x, 0.46, S.maxZ + 0.75], { cast: true })
    put(sphereGeo(0.1, 10), glow(0xffe6b0, 1.35), [x, 0.8, S.maxZ + 0.75])
    anchors.push({ pos: [x, 0.8, S.maxZ + 0.75], color: 0xffd9a0, size: 0.7, intensity: 0.5, floorRef: true })
  })
  //  convex 安全镜
  put(cylGeo(0.28, 0.28, 0.06, 14), toon(PAL.metal, { fx: { rimStrength: 0.4, sheen: 0.3 } }), [S.maxX - 0.02, 2.5, S.maxZ - 0.45], { rot: [Math.PI / 2, 0, 0] })

  // ==================== 动画 ====================
  const doorMats = [glassDoorMat]
  let doorT = 0
  let doorOpen = 0
  let nextCycle = 6.5
  const glassMats = [glassFront, glassSide, ...doorMats]

  /**
   * 灯箱电流闪：一个长周期里绝大部分时间完全稳定，只在末尾冒出一簇高频抖动。
   * 深度必须能压过色调映射的膝点（这些牌子常态已经接近饱和白），否则屏幕上看不出来。
   */
  const buzz = (t: number, seed: number, rate: number, depth: number) => {
    const gate = Math.pow(Math.max(0, Math.sin(t * rate + seed)), 22)
    const fast = 0.55 + 0.45 * Math.sin(t * 53 + seed * 7)
    return 1 - gate * depth * fast
  }

  const result: ShellResult = {
    anchors,
    dripAnchors,
    glassPanels,
    flickerMats,
    hideForReflection,
    update(t: number, dt: number) {
      glassMats.forEach((m) => (m.uniforms.uTime.value = t))
      // 自动门偶尔开合
      doorT += dt
      if (doorT > nextCycle) {
        doorT = 0
        nextCycle = 8 + (Math.sin(t * 12.9898) * 0.5 + 0.5) * 6
      }
      const phase = doorT
      let target = 0
      if (phase > 1.2 && phase < 4.4) target = 1
      else if (phase >= 4.4 && phase < 5.6) target = 1 - (phase - 4.4) / 1.2
      doorOpen += (target - doorOpen) * Math.min(1, dt * 6.5)
      const shift = doorOpen * (leafW - 0.04)
      leafL.position.x = doorCX - leafW / 2 - shift
      leafR.position.x = doorCX + leafW / 2 + shift
      ledMat.color.setRGB(0.3 + doorOpen * 0.7, 1.15 + doorOpen * 1.05, 0.55 + doorOpen * 0.75)
      doorSpillMat.opacity = doorOpen * 0.62
      // 招牌灯箱的轻微电流闪：注意要乘回各自的 base boost，setScalar 会覆盖 glowMap 建好的 HDR 亮度
      lbMatA.color.setScalar(1.25 * buzz(t, 0.0, 0.5, 0.62))
      lb3Mat.color.setScalar(1.3 * buzz(t, 2.4, 0.38, 0.55))
      headerMat.color.setScalar(1.2 * (0.96 + Math.sin(t * 2.1) * 0.04) * buzz(t, 4.1, 0.62, 0.5))
      const fasciaFlick = 0.97 + Math.sin(t * 1.1) * 0.03
      fasciaMat.color.setScalar(1.05 * fasciaFlick * buzz(t, 1.3, 0.31, 0.42))
      fasciaSideMat.color.setScalar(1.05 * fasciaFlick * buzz(t, 1.3, 0.31, 0.42))
      tallMat.color.setScalar(1.05 * (0.94 + Math.sin(t * 1.35) * 0.05) * buzz(t, 5.2, 0.44, 0.5))
    },
  }
  return result
}
