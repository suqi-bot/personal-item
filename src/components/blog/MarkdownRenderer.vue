<template>
  <div class="markdown-content" v-html="renderedContent"></div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import MarkdownIt from 'markdown-it'
import markdownItHighlightjs from 'markdown-it-highlightjs'


const props = defineProps<{
  content: string
}>()

const md = MarkdownIt({html: true, breaks: true})
            .use(markdownItHighlightjs, {
                inline: true,
                code: true,
                auto: false,
            });

// 添加图片渲染规则
md.renderer.rules.image = function (tokens, idx, options, env, self) {
  const token = tokens[idx]
  const srcIndex = token.attrIndex('src')
  const altIndex = token.attrIndex('alt')
  
  if (srcIndex >= 0 && token.attrs) {
    token.attrs[srcIndex][1] = token.attrs[srcIndex][1].replace(/\s/g, '%20')
  }
  
  return self.renderToken(tokens, idx, options)
}


const renderedContent = computed(() => {
  if (!props.content) return ''
  return md.render(props.content)
})


onMounted(() => {
  // 添加复制按钮点击事件
  document.querySelectorAll('.markdown-content pre').forEach(pre => {
    const button = document.createElement('button')
    button.className = 'copy-button'
    button.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm-1 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7l-2-2zm0 16H8V7h8v12z"/>
      </svg>
    `
    button.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.innerText
      if (code) {
        try {
          await navigator.clipboard.writeText(code)
          button.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
            </svg>
          `
          setTimeout(() => {
            button.innerHTML = `
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm-1 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7l-2-2zm0 16H8V7h8v12z"/>
              </svg>
            `
          }, 2000)
        } catch (err) {
          console.error('Failed to copy text: ', err)
        }
      }
    })
    pre.appendChild(button)
  })
})
</script>

<style scoped>
.markdown-content {
  line-height: 1.8;
  color: #374151;
  font-size: 16px;
}

/* 代码块样式 */
.markdown-content :deep(pre) {
  background: #f6f8fa;
  color: #000;
  padding: 24px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 20px 0;
  font-family: 'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  position: relative;
}

.markdown-content :deep(pre code) {
  background: none;
  color: inherit;
  padding: 0;
  font-size: inherit;
  display: block;
}

/* 复制按钮样式 */
.markdown-content :deep(.copy-button) {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  padding: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 1;
}

.markdown-content :deep(pre:hover .copy-button) {
  opacity: 1;
}

.markdown-content :deep(.copy-button:hover) {
  background: rgba(255, 255, 255, 0.2);
}

/* 代码高亮样式 */
.markdown-content :deep(.hljs) {
  display: block;
  overflow-x: auto;
  padding: 1em;
}

.markdown-content :deep(.hljs-keyword),
.markdown-content :deep(.hljs-selector-tag),
.markdown-content :deep(.hljs-selector-id),
.markdown-content :deep(.hljs-selector-class) {
  color: #569CD6;
}

.markdown-content :deep(.hljs-string),
.markdown-content :deep(.hljs-number),
.markdown-content :deep(.hljs-regexp) {
  color: #D69D85;
}

.markdown-content :deep(.hljs-comment) {
  color: #6A9955;
}

.markdown-content :deep(.hljs-function),
.markdown-content :deep(.hljs-class) {
  color: #4F46E5;
}

.markdown-content :deep(.hljs-variable),
.markdown-content :deep(.hljs-template-variable) {
  color: #E06C75;
}

.markdown-content :deep(.hljs-attribute) {
  color: #98C379;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .markdown-content {
    font-size: 15px;
  }

  .markdown-content :deep(pre) {
    position: relative;
    padding: 16px;
    font-size: 13px;
    border-radius: 4px;
  }
}
</style>

