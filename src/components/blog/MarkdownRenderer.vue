<template>
  <div class="markdown-content" v-html="renderedContent"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  content: string
}>()

const renderedContent = computed(() => {
  if (!props.content) return ''

  let html = props.content

  // 处理代码块（必须在其他处理之前）
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'text'
    return `<pre class="code-block"><code class="language-${language}">${escapeHtml(code.trim())}</code></pre>`
  })

  // 处理行内代码
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // 处理标题
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>')
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>')
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>')

  // 处理粗体和斜体
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')

  // 处理链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

  // 处理图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    // 如果没有提供alt文本，使用"图片"作为默认值
    const altText = alt.trim() || '图片'
    return `<img src="${src}" alt="${altText}" class="markdown-image" loading="lazy">`
  })




  // 处理列表
  html = html.replace(/^\* (.+)$/gim, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')

  // 处理段落（将连续的非HTML行包装在p标签中）
  const lines = html.split('\n')
  const processedLines: string[] = []
  let inParagraph = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line === '') {
      if (inParagraph) {
        processedLines.push('</p>')
        inParagraph = false
      }
      continue
    }

    // 检查是否是HTML标签行
    const isHtmlLine = /^<(h[1-6]|pre|ul|li|code)/.test(line) || /^<\/(h[1-6]|pre|ul|li|code)/.test(line)

    if (isHtmlLine) {
      if (inParagraph) {
        processedLines.push('</p>')
        inParagraph = false
      }
      processedLines.push(line)
    } else {
      if (!inParagraph) {
        processedLines.push('<p>')
        inParagraph = true
      }
      processedLines.push(line)
    }
  }

  if (inParagraph) {
    processedLines.push('</p>')
  }

  return processedLines.join('\n')
})

// HTML转义函数
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
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
