<template>
  <div class="blog-background" aria-hidden="true">
    <div class="grid-layer"></div>
    <div class="glow glow-1"></div>
    <div class="glow glow-2"></div>
    <div class="glow glow-3"></div>
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

// 层级配置：默认 0，页面可按需置于 3D 模型之后（如首页传 -2）
const props = withDefaults(defineProps<{
  zIndex?: number
}>(), {
  zIndex: 0
})

const canvasRef = ref<HTMLCanvasElement | null>(null)

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  alpha: number
  depth: number
  phase: number
}

let ctx: CanvasRenderingContext2D | null = null
let rafId = 0
let particles: Particle[] = []
let width = 0
let height = 0
const mouse = { x: 0, y: 0 }

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const random = (min: number, max: number) => min + Math.random() * (max - min)

const resize = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  width = window.innerWidth
  height = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)

  // 少量精致的微粒，随屏幕面积微调
  const count = Math.min(45, Math.floor((width * height) / 32000))
  particles = Array.from({ length: count }, () => ({
    x: random(0, width),
    y: random(0, height),
    vx: random(-0.12, 0.12),
    vy: random(-0.18, 0.05),
    r: random(0.8, 2),
    alpha: random(0.08, 0.3),
    depth: random(0.2, 1),
    phase: random(0, Math.PI * 2)
  }))
}

const draw = () => {
  if (!ctx) return

  ctx.clearRect(0, 0, width, height)

  // 鼠标视差偏移（极轻微）
  const offsetX = (mouse.x - width / 2) * 0.015
  const offsetY = (mouse.y - height / 2) * 0.015

  // 微粒缓慢漂浮
  const time = performance.now() / 1000
  for (const p of particles) {
    p.x += p.vx + Math.sin(time * 0.3 + p.phase) * 0.06
    p.y += p.vy + Math.cos(time * 0.25 + p.phase) * 0.05

    // 边界回绕
    if (p.x < -10) p.x = width + 10
    if (p.x > width + 10) p.x = -10
    if (p.y < -10) p.y = height + 10
    if (p.y > height + 10) p.y = -10

    const px = p.x + offsetX * p.depth
    const py = p.y + offsetY * p.depth

    ctx.beginPath()
    ctx.arc(px, py, p.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(17, 24, 39, ${p.alpha})`
    ctx.fill()
  }

  rafId = requestAnimationFrame(draw)
}

const onMouseMove = (e: MouseEvent) => {
  mouse.x = e.clientX
  mouse.y = e.clientY
}

onMounted(() => {
  resize()
  if (prefersReducedMotion) {
    draw()
    cancelAnimationFrame(rafId)
  } else {
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMouseMove)
    draw()
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', resize)
  window.removeEventListener('mousemove', onMouseMove)
})
</script>

<style scoped>
.blog-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  pointer-events: none;
  z-index: v-bind('props.zIndex');
}

/* 极淡的建筑网格线，中心聚焦、边缘渐隐 */
.grid-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    linear-gradient(rgba(17, 24, 39, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(17, 24, 39, 0.05) 1px, transparent 1px);
  background-size: 88px 88px;
  mask-image: radial-gradient(ellipse 75% 75% at 50% 35%, black 25%, transparent 78%);
  -webkit-mask-image: radial-gradient(ellipse 75% 75% at 50% 35%, black 25%, transparent 78%);
}

.blog-background canvas {
  position: absolute;
  top: 0;
  left: 0;
}

/* 巨型柔和光晕：缓慢漂移，几乎不可察觉 */
.glow {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(17, 24, 39, 0.055), transparent 62%);
  will-change: transform;
}

.glow-1 {
  width: 900px;
  height: 900px;
  top: -220px;
  right: -180px;
  animation: drift-1 55s ease-in-out infinite alternate;
}

.glow-2 {
  width: 760px;
  height: 760px;
  bottom: -200px;
  left: -140px;
  background: radial-gradient(circle, rgba(17, 24, 39, 0.045), transparent 62%);
  animation: drift-2 70s ease-in-out infinite alternate;
}

.glow-3 {
  width: 560px;
  height: 560px;
  top: 42%;
  left: 30%;
  background: radial-gradient(circle, rgba(107, 114, 128, 0.05), transparent 62%);
  animation: drift-3 90s ease-in-out infinite alternate;
}

@keyframes drift-1 {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(-90px, 70px) scale(1.08); }
}

@keyframes drift-2 {
  from { transform: translate(0, 0) scale(1.05); }
  to { transform: translate(80px, -60px) scale(1); }
}

@keyframes drift-3 {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(60px, 40px) scale(1.1); }
}

@media (prefers-reduced-motion: reduce) {
  .glow {
    animation: none;
  }
}
</style>
