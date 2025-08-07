# Personal Item - Vue 3 个人项目

一个基于 Vue 3 + TypeScript + Vite 构建的现代化个人项目，集成了 Supabase 后端服务。

## 🚀 技术栈

- **前端框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **开发语言**: TypeScript
- **样式**: CSS3 + 现代设计
- **动画**: GSAP
- **3D渲染**: Three.js
- **状态管理**: Pinia
- **路由**: Vue Router
- **后端服务**: Supabase (数据库、认证、存储)

## 📦 项目特性

### 前端特性
- ✅ 现代化 Vue 3 架构
- ✅ TypeScript 类型安全
- ✅ 响应式设计
- ✅ 流畅的动画效果
- ✅ 3D 模型展示
- ✅ 模块化组件设计

### 后端集成 (Supabase)
- ✅ 用户认证系统
- ✅ 数据库操作
- ✅ 文件存储
- ✅ 实时数据同步
- ✅ 行级安全策略

## 🛠️ 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd personal-item
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

创建 `.env.local` 文件：

```env
# Supabase配置
VITE_SUPABASE_URL=https://mkcqbexvybospanfcawz.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**注意**: 请将 `your_supabase_anon_key_here` 替换为你的实际 Supabase 匿名密钥。

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:5173](http://localhost:5173) 查看项目。

## 📁 项目结构

```
personal-item/
├── src/
│   ├── components/          # Vue 组件
│   │   ├── blog/           # 博客相关组件
│   │   ├── common/         # 通用组件
│   │   ├── layout/         # 布局组件
│   │   └── modules/        # 功能模块组件
│   ├── views/              # 页面视图
│   ├── router/             # 路由配置
│   ├── stores/             # Pinia 状态管理
│   ├── lib/                # 第三方库配置
│   │   └── supabase.ts     # Supabase 客户端
│   ├── services/           # 服务层
│   │   └── supabaseService.ts  # Supabase 服务
│   ├── composables/        # Vue Composables
│   │   └── useSupabase.ts  # Supabase 状态管理
│   └── assets/             # 静态资源
├── public/                 # 公共资源
├── docs/                   # 文档
│   └── SUPABASE_SETUP.md   # Supabase 集成指南
└── env.example             # 环境变量示例
```

## 🔧 开发指南

### 代码规范

- 使用 TypeScript 进行类型检查
- 遵循 Vue 3 Composition API 最佳实践
- 组件命名使用 PascalCase
- 函数命名使用 camelCase
- 使用 ESLint 和 Prettier 保持代码风格一致

### 组件开发

```vue
<template>
  <div class="component-name">
    <!-- 组件内容 -->
  </div>
</template>

<script setup lang="ts">
// 组件逻辑
</script>

<style scoped>
/* 组件样式 */
</style>
```

### Supabase 使用

详细的使用指南请参考 [Supabase 集成文档](./docs/SUPABASE_SETUP.md)。

## 🚀 部署

### 构建生产版本

```bash
npm run build
```

### 预览构建结果

```bash
npm run preview
```

## 📚 文档

- [Supabase 集成指南](./docs/SUPABASE_SETUP.md) - 详细的 Supabase 配置和使用说明
- [PC版博客页面说明](./PC版博客页面说明.md) - 博客页面功能说明
- [文章详情页面说明](./文章详情页面说明.md) - 文章详情页面功能说明

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [Vue 3 官方文档](https://vuejs.org/)
- [Vite 官方文档](https://vitejs.dev/)
- [Supabase 官方文档](https://supabase.com/docs)
- [TypeScript 官方文档](https://www.typescriptlang.org/)