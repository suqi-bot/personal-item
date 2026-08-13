<template>
  <div class="blog-content" :class="{ 'entrance-hidden': !entranceStarted }">
    <!-- 工具栏 -->
    <div v-if="posts.length > 0" class="toolbar">
      <div class="toolbar-left">
        <span class="results-count">找到 {{ posts.length }} 篇文章</span>
      </div>
      <div class="toolbar-right">
        <select v-model="sortBy" @change="handleSort" class="sort-select">
          <option value="date">按日期排序</option>
          <option value="title">按标题排序</option>
          <option value="readTime">按阅读次数排序</option>
        </select>
        <button
          @click="toggleViewMode"
          class="view-toggle"
          :title="viewMode === 'grid' ? '切换到列表视图' : '切换到网格视图'"
        >
          <svg v-if="viewMode === 'grid'" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm8-2h8v8h-8v-8zm2 2h4v4h-4v-4z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 文章列表 -->
    <div v-if="posts.length > 0" :class="['posts-container', viewMode]">
      <article
        v-for="post in paginatedPosts"
        :key="post.id"
        class="post-card"
        @click="openPost(post)"
        @mouseenter="onCardEnter"
        @mouseleave="onCardLeave"
      >
        <div class="post-header">
          <h2 class="post-title">{{ post.title }}</h2>
          <div class="post-meta">
            <span class="author">{{ post.author }}</span>
            <span class="date">{{ formatDate(post.date) }}</span>
            <span class="read-time">{{ post.readTime }} 阅读次数</span>
          </div>
        </div>

        <div class="post-excerpt">
          {{ post.excerpt }}
        </div>

        <div class="post-footer">
          <div class="tags">
            <span
              v-for="tag in post.tags"
              :key="tag"
              class="tag"
            >
              #{{ tag }}
            </span>
          </div>
          <button class="read-more">
            阅读更多
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </article>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16 13H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16 17H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M10 9H9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h3>暂无文章</h3>
      <p>没有找到匹配的文章，请尝试其他搜索关键词</p>
    </div>

    <!-- 分页 -->
    <div v-if="posts.length > 0" class="pagination">
      <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>

      <button
        class="page-btn"
        :disabled="currentPage === 1"
        @click="prevPage"
      >
        上一页
      </button>

      <div class="page-numbers">
        <template v-for="(page, index) in visiblePages" :key="index">
          <span v-if="page === '...'" class="page-ellipsis">…</span>
          <span
            v-else
            :class="['page-number', { active: page === currentPage }]"
            @click="goToPage(page)"
          >
            {{ page }}
          </span>
        </template>
      </div>

      <button
        class="page-btn"
        :disabled="currentPage === totalPages"
        @click="nextPage"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { gsap } from 'gsap'

// 定义文章类型
interface BlogPost {
  id: number
  title: string
  excerpt: string
  content: string
  author: string
  date: string
  tags: string[]
  readTime: number
}

// 接收props
const props = defineProps<{
  posts: BlogPost[]
}>()

// 路由
const router = useRouter()

// 分页相关
const currentPage = ref(1)
const postsPerPage = 6
let lastPage = 1

// 视图模式和排序
const viewMode = ref<'grid' | 'list'>('grid')
const sortBy = ref('date')

// 计算总页数
const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.posts.length / postsPerPage))
)

// 计算排序后的文章列表
const sortedPosts = computed(() => {
  const posts = [...props.posts]

  switch (sortBy.value) {
    case 'date':
      return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    case 'title':
      return posts.sort((a, b) => a.title.localeCompare(b.title))
    case 'readTime':
      return posts.sort((a, b) => b.readTime - a.readTime)
    default:
      return posts
  }
})

// 当前页的文章
const paginatedPosts = computed(() => {
  const start = (currentPage.value - 1) * postsPerPage
  return sortedPosts.value.slice(start, start + postsPerPage)
})

// 计算可见页码（支持省略号）
const visiblePages = computed<Array<number | '...'>>(() => {
  const total = totalPages.value
  const current = currentPage.value
  const pages: Array<number | '...'> = []

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
    return pages
  }

  const push = (page: number) => {
    if (pages[pages.length - 1] !== page) pages.push(page)
  }

  push(1)
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) pages.push('...')
  for (let i = start; i <= end; i++) push(i)
  if (end < total - 1) pages.push('...')
  push(total)

  return pages
})

// 格式化日期
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// 打开文章详情
const openPost = (post: BlogPost) => {
  router.push(`/blog/${post.id}`)
}

// 分页操作
const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

// 切换视图模式
const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
  nextTick(() => animatePosts(0, 60))
}

// 处理排序
const handleSort = () => {}

// 偏好减少动态效果
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 入场控制：由父组件在外层动画完成后触发
const entranceTriggered = ref(false)
const toolbarAnimated = ref(false)
// 外层动画完成前隐藏内容（保留占位布局）
const entranceStarted = ref(false)

// 工具栏入场动画（仅首次）
const playToolbar = () => {
  if (toolbarAnimated.value || !props.posts.length) return
  toolbarAnimated.value = true
  gsap.fromTo(
    '.toolbar',
    { opacity: 0, y: -20 },
    {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: 'power3.out',
      clearProps: 'transform, opacity'
    }
  )
}

// 内层入场：工具栏 + 文章卡片
const playEntrance = () => {
  if (entranceStarted.value) return
  entranceTriggered.value = true
  entranceStarted.value = true
  nextTick(() => {
    playToolbar()
    animatePosts(0, 30)
  })
}

defineExpose({ playEntrance })

// 无父级协调时的兜底：自动显示内容
onMounted(() => {
  window.setTimeout(() => {
    if (!entranceTriggered.value) playEntrance()
  }, 1200)
})

// 文章卡片动画
const animatePosts = (fromX = 0, fromY = 30) => {
  const cards = gsap.utils.toArray<HTMLElement>('.post-card')
  if (!cards.length) return

  if (prefersReducedMotion) {
    gsap.set(cards, { opacity: 1, x: 0, y: 0, scale: 1 })
    return
  }

  gsap.killTweensOf(cards)
  gsap.fromTo(
    cards,
    { opacity: 0, x: fromX, y: fromY, scale: 0.96, willChange: 'transform, opacity' },
    {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration: 0.55,
      stagger: 0.07,
      ease: 'power3.out',
      overwrite: 'auto',
      clearProps: 'transform, opacity, willChange'
    }
  )
}

// 卡片悬停动画
const onCardEnter = (event: MouseEvent) => {
  const card = event.currentTarget as HTMLElement
  gsap.to(card, {
    y: -4,
    scale: 1.02,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
    duration: 0.3,
    ease: 'power2.out',
    overwrite: 'auto'
  })
}

const onCardLeave = (event: MouseEvent) => {
  const card = event.currentTarget as HTMLElement
  gsap.to(card, {
    y: 0,
    scale: 1,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    duration: 0.3,
    ease: 'power2.out',
    overwrite: 'auto'
  })
}

// 滚动到列表顶部
const scrollToTop = () => {
  const container = document.querySelector<HTMLElement>('.blog-container')
  if (container) {
    container.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// 监听页码变化：方向感知动画 + 回到顶部
watch(currentPage, (page) => {
  const direction = page > lastPage ? 1 : -1
  lastPage = page
  nextTick(() => {
    animatePosts(-direction * 50, 0)
    scrollToTop()
  })
})

// 排序变化时重置到第一页并重放动画
watch(sortBy, () => {
  if (currentPage.value !== 1) {
    currentPage.value = 1
  } else {
    nextTick(() => animatePosts(0, 30))
  }
})

// 监听文章变化，重置页码；入场被触发且数据加载完成后播放入场动画
watch(() => props.posts, (posts) => {
  if (currentPage.value !== 1) {
    currentPage.value = 1
    return
  }
  if (posts.length > 0 && entranceTriggered.value) {
    nextTick(() => {
      playToolbar()
      animatePosts(0, 30)
    })
  }
})
</script>

<style scoped>
.blog-content {
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  scroll-behavior: auto;
}

/* 外层动画完成前隐藏内容（保留占位布局） */
.blog-content.entrance-hidden {
  visibility: hidden;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.toolbar-left {
  display: flex;
  align-items: center;
}

.results-count {
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sort-select {
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  transition: border-color 0.3s ease;
}

.sort-select:focus {
  outline: none;
  border-color: #111827;
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.1);
}

.view-toggle {
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.view-toggle:hover {
  background: #f3f4f6;
  border-color: #111827;
  color: #111827;
}

.posts-container.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 24px;
  margin-bottom: 50px;
}

.posts-container.list {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 50px;
}

@media (min-width: 1200px) {
  .posts-container.grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1600px) {
  .posts-container.grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.post-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #e5e7eb;
  transition: border-color 0.3s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  height: 40vh;

  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.post-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #111827, #4b5563);
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.post-card:hover {
  border-color: #111827;
}

.post-card:hover::before {
  transform: scaleX(1);
}

/* 列表视图样式 */
.posts-container.list .post-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 24px;
  height: auto;
  gap: 24px;
}

.posts-container.list .post-header {
  flex: 0 0 280px;
  margin-right: 0;
  margin-bottom: 0;
}

.posts-container.list .post-title {
  font-size: 20px;
  margin-bottom: 8px;
}

.posts-container.list .post-excerpt {
  flex: 1;
  min-width: 0;
  margin: 0;
  -webkit-line-clamp: 2;
}

.posts-container.list .post-footer {
  flex: 0 0 150px;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.post-header {
  margin-bottom: 16px;
}

.post-title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 16px 0;
  line-height: 1.3;
  flex-grow: 1;
}

.post-meta {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #6b7280;
}

.post-meta span {
  position: relative;
}

.post-meta span:not(:last-child)::after {
  content: '•';
  margin-left: 12px;
  color: #d1d5db;
}

.post-excerpt {
  color: #4b5563;
  line-height: 1.7;
  margin-bottom: 24px;
  font-size: 16px;
  flex-grow: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.post-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag {
  background: #f3f4f6;
  color: #4b5563;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.read-more {
  background: none;
  border: none;
  color: #111827;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.3s ease;
  font-size: 14px;
}

.read-more:hover {
  background: #f3f4f6;
  transform: translateX(4px);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}

.empty-icon {
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  color: #374151;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 40px;
}

.page-info {
  color: #6b7280;
  font-size: 14px;
  margin-right: auto;
}

.page-btn {
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.page-btn:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #111827;
  color: #111827;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 8px;
}

.page-number {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.page-number:hover {
  background: #f3f4f6;
}

.page-number.active {
  background: #111827;
  color: white;
}

.page-ellipsis {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  user-select: none;
}

@media (max-width: 768px) {
  .blog-content {
    padding: 20px;
  }

  .posts-container.grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .post-card {
    padding: 20px;
  }

  .post-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  /* 列表视图在窄屏下改为纵向 */
  .posts-container.list .post-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .posts-container.list .post-header {
    flex: none;
    width: 100%;
  }

  .posts-container.list .post-excerpt {
    width: 100%;
    margin: 0;
  }

  .posts-container.list .post-footer {
    flex: none;
    width: 100%;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  /* 卡片高度自适应，避免小屏下过高 */
  .post-card {
    height: auto;
    min-height: 220px;
  }

  /* 分页换行压缩，避免溢出 */
  .pagination {
    flex-wrap: wrap;
    gap: 10px;
  }

  .page-info {
    width: 100%;
    text-align: center;
    margin-right: 0;
  }

  .page-number {
    width: 34px;
    height: 34px;
    font-size: 14px;
  }

  .page-btn {
    padding: 6px 14px;
    font-size: 13px;
  }
}
</style>
