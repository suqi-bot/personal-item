<template>
  <div class="about-container">
    <!-- 动态背景 -->
    <BlogBackground />

    <!-- 标题栏 -->
    <Titlebar />

    <!-- 页面主体 -->
    <div class="about-main">
      <!-- 个人信息卡片 -->
      <section class="card hero-card">
        <div class="hero-left">
          <div class="avatar">
            <img
              v-if="avatarLoaded"
              :src="githubAvatarUrl"
              alt="苏柒"
              @error="avatarError = true"
            />
            <span v-else>Su</span>
          </div>
        </div>
        <div class="hero-right">
          <h1 class="name">苏柒</h1>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">性别</span>
              <span class="info-value">男</span>
            </div>
            <div class="info-item">
              <span class="info-label">邮箱</span>
              <a class="info-value link" href="mailto:3023694259@qq.com">3023694259@qq.com</a>
            </div>
          </div>
        </div>
      </section>

      <!-- 专业技能 -->
      <section class="card">
        <h2 class="section-title">专业技能</h2>
        <div class="skill-grid">
          <div v-for="(skill, index) in skills" :key="index" class="skill-item">
            <span class="skill-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="skill-text">{{ skill }}</span>
          </div>
        </div>
      </section>

      <!-- 个人优势 -->
      <section class="card">
        <h2 class="section-title">个人优势</h2>
        <div class="advantage-list">
          <div v-for="(advantage, index) in advantages" :key="index" class="advantage-item">
            <div class="advantage-tag">{{ advantage.title }}</div>
            <p class="advantage-desc">{{ advantage.desc }}</p>
          </div>
        </div>
      </section>

      <!-- 就职经历 -->
      <section class="card">
        <h2 class="section-title">就职经历</h2>
        <div class="job-item">
          <div class="job-left">
            <div class="job-company">
              <a
                class="job-company-link"
                href="https://qitaimiao.com/"
                target="_blank"
              >杭州液态喵网络科技有限公司</a>
            </div>
            <div class="job-role">游戏程序开发</div>
          </div>
          <div class="job-right">
            <span class="job-period">2026年5月 ~ 至今</span>
          </div>
        </div>
      </section>

      <!-- 项目经历 -->
      <section class="card">
        <h2 class="section-title">项目经历</h2>
        <div class="timeline">
          <div v-for="(project, index) in projects" :key="index" class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="project-head">
                <h3 class="project-name">{{ project.name }}</h3>
                <span v-if="project.period" class="project-period">{{ project.period }}</span>
              </div>
              <div class="project-meta">
                <span class="project-role">{{ project.role }}</span>
                <span class="project-stack">{{ project.stack }}</span>
              </div>
              <p class="project-intro">{{ project.intro }}</p>
              <ul class="project-points">
                <li v-for="(point, pIndex) in project.points" :key="pIndex">{{ point }}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- 教育经历 -->
      <section class="card">
        <h2 class="section-title">教育经历</h2>
        <div class="edu-item">
          <div class="edu-left">
            <div class="edu-school">南京城市职业学院</div>
            <div class="edu-major">软件技术（可视化程序设计）</div>
          </div>
          <div class="edu-right">
            <span class="edu-degree">大专</span>
            <span class="edu-period">2022 - 2025</span>
          </div>
        </div>
      </section>

      <!-- 资格证书 & 荣誉奖项 -->
      <div class="card-grid">
        <section class="card">
          <h2 class="section-title">资格证书</h2>
          <ul class="cert-list">
            <li v-for="(cert, index) in certificates" :key="index" class="cert-item">
              <svg class="cert-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ cert }}
            </li>
          </ul>
        </section>

        <section class="card">
          <h2 class="section-title">荣誉奖项</h2>
          <ul class="cert-list">
            <li v-for="(award, index) in awards" :key="index" class="cert-item">
              <svg class="cert-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ award }}
            </li>
          </ul>
        </section>
      </div>
    </div>
    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { gsap } from 'gsap'
import Titlebar from '@/components/layout/Titlebar.vue'
import BlogBackground from '@/components/modules/BlogBackground.vue'
import SiteFooter from '@/components/layout/SiteFooter.vue'

// 头像：默认文字占位，预加载 GitHub 头像成功后替换
const githubAvatarUrl = 'https://github.com/suqi-bot.png'
const avatarLoaded = ref(false)
const avatarError = ref(false)

function loadGithubAvatar() {
  const img = new Image()
  img.onload = () => {
    avatarLoaded.value = true
  }
  img.onerror = () => {
    avatarError.value = true
  }
  img.src = githubAvatarUrl
}

// 专业技能
const skills = [
  '精通 C#、Unity 引擎，掌握常用设计模式，代码规范整洁',
  '熟练 UGUI 开发，掌握 UI 性能优化方案',
  '具备 Unity 编辑器拓展开发能力，可实现资源导入校验提醒工具',
  '掌握基础算法与数据结构，逻辑思维严谨',
  '掌握 HTML5、CSS3、JavaScript 前端开发技术',
  '熟练使用 Git 版本控制工具'
]

// 个人优势
const advantages = [
  {
    title: '专业背景',
    desc: '计算机软件技术专业，深耕游戏开发方向，持续关注行业新游，多次参与游戏内测，熟悉行业流行设计趋势。'
  },
  {
    title: '游戏积累',
    desc: '深度体验主机、PC、移动端数十款游戏，覆盖 RPG、SLG、类魂、肉鸽、FPS、TPS、FTG 等品类；善于拆解游戏核心趣味点，具备游戏美术与玩法审美。'
  },
  {
    title: '综合素养',
    desc: '自主学习能力强，性格随和协作性好，抗压能力优秀，沟通表达顺畅，主动承担工作，持续学习成长。'
  },
  {
    title: '自研 Demo',
    desc: '独立完成多款游戏 Demo 全流程搭建，美术资源取自网络，覆盖动作、卡牌等玩法类型'
  }
]

// 项目经历
const projects = [
  {
    name: '3D 横版动作冒险游戏',
    role: 'U3D 开发工程师',
    period: '2025.12 - 2026.03',
    stack: 'Unity · C# · Input System · 状态机',
    intro: '自学 Unity 独立开发，参考《血污：夜之仪式》制作 3D 横版闯关冒险游戏',
    points: [
      '完整游戏系统：背包、任务、战斗、商店、剧情对话系统',
      '输入与角色操控：采用 Input System 处理输入，状态机管理玩家/敌人移动、跳跃、冲刺、攻击等动作，优化操作手感',
      '架构设计：使用状态模式区分 idle/run/jump/hurt 等角色状态，降低代码耦合',
      '性能优化：对象池管理子弹、特效；UGUI 无限滚动列表，减少 GC；复用预制体提升资源复用率',
      '数据持久化：Json 本地存储游戏配置数据',
      '动画管理：Animator Controller + 动画事件驱动角色动画表现'
    ]
  },
  {
    name: '抽卡前端页面展示',
    role: '前端开发工程师',
    period: '2023.11 - 2024.07',
    stack: 'HTML5 · CSS3 · JavaScript · Vue2',
    intro: '纯原生 JS 自主编写完整抽卡核心逻辑；CSS 完成页面视觉美化与交互样式；运用 Vue2 生命周期钩子完成页面状态管理',
    points: [
      '项目价值：阶段性落地前端技术栈，独立完成完整交互页面开发'
    ]
  },
  {
    name: 'Blood_Gun 恶魔轮盘',
    role: '独立开发',
    period: '',
    stack: 'HTML5 · Canvas 2D · JavaScript · Node.js · WebSocket',
    intro: '纯 2D 俯视角恶魔轮盘（Buckshot Roulette 风格）——六孔左轮、生死博弈，支持单人挑战 AI 与局域网双人对战，纯原生前端 + Node.js，无需任何构建工具',
    points: [
      '六孔左轮每轮随机装填实弹/空弹，双方各 2 点生命，生命归零即败',
      '拿起枪瞄准射击机制：枪口对准目标点击开枪，打偏不造成伤害并轮到对手回合',
      '道具系统：看破、护盾、退蛋、双倍威力、对决、人格面具、生死弹等',
      '赌局模式（联机专属）：4 卡槽抽卡、对决玩法、换弹动画与抽卡界面',
      'Node.js + WebSocket 实现局域网双人对战，房间列表自动刷新，服务器权威判定',
      '换肤系统按分类自动加载贴图皮肤；程序化音效（机械、枪响、受击、装填）'
    ]
  }
]

// 教育经历
const education = {
  school: '南京城市职业学院',
  major: '软件技术（可视化程序设计）',
  degree: '大专',
  period: '2022 - 2025'
}

// 资格证书
const certificates = [
  '大数据应用开发（Java）职业技能证书',
  'JavaWeb 应用开发职业技能等级证',
  '英语四级',
]

// 荣誉奖项
const awards = [
  '领航杯人工智能竞赛 一等奖',
  '江苏省省技能移动应用设计与开发 三等奖',
  '第五届全球校园人工智能算法精英大赛 省级三等奖',
]

// 入场动画
onMounted(() => {
  loadGithubAvatar()
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
  tl.from('.hero-card', { opacity: 0, y: 40, duration: 0.8, delay: 0.3 })
  tl.from('.card:not(.hero-card)', {
    opacity: 0,
    y: 30,
    duration: 0.7,
    stagger: 0.12
  }, '-=0.3')
})
</script>

<style scoped>
.about-container {
  height: 100vh;
  width: 100vw;
  position: absolute;
  top: 0;
  left: 0;
  background-color: #f5f5f5;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.about-container::-webkit-scrollbar {
  display: none;
}

.about-main {
  position: relative;
  z-index: 1;
  max-width: 1100px;
  margin: 30px auto 40px;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.card {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #e5e7eb;
  position: relative;
  overflow: hidden;
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #111827, #4b5563, #6b7280);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.4s ease;
}

.card:hover::before {
  transform: scaleX(1);
}

/* 个人信息卡片 */
.hero-card {
  display: flex;
  gap: 32px;
  align-items: center;
}

.hero-left {
  flex-shrink: 0;
}

.avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(135deg, #111827, #4b5563);
  color: white;
  font-size: 56px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(17, 24, 39, 0.3);
  overflow: hidden;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-right {
  flex: 1;
  min-width: 0;
}

.name {
  margin: 0 0 20px 0;
  font-size: 34px;
  font-weight: 800;
  color: #1f2937;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f9fafb;
  border-radius: 10px;
  padding: 10px 14px;
  border: 1px solid #eef0f3;
}

.info-label {
  font-size: 13px;
  color: #9ca3af;
  flex-shrink: 0;
}

.info-value {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-value.link {
  color: #111827;
  text-decoration: none;
}

.info-value.link:hover {
  text-decoration: underline;
}

/* 区块标题 */
.section-title {
  margin: 0 0 24px 0;
  font-size: 22px;
  font-weight: 700;
  color: #1f2937;
  padding-bottom: 12px;
  position: relative;
}

.section-title::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 48px;
  height: 3px;
  border-radius: 3px;
  background: linear-gradient(90deg, #111827, #4b5563);
}

/* 专业技能 */
.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.skill-item {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #f9fafb;
  border: 1px solid #eef0f3;
  border-radius: 12px;
  padding: 14px 16px;
  transition: all 0.3s ease;
}

.skill-item:hover {
  border-color: #111827;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(17, 24, 39, 0.1);
}

.skill-index {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #f3f4f6;
  color: #111827;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.skill-text {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
}

/* 个人优势 */
.advantage-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.advantage-item {
  background: #f9fafb;
  border: 1px solid #eef0f3;
  border-radius: 12px;
  padding: 18px;
  transition: all 0.3s ease;
}

.advantage-item:hover {
  border-color: #4b5563;
  box-shadow: 0 6px 16px rgba(17, 24, 39, 0.1);
}

.advantage-tag {
  display: inline-block;
  background: linear-gradient(90deg, #111827, #4b5563);
  color: white;
  font-size: 13px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 16px;
  margin-bottom: 10px;
}

.advantage-desc {
  margin: 0;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.7;
}

/* 项目经历 - 时间线 */
.timeline {
  position: relative;
  padding-left: 28px;
}

.timeline::before {
  content: '';
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 8px;
  width: 2px;
  background: linear-gradient(180deg, #111827, #4b5563, transparent);
}

.timeline-item {
  position: relative;
  padding-bottom: 32px;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-dot {
  position: absolute;
  left: -28px;
  top: 6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  border: 4px solid #111827;
  box-shadow: 0 0 0 4px rgba(17, 24, 39, 0.15);
}

.project-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.project-name {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}

.project-period {
  font-size: 13px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 3px 10px;
  border-radius: 12px;
}

.project-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 10px 0;
}

.project-role {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  background: #f3f4f6;
  padding: 3px 10px;
  border-radius: 12px;
}

.project-stack {
  font-size: 13px;
  color: #6b7280;
  background: #f9fafb;
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid #eef0f3;
}

.project-intro {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.7;
}

.project-points {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-points li {
  position: relative;
  padding-left: 18px;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.7;
}

.project-points li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4b5563;
}

/* 就职经历 */
.job-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  background: #f9fafb;
  border: 1px solid #eef0f3;
  border-radius: 12px;
  padding: 20px 24px;
  transition: all 0.3s ease;
}

.job-item:hover {
  border-color: #111827;
}

.job-company {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
}

.job-company-link {
  color: inherit;
  text-decoration: none;
}

.job-company-link:hover {
  text-decoration: underline;
}

.job-role {
  font-size: 14px;
  color: #4b5563;
  margin-top: 6px;
}

.job-period {
  font-size: 13px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 4px 12px;
  border-radius: 12px;
}

/* 教育经历 */
.edu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  background: #f9fafb;
  border: 1px solid #eef0f3;
  border-radius: 12px;
  padding: 20px 24px;
  transition: all 0.3s ease;
}

.edu-item:hover {
  border-color: #111827;
}

.edu-school {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 6px;
}

.edu-major {
  font-size: 14px;
  color: #4b5563;
}

.edu-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.edu-degree {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  background: #f3f4f6;
  padding: 4px 12px;
  border-radius: 12px;
}

.edu-period {
  font-size: 13px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 4px 12px;
  border-radius: 12px;
}

/* 证书与奖项双栏 */
.card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.cert-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cert-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
  background: #f9fafb;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  padding: 10px 14px;
  transition: all 0.3s ease;
}

.cert-item:hover {
  border-color: #111827;
  transform: translateX(4px);
}

.cert-icon {
  flex-shrink: 0;
  color: #111827;
}

@media (max-width: 768px) {
  .hero-card {
    flex-direction: column;
    text-align: center;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .card-grid {
    grid-template-columns: 1fr;
  }

  .skill-grid,
  .advantage-list {
    grid-template-columns: 1fr;
  }

  .card {
    padding: 24px;
  }
}
</style>
