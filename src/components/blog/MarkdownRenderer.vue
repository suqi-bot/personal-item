<template>
  <div class="markdown-content" v-html="renderedContent"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
const props = defineProps<{
  content: string
}>()

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
})

// 添加图片渲染规则
md.renderer.rules.image = function (tokens, idx, options, env, self) {
  const token = tokens[idx]
  const srcIndex = token.attrIndex('src')
  const altIndex = token.attrIndex('alt')
  
  if (srcIndex >= 0) {
    token.attrs[srcIndex][1] = token.attrs[srcIndex][1].replace(/\s/g, '%20')
  }
  
  return self.renderToken(tokens, idx, options)
}


const renderedContent = computed(() => {
  if (!props.content) return ''
  return md.render(props.content)
})

</script>

<style scoped>
.markdown-content {
  line-height: 1.8;
  color: #374151;
  font-size: 16px;
}

.markdown-content :deep(h1) {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  margin: 30px 0 20px 0;
  line-height: 1.3;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 10px;
}

.markdown-content :deep(h2) {
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
  margin: 25px 0 15px 0;
  line-height: 1.3;
}

.markdown-content :deep(h3) {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 20px 0 12px 0;
  line-height: 1.3;
}

.markdown-content :deep(p) {
  margin-bottom: 16px;
  line-height: 1.7;
}

.markdown-content :deep(.inline-code) {
  background: #f3f4f6;
  color: #e11d48;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  font-weight: 500;
}

.markdown-content :deep(.code-block) {
  background: #1f2937;
  color: #f9fafb;
  padding: 20px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 20px 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
  border: 1px solid #374151;
}

.markdown-content :deep(.code-block code) {
  background: none;
  color: inherit;
  padding: 0;
  font-size: inherit;
}

.markdown-content :deep(strong) {
  font-weight: 600;
  color: #1f2937;
}

.markdown-content :deep(em) {
  font-style: italic;
  color: #4b5563;
}

.markdown-content :deep(a) {
  color: #4f46e5;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: all 0.3s ease;
}

.markdown-content :deep(a:hover) {
  border-bottom-color: #4f46e5;
}

.markdown-content :deep(ul) {
  margin: 16px 0;
  padding-left: 24px;
}

.markdown-content :deep(li) {
  margin-bottom: 8px;
  line-height: 1.6;
}

.markdown-content :deep(li::marker) {
  color: #4f46e5;
}

/* 代码高亮样式 */
.markdown-content :deep(.language-javascript) {
  color: #f7df1e;
}

.markdown-content :deep(.language-typescript) {
  color: #3178c6;
}

.markdown-content :deep(.language-css) {
  color: #1572b6;
}

.markdown-content :deep(.language-html) {
  color: #e34f26;
}

.markdown-content :deep(.language-vue) {
  color: #4fc08d;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .markdown-content {
    font-size: 15px;
  }

  .markdown-content :deep(h1) {
    font-size: 24px;
  }

  .markdown-content :deep(h2) {
    font-size: 20px;
  }

  .markdown-content :deep(h3) {
    font-size: 18px;
  }

  .markdown-content :deep(.code-block) {
    padding: 16px;
    font-size: 13px;
  }
}
</style>
