<template>
  <div class="home-container">
    <!-- 背景模块 -->
    <BackgroundModule 
      :config="backgroundConfig"
      @background-ready="onBackgroundReady"
      @background-error="onBackgroundError"
    />

    <!-- 布局模块 -->
    <LayoutModule
      :config="layoutConfig"
      @layout-ready="onLayoutReady"
    >
      <!-- 主要内容区域 -->
      <template #main>
        <div class="content-container">
          <HeroSection
            ref="heroSectionRef"
            :animation-config="heroAnimationConfig"
            @animation-start="onHeroAnimationStart"
            @animation-complete="onHeroAnimationComplete"
          />
        </div>
      </template>
    </LayoutModule>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import gsap from 'gsap'
import BackgroundModule from '@/components/modules/BackgroundModule.vue'
import LayoutModule from '@/components/modules/LayoutModule.vue'
import HeroSection from '@/components/modules/HeroSection.vue'

// 组件引用
const heroSectionRef = ref<InstanceType<typeof HeroSection>>()

// 模块配置
const backgroundConfig = ref({
  blur: 3,
  opacity: 1,
  zIndex: -1
})

const layoutConfig = ref({
  showHeader: true,
  showSidebar: false,
  showFooter: false,
  headerHeight: '60px'
})

const heroAnimationConfig = ref({
  textDelay: 0,
  navBoxDelay: 0.5,
  staggerDelay: 0.25
})

// 模块状态
const moduleStates = ref({
  backgroundReady: false,
  layoutReady: false,
  heroReady: false
})

// 动画状态跟踪
const animationStates = ref({
  pageAnimationStarted: false
})

// 事件处理函数
const onBackgroundReady = () => {
  console.log('背景模块准备就绪')
  moduleStates.value.backgroundReady = true
  checkAllModulesReady()
}

const onBackgroundError = (error: Error) => {
  console.error('背景模块错误:', error)
}

const onLayoutReady = () => {
  console.log('布局模块准备就绪')
  moduleStates.value.layoutReady = true
  checkAllModulesReady()
}

const onHeroAnimationStart = () => {
  console.log('Hero动画开始')
}

const onHeroAnimationComplete = () => {
  console.log('Hero动画完成')
  moduleStates.value.heroReady = true
}

// 检查所有模块是否准备就绪
const checkAllModulesReady = () => {
  const { backgroundReady, layoutReady } = moduleStates.value
  console.log('模块状态检查:', { backgroundReady, layoutReady })
  if (backgroundReady && layoutReady && !animationStates.value.pageAnimationStarted) {
    console.log('所有模块准备就绪，启动动画')
    startPageAnimation()
  }
}

// 启动页面动画
const startPageAnimation = async () => {
  if (animationStates.value.pageAnimationStarted) {
    console.log('页面动画已经启动，跳过重复调用')
    return
  }

  animationStates.value.pageAnimationStarted = true
  console.log('启动页面动画')
  await nextTick()

  // 创建主时间线
  const mainTimeline = gsap.timeline()

  // 背景模块入场动画
  mainTimeline.from('.home-container', {
    opacity: 0,
    duration: 0.5
  })

  // 启动Hero部分动画
  if (heroSectionRef.value) {
    console.log('准备启动Hero动画')
    mainTimeline.call(() => {
      console.log('调用Hero动画')
      heroSectionRef.value?.playAnimation()
    }, [], "+=0.3")
  } else {
    console.log('heroSectionRef为空')
  }

  // 3D模型入场动画
  mainTimeline.from('.background-module', {
    opacity: 0,
    duration: 1,
    y: window.innerHeight,
  }, "+=1")

  
  
}

onMounted(async () => {
  await nextTick()
  console.log('HomeView mounted')
  // 等待所有模块准备就绪后再启动动画
})
</script>

<style scoped>
.home-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  background-color: #f5f5f5;
  overflow: hidden;
}

/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.content-container {
  width: 100%;
  height: calc(100vh - 60px);
  position: relative;
  overflow: hidden;
  z-index: 1;
  /* 确保内容在3D模型之上 */
}

/* 响应式设计 */
@media (max-width: 768px) {
  .content-container {
    height: calc(100vh - 60px);
  }
}

@media (max-width: 480px) {
  .content-container {
    height: calc(100vh - 60px);
  }
}

/* 动画过渡效果 */
.home-container {
  transition: opacity 0.3s ease-in-out;
}

/* 确保模块层级正确 */
.background-module {
  z-index: -1;
}

.layout-module {
  z-index: 1;
}
</style>