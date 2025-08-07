import { ref, computed, onMounted, onUnmounted, readonly } from 'vue'
import { supabase } from '@/lib/supabase'
import type { User, Session, AuthError } from '@supabase/supabase-js'

/**
 * Supabase认证和状态管理Composable
 */
export function useSupabase() {
  // 响应式状态
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const loading = ref(true)
  const error = ref<AuthError | null>(null)

  // 计算属性
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.user_metadata?.role === 'admin')

  /**
   * 获取当前会话
   */
  const getSession = async () => {
    try {
      loading.value = true
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        error.value = sessionError
        return
      }

      session.value = currentSession
      user.value = currentSession?.user ?? null
    } catch (err) {
      console.error('获取会话失败:', err)
      error.value = err as AuthError
    } finally {
      loading.value = false
    }
  }

  /**
   * 注册用户
   */
  const signUp = async (email: string, password: string, metadata?: any) => {
    try {
      loading.value = true
      error.value = null
      
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      })

      if (signUpError) {
        error.value = signUpError
        return { data: null, error: signUpError }
      }

      return { data, error: null }
    } catch (err) {
      console.error('注册失败:', err)
      error.value = err as AuthError
      return { data: null, error: err as AuthError }
    } finally {
      loading.value = false
    }
  }

  /**
   * 用户登录
   */
  const signIn = async (email: string, password: string) => {
    try {
      loading.value = true
      error.value = null
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) {
        error.value = signInError
        return { data: null, error: signInError }
      }

      return { data, error: null }
    } catch (err) {
      console.error('登录失败:', err)
      error.value = err as AuthError
      return { data: null, error: err as AuthError }
    } finally {
      loading.value = false
    }
  }

  /**
   * 用户登出
   */
  const signOut = async () => {
    try {
      loading.value = true
      error.value = null
      
      const { error: signOutError } = await supabase.auth.signOut()
      
      if (signOutError) {
        error.value = signOutError
        return { error: signOutError }
      }

      user.value = null
      session.value = null
      
      return { error: null }
    } catch (err) {
      console.error('登出失败:', err)
      error.value = err as AuthError
      return { error: err as AuthError }
    } finally {
      loading.value = false
    }
  }

  /**
   * 重置密码
   */
  const resetPassword = async (email: string) => {
    try {
      loading.value = true
      error.value = null
      
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (resetError) {
        error.value = resetError
        return { error: resetError }
      }

      return { error: null }
    } catch (err) {
      console.error('重置密码失败:', err)
      error.value = err as AuthError
      return { error: err as AuthError }
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新用户信息
   */
  const updateProfile = async (updates: any) => {
    try {
      loading.value = true
      error.value = null
      
      const { data, error: updateError } = await supabase.auth.updateUser(updates)

      if (updateError) {
        error.value = updateError
        return { data: null, error: updateError }
      }

      user.value = data.user
      return { data, error: null }
    } catch (err) {
      console.error('更新用户信息失败:', err)
      error.value = err as AuthError
      return { data: null, error: err as AuthError }
    } finally {
      loading.value = false
    }
  }

  // 监听认证状态变化
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, currentSession) => {
      session.value = currentSession
      user.value = currentSession?.user ?? null
      loading.value = false
    }
  )

  // 组件挂载时获取会话
  onMounted(() => {
    getSession()
  })

  // 组件卸载时清理订阅
  onUnmounted(() => {
    subscription.unsubscribe()
  })

  return {
    // 状态
    user: readonly(user),
    session: readonly(session),
    loading: readonly(loading),
    error: readonly(error),
    
    // 计算属性
    isAuthenticated,
    isAdmin,
    
    // 方法
    getSession,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile
  }
} 