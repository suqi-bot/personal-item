/**
 * 雨夜便利店街角微缩场景 —— 全局坐标约定（单位：米，底座 20x20）
 *
 *   Z-  后侧（店铺后墙 / 邻家）
 *   Z+  面向 default camera 的前方街道
 *   X-  左侧（邻家 + 小巷）
 *   X+  右侧街道（与前方街道在街角交汇）
 *
 *   default camera 位于 (13.5, 9.5, 15.5)，因此 +Z 与 +X 两个立面是主要观赏面。
 */
export const L = {
  base: { half: 10, thickness: 1.1 },

  /** 各层高度 */
  y: {
    road: 0.0, // 车行道沥青面
    walk: 0.16, // 人行道面
    storeFloor: 0.2, // 店内地板面
    roof: 3.95, // 店铺檐口顶
    parapet: 4.5, // 女儿墙顶
    ceiling: 3.35, // 店内吊顶
  },

  /** 便利店主体外墙包围盒（含正面 +Z 与右侧 +X 两个玻璃立面） */
  store: {
    minX: -7.8,
    maxX: 1.8,
    minZ: -8.6,
    maxZ: -2.4,
  },

  /** 街道 */
  road: {
    /** 前方街道：沿 X 方向延伸，占据 Z ∈ [frontMin, 10] */
    frontMin: 3.2,
    /** 右侧街道：沿 Z 方向延伸，占据 X ∈ [rightMin, 10] */
    rightMin: 3.2,
    /** 路中心线 */
    frontCenterZ: 6.6,
    rightCenterX: 6.6,
  },

  /** 小巷：位于店铺左墙与左邻家之间，开口朝人行道 */
  alley: {
    minX: -9.1,
    maxX: -7.8,
    minZ: -8.6,
    maxZ: -2.4,
  },

  neighbor: {
    left: { minX: -10, maxX: -9.1, minZ: -9.6, maxZ: -2.9, height: 5.6 },
    back: { minX: -10, maxX: -2.6, minZ: -10, maxZ: -9.0, height: 4.4 },
    acrossRight: { minX: 6.0, maxX: 10, minZ: -9.6, maxZ: -0.6, height: 5.2 },
    acrossFront: { minX: -10, maxX: -1.4, minZ: 7.6, maxZ: 10, height: 4.2 },
  },

  /** 店铺正立面（Z = store.maxZ）沿 X 的功能分区 */
  facade: {
    /** 自动门（含门框） */
    doorMinX: -1.9,
    doorMaxX: 1.1,
    /** 玻璃橱窗：左段与右段 */
    glassMinY: 0.22,
    glassMaxY: 3.0,
    /** 雨棚外挑 */
    awningDepth: 1.25,
    awningY: 3.12,
  },

  /** 斑马线（转角两处） */
  crosswalk: {
    front: { x0: 3.9, x1: 8.2, z0: 3.5, z1: 6.0 }, // 跨越右侧街道
    right: { x0: 3.5, x1: 6.0, z0: 3.9, z1: 8.2 }, // 跨越前方街道
    stripeW: 0.46,
  },

  /** 店内关键家具定位（供 interior 模块使用） */
  interior: {
    /** 饮料柜墙：后墙 Z 方向一排 */
    fridgeWall: { x0: -7.4, x1: -0.6, z: -8.35 },
    /** 货架通道：4 排，沿 Z 排列 */
    aisle: { x0: -6.4, dx: 1.45, count: 4, z0: -6.6, z1: -3.6 },
    /** 收银台：靠近自动门内侧 */
    register: { x: -0.1, z: -4.0, w: 2.6, d: 1.0 },
    /** 关东煮 + 咖啡台：右墙内侧 */
    oden: { x: 1.35, z: -5.9, w: 0.9, d: 3.0 },
    /** 后场门 / 储物柜：后墙左段 */
    backDoor: { x: -6.9, z: -8.4 },
    /** 冰柜岛：中部 */
    freezer: { x0: -4.4, x1: -1.4, z: -4.9 },
  },

  /** 主要户外道具落点（避免互相穿插） */
  spots: {
    vendingWall: { x: 2.15, z: -6.4, facing: 0 }, // 贴店铺右墙，朝 +X
    vendingCorner: { x: 2.15, z: -3.1, facing: 0 },
    vendingAlley: { x: -8.45, z: -3.3, facing: Math.PI },
    umbrellaStand: { x: 1.45, z: -1.5 },
    doormat: { x: -0.4, z: -1.85 },
    trashCluster: { x: 2.35, z: 1.5 },
    bikeRack: { x: -4.6, z: -1.5 },
    bicycleCorner: { x: 2.4, z: 0.2 },
    streetlight: { x: -3.3, z: 3.4 },
    utilityPole: { x: 4.35, z: 2.45 },
    utilityPoleFar: { x: -6.2, z: 4.9 },
    signal: { x: 7.4, z: 6.9 },
    guardFence: { x0: -9.4, x1: 1.0, z: 2.95 },
    bulletin: { x: -9.35, z: -1.2 },
    parking: { x0: -9.2, x1: -3.2, z: 4.35 },
    acUnits: { x: -7.95, z: -6.5 },
    cornerSign: { x: 1.9, z: -2.5 },
  },
} as const

/** 常用几何工具 */
export function withinX(x: number) {
  return x > -L.base.half && x < L.base.half
}

export const isOnRoad = (x: number, z: number) => z >= L.road.frontMin || x >= L.road.rightMin
