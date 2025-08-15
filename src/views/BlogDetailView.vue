<template>
  <div class="blog-detail-container">
    <!-- 标题栏 -->
    <Titlebar />

    <!-- 文章详情主体 -->
    <div class="blog-detail-main">
      <!-- 返回按钮 -->
      <div class="back-navigation">
        <button @click="goBack" class="back-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
          返回博客列表
        </button>
      </div>

      <!-- 文章内容区域 -->
      <div class="content-area">
        <!-- 文章头部 -->
        <article class="article-container" v-if="article">
          <header class="article-header">
            <h1 class="article-title">{{ article.title }}</h1>
            <div class="article-meta">
              <div class="meta-left">
                <span class="author">{{ article.author }}</span>
                <span class="date">{{ formatDate(article.created_at) }}</span>
                <span class="read-time">{{ article.read_time }} 阅读次数</span>
              </div>
              <div class="meta-right">
                <button @click="toggleLike" class="like-btn" :class="{ liked: isLiked }">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M20.84 4.61C20.3292 4.099 19.7228 3.69364 19.0554 3.41708C18.3879 3.14052 17.6725 2.99817 16.95 2.99817C16.2275 2.99817 15.5121 3.14052 14.8446 3.41708C14.1772 3.69364 13.5708 4.099 13.06 4.61L12 5.67L10.94 4.61C9.9083 3.5783 8.50903 2.9987 7.05 2.9987C5.59096 2.9987 4.19169 3.5783 3.16 4.61C2.1283 5.6417 1.5487 7.04097 1.5487 8.5C1.5487 9.95903 2.1283 11.3583 3.16 12.39L12 21.23L20.84 12.39C21.351 11.8792 21.7563 11.2728 22.0329 10.6053C22.3095 9.93789 22.4518 9.22248 22.4518 8.5C22.4518 7.77752 22.3095 7.06211 22.0329 6.39467C21.7563 5.72723 21.351 5.1208 20.84 4.61V4.61Z"
                      :stroke="isLiked ? 'none' : 'currentColor'" :fill="isLiked ? 'currentColor' : 'none'"
                      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  {{ likeCount }}
                </button>
                <button @click="shareArticle" class="share-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M4 12V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V12"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M16 6L12 2L8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                      stroke-linejoin="round" />
                    <path d="M12 2V15" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                      stroke-linejoin="round" />
                  </svg>
                  分享
                </button>
              </div>
            </div>
            <div class="article-tags">
              <span v-for="tag in article.tags" :key="tag" class="tag" @click="searchByTag(tag)">
                #{{ tag }}
              </span>
            </div>
          </header>

          <!-- 文章内容 -->
          <div class="article-content">
            <MarkdownRenderer :content="article.content" :options="{
              html: true,
              linkify: true,
              typographer: true,
              breaks: true,
              image: {
                lazy: true,
                loading: 'lazy'
              }
            }" />
          </div>

          <!-- 文章底部 -->
          <footer class="article-footer">
            <div class="article-actions">
              <button @click="toggleLike" class="action-btn" :class="{ active: isLiked }">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M20.84 4.61C20.3292 4.099 19.7228 3.69364 19.0554 3.41708C18.3879 3.14052 17.6725 2.99817 16.95 2.99817C16.2275 2.99817 15.5121 3.14052 14.8446 3.41708C14.1772 3.69364 13.5708 4.099 13.06 4.61L12 5.67L10.94 4.61C9.9083 3.5783 8.50903 2.9987 7.05 2.9987C5.59096 2.9987 4.19169 3.5783 3.16 4.61C2.1283 5.6417 1.5487 7.04097 1.5487 8.5C1.5487 9.95903 2.1283 11.3583 3.16 12.39L12 21.23L20.84 12.39C21.351 11.8792 21.7563 11.2728 22.0329 10.6053C22.3095 9.93789 22.4518 9.22248 22.4518 8.5C22.4518 7.77752 22.3095 7.06211 22.0329 6.39467C21.7563 5.72723 21.351 5.1208 20.84 4.61V4.61Z"
                    :stroke="isLiked ? 'none' : 'currentColor'" :fill="isLiked ? 'currentColor' : 'none'"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                {{ isLiked ? '已喜欢' : '喜欢' }}
              </button>
              <button @click="shareArticle" class="action-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M4 12V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V12"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M16 6L12 2L8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                    stroke-linejoin="round" />
                  <path d="M12 2V15" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                    stroke-linejoin="round" />
                </svg>
                分享文章
              </button>
            </div>
          </footer>
        </article>

        <!-- 评论区域 -->
        <!--  <CommentSection v-if="article" :article-id="article.id" /> -->

        <!-- 相关文章 -->
        <!-- <RelatedArticles v-if="article" :current-article-id="article.id" :current-tags="article.tags || []" /> -->
        <!-- 加载状态 -->
        <div v-else-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>正在加载文章...</p>
        </div>

        <!-- 错误状态 -->
        <div v-else class="error-state">
          <div class="error-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
              <path d="M15 9L9 15M9 9L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </div>
          <h3>文章未找到</h3>
          <p>抱歉，您要查看的文章不存在或已被删除。</p>
          <button @click="goBack" class="error-back-btn">返回博客列表</button>
        </div>
      </div>

      <!-- 右侧边栏 -->
      <div class="sidebar">
        <PersonalInfo />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gsap } from 'gsap'
import Titlebar from '@/components/layout/Titlebar.vue'
import PersonalInfo from '@/components/blog/PersonalInfo.vue'
import MarkdownRenderer from '@/components/blog/MarkdownRenderer.vue'
import CommentSection from '@/components/blog/CommentSection.vue'
import RelatedArticles from '@/components/blog/RelatedArticles.vue'
import { dbService } from '@/services/supabaseService'

// 文章类型定义
interface BlogPost {
  id: number
  title: string
  excerpt: string
  content: string
  author: string
  created_at: string
  likes_count: number
  tags: string[]
  read_time: number
  views_count: number  // 添加这一行
}


interface DatabaseArticle {
  read_time: number
  id: number
  title: string
  excerpt: string
  content: string
  author: string
  created_at: string
  likes_count: number | null
  tags: string[] | null
  views_count: number | null
}


const route = useRoute()
const router = useRouter()

// 响应式数据
const article = ref<BlogPost | null>(null)
const loading = ref(true)
const isLiked = ref(false)
const likeCount = ref(0)


// 方法
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const goBack = () => {
  router.push('/blog')
}


const toggleLike = async () => {
  if (!article.value) return

  try {
    const newLikeCount = isLiked.value ? likeCount.value - 1 : likeCount.value + 1
    const { error } = await dbService.update('articles',
      { likes_count: newLikeCount },
      'id',
      article.value.id
    )

    if (error) throw error

    isLiked.value = !isLiked.value
    likeCount.value = newLikeCount
  } catch (error) {
    console.error('更新点赞数量失败:', error)
    // 可以在这里添加错误提示
  }
}


const shareArticle = () => {
  if (navigator.share && article.value) {
    navigator.share({
      title: article.value.title,
      text: article.value.excerpt,
      url: window.location.href
    })
  } else {
    // 降级方案：复制链接到剪贴板
    navigator.clipboard.writeText(window.location.href)
    alert('文章链接已复制到剪贴板')
  }
}

const searchByTag = (tag: string) => {
  router.push(`/blog?tag=${encodeURIComponent(tag)}`)
}

// 获取文章数据
const fetchArticle = async () => {
  loading.value = true

  try {
    const articleId = parseInt(route.params.id as string)
    if (!articleId) {
      article.value = null
      return
    }

    const { data, error } = await dbService.select('articles', '*', { id: articleId })

    if (error) {
      throw error
    }

    if (data && data.length > 0) {
      // 规范化数据，确保所有必需字段都有默认值
      const articleData = data[0] as unknown as DatabaseArticle;
      article.value = {
        ...articleData,
        tags: articleData.tags || [],
        likes_count: articleData.likes_count || 0,
        views_count: articleData.views_count || 0,
        read_time: articleData.read_time || 0  // 添加这一行
      }

      likeCount.value = article.value.likes_count

      await dbService.update('articles', {
        read_time: (articleData.read_time || 0) + 1
      }, 'id', articleId)
    } else {
      article.value = null
    }
  } catch (error) {
    console.error('获取文章失败:', error)
    article.value = null
  } finally {
    loading.value = false
  }
}




// 生命周期
onMounted(async () => {
  await fetchArticle()

  /* // 页面加载动画
  if (article.value) {
    gsap.timeline()
      .from('.back-navigation', {
        opacity: 0,
        y: -20,
        duration: 0.6
      })
      .from('.article-header', {
        opacity: 0,
        y: 30,
        duration: 0.8
      }, '-=0.3')
      .from('.article-content', {
        opacity: 0,
        y: 20,
        duration: 0.6
      }, '-=0.4')
      .from('.sidebar', {
        opacity: 0,
        x: 50,
        duration: 0.6
      }, '-=0.6')
  } */
})

onBeforeUnmount(() => {
  // 清理可能存在的异步操作或订阅
  article.value = null
})

</script>

<style scoped>
.blog-detail-container {
  height: 100vh;
  width: 100vw;
  position: absolute;
  top: 0;
  left: 0;
  background-color: #f5f5f5;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.blog-detail-container::-webkit-scrollbar {
  display: none;
}

.blog-detail-main {
  display: flex;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  gap: 30px;
  min-height: calc(100vh - 140px);
}

.back-navigation {
  grid-column: 1 / -1;
  margin-bottom: 20px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 16px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
  font-weight: 500;
}

.back-btn:hover {
  background: #f9fafb;
  border-color: #4f46e5;
  color: #4f46e5;
  transform: translateX(-2px);
}

.content-area {
  flex: 3;
  min-height: calc(100vh - 140px);
}

.sidebar {
  flex: 1;
  max-width: 400px;
  min-width: 350px;
}

.article-container {
  background: white;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  margin-bottom: 30px;
}

.article-header {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 30px;
  margin-bottom: 40px;
}

.article-title {
  font-size: 36px;
  font-weight: 800;
  color: #1f2937;
  line-height: 1.2;
  margin: 0 0 20px 0;
}

.article-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.meta-left {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #6b7280;
}

.meta-left span {
  position: relative;
}

.meta-left span:not(:last-child)::after {
  content: '•';
  margin-left: 12px;
  color: #d1d5db;
}

.meta-right {
  display: flex;
  gap: 12px;
}

.like-btn,
.share-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f3f4f6;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
}

.like-btn:hover,
.share-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.like-btn.liked {
  background: #fef2f2;
  color: #dc2626;
}

.article-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag {
  background: #f3f4f6;
  color: #4b5563;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tag:hover {
  background: #4f46e5;
  color: white;
}

.article-content {
  line-height: 1.8;
  max-width: 40vw;
  color: #374151;
  font-size: 16px;
}

.article-content img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 16px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.article-content a {
  color: #4f46e5;
  text-decoration: none;
  transition: color 0.3s ease;
}

.article-content a:hover {
  color: #4338ca;
  text-decoration: underline;
}

.article-content a {
  color: #4f46e5;
  text-decoration: none;
  transition: color 0.3s ease;
}

.article-content a:hover {
  color: #4338ca;
  text-decoration: underline;
}

.content-text {
  max-width: none;
}

.content-text h1 {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  margin: 30px 0 20px 0;
  line-height: 1.3;
}

.content-text h2 {
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
  margin: 25px 0 15px 0;
  line-height: 1.3;
}

.content-text h3 {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 20px 0 12px 0;
  line-height: 1.3;
}

.content-text p {
  margin-bottom: 16px;
}

.content-text code {
  background: #f3f4f6;
  color: #e11d48;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
}

.content-text pre {
  background: #1f2937;
  color: #f9fafb;
  padding: 20px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 20px 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
}

.content-text pre code {
  background: none;
  color: inherit;
  padding: 0;
}

.content-text strong {
  font-weight: 600;
  color: #1f2937;
}

.content-text em {
  font-style: italic;
  color: #4b5563;
}

.article-footer {
  border-top: 1px solid #e5e7eb;
  padding-top: 30px;
  margin-top: 40px;
}

.article-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px 24px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 16px;
  font-weight: 500;
}

.action-btn:hover {
  border-color: #4f46e5;
  color: #4f46e5;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
}

.action-btn.active {
  background: #4f46e5;
  border-color: #4f46e5;
  color: white;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f4f6;
  border-top: 4px solid #4f46e5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.error-icon {
  color: #ef4444;
  margin-bottom: 20px;
  opacity: 0.7;
}

.error-state h3 {
  color: #1f2937;
  margin-bottom: 8px;
  font-size: 20px;
}

.error-state p {
  color: #6b7280;
  margin-bottom: 24px;
}

.error-back-btn {
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.error-back-btn:hover {
  background: #4338ca;
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .blog-detail-main {
    flex-direction: column;
    padding: 15px;
    gap: 20px;
  }

  .sidebar {
    max-width: none;
    min-width: auto;
  }

  .article-container {
    padding: 24px;
  }

  .article-title {
    font-size: 28px;
  }

  .article-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .meta-left {
    flex-wrap: wrap;
  }

  .article-actions {
    flex-direction: column;
  }

  .action-btn {
    justify-content: center;
  }
}
</style>
