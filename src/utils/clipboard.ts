/**
 * 通用剪贴板工具函数
 * 提供跨浏览器的复制功能支持
 */

/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @param successCallback 成功回调
 * @param errorCallback 错误回调
 */
export const copyToClipboard = async (
  text: string,
  successCallback?: () => void,
  errorCallback?: (error: any) => void
): Promise<boolean> => {
  try {
    // 优先使用现代 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      successCallback?.()
      return true
    } else {
      // 降级到兼容性方案
      return fallbackCopyTextToClipboard(text, successCallback, errorCallback)
    }
  } catch (error) {
    console.error('现代 Clipboard API 失败，尝试兼容性方案:', error)
    // 如果现代API失败，尝试兼容性方案
    return fallbackCopyTextToClipboard(text, successCallback, errorCallback)
  }
}

/**
 * 兼容性复制函数（用于不支持 Clipboard API 的浏览器）
 * @param text 要复制的文本
 * @param successCallback 成功回调
 * @param errorCallback 错误回调
 */
const fallbackCopyTextToClipboard = (
  text: string,
  successCallback?: () => void,
  errorCallback?: (error: any) => void
): boolean => {
  const textArea = document.createElement('textarea')
  textArea.value = text
  
  // 避免滚动到页面底部
  textArea.style.top = '0'
  textArea.style.left = '0'
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  textArea.style.pointerEvents = 'none'
  
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  
  try {
    const successful = document.execCommand('copy')
    if (successful) {
      successCallback?.()
      return true
    } else {
      const error = new Error('document.execCommand("copy") 返回 false')
      errorCallback?.(error)
      return false
    }
  } catch (err) {
    console.error('兼容性复制失败:', err)
    errorCallback?.(err)
    return false
  } finally {
    document.body.removeChild(textArea)
  }
}

/**
 * 检查浏览器是否支持现代 Clipboard API
 */
export const isClipboardSupported = (): boolean => {
  return !!(navigator.clipboard && navigator.clipboard.writeText)
}

/**
 * 检查浏览器是否支持原生分享 API
 */
export const isShareSupported = (): boolean => {
  return !!(navigator.share)
}
