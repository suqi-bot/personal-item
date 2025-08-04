<template>
  <div class="related-articles">
    <h3 class="section-title">相关文章</h3>
    
    <div v-if="relatedPosts.length > 0" class="articles-grid">
      <article
        v-for="post in relatedPosts"
        :key="post.id"
        class="article-card"
        @click="goToArticle(post.id)"
      >
        <div class="article-content">
          <h4 class="article-title">{{ post.title }}</h4>
          <p class="article-excerpt">{{ post.excerpt }}</p>
          <div class="article-meta">
            <span class="read-time">{{ post.readTime }} 分钟阅读</span>
            <span class="date">{{ formatDate(post.date) }}</span>
          </div>
          <div class="article-tags">
            <span
              v-for="tag in post.tags.slice(0, 2)"
              :key="tag"
              class="tag"
            >
              #{{ tag }}
            </span>
          </div>
        </div>
        <div class="article-arrow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </article>
    </div>
    
    <div v-else class="no-related">
      <div class="no-related-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <p>暂无相关文章</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { gsap } from 'gsap'

// 文章类型定义
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

const props = defineProps<{
  currentArticleId: number
  currentTags: string[]
}>()

const router = useRouter()

// 响应式数据
const allPosts = ref<BlogPost[]>([
  {
    id: 1,
    title: 'Vue 3 Composition API 深度解析',
    excerpt: '深入了解Vue 3的Composition API，掌握现代Vue开发的核心概念和最佳实践。',
    content: '',
    author: '技术博主',
    date: '2024-01-15',
    tags: ['Vue', 'JavaScript', '前端'],
    readTime: 8
  },
  {
    id: 2,
    title: 'TypeScript 进阶技巧分享',
    excerpt: '分享一些TypeScript的高级用法和技巧，提升代码质量和开发效率。',
    content: '',
    author: '技术博主',
    date: '2024-01-10',
    tags: ['TypeScript', '编程技巧'],
    readTime: 12
  },
  {
    id: 3,
    title: '现代前端工程化实践',
    excerpt: '探讨现代前端开发中的工程化实践，包括构建工具、代码规范、自动化部署等。',
    content: '',
    author: '技术博主',
    date: '2024-01-05',
    tags: ['前端工程化', 'Vite', 'CI/CD'],
    readTime: 15
  },
  {
    id: 4,
    title: 'CSS Grid 布局完全指南',
    excerpt: '全面介绍CSS Grid布局系统，从基础概念到高级应用，助你掌握现代布局技术。',
    content: '',
    author: '技术博主',
    date: '2023-12-28',
    tags: ['CSS', '布局', '前端'],
    readTime: 10
  },
  {
    id: 5,
    title: 'React Hooks 最佳实践',
    excerpt: '深入探讨React Hooks的使用技巧和最佳实践，提升React开发效率。',
    content: '',
    author: '技术博主',
    date: '2023-12-20',
    tags: ['React', 'JavaScript', '前端'],
    readTime: 9
  },
  {
    id: 6,
    title: 'Node.js 性能优化指南',
    excerpt: '全面介绍Node.js应用的性能优化策略，从代码层面到部署优化。',
    content: '',
    author: '技术博主',
    date: '2023-12-15',
    tags: ['Node.js', '性能优化', '后端'],
    readTime: 14
  }
])

// 计算相关文章
const relatedPosts = computed(() => {
  // 过滤掉当前文章
  const otherPosts = allPosts.value.filter(post => post.id !== props.currentArticleId)
  
  // 计算相关度分数
  const scoredPosts = otherPosts.map(post => {
    let score = 0
    
    // 基于标签的相关度
    const commonTags = post.tags.filter(tag => 
      props.currentTags.some(currentTag => 
        currentTag.toLowerCase() === tag.toLowerCase()
      )
    )
    score += commonTags.length * 10
    
    // 基于发布时间的相关度（越新的文章分数越高）
    const postDate = new Date(post.date)
    const daysDiff = Math.abs(Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24)
    score += Math.max(0, 30 - daysDiff) * 0.1
    
    return {
      ...post,
      score
    }
  })
  
  // 按分数排序并取前3篇
  return scoredPosts
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
})

// 方法
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  })
}

const goToArticle = (articleId: number) => {
  router.push(`/blog/${articleId}`)
}

// 生命周期
onMounted(() => {
  // 相关文章加载动画
  gsap.from('.article-card', {
    opacity: 0,
    y: 20,
    duration: 0.6,
    stagger: 0.1,
    ease: 'power2.out',
    delay: 0.3
  })
})
</script>

<style scoped>
.related-articles {
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  margin-top: 30px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 24px 0;
  padding-bottom: 16px;
  border-bottom: 2px solid #f3f4f6;
}

.articles-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.article-card {
  display: flex;
  align-items: center;
  padding: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #fafafa;
}

.article-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  border-color: #4f46e5;
  background: white;
}

.article-content {
  flex: 1;
  min-width: 0;
}

.article-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-excerpt {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.5;
  margin: 0 0 12px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 8px;
}

.article-meta span {
  position: relative;
}

.article-meta span:not(:last-child)::after {
  content: '•';
  margin-left: 8px;
  color: #d1d5db;
}

.article-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  background: #f3f4f6;
  color: #6b7280;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.article-arrow {
  flex-shrink: 0;
  margin-left: 16px;
  color: #9ca3af;
  transition: all 0.3s ease;
}

.article-card:hover .article-arrow {
  color: #4f46e5;
  transform: translateX(4px);
}

.no-related {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
}

.no-related-icon {
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-related p {
  margin: 0;
  font-size: 14px;
}

@media (max-width: 768px) {
  .related-articles {
    padding: 20px;
    margin-top: 20px;
  }
  
  .article-card {
    padding: 16px;
  }
  
  .article-title {
    font-size: 15px;
  }
  
  .article-excerpt {
    font-size: 13px;
  }
  
  .article-arrow {
    margin-left: 12px;
  }
}
</style>
