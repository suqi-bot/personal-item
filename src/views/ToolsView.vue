<template>
  <div class="tools-container">
    <!-- 动态背景 -->
    <BlogBackground />

    <!-- 标题栏 -->
    <Titlebar />

    <div class="tools-main">
      <!-- 页头 -->
      <header class="tools-header">
        <h1 class="tools-title">工具箱 <span class="title-en">TOOLS</span></h1>
        <p class="tools-subtitle">效率工具与开发辅助集合</p>
      </header>

      <!-- 筛选工具栏：左侧分类，右侧搜索 -->
      <div class="tools-toolbar">
        <div class="category-tabs">
          <button
            v-for="cat in categories"
            :key="cat"
            :class="['cat-tab', { active: activeCategory === cat }]"
            @click="selectCategory(cat)"
          >
            {{ cat }}
          </button>
        </div>

        <div class="search-box">
          <div class="search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="搜索工具名称、描述或分类..."
            class="search-input"
            @input="onSearchInput"
          />
          <button
            v-if="searchKeyword"
            class="clear-btn"
            type="button"
            @click="clearSearch"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="tools-state">
        <div class="state-spinner"></div>
        <p>正在加载工具数据...</p>
      </div>

      <!-- 工具卡片 -->
      <div v-else-if="filteredTools.length > 0" class="tools-grid">
        <article
          v-for="tool in filteredTools"
          :key="tool.id"
          class="tool-card"
          @click="openTool(tool)"
          @mouseenter="onCardEnter"
          @mouseleave="onCardLeave"
        >
          <!-- 右侧悬浮外链按钮 -->
          <a
            v-if="tool.link"
            class="tool-link-btn"
            :href="tool.link"
            target="_blank"
            rel="noopener noreferrer"
            title="访问工具"
            @click.stop
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11M15 3H21V9M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </a>
          <div class="tool-cover" :style="coverStyle(tool)">
            <span v-if="!tool.cover_url" class="cover-letter">{{ tool.title.slice(0, 1) }}</span>
            <span class="tool-status" :class="statusClass(tool.status)">{{ tool.status }}</span>
          </div>
          <div class="tool-info">
            <h3 class="tool-name">{{ tool.title }}</h3>
            <div class="tool-meta">
              <span class="tool-type">{{ tool.type }}</span>
              <span class="tool-category">{{ tool.category }}</span>
            </div>
            <p class="tool-desc">{{ tool.description }}</p>
            <div v-if="tool.tech_stack && tool.tech_stack.length" class="tool-tags">
              <span v-for="tech in tool.tech_stack.slice(0, 4)" :key="tech" class="tool-tag">{{ tech }}</span>
            </div>
          </div>
          <div class="tool-enter">
            查看详情
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </article>
      </div>

      <!-- 空状态 -->
      <div v-else class="tools-state">
        <div class="state-icon">🧰</div>
        <h3>暂无工具</h3>
        <p>没有找到匹配的工具，请调整筛选条件或搜索关键词</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { gsap } from 'gsap'
import Titlebar from '@/components/layout/Titlebar.vue'
import BlogBackground from '@/components/modules/BlogBackground.vue'
import { dbService } from '@/services/supabaseService'

// 工具类型
interface Tool {
  id: number
  title: string
  description: string
  category: string
  type: string
  link: string | null
  deploy_url: string | null
  cover_url: string | null
  status: string
  tech_stack: string[]
  features: string[]
}

const router = useRouter()

// 数据
const tools = ref<Tool[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// 筛选状态
const activeCategory = ref('全部')
const searchKeyword = ref('')

// 搜索防抖定时器
let searchTimer: ReturnType<typeof setTimeout> | undefined

// 封面渐变色池（与游戏页保持一致风格）
const coverPalette = [
  'linear-gradient(135deg, #111827, #4b5563)',
  'linear-gradient(135deg, #0ea5e9, #4b5563)',
  'linear-gradient(135deg, #f43f5e, #6b7280)',
  'linear-gradient(135deg, #10b981, #0ea5e9)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #6b7280, #111827)'
]

// 分类
const categories = computed(() => [
  '全部',
  ...new Set(tools.value.map((t) => t.category))
])

// 过滤后的工具
const filteredTools = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return tools.value.filter((tool) => {
    const matchCategory = activeCategory.value === '全部' || tool.category === activeCategory.value
    const matchKeyword =
      !keyword ||
      [tool.title, tool.description, tool.category, tool.type].some((field) =>
        field.toLowerCase().includes(keyword)
      )
    return matchCategory && matchKeyword
  })
})

// 封面样式：有图片链接则显示图片，否则用渐变
const coverStyle = (tool: Tool) => ({
  background: tool.cover_url
    ? `url(${tool.cover_url}) center/cover`
    : coverPalette[tool.id % coverPalette.length]
})

// 状态样式
const statusClass = (status: string) => {
  if (status.includes('可用') || status.includes('在线')) return 'status-done'
  if (status.includes('维护')) return 'status-dev'
  return 'status-plan'
}

// 选择分类
const selectCategory = (category: string) => {
  activeCategory.value = category
  nextTick(() => animateCards())
}

// 搜索输入（防抖）
const onSearchInput = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    nextTick(() => animateCards())
  }, 200)
}

// 清除搜索
const clearSearch = () => {
  searchKeyword.value = ''
  nextTick(() => animateCards())
}

// 打开工具详情
const openTool = (tool: Tool) => {
  router.push(`/tools/${tool.id}`)
}

// 卡片悬停动画
const onCardEnter = (event: MouseEvent) => {
  const card = event.currentTarget as HTMLElement
  gsap.to(card, {
    y: -4,
    boxShadow: '0 8px 32px rgba(17, 24, 39, 0.12)',
    duration: 0.4,
    ease: 'power2.out',
    overwrite: 'auto'
  })
}

const onCardLeave = (event: MouseEvent) => {
  const card = event.currentTarget as HTMLElement
  gsap.to(card, {
    y: 0,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    duration: 0.4,
    ease: 'power2.out',
    overwrite: 'auto'
  })
}

// 卡片入场动画
const animateCards = () => {
  gsap.killTweensOf('.tool-card')
  gsap.fromTo(
    '.tool-card',
    { opacity: 0, y: 30, scale: 0.97, filter: 'blur(6px)' },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      duration: 0.655,
      stagger: 0.05,
      ease: 'power3.inOut',
      overwrite: 'auto',
      clearProps: 'transform, opacity, filter'
    }
  )
}

// 加载数据
onMounted(async () => {
  const { data, error: fetchError } = await dbService.select('tools', '*')
  if (fetchError) {
    error.value = fetchError.message
  } else if (Array.isArray(data)) {
    tools.value = data as unknown as Tool[]
  }
  loading.value = false

  // 等 DOM 渲染完成后播放入场动画
  nextTick(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } })
    tl.from('.tools-header', {
      opacity: 0, y: -30, filter: 'blur(10px)', duration: 0.655, delay: 0.05,
      clearProps: 'transform, opacity, filter'
    })
    tl.from('.tools-toolbar', {
      opacity: 0, y: 20, filter: 'blur(6px)', duration: 0.6555,
      clearProps: 'transform, opacity, filter'
    }, '<0.15')
    if (tools.value.length > 0) {
      tl.from('.tool-card', {
        opacity: 0,
        y: 30,
        filter: 'blur(6px)',
        duration: 0.655,
        stagger: 0.05,
        clearProps: 'transform, opacity, filter'
      }, '<0.15')
    }
  })
})
</script>

<style scoped>
.tools-container {
  height: 100vh;
  width: 100vw;
  position: absolute;
  top: 0;
  left: 0;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
  background-color: #f5f5f5;
}

.tools-container::-webkit-scrollbar {
  display: none;
}

.tools-main {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px 60px;
}

/* 页头 */
.tools-header {
  text-align: center;
  margin-bottom: 36px;
}

.tools-title {
  margin: 0 0 8px 0;
  font-size: 40px;
  font-weight: 800;
  color: #1f2937;
  letter-spacing: 4px;
}

.title-en {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  letter-spacing: 8px;
  vertical-align: super;
}

.tools-subtitle {
  margin: 0;
  font-size: 15px;
  color: #6b7280;
  letter-spacing: 2px;
}

/* 筛选工具栏：分类在左，搜索在右（商城式布局） */
.tools-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 36px;
}

.category-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 240px;
}

.cat-tab {
  background: white;
  border: 1px solid #e5e7eb;
  color: #6b7280;
  padding: 10px 26px;
  border-radius: 24px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 1px;
  transition: all 0.3s ease;
}

.cat-tab:hover {
  color: #111827;
  border-color: #111827;
}

.cat-tab.active {
  background: linear-gradient(135deg, #111827, #4b5563);
  border-color: transparent;
  color: white;
  box-shadow: 0 4px 16px rgba(17, 24, 39, 0.3);
}

/* 商城式搜索框 */
.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 24px;
  padding: 9px 18px;
  width: 300px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
}

.search-box:focus-within {
  border-color: #111827;
  box-shadow: 0 4px 16px rgba(17, 24, 39, 0.12);
}

.search-icon {
  color: #6b7280;
  display: flex;
  align-items: center;
  transition: color 0.3s ease;
}

.search-box:focus-within .search-icon {
  color: #111827;
}

.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: #1f2937;
}

.search-input::placeholder {
  color: #9ca3af;
}

.clear-btn {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.clear-btn:hover {
  background: #f3f4f6;
  color: #ef4444;
}

/* 卡片网格 */
.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.tool-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  position: relative;
}

.tool-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #111827, #4b5563);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s ease;
  z-index: 2;
}

.tool-card:hover {
  border-color: #111827;
}

.tool-card:hover::before {
  transform: scaleX(1);
}

.tool-cover {
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.cover-letter {
  font-size: 64px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.tool-status {
  position: absolute;
  top: 14px;
  right: 14px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 12px;
  color: white;
}

.status-done {
  background: rgba(16, 185, 129, 0.85);
}

.status-dev {
  background: rgba(245, 158, 11, 0.85);
}

.status-plan {
  background: rgba(107, 114, 128, 0.85);
}

.tool-info {
  padding: 18px 20px 12px;
}

.tool-name {
  margin: 0 0 10px 0;
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
}

.tool-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.tool-type,
.tool-category {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 10px;
}

.tool-type {
  background: #f3f4f6;
  color: #111827;
  border: 1px solid rgba(17, 24, 39, 0.3);
}

.tool-category {
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}

.tool-desc {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tool-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.tool-tag {
  font-size: 11px;
  font-weight: 600;
  color: #4b5563;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  padding: 2px 10px;
  border-radius: 10px;
  transition: all 0.3s ease;
}

.tool-card:hover .tool-tag {
  border-color: rgba(17, 24, 39, 0.3);
  color: #111827;
}

.tool-enter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  border-top: 1px solid #f3f4f6;
  transition: all 0.3s ease;
}

.tool-card:hover .tool-enter {
  background: #f3f4f6;
}

/* 右侧悬浮外链按钮 */
.tool-link-btn {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: white;
  color: #111827;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  border: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
  text-decoration: none;
  transition: all 0.3s ease;
}

.tool-link-btn:hover {
  background: #111827;
  color: white;
  border-color: #111827;
  transform: translateY(-50%) scale(1.12);
  box-shadow: 0 6px 20px rgba(17, 24, 39, 0.4);
}

/* 加载 / 空状态 */
.tools-state {
  text-align: center;
  padding: 80px 20px;
  color: #6b7280;
}

.state-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f4f6;
  border-top: 3px solid #111827;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

.state-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.tools-state h3 {
  color: #374151;
  margin: 0 0 8px 0;
}

.tools-state p {
  margin: 0;
  font-size: 14px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .tools-main {
    padding: 24px 16px 40px;
  }

  .tools-title {
    font-size: 28px;
  }

  .tools-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    width: auto;
  }

  .cat-tab {
    padding: 8px 18px;
    font-size: 13px;
  }

  .tools-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}
</style>
