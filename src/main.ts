import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// 路由跳转时控制Loading动画
router.beforeEach((to, from, next) => {
  // 通过事件或全局属性控制Loading显示
  const loading = (app._instance?.refs?.loadingRef as any)
  if (loading && typeof loading.loadingIn === 'function') {
    loading.loadingIn()
  }
  next()
})

router.afterEach(() => {
  const loading = (app._instance?.refs?.loadingRef as any)
  if (loading && typeof loading.loadingOut === 'function') {
    loading.loadingOut()
  }
})

app.mount('#app')
