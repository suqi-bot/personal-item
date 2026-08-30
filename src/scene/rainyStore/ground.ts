import * as THREE from 'three'
import { Kit, boxGeo, planeGeo } from './kit'
import { PAL, toon, toonSoft } from './materials'
import { asphaltTex, concreteTex, grateTex } from './textures'
import { L } from './layout'

export interface GroundResult {
  /** 潮湿地表（积水 + 屏幕空间平面反射 + 雨点涟漪） */
  water: THREE.ShaderMaterial
  /** 反射通道需要隐藏的物体 */
  hideForReflection: THREE.Object3D[]
  /** 积水/湿滑区域中心点，供天气模块投放涟漪 */
  puddleSpots: [number, number][]
  update(t: number): void
}

const HALF = L.base.half

function tiled(src: THREE.Texture, rx: number, ry: number, key: string) {
  const hit = tiledCache.get(key)
  if (hit) return hit
  const t = src.clone()
  t.needsUpdate = true
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rx, ry)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  tiledCache.set(key, t)
  return t
}
const tiledCache = new Map<string, THREE.Texture>()

/** 程序化积水遮罩：只在低洼处积水，越靠近路缘与停车格越多 */
function puddleMaskTex(): THREE.CanvasTexture {
  const key = 'puddleMask'
  const hit = tiledCache.get(key)
  if (hit) return hit as THREE.CanvasTexture
  const size = 512
  let seed = 20260830 >>> 0
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) >>> 0) / 4294967296
  const cv = document.createElement('canvas')
  cv.width = size
  cv.height = size
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D
  ctx.clearRect(0, 0, size, size)
  const w2u = size / (HALF * 2)
  const toPx = (v: number) => (v + HALF) * w2u
  const blob = (x: number, z: number, r: number, a: number, squash = 1) => {
    const px = toPx(x)
    const pz = toPx(z)
    const g = ctx.createRadialGradient(px, pz, 0, px, pz, r * w2u)
    g.addColorStop(0, `rgba(255,255,255,${a})`)
    g.addColorStop(0.55, `rgba(255,255,255,${a * 0.72})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.save()
    ctx.translate(px, pz)
    ctx.scale(1, squash)
    ctx.translate(-px, -pz)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(px, pz, r * w2u, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  // 沿路缘的连续湿带
  for (let i = 0; i < 26; i++) {
    const t = i / 25
    blob(-9.6 + t * 12.6, 3.45 + Math.sin(i * 2.1) * 0.16, 0.62 + rnd() * 0.5, 0.62, 0.55)
    blob(3.45 + Math.sin(i * 1.7) * 0.16, -9.6 + t * 12.6, 0.6 + rnd() * 0.5, 0.6, 1.7)
  }
  // 主要水洼
  const spots: [number, number, number, number][] = [
    [4.9, 5.4, 1.5, 0.95],
    [7.6, 8.4, 1.2, 0.9],
    [5.8, 9.2, 1.0, 0.85],
    [-2.4, 4.6, 1.35, 0.9],
    [-6.2, 5.2, 1.1, 0.8],
    [1.6, 4.2, 1.0, 0.85],
    [8.9, 4.4, 0.9, 0.8],
    [-8.5, 8.6, 1.2, 0.85],
    [2.4, -1.1, 0.75, 0.66],
    [-0.6, 1.9, 0.8, 0.6],
    [-4.4, 2.2, 0.7, 0.55],
    [3.0, 1.2, 0.62, 0.5],
    [-9.0, -0.4, 0.6, 0.5],
    [6.4, -4.2, 0.9, 0.62],
    [9.2, -7.6, 1.0, 0.6],
  ]
  spots.forEach(([x, z, r, a]) => blob(x, z, r, a, 0.75 + rnd() * 0.5))
  const tex = new THREE.CanvasTexture(cv)
  tex.flipY = false
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  tiledCache.set(key, tex)
  return tex
}

const waterVert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4( position, 1.0 );
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const waterFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uMask;
  uniform sampler2D uRefl;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uReflPower;
  uniform float uRain;
  uniform vec3 uTint;
  uniform vec3 uFilm;
  varying vec3 vWorld;

  float h12(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 h22(vec2 p){
    return vec2(h12(p), h12(p + vec2(37.7, 91.3)));
  }

  // 雨点砸在水面上生成的同心涟漪（稀疏网格 + 扩散环）
  float ripples(vec2 p, float t){
    float acc = 0.0;
    vec2 cell = p * 2.35;
    vec2 g = floor(cell);
    vec2 f = fract(cell);
    for (int j = 0; j <= 1; j++) {
      for (int i = 0; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j));
        vec2 r = h22(g + o);
        float d = length(o + r - f);
        float ph = fract(t * (0.42 + r.y * 0.5) + r.x);
        float rad = ph * 0.62;
        float band = exp( -pow((d - rad) * 9.2, 2.0) );
        acc += band * (1.0 - ph) ;
      }
    }
    return acc;
  }

  float slowWave(vec2 p){
    return sin(p.x * 1.55 + uTime * 0.5) * 0.5 + sin(p.y * 1.25 - uTime * 0.42) * 0.5;
  }

  void main() {
    vec2 uv = (vWorld.xz + ${HALF.toFixed(1)}) / ${(HALF * 2).toFixed(1)};
    float puddle = texture2D( uMask, uv ).a;
    // 分工：全场一层薄水膜负责反光，同心涟漪只在水洼里生成，否则干沥青会跟着一起起圈
    float sheen = clamp( puddle + 0.34, 0.0, 1.0 );
    float wave = slowWave( vWorld.xz ) * 0.06;
    float amount = clamp( puddle + wave * puddle + 0.3, 0.0, 1.0 );

    // 法线扰动：涟漪梯度（仅水洼）
    float e = 0.055;
    float r0 = ripples( vWorld.xz, uTime );
    float rx = ripples( vWorld.xz + vec2(e, 0.0), uTime );
    float rz = ripples( vWorld.xz + vec2(0.0, e), uTime );
    vec2 grad = vec2(rx - r0, rz - r0) * uRain * 0.032 * puddle;

    // 屏幕空间平面反射（镜像相机渲染，地面上的点与主相机投影重合）
    vec2 sUV = gl_FragCoord.xy / uRes;
    vec2 distort = grad * (0.45 + puddle * 0.85);
    // 水膜上的低频晃动：让非水洼处的倒影也是扭的，而不是干净镜面
    distort += vec2( sin(vWorld.z * 0.92 + uTime * 0.23), cos(vWorld.x * 0.74 - uTime * 0.19) ) * 0.0022 * sheen;
    distort.y += sin(uTime * 0.7 + vWorld.x * 2.1) * 0.0012 * sheen;
    vec3 refl = texture2D( uRefl, clamp(sUV + distort, vec2(0.002), vec2(0.998)) ).rgb;

    vec3 n = normalize( vec3( -grad.x * 6.0, 1.0, -grad.y * 6.0 ) );
    vec3 v = normalize( cameraPosition - vWorld );
    float fres = pow( 1.0 - clamp( dot( n, v ), 0.0, 1.0 ), 2.4 );
    float k = mix( 0.34, 1.0, fres ) * uReflPower * ( 0.34 + puddle * 0.66 );

    // 涟漪高光：环脊上泛起细白
    float crest = smoothstep( 0.62, 1.0, r0 ) * ( 0.1 + puddle * 0.9 );

    vec3 col = mix( uTint, refl, clamp(k, 0.0, 0.94) );
    col = mix( col, uFilm, (1.0 - puddle) * 0.26 );
    col += vec3(0.62, 0.74, 0.95) * crest * 0.15;
    col += vec3(0.5, 0.62, 0.85) * pow(fres, 4.0) * 0.16 * puddle;

    float alpha = clamp( amount * (0.5 + k * 0.6) + crest * 0.1, 0.0, 0.95 );
    gl_FragColor = vec4( col, alpha );
  }
`

export function buildGround(kit: Kit): GroundResult {
  const g = new THREE.Group()
  g.name = 'ground'
  kit.attach(g)

  const asphalt = toonSoft(PAL.asphalt, {
    map: tiled(asphaltTex(), 9, 9, 'asphalt9'),
    fx: { rimStrength: 0.1, sheen: 0.09 },
  })
  const concrete = toonSoft(PAL.concrete, {
    map: tiled(concreteTex(), 6, 6, 'concrete6'),
    fx: { rimStrength: 0.12, sheen: 0.05 },
  })
  const concreteFar = toonSoft(PAL.concrete, {
    map: tiled(concreteTex(), 5, 5, 'concrete5'),
    fx: { rimStrength: 0.1 },
  })

  const local = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], name?: string) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.fromArray(pos)
    if (name) m.name = name
    g.add(m)
    return m
  }

  // ---------- 底座 ----------
  const slabMat = toon(PAL.asphaltDeep, { fx: { rimStrength: 0.06 } })
  const slab = local(boxGeo(HALF * 2, L.base.thickness, HALF * 2), slabMat, [0, -L.base.thickness / 2, 0], 'baseSlab')
  slab.userData.noReflect = true
  const plinth = local(boxGeo(HALF * 2 - 1.3, 0.42, HALF * 2 - 1.3), toon(PAL.voidDeep, { fx: { rimStrength: 0.04 } }), [0, -L.base.thickness - 0.21, 0], 'basePlinth')
  plinth.userData.noReflect = true
  const rim = new THREE.Mesh(boxGeo(HALF * 2 + 0.06, 0.1, HALF * 2 + 0.06), toon(PAL.metalDark, { fx: { rimStrength: 0.2} }))
  rim.position.set(0, -0.06, 0)
  rim.userData.noReflect = true
  g.add(rim)

  // ---------- 沥青路面（整块打底，人行道垫块压在其上） ----------
  const roadPlane = new THREE.Mesh(planeGeo(HALF * 2, HALF * 2), asphalt)
  roadPlane.rotation.x = -Math.PI / 2
  roadPlane.position.y = 0.004
  roadPlane.receiveShadow = true
  roadPlane.name = 'asphaltPlane'
  roadPlane.userData.noReflect = true
  g.add(roadPlane)

  const padGeoCache = new Map<string, THREE.BufferGeometry>()
  const pad = (x0: number, x1: number, z0: number, z1: number, top: number, mat: THREE.Material, name: string) => {
    const key = `${x0}_${x1}_${z0}_${z1}_${top}`
    let geo = padGeoCache.get(key)
    if (!geo) {
      geo = boxGeo(x1 - x0, top, z1 - z0)
      padGeoCache.set(key, geo)
    }
    const m = local(geo, mat, [(x0 + x1) / 2, top / 2 + 0.004, (z0 + z1) / 2], name)
    m.receiveShadow = true
    return m
  }

  // 近侧人行道（店铺一侧，构成 L 形街角的内侧）
  pad(-HALF, L.road.rightMin, -HALF, L.road.frontMin, 0.156, concrete, 'walkNear')
  // 对面人行道
  pad(5.5, HALF, -HALF, L.road.frontMin + 0.5, 0.136, concreteFar, 'walkRightFar')
  pad(-HALF, 5.5, 7.1, HALF, 0.136, concreteFar, 'walkFrontFar')

  // 路缘石
  const curbMat = toon(PAL.curb, { fx: { rimStrength: 0.18 } })
  const curb = (x: number, z: number, w: number, d: number) => {
    const m = local(boxGeo(w, 0.17, d), curbMat, [x, 0.085, z])
    m.castShadow = true
    return m
  }
  curb(-3.4, L.road.frontMin, 13.4, 0.22)
  curb(L.road.rightMin, -3.4, 0.22, 13.4)
  curb(7.7, 3.35, 4.6, 0.2)
  curb(3.35, 8.85, 0.2, 2.4)

  // 黄色路缘禁停线
  const yellowLine = toon(PAL.paintWarm, { fx: { rimStrength: 0.24, sheen: 0.2 } })
  const line = (x: number, z: number, w: number, d: number, mat = yellowLine, y = 0.016) => {
    const m = local(boxGeo(w, 0.012, d), mat, [x, y, z])
    g.add(m)
    return m
  }
  line(-3.4, 3.13, 13.1, 0.13)
  line(3.13, -3.4, 0.13, 13.1)
  line(7.6, 3.55, 4.6, 0.13)
  line(3.55, 8.6, 0.13, 2.6)

  // ---------- 交通标线 ----------
  const paintMat = toon(PAL.paint, { fx: { rimStrength: 0.2, sheen: 0.42 } })
  const paintSoft = toon(PAL.paint, { fx: { rimStrength: 0.14, sheen: 0.2 } })
  // 斑马线：跨越右侧街道（沿 X 走）
  for (let i = 0; i < 5; i++) {
    const z = 4.25 + i * 0.92
    line((3.35 + 5.5) / 2, z, 2.1, 0.46, paintMat, 0.014)
  }
  // 斑马线：跨越前方街道（沿 Z 走）
  for (let i = 0; i < 5; i++) {
    const x = 4.35 + i * 0.92
    line(x, (3.35 + 7.0) / 2, 0.46, 3.6, paintMat, 0.014)
  }
  // 停止线
  line(4.35, 3.62, 2.4, 0.3, paintSoft, 0.013)
  line(3.62, 4.35, 0.3, 2.4, paintSoft, 0.013)
  // 巷口导流线 + 小区入口白线
  line(-8.4, 2.2, 1.3, 0.1, paintSoft, 0.013)
  line(1.0, 5.9, 0.1, 1.9, paintSoft, 0.013)

  // 停车格（路侧駐車）
  const bayLines: [number, number, number, number][] = [
    [-6.2, 4.4, 0.1, 2.5],
    [-9.1, 4.4, 3.9, 0.1],
    [-9.1, 5.65, 3.9, 0.1],
    [-6.2, 5.65, 0.1, 1.3],
  ]
  bayLines.forEach(([x, z, w, d]) => line(x + w / 2, z + d / 2, w, d, paintSoft, 0.013))
  const wheelStop = toon(PAL.metalDark, { fx: { rimStrength: 0.14 } })
  ;[-8.6, -7.0].forEach((z) => {
    const m = local(boxGeo(2.0, 0.12, 0.14), wheelStop, [-6.4, 0.07, z])
    m.castShadow = true
  })

  // ---------- 排水沟 ----------
  const gutterMat = toon(PAL.metalDark, { fx: { rimStrength: 0.1 } })
  const grateMat = toon(PAL.metal, { map: grateTex(), fx: { rimStrength: 0.24 } })
  const gully = (x: number, z: number, w: number, d: number) => {
    const m = local(boxGeo(w, 0.06, d), gutterMat, [x, 0.125, z])
    m.userData.noReflect = true
  }
  gully(-3.5, 2.85, 13.2, 0.3)
  gully(2.85, -3.5, 0.3, 13.2)
  const grateList: { pos: [number, number, number]; rot?: [number, number, number] }[] = []
  for (let i = 0; i < 14; i++) {
    grateList.push({ pos: [-9.3 + i * 0.95, 0.158, 2.85], rot: [0, Math.PI / 2, 0] })
    grateList.push({ pos: [2.85, 0.158, -9.3 + i * 0.95], rot: [0, 0, 0] })
  }
  const grates = kit.instanced(boxGeo(0.62, 0.02, 0.3), grateMat, grateList, 'gutterGrates')
  grates.receiveShadow = true
  grates.userData.noReflect = true
  // 检查井盖
  const manholeMat = toon(PAL.metalDark, { fx: { rimStrength: 0.3, sheen: 0.2 } })
  const manholeGeo = new THREE.CircleGeometry(0.34, 16)
  ;([[5.9, 6.9], [-1.4, 5.2], [8.4, -2.6], [2.1, 8.4]] as [number, number][]).forEach(([x, z]) => {
    const m = new THREE.Mesh(manholeGeo, manholeMat)
    m.rotation.x = -Math.PI / 2
    m.position.set(x, 0.016, z)
    g.add(m)
  })
  // 小巷铺装
  const alleyMat = toon(PAL.asphaltDeep, {
    map: tiled(asphaltTex(), 1.6, 5, 'asphaltAlley'),
    fx: { rimStrength: 0.08, sheen: 0.06 },
  })
  const alley = local(boxGeo(L.alley.maxX - L.alley.minX, 0.1, L.alley.maxZ - L.alley.minZ), alleyMat, [
    (L.alley.minX + L.alley.maxX) / 2,
    0.05,
    (L.alley.minZ + L.alley.maxZ) / 2,
  ])
  alley.receiveShadow = true
  const alleyEdge = local(boxGeo(1.36, 0.03, 0.12), toon(PAL.metalDark), [(L.alley.minX + L.alley.maxX) / 2, 0.1, L.alley.maxZ])

  // ---------- 积水 / 湿滑地表 ----------
  const water = new THREE.ShaderMaterial({
    vertexShader: waterVert,
    fragmentShader: waterFrag,
    uniforms: {
      uMask: { value: puddleMaskTex() },
      uRefl: { value: null as THREE.Texture | null },
      uRes: { value: new THREE.Vector2(1024, 1024) },
      uTime: { value: 0 },
      uReflPower: { value: 1.0 },
      uRain: { value: 1 },
      uTint: { value: new THREE.Color(0x151c2e) },
      uFilm: { value: new THREE.Color(0x2c354e) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
  })
  const waterMesh = new THREE.Mesh(planeGeo(HALF * 2, HALF * 2), water)
  waterMesh.rotation.x = -Math.PI / 2
  waterMesh.position.y = 0.024
  waterMesh.renderOrder = 2
  waterMesh.name = 'wetSurface'
  waterMesh.userData.noReflect = true
  g.add(waterMesh)

  // 玻璃幕墙下的暖色地面光斑（店内灯光洒到门前人行道）
  const warmSpill = new THREE.Mesh(
    planeGeo(11.5, 5.2),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xffb968).multiplyScalar(0.34),
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: glowSpotTex(),
    }),
  )
  warmSpill.rotation.x = -Math.PI / 2
  warmSpill.position.set(-2.9, 0.175, -0.2)
  warmSpill.renderOrder = 3
  warmSpill.userData.noReflect = true
  g.add(warmSpill)
  const coldSpill = new THREE.Mesh(
    planeGeo(5.4, 6.4),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x9fc8ff).multiplyScalar(0.2),
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: glowSpotTex(),
    }),
  )
  coldSpill.rotation.x = -Math.PI / 2
  coldSpill.position.set(6.6, 0.03, 6.4)
  coldSpill.renderOrder = 3
  coldSpill.userData.noReflect = true
  g.add(coldSpill)

  const hideForReflection: THREE.Object3D[] = [waterMesh, slab, plinth, rim, roadPlane, alley, alleyEdge, warmSpill, coldSpill, grates]

  const result: GroundResult = {
    water,
    hideForReflection,
    puddleSpots: [
      [4.9, 5.4],
      [7.6, 8.4],
      [-2.4, 4.6],
      [-6.2, 5.2],
      [1.6, 4.2],
      [-8.5, 8.6],
      [2.4, -1.1],
      [-0.6, 1.9],
    ],
    update(t: number) {
      water.uniforms.uTime.value = t
    },
  }
  return result
}

function glowSpotTex() {
  const key = 'glowSpot'
  const hit = tiledCache.get(key)
  if (hit) return hit
  const size = 256
  const cv = document.createElement('canvas')
  cv.width = size
  cv.height = size
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(cv)
  tex.needsUpdate = true
  tiledCache.set(key, tex)
  return tex
}
