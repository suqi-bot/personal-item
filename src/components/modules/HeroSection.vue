<template>
  <section class="hero-section" ref="heroRef">
    <div class="split">
      欢迎来到
    </div>

    <div class="nav-box" ref="navBoxRef">
      <div class="nav-box-background"></div>
      <div class="text">
        welcome to my blog
      </div>
    </div>
    
    <div class="split">
      苏柒的个人博客
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
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

// 文字动画1 - 分行动画
function createTextAnimation1() {
  const splitElements = document.querySelectorAll(".split");

  if (splitElements.length === 0) {
    console.warn('没有找到 .split 元素');
    return;
  }

  splitElements.forEach(element => {
    try {
      // 先显示元素
      gsap.set(element, { opacity: 1 });

      const split = new SplitType(element as HTMLElement, { types: 'lines' });

      if (split.lines && split.lines.length > 0) {
        console.log('SplitType 成功生成', split.lines.length, '行');

        // 设置初始状态
        gsap.set(split.lines, {
          rotationX: -100,
          transformOrigin: "50% 50% -160px",
          opacity: 0
        });

        // 执行动画
        gsap.to(split.lines, {
          rotationX: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          stagger: props.animationConfig.staggerDelay
        });
      } else {
        console.warn('SplitType 没有生成 lines，使用备用动画');
        // 备用动画：直接对整个元素进行动画
        gsap.to(element, {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out"
        });
      }
    } catch (error) {
      console.error('文字动画1 错误:', error);
      // 备用动画
      gsap.to(element, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out"
      });
    }
  });
}

// 文字动画2 - 字符动画
function createTextAnimation2() {
  const textElement = document.querySelector(".nav-box .text");
  if (!textElement) {
    console.warn('没有找到 .nav-box .text 元素');
    return;
  }

  try {

    const split = new SplitType(textElement as HTMLElement, { types: 'chars' });

    if (split.chars && split.chars.length > 0) {
      // 设置初始状态
      gsap.set(split.chars, {
        x: 100,
        opacity: 0
      });

      // 执行动画
      gsap.to(split.chars, {
        x: 0,
        opacity: 1,
        duration: 1,
        ease: "power2.out",
        stagger: 0.05
      });
    } else {
      console.warn('SplitType 没有生成 chars，使用备用动画');
      gsap.to(textElement, {
        opacity: 1,
        duration: 0.6,
        ease: "power2.out"
      });
    }
  } catch (error) {
    console.error('文字动画2 错误:', error);
    // 备用动画
    gsap.to(textElement, {
      opacity: 1,
      duration: 0.6,
      ease: "power2.out"
    });
  }
}

// 创建完整的动画时间线
function createAnimationTimeline() {
  console.log('创建动画时间线')

  const tl = gsap.timeline({
    onStart: () => {
      console.log('动画开始')
      emit('animationStart')
    },
    onComplete: () => {
      console.log('动画完成')
      emit('animationComplete')
    }
  })


 // 然后执行文字动画
  tl.call(() => {
    console.log('执行文字分行动画')
    createTextAnimation1()
  }, [], `+=${props.animationConfig.textDelay}`)

  tl.set('.nav-box', { width: 0 })

  // 先执行简单的导航框动画
  tl.to('.nav-box', {
    opacity: 1,
    duration: 1,
    width: 330,
    ease: ""
  }, '>=0.3')


  tl.to('.nav-box .text', {
    opacity:1
  }, '>=0.3')
 

  tl.call(() => {
    console.log('执行文字字符动画')
    createTextAnimation2()
  }, [], "-=0.5")

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

  // 确保DOM完全渲染后再执行动画
  await nextTick()

  const timeline = createAnimationTimeline()

  // 动画完成后重置状态
  timeline.eventCallback('onComplete', () => {
    isAnimationPlaying.value = false
    console.log('Hero动画播放完成')
  })

  return timeline
}

const resetAnimation = () => {
  try {
    // 重置动画状态
    isAnimationPlaying.value = false

    // 重置所有动画元素到初始隐藏状态
    gsap.set('.split', { opacity: 0 })
    gsap.set('.nav-box', { opacity: 0, width: 0 })
    gsap.set('.nav-box .text', { opacity: 0 })

    // 清理SplitType生成的元素
    const splitElements = document.querySelectorAll(".split");
    splitElements.forEach(element => {
      if (element.hasAttribute('data-split-type')) {
        // 恢复原始文本
        const originalText = element.textContent;
        element.innerHTML = originalText || '';
      }
    });

    const textElement = document.querySelector(".nav-box .text");
    if (textElement && textElement.hasAttribute('data-split-type')) {
      const originalText = textElement.textContent;
      textElement.innerHTML = originalText || '';
    }

    console.log('动画重置完成')
  } catch (error) {
    console.error('重置动画错误:', error);
  }
}

// 暴露方法给父组件
defineExpose({
  playAnimation,
  resetAnimation
})

onMounted(async () => {
  await nextTick()
  // 默认不自动播放，由父组件控制
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
}

.split {
  overflow: hidden;
  font-size: clamp(2rem, 12rem, 5vw);
  text-align: center;
  perspective: 500px;
  color: #121212;
  opacity: 0; /* 初始隐藏 */
}

.nav-box {
  position: absolute;
  width: 330px;
  height: 35px;
  color: white;
  display: flex;
  align-items: center;
  opacity: 0; /* 初始隐藏 */
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
}
</style>
