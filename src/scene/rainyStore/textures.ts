import * as THREE from 'three'

/**
 * 全部贴图由 Canvas 程序化生成：保持三渲二的干净色板，同时不引入任何外部资源。
 */
const cache = new Map<string, THREE.Texture>()

interface MakeOpts {
  repeat?: [number, number]
  nearest?: boolean
  clamp?: boolean
}

function make(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: MakeOpts = {},
): THREE.CanvasTexture {
  const hit = cache.get(key)
  if (hit) return hit as THREE.CanvasTexture
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D
  ctx.imageSmoothingEnabled = true
  draw(ctx, w, h)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  if (opts.clamp) {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  } else {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  }
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1])
  tex.magFilter = opts.nearest ? THREE.NearestFilter : THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.needsUpdate = true
  cache.set(key, tex)
  return tex
}

const JP = '"Yu Gothic UI","Yu Gothic","Meiryo","Hiragino Sans","Noto Sans JP","MS PGothic",sans-serif'

function font(size: number, weight = 700) {
  return `${weight} ${size}px ${JP}`
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + k, y)
  ctx.arcTo(x + w, y, x + w, y + h, k)
  ctx.arcTo(x + w, y + h, x, y + h, k)
  ctx.arcTo(x, y + h, x, y, k)
  ctx.arcTo(x, y, x + w, y, k)
  ctx.closePath()
}

function fillRR(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  ctx.fillStyle = color
  rr(ctx, x, y, w, h, r)
  ctx.fill()
}

function center(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, f: string, color: string) {
  ctx.font = f
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, colors: string[], maxR = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0]
    const r = Math.random() * maxR + 0.4
    ctx.beginPath()
    ctx.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ============================ 天空 / 环境 ============================

export function skyTex() {
  return make(
    'sky',
    64,
    1024,
    (ctx, w, h) => {
      // canvas y=0 → v=1 → 天顶；y=h → v=0 → 天底。地平线在 y=h/2。
      // 最亮处压在地平线上（城市光霾），向天顶和天底两侧衰减；天底近乎平坦，
      // 否则俯视时天底梯度会在底座周围画出一圈圈同心等值线。
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#04050c')
      g.addColorStop(0.26, '#080e22')
      g.addColorStop(0.4, '#101a38')
      g.addColorStop(0.47, '#22335c')
      g.addColorStop(0.5, '#3b5080')
      g.addColorStop(0.545, '#161f3a')
      g.addColorStop(0.64, '#0a0f1e')
      g.addColorStop(1, '#06080f')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      // 低空被城市灯光染亮的雨云带：只放在地平线以上，边缘用渐变羽化避免硬色阶
      for (let i = 0; i < 11; i++) {
        const y = h * (0.3 + Math.random() * 0.18)
        const hh = 3 + Math.random() * 9
        const cg = ctx.createLinearGradient(0, y, 0, y + hh)
        const c = i % 2 ? '109,127,181' : '143,127,166'
        cg.addColorStop(0, `rgba(${c},0)`)
        cg.addColorStop(0.5, `rgba(${c},0.13)`)
        cg.addColorStop(1, `rgba(${c},0)`)
        ctx.fillStyle = cg
        ctx.fillRect(0, y, w, hh)
      }
    },
    { clamp: true },
  )
}

export function glowTex() {
  return make(
    'glow',
    128,
    128,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.32, 'rgba(255,255,255,0.42)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    },
    { clamp: true },
  )
}

export function ringTex() {
  return make(
    'ring',
    128,
    128,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.24, w / 2, h / 2, w * 0.5)
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(0.55, 'rgba(255,255,255,0.85)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2)
      ctx.fill()
    },
    { clamp: true },
  )
}

export function dropTex() {
  return make(
    'drop',
    64,
    128,
    (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
      g.addColorStop(0.78, 'rgba(255,255,255,0.9)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      rr(ctx, w * 0.32, 0, w * 0.36, h, w * 0.18)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.beginPath()
      ctx.arc(w / 2, h * 0.9, w * 0.22, 0, Math.PI * 2)
      ctx.fill()
    },
    { clamp: true },
  )
}

export function noiseTex() {
  return make('noise', 64, 64, (ctx, w, h) => {
    const img = ctx.createImageData(w, h)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() * 255) | 0
      img.data[i] = v
      img.data[i + 1] = v
      img.data[i + 2] = v
      img.data[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  })
}

// ============================ 地面 ============================

export function asphaltTex() {
  return make('asphalt', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3a4258'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 2600, ['#454e66', '#333b4e', '#4d5871', '#2c3344'], 1.8)
    ctx.globalAlpha = 0.25
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#525c76' : '#2f3646'
      ctx.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 70, 12 + Math.random() * 30)
    }
    ctx.globalAlpha = 1
    // 裂缝
    ctx.strokeStyle = '#272d3d'
    ctx.lineWidth = 1.4
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      let x = Math.random() * w
      let y = Math.random() * h
      ctx.moveTo(x, y)
      for (let k = 0; k < 7; k++) {
        x += (Math.random() - 0.5) * 34
        y += (Math.random() - 0.5) * 34
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  })
}

export function concreteTex() {
  return make('concrete', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6f7994'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 1500, ['#7b859f', '#66708a', '#8791ac'], 1.4)
    ctx.strokeStyle = '#59637c'
    ctx.lineWidth = 3
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo((i * w) / 2, 0)
      ctx.lineTo((i * w) / 2, h)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, (i * h) / 2)
      ctx.lineTo(w, (i * h) / 2)
      ctx.stroke()
    }
    // 导盲砖（点状）
    ctx.fillStyle = '#8d8667'
    for (let i = 0; i < 26; i++) ctx.fillRect(6 + i * 9, h * 0.5 - 4, 5, 5)
  })
}

export function storeFloorTex() {
  return make('storeFloor', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e7eaf1'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#cdd3de'
    ctx.lineWidth = 2
    const n = 4
    for (let i = 0; i <= n; i++) {
      ctx.beginPath()
      ctx.moveTo((i * w) / n, 0)
      ctx.lineTo((i * w) / n, h)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, (i * h) / n)
      ctx.lineTo(w, (i * h) / n)
      ctx.stroke()
    }
    speckle(ctx, w, h, 500, ['#dfe3eb', '#eff2f7'], 1)
  })
}

export function wallTileTex() {
  return make('wallTile', 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#eef1f6'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#d5dae4'
    ctx.lineWidth = 2
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        ctx.strokeRect((x * w) / 4, ((y + (x % 2) * 0.5) * h) / 4 - h / 8, w / 4, h / 4)
      }
    }
  })
}

export function plasterTex(tint = '#4b526b') {
  return make(`plaster|${tint}`, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = tint
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 900, ['#ffffff22', '#00000022', '#ffffff14'], 1.6)
    ctx.globalAlpha = 0.18
    ctx.fillStyle = '#000'
    for (let i = 0; i < 8; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 26, 20 + Math.random() * 60)
    ctx.globalAlpha = 1
  })
}

export function grateTex() {
  return make('grate', 64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#3b4256'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#1e2331'
    for (let i = 0; i < 6; i++) ctx.fillRect(4, 6 + i * 9, w - 8, 5)
    ctx.strokeStyle = '#565f78'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, w - 2, h - 2)
  })
}

export function doormatTex() {
  return make(
    'doormat',
    256,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#4a5a63'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#3c4a52'
      for (let i = 0; i < 260; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 3, 2)
      ctx.strokeStyle = '#d9d3c2'
      ctx.lineWidth = 5
      ctx.strokeRect(10, 10, w - 20, h - 20)
      center(ctx, 'Welcome', w / 2, h / 2, font(38, 700), '#e8e2cf')
    },
    { clamp: true },
  )
}

// ============================ 招牌 / 灯箱 ============================

const BRAND = 'ソラマート'
const BRAND_EN = 'SORA MART'

export function fasciaTex() {
  return make(
    'fascia',
    1024,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#f6f2e7'
      ctx.fillRect(0, 0, w, h)
      // 品牌三色条
      ctx.fillStyle = '#2fae9c'
      ctx.fillRect(0, 0, w, 26)
      ctx.fillStyle = '#3a7ec0'
      ctx.fillRect(0, 26, w, 16)
      ctx.fillStyle = '#f0a84a'
      ctx.fillRect(0, h - 34, w, 34)
      center(ctx, BRAND, w * 0.36, h * 0.56, font(120, 900), '#1f6f68')
      center(ctx, BRAND_EN, w * 0.72, h * 0.44, font(46, 800), '#3a7ec0')
      center(ctx, '24 時間営業', w * 0.72, h * 0.72, font(40, 700), '#c85a3c')
    },
    { clamp: true },
  )
}

export function fasciaSideTex() {
  return make(
    'fasciaSide',
    512,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#f6f2e7'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#2fae9c'
      ctx.fillRect(0, 0, w, 12)
      ctx.fillStyle = '#3a7ec0'
      ctx.fillRect(0, 12, w, 8)
      center(ctx, BRAND, w / 2, h * 0.6, font(62, 900), '#1f6f68')
    },
    { clamp: true },
  )
}

export function tallSignTex() {
  return make(
    'tallSign',
    256,
    1024,
    (ctx, w, h) => {
      ctx.fillStyle = '#f6f2e7'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#2fae9c'
      ctx.fillRect(0, 0, w, 40)
      ctx.fillStyle = '#3a7ec0'
      ctx.fillRect(0, 40, w, 22)
      ctx.fillStyle = '#f0a84a'
      ctx.fillRect(0, h - 60, w, 60)
      const chars = BRAND.split('')
      chars.forEach((c, i) => {
        center(ctx, c, w / 2, 170 + i * 130, font(112, 900), '#1f6f68')
      })
      center(ctx, '24h', w / 2, h - 26, font(52, 900), '#ffffff')
    },
    { clamp: true },
  )
}

export function lightboxTex(text: string, bg = '#fff3d6', fg = '#2c6f66', sub = '') {
  return make(
    `lb|${text}|${bg}|${fg}|${sub}`,
    512,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = fg
      ctx.lineWidth = 10
      ctx.strokeRect(14, 14, w - 28, h - 28)
      center(ctx, text, w / 2, sub ? h * 0.42 : h / 2, font(96, 900), fg)
      if (sub) center(ctx, sub, w / 2, h * 0.76, font(44, 700), '#b0603a')
    },
    { clamp: true },
  )
}

export function bannerTex(text: string, color = '#e0665c') {
  return make(
    `banner|${text}|${color}`,
    256,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = color
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, h * 0.06, w, 8)
      text.split('').forEach((c, i) => center(ctx, c, w / 2, 90 + i * 82, font(66, 900), '#ffffff'))
    },
    { clamp: true },
  )
}

export function posterTex(kind: 'drink' | 'bento' | 'new' | 'recruit' | 'ice' | 'oden') {
  const spec: Record<string, { bg: string; fg: string; title: string; sub: string; accent: string }> = {
    drink: { bg: '#dfeef7', fg: '#2a6c9c', title: '冷たい飲み物', sub: 'ひんやり 冷感 中', accent: '#6fc2e8' },
    bento: { bg: '#fbeede', fg: '#b95a2c', title: 'お弁当 新入荷', sub: '毎日 つくったて', accent: '#f0a84a' },
    new: { bg: '#e9f6e9', fg: '#2f7a4a', title: 'NEW!', sub: '新商品 発売中', accent: '#63b46a' },
    recruit: { bg: '#f6e7ee', fg: '#a83c63', title: 'スタッフ募集中', sub: '詳しくは店内掲示', accent: '#e98aa6' },
    ice: { bg: '#e5f0fb', fg: '#33608f', title: 'アイス祭り', sub: '期間限定', accent: '#8fc0f0' },
    oden: { bg: '#f7ecdd', fg: '#8b5a2b', title: 'あったかおでん', sub: '1番 2番 3番', accent: '#e0a05a' },
  }
  const s = spec[kind]
  return make(
    `poster|${kind}`,
    256,
    384,
    (ctx, w, h) => {
      ctx.fillStyle = s.bg
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = s.accent
      ctx.beginPath()
      ctx.arc(w * 0.78, h * 0.2, 70, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(16, h * 0.44, w - 32, 6)
      center(ctx, s.title, w / 2, h * 0.62, font(s.title.length > 6 ? 30 : 36, 900), s.fg)
      center(ctx, s.sub, w / 2, h * 0.76, font(22, 700), '#5d6474')
      ctx.strokeStyle = s.fg
      ctx.lineWidth = 4
      ctx.strokeRect(6, 6, w - 12, h - 12)
    },
    { clamp: true },
  )
}

export function coffeeMenuTex() {
  return make(
    'coffeeMenu',
    512,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#3a2c22'
      ctx.fillRect(0, 0, w, h)
      center(ctx, 'CAFÉ', w / 2, 42, font(52, 900), '#f2d6a8')
      const items = [
        ['ブレンド', '¥120'],
        ['カフェオレ', '¥150'],
        ['ココア', '¥150'],
      ]
      items.forEach((it, i) => {
        ctx.font = font(30, 700)
        ctx.fillStyle = '#e9dcc6'
        ctx.textAlign = 'left'
        ctx.fillText(it[0], 40, 110 + i * 44)
        ctx.textAlign = 'right'
        ctx.fillStyle = '#f4c26a'
        ctx.fillText(it[1], w - 40, 110 + i * 44)
      })
    },
    { clamp: true },
  )
}

export function magazineTex(i: number) {
  const hues = ['#e0665c', '#3a7ec0', '#63b46a', '#f0a84a', '#9a6fc0', '#d8544f']
  const c = hues[i % hues.length]
  return make(
    `mag|${i}`,
    128,
    180,
    (ctx, w, h) => {
      ctx.fillStyle = c
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(8, 12, w - 16, 30)
      ctx.fillStyle = '#f0e8d8'
      ctx.fillRect(10, h * 0.32, w - 20, h * 0.42)
      ctx.fillStyle = '#ffffff'
      for (let k = 0; k < 3; k++) ctx.fillRect(12, h * 0.79 + k * 12, w * (0.4 + Math.random() * 0.4), 6)
      ctx.strokeStyle = '#00000033'
      ctx.lineWidth = 2
      ctx.strokeRect(1, 1, w - 2, h - 2)
    },
    { clamp: true },
  )
}

// ============================ 贩卖机 ============================

export function vendingFrontTex(kind: 'drink' | 'soda' | 'soup') {
  const theme = {
    drink: { body: '#d8544f', panel: '#f3e7d8', accent: '#e0665c' },
    soda: { body: '#2f6fb5', panel: '#e3f0fa', accent: '#4a90d9' },
    soup: { body: '#c8792e', panel: '#fbeedd', accent: '#e0a05a' },
  }[kind]
  return make(
    `vending|${kind}`,
    512,
    1024,
    (ctx, w, h) => {
      ctx.fillStyle = theme.body
      ctx.fillRect(0, 0, w, h)
      // 展示窗
      fillRR(ctx, 30, 60, w - 60, h * 0.5, 22, theme.panel)
      ctx.fillStyle = '#ffffff'
      center(ctx, kind === 'soup' ? 'あたたか' : kind === 'soda' ? 'スパーク' : 'ドリンク', w / 2, 108, font(52, 900), theme.accent)
      const rows = 4
      const cols = 3
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = 48 + c * ((w - 96) / cols)
          const y = 160 + r * 108
          ctx.fillStyle = '#cfd6e2'
          ctx.fillRect(x - 6, y + 78, (w - 96) / cols - 12, 8)
          const ch = 66 + Math.random() * 16
          const col = ['#e0665c', '#4a90d9', '#63b46a', '#f0a84a', '#9a6fc0', '#2fae9c'][(r * 3 + c) % 6]
          fillRR(ctx, x + 8, y + 78 - ch, 40, ch, 8, col)
          ctx.fillStyle = '#ffffffcc'
          ctx.fillRect(x + 10, y + 78 - ch * 0.62, 36, 10)
          // 价签
          ctx.fillStyle = '#ffffff'
          fillRR(ctx, x + 56, y + 52, 46, 24, 6, '#ffffff')
          ctx.font = font(18, 700)
          ctx.fillStyle = '#3d4457'
          ctx.textAlign = 'center'
          ctx.fillText(`${100 + ((r * 3 + c) % 4) * 30}`, x + 79, y + 69)
        }
      }
      // 右侧操作面板
      fillRR(ctx, w - 108, 90, 80, h * 0.44, 14, '#2b3245')
      for (let i = 0; i < 4; i++) fillRR(ctx, w - 96, 120 + i * 62, 56, 40, 8, i === 1 ? '#f4d58a' : '#59627a')
      // 取货口
      fillRR(ctx, 40, h * 0.72, w - 80, h * 0.16, 16, '#242a3b')
      fillRR(ctx, 60, h * 0.76, w - 120, h * 0.08, 10, '#151926')
      ctx.fillStyle = '#ffffff'
      center(ctx, kind === 'soup' ? 'HOT 45℃' : 'COLD 4℃', w / 2, h * 0.94, font(34, 900), '#fff6dd')
    },
    { clamp: true },
  )
}

// ============================ 路标 / 标识 ============================

export function trafficSignTex(kind: 'tomare' | 'crosswalk' | 'oneway' | 'speed' | 'note' | 'parking' | 'signal') {
  return make(
    `sign|${kind}`,
    256,
    256,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      if (kind === 'tomare') {
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(w / 2, h / 2, 120, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#c94a45'
        ctx.lineWidth = 16
        ctx.beginPath()
        ctx.arc(w / 2, h / 2, 112, 0, Math.PI * 2)
        ctx.stroke()
        center(ctx, '止まれ', w / 2, h / 2, font(64, 900), '#c94a45')
      } else if (kind === 'crosswalk') {
        ctx.fillStyle = '#3f7fc4'
        rr(ctx, 16, 16, w - 32, h - 32, 16)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(w / 2, 82, 22, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillRect(w / 2 - 12, 100, 24, 58)
        for (let i = 0; i < 5; i++) ctx.fillRect(50 + i * 34, 178, 18, 44)
      } else if (kind === 'oneway') {
        ctx.fillStyle = '#3f7fc4'
        rr(ctx, 12, 60, w - 24, h - 120, 12)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.moveTo(60, h / 2)
        ctx.lineTo(140, h / 2 - 40)
        ctx.lineTo(140, h / 2 - 14)
        ctx.lineTo(200, h / 2 - 14)
        ctx.lineTo(200, h / 2 + 14)
        ctx.lineTo(140, h / 2 + 14)
        ctx.lineTo(140, h / 2 + 40)
        ctx.closePath()
        ctx.fill()
      } else if (kind === 'speed') {
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(w / 2, h / 2, 120, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#c94a45'
        ctx.lineWidth = 18
        ctx.beginPath()
        ctx.arc(w / 2, h / 2, 108, 0, Math.PI * 2)
        ctx.stroke()
        center(ctx, '30', w / 2, h / 2, font(96, 900), '#2c3143')
      } else if (kind === 'note') {
        ctx.fillStyle = '#f0c74a'
        ctx.beginPath()
        ctx.moveTo(w / 2, 26)
        ctx.lineTo(w - 26, h - 40)
        ctx.lineTo(26, h - 40)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#3c3a2a'
        ctx.lineWidth = 8
        ctx.stroke()
        center(ctx, '注意', w / 2, h * 0.68, font(56, 900), '#3c3a2a')
      } else if (kind === 'parking') {
        ctx.fillStyle = '#3f7fc4'
        rr(ctx, 24, 24, w - 48, h - 48, 14)
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 8
        ctx.strokeRect(46, 46, w - 92, h - 92)
        center(ctx, 'P', w / 2, h / 2 - 10, font(110, 900), '#ffffff')
        center(ctx, '軽自動車', w / 2, h - 66, font(26, 700), '#ffffff')
      } else {
        ctx.fillStyle = '#252b3d'
        rr(ctx, 40, 20, w - 80, h - 40, 16)
        ctx.fill()
        const cols = ['#d8544f', '#e0b04a', '#5fc07a']
        cols.forEach((c, i) => {
          ctx.fillStyle = c
          ctx.beginPath()
          ctx.arc(w / 2, 62 + i * 64, 34, 0, Math.PI * 2)
          ctx.fill()
        })
      }
    },
    { clamp: true },
  )
}

export function guideArrowTex() {
  return make(
    'guide',
    256,
    256,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#3f7fc4'
      ctx.fillRect(w * 0.42, 0, w * 0.16, h)
      ctx.beginPath()
      ctx.moveTo(w / 2, h - 8)
      ctx.lineTo(w * 0.2, h * 0.72)
      ctx.lineTo(w * 0.36, h * 0.72)
      ctx.lineTo(w * 0.36, h * 0.55)
      ctx.lineTo(w * 0.64, h * 0.55)
      ctx.lineTo(w * 0.64, h * 0.72)
      ctx.lineTo(w * 0.8, h * 0.72)
      ctx.closePath()
      ctx.fill()
    },
    { clamp: true },
  )
}

export function bulletinTex() {
  return make(
    'bulletin',
    512,
    384,
    (ctx, w, h) => {
      ctx.fillStyle = '#f3efe2'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#8a6a4a'
      ctx.fillRect(0, 0, w, 46)
      center(ctx, 'コミュニティ掲示板', w / 2, 24, font(30, 800), '#f6efe0')
      const cols = ['#e0665c', '#4a90d9', '#63b46a', '#f0a84a', '#9a6fc0', '#2fae9c', '#d8544f']
      for (let i = 0; i < 12; i++) {
        const x = 18 + (i % 4) * 122
        const y = 62 + ((i / 4) | 0) * 104
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate((Math.random() - 0.5) * 0.08)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 108, 88)
        ctx.fillStyle = cols[i % cols.length]
        ctx.fillRect(6, 6, 96, 22)
        ctx.fillStyle = '#c9cfda'
        for (let k = 0; k < 4; k++) ctx.fillRect(8, 38 + k * 12, 60 + Math.random() * 36, 5)
        ctx.restore()
      }
    },
    { clamp: true },
  )
}

export function clockTex() {
  return make(
    'clock',
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#f6f7fa'
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, 62, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#3d4457'
      ctx.lineWidth = 5
      ctx.stroke()
      ctx.strokeStyle = '#3d4457'
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(w / 2 + Math.cos(a) * 50, h / 2 + Math.sin(a) * 50)
        ctx.lineTo(w / 2 + Math.cos(a) * 57, h / 2 + Math.sin(a) * 57)
        ctx.lineWidth = i % 3 === 0 ? 5 : 2
        ctx.stroke()
      }
      ctx.strokeStyle = '#2c3143'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(w / 2, h / 2)
      ctx.lineTo(w / 2 + 8, h / 2 - 28)
      ctx.stroke()
      ctx.strokeStyle = '#c94a45'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(w / 2, h / 2)
      ctx.lineTo(w / 2 - 22, h / 2 + 20)
      ctx.stroke()
    },
    { clamp: true },
  )
}

/** 货架价签条 / 区域导视条 */
export function stripTex(text: string, bg = '#ffffff', fg = '#2f6f66', h = 64) {
  return make(
    `strip|${text}|${bg}|${fg}`,
    512,
    h,
    (ctx, w, hh) => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, hh)
      center(ctx, text, w / 2, hh / 2 + 2, font(hh * 0.6, 800), fg)
    },
    { clamp: true },
  )
}

export function disposeTextures() {
  cache.forEach((t) => t.dispose())
  cache.clear()
}
