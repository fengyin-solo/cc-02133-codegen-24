// 方案推荐器 - 常量定义
// 纯数据模块：不依赖 Vue / Element Plus，可在 Node 环境直接测试

// ============ 角色 ============
export const ROLES = {
  VISITOR: 'visitor', // 业务访客：只读推荐结果与匹配依据
  RULE_ADMIN: 'rule-admin', // 规则管理员：维护匹配条件、发布版本
  GUEST: 'guest' // 未授权角色：可浏览官网，不能改动规则
}

export const ROLE_OPTIONS = [
  { value: ROLES.VISITOR, label: '业务访客', description: '只读推荐结果与匹配依据' },
  { value: ROLES.RULE_ADMIN, label: '规则管理员', description: '维护匹配条件并发布版本' },
  { value: ROLES.GUEST, label: '未授权用户', description: '仅浏览官网，不可改动规则' }
]

// 各角色权限
export const PERMISSIONS = {
  [ROLES.VISITOR]: ['recommend:read'],
  [ROLES.RULE_ADMIN]: ['recommend:read', 'rule:write', 'rule:publish'],
  [ROLES.GUEST]: []
}

export function hasPermission(role, permission) {
  return (PERMISSIONS[role] || []).includes(permission)
}

// ============ 需求维度 ============
// 业务规模
export const BUSINESS_SCALES = [
  { value: 'micro', label: '微型（日单量 < 100）' },
  { value: 'small', label: '小型（日单量 100 - 1,000）' },
  { value: 'medium', label: '中型（日单量 1,000 - 10,000）' },
  { value: 'large', label: '大型（日单量 > 10,000）' }
]

// 仓储需求
export const WAREHOUSING_NEEDS = [
  { value: 'none', label: '无自有仓库' },
  { value: 'light', label: '轻量仓储（单仓 / 平面仓）' },
  { value: 'standard', label: '标准仓储（多仓 / 多货主）' },
  { value: 'automated', label: '自动化仓储（AGV / 立体库）' }
]

// 配送场景
export const DELIVERY_SCENARIOS = [
  { value: 'b2c', label: 'B2C 电商配送' },
  { value: 'b2b', label: 'B2B 门店补货' },
  { value: 'omnichannel', label: '全渠道履约' },
  { value: 'crossborder', label: '跨境物流' }
]

export const DIMENSION_LABELS = {
  businessScale: '业务规模',
  warehousing: '仓储需求',
  scenario: '配送场景'
}

export function optionLabel(options, value) {
  const hit = options.find((o) => o.value === value)
  return hit ? hit.label : value
}

// ============ 拒绝码与替代路径 ============
export const REJECT_CODES = {
  EMPTY_REQUIREMENT: 'EMPTY_REQUIREMENT', // 需求为空
  NO_MATCH: 'NO_MATCH', // 已发布规则中无匹配
  RULE_CONFLICT: 'RULE_CONFLICT', // 规则冲突
  PERMISSION_DENIED: 'PERMISSION_DENIED', // 权限不足
  DRAFT_INVALID: 'DRAFT_INVALID' // 草稿不满足发布条件
}

export const REJECT_MESSAGES = {
  [REJECT_CODES.EMPTY_REQUIREMENT]: '需求信息为空，无法生成推荐方案',
  [REJECT_CODES.NO_MATCH]: '当前已发布规则中暂无匹配的方案',
  [REJECT_CODES.RULE_CONFLICT]: '匹配到多条同优先级规则，存在冲突',
  [REJECT_CODES.PERMISSION_DENIED]: '当前角色无权执行此操作',
  [REJECT_CODES.DRAFT_INVALID]: '草稿规则未通过校验，无法发布'
}

// 每类拒绝对应的替代路径（action 由页面层解释执行）
export const REJECT_ALTERNATIVES = {
  [REJECT_CODES.EMPTY_REQUIREMENT]: [
    { action: 'fill-form', label: '完善需求信息', description: '至少选择业务规模、仓储需求或配送场景中的一项' },
    { action: 'goto-products', label: '直接浏览产品服务', description: '无需评估，查看全部智慧物流产品' },
    { action: 'goto-contact', label: '联系顾问人工评估', description: '由业务顾问一对一梳理需求' }
  ],
  [REJECT_CODES.NO_MATCH]: [
    { action: 'goto-contact', label: '提交定制需求', description: '留下联系方式，顾问将为您定制方案' },
    { action: 'goto-products', label: '查看全部产品能力', description: '了解 WMS / TMS / DMS / 数据分析平台' },
    { action: 'reset-form', label: '调整需求重新评估', description: '放宽部分条件后再次获取推荐' }
  ],
  [REJECT_CODES.RULE_CONFLICT]: [
    { action: 'goto-contact', label: '转人工顾问裁定', description: '冲突方案由顾问结合业务实际裁定' },
    { action: 'goto-products', label: '自行对比产品', description: '查看候选方案对应产品的详细说明' },
    { action: 'notify-admin', label: '通知规则管理员', description: '切换管理员角色修订冲突规则并重新发布' }
  ],
  [REJECT_CODES.PERMISSION_DENIED]: [
    { action: 'switch-role', label: '切换为规则管理员', description: '演示环境下可直接切换角色体验管理能力' },
    { action: 'goto-recommend', label: '以访客身份获取推荐', description: '推荐结果与匹配依据对访客只读开放' },
    { action: 'goto-home', label: '返回官网首页', description: '继续浏览公司介绍与产品信息' }
  ],
  [REJECT_CODES.DRAFT_INVALID]: [
    { action: 'fix-draft', label: '修订草稿规则', description: '按提示调整条件或优先级后重新发布' },
    { action: 'discard-draft', label: '放弃本次修改', description: '回滚草稿至当前已发布版本' }
  ]
}

// ============ 需求判空 ============
export const REQUIREMENT_FIELDS = ['businessScale', 'warehousing', 'scenario']

export function emptyRequirement() {
  return { businessScale: '', warehousing: '', scenario: '', remark: '' }
}

export function isRequirementEmpty(requirement) {
  if (!requirement) return true
  return REQUIREMENT_FIELDS.every((field) => !requirement[field])
}
