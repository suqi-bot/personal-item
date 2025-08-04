<template>
    <div class="bar">

        <div class="nav">
            <ul>
                <li><router-link to="/">首页</router-link></li>
                <li><router-link to="/blog">博客</router-link></li>
                <li><router-link to="/about">关于</router-link></li>
                <li><a>我的</a></li>
                <div class="line"></div>
            </ul>
        </div>
    </div>
</template>
<script setup lang="ts">
import { gsap } from 'gsap';
import { onMounted } from 'vue';

onMounted(()=>{
    // 检查是否已经播放过动画
    const hasPlayedAnimation = sessionStorage.getItem('titlebar-animation-played')

    // 只在会话期间首次加载时播放动画
    if (!hasPlayedAnimation) {
        sessionStorage.setItem('titlebar-animation-played', 'true')

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
    }
})

</script>
<style scoped>
    .bar{
        height: 60px;
        width: 100%;
        position: relative;
        display: flex;
        font-size: 18px;
        z-index: 10; /* 确保导航栏在3D模型之上 */
        border-bottom: 1px solid #121212;
        box-sizing: border-box;
    }

    .nav{
        top:0;
        right: 0;
        position: absolute;
        height: 100%;
        width: 30%;
        min-width: 200px;

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

    .nav ul li .router-link-active,
    .nav ul li .router-link-exact-active {
        color: #4f46e5;
        font-weight: 600;
    }

    .nav ul .line{
        position: absolute;
        bottom: 0;
        left: 0;
        width: calc((100%/4)*1);
        height: 10px;
        border-radius: 2px;
        transition: .5s;
    }

    .nav ul li:nth-child(1):hover~.line{
        left: calc((100%/4)*0);
        background-color: rgb(100, 100, 100);
      
    }

    .nav ul li:nth-child(2):hover~.line{
        left: calc((100%/4)*1);
        background-color: rgb(5, 255, 59);
    }

    .nav ul li:nth-child(3):hover~.line{
        left: calc((100%/4)*2);
        background-color: rgb(227, 243, 4);
    }

    .nav ul li:nth-child(4):hover~.line{
        left: calc((100%/4)*3);
        background-color: rgb(0, 4, 255);
    }
</style>
