<template>
    <div class="body">
        <Titlebar></Titlebar>
        <!-- <Model></Model> -->
        <div class="peopleModel-filter">
            <peopleModel></peopleModel>
        </div>

        <div id="container">

            <section id="section1">
                <div class="split">
                    欢迎来到
                </div>

                <div class="nav-box">
                    <div class="nav-box-background">
                    </div>
                    <div class="text">
                        welcome to my blog
                    </div>
                </div>
                <div class="split">
                    苏柒的个人博客
                </div>

            </section>

        </div>

    </div>
</template>

<script setup lang="ts">
import peopleModel from '@/components/peopleModel.vue';
import { onMounted } from 'vue';
import Titlebar from '@/components/Titlebar.vue';
import Loading from '@/components/Loading.vue';
import { RouterLink } from 'vue-router';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
let tl = gsap.timeline()

function textAnim1() {


    SplitText.create(".split", {
        type: "lines",
        autoSplit: true,
        onSplit: (self) => {
            return gsap.from(self.lines, {
                rotationX: -100,
                transformOrigin: "50% 50% -160px",
                opacity: 0,
                duration: 0.8,
                ease: "power3",
                stagger: 0.25
            });
        }

    });

}


function textAnim2() {
    SplitText.create(".nav-box .text", {
        type: "chars",
        autoSplit: true,
        onSplit: (self) => {
            return gsap.from(self.chars, {
                x: 100,
                opacity: 0,
                stagger: 0.05
            });
        }
    });

}




onMounted(() => {
    tl.add(textAnim1)
    tl.from('.peopleModel', {
        opacity: 0,
        duration: 1,
        y: innerHeight,
    }, "+=0.5")
    
    tl.from('.nav-box', {
        opacity: 0,
        duration: 1,
        width: 0
    }, "+=0.5")
    tl.from('.nav-box .text', {
        opacity: 0,
        duration: 1
    })
    tl.add(textAnim2, "<")



})

</script>

<style scoped>
.body {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    margin: 0;
    padding: 0;
    position: fixed;
    top: 0;
    left: 0;
    background-color: #f5f5f5;
    overflow: hidden;
}

/* 全局样式重置 */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}


.bg-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    top: 0;
    left: 0;
    z-index: -1;
    pointer-events: none;
}

#container {
    width: 100vw;
    height: 80vh;
    position: relative;
    overflow: hidden;
    z-index: 1;
    /* 确保内容在3D模型之上 */
}

#container section {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    font-size: large;
    left: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
}

#section1 {
    display: flex;
    flex-direction: column;
}

.split {
    overflow: hidden;
    font-size: clamp(2rem, 12rem, 5vw);
    text-align: center;
    perspective: 500px;
    color: #121212;
}

peopleModel {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: -2;
    /* 放到背景层 */
    pointer-events: none;
    /* 不阻挡鼠标事件 */
}

.peopleModel-filter {
    position: fixed;
    width: 100%;
    height: 100%;
    filter: blur(3px);
    z-index: -1;
}

.nav-box {
    position: absolute;
    width: 330px;
    height: 35px;
    
    color: white;
    display: flex;
    align-items: center;
}

.nav-box .nav-box-background{
    background-color: #121212;
    width: 100%;
    height: 100%;
    position: absolute;
    z-index: 1;
}

.nav-box .text {
    margin-left: 5px;
    overflow: hidden;
    z-index: 2;
}
</style>