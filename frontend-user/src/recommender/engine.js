// 方案推荐器 - 推荐引擎（纯函数）
// 设计要点：
// 1. evaluateRequirements 为纯同步函数，一次调用原子产出「推荐结果 + 匹配依据 + 版本号」，
//    三者来自同一个不可变版本快照，任何时序下都不会出现结果与依据版本不一致。
// 2. 规则冲突在「发布时校验」与「求值时兜底」双层拦截，拒绝时均携带替代路径。

import {
  REJECT_CODES,
  REJECT_MESSAGES,
  REJECT_ALTERNATIVES,
  REQUIREMENT_FIELDS,
  DIMENSION_LABELS,
  BUSINESS_SCALES,
  WAREHOUSING_NEEDS,
  DELIVERY_SCENARIOS,
  optionLabel,
  isRequirementEmpty
} from './constants.js'

const DIMENSION_OPTIONS = {
  businessScale: BUSINESS_SCALES,
  warehousing: WAREHOUSING_NEEDS,
  scenario: DELIVERY_SCENARIOS
}

// ============ 工具 ============

// 深冻结：保证已发布版本快照不可变
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value)) {
      deepFreeze(value[key])
    }
  }
  return value
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

// 单条规则是否命中需求（条件数组为空表示该维度不限）
export function ruleMatches(rule, requirement) {
  if (!rule || rule.enabled === false) return false
  return REQUIREMENT_FIELDS.every((field) => {
    const wanted = requirement[field]
    if (!wanted) return true // 需求未填写的维度不参与过滤
    const accepted = rule.conditions?.[field] || []
    return accepted.length === 0 || accepted.includes(wanted)
  })
}

// 两条规则的条件是否重叠（存在同时命中两条规则的需求组合）
export function conditionsOverlap(ruleA, ruleB) {
  return REQUIREMENT_FIELDS.every((field) => {
    const a = ruleA.conditions?.[field] || []
    const b = ruleB.conditions?.[field] || []
    if (a.length === 0 || b.length === 0) return true // 任一维度不限则该维度必重叠
    return a.some((v) => b.includes(v))
  })
}

// ============ 冲突检测 ============
// 冲突定义：两条启用规则条件重叠、优先级相同，但指向不同方案
export function findRuleConflicts(rules) {
  const conflicts = []
  const enabled = (rules || []).filter((r) => r.enabled !== false)
  for (let i = 0; i < enabled.length; i++) {
    for (let j = i + 1; j < enabled.length; j++) {
      const a = enabled[i]
      const b = enabled[j]
      if (
        a.priority === b.priority &&
        a.solution?.code !== b.solution?.code &&
        conditionsOverlap(a, b)
      ) {
        conflicts.push({
          ruleIds: [a.id, b.id],
          ruleNames: [a.name, b.name],
          priority: a.priority,
          solutions: [a.solution?.code, b.solution?.code]
        })
      }
    }
  }
  return conflicts
}

// ============ 草稿校验（发布前） ============
export function validateDraft(rules) {
  const problems = []
  const list = rules || []

  if (list.length === 0) {
    problems.push({ code: 'EMPTY_DRAFT', message: '草稿中没有任何规则，发布后访客将无法获得推荐' })
  }

  for (const rule of list) {
    if (!rule.name || !rule.name.trim()) {
      problems.push({ code: 'NAME_MISSING', ruleId: rule.id, message: `规则 ${rule.id} 缺少名称` })
    }
    if (!rule.solution?.code || !rule.solution?.title) {
      problems.push({ code: 'SOLUTION_MISSING', ruleId: rule.id, message: `规则「${rule.name || rule.id}」未配置推荐方案` })
    }
    if (typeof rule.priority !== 'number' || Number.isNaN(rule.priority)) {
      problems.push({ code: 'PRIORITY_INVALID', ruleId: rule.id, message: `规则「${rule.name || rule.id}」优先级无效` })
    }
  }

  const conflicts = findRuleConflicts(list)
  for (const conflict of conflicts) {
    problems.push({
      code: 'RULE_CONFLICT',
      ruleIds: conflict.ruleIds,
      message: `规则「${conflict.ruleNames[0]}」与「${conflict.ruleNames[1]}」条件重叠且优先级相同（${conflict.priority}），但推荐方案不同`
    })
  }

  return { valid: problems.length === 0, problems, conflicts }
}

// ============ 推荐求值 ============
// requirement: 需求快照（求值入口已判空/冻结）
// version: 已发布版本快照 { version, publishedAt, rules }
// 返回值（原子结果，二选一）：
//   成功 { status: 'ok', version, requirement, result, rationale, evaluatedAt }
//   拒绝 { status: 'rejected', code, message, alternatives, version, evaluatedAt }
export function evaluateRequirements(requirement, version) {
  const evaluatedAt = new Date().toISOString()
  const versionTag = version?.version || 'none'

  const reject = (code, extra = {}) => ({
    status: 'rejected',
    code,
    message: REJECT_MESSAGES[code],
    alternatives: REJECT_ALTERNATIVES[code] || [],
    version: versionTag,
    evaluatedAt,
    ...extra
  })

  // 1. 需求为空 → 拒绝
  if (isRequirementEmpty(requirement)) {
    return reject(REJECT_CODES.EMPTY_REQUIREMENT)
  }

  // 2. 无已发布版本 → 视为无匹配
  if (!version || !Array.isArray(version.rules) || version.rules.length === 0) {
    return reject(REJECT_CODES.NO_MATCH, { matchedRules: [] })
  }

  // 3. 匹配启用规则
  const matched = version.rules.filter((rule) => ruleMatches(rule, requirement))
  if (matched.length === 0) {
    return reject(REJECT_CODES.NO_MATCH, { matchedRules: [] })
  }

  // 4. 取最高优先级；同级出现不同方案 → 规则冲突，拒绝
  const topPriority = Math.max(...matched.map((r) => r.priority))
  const winners = matched.filter((r) => r.priority === topPriority)
  const distinctSolutions = new Set(winners.map((r) => r.solution?.code))
  if (distinctSolutions.size > 1) {
    return reject(REJECT_CODES.RULE_CONFLICT, {
      matchedRules: winners.map((r) => ({ id: r.id, name: r.name, priority: r.priority, solutionCode: r.solution?.code }))
    })
  }

  // 5. 生成推荐结果与匹配依据（同一版本快照、同一次调用产出）
  const winner = winners[0]
  const rationale = REQUIREMENT_FIELDS
    .filter((field) => requirement[field])
    .map((field) => {
      const accepted = winner.conditions?.[field] || []
      return {
        dimension: field,
        dimensionLabel: DIMENSION_LABELS[field],
        requirementLabel: optionLabel(DIMENSION_OPTIONS[field], requirement[field]),
        ruleCondition: accepted.length === 0 ? '不限' : accepted.map((v) => optionLabel(DIMENSION_OPTIONS[field], v)).join(' / '),
        matched: true
      }
    })

  return {
    status: 'ok',
    version: versionTag,
    publishedAt: version.publishedAt || null,
    requirement: deepClone(requirement), // 需求快照随结果保存，便于核对一致性
    result: {
      ruleId: winner.id,
      ruleName: winner.name,
      priority: winner.priority,
      solution: deepClone(winner.solution)
    },
    rationale,
    evaluatedAt
  }
}
