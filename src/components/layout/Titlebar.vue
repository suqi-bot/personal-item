<template>
    <div class="bar">

        <div class="nav">
            <ul ref="navUlRef" @mouseleave="onNavLeave">
                <li v-for="item in navItems" :key="item.path" @mouseenter="onEnter($event, item.index)">
                    <router-link :to="item.path">{{ item.label }}</router-link>
                </li>
                <div class="line" ref="lineRef"></div>
            </ul>
        </div>
    </div>
</template>
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { gsap } from 'gsap';

// 导航项
const navItems = [
    { path: '/', label: '首页' },
    { path: '/blog', label: '博客' },
    { path: '/games', label: '游戏' },
    { path: '/tools', label: '工具' },
    { path: '/about', label: '关于' }
].map((item, index) => ({ ...item, index }))

const route = useRoute()
const navUlRef = ref<HTMLElement>()
const lineRef = ref<HTMLElement>()

// 当前激活路由对应的导航索引
const indexOfPath = (path: string) => {
    const index = navItems.findIndex(item =>
        path === item.path || path.startsWith(item.path + '/')
    )
    return index === -1 ? 0 : index
}

const current = ref(indexOfPath(route.path))

// 移动指示条
const moveLine = (index: number, animated = true) => {
    if (!lineRef.value) return
    const target = { x: `${index * 100}%` }
    if (animated) {
        gsap.to(lineRef.value, { ...target, duration: 0.35, ease: 'power3.out' })
    } else {
        gsap.set(lineRef.value, target)
    }
}

// 悬停导航项：指示条预览移动
const onEnter = (_event: MouseEvent, index: number) => {
    moveLine(index)
}

// 鼠标离开导航：指示条回到当前激活项
const onNavLeave = () => {
    moveLine(current.value)
}

// 路由变化时同步指示条
watch(() => route.path, (path) => {
    current.value = indexOfPath(path)
    moveLine(current.value)
})

onMounted(() => {
    // 初始定位到激活项
    moveLine(current.value, false)

    // 检查是否已经播放过动画
    const hasPlayedAnimation = sessionStorage.getItem('titlebar-animation-played')

    // 只在会话期间首次加载时播放动画
    if (!hasPlayedAnimation) {
        sessionStorage.setItem('titlebar-animation-played', 'true')

        // 导航动画期间隐藏指示条
        gsap.set('.line', { opacity: 0 })

        let tl = gsap.timeline()

        tl.from('.bar',{
            opacity: 0,
            duration: 2,
            x:-innerWidth,
        })

        tl.from('.nav ul li',{
            opacity: 0,
            duration: 1,
            y:100
        },">")

        // 导航动画播完后淡入指示条
        tl.to('.line', {
            opacity: 1,
            duration: 0.6,
            ease: 'power2.out'
        })
    }
})

</script>
<style scoped>
    .bar{
        height: 60px;
        width: 100%;
        position: sticky;
        top: 0;
        display: flex;
        font-size: 18px;
        z-index: 10; /* 确保导航栏在3D模型之上 */
        border-bottom: 1px solid #e5e7eb;
        box-sizing: border-box;
        background: rgba(245, 245, 245, 0.85);
        backdrop-filter: blur(8px);
    }

    .nav{
        top:0;
        right: 0;
        position: absolute;
        height: 100%;
        width: 36%;
        min-width: 300px;

    }
   
    .nav ul{
        padding: 0;
        list-style: none;
        width: 100%;
        height: 100%;
        display: flex;
        overflow: hidden;

    }

    .nav ul li{
        width: 100%;
        text-align: center;
       
    }

    .nav ul li a,
    .nav ul li .router-link-active,
    .nav ul li .router-link-exact-active {
        color: rgb(70, 100, 100);
        font: 100 20px 'Microsoft YaHei';
        display: block;
        width: 100%;
        height: 100%;
        line-height: 60px;
        color: #121212;
        text-decoration: none;
        cursor: pointer;
        transition: color 0.3s ease;
    }

    .nav ul li a:hover {
        color: #111827;
    }

    .nav ul li .router-link-active,
    .nav ul li .router-link-exact-active {
        color: #111827;
        font-weight: 600;
    }

    .nav ul .line{
        position: absolute;
        bottom: 0;
        left: 0;
        width: calc((100%/5)*1);
        height: 4px;
        border-radius: 2px;
        background: linear-gradient(90deg, #111827, #4b5563);
        box-shadow: 0 0 8px rgba(17, 24, 39, 0.4);
        will-change: transform;
    }

    @media (max-width: 768px) {
        .nav {
            width: 100%;
            min-width: 0;
        }

        .nav ul li a {
            font-size: 15px;
            line-height: 60px;
        }

        .nav ul .line {
            height: 3px;
        }
    }
</style>
