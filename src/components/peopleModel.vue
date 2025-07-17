<template>
    <div class="peopleModel" ref="containerRef">

    </div>
</template>
<script setup lang="ts">
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { onMounted, onBeforeUnmount, ref, nextTick } from 'vue';

const containerRef = ref<HTMLElement>();
let modelGroup: THREE.Group | null = null;
let renderer: THREE.WebGLRenderer;
let animationId: number;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const scene = new THREE.Scene();

function init() {
    scene.background = null; // 设置为透明背景
    camera.position.set(0, 0, 1.5);
}

function LoadModel() {
    const loader = new GLTFLoader();
    loader.load(
        '/model/people/scene.gltf', 
        function (gltf) {
            modelGroup = gltf.scene;
            console.log('模型加载成功:', gltf);
            
            // 调整模型大小和位置
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // 将模型居中
            gltf.scene.position.sub(center);
            
            // 根据模型大小调整缩放
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxDim;
            gltf.scene.scale.setScalar(scale);
            
            scene.add(modelGroup);
            camera.lookAt(0, 0, 0);
        },
        function (progress) {
            console.log('加载进度:', (progress.loaded / progress.total * 100) + '%');
        },
        function (error) {
            console.error('模型加载失败:', error);
        }
    );
}

function initRender() {
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true // 支持透明背景
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0); // 设置透明背景

    // 使用组件内的容器而不是全局查找
    if (containerRef.value) {
        containerRef.value.appendChild(renderer.domElement);
    }
}

// 动态光源变量
let dynamicLight: THREE.PointLight;
let lightAnimationTime = 0;

function Light() {
    // 环境光
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    
    // 方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // 动态点光源
    dynamicLight = new THREE.PointLight(0xffffff, 5, 10); // 蓝色光源，强度1，范围10
    dynamicLight.position.set(0, 2, 3);
    dynamicLight.castShadow = true;
    scene.add(dynamicLight);
}

// 渲染循环
function animate() {
    animationId = requestAnimationFrame(animate);
    
    // 更新动态光源位置
    if (dynamicLight) {
        lightAnimationTime += 0.02; // 控制动画速度
        
        // 创建圆形轨迹运动
        const radius = 3;
        const height = 2;
        dynamicLight.position.x = Math.sin(lightAnimationTime) * radius;
        dynamicLight.position.z = Math.cos(lightAnimationTime) * radius;
        dynamicLight.position.y = height + Math.sin(lightAnimationTime * 2) * 0.5; // 添加垂直波动
        
        // 可选：改变光源颜色
    }
    
    renderer.render(scene, camera);
}

// 窗口大小调整
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

onMounted(async () => {
    await nextTick(); // 确保DOM已渲染
    
    init();
    Light();
    initRender();
    LoadModel();
    animate(); // 启动渲染循环
    
    window.addEventListener('resize', onWindowResize);
});

onBeforeUnmount(() => {
    // 清理资源
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    window.removeEventListener('resize', onWindowResize);
    if (renderer) {
        renderer.dispose();
    }
});

</script>

<style scoped>
.peopleModel {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    overflow: hidden;
    z-index: -1;
}
</style>
