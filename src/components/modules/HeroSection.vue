<template>
  <section class="hero-section" ref="heroRef">
    <div class="split">
      欢迎来到
    </div>

    <div class="nav-box" ref="navBoxRef">
      <div class="nav-box-background"></div>
      <div class="text">
        welcome to my site
      </div>
    </div>

      <div class="split">
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

// 立体阴影方向状态（随鼠标倾斜响应）
const depthState = { x: 0, y: 1 }
let depthTween: gsap.core.Tween | null = null

function applyDepth() {
  document.querySelectorAll('.split').forEach((el) => {
    const element = el as HTMLElement
    element.style.setProperty('--depth-x', String(depthState.x))
    element.style.setProperty('--depth-y', String(depthState.y))
  })
}

// 根据鼠标位置计算文字俯仰倾斜 + 立体阴影方向（以文字区域中心为原点）
function handleMouseMove(event: MouseEvent) {
  // 移动端不响应鼠标移动，文字固定在正中间
  if (window.innerWidth <= 768) return

  const rect = heroRef.value?.getBoundingClientRect()
  if (!rect || rect.width === 0 || rect.height === 0) return

  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const nx = Math.max(-1, Math.min(1, (event.clientX - centerX) / (rect.width / 2)))
  const ny = Math.max(-1, Math.min(1, (event.clientY - centerY) / (rect.height / 2)))

  if (tiltAnimationFrame !== null) return
  tiltAnimationFrame = requestAnimationFrame(() => {
    tiltAnimationFrame = null
    gsap.to('.hero-section', {
      rotateX: ny * 3,
      rotateY: nx * 3,
      transformPerspective: 900,
      duration: 0.6,
      ease: 'power2.out'
    })

    if (depthTween) depthTween.kill()
    depthTween = gsap.to(depthState, {
      x: Math.max(-1, Math.min(1, -nx * 1.6)),
      y: Math.max(0.4, Math.min(1.6, 1 + ny * 1.2)),
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: applyDepth
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

  if (depthTween) depthTween.kill()
  depthTween = gsap.to(depthState, {
    x: 0,
    y: 1,
    duration: 0.8,
    ease: 'power2.out',
    onUpdate: applyDepth
  })
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
          rotationX: -100,
          transformOrigin: '50% 50% -160px',
          opacity: 0
        })

        gsap.to(split.lines, {
          rotationX: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          stagger: props.animationConfig.staggerDelay
        })
      } else {
        gsap.to(element, {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out'
        })
      }
    } catch (error) {
      console.error('文字动画1 错误:', error)
      gsap.to(element, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power3.out'
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
        stagger: 0.05
      })
    } else {
      gsap.to(textElement, { opacity: 1, duration: 0.6, ease: 'power2.out' })
    }
  } catch (error) {
    console.error('文字动画2 错误:', error)
    gsap.to(textElement, { opacity: 1, duration: 0.6, ease: 'power2.out' })
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
  if (isAnimationPlaying.value) {
    console.log('Hero动画已在播放，跳过重复调用')
    return
  }

  isAnimationPlaying.value = true
  console.log('开始执行Hero动画')

  await nextTick()

  const timeline = createAnimationTimeline()

  timeline.eventCallback('onComplete', () => {
    isAnimationPlaying.value = false
    console.log('Hero动画播放完成')
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
      if (element.hasAttribute('data-split-type')) {
        const originalText = element.textContent
        element.innerHTML = originalText || ''
      }
    })

    const textElement = document.querySelector('.nav-box .text')
    if (textElement && textElement.hasAttribute('data-split-type')) {
      const originalText = textElement.textContent
      textElement.innerHTML = originalText || ''
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
  overflow: hidden;
  font-size: clamp(2rem, 8vw, 12rem);
  text-align: center;
  perspective: 500px;
  color: #121212;
  opacity: 0; /* 初始隐藏 */
  transform-style: preserve-3d;
  /* 立体文字阴影（厚度方向随鼠标倾斜响应） */
  text-shadow:
    calc(var(--depth-x, 0) * 1px) calc(var(--depth-y, 1) * 1px) 0 #8a8a8a,
    calc(var(--depth-x, 0) * 2px) calc(var(--depth-y, 1) * 2px) 0 #7d7d7d,
    calc(var(--depth-x, 0) * 3px) calc(var(--depth-y, 1) * 3px) 0 #707070,
    calc(var(--depth-x, 0) * 4px) calc(var(--depth-y, 1) * 4px) 0 #636363,
    calc(var(--depth-x, 0) * 5px) calc(var(--depth-y, 1) * 5px) 0 #565656,
    calc(var(--depth-x, 0) * 6px) calc(var(--depth-y, 1) * 6px) 0 #494949,
    calc(var(--depth-x, 0) * 7px) calc(var(--depth-y, 1) * 7px) 0 #3c3c3c,
    calc(var(--depth-x, 0) * 8px) calc(var(--depth-y, 1) * 8px) 0 #2f2f2f,
    0 10px 16px rgba(0, 0, 0, 0.4);
}

.nav-box {
  position: absolute;
  width: 330px;
  height: 35px;
  color: white;
  display: flex;
  align-items: center;
  opacity: 0; /* 初始隐藏 */
  max-width: 86vw;
}

.nav-box-background {
  background-color: #121212;
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: 1;
}

.nav-box .text {
  margin-left: 5px;
  overflow: hidden;
  z-index: 2;
  opacity: 0; /* 初始隐藏 */
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .hero-section {
    gap: 14px;
  }

  .split {
    font-size: 2.2rem;
    /* 移动端去掉伪3D立体阴影 */
    text-shadow: none;
  }

  .nav-box {
    height: 32px;
  }
}
</style>
