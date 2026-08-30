<template>
  <div ref="host" class="rainy-store" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RainyStoreDiorama } from '@/scene/rainyStore'

const host = ref<HTMLElement>()
let diorama: RainyStoreDiorama | null = null

onMounted(() => {
  if (host.value) diorama = new RainyStoreDiorama(host.value)
})

onBeforeUnmount(() => {
  diorama?.dispose()
  diorama = null
})
</script>

<style scoped>
.rainy-store {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #05070f;
  cursor: grab;
  touch-action: none;
}
.rainy-store:active {
  cursor: grabbing;
}
</style>
