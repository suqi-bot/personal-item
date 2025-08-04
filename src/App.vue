<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { ref } from 'vue'
import Loading from './components/Loading.vue'

const loadingRef = ref()
</script>

<template>
  <RouterView />
</template>

<style scoped>

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  max-width: 100vw;
  max-height: 100vh;
  overflow: hidden;
}

body {
  overflow: hidden;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  position: fixed;
  top: 0;
  left: 0;
}
</style>
