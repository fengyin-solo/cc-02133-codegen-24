/**
 * 方案推荐器 - 领域常量
 * 三个匹配维度：业务规模 × 仓储需求 × 配送场景
 */

export const DIMENSIONS = {
  businessScale: {
    key: 'businessScale',
    label: '业务规模',
    options: [
      { value: 'small', label: '小微 / 初创企业' },
      { value: 'medium', label: '中型成长企业' },
      { value: 'large', label: '大型 / 集团企业' }
    ]
  },
  storageNeed: {
    key: 'storageNeed',
    label: '仓储需求',
    options: [
      { value: 'none', label: '无需仓储' },
      { value: 'basic', label: '简易仓储（代管 / 临时）' },
      { value: 'standard', label: '标准仓储（自营 / 租赁）' },
      { value: 'intelligent', label: '智能仓储（WMS / 自动化）' }
    ]
  },
  deliveryScene: {
    key: 'deliveryScene',
    label: '配送场景',
    options: [
      { value: 'local', label: '同城即时配送' },
      { value: 'city', label: '城际干线运输' },
      { value: 'cross', label: '跨区域分销' },
      { value: 'omni', label: '全渠道一盘货' }
    ]
  }
}

export const DIMENSION_KEYS = Object.keys(DIMENSIONS)

/** 通配条件：该维度不限取值 */
export const WILDCARD = '*'

/** 角色定义 */
export const ROLES = {
  admin: { value: 'admin', label: '规则管理员', desc: '可维护匹配条件并发布规则版本' },
  visitor: { value: 'visitor', label: '业务访客', desc: '只读推荐结果与匹配依据' },
  guest: { value: 'guest', label: '未授权访客', desc: '仅可浏览，不能改动任何规则' }
}

export const ROLE_LIST = Object.values(ROLES)

/** 推荐 / 校验状态码 */
export const STATUS = {
  OK: 'OK',
  EMPTY_DEMAND: 'EMPTY_DEMAND',
  INCOMPLETE_DEMAND: 'INCOMPLETE_DEMAND',
  NO_MATCH: 'NO_MATCH',
  RULE_CONFLICT: 'RULE_CONFLICT',
  NO_PUBLISHED_RULES: 'NO_PUBLISHED_RULES'
}

export function optionLabel(dimensionKey, value) {
  const opt = DIMENSIONS[dimensionKey]?.options.find((o) => o.value === value)
  return opt ? opt.label : value
}
