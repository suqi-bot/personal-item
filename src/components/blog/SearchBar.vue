<template>
  <div class="search-container">
    <div class="search-box">
      <div class="search-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <input
        v-model="searchInput"
        type="text"
        placeholder="搜索文章标题、内容或标签... (Ctrl+K)"
        class="search-input"
        @input="handleInput"
        @keyup.enter="handleSearch"
        ref="searchInputRef"
      />
      <div class="shortcut-hint">
        <kbd>Ctrl</kbd> + <kbd>K</kbd>
      </div>
      <button 
        v-if="searchInput"
        @click="clearSearch"
        class="clear-btn"
        type="button"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    
    <!-- 搜索建议 -->
    <div v-if="showSuggestions && suggestions.length > 0" class="suggestions">
      <div class="suggestions-header">热门搜索</div>
      <div 
        v-for="suggestion in suggestions" 
        :key="suggestion"
        @click="selectSuggestion(suggestion)"
        class="suggestion-item"
      >
        {{ suggestion }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { gsap } from 'gsap'

// 定义事件
const emit = defineEmits<{
  search: [keyword: string]
}>()

// 响应式数据
const searchInput = ref('')
const showSuggestions = ref(false)
const searchInputRef = ref<HTMLInputElement>()

// 搜索建议数据
const popularTags = ref([
  'Vue', 'TypeScript', 'JavaScript', '前端工程化', 
  'CSS', '布局', 'React', 'Node.js', 'Vite', 'Webpack'
])

// 计算搜索建议
const suggestions = computed(() => {
  if (!searchInput.value) {
    return popularTags.value.slice(0, 5)
  }
  
  return popularTags.value.filter(tag => 
    tag.toLowerCase().includes(searchInput.value.toLowerCase())
  ).slice(0, 5)
})

// 处理输入
const handleInput = () => {
  showSuggestions.value = true
  // 实时搜索（防抖）
  clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    emit('search', searchInput.value)
  }, 300)
}

// 搜索防抖定时器
const searchTimeout = ref<number>()

// 处理搜索
const handleSearch = () => {
  showSuggestions.value = false
  emit('search', searchInput.value)
}

// 选择建议
const selectSuggestion = (suggestion: string) => {
  searchInput.value = suggestion
  showSuggestions.value = false
  emit('search', suggestion)
}

// 清除搜索
const clearSearch = () => {
  searchInput.value = ''
  showSuggestions.value = false
  emit('search', '')
}

// 点击外部关闭建议
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target.closest('.search-container')) {
    showSuggestions.value = false
  }
}

// 快捷键处理
const handleKeydown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault()
    searchInputRef.value?.focus()
  }
}

// 组件挂载时的动画
onMounted(() => {
  gsap.from('.search-box', {
    opacity: 0,
    y: -20,
    duration: 0.6,
    ease: 'back.out(1.7)'
  })

  // 添加全局点击事件监听
  document.addEventListener('click', handleClickOutside)
  // 添加快捷键监听
  document.addEventListener('keydown', handleKeydown)
})

// 组件卸载时清理
import { onUnmounted } from 'vue'
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value)
  }
})
</script>

<style scoped>
.search-container {
  position: relative;
  margin-bottom: 40px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  background: white;
  border-radius: 30px;
  padding: 16px 28px;
  box-shadow: 0 6px 30px rgba(0, 0, 0, 0.12);
  transition: all 0.3s ease;
  border: 2px solid transparent;
  min-height: 60px;
}

.search-box:focus-within {
  box-shadow: 0 6px 30px rgba(0, 0, 0, 0.15);
  border-color: #4f46e5;
  transform: translateY(-2px);
}

.search-icon {
  color: #6b7280;
  margin-right: 12px;
  transition: color 0.3s ease;
}

.search-box:focus-within .search-icon {
  color: #4f46e5;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 18px;
  color: #1f2937;
  background: transparent;
  font-weight: 500;
}

.search-input::placeholder {
  color: #9ca3af;
}

.clear-btn {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-btn:hover {
  background: #f3f4f6;
  color: #ef4444;
}

.shortcut-hint {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 12px;
  opacity: 0.6;
  font-size: 12px;
}

.shortcut-hint kbd {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  font-family: monospace;
  color: #6b7280;
}

.suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  margin-top: 8px;
  overflow: hidden;
  z-index: 100;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.suggestions-header {
  padding: 12px 20px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.suggestion-item {
  padding: 12px 20px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  color: #374151;
  font-size: 14px;
}

.suggestion-item:hover {
  background: #f3f4f6;
  color: #4f46e5;
}

.suggestion-item:last-child {
  border-bottom: none;
}

@media (max-width: 768px) {
  .search-box {
    padding: 10px 16px;
  }
  
  .search-input {
    font-size: 14px;
  }
}
</style>
