/**
 * 方案推荐器 - 状态仓库
 *
 * 职责：
 *  - 角色（规则管理员 / 业务访客 / 未授权）与权限拦截
 *  - 规则草稿维护、发布前校验与冲突检测
 *  - 已发布版本不可变（深冻结）持久化
 *  - 基于已发布版本执行推荐，返回带版本快照的结果
 *
 * 纯前端静态站点：默认使用 localStorage；createRecommenderStore(storageLike)
 * 可注入内存存储，便于单元测试。
 */

import { reactive, computed, watch } from 'vue'
import { ROLES, WILDCARD } from './engine/constants.js'
import { recommend, validateRule, detectConflicts, buildBasis } from './engine/matcher.js'
import { getSolution, buildSeedRules } from './seed.js'

const STORAGE_KEY = 'zhiyun-recommender-state-v1'

export class PermissionDeniedError extends Error {
  constructor(action, role) {
    super(`权限不足：${ROLES[role]?.label || role}不能执行「${action}」`)
    this.name = 'PermissionDeniedError'
    this.action = action
    this.role = role
  }
}

export class RuleValidationError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'RuleValidationError'
    this.details = details // { errors: string[], conflicts: [] }
  }
}

function createMemoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  }
}

function defaultStorage() {
  if (typeof localStorage !== 'undefined') return localStorage
  return createMemoryStorage()
}

function uid(prefix = 'r') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj)
    Object.values(obj).forEach(deepFreeze)
  }
  return obj
}

function clone(rules) {
  return structuredClone(rules)
}

/**
 * 创建推荐器仓库（单例见文件底部）
 */
export function createRecommenderStore(storage = defaultStorage()) {
  function initialState() {
    return {
      role: 'guest',
      versions: [],
      publishedVersionId: null,
      draft: {
        baseVersionId: null,
        rules: buildSeedRules()
      }
    }
  }

  function load() {
    try {
      const raw = storage.getItem(STORAGE_KEY)
      if (!raw) return initialState()
      const parsed = JSON.parse(raw)
      return {
        ...initialState(),
        ...parsed,
        draft: parsed.draft ?? { baseVersionId: null, rules: buildSeedRules() }
      }
    } catch {
      return initialState()
    }
  }

  const state = reactive(load())

  function persist() {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* 存储不可用时静默降级为内存态 */
    }
  }
  // 生产环境双保险：响应式深监听兜底（测试桩下 watch 为空实现，因此写操作内也显式调用 persist）
  watch(state, persist, { deep: true })

  const canEdit = computed(() => state.role === 'admin')
  const publishedVersion = computed(() =>
    state.versions.find((v) => v.id === state.publishedVersionId) || null
  )

  function requireAdmin(action) {
    if (state.role !== 'admin') {
      throw new PermissionDeniedError(action, state.role)
    }
  }

  function setRole(role) {
    if (!ROLES[role]) throw new Error(`未知角色：${role}`)
    state.role = role
    persist()
  }

  function ruleIndex(id) {
    return state.draft.rules.findIndex((r) => r.id === id)
  }

  function upsertRule(rule) {
    requireAdmin('保存规则')
    const result = validateRule(rule)
    if (!result.valid) {
      throw new RuleValidationError('规则校验未通过', { errors: result.errors })
    }
    const payload = {
      id: rule.id || uid(),
      name: rule.name.trim(),
      solutionId: rule.solutionId,
      conditions: {
        businessScale: rule.conditions.businessScale || WILDCARD,
        storageNeed: rule.conditions.storageNeed || WILDCARD,
        deliveryScene: rule.conditions.deliveryScene || WILDCARD
      },
      priority: Number.isFinite(Number(rule.priority)) ? Number(rule.priority) : 0,
      enabled: rule.enabled !== false,
      createdAt: rule.createdAt || new Date().toISOString()
    }
    const idx = ruleIndex(payload.id)
    if (idx >= 0) {
      state.draft.rules[idx] = payload
    } else {
      state.draft.rules.push(payload)
    }
    persist()
    return payload
  }

  function deleteRule(id) {
    requireAdmin('删除规则')
    const idx = ruleIndex(id)
    if (idx >= 0) state.draft.rules.splice(idx, 1)
    persist()
  }

  function toggleRule(id, enabled) {
    requireAdmin('启停规则')
    const idx = ruleIndex(id)
    if (idx >= 0) state.draft.rules[idx].enabled = enabled
    persist()
  }

  function resetDraft() {
    requireAdmin('重置草稿')
    const base = publishedVersion.value
    state.draft = {
      baseVersionId: base ? base.id : null,
      rules: base ? clone(base.rules) : buildSeedRules()
    }
    persist()
  }

  /**
   * 发布新版本：全部规则必须合法，启用规则不得存在冲突。
   * 发布后旧版本保持不可变，新版本成为生效版本，并自动生成下一版草稿。
   */
  function publish(note = '') {
    requireAdmin('发布规则版本')
    const rules = state.draft.rules

    const errors = []
    rules.forEach((r) => {
      const v = validateRule(r)
      v.errors.forEach((e) => errors.push(`规则「${r.name || r.id}」：${e}`))
    })

    const conflicts = detectConflicts(rules)
    const conflictDescs = conflicts.map(
      (c) => `「${c.ruleA.name}」与「${c.ruleB.name}」条件重叠但推荐方案不同`
    )

    if (errors.length > 0 || conflicts.length > 0) {
      throw new RuleValidationError('存在无法发布的规则问题', {
        errors,
        conflicts: conflictDescs
      })
    }

    const seq = state.versions.reduce((max, v) => {
      const n = Number(String(v.id).replace(/^v/, ''))
      return Number.isFinite(n) ? Math.max(max, n) : max
    }, 0) + 1
    const id = `v${seq}`
    const version = deepFreeze({
      id,
      note: note.trim() || `第 ${seq} 版规则`,
      publishedAt: new Date().toISOString(),
      publishedBy: ROLES.admin.label,
      rules: deepFreeze(clone(rules))
    })
    state.versions.push(version)
    state.publishedVersionId = id
    state.draft = {
      baseVersionId: id,
      rules: clone(version.rules)
    }
    persist()
    return version
  }

  /**
   * 基于当前已发布版本执行推荐，返回绑定版本号的快照。
   * 快照由调用方持有；切换场景、窗口缩放均不会改变它，直到再次显式调用。
   */
  function evaluate(demand) {
    const version = publishedVersion.value
    if (!version) {
      const base = recommend([], demand)
      return {
        ...base,
        demand: clone({ businessScale: '', storageNeed: '', deliveryScene: '', ...demand }),
        solution: null,
        basis: [],
        versionId: null,
        versionLabel: '（尚未发布任何版本）',
        publishedAt: null,
        evaluatedAt: new Date().toISOString()
      }
    }
    const result = recommend(version.rules, demand)
    const solution = result.recommended ? getSolution(result.recommended.solutionId) : null
    const basis = result.recommended ? buildBasis(result.recommended, demand) : []
    return {
      ...result,
      demand: clone(demand),
      solution,
      basis,
      versionId: version.id,
      versionLabel: version.id,
      versionNote: version.note,
      publishedAt: version.publishedAt,
      evaluatedAt: new Date().toISOString()
    }
  }

  /** 只读视图需要的草稿冲突信息（不修改状态） */
  function draftDiagnostics() {
    const errors = []
    state.draft.rules.forEach((r) => {
      validateRule(r).errors.forEach((e) =>
        errors.push(`规则「${r.name || r.id}」：${e}`)
      )
    })
    return {
      errors,
      conflicts: detectConflicts(state.draft.rules)
    }
  }

  return {
    state,
    canEdit,
    publishedVersion,
    setRole,
    upsertRule,
    deleteRule,
    toggleRule,
    resetDraft,
    publish,
    evaluate,
    draftDiagnostics
  }
}

// 全站单例
export const recommenderStore = createRecommenderStore()
