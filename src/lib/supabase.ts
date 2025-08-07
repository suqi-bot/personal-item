import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// 从环境变量获取配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mkcqbexvybospanfcawz.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rY3FiZXh2eWJvc3BhbmZjYXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzUzNzUsImV4cCI6MjA3MDExMTM3NX0.CMzer_I2a0QZT9kX-OCMx0kkcX21xHjzXDQJC-W5Py8'

// 验证必要的环境变量
if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL 或密钥未设置，请检查 .env 文件')
}

// 创建Supabase客户端
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'x-application-name': 'personal-item'
    }
  }
})

// 导出数据库类型
export type { Database }

// 导出客户端实例
export default supabase 