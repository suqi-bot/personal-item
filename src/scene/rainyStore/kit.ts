import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { hullMaterial, lineMaterial } from './materials'

export interface PartOpts {
  pos?: [number, number, number]
  rot?: [number, number, number]
  scale?: number | [number, number, number]
  /** 生成 Anime 线稿：true/'dark' 使用默认深色，也可传 'soft' | 'warm' | 'light' */
  line?: boolean | string
  lineAngle?: number
  /** 反法线外扩剪影描边厚度 */
  hull?: number
  cast?: boolean
  receive?: boolean
  visible?: boolean
  name?: string
}

const geoCache = new Map<string, THREE.BufferGeometry>()
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  const hit = geoCache.get(key)
  if (hit) return hit as unknown as T
  const g = make()
  geoCache.set(key, g)
  return g
}

export function boxGeo(w: number, h: number, d: number) {
  return cached(`box|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d))
}

/** 圆角盒：日式模型里几乎所有硬表面都带一点倒角，剪影更柔和 */
export function rboxGeo(w: number, h: number, d: number, r = 0.04, steps = 2) {
  return cached(`rbox|${w}|${h}|${d}|${r}|${steps}`, () => {
    // bevelSize 会把轮廓整体外扩 rr，所以轮廓只能取 (w-2rr)×(h-2rr)，成品才正好是 w×h×d
    const rr = Math.min(r, w / 4, h / 4, (d - 0.002) / 2)
    const rx = w / 2 - rr * 2
    const ry = h / 2 - rr * 2
    const shape = new THREE.Shape()
    shape.moveTo(-rx, -(ry + rr))
    shape.lineTo(rx, -(ry + rr))
    shape.absarc(rx, -ry, rr, -Math.PI / 2, 0, false)
    shape.absarc(rx, ry, rr, 0, Math.PI / 2, false)
    shape.absarc(-rx, ry, rr, Math.PI / 2, Math.PI, false)
    shape.absarc(-rx, -ry, rr, Math.PI, Math.PI * 1.5, false)
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: d - rr * 2,
      bevelEnabled: true,
      bevelThickness: rr,
      bevelSize: rr,
      bevelSegments: steps,
      curveSegments: 3,
    })
    g.translate(0, 0, -(d - rr * 2) / 2)
    g.computeVertexNormals()
    return g
  })
}

export function cylGeo(rt: number, rb: number, h: number, seg = 12, open = false) {
  return cached(`cyl|${rt}|${rb}|${h}|${seg}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open))
}

export function sphereGeo(r: number, seg = 12) {
  return cached(`sph|${r}|${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2)))
}

export function torusGeo(r: number, tube: number, seg = 12, ring = 8) {
  return cached(`tor|${r}|${tube}|${seg}|${ring}`, () => new THREE.TorusGeometry(r, tube, ring, seg))
}

export function planeGeo(w: number, h: number) {
  return cached(`pln|${w}|${h}`, () => new THREE.PlaneGeometry(w, h))
}

export function coneGeo(r: number, h: number, seg = 10) {
  return cached(`cone|${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg))
}

export function tubeGeo(points: THREE.Vector3[], radius: number, closed = false, seg = 24) {
  const key = `tube|${radius}|${closed}|${points.map((p) => p.toArray().join(',')).join(';')}`
  return cached(key, () => {
    const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.35)
    return new THREE.TubeGeometry(curve, seg, radius, 6, closed)
  })
}

/** 悬链线（电线/电话线） */
export function catenary(a: THREE.Vector3, b: THREE.Vector3, sag: number, seg = 20): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    const p = new THREE.Vector3().lerpVectors(a, b, t)
    p.y -= Math.sin(Math.PI * t) * sag
    pts.push(p)
  }
  return pts
}

export class Kit {
  readonly root = new THREE.Group()
  readonly parts: THREE.Mesh[] = []
  /** 非 0 时，新建对象额外启用该图层，用于把店内灯光限定在店内 */
  lightLayer = 0

  private applyLayer(obj: THREE.Object3D) {
    if (this.lightLayer) obj.layers.enable(this.lightLayer)
    return obj
  }

  add(geo: THREE.BufferGeometry, mat: THREE.Material, opts: PartOpts = {}): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, mat)
    if (opts.pos) mesh.position.fromArray(opts.pos)
    if (opts.rot) mesh.rotation.fromArray(opts.rot)
    if (opts.scale !== undefined) {
      if (typeof opts.scale === 'number') mesh.scale.setScalar(opts.scale)
      else mesh.scale.fromArray(opts.scale)
    }
    if (opts.line) {
      mesh.userData.celLine = typeof opts.line === 'string' ? opts.line : 'dark'
      if (opts.lineAngle) mesh.userData.celLineAngle = opts.lineAngle
    }
    if (opts.hull) {
      const hull = new THREE.Mesh(geo, hullMaterial(opts.hull))
      mesh.add(hull)
    }
    mesh.castShadow = opts.cast ?? false
    mesh.receiveShadow = opts.receive ?? false
    if (opts.visible === false) mesh.visible = false
    if (opts.name) mesh.name = opts.name
    this.root.add(mesh)
    this.parts.push(mesh)
    this.applyLayer(mesh)
    return mesh
  }

  box(w: number, h: number, d: number, mat: THREE.Material, opts?: PartOpts) {
    return this.add(boxGeo(w, h, d), mat, opts)
  }

  rbox(w: number, h: number, d: number, mat: THREE.Material, opts?: PartOpts & { r?: number }) {
    return this.add(rboxGeo(w, h, d, opts?.r ?? 0.04), mat, opts)
  }

  cyl(rt: number, rb: number, h: number, mat: THREE.Material, opts?: PartOpts & { seg?: number }) {
    return this.add(cylGeo(rt, rb, h, opts?.seg ?? 12), mat, opts)
  }

  sphere(r: number, mat: THREE.Material, opts?: PartOpts & { seg?: number }) {
    return this.add(sphereGeo(r, opts?.seg ?? 12), mat, opts)
  }

  torus(r: number, tube: number, mat: THREE.Material, opts?: PartOpts) {
    return this.add(torusGeo(r, tube), mat, opts)
  }

  plane(w: number, h: number, mat: THREE.Material, opts?: PartOpts) {
    return this.add(planeGeo(w, h), mat, opts)
  }

  tube(points: THREE.Vector3[], radius: number, mat: THREE.Material, opts?: PartOpts) {
    return this.add(tubeGeo(points, radius), mat, opts)
  }

  instanced(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    list: { pos: [number, number, number]; rot?: [number, number, number]; scale?: number | [number, number, number] }[],
    name?: string,
  ): THREE.InstancedMesh {
    const im = new THREE.InstancedMesh(geo, mat, list.length)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    list.forEach((item, i) => {
      p.fromArray(item.pos)
      e.set(...(item.rot ?? [0, 0, 0]))
      q.setFromEuler(e)
      if (item.scale === undefined) s.set(1, 1, 1)
      else if (typeof item.scale === 'number') s.setScalar(item.scale)
      else s.fromArray(item.scale)
      m.compose(p, q, s)
      im.setMatrixAt(i, m)
    })
    im.instanceMatrix.needsUpdate = true
    im.name = name ?? 'instanced'
    if (name) im.name = name
    this.root.add(im)
    this.applyLayer(im)
    return im
  }

  /** 把任意 object3D 挂进场景（用于灯、粒子、控制器组等） */
  attach(obj: THREE.Object3D) {
    this.root.add(obj)
    return this.applyLayer(obj)
  }

  /** 生成合批线稿：全场景的描边只占用几个 draw call */
  finalize() {
    this.root.updateMatrixWorld(true)
    const invRoot = new THREE.Matrix4().copy(this.root.matrixWorld).invert()
    const buckets = new Map<string, THREE.BufferGeometry[]>()
    const tmp = new THREE.Matrix4()
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh || !mesh.userData.celLine) return
      const key = String(mesh.userData.celLine)
      const angle = (mesh.userData.celLineAngle as number) ?? 28
      const eg = new THREE.EdgesGeometry(mesh.geometry, angle)
      tmp.multiplyMatrices(invRoot, mesh.matrixWorld)
      eg.applyMatrix4(tmp)
      const arr = buckets.get(key)
      if (arr) arr.push(eg)
      else buckets.set(key, [eg])
    })
    buckets.forEach((geos, key) => {
      const merged = mergeGeometries(geos, false)
      geos.forEach((g) => g.dispose())
      if (!merged) return
      const lines = new THREE.LineSegments(merged, lineMaterial(key))
      lines.name = `lineart:${key}`
      lines.renderOrder = 3
      this.root.add(lines)
    })
    return this.root
  }
}

export function disposeGeoCache() {
  geoCache.forEach((g) => g.dispose())
  geoCache.clear()
}
