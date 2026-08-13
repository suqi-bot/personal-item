<template>
  <div class="games-container">
    <!-- 动态背景 -->
    <BlogBackground />

    <!-- 标题栏 -->
    <Titlebar />

    <div class="games-main">
      <!-- 页头 -->
      <header class="games-header">
        <h1 class="games-title">游戏库 <span class="title-en">GAMES</span></h1>
        <p class="games-subtitle">我的游戏作品与开发 Demo</p>
      </header>

      <!-- 分类筛选 -->
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

      <!-- 类型筛选 -->
      <div v-if="types.length > 1" class="type-filters">
        <span class="filter-label">类型</span>
        <button
          v-for="type in types"
          :key="type"
          :class="['type-btn', { active: activeType === type }]"
          @click="selectType(type)"
        >
          {{ type }}
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="games-state">
        <div class="state-spinner"></div>
        <p>正在加载游戏数据...</p>
      </div>

      <!-- 游戏卡片 -->
      <div v-else-if="filteredGames.length > 0" class="games-grid">
        <article
          v-for="game in filteredGames"
          :key="game.id"
          class="game-card"
          @click="openGame(game)"
          @mouseenter="onCardEnter"
          @mouseleave="onCardLeave"
        >
          <!-- 右侧悬浮外链按钮 -->
          <a
            v-if="game.link"
            class="game-link-btn"
            :href="game.link"
            target="_blank"
            rel="noopener noreferrer"
            :title="linkLabel(game.link)"
            @click.stop
          >
            <svg v-if="isGithubLink(game.link)" width="18" height="18" viewBox="0 0 1024 1024" fill="currentColor"><path d="M511.6 76.3C264.3 76.2 64 276.4 64 523.5 64 718.9 189.3 885 363.8 946c23.5 5.9 19.9-10.8 19.9-22.2v-77.5c-135.7 15.9-141.2-73.9-150.3-88.9C215 726 171.5 718 184.5 703c30.9-15.9 62.4 4 98.9 57.9 26.4 39.1 77.9 32.5 104 26 5.7-23.5 17.9-44.5 34.7-60.8-140.6-25.2-199.2-111-199.2-213 0-49.5 16.3-95 48.3-131.7-20.4-60.5 1.9-112.3 4.9-120 58.1-5.2 118.5 41.6 123.2 45.3 33-8.9 70.7-13.6 112.9-13.6 42.4 0 80.2 4.9 113.5 13.9 11.3-8.6 67.3-48.8 121.3-43.9 2.9 7.7 24.7 58.3 5.5 118 32.4 36.8 48.9 82.7 48.9 132.3 0 102.2-59 188.1-200 212.9 23.5 23.2 38.1 55.4 38.1 91v112.5c0.8 9 0 17.9 15 17.9 177.1-59.7 304.6-227 304.6-424.1 0-247.2-200.4-447.3-447.5-447.3z"/>
            </svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11M15 3H21V9M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </a>
          <div class="game-cover" :style="coverStyle(game)">
            <span v-if="!game.cover_url" class="cover-letter">{{ game.title.slice(0, 1) }}</span>
            <span class="game-status" :class="statusClass(game.status)">{{ game.status }}</span>
            <a
              v-if="game.bv_id"
              class="cover-video-link"
              :href="videoUrl(game.bv_id)"
              target="_blank"
              rel="noopener noreferrer"
              title="去 B站观看视频"
              @click.stop
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
              视频
            </a>
          </div>
          <div class="game-info">
            <h3 class="game-name">{{ game.title }}</h3>
            <div class="game-meta">
              <span class="game-type">{{ game.type }}</span>
              <span class="game-category">{{ game.category }}</span>
            </div>
            <p class="game-desc">{{ game.description }}</p>
          </div>
          <div class="game-enter">
            进入游戏
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </article>
      </div>

      <!-- 空状态 -->
      <div v-else class="games-state">
        <div class="state-icon">🎮</div>
        <h3>暂无游戏</h3>
        <p>没有找到匹配的游戏，请调整筛选条件</p>
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

// 游戏类型
interface Game {
  id: number
  title: string
  description: string
  category: string
  type: string
  cover_url: string | null
  bv_id: string | null
  link: string | null
  status: string
  tech_stack: string[]
  features: string[]
}

const router = useRouter()

// 数据
const games = ref<Game[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// 筛选状态
const activeCategory = ref('全部')
const activeType = ref('全部')

// 封面渐变色池
const coverPalette = [
  'linear-gradient(135deg, #111827, #4b5563)',
  'linear-gradient(135deg, #0ea5e9, #4b5563)',
  'linear-gradient(135deg, #f43f5e, #6b7280)',
  'linear-gradient(135deg, #10b981, #0ea5e9)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #6b7280, #111827)'
]

// 分类 / 类型
const categories = computed(() => [
  '全部',
  ...new Set(games.value.map((g) => g.category))
])

const types = computed(() => [
  '全部',
  ...new Set(games.value.map((g) => g.type))
])

// 过滤后的游戏
const filteredGames = computed(() => {
  return games.value.filter((game) => {
    const matchCategory = activeCategory.value === '全部' || game.category === activeCategory.value
    const matchType = activeType.value === '全部' || game.type === activeType.value
    return matchCategory && matchType
  })
})

// 封面样式：有图片链接则显示图片，否则用渐变
const coverStyle = (game: Game) => ({
  background: game.cover_url
    ? `url(${game.cover_url}) center/cover`
    : coverPalette[game.id % coverPalette.length]
})

// 状态样式
const statusClass = (status: string) => {
  if (status.includes('完成')) return 'status-done'
  if (status.includes('开发')) return 'status-dev'
  return 'status-plan'
}

// 筛选操作（等 DOM 更新后再播放卡片动画）
const selectCategory = (category: string) => {
  activeCategory.value = category
  nextTick(() => animateCards())
}

const selectType = (type: string) => {
  activeType.value = type
  nextTick(() => animateCards())
}

// 打开游戏详情
const openGame = (game: Game) => {
  router.push(`/game/${game.id}`)
}

// 生成 B站视频链接
const videoUrl = (bvId: string) => `https://www.bilibili.com/video/${bvId}`

// 判断是否为 GitHub 链接
const isGithubLink = (link: string) => link.includes('github.com')

// 外链按钮文案
const linkLabel = (link: string) => (isGithubLink(link) ? 'GitHub' : '项目链接')

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
  gsap.killTweensOf('.game-card')
  gsap.fromTo(
    '.game-card',
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
  const { data, error: fetchError } = await dbService.select('games', '*')
  if (fetchError) {
    error.value = fetchError.message
  } else if (Array.isArray(data)) {
    games.value = data as unknown as Game[]
  }
  loading.value = false

  // 等 DOM 渲染完成后播放入场动画（间隔 0.15s 错开进场）
  nextTick(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } })
    tl.from('.games-header', {
      opacity: 0, y: -30, filter: 'blur(10px)', duration: 0.655, delay: 0.05,
      clearProps: 'transform, opacity, filter'
    })
    tl.from('.category-tabs', {
      opacity: 0, y: 20, filter: 'blur(6px)', duration: 0.6555,
      clearProps: 'transform, opacity, filter'
    }, '<0.15')
    tl.from('.type-filters', {
      opacity: 0, y: 20, filter: 'blur(6px)', duration: 0.6555,
      clearProps: 'transform, opacity, filter'
    }, '<0.15')
    if (games.value.length > 0) {
      tl.from('.game-card', {
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
.games-container {
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

.games-container::-webkit-scrollbar {
  display: none;
}

.games-main {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px 60px;
}

/* 页头 */
.games-header {
  text-align: center;
  margin-bottom: 36px;
}

.games-title {
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

.games-subtitle {
  margin: 0;
  font-size: 15px;
  color: #6b7280;
  letter-spacing: 2px;
}

/* 分类 tabs */
.category-tabs {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
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

/* 类型筛选 */
.type-filters {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 36px;
}

.filter-label {
  font-size: 13px;
  color: #9ca3af;
  margin-right: 6px;
  letter-spacing: 1px;
}

.type-btn {
  background: white;
  border: 1px solid #e5e7eb;
  color: #6b7280;
  padding: 6px 16px;
  border-radius: 16px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.3s ease;
}

.type-btn:hover {
  color: #111827;
  border-color: #111827;
}

.type-btn.active {
  background: #f3f4f6;
  border-color: #111827;
  color: #111827;
}

/* 卡片网格 */
.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.game-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  position: relative;
}

.game-card::before {
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

.game-card:hover {
  border-color: #111827;
}

.game-card:hover::before {
  transform: scaleX(1);
}

.game-cover {
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

.game-status {
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

.cover-video-link {
  position: absolute;
  bottom: 12px;
  right: 14px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: white;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 5px 12px;
  border-radius: 14px;
  text-decoration: none;
  backdrop-filter: blur(4px);
  transition: all 0.3s ease;
}

.cover-video-link:hover {
  background: rgba(230, 33, 42, 0.85);
  border-color: rgba(255, 255, 255, 0.6);
  transform: translateY(-2px);
}

.game-info {
  padding: 18px 20px 12px;
}

.game-name {
  margin: 0 0 10px 0;
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
}

.game-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.game-type,
.game-category {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 10px;
}

.game-type {
  background: #f3f4f6;
  color: #111827;
  border: 1px solid rgba(17, 24, 39, 0.3);
}

.game-category {
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}

.game-desc {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.game-enter {
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

.game-card:hover .game-enter {
  background: #f3f4f6;
}

/* 右侧悬浮外链按钮 */
.game-link-btn {
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

.game-link-btn:hover {
  background: #111827;
  color: white;
  border-color: #111827;
  transform: translateY(-50%) scale(1.12);
  box-shadow: 0 6px 20px rgba(17, 24, 39, 0.4);
}

/* 加载 / 空状态 */
.games-state {
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

.games-state h3 {
  color: #374151;
  margin: 0 0 8px 0;
}

.games-state p {
  margin: 0;
  font-size: 14px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .games-main {
    padding: 24px 16px 40px;
  }

  .games-title {
    font-size: 28px;
  }

  .cat-tab {
    padding: 8px 18px;
    font-size: 13px;
  }

  .type-btn {
    padding: 5px 14px;
    font-size: 12px;
  }

  .games-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}
</style>
