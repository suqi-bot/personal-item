<template>
  <div v-if="visible" :class="['loading', { 'loading_out': isOut }]" id="loading">
    <div class="spinner"></div>
  </div>
</template>
<script setup lang="ts">
import { ref, defineExpose } from 'vue';
import gsap from 'gsap';

const visible = ref(true);
const isOut = ref(false);

function loadingIn() {
  visible.value = true;
  isOut.value = false;
}

function loadingOut() {
  isOut.value = true;
  gsap.to('.loading', {
    opacity: 0,
    duration: 1,
    y: -window.innerHeight,
    onComplete: () => {
      visible.value = false;
      isOut.value = false;
    }
  })
}

defineExpose({ loadingIn, loadingOut });
</script>
<style scoped>
.loading {
  width: 100vw;
  height: 100vh;
  background-color: #f5f5f5;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.6s;
  opacity: 1;
}
.loading_out {
  opacity: 0;
  pointer-events: none;
}
.spinner {
  width: 60px;
  height: 60px;
  border: 6px solid #ccc;
  border-top: 6px solid #2196f3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
