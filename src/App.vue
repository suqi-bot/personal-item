<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { ref } from 'vue'
import Loading from './components/Loading.vue'

const loadingRef = ref()
</script>

<template>
  <Loading ref="loadingRef" />
  <RouterView />
</template>

<style scoped>

</style>
