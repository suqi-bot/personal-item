<template>
  <section class="hero-section" ref="heroRef">
    <div class="split" data-text="欢迎来到">
      欢迎来到
    </div>

    <div class="nav-box" ref="navBoxRef">
      <div class="nav-box-background"></div>
      <div class="text">welcome to my site</div>
    </div>

      <div class="split" data-text="苏柒的小站">
       苏柒的小站
      </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import gsap from 'gsap'
import SplitType from 'split-type'

// 组件引用
const heroRef = ref<HTMLElement>()
const navBoxRef = ref<HTMLElement>()

// 动画状态
const isAnimationPlaying = ref(false)

// 动画配置
interface AnimationConfig {
  textDelay?: number
  navBoxDelay?: number
  staggerDelay?: number
}

const props = withDefaults(defineProps<{
  animationConfig?: AnimationConfig
}>(), {
  animationConfig: () => ({
    textDelay: 0,
    navBoxDelay: 0.5,
    staggerDelay: 0.25
  })
})

// 事件发射
const emit = defineEmits<{
  animationStart: []
  animationComplete: []
}>()

// 鼠标倾斜参数
let tiltAnimationFrame: number | null = null

// 描边辉光偏移状态（随鼠标倾斜响应）
const glowState = { x: 0, y: 0 }
let glowTween: gsap.core.Tween | null = null

function applyGlow() {
  document.querySelectorAll('.split').forEach((el) => {
    const element = el as HTMLElement
    element.style.setProperty('--gx', String(glowState.x))
    element.style.setProperty('--gy', String(glowState.y))
  })
}

// 把鼠标位置换算成每个标题元素内部的百分比，驱动 ::after 点亮层
function updateReveal(event: MouseEvent) {
  document.querySelectorAll('.split').forEach((el) => {
    const element = el as HTMLElement
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    element.style.setProperty('--mx', `${((event.clientX - rect.left) / rect.width) * 100}%`)
    element.style.setProperty('--my', `${((event.clientY - rect.top) / rect.height) * 100}%`)
  })
}

// 根据鼠标位置计算文字俯仰倾斜 + 描边辉光方向（以文字区域中心为原点）
function handleMouseMove(event: MouseEvent) {
  // 移动端不响应鼠标移动，文字固定在正中间
  if (window.innerWidth <= 768) return

  const rect = heroRef.value?.getBoundingClientRect()
  if (!rect || rect.width === 0 || rect.height === 0) return

  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const nx = Math.max(-1, Math.min(1, (event.clientX - centerX) / (rect.width / 2)))
  const ny = Math.max(-1, Math.min(1, (event.clientY - centerY) / (rect.height / 2)))

  updateReveal(event)

  if (tiltAnimationFrame !== null) return
  tiltAnimationFrame = requestAnimationFrame(() => {
    tiltAnimationFrame = null
    gsap.to('.hero-section', {
      rotateX: ny * 2.5,
      rotateY: nx * 2.5,
      transformPerspective: 900,
      duration: 0.6,
      ease: 'power2.out'
    })

    if (glowTween) glowTween.kill()
    glowTween = gsap.to(glowState, {
      x: -nx * 3,
      y: ny * 3 + 2,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: applyGlow
    })
  })
}

function handleMouseLeave() {
  if (window.innerWidth <= 768) return

  gsap.to('.hero-section', {
    rotateX: 0,
    rotateY: 0,
    duration: 0.8,
    ease: 'elastic.out(1, 0.4)'
  })

  if (glowTween) glowTween.kill()
  glowTween = gsap.to(glowState, {
    x: 0,
    y: 2,
    duration: 0.8,
    ease: 'power2.out',
    onUpdate: applyGlow
  })
}

function revealElement(element: Element) {
  element.classList.add('is-revealed')
}

// 文字动画1 - 分行动画
function createTextAnimation1() {
  const splitElements = document.querySelectorAll('.split')

  if (splitElements.length === 0) {
    console.warn('没有找到 .split 元素')
    return
  }

  splitElements.forEach((element) => {
    try {
      gsap.set(element, { opacity: 1 })

      const split = new SplitType(element as HTMLElement, { types: 'lines' })

      if (split.lines && split.lines.length > 0) {
        gsap.set(split.lines, {
          yPercent: 115,
          opacity: 0,
          filter: 'blur(14px)'
        })

        gsap.to(split.lines, {
          yPercent: 0,
          opacity: 1,
          filter: 'blur(0px)',
          duration: 1.1,
          ease: 'power3.out',
          stagger: props.animationConfig.staggerDelay,
          onComplete: () => revealElement(element)
        })
      } else {
        gsap.to(element, {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
          onComplete: () => revealElement(element)
        })
      }
    } catch (error) {
      console.error('文字动画1 错误:', error)
      gsap.to(element, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power3.out',
        onComplete: () => revealElement(element)
      })
    }
  })
}

// 文字动画2 - 字符动画
function createTextAnimation2() {
  const textElement = document.querySelector('.nav-box .text')
  if (!textElement) {
    console.warn('没有找到 .nav-box .text 元素')
    return
  }

  try {
    const split = new SplitType(textElement as HTMLElement, { types: 'chars' })

    if (split.chars && split.chars.length > 0) {
      gsap.set(split.chars, { x: 100, opacity: 0 })

      gsap.to(split.chars, {
        x: 0,
        opacity: 1,
        duration: 1,
        ease: 'power2.out',
        stagger: 0.05,
        onComplete: () => (textElement as HTMLElement).classList.add('caret-on')
      })
    } else {
      gsap.to(textElement, {
        opacity: 1,
        duration: 0.6,
        ease: 'power2.out',
        onComplete: () => (textElement as HTMLElement).classList.add('caret-on')
      })
    }
  } catch (error) {
    console.error('文字动画2 错误:', error)
    gsap.to(textElement, { opacity: 1, duration: 0.6, ease: 'power2.out' })
    ;(textElement as HTMLElement).classList.add('caret-on')
  }
}

// 创建完整的动画时间线
function createAnimationTimeline() {
  const tl = gsap.timeline({
    onStart: () => emit('animationStart'),
    onComplete: () => emit('animationComplete')
  })

  tl.call(createTextAnimation1, [], `+=${props.animationConfig.textDelay}`)

  tl.set('.nav-box', { width: 0 })

  const navBoxWidth = Math.min(330, window.innerWidth * 0.82)

  tl.to('.nav-box', {
    opacity: 1,
    duration: 1,
    width: navBoxWidth,
    ease: ''
  }, '>=0.3')

  tl.to('.nav-box .text', {
    opacity: 1
  }, '>=0.3')

  tl.call(createTextAnimation2, [], '-=0.5')

  return tl
}

// 暴露动画控制方法
const playAnimation = async () => {
  if (isAnimationPlaying.value) return

  isAnimationPlaying.value = true

  await nextTick()

  const timeline = createAnimationTimeline()

  timeline.eventCallback('onComplete', () => {
    isAnimationPlaying.value = false
  })

  return timeline
}

const resetAnimation = () => {
  try {
    isAnimationPlaying.value = false

    gsap.set('.split', { opacity: 0 })
    gsap.set('.nav-box', { opacity: 0, width: 0 })
    gsap.set('.nav-box .text', { opacity: 0 })

    const splitElements = document.querySelectorAll('.split')
    splitElements.forEach((element) => {
      element.classList.remove('is-revealed')
      if (element.hasAttribute('data-split-type')) {
        const originalText = element.textContent
        element.innerHTML = originalText || ''
      }
    })

    const textElement = document.querySelector('.nav-box .text')
    if (textElement) {
      textElement.classList.remove('caret-on')
      if (textElement.hasAttribute('data-split-type')) {
        const originalText = textElement.textContent
        textElement.innerHTML = originalText || ''
      }
    }

    console.log('动画重置完成')
  } catch (error) {
    console.error('重置动画错误:', error)
  }
}

defineExpose({
  playAnimation,
  resetAnimation
})

onMounted(async () => {
  await nextTick()
  window.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseleave', handleMouseLeave)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseleave', handleMouseLeave)
})
</script>

<style scoped>
.hero-section {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  font-size: large;
  overflow: hidden;
  perspective: 900px;
  transform-style: preserve-3d;
}

.split {
  position: relative;
  overflow: hidden;
  font-size: clamp(2rem, 8vw, 12rem);
  text-align: center;
  letter-spacing: 0.08em;
  color: transparent;
  opacity: 0; /* 初始隐藏 */
  /* 线框描边字，呼应背景多面体线框 */
  -webkit-text-stroke: 1.6px rgba(31, 41, 55, 0.72);
  /* 描边随鼠标方向产生极淡的投影，替代原先的实心挤出 */
  filter: drop-shadow(calc(var(--gx, 0) * 1px) calc(var(--gy, 2) * 1px) 10px rgba(17, 24, 39, 0.22));
}

/* 鼠标处的渐变点亮层：入场完成后才淡入，否则会在真字滑入时留下残影 */
.split::after {
  content: attr(data-text);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  text-align: center;
  color: transparent;
  -webkit-text-stroke: 0;
  opacity: 0;
  transition: opacity 0.5s ease;
  background: radial-gradient(
    circle 220px at var(--mx, 50%) var(--my, 50%),
    rgba(17, 24, 39, 0.95) 0%,
    rgba(55, 65, 81, 0.5) 42%,
    rgba(156, 163, 175, 0) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  pointer-events: none;
}

.split.is-revealed::after {
  opacity: 1;
}

.nav-box {
  position: absolute;
  width: 330px;
  height: 35px;
  display: flex;
  align-items: center;
  opacity: 0; /* 初始隐藏 */
  max-width: 86vw;
}

.nav-box-background {
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(17, 24, 39, 0.28);
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: 1;
  backdrop-filter: blur(6px);
}

.nav-box .text {
  margin-left: 14px;
  overflow: hidden;
  z-index: 2;
  opacity: 0; /* 初始隐藏 */
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
  letter-spacing: 0.3em;
  color: #374151;
}

/* 文字末尾的输入光标 */
.nav-box .text::after {
  content: '';
  display: inline-block;
  width: 1.5px;
  height: 1.2em;
  margin-left: -0.3em;
  vertical-align: text-bottom;
  background: currentColor;
  opacity: 0;
}

.nav-box .text.caret-on::after {
  animation: caret-blink 1.05s steps(1, end) infinite;
}

@keyframes caret-blink {
  0%, 49.9% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

/* 减弱动画偏好下光标常亮，不做闪烁 */
@media (prefers-reduced-motion: reduce) {
  .nav-box .text.caret-on::after {
    animation: none;
    opacity: 1;
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .hero-section {
    gap: 14px;
  }

  .split {
    font-size: 2.2rem;
    letter-spacing: 0.12em;
    -webkit-text-stroke-width: 1px;
    filter: none;
  }

  /* 无鼠标交互，点亮层隐藏 */
  .split::after {
    display: none;
  }

  .nav-box {
    height: 32px;
  }
}
</style>
