<template>
  <div class="blog-container">
    <!-- 动态背景 -->
    <BlogBackground />
    
    <!-- 标题栏 -->
    <Titlebar />
    
    <!-- 博客主体内容 -->
    <div class="blog-main">
      <!-- 左侧内容区域 -->
      <div class="content-area">
        <!-- 搜索栏 -->
        <SearchBar @search="handleSearch" />
        
        <!-- 博客内容 -->
        <BlogContent ref="contentRef" :posts="filteredPosts" />
      </div>
      
      <!-- 右侧个人信息栏 -->
      <div class="sidebar">
        <PersonalInfo 
          ref="personalInfoRef"
          :articles="articles" 
          @search="handleSearch"
          @filter-month="handleMonthFilter"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { gsap } from 'gsap'
import Titlebar from '@/components/layout/Titlebar.vue'
import BlogBackground from '@/components/modules/BlogBackground.vue'
import SearchBar from '@/components/blog/SearchBar.vue'
import BlogContent from '@/components/blog/BlogContent.vue'
import PersonalInfo from '@/components/blog/PersonalInfo.vue'
import SupabaseService from '@/services/supabaseService'

// 子组件引用（外层动画完成后触发内层入场）
const contentRef = ref<InstanceType<typeof BlogContent>>()
const personalInfoRef = ref<InstanceType<typeof PersonalInfo>>()

// Supabase articles表类型
interface Article {
  id: number
  title: string
  content: string
  excerpt: string
  author_id: string
  created_at: string
  updated_at: string
  published: boolean
  read_time: number
  likes_count: number
}

// 搜索关键词
const searchKeyword = ref('')
// 归档月份筛选（YYYY-MM）
const selectedMonth = ref('')

// 文章数据
const articles = ref<Article[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// 获取文章列表
const fetchArticles = async () => {
  loading.value = true
  error.value = null
  const { data, error: fetchError } = await SupabaseService.dbService.select('articles',"*")
  
  if (fetchError) {
    error.value = fetchError.message
  } else if (data && Array.isArray(data)) {
    // 添加类型检查，确保data是数组类型
    articles.value = (data as unknown as Article[]).filter(a => a.published)
  }
  loading.value = false
}


onMounted(() => {
  fetchArticles()

  // 外层动画：整体 → 左侧内容 → 右侧栏，依次模糊滑出
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
  tl.from('.blog-main', {
    opacity: 0,
    y: 40,
    filter: 'blur(10px)',
    duration: 0.6,
    delay: 0.1,
    clearProps: 'transform, opacity, filter'
  })
  tl.from('.content-area', {
    opacity: 0,
    x: -50,
    filter: 'blur(8px)',
    duration: 0.55,
    clearProps: 'transform, opacity, filter'
  }, '+=0.05')
  tl.from('.sidebar', {
    opacity: 0,
    x: 50,
    filter: 'blur(8px)',
    duration: 0.55,
    clearProps: 'transform, opacity, filter'
  }, '+=0.05')
  // 外层就绪后，触发内层动画（卡片 / 个人信息）
  tl.add(() => {
    contentRef.value?.playEntrance()
    personalInfoRef.value?.playEntrance()
  }, '+=0.1')
})

// 过滤后的文章列表（适配BlogContent所需结构）
const filteredPosts = computed(() => {
  // 适配Article为BlogPost结构
  const adapt = (article: Article) => ({
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    content: article.content,
    author: 'SuQi',
    date: article.created_at,
    tags: [], // 你可以根据实际业务扩展tags字段
    readTime: article.read_time ?? 0
  })
  let list = articles.value.map(adapt)

  // 归档月份筛选
  if (selectedMonth.value) {
    list = list.filter(post =>
      post.date.substring(0, 7) === selectedMonth.value
    )
  }

  // 关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    list = list.filter(post =>
      post.title.toLowerCase().includes(keyword) ||
      post.excerpt.toLowerCase().includes(keyword)
    )
  }

  return list
})

// 处理搜索（与归档月份筛选叠加生效）
const handleSearch = (keyword: string) => {
  searchKeyword.value = keyword
}

// 处理归档月份筛选（与搜索叠加生效）
const handleMonthFilter = (month: string) => {
  selectedMonth.value = month
}
</script>

<style scoped>

  

.blog-container {
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

.blog-main {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  margin: 20px 0 auto;
  gap: 25px;
  min-height: calc(100vh - 140px);
  padding-left: 24px;
  box-sizing: border-box;
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

@media (max-width: 768px) {
  .blog-main {
    flex-direction: column;
    padding: 10px;
  }

  /* 移动端不显示右侧个人信息栏 */
  .sidebar {
    display: none;
  }
}
</style>
