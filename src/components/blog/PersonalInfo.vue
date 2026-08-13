<template>
  <div class="personal-info" :class="{ 'entrance-hidden': !entranceStarted }">
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
            <span class="stat-number">{{ stats.posts }}</span>
            <span class="stat-label">文章</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{{ stats.reads }}</span>
            <span class="stat-label">总阅读</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{{ stats.likes }}</span>
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
    <div v-if="popularTags.length > 0" class="widget">
      <h4 class="widget-title">热门标签</h4>
      <div class="tag-cloud">
        <span 
          v-for="tag in popularTags" 
          :key="tag.name"
          :class="['tag-item', `size-${tag.size}`, { active: tag.name === selectedTag }]"
          @click="searchTag(tag.name)"
        >
          {{ tag.name }}
        </span>
      </div>
    </div>
    
    <!-- 归档 -->
    <div v-if="archiveData.length > 0" class="widget">
      <h4 class="widget-title">文章归档</h4>
      <div class="archive-list">
        <div 
          v-for="archive in archiveData" 
          :key="archive.month"
          :class="['archive-item', { active: archive.month === selectedMonth }]"
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
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { gsap } from 'gsap'
import SocialIcons from '@/components/icons/SocialIcons.vue'
import { dbService } from '@/services/supabaseService'
import gitIcon from '@/assets/gitIcon.png'

// 文章类型（与 Supabase articles 表字段一致）
interface Article {
  id: number
  title: string
  content: string
  excerpt: string
  created_at: string
  updated_at: string
  published: boolean
  read_time: number
  likes_count: number
}

// 接收文章数据（可选：由父组件传入，否则组件自行拉取）
const props = defineProps<{
  articles?: Article[]
}>()

// 事件：点击标签搜索 / 点击归档月份筛选
const emit = defineEmits<{
  (e: 'search', keyword: string): void
  (e: 'filter-month', month: string): void
}>()

// 自行拉取的文章数据（父组件未传时使用）
const fetchedArticles = ref<Article[]>([])

// 实际使用的文章列表
const articlesList = computed(() => props.articles ?? fetchedArticles.value)

// 个人资料（无独立数据表，使用静态配置）
const githubAvatarUrl = 'https://github.com/suqi-bot.png'

const profileData = ref({
  name: 'SuQi',
  title: '全栈开发工程师',
  bio: '专注后端与前端技术分享，热爱编程与游戏开发。',
  avatar: gitIcon,
  socialLinks: [
    { name: 'github', url: 'https://github.com/suqi-bot' },
    { name: 'bilibili', url: 'https://space.bilibili.com/186931222' }
  ]
})

// 预加载 GitHub 头像：成功则替换默认图标，失败则保持默认图标
function loadGithubAvatar() {
  const img = new Image()
  img.onload = () => {
    profileData.value.avatar = githubAvatarUrl
  }
  img.src = githubAvatarUrl
}

// 统计：文章数、总阅读、总点赞（从文章数据计算）
const stats = computed(() => {
  const likes = articlesList.value.reduce((sum, a) => sum + (a.likes_count || 0), 0)
  const reads = articlesList.value.reduce((sum, a) => sum + (a.read_time || 0), 0)
  return { posts: articlesList.value.length, likes, reads }
})

// 从文章标题统计关键词作为热门标签
const popularTags = computed(() => {
  const KEYWORDS = ['C#', 'SpringBoot', 'Vuex', 'Hollow Knight', 'Java', 'Spring', 'Vue']
  const counts = new Map<string, number>()

  articlesList.value.forEach((article) => {
    KEYWORDS.forEach((keyword) => {
      if (article.title.includes(keyword)) {
        counts.set(keyword, (counts.get(keyword) || 0) + 1)
      }
    })
  })

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, size: Math.min(3, Math.max(1, count)) }))
})

// 归档：按文章创建月份聚合
const archiveData = computed(() => {
  const map = new Map<string, number>()

  articlesList.value.forEach((article) => {
    const key = article.created_at.substring(0, 7)
    map.set(key, (map.get(key) || 0) + 1)
  })

  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, count]) => ({
      month: `${Number(month.substring(0, 4))}年${Number(month.substring(5, 7))}月`,
      key: month,
      count
    }))
})

// 当前选中的归档月份（高亮）
const selectedMonth = ref('')
// 当前选中的热门标签（高亮）
const selectedTag = ref('')

// 处理头像加载错误（兜底：显示默认图标）
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.src = gitIcon
}

// 搜索标签（再次点击已选中标签则取消搜索，可与归档叠加）
const searchTag = (tagName: string) => {
  if (selectedTag.value === tagName) {
    selectedTag.value = ''
    emit('search', '')
    return
  }
  selectedTag.value = tagName
  emit('search', tagName)
}

// 按月份筛选（再次点击已选中月份则取消筛选，可与标签叠加）
const filterByMonth = (month: string) => {
  if (selectedMonth.value === month) {
    selectedMonth.value = ''
    emit('filter-month', '')
    return
  }
  const target = archiveData.value.find((item) => item.month === month)
  selectedMonth.value = month
  emit('filter-month', target?.key || '')
}

// 入场控制：由父组件在外层动画完成后触发
const entranceTriggered = ref(false)
const widgetsAnimated = ref(false)
// 外层动画播完前隐藏内容（保留占位布局）
const entranceStarted = ref(false)

// 个人卡片内部元素逐个入场（模糊 + 上浮柔和过渡）
const animateProfile = () => {
  const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } })
  tl.from('.profile-card', {
    opacity: 0, y: 24, filter: 'blur(8px)', duration: 0.655,
    clearProps: 'transform, opacity, filter'
  })
  tl.from('.avatar-section', {
    opacity: 0, scale: 0.85, y: 12, filter: 'blur(6px)', duration: 0.4
  }, '-=0.18')
  tl.from('.name', {
    opacity: 0, y: 10, filter: 'blur(4px)', duration: 0.4
  }, '-=0.22')
  tl.from('.title', {
    opacity: 0, y: 10, filter: 'blur(4px)', duration: 0.4
  }, '-=0.22')
  tl.from('.bio', {
    opacity: 0, y: 10, filter: 'blur(4px)', duration: 0.4
  }, '-=0.22')
  tl.from('.stats', {
    opacity: 0, y: 12, filter: 'blur(5px)', duration: 0.6555
  }, '-=0.22')
  tl.from('.social-links', {
    opacity: 0, y: 10, filter: 'blur(4px)', duration: 0.4
  }, '-=0.18')
}

// 标签 / 归档：容器先入，内部条目逐个细碎出现
const animateWidgets = () => {
  if (widgetsAnimated.value) return
  const tagItems = gsap.utils.toArray<HTMLElement>('.personal-info .tag-item')
  const archiveItems = gsap.utils.toArray<HTMLElement>('.personal-info .archive-item')
  if (!tagItems.length && !archiveItems.length) return
  widgetsAnimated.value = true

  const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } })
  tl.from('.widget', {
    opacity: 0, y: 16, filter: 'blur(6px)', duration: 0.4,
    clearProps: 'transform, opacity, filter'
  })
  if (tagItems.length) {
    tl.from(tagItems, {
      opacity: 0, y: 8, scale: 0.88, filter: 'blur(3px)', duration: 0.3, stagger: 0.03
    }, '-=0.12')
  }
  if (archiveItems.length) {
    tl.from(archiveItems, {
      opacity: 0, x: -14, filter: 'blur(3px)', duration: 0.3, stagger: 0.04
    }, '-=0.15')
  }
}

// 内层入场动画：由父组件在外层动画完成后触发
const playEntrance = () => {
  if (entranceStarted.value) return
  entranceTriggered.value = true
  entranceStarted.value = true
  nextTick(() => {
    animateProfile()
    animateWidgets()
  })
}

// 数据就绪后补播 widget 动画（入场已触发但数据晚到时）
watch(() => articlesList.value.length, (length) => {
  if (length > 0 && entranceTriggered.value) {
    nextTick(() => animateWidgets())
  }
})

defineExpose({ playEntrance })

// 组件挂载：父组件未传文章数据时自行拉取
onMounted(async () => {
  loadGithubAvatar()

  if (!props.articles || props.articles.length === 0) {
    const { data, error } = await dbService.select('articles', '*')
    if (!error && Array.isArray(data)) {
      fetchedArticles.value = (data as unknown as Article[]).filter((a) => a.published)
    }
  }

  // 无父级协调时的兜底：自动显示内容（如详情页单独使用）
  window.setTimeout(() => {
    if (!entranceTriggered.value) playEntrance()
  }, 1200)
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

/* 外层动画完成前隐藏内容（保留占位布局） */
.personal-info.entrance-hidden {
  visibility: hidden;
}

.profile-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  text-align: center;
  top: 20px;
  border: 1px solid #e5e7eb;
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.profile-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border-color: #111827;
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
  background: #111827;
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
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.widget:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border-color: #111827;
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
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
  font-weight: 500;
}

.tag-item.size-1 { font-size: 12px; }
.tag-item.size-2 { font-size: 14px; }
.tag-item.size-3 { font-size: 16px; }

.tag-item:hover {
  background: #111827;
  color: white;
  transform: scale(1.05);
}

.tag-item.active {
  background: #111827;
  color: white;
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

.archive-item.active {
  background: #f3f4f6;
}

.archive-item.active .archive-month {
  color: #111827;
  font-weight: 600;
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
