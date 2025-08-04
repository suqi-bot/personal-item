<template>
  <div class="layout-module">
    <!-- 顶部导航栏 -->
    <header class="layout-header" v-if="showHeader">
      <Titlebar />
    </header>

    <!-- 主要内容区域 -->
    <main class="layout-main" :class="mainClasses">
      <slot name="main">
        <!-- 默认主要内容 -->
      </slot>
    </main>

    <!-- 侧边栏 -->
    <aside class="layout-sidebar" v-if="showSidebar" :class="sidebarClasses">
      <slot name="sidebar">
        <!-- 默认侧边栏内容 -->
      </slot>
    </aside>

    <!-- 底部 -->
    <footer class="layout-footer" v-if="showFooter">
      <slot name="footer">
        <!-- 默认底部内容 -->
      </slot>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import Titlebar from '@/components/layout/Titlebar.vue'

// 布局配置接口
interface LayoutConfig {
  showHeader?: boolean
  showSidebar?: boolean
  showFooter?: boolean
  sidebarPosition?: 'left' | 'right'
  headerHeight?: string
  footerHeight?: string
  sidebarWidth?: string
}

const props = withDefaults(defineProps<{
  config?: LayoutConfig
}>(), {
  config: () => ({
    showHeader: true,
    showSidebar: false,
    showFooter: false,
    sidebarPosition: 'left',
    headerHeight: 'auto',
    footerHeight: 'auto',
    sidebarWidth: '250px'
  })
})

// 计算属性
const showHeader = computed(() => props.config.showHeader)
const showSidebar = computed(() => props.config.showSidebar)
const showFooter = computed(() => props.config.showFooter)

const mainClasses = computed(() => ({
  'with-sidebar': showSidebar.value,
  'sidebar-left': showSidebar.value && props.config.sidebarPosition === 'left',
  'sidebar-right': showSidebar.value && props.config.sidebarPosition === 'right'
}))

const sidebarClasses = computed(() => ({
  'sidebar-left': props.config.sidebarPosition === 'left',
  'sidebar-right': props.config.sidebarPosition === 'right'
}))

// 事件发射
const emit = defineEmits<{
  layoutReady: []
  headerClick: []
  sidebarToggle: [visible: boolean]
}>()

// 布局控制方法
const toggleSidebar = () => {
  const newState = !showSidebar.value
  emit('sidebarToggle', newState)
}

// 暴露方法给父组件
defineExpose({
  toggleSidebar
})

// 组件挂载完成后触发布局就绪事件
onMounted(() => {
  emit('layoutReady')
})
</script>

<style scoped>
.layout-module {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  position: relative;
}

.layout-header {
  height: v-bind('props.config.headerHeight');
  z-index: 100;
  position: relative;
  width: 100%;
  flex-shrink: 0;
}

.layout-main {
  flex: 1;
  position: relative;
  overflow: hidden;
  transition: margin 0.3s ease;
}

.layout-main.with-sidebar.sidebar-left {
  margin-left: v-bind('props.config.sidebarWidth');
}

.layout-main.with-sidebar.sidebar-right {
  margin-right: v-bind('props.config.sidebarWidth');
}

.layout-sidebar {
  position: fixed;
  top: 0;
  width: v-bind('props.config.sidebarWidth');
  height: 100vh;
  z-index: 90;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  transition: transform 0.3s ease;
}

.layout-sidebar.sidebar-left {
  left: 0;
}

.layout-sidebar.sidebar-right {
  right: 0;
}

.layout-footer {
  height: v-bind('props.config.footerHeight');
  z-index: 100;
  position: relative;
}
</style>
