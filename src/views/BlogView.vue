<template>
  <div class="blog-container">
    <!-- 标题栏 -->
    <Titlebar />
    
    <!-- 博客主体内容 -->
    <div class="blog-main">
      <!-- 左侧内容区域 -->
      <div class="content-area">
        <!-- 搜索栏 -->
        <!-- <SearchBar @search="handleSearch" /> -->
        
        <!-- 博客内容 -->
        <BlogContent :posts="filteredPosts" />
      </div>
      
      <!-- 右侧个人信息栏 -->
      <div class="sidebar">
        <PersonalInfo />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { gsap } from 'gsap'
import Titlebar from '@/components/layout/Titlebar.vue'
import SearchBar from '@/components/blog/SearchBar.vue'
import BlogContent from '@/components/blog/BlogContent.vue'
import PersonalInfo from '@/components/blog/PersonalInfo.vue'
import SupabaseService from '@/services/supabaseService'

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
  const tl = gsap.timeline()
  tl.from('.blog-main', {
    opacity: 0,
    y: 50,
    duration: 1,
    delay: 0.5
  })
  tl.from('.content-area', {
    opacity: 0,
    x: -50,
    duration: 0.8
  }, '-=0.5')
  tl.from('.sidebar', {
    opacity: 0,
    x: 50,
    duration: 0.8
  }, '-=0.8')
})

// 过滤后的文章列表（适配BlogContent所需结构）
const filteredPosts = computed(() => {
  // 适配Article为BlogPost结构
  const adapt = (article: Article) => ({
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    content: article.content,
    author: article.author_id, // 可根据author_id查用户表，这里直接用id
    date: article.created_at,
    tags: [], // 你可以根据实际业务扩展tags字段
    readTime: article.read_time ?? 0
  })
  const list = articles.value.map(adapt)
  if (!searchKeyword.value) {
    return list
  }
  return list.filter(post =>
    post.title.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
    post.excerpt.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

console.log(filteredPosts)  

// 处理搜索
const handleSearch = (keyword: string) => {
  searchKeyword.value = keyword
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



.scrollable::-webkit-scrollbar {
  display: none;
}

.blog-main {
  display: flex;
  width: 100%;
  margin: 20px 0 auto;
  gap: 25px;
  min-height: calc(100vh - 140px);
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

  .sidebar {
    max-width: none;
  }
}
</style>
