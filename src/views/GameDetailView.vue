<template>
  <div class="game-detail-container">
    <!-- 动态背景 -->
    <BlogBackground />

    <!-- 标题栏 -->
    <Titlebar />

    <div class="detail-main" v-if="game">
      <!-- 右上角悬浮外链 -->
      <a
        v-if="game.link"
        class="float-link"
        :href="game.link"
        target="_blank"
        rel="noopener noreferrer"
        :title="linkLabel(game.link)"
      >
        <svg v-if="isGithubLink(game.link)" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11M15 3H21V9M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        {{ linkLabel(game.link) }}
      </a>

      <!-- 返回 -->
      <button @click="goBack" class="back-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        返回游戏库
      </button>

      <!-- 头部横幅 -->
      <section class="detail-hero" :style="heroStyle()">
        <span class="hero-letter">{{ game.title.slice(0, 1) }}</span>
        <div class="hero-info">
          <h1 class="hero-title">{{ game.title }}</h1>
          <div class="hero-meta">
            <span class="hero-type">{{ game.type }}</span>
            <span class="hero-category">{{ game.category }}</span>
            <span class="hero-status" :class="statusClass(game.status)">{{ game.status }}</span>
          </div>
        </div>
      </section>

      <!-- 主体 -->
      <div class="detail-body">
        <!-- 介绍 -->
        <section class="detail-card">
          <h2 class="section-title">游戏介绍</h2>
          <p class="detail-desc">{{ game.description }}</p>
        </section>

        <!-- 技术栈 -->
        <section v-if="game.tech_stack && game.tech_stack.length" class="detail-card">
          <h2 class="section-title">技术栈</h2>
          <div class="stack-list">
            <span v-for="tech in game.tech_stack" :key="tech" class="stack-tag">{{ tech }}</span>
          </div>
        </section>

        <!-- 核心功能 -->
        <section v-if="game.features && game.features.length" class="detail-card">
          <h2 class="section-title">核心功能</h2>
          <ul class="feature-list">
            <li v-for="(feature, index) in game.features" :key="index">{{ feature }}</li>
          </ul>
        </section>

        <!-- 演示视频 -->
        <section v-if="game.bv_id" class="detail-card">
          <div class="video-head">
            <h2 class="section-title">演示视频</h2>
            <a
              class="video-open-link"
              :href="`https://www.bilibili.com/video/${game.bv_id}`"
              target="_blank"
              rel="noopener noreferrer"
            >
              在 B站打开
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11M15 3H21V9M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>
          </div>
          <iframe
            :src="`https://player.bilibili.com/player.html?bvid=${game.bv_id}&high_quality=1&danmaku=0`"
            class="video-frame"
            scrolling="no"
            border="0"
            frameborder="no"
            framespacing="0"
            allowfullscreen="true"
            loading="lazy"
          ></iframe>
        </section>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-else-if="loading" class="detail-state">
      <div class="state-spinner"></div>
      <p>正在加载游戏信息...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else class="detail-state">
      <h3>游戏未找到</h3>
      <p>抱歉，该游戏不存在或已被删除</p>
      <button @click="goBack" class="error-back-btn">返回游戏库</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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

const route = useRoute()
const router = useRouter()

const game = ref<Game | null>(null)
const loading = ref(true)

const coverPalette = [
  'linear-gradient(135deg, #111827, #4b5563)',
  'linear-gradient(135deg, #0ea5e9, #4b5563)',
  'linear-gradient(135deg, #f43f5e, #6b7280)',
  'linear-gradient(135deg, #10b981, #0ea5e9)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #6b7280, #111827)'
]

const heroStyle = () => {
  if (!game.value) return {}
  return {
    background: game.value.cover_url
      ? `url(${game.value.cover_url}) center/cover`
      : coverPalette[game.value.id % coverPalette.length]
  }
}

const statusClass = (status: string) => {
  if (status.includes('完成')) return 'status-done'
  if (status.includes('开发')) return 'status-dev'
  return 'status-plan'
}

const goBack = () => {
  router.push('/games')
}

// 判断是否为 GitHub 链接
const isGithubLink = (link: string) => link.includes('github.com')

// 外链文案
const linkLabel = (link: string) => (isGithubLink(link) ? 'GitHub 仓库' : '项目链接')

onMounted(async () => {
  const gameId = parseInt(route.params.id as string)
  if (gameId) {
    const { data, error } = await dbService.select('games', '*', { id: gameId })
    if (!error && Array.isArray(data) && data.length > 0) {
      game.value = data[0] as unknown as Game
    }
  }
  loading.value = false

  // 入场动画：返回 → 横幅 → 卡片，依次模糊浮现
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
  tl.from('.back-btn', {
    opacity: 0, y: -16, filter: 'blur(4px)', duration: 0.5, delay: 0.1,
    clearProps: 'transform, opacity, filter'
  })
  tl.from('.detail-hero', {
    opacity: 0, y: 40, filter: 'blur(10px)', duration: 0.7,
    clearProps: 'transform, opacity, filter'
  }, '+=0.05')
  tl.from('.detail-card', {
    opacity: 0, y: 24, filter: 'blur(6px)', duration: 0.55, stagger: 0.1,
    clearProps: 'transform, opacity, filter'
  }, '+=0.1')
})

onBeforeUnmount(() => {
  game.value = null
})
</script>

<style scoped>
.game-detail-container {
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

.game-detail-container::-webkit-scrollbar {
  display: none;
}

.detail-main {
  position: relative;
  z-index: 1;
  max-width: 900px;
  margin: 0 auto;
  padding: 28px 24px 60px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
  border: 1px solid #e5e7eb;
  color: #6b7280;
  padding: 10px 18px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 24px;
  transition: all 0.3s ease;
}

.back-btn:hover {
  color: #111827;
  border-color: #111827;
  background: #f9fafb;
  transform: translateX(-4px);
}

/* 头部横幅 */
.detail-hero {
  display: flex;
  align-items: center;
  gap: 28px;
  border-radius: 16px;
  padding: 40px 36px;
  margin-bottom: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  position: relative;
  overflow: hidden;
}

.hero-letter {
  width: 96px;
  height: 96px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 52px;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
  text-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.hero-info {
  min-width: 0;
}

.hero-title {
  margin: 0 0 14px 0;
  font-size: 32px;
  font-weight: 800;
  color: white;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

.hero-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.hero-type,
.hero-category,
.hero-status {
  font-size: 13px;
  font-weight: 600;
  padding: 5px 14px;
  border-radius: 14px;
  color: white;
}

.hero-type {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.hero-category {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.hero-status.status-done {
  background: rgba(16, 185, 129, 0.85);
}

.hero-status.status-dev {
  background: rgba(245, 158, 11, 0.85);
}

.hero-status.status-plan {
  background: rgba(107, 114, 128, 0.85);
}

/* 主体卡片 */
.detail-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.detail-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;
}

.detail-card::before {
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
}

.detail-card:hover::before {
  transform: scaleX(1);
}

.section-title {
  margin: 0 0 18px 0;
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
  padding-bottom: 10px;
  position: relative;
}

.section-title::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 40px;
  height: 3px;
  border-radius: 3px;
  background: linear-gradient(90deg, #111827, #4b5563);
}

.detail-desc {
  margin: 0;
  font-size: 15px;
  color: #4b5563;
  line-height: 1.9;
}

.stack-list {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.stack-tag {
  background: #f3f4f6;
  border: 1px solid rgba(17, 24, 39, 0.3);
  color: #111827;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 16px;
  border-radius: 16px;
  transition: all 0.3s ease;
}

.stack-tag:hover {
  background: #111827;
  color: white;
}

.feature-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-list li {
  position: relative;
  padding-left: 22px;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.7;
}

.feature-list li::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 9px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #111827, #4b5563);
}

.video-frame {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: none;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  background: #1f2937;
  display: block;
}

/* 项目链接 */
.project-link {
  display: none;
}

.video-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}

.video-head .section-title {
  margin: 0;
}

.video-open-link {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  background: #f3f4f6;
  border: 1px solid rgba(17, 24, 39, 0.3);
  padding: 7px 14px;
  border-radius: 14px;
  text-decoration: none;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.video-open-link:hover {
  background: #111827;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(17, 24, 39, 0.3);
}

/* 右上角悬浮外链按钮 */
.float-link {
  position: fixed;
  top: 90px;
  right: 24px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 40px;
  background: linear-gradient(135deg, #111827, #4b5563);
  color: white;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 8px 24px rgba(17, 24, 39, 0.4);
  transition: all 0.3s ease;
  animation: float-in 0.5s ease;
}

.float-link:hover {
  transform: translateY(-3px) scale(1.03);
  box-shadow: 0 12px 32px rgba(17, 24, 39, 0.55);
}

@keyframes float-in {
  from { opacity: 0; transform: translateY(-12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 加载 / 错误状态 */
.detail-state {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 20px;
  text-align: center;
  color: #6b7280;
}

.state-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f4f6;
  border-top: 3px solid #111827;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.detail-state h3 {
  color: #374151;
  margin: 0 0 8px 0;
  font-size: 20px;
}

.detail-state p {
  margin: 0 0 20px 0;
  font-size: 14px;
}

.error-back-btn {
  background: linear-gradient(135deg, #111827, #4b5563);
  border: none;
  color: white;
  padding: 10px 24px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.error-back-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(17, 24, 39, 0.35);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .detail-main {
    padding: 20px 16px 40px;
  }

  .float-link {
    top: 76px;
    right: 12px;
    padding: 9px 14px;
    font-size: 13px;
  }

  .detail-hero {
    flex-direction: column;
    text-align: center;
    padding: 32px 20px;
  }

  .hero-title {
    font-size: 26px;
  }

  .detail-card {
    padding: 22px;
  }
}
</style>
