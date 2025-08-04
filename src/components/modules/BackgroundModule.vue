<template>
  <div class="background-module">
    <div class="peopleModel-filter">
      <PeopleModel />
    </div>
  </div>
</template>

<script setup lang="ts">
import PeopleModel from '@/components/common/peopleModel.vue'
import { onMounted } from 'vue'

// 背景模块的配置
interface BackgroundConfig {
  blur?: number
  opacity?: number
  zIndex?: number
}

const props = withDefaults(defineProps<{
  config?: BackgroundConfig
}>(), {
  config: () => ({
    blur: 3,
    opacity: 1,
    zIndex: -1
  })
})

// 暴露背景控制方法给父组件
const emit = defineEmits<{
  backgroundReady: []
  backgroundError: [error: Error]
}>()

onMounted(() => {
  try {
    // 背景模块初始化完成
    emit('backgroundReady')
  } catch (error) {
    emit('backgroundError', error as Error)
  }
})
</script>

<style scoped>
.background-module {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: v-bind('props.config.zIndex');
  pointer-events: none;
}

.peopleModel-filter {
  position: fixed;
  width: 100%;
  height: 100%;
  filter: blur(v-bind('props.config.blur + "px"'));
  opacity: v-bind('props.config.opacity');
  z-index: inherit;
}
</style>
