# 页面模块化架构说明

## 模块结构

### 1. BackgroundModule.vue
- **功能**: 管理3D背景模型
- **特性**: 
  - 可配置模糊度、透明度、层级
  - 事件通知机制
  - 响应式配置

### 2. HeroSection.vue
- **功能**: 主要内容展示区域
- **特性**:
  - GSAP动画集成
  - 可配置动画参数
  - 暴露动画控制方法
  - 事件发射机制

### 3. LayoutModule.vue
- **功能**: 页面布局管理
- **特性**:
  - 灵活的布局配置
  - 支持侧边栏、头部、底部
  - 插槽系统
  - 响应式设计

## 使用方式

```vue
<template>
  <div class="page-container">
    <!-- 背景模块 -->
    <BackgroundModule 
      :config="backgroundConfig"
      @background-ready="onBackgroundReady"
    />

    <!-- 布局模块 -->
    <LayoutModule :config="layoutConfig">
      <template #main>
        <HeroSection 
          ref="heroRef"
          :animation-config="animationConfig"
          @animation-complete="onAnimationComplete"
        />
      </template>
    </LayoutModule>
  </div>
</template>
```

## 优势

1. **模块化**: 每个功能独立封装，便于维护
2. **可复用**: 模块可在不同页面中复用
3. **可配置**: 通过props配置模块行为
4. **事件驱动**: 模块间通过事件通信
5. **响应式**: 支持不同屏幕尺寸
6. **性能优化**: 按需加载和渲染

## 扩展建议

1. 添加更多功能模块（如ProjectsSection、AboutSection等）
2. 实现模块的懒加载
3. 添加模块间的数据共享机制
4. 集成状态管理（Pinia）
5. 添加模块的单元测试
