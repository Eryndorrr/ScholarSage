import type { LODLevel, LODConfig } from './types'

/**
 * LOD 缩放阈值
 */
export const LOD_THRESHOLDS = {
  far: { max: 0.3 },     // 缩放 < 0.3
  medium: { min: 0.3, max: 0.7 }, // 0.3 <= 缩放 < 0.7
  near: { min: 0.7 }     // 缩放 >= 0.7
} as const

/**
 * 各层级的渲染配置
 */
export const LOD_CONFIGS: Record<LODLevel, LODConfig> = {
  far: {
    nodeSize: 8,           // 小节点
    showLabel: false,      // 隐藏标签
    showArrow: false,      // 隐藏箭头
    edgeWidth: 1,          // 细边
    labelFontSize: 8
  },
  medium: {
    nodeSize: 15,
    showLabel: true,       // 只显示高被引标签
    showArrow: true,
    edgeWidth: 1.5,
    labelFontSize: 10
  },
  near: {
    nodeSize: 20,
    showLabel: true,       // 显示所有标签
    showArrow: true,
    edgeWidth: 2,
    labelFontSize: 11
  }
}

/**
 * 根据缩放级别确定 LOD 层级
 */
export function getLODLevel(zoom: number): LODLevel {
  if (zoom < LOD_THRESHOLDS.far.max) {
    return 'far'
  } else if (zoom < LOD_THRESHOLDS.medium.max) {
    return 'medium'
  } else {
    return 'near'
  }
}

/**
 * 获取当前 LOD 配置
 */
export function getLODConfig(zoom: number): LODConfig {
  const level = getLODLevel(zoom)
  return LOD_CONFIGS[level]
}

/**
 * 根据节点被引次数判断是否应该显示标签（中等缩放级别）
 */
export function shouldShowLabel(
  incomingCitations: number,
  lodLevel: LODLevel,
  isInternal: boolean
): boolean {
  const config = LOD_CONFIGS[lodLevel]

  if (!config.showLabel) return false

  // 近距离显示所有标签
  if (lodLevel === 'near') return true

  // 中等距离：内部节点始终显示，外部节点高被引才显示
  if (lodLevel === 'medium') {
    if (isInternal) return true
    return incomingCitations >= 3
  }

  return false
}

/**
 * 根据缩放调整节点大小
 */
export function getScaledNodeSize(
  baseSize: number,
  zoom: number,
  _isInternal?: boolean
): number {
  const level = getLODLevel(zoom)
  const config = LOD_CONFIGS[level]

  // 根据层级调整基础大小
  const multiplier = level === 'far' ? 0.5 : level === 'medium' ? 0.75 : 1

  return Math.max(
    config.nodeSize,
    baseSize * multiplier
  )
}
