<template>
  <div class="comment-section">
    <div class="comment-header">
      <h3>评论 ({{ comments.length }})</h3>
    </div>

    <!-- 评论表单 -->
    <div class="comment-form">
      <div class="form-header">
        <h4>发表评论</h4>
      </div>
      <form @submit.prevent="submitComment">
        <div class="form-group">
          <input
            v-model="newComment.author"
            type="text"
            placeholder="您的姓名"
            required
            class="form-input"
          />
        </div>
        <div class="form-group">
          <input
            v-model="newComment.email"
            type="email"
            placeholder="邮箱地址（不会公开）"
            required
            class="form-input"
          />
        </div>
        <div class="form-group">
          <textarea
            v-model="newComment.content"
            placeholder="写下您的评论..."
            required
            rows="4"
            class="form-textarea"
          ></textarea>
        </div>
        <button type="submit" class="submit-btn" :disabled="isSubmitting">
          <svg v-if="isSubmitting" class="loading-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span v-else>发表评论</span>
          <span v-if="isSubmitting">发表中...</span>
        </button>
      </form>
    </div>

    <!-- 评论列表 -->
    <div class="comment-list">
      <div v-if="comments.length === 0" class="empty-comments">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <p>还没有评论，来发表第一个评论吧！</p>
      </div>

      <div v-else>
        <div
          v-for="comment in comments"
          :key="comment.id"
          class="comment-item"
        >
          <div class="comment-avatar">
            <div class="avatar-circle">
              {{ comment.author.charAt(0).toUpperCase() }}
            </div>
          </div>
          <div class="comment-content">
            <div class="comment-meta">
              <span class="comment-author">{{ comment.author }}</span>
              <span class="comment-date">{{ formatDate(comment.date) }}</span>
            </div>
            <div class="comment-text">
              {{ comment.content }}
            </div>
            <div class="comment-actions">
              <button @click="likeComment(comment.id)" class="action-btn" :class="{ liked: comment.isLiked }">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7 22H4C3.46957 22 2.96086 21.7893 2.58579 21.4142C2.21071 21.0391 2 20.5304 2 20V13C2 12.4696 2.21071 11.9609 2.58579 11.5858C2.96086 11.2107 3.46957 11 4 11H7M14 9V5C14 4.20435 13.6839 3.44129 13.1213 2.87868C12.5587 2.31607 11.7956 2 11 2L7 11V22H18.28C18.7623 22.0055 19.2304 21.8364 19.5979 21.524C19.9654 21.2116 20.2077 20.7769 20.28 20.3L21.66 11.3C21.7035 11.0134 21.6842 10.7207 21.6033 10.4423C21.5225 10.1638 21.3821 9.90629 21.1919 9.68751C21.0016 9.46873 20.7661 9.29393 20.5016 9.17522C20.2371 9.0565 19.9499 8.99672 19.66 9H14Z" :stroke="comment.isLiked ? 'none' : 'currentColor'" :fill="comment.isLiked ? 'currentColor' : 'none'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                {{ comment.likes }}
              </button>
              <button @click="replyToComment(comment.id)" class="action-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 21L12 12L21 21M12 12V2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                回复
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { gsap } from 'gsap'

// 评论类型定义
interface Comment {
  id: number
  author: string
  email: string
  content: string
  date: string
  likes: number
  isLiked: boolean
}

// 新评论表单数据
interface NewComment {
  author: string
  email: string
  content: string
}

const props = defineProps<{
  articleId: number
}>()

// 响应式数据
const comments = ref<Comment[]>([])
const newComment = ref<NewComment>({
  author: '',
  email: '',
  content: ''
})
const isSubmitting = ref(false)

// 模拟评论数据
const mockComments: Comment[] = [
  {
    id: 1,
    author: '张三',
    email: 'zhangsan@example.com',
    content: '这篇文章写得很好，对Vue 3的Composition API讲解得很清楚，学到了很多！',
    date: '2024-01-16T10:30:00Z',
    likes: 5,
    isLiked: false
  },
  {
    id: 2,
    author: '李四',
    email: 'lisi@example.com',
    content: '感谢分享，特别是关于响应式引用的部分，解决了我一直以来的困惑。',
    date: '2024-01-16T14:20:00Z',
    likes: 3,
    isLiked: false
  }
]

// 方法
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 1) {
    return '1天前'
  } else if (diffDays < 7) {
    return `${diffDays}天前`
  } else {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }
}

const submitComment = async () => {
  if (!newComment.value.author || !newComment.value.email || !newComment.value.content) {
    return
  }
  
  isSubmitting.value = true
  
  try {
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const comment: Comment = {
      id: Date.now(),
      author: newComment.value.author,
      email: newComment.value.email,
      content: newComment.value.content,
      date: new Date().toISOString(),
      likes: 0,
      isLiked: false
    }
    
    comments.value.unshift(comment)
    
    // 重置表单
    newComment.value = {
      author: '',
      email: '',
      content: ''
    }
    
    // 动画效果
    setTimeout(() => {
      gsap.from('.comment-item:first-child', {
        opacity: 0,
        y: -20,
        duration: 0.5,
        ease: 'power2.out'
      })
    }, 50)
    
  } catch (error) {
    console.error('提交评论失败:', error)
    alert('评论提交失败，请稍后重试')
  } finally {
    isSubmitting.value = false
  }
}

const likeComment = (commentId: number) => {
  const comment = comments.value.find(c => c.id === commentId)
  if (comment) {
    comment.isLiked = !comment.isLiked
    comment.likes += comment.isLiked ? 1 : -1
  }
}

const replyToComment = (commentId: number) => {
  const comment = comments.value.find(c => c.id === commentId)
  if (comment) {
    newComment.value.content = `@${comment.author} `
    // 滚动到评论表单
    document.querySelector('.comment-form')?.scrollIntoView({ behavior: 'smooth' })
  }
}

// 获取评论数据
const fetchComments = async () => {
  try {
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // 根据文章ID获取对应评论（这里简化处理）
    if (props.articleId === 1) {
      comments.value = [...mockComments]
    }
  } catch (error) {
    console.error('获取评论失败:', error)
  }
}

// 生命周期
onMounted(async () => {
  await fetchComments()
  
  // 评论加载动画
  gsap.from('.comment-item', {
    opacity: 0,
    y: 20,
    duration: 0.6,
    stagger: 0.1,
    ease: 'power2.out'
  })
})
</script>

<style scoped>
.comment-section {
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  margin-top: 30px;
}

.comment-header {
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.comment-header h3 {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.comment-form {
  margin-bottom: 40px;
  padding: 24px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.form-header {
  margin-bottom: 20px;
}

.form-header h4 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.form-group {
  margin-bottom: 16px;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  background: white;
  transition: all 0.3s ease;
  font-family: inherit;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
  line-height: 1.5;
}

.submit-btn {
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.submit-btn:hover:not(:disabled) {
  background: #4338ca;
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.comment-list {
  margin-top: 30px;
}

.empty-comments {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}

.empty-icon {
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-comments p {
  margin: 0;
  font-size: 16px;
}

.comment-item {
  display: flex;
  gap: 16px;
  padding: 20px 0;
  border-bottom: 1px solid #f3f4f6;
}

.comment-item:last-child {
  border-bottom: none;
}

.comment-avatar {
  flex-shrink: 0;
}

.avatar-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 18px;
}

.comment-content {
  flex: 1;
  min-width: 0;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.comment-author {
  font-weight: 600;
  color: #1f2937;
  font-size: 14px;
}

.comment-date {
  color: #6b7280;
  font-size: 13px;
}

.comment-text {
  color: #374151;
  line-height: 1.6;
  margin-bottom: 12px;
  font-size: 15px;
}

.comment-actions {
  display: flex;
  gap: 16px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 6px;
}

.action-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.action-btn.liked {
  color: #4f46e5;
}

@media (max-width: 768px) {
  .comment-section {
    padding: 20px;
    margin-top: 20px;
  }

  .comment-form {
    padding: 20px;
  }

  .comment-item {
    gap: 12px;
  }

  .avatar-circle {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }

  .comment-actions {
    flex-wrap: wrap;
    gap: 12px;
  }
}
</style>
