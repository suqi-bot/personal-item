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

// 博客文章数据类型
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

// 搜索关键词
const searchKeyword = ref('')

// 模拟博客文章数据
const blogPosts = ref<BlogPost[]>([
  {
    id: 1,
    title: 'Vue 3 Composition API 深度解析',
    excerpt: '深入了解Vue 3的Composition API，掌握现代Vue开发的核心概念和最佳实践。',
    content: '这是一篇关于Vue 3 Composition API的详细文章...',
    author: '技术博主',
    date: '2024-01-15',
    tags: ['Vue', 'JavaScript', '前端'],
    readTime: 8
  },
  {
    id: 2,
    title: 'TypeScript 进阶技巧分享',
    excerpt: '分享一些TypeScript的高级用法和技巧，提升代码质量和开发效率。',
    content: '这是一篇关于TypeScript进阶技巧的文章...',
    author: '技术博主',
    date: '2024-01-10',
    tags: ['TypeScript', '编程技巧'],
    readTime: 12
  },
  {
    id: 3,
    title: '现代前端工程化实践',
    excerpt: '探讨现代前端开发中的工程化实践，包括构建工具、代码规范、自动化部署等。',
    content: '这是一篇关于前端工程化的文章...',
    author: '技术博主',
    date: '2024-01-05',
    tags: ['前端工程化', 'Vite', 'CI/CD'],
    readTime: 15
  },
  {
    id: 4,
    title: 'CSS Grid 布局完全指南',
    excerpt: '全面介绍CSS Grid布局系统，从基础概念到高级应用，助你掌握现代布局技术。',
    content: '这是一篇关于CSS Grid的详细指南...',
    author: '技术博主',
    date: '2023-12-28',
    tags: ['CSS', '布局', '前端'],
    readTime: 10
  }
])

// 过滤后的文章列表
const filteredPosts = computed(() => {
  if (!searchKeyword.value) {
    return blogPosts.value
  }
  
  return blogPosts.value.filter(post => 
    post.title.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
    post.excerpt.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
    post.tags.some(tag => tag.toLowerCase().includes(searchKeyword.value.toLowerCase()))
  )
})

// 处理搜索
const handleSearch = (keyword: string) => {
  searchKeyword.value = keyword
}

// 页面动画
onMounted(() => {
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
