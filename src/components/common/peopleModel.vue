<template>
    <div class="peopleModel" ref="containerRef"></div>
</template>
<script setup lang="ts">
import * as THREE from 'three'
import { onMounted, onBeforeUnmount, ref, nextTick } from 'vue'

const containerRef = ref<HTMLElement>()
let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let animationId: number

const mouse = { x: 0, y: 0 }
const smooth = { x: 0, y: 0 }

interface FloatingShape {
  group: THREE.Group
  wire: THREE.LineSegments | null
  basePos: THREE.Vector3
  rotSpeed: THREE.Vector3
  floatAmp: number
  floatFreq: number
  phase: number
}

interface Drifter {
  points: THREE.Points
  positions: Float32Array
  velocities: Float32Array
  count: number
}

let shapes: FloatingShape[] = []
let drifters: Drifter[] = []
let connectionLines: THREE.LineSegments
let connectionPositions: Float32Array
let connectionGeo: THREE.BufferGeometry
const connectionNodes: { pos: THREE.Vector3, vel: THREE.Vector3 }[] = []
let time = 0

const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

function mat(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  })
}

function edgeMat(color: number, opacity: number): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
}

// ==================== GEOMETRY ====================

function createGeometricShapes() {
  const configs = [
    { geo: new THREE.IcosahedronGeometry(0.9, 0), pos: [-4.5, 1.2, -2], color: 0x111827, opacity: 0.12, wire: true, wireColor: 0x111827, wireOpacity: 0.35 },
    { geo: new THREE.OctahedronGeometry(0.6, 0), pos: [4.2, -0.8, -1], color: 0x4b5563, opacity: 0.10, wire: true, wireColor: 0x1f2937, wireOpacity: 0.30 },
    { geo: new THREE.TetrahedronGeometry(0.5, 0), pos: [-2.5, -2.2, 1], color: 0x9ca3af, opacity: 0.14, wire: false },
    { geo: new THREE.DodecahedronGeometry(0.7, 0), pos: [3, 2.5, -3], color: 0x374151, opacity: 0.08, wire: true, wireColor: 0x374151, wireOpacity: 0.25 },
    { geo: new THREE.TorusGeometry(0.55, 0.14, 8, 20), pos: [0.5, -3, -1.5], color: 0x111827, opacity: 0.10, wire: false },
    { geo: new THREE.IcosahedronGeometry(0.4, 0), pos: [-5, -0.5, 2], color: 0x6b7280, opacity: 0.12, wire: true, wireColor: 0x6b7280, wireOpacity: 0.28 },
    { geo: new THREE.OctahedronGeometry(0.35, 0), pos: [5.5, 1.8, 1.5], color: 0x1f2937, opacity: 0.13, wire: false },
    { geo: new THREE.BoxGeometry(0.7, 0.7, 0.7), pos: [-1, 3.2, -2.5], color: 0x4b5563, opacity: 0.09, wire: true, wireColor: 0x4b5563, wireOpacity: 0.22 },
    { geo: new THREE.TetrahedronGeometry(0.7, 0), pos: [2, 0.5, 3], color: 0x9ca3af, opacity: 0.08, wire: true, wireColor: 0x9ca3af, wireOpacity: 0.20 },
    { geo: new THREE.ConeGeometry(0.4, 0.9, 5), pos: [-3.5, 2.8, 0.5], color: 0x374151, opacity: 0.10, wire: false },
  ]

  const count = isMobile ? 6 : configs.length
  for (let i = 0; i < count; i++) {
    const cfg = configs[i]
    const group = new THREE.Group()

    const solid = new THREE.Mesh(cfg.geo, mat(cfg.color, cfg.opacity))
    group.add(solid)

    if (cfg.wire) {
      const edges = new THREE.EdgesGeometry(cfg.geo)
      const wire = new THREE.LineSegments(edges, edgeMat(cfg.wireColor!, cfg.wireOpacity!))
      group.add(wire)
    }

    const basePos = new THREE.Vector3(cfg.pos[0], cfg.pos[1], cfg.pos[2])
    group.position.copy(basePos)
    scene.add(group)

    shapes.push({
      group,
      wire: (group.children[1] as THREE.LineSegments) ?? null,
      basePos,
      rotSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 0.004,
        (Math.random() - 0.5) * 0.004,
        (Math.random() - 0.5) * 0.002
      ),
      floatAmp: 0.3 + Math.random() * 0.5,
      floatFreq: 0.3 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
    })
  }
}

// ==================== PARTICLES ====================

function createParticleLayers() {
  const layers = [
    { count: isMobile ? 120 : 280, size: 0.045, color: 0x111827, opacity: 0.45, spread: 14, speed: 0.0018 },
    { count: isMobile ? 80 : 180, size: 0.07, color: 0x4b5563, opacity: 0.28, spread: 18, speed: 0.0012 },
    { count: isMobile ? 50 : 120, size: 0.11, color: 0x9ca3af, opacity: 0.16, spread: 22, speed: 0.0008 },
  ]

  layers.forEach(layer => {
    const positions = new Float32Array(layer.count * 3)
    const velocities = new Float32Array(layer.count * 3)

    for (let i = 0; i < layer.count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * layer.spread
      positions[i * 3 + 1] = (Math.random() - 0.5) * layer.spread * 0.6
      positions[i * 3 + 2] = (Math.random() - 0.5) * layer.spread

      velocities[i * 3] = (Math.random() - 0.5) * layer.speed
      velocities[i * 3 + 1] = (Math.random() - 0.5) * layer.speed
      velocities[i * 3 + 2] = (Math.random() - 0.5) * layer.speed
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const m = new THREE.PointsMaterial({
      size: layer.size,
      color: layer.color,
      transparent: true,
      opacity: layer.opacity,
      depthWrite: false,
      sizeAttenuation: true,
    })

    const points = new THREE.Points(geo, m)
    scene.add(points)
    drifters.push({ points, positions, velocities, count: layer.count })
  })
}

// ==================== CONNECTIONS ====================

function createConnections() {
  const nodeCount = isMobile ? 14 : 24
  const spread = 10

  for (let i = 0; i < nodeCount; i++) {
    connectionNodes.push({
      pos: new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread * 0.5,
        (Math.random() - 0.5) * spread
      ),
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 0.006,
        (Math.random() - 0.5) * 0.006,
        (Math.random() - 0.5) * 0.006
      ),
    })
  }

  const maxSegments = nodeCount * 4
  connectionPositions = new Float32Array(maxSegments * 6)
  connectionGeo = new THREE.BufferGeometry()
  connectionGeo.setAttribute('position', new THREE.BufferAttribute(connectionPositions, 3))

  const lineMat = new THREE.LineBasicMaterial({
    color: 0x6b7280,
    transparent: true,
    opacity: 0.10,
    depthWrite: false,
  })

  connectionLines = new THREE.LineSegments(connectionGeo, lineMat)
  scene.add(connectionLines)
}

const CONNECTION_DIST = 4.2

function updateConnections() {
  let idx = 0
  for (let i = 0; i < connectionNodes.length; i++) {
    const a = connectionNodes[i]
    a.pos.add(a.vel)
    if (Math.abs(a.pos.x) > 6) a.vel.x *= -1
    if (Math.abs(a.pos.y) > 3.5) a.vel.y *= -1
    if (Math.abs(a.pos.z) > 6) a.vel.z *= -1

    for (let j = i + 1; j < connectionNodes.length; j++) {
      const b = connectionNodes[j]
      const d = a.pos.distanceTo(b.pos)
      if (d < CONNECTION_DIST) {
        connectionPositions[idx * 6] = a.pos.x
        connectionPositions[idx * 6 + 1] = a.pos.y
        connectionPositions[idx * 6 + 2] = a.pos.z
        connectionPositions[idx * 6 + 3] = b.pos.x
        connectionPositions[idx * 6 + 4] = b.pos.y
        connectionPositions[idx * 6 + 5] = b.pos.z
        idx++
      }
    }
  }
  connectionGeo.attributes.position.needsUpdate = true
  connectionGeo.setDrawRange(0, idx * 2)
}

// ==================== ACCENT GLOWS ====================

function createGlows() {
  const glowConfigs = [
    { color: 0x111827, size: 6, opacity: 0.045, pos: [-5, 2, -6] },
    { color: 0x4b5563, size: 8, opacity: 0.035, pos: [6, -3, -8] },
    { color: 0x9ca3af, size: 5, opacity: 0.05, pos: [0, 4, -5] },
  ]

  glowConfigs.forEach(cfg => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    const r = (cfg.color >> 16) & 255
    const g = (cfg.color >> 8) & 255
    const b = cfg.color & 255
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`)
    grad.addColorStop(0.4, `rgba(${r},${g},${b},0.4)`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 128, 128)

    const tex = new THREE.CanvasTexture(canvas)
    const spriteMat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: cfg.opacity,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })
    const sprite = new THREE.Sprite(spriteMat)
    sprite.scale.setScalar(cfg.size)
    sprite.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2])
    scene.add(sprite)
  })
}

// ==================== INIT ====================

function initScene(container: HTMLElement) {
  scene = new THREE.Scene()
  scene.background = null

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100)
  camera.position.set(0, 0, 10)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  container.appendChild(renderer.domElement)

  createGlows()
  createGeometricShapes()
  createParticleLayers()
  createConnections()
}

// ==================== ANIMATION ====================

function animate() {
  animationId = requestAnimationFrame(animate)
  time += 0.016

  smooth.x += (mouse.x - smooth.x) * 0.04
  smooth.y += (mouse.y - smooth.y) * 0.04

  camera.position.x = smooth.x * 0.9
  camera.position.y = -smooth.y * 0.6
  camera.lookAt(0, 0, 0)

  shapes.forEach((s, i) => {
    const group = s.group
    group.rotation.x += s.rotSpeed.x
    group.rotation.y += s.rotSpeed.y
    group.rotation.z += s.rotSpeed.z

    group.position.y = s.basePos.y + Math.sin(time * s.floatFreq + s.phase) * s.floatAmp
    group.position.x = s.basePos.x + Math.cos(time * s.floatFreq * 0.7 + s.phase) * s.floatAmp * 0.3

    if (s.wire) {
      const pulse = 0.5 + Math.sin(time * 0.8 + i) * 0.5
      ;(s.wire.material as THREE.LineBasicMaterial).opacity = 0.15 + pulse * 0.2
    }
  })

  drifters.forEach(d => {
    for (let i = 0; i < d.count; i++) {
      d.positions[i * 3] += d.velocities[i * 3]
      d.positions[i * 3 + 1] += d.velocities[i * 3 + 1]
      d.positions[i * 3 + 2] += d.velocities[i * 3 + 2]

      const x = d.positions[i * 3]
      const y = d.positions[i * 3 + 1]
      const z = d.positions[i * 3 + 2]
      if (Math.abs(x) > 11) d.velocities[i * 3] *= -1
      if (Math.abs(y) > 7) d.velocities[i * 3 + 1] *= -1
      if (Math.abs(z) > 11) d.velocities[i * 3 + 2] *= -1
    }
    d.points.geometry.attributes.position.needsUpdate = true
  })

  updateConnections()

  renderer.render(scene, camera)
}

// ==================== LIFECYCLE ====================

function onMouseMove(event: MouseEvent) {
  mouse.x = (event.clientX / window.innerWidth - 0.5) * 2
  mouse.y = (event.clientY / window.innerHeight - 0.5) * 2
}

function onWindowResize() {
  const container = containerRef.value
  if (!container || !camera || !renderer) return
  camera.aspect = container.clientWidth / container.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(container.clientWidth, container.clientHeight)
}

onMounted(async () => {
  await nextTick()
  const container = containerRef.value
  if (!container) return

  initScene(container)
  animate()

  window.addEventListener('resize', onWindowResize)
  window.addEventListener('mousemove', onMouseMove)
})

onBeforeUnmount(() => {
  if (animationId) cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('mousemove', onMouseMove)
  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
  }
  scene?.traverse(obj => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.LineSegments) {
      obj.geometry?.dispose()
      const m = obj.material as THREE.Material | THREE.Material[]
      if (Array.isArray(m)) m.forEach(x => x.dispose())
      else m?.dispose()
    }
    if (obj instanceof THREE.Sprite) {
      obj.material.map?.dispose()
      obj.material.dispose()
    }
  })
})
</script>

<style scoped>
.peopleModel {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    overflow: hidden;
    z-index: -1;
}
</style>
