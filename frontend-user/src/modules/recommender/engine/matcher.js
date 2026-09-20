/**
 * 方案推荐器 - 匹配引擎（纯函数）
 *
 * 规则条件（rule.conditions）每个维度取值：
 *   - WILDCARD('*')：通配，任意需求值均可命中
 *   - 字符串数组：命中其一即可
 *
 * 命中多条规则时，按「具体度（非通配维度数）降序 → 优先级 priority 降序 → id 升序」
 * 排序取第一条；若并列的最具体规则命中了多个不同方案，则判定为规则冲突。
 */

import { DIMENSIONS, DIMENSION_KEYS, WILDCARD, optionLabel } from './constants.js'

const DIMENSION_OPTIONS = Object.fromEntries(
  DIMENSION_KEYS.map((k) => [k, DIMENSIONS[k].options])
)
const DIMENSION_LABELS = Object.fromEntries(
  DIMENSION_KEYS.map((k) => [k, DIMENSIONS[k].label])
)

export function isEmptyDemand(demand) {
  return DIMENSION_KEYS.every((k) => !demand[k])
}

export function validateDemand(demand) {
  if (isEmptyDemand(demand)) {
    return { ok: false, status: 'EMPTY_DEMAND', missing: [...DIMENSION_KEYS] }
  }
  const missing = DIMENSION_KEYS.filter((k) => !demand[k])
  if (missing.length > 0) {
    return { ok: false, status: 'INCOMPLETE_DEMAND', missing }
  }
  return { ok: true, missing: [] }
}

/** 规则在该维度上是否命中需求 */
export function ruleMatches(rule, demand) {
  if (rule.enabled === false) return false
  return DIMENSION_KEYS.every((key) => {
    const cond = rule.conditions?.[key] ?? WILDCARD
    if (cond === WILDCARD) return true
    const values = Array.isArray(cond) ? cond : [cond]
    return values.includes(demand[key])
  })
}

/** 具体度 = 非通配维度的数量 */
export function specificity(rule) {
  return DIMENSION_KEYS.reduce((n, key) => {
    const cond = rule.conditions?.[key]
    return cond && cond !== WILDCARD ? n + 1 : n
  }, 0)
}

function rankRules(rules) {
  return [...rules].sort((a, b) => {
    const s = specificity(b) - specificity(a)
    if (s !== 0) return s
    const pa = a.priority ?? 0
    const pb = b.priority ?? 0
    if (pb !== pa) return pb - pa
    return String(a.id).localeCompare(String(b.id))
  })
}

/**
 * 在已发布规则集上执行推荐
 * @returns {{ status: string, recommended?: object, candidates?: object[], matchedRules?: object[] }}
 */
export function recommend(rules, demand) {
  const check = validateDemand(demand)
  if (!check.ok) {
    return {
      status: check.status,
      missing: check.missing,
      matchedRules: []
    }
  }

  const enabledRules = (rules || []).filter((r) => r.enabled !== false)
  if (enabledRules.length === 0) {
    return { status: 'NO_PUBLISHED_RULES', matchedRules: [] }
  }

  const matched = rankRules(enabledRules.filter((rule) => ruleMatches(rule, demand)))

  if (matched.length === 0) {
    return { status: 'NO_MATCH', matchedRules: [] }
  }

  const topSpecificity = specificity(matched[0])
  const winners = matched.filter((r) => specificity(r) === topSpecificity)
  const topPriority = winners[0].priority ?? 0
  const finalists = winners.filter((r) => (r.priority ?? 0) === topPriority)
  const distinctSolutions = new Set(finalists.map((r) => r.solutionId))

  if (distinctSolutions.size > 1) {
    return {
      status: 'RULE_CONFLICT',
      matchedRules: finalists,
      conflictSolutions: [...distinctSolutions]
    }
  }

  const recommended = finalists[0]
  return {
    status: 'OK',
    recommended,
    candidates: matched,
    matchedRules: [recommended]
  }
}

/**
 * 校验规则本身的合法性
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateRule(rule) {
  const errors = []
  if (!rule || typeof rule !== 'object') {
    return { valid: false, errors: ['规则不存在'], warnings: [] }
  }
  if (!rule.name || !String(rule.name).trim()) {
    errors.push('规则名称不能为空')
  }
  if (!rule.solutionId || !String(rule.solutionId).trim()) {
    errors.push('推荐方案不能为空')
  }
  if (!rule.conditions || typeof rule.conditions !== 'object') {
    errors.push('匹配条件缺失')
  } else {
    for (const key of DIMENSION_KEYS) {
      const cond = rule.conditions[key] ?? WILDCARD
      if (cond === WILDCARD) continue
      const values = Array.isArray(cond) ? cond : [cond]
      const allowed = new Set(DIMENSION_OPTIONS[key].map((o) => o.value))
      const invalid = values.filter((v) => !allowed.has(v))
      if (values.length === 0) {
        errors.push(`「${DIMENSION_LABELS[key]}」条件不能为空数组`)
      }
      if (invalid.length > 0) {
        errors.push(`「${DIMENSION_LABELS[key]}」含非法取值：${invalid.join('、')}`)
      }
    }
  }
  return { valid: errors.length === 0, errors, warnings: [] }
}

/**
 * 检测规则集内的冲突（与 recommend 的最终判定口径一致）
 * 仅检测启用中的规则；两条规则在三个维度上均存在交集、具体度相同、优先级相同、
 * 但推荐方案不同时，才会对某些需求产生无法裁决的多方案歧义。
 * 条件重叠但具体度/优先级不同的情况，排序规则可唯一裁决，不算冲突。
 * @returns {Array<{ ruleA, ruleB, dimensions: string[] }>}
 */
export function detectConflicts(rules) {
  const active = (rules || []).filter((r) => r.enabled !== false)
  const conflicts = []
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]
      const b = active[j]
      if (a.solutionId === b.solutionId) continue
      if (specificity(a) !== specificity(b)) continue
      if ((a.priority ?? 0) !== (b.priority ?? 0)) continue
      const overlapDims = DIMENSION_KEYS.filter((key) =>
        conditionsOverlap(a.conditions?.[key], b.conditions?.[key])
      )
      if (overlapDims.length === DIMENSION_KEYS.length) {
        conflicts.push({
          ruleA: a,
          ruleB: b,
          dimensions: overlapDims
        })
      }
    }
  }
  return conflicts
}

/**
 * 两条同维度条件是否存在交集（即存在某个需求值同时满足两条）
 */
export function conditionsOverlap(c1, c2) {
  const norm = (c) => {
    if (!c || c === WILDCARD) return WILDCARD
    return new Set(Array.isArray(c) ? c : [c])
  }
  const s1 = norm(c1)
  const s2 = norm(c2)
  if (s1 === WILDCARD || s2 === WILDCARD) return true
  for (const v of s1) {
    if (s2.has(v)) return true
  }
  return false
}

/** 生成人可读的命中依据：逐条说明每个维度的匹配情况 */
export function buildBasis(rule, demand) {
  return DIMENSION_KEYS.map((key) => {
    const cond = rule.conditions?.[key] ?? WILDCARD
    const demandValue = demand[key]
    const demandLabel = demandValue ? optionLabel(key, demandValue) : '（未填）'
    if (cond === WILDCARD) {
      return {
        dimension: key,
        dimensionLabel: DIMENSION_LABELS[key],
        demandValue: demandValue || '',
        demandLabel,
        conditionText: '不限',
        matched: true,
        text: `需求「${demandLabel}」· 规则在该维度不做限制，自然命中`
      }
    }
    const values = Array.isArray(cond) ? cond : [cond]
    const matched = values.includes(demandValue)
    const conditionText = values.map((v) => optionLabel(key, v)).join(' / ')
    return {
      dimension: key,
      dimensionLabel: DIMENSION_LABELS[key],
      demandValue,
      demandLabel,
      conditionValues: values,
      conditionText,
      matched,
      text: `需求「${demandLabel}」${matched ? '命中' : '未命中'}条件：${conditionText}`
    }
  })
}
