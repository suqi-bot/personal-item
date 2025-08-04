<template>
  <div class="blog-content" >
    <!-- 工具栏 -->
    <div v-if="posts.length > 0" class="toolbar">
      <div class="toolbar-left">
        <span class="results-count">找到 {{ posts.length }} 篇文章</span>
      </div>
      <div class="toolbar-right">
        <select v-model="sortBy" @change="handleSort" class="sort-select">
          <option value="date">按日期排序</option>
          <option value="title">按标题排序</option>
          <option value="readTime">按阅读时间排序</option>
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
        v-for="post in posts" 
        :key="post.id"
        class="post-card"
        @click="openPost(post)"
      >
        <div class="post-header">
          <h2 class="post-title">{{ post.title }}</h2>
          <div class="post-meta">
            <span class="author">{{ post.author }}</span>
            <span class="date">{{ formatDate(post.date) }}</span>
            <span class="read-time">{{ post.readTime }} 分钟阅读</span>
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
      <button 
        class="page-btn"
        :disabled="currentPage === 1"
        @click="prevPage"
      >
        上一页
      </button>
      
      <div class="page-numbers">
        <span 
          v-for="page in visiblePages" 
          :key="page"
          :class="['page-number', { active: page === currentPage }]"
          @click="goToPage(page)"
        >
          {{ page }}
        </span>
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
import { ref, computed, onMounted, watch } from 'vue'
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

// 分页相关
const currentPage = ref(1)
const postsPerPage = 6

// 视图模式和排序
const viewMode = ref<'grid' | 'list'>('grid')
const sortBy = ref('date')

// 计算总页数
const totalPages = computed(() => 
  Math.ceil(props.posts.length / postsPerPage)
)

// 计算可见页码
const visiblePages = computed(() => {
  const pages = []
  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(totalPages.value, start + 4)
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
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
  // 这里可以跳转到文章详情页面
  console.log('打开文章:', post.title)
  // 可以使用 router.push() 跳转到详情页
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
  currentPage.value = page
}

// 切换视图模式
const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'

  // 切换视图时播放动画
  setTimeout(() => {
    gsap.killTweensOf('.post-card')
    gsap.fromTo('.post-card',
      {
        opacity: 0,
        y: 100,
        scale: 0.95
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 1,
        stagger: 0.08,
        ease: 'power2.out'
      }
    )
  }, 50)
}

// 处理排序
const handleSort = () => {
  // 这里可以添加排序逻辑
  console.log('排序方式:', sortBy.value)
}

// 监听文章变化，重置页码
watch(() => props.posts, () => {
  currentPage.value = 1
})

// 组件挂载动画
onMounted(() => {
  gsap.fromTo('.post-card',
    {
      opacity: 0,
      y: 30
    },
    {
      opacity: 1,
      y: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power2.out'
    }
  )
})

// 监听页码变化，添加动画
watch(currentPage, () => {
  // 先杀死之前的动画
  gsap.killTweensOf('.post-card')

  // 确保卡片可见，然后执行动画
  gsap.set('.post-card', { opacity: 1 })

  gsap.fromTo('.post-card',
    {
      opacity: 0,
      y: 20
    },
    {
      opacity: 1,
      y: 0,
      duration: 0.4,
      stagger: 0.05,
      ease: 'power2.out'
    }
  )
})
</script>

<style scoped>
.blog-content {
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  scroll-behavior: auto;
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
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
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
  border-color: #4f46e5;
  color: #4f46e5;
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
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  height: 100%;
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
  background: linear-gradient(90deg, #4f46e5, #7c3aed);
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.post-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border-color: #4f46e5;
}

.post-card:hover::before {
  transform: scaleX(1);
}

/* 列表视图样式 */
.posts-container.list .post-card {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 24px;
  height: auto;
}

.posts-container.list .post-header {
  flex: 1;
  margin-right: 20px;
}

.posts-container.list .post-title {
  font-size: 20px;
  margin-bottom: 8px;
}

.posts-container.list .post-excerpt {
  font-size: 14px;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.posts-container.list .post-footer {
  flex-shrink: 0;
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
  color: #4f46e5;
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
  background: #f0f9ff;
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
  border-color: #4f46e5;
  color: #4f46e5;
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
  background: #4f46e5;
  color: white;
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
}
</style>
