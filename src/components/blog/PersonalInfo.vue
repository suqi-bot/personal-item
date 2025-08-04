<template>
  <div class="personal-info">
    <!-- 个人资料卡片 -->
    <div class="profile-card">
      <div class="avatar-section">
        <div class="avatar">
          <img 
            :src="profileData.avatar" 
            :alt="profileData.name"
            @error="handleImageError"
          />
        </div>
        <div class="online-status"></div>
      </div>
      
      <div class="profile-details">
        <h3 class="name">{{ profileData.name }}</h3>
        <p class="title">{{ profileData.title }}</p>
        <p class="bio">{{ profileData.bio }}</p>
        
        <div class="stats">
          <div class="stat-item">
            <span class="stat-number">{{ profileData.stats.posts }}</span>
            <span class="stat-label">文章</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{{ profileData.stats.followers }}</span>
            <span class="stat-label">关注者</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{{ profileData.stats.likes }}</span>
            <span class="stat-label">点赞</span>
          </div>
        </div>
        
        <div class="social-links">
          <a
            v-for="social in profileData.socialLinks"
            :key="social.name"
            :href="social.url"
            :title="social.name"
            class="social-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            <SocialIcons :name="social.name" />
          </a>
        </div>
      </div>
    </div>
    
    <!-- 热门标签 -->
    <div class="widget">
      <h4 class="widget-title">热门标签</h4>
      <div class="tag-cloud">
        <span 
          v-for="tag in popularTags" 
          :key="tag.name"
          :class="['tag-item', `size-${tag.size}`]"
          @click="searchTag(tag.name)"
        >
          {{ tag.name }}
        </span>
      </div>
    </div>
    
    <!-- 最新评论 -->
    <!-- <div class="widget">
      <h4 class="widget-title">最新评论</h4>
      <div class="recent-comments">
        <div 
          v-for="comment in recentComments" 
          :key="comment.id"
          class="comment-item"
        >
          <div class="comment-avatar">
            <img :src="comment.avatar" :alt="comment.author" />
          </div>
          <div class="comment-content">
            <div class="comment-author">{{ comment.author }}</div>
            <div class="comment-text">{{ comment.text }}</div>
            <div class="comment-time">{{ formatTime(comment.time) }}</div>
          </div>
        </div>
      </div>
    </div> -->
    
    <!-- 归档 -->
    <div class="widget">
      <h4 class="widget-title">文章归档</h4>
      <div class="archive-list">
        <div 
          v-for="archive in archiveData" 
          :key="archive.month"
          class="archive-item"
          @click="filterByMonth(archive.month)"
        >
          <span class="archive-month">{{ archive.month }}</span>
          <span class="archive-count">({{ archive.count }})</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { gsap } from 'gsap'
import SocialIcons from '@/components/icons/SocialIcons.vue'

// 个人资料数据
const profileData = ref({
  name: '技术博主',
  title: '全栈开发工程师',
  bio: '专注于前端技术分享，热爱编程与创新，致力于用技术改变世界。',
  avatar: '/api/placeholder/120/120',
  stats: {
    posts: 42,
    followers: 1234,
    likes: 5678
  },
  socialLinks: [
    { name: 'github', url: 'https://github.com' },
    { name: 'twitter', url: 'https://twitter.com' },
    { name: 'linkedin', url: 'https://linkedin.com' },
    { name: 'email', url: 'mailto:contact@example.com' }
  ]
})

// 热门标签
const popularTags = ref([
  { name: 'Vue', size: 3 },
  { name: 'JavaScript', size: 2 },
  { name: 'TypeScript', size: 2 },
  { name: 'CSS', size: 1 },
  { name: '前端工程化', size: 2 },
  { name: 'React', size: 1 },
  { name: 'Node.js', size: 1 },
  { name: 'Vite', size: 1 }
])

// 最新评论
/* const recentComments = ref([
  {
    id: 1,
    author: '小明',
    avatar: '/api/placeholder/32/32',
    text: '这篇文章写得很好，学到了很多！',
    time: '2024-01-15T10:30:00Z'
  },
  {
    id: 2,
    author: '小红',
    avatar: '/api/placeholder/32/32',
    text: '感谢分享，代码示例很清晰。',
    time: '2024-01-14T15:20:00Z'
  },
  {
    id: 3,
    author: '小李',
    avatar: '/api/placeholder/32/32',
    text: '期待更多关于Vue 3的文章！',
    time: '2024-01-13T09:15:00Z'
  }
]) */

// 归档数据
const archiveData = ref([
  { month: '2024年1月', count: 8 },
  { month: '2023年12月', count: 12 },
  { month: '2023年11月', count: 15 },
  { month: '2023年10月', count: 10 }
])



// 处理头像加载错误
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.src = `data:image/svg+xml,${encodeURIComponent(`
    <svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="120" fill="#f3f4f6"/>
      <text x="60" y="60" text-anchor="middle" dy="0.3em" font-family="Arial" font-size="14" fill="#9ca3af">头像</text>
    </svg>
  `)}`
}

// 搜索标签
const searchTag = (tagName: string) => {
  console.log('搜索标签:', tagName)
  // 这里可以触发搜索事件
}

// 按月份筛选
const filterByMonth = (month: string) => {
  console.log('筛选月份:', month)
  // 这里可以触发筛选事件
}

// 格式化时间
const formatTime = (timeString: string) => {
  const time = new Date(timeString)
  const now = new Date()
  const diff = now.getTime() - time.getTime()
  
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (minutes < 60) {
    return `${minutes}分钟前`
  } else if (hours < 24) {
    return `${hours}小时前`
  } else {
    return `${days}天前`
  }
}

// 组件挂载动画
onMounted(() => {
  const tl = gsap.timeline()
  
  tl.from('.profile-card', {
    opacity: 0,
    y: 30,
    duration: 0.6
  })
  
  tl.from('.widget', {
    opacity: 0,
    y: 20,
    duration: 0.4,
    stagger: 0.1
  }, '-=0.3')
})
</script>

<style scoped>
.personal-info {
  display: flex;
  flex-direction: column;
  gap: 24px;
  box-sizing: border-box;
  padding-right: 20px;
}

.profile-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  text-align: center;
  top: 20px;
  border: 1px solid #e5e7eb;
  transition: all 0.3s ease;
}

.profile-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border-color: #4f46e5;
}

.avatar-section {
  position: relative;
  display: inline-block;
  margin-bottom: 16px;
}

.avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  border: 4px solid #e5e7eb;
  transition: border-color 0.3s ease;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.online-status {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 16px;
  height: 16px;
  background: #10b981;
  border: 2px solid white;
  border-radius: 50%;
}

.name {
  margin: 0 0 8px 0;
  font-size: 26px;
  font-weight: 700;
  color: #1f2937;
}

.title {
  margin: 0 0 16px 0;
  color: #6b7280;
  font-size: 16px;
  font-weight: 500;
}

.bio {
  margin: 0 0 24px 0;
  color: #4b5563;
  font-size: 16px;
  line-height: 1.6;
}

.stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 28px;
  padding: 24px 0;
  border-top: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 12px;
  margin-left: -16px;
  margin-right: -16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
  margin-top: 4px;
  font-weight: 500;
}

.social-links {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.social-link {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  transition: all 0.3s ease;
  text-decoration: none;
}

.social-link:hover {
  background: #4f46e5;
  color: white;
  transform: translateY(-2px);
}

.widget {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  top: 20px;
  border: 1px solid #e5e7eb;
  transition: all 0.3s ease;
}

.widget:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border-color: #4f46e5;
}

.widget-title {
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  padding-bottom: 12px;
  border-bottom: 3px solid #f3f4f6;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  background: #f3f4f6;
  color: #4b5563;
  padding: 6px 12px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.tag-item.size-1 { font-size: 12px; }
.tag-item.size-2 { font-size: 14px; }
.tag-item.size-3 { font-size: 16px; }

.tag-item:hover {
  background: #4f46e5;
  color: white;
  transform: scale(1.05);
}

.recent-comments {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comment-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: #f9fafb;
  transition: background-color 0.3s ease;
}

.comment-item:hover {
  background: #f3f4f6;
}

.comment-avatar {
  flex-shrink: 0;
}

.comment-avatar img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.comment-content {
  flex: 1;
  min-width: 0;
}

.comment-author {
  font-weight: 600;
  color: #1f2937;
  font-size: 14px;
  margin-bottom: 2px;
}

.comment-text {
  color: #4b5563;
  font-size: 13px;
  line-height: 1.4;
  margin-bottom: 4px;
}

.comment-time {
  color: #9ca3af;
  font-size: 11px;
}

.archive-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.archive-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.archive-item:hover {
  background: #f3f4f6;
}

.archive-month {
  color: #374151;
  font-size: 14px;
}

.archive-count {
  color: #6b7280;
  font-size: 12px;
}

@media (max-width: 768px) {
  .personal-info {
    gap: 20px;
  }

  .profile-card,
  .widget {
    padding: 20px;
  }

  .stats {
    padding: 16px 0;
  }
}
</style>
