import * as THREE from 'three'

/**
 * 雨夜便利店微缩场景 —— 三渲二材质层
 * 统一使用有限阶跃的 gradientMap + 冷色边缘光 + 湿面高光，保证全场景色板干净、层次一致。
 */
export const PAL = {
  voidDeep: 0x05070f,
  skyTop: 0x0a1024,
  skyLow: 0x1d2a4d,
  asphalt: 0x2b3247,
  asphaltDeep: 0x20263a,
  concrete: 0x59627a,
  concreteLit: 0x727c95,
  curb: 0x838da6,
  paint: 0xe4ebf7,
  paintWarm: 0xf0d78c,
  metal: 0x767f95,
  metalDark: 0x3b4257,
  rust: 0x8a6a52,
  glassTint: 0xa9cbe6,
  wallTile: 0xeceff5,
  wallSide: 0xc9ccd8,
  fascia: 0xf5efe2,
  teal: 0x39bfa8,
  tealDeep: 0x1f7f76,
  blue: 0x3d7fc4,
  blueDeep: 0x264a7c,
  orange: 0xf2914a,
  red: 0xd8544f,
  pink: 0xe98aa6,
  green: 0x63b46a,
  yellow: 0xf3cf58,
  warmLight: 0xffe3b3,
  neonCyan: 0x7fe9ff,
  neonMagenta: 0xff8ad8,
  interiorFloor: 0xdcdfe8,
  shelf: 0xe9ecf3,
  wood: 0xb98a5e,
  paper: 0xf6f2e6,
  rubber: 0x24283a,
}

export const LINE_COLOR = 0x171c2e

const rampCache = new Map<string, THREE.DataTexture>()

export function ramp(steps: number[] = [0.3, 0.66, 1]): THREE.DataTexture {
  const key = steps.join('_')
  const hit = rampCache.get(key)
  if (hit) return hit
  const data = new Uint8Array(steps.length)
  steps.forEach((v, i) => (data[i] = Math.round(THREE.MathUtils.clamp(v, 0, 1) * 255)))
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RedFormat)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  rampCache.set(key, tex)
  return tex
}

export interface CelFx {
  /** 边缘光颜色（冷蓝勾边，动漫夜景的标志性处理） */
  rim?: number
  rimSize?: number
  rimStrength?: number
  /** 湿面反光强度：雨夜里所有物体掠射角都会泛起天光 */
  sheen?: number
  sheenColor?: number
  /** 背光面额外压向的冷色，模拟环境反射 */
  shadowTint?: number
}

export function applyFx<T extends THREE.Material>(mat: T, fx: CelFx = {}): T {
  const rim = fx.rim ?? 0x6f9cff
  const rimSize = fx.rimSize ?? 0.62
  const rimStrength = fx.rimStrength ?? 0.22
  const sheen = fx.sheen ?? 0.0
  const sheenColor = fx.sheenColor ?? 0x6d8fc8
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: new THREE.Color(rim) }
    shader.uniforms.uRimSize = { value: rimSize }
    shader.uniforms.uRimStrength = { value: rimStrength }
    shader.uniforms.uSheen = { value: sheen }
    shader.uniforms.uSheenColor = { value: new THREE.Color(sheenColor) }
    shader.fragmentShader =
      'uniform vec3 uRimColor;\nuniform float uRimSize;\nuniform float uRimStrength;\nuniform float uSheen;\nuniform vec3 uSheenColor;\n' +
      shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        {
          vec3 cN = normalize( vNormal );
          vec3 cV = normalize( vViewPosition );
          float cFacing = 1.0 - clamp( dot( cN, cV ), 0.0, 1.0 );
          float cRim = smoothstep( uRimSize, 1.0, cFacing ) * uRimStrength;
          gl_FragColor.rgb += uRimColor * cRim;
          gl_FragColor.rgb += uSheenColor * pow( cFacing, 2.4 ) * uSheen;
        }
        #include <dithering_fragment>
        `,
      )
  }
  mat.customProgramCacheKey = () => `cel_fx|${rim}|${rimSize}|${rimStrength}|${sheen}|${sheenColor}`
  return mat
}

export interface ToonOpts {
  map?: THREE.Texture | null
  opacity?: number
  transparent?: boolean
  side?: THREE.Side
  steps?: number[]
  flat?: boolean
  fx?: CelFx
  depthWrite?: boolean
}

export function toon(color: number, opts: ToonOpts = {}): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({
    color,
    map: opts.map ?? null,
    gradientMap: ramp(opts.steps ?? [0.34, 0.68, 1]),
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.depthWrite ?? true,
  })
  // 渲染器按 material.flatShading 决定 FLAT_SHADED 宏，MeshToonMaterial 类型未声明但运行期有效
  if (opts.flat) (m as unknown as { flatShading: boolean }).flatShading = true
  return applyFx(m, opts.fx ?? { rimStrength: 0.16 })
}

/** 软阴影面（受光分层更细，用于大面积地面/墙面） */
export function toonSoft(color: number, opts: ToonOpts = {}): THREE.MeshToonMaterial {
  return toon(color, { steps: [0.42, 0.72, 0.9, 1], ...opts })
}

/** 无光照纯色面 —— 用于自发光灯箱、霓虹、店内灯管，交给 bloom 提亮 */
export function glow(color: number, boost = 1.35, opacity = 1): THREE.MeshBasicMaterial {
  const c = new THREE.Color(color)
  if (boost !== 1) c.multiplyScalar(boost)
  return new THREE.MeshBasicMaterial({
    color: c,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 0.999,
    toneMapped: true,
  })
}

export function glowMap(color: number, map: THREE.Texture, boost = 1.25): THREE.MeshBasicMaterial {
  const c = new THREE.Color(color)
  if (boost !== 1) c.multiplyScalar(boost)
  return new THREE.MeshBasicMaterial({ color: c, map, toneMapped: true })
}

const lineMats = new Map<string, THREE.LineBasicMaterial>()
export function lineMaterial(key = 'dark'): THREE.LineBasicMaterial {
  const hit = lineMats.get(key)
  if (hit) return hit
  const presets: Record<string, { color: number; opacity: number }> = {
    dark: { color: LINE_COLOR, opacity: 0.82 },
    soft: { color: 0x2a3352, opacity: 0.55 },
    warm: { color: 0x6b4a2a, opacity: 0.5 },
    light: { color: 0xdfe8ff, opacity: 0.35 },
  }
  const p = presets[key] ?? presets.dark
  const m = new THREE.LineBasicMaterial({
    color: p.color,
    transparent: true,
    opacity: p.opacity,
    depthWrite: false,
  })
  lineMats.set(key, m)
  return m
}

const hullMats = new Map<string, THREE.ShaderMaterial>()
/** 反法线外扩描边（inverted hull）：只用于主体大造型，保证剪影干净 */
export function hullMaterial(thickness = 0.012, color = LINE_COLOR): THREE.ShaderMaterial {
  const key = `${thickness}|${color}`
  const hit = hullMats.get(key)
  if (hit) return hit
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: `
      uniform float uThickness;
      void main() {
        vec4 mv = modelViewMatrix * vec4( position, 1.0 );
        vec3 n = normalize( normalMatrix * normal );
        mv.xy += n.xy * uThickness * max( -mv.z, 0.35 );
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() { gl_FragColor = vec4( uColor, 1.0 ); }
    `,
    side: THREE.BackSide,
  })
  hullMats.set(key, m)
  return m
}

export function disposeShared() {
  lineMats.forEach((m) => m.dispose())
  hullMats.forEach((m) => m.dispose())
  lineMats.clear()
  hullMats.clear()
  rampCache.forEach((t) => t.dispose())
  rampCache.clear()
}
