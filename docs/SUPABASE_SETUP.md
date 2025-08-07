# Supabase 集成指南

## 概述

本项目已成功集成 Supabase，提供了完整的后端即服务(BaaS)解决方案，包括数据库、认证、存储等功能。

## 安装和配置

### 1. 安装依赖

```bash
npm install @supabase/supabase-js
```

### 2. 环境变量配置

创建 `.env.local` 文件（已添加到 .gitignore）：

```env
# Supabase配置
VITE_SUPABASE_URL=https://mkcqbexvybospanfcawz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rY3FiZXh2eWJvc3BhbmZjYXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzUzNzUsImV4cCI6MjA3MDExMTM3NX0.CMzer_I2a0QZT9kX-OCMx0kkcX21xHjzXDQJC-W5Py8
```

**重要提示：**
- 请将 `your_supabase_anon_key_here` 替换为你的实际 Supabase 匿名密钥
- 可以在 Supabase 项目设置中找到这些值
- 环境变量必须以 `VITE_` 开头才能在 Vite 中使用

### 3. 项目结构

```
src/
├── lib/
│   └── supabase.ts          # Supabase 客户端配置
├── services/
│   └── supabaseService.ts   # 数据库操作服务类
├── composables/
│   └── useSupabase.ts       # 认证状态管理 Composable
└── components/
    └── SupabaseExample.vue  # 使用示例组件
```

## 使用方法

### 1. 基本使用

```typescript
import { supabase } from '@/lib/supabase'

// 直接使用客户端
const { data, error } = await supabase
  .from('your_table')
  .select('*')
```

### 2. 使用服务类

```typescript
import SupabaseService from '@/services/supabaseService'

// 查询数据
const { data, error } = await SupabaseService.query(
  'your_table',
  '*',
  { user_id: userId }
)

// 插入数据
const { data, error } = await SupabaseService.insert('your_table', {
  title: '标题',
  content: '内容'
})

// 更新数据
const { data, error } = await SupabaseService.update(
  'your_table',
  { title: '新标题' },
  { id: 1 }
)

// 删除数据
const { error } = await SupabaseService.delete('your_table', { id: 1 })
```

### 3. 使用认证 Composable

```vue
<script setup lang="ts">
import { useSupabase } from '@/composables/useSupabase'

const {
  user,
  loading,
  error,
  isAuthenticated,
  signIn,
  signOut,
  signUp,
  resetPassword
} = useSupabase()

// 登录
const handleLogin = async () => {
  const { error } = await signIn(email, password)
  if (!error) {
    console.log('登录成功')
  }
}

// 注册
const handleSignUp = async () => {
  const { error } = await signUp(email, password, { name: '用户名' })
  if (!error) {
    console.log('注册成功')
  }
}
</script>
```

## 数据库表结构示例

### 示例表：example_table

```sql
CREATE TABLE example_table (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用行级安全策略
ALTER TABLE example_table ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能访问自己的数据
CREATE POLICY "Users can only access their own data" ON example_table
  FOR ALL USING (auth.uid() = user_id);
```

## 功能特性

### 1. 认证功能
- ✅ 用户注册/登录
- ✅ 密码重置
- ✅ 会话管理
- ✅ 用户信息更新
- ✅ 自动登录状态同步

### 2. 数据库操作
- ✅ 增删改查操作
- ✅ 错误处理
- ✅ 类型安全
- ✅ 批量操作支持

### 3. 文件存储
- ✅ 文件上传
- ✅ 文件下载
- ✅ 公共URL生成

### 4. 实时功能
- ✅ 数据库变更监听
- ✅ 实时数据同步

## 安全最佳实践

### 1. 环境变量
- 永远不要在代码中硬编码敏感信息
- 使用环境变量管理配置
- 确保 `.env.local` 文件已添加到 `.gitignore`

### 2. 行级安全策略
- 为所有表启用 RLS (Row Level Security)
- 创建适当的访问策略
- 定期审查权限设置

### 3. 输入验证
- 始终验证用户输入
- 使用参数化查询防止SQL注入
- 实施适当的错误处理

## 错误处理

```typescript
// 统一的错误处理方式
const { data, error } = await SupabaseService.query('table_name')

if (error) {
  console.error('操作失败:', error.message)
  // 显示用户友好的错误信息
  showErrorMessage(error.message)
  return
}

// 处理成功的数据
console.log('操作成功:', data)
```

## 开发调试

### 1. 启用调试模式

```typescript
// 在开发环境中启用详细日志
if (import.meta.env.DEV) {
  console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
}
```

### 2. 浏览器开发者工具
- 使用 Network 标签页查看 API 请求
- 使用 Console 查看错误信息
- 使用 Application 标签页查看存储的会话

## 部署注意事项

### 1. 生产环境配置
- 确保生产环境的环境变量正确设置
- 使用生产环境的 Supabase 项目
- 配置适当的 CORS 设置

### 2. 性能优化
- 使用适当的索引优化查询性能
- 实施数据分页
- 使用缓存减少重复请求

## 常见问题

### Q: 环境变量不生效？
A: 确保环境变量以 `VITE_` 开头，并重启开发服务器。

### Q: 认证状态不同步？
A: 检查 `useSupabase` Composable 是否正确监听认证状态变化。

### Q: 数据库操作失败？
A: 检查表权限设置和 RLS 策略是否正确配置。

## 更多资源

- [Supabase 官方文档](https://supabase.com/docs)
- [Vue 3 集成指南](https://supabase.com/docs/guides/getting-started/tutorials/with-vue-3)
- [TypeScript 支持](https://supabase.com/docs/guides/api/typescript-support) 