// 方案推荐器 - 纯逻辑测试（node --test）
// 运行：cd frontend-user && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  ROLES,
  REJECT_CODES,
  isRequirementEmpty,
  emptyRequirement
} from '../src/recommender/constants.js'
import {
  evaluateRequirements,
  findRuleConflicts,
  validateDraft,
  ruleMatches,
  conditionsOverlap,
  deepClone
} from '../src/recommender/engine.js'
import { createRepository, seedRules } from '../src/recommender/repository.js'

// 内存存储适配器，模拟 localStorage
function memoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  }
}

function makeRule(overrides = {}) {
  return {
    id: 'R-T1',
    name: '测试规则',
    enabled: true,
    priority: 10,
    conditions: { businessScale: ['small'], warehousing: [], scenario: ['b2c'] },
    solution: { code: 'SOL-T', title: '测试方案', products: ['WMS'], summary: '...', estimatedCycle: '1周' },
    ...overrides
  }
}

function makeVersion(rules, tag = 'v1') {
  return { version: tag, publishedAt: '2026-09-20T00:00:00.000Z', rules }
}

// ============ 需求判空 ============
test('空白需求判定：全空为空白，任一维度填写即非空白', () => {
  assert.equal(isRequirementEmpty(emptyRequirement()), true)
  assert.equal(isRequirementEmpty(null), true)
  assert.equal(isRequirementEmpty({ businessScale: 'small', warehousing: '', scenario: '' }), false)
  assert.equal(isRequirementEmpty({ businessScale: '', warehousing: '', scenario: 'b2c' }), false)
})

test('空白需求求值：拒绝并给出替代路径', () => {
  const outcome = evaluateRequirements(emptyRequirement(), makeVersion(seedRules()))
  assert.equal(outcome.status, 'rejected')
  assert.equal(outcome.code, REJECT_CODES.EMPTY_REQUIREMENT)
  assert.ok(outcome.alternatives.length >= 2, '拒绝必须携带替代路径')
  assert.ok(outcome.alternatives.every((a) => a.action && a.label))
})

// ============ 正常匹配 ============
test('正常匹配：结果与匹配依据携带同一版本号', () => {
  const version = makeVersion(seedRules(), 'v1')
  const outcome = evaluateRequirements(
    { businessScale: 'small', warehousing: 'light', scenario: 'b2c', remark: '' },
    version
  )
  assert.equal(outcome.status, 'ok')
  assert.equal(outcome.version, 'v1')
  assert.equal(outcome.result.solution.code, 'SOL-WMS-DMS-LITE')
  // 匹配依据覆盖全部已填维度，且每条依据可追溯到规则条件
  assert.equal(outcome.rationale.length, 3)
  assert.ok(outcome.rationale.every((r) => r.matched && r.ruleCondition))
  // 需求快照随结果保存
  assert.equal(outcome.requirement.businessScale, 'small')
})

test('优先级裁决：高优先级规则胜出，低优先级不造成冲突', () => {
  const rules = [
    makeRule({ id: 'R-A', priority: 10, solution: { code: 'SOL-A', title: 'A' } }),
    makeRule({ id: 'R-B', priority: 20, solution: { code: 'SOL-B', title: 'B' } })
  ]
  const outcome = evaluateRequirements(
    { businessScale: 'small', warehousing: '', scenario: 'b2c' },
    makeVersion(rules)
  )
  assert.equal(outcome.status, 'ok')
  assert.equal(outcome.result.ruleId, 'R-B')
})

test('通配条件：空条件数组匹配任意取值', () => {
  const rule = makeRule({ conditions: { businessScale: [], warehousing: [], scenario: [] } })
  assert.equal(ruleMatches(rule, { businessScale: 'large', warehousing: 'automated', scenario: 'b2b' }), true)
  assert.equal(conditionsOverlap(makeRule(), makeRule({ conditions: { businessScale: [], warehousing: [], scenario: [] } })), true)
})

test('停用规则不参与匹配', () => {
  const rules = [makeRule({ enabled: false })]
  const outcome = evaluateRequirements(
    { businessScale: 'small', warehousing: '', scenario: 'b2c' },
    makeVersion(rules)
  )
  assert.equal(outcome.status, 'rejected')
  assert.equal(outcome.code, REJECT_CODES.NO_MATCH)
})

// ============ 无匹配 ============
test('无匹配规则：拒绝并给出替代路径', () => {
  const rules = [makeRule({ conditions: { businessScale: ['micro'], warehousing: [], scenario: [] } })]
  const outcome = evaluateRequirements(
    { businessScale: 'large', warehousing: '', scenario: '' },
    makeVersion(rules)
  )
  assert.equal(outcome.status, 'rejected')
  assert.equal(outcome.code, REJECT_CODES.NO_MATCH)
  assert.ok(outcome.alternatives.length >= 2)
})

// ============ 规则冲突 ============
test('规则冲突：同优先级、条件重叠、方案不同 → 求值拒绝并给出替代路径', () => {
  const rules = [
    makeRule({ id: 'R-A', name: '规则A', solution: { code: 'SOL-A', title: 'A' } }),
    makeRule({ id: 'R-B', name: '规则B', solution: { code: 'SOL-B', title: 'B' } })
  ]
  const outcome = evaluateRequirements(
    { businessScale: 'small', warehousing: '', scenario: 'b2c' },
    makeVersion(rules)
  )
  assert.equal(outcome.status, 'rejected')
  assert.equal(outcome.code, REJECT_CODES.RULE_CONFLICT)
  assert.equal(outcome.matchedRules.length, 2)
  assert.ok(outcome.alternatives.length >= 2)
})

test('冲突检测：重叠+同级+不同方案才算冲突；条件不重叠不算', () => {
  const a = makeRule({ id: 'R-A' })
  const b = makeRule({ id: 'R-B', solution: { code: 'SOL-B', title: 'B' } })
  assert.equal(findRuleConflicts([a, b]).length, 1)

  const c = makeRule({ id: 'R-C', conditions: { businessScale: ['large'], warehousing: [], scenario: ['b2b'] } })
  const d = makeRule({ id: 'R-D', conditions: { businessScale: ['micro'], warehousing: [], scenario: ['b2b'] }, solution: { code: 'SOL-D', title: 'D' } })
  assert.equal(findRuleConflicts([c, d]).length, 0)
})

test('发布拦截：草稿含冲突规则时拒绝发布', () => {
  const repo = createRepository(memoryStorage())
  const conflictDraft = [
    makeRule({ id: 'R-A', name: '规则A' }),
    makeRule({ id: 'R-B', name: '规则B', solution: { code: 'SOL-B', title: 'B' } })
  ]
  assert.equal(repo.saveDraft(ROLES.RULE_ADMIN, conflictDraft).status, 'ok')
  const published = repo.publish(ROLES.RULE_ADMIN, '含冲突的草稿')
  assert.equal(published.status, 'rejected')
  assert.equal(published.code, REJECT_CODES.DRAFT_INVALID)
  assert.ok(published.problems.some((p) => p.code === 'RULE_CONFLICT'))
  assert.ok(published.alternatives.length >= 1)
})

test('草稿校验：空草稿与缺方案规则均不可发布', () => {
  assert.equal(validateDraft([]).valid, false)
  assert.equal(validateDraft([makeRule({ solution: null })]).valid, false)
  assert.equal(validateDraft([makeRule()]).valid, true)
})

// ============ 权限 ============
test('权限不足：访客与未授权角色不能保存草稿、不能发布', () => {
  for (const role of [ROLES.VISITOR, ROLES.GUEST]) {
    const repo = createRepository(memoryStorage())
    const saved = repo.saveDraft(role, [makeRule()])
    assert.equal(saved.status, 'rejected')
    assert.equal(saved.code, REJECT_CODES.PERMISSION_DENIED)
    assert.ok(saved.alternatives.length >= 2, '权限拒绝必须携带替代路径')

    const published = repo.publish(role, '越权发布')
    assert.equal(published.status, 'rejected')
    assert.equal(published.code, REJECT_CODES.PERMISSION_DENIED)
  }
})

test('规则管理员：可保存草稿并发布新版本', () => {
  const repo = createRepository(memoryStorage())
  assert.equal(repo.getCurrentVersion().version, 'v1')

  const draft = repo.getDraft()
  draft[0].name = '改名后的规则'
  assert.equal(repo.saveDraft(ROLES.RULE_ADMIN, draft).status, 'ok')

  const published = repo.publish(ROLES.RULE_ADMIN, '修改规则名称')
  assert.equal(published.status, 'ok')
  assert.equal(published.version.version, 'v2')
  assert.equal(repo.getCurrentVersion().version, 'v2')
  assert.equal(repo.getVersions().length, 2)
})

// ============ 版本一致性 ============
test('版本不可变：发布后修改草稿不影响已发布快照', () => {
  const repo = createRepository(memoryStorage())
  const draft = repo.getDraft()
  draft[0].solution.title = 'v2 方案标题'
  repo.saveDraft(ROLES.RULE_ADMIN, draft)
  repo.publish(ROLES.RULE_ADMIN, 'v2')

  const v1 = repo.getVersions()[0]
  assert.equal(v1.rules[0].solution.title, '轻量仓配一体方案（WMS + DMS）')
  assert.equal(Object.isFrozen(v1), true)
  assert.equal(Object.isFrozen(v1.rules[0].solution), true)
})

test('同一需求在不同版本下求值：结果与依据各自归属对应版本', () => {
  const repo = createRepository(memoryStorage())
  const requirement = { businessScale: 'small', warehousing: 'light', scenario: 'b2c', remark: '' }

  const before = evaluateRequirements(requirement, repo.getCurrentVersion())
  assert.equal(before.version, 'v1')

  // 管理员发布 v2：调整该场景的方案
  const draft = repo.getDraft()
  draft[0].solution = { code: 'SOL-NEW', title: '新方案', products: ['DMS'], summary: '...', estimatedCycle: '2周' }
  repo.saveDraft(ROLES.RULE_ADMIN, draft)
  repo.publish(ROLES.RULE_ADMIN, '方案升级')

  const after = evaluateRequirements(requirement, repo.getCurrentVersion())
  assert.equal(after.version, 'v2')
  assert.equal(after.result.solution.code, 'SOL-NEW')
  // 旧结果仍是 v1，不会被新版本污染
  assert.equal(before.version, 'v1')
  assert.equal(before.result.solution.code, 'SOL-WMS-DMS-LITE')
})

test('快速切换场景模拟：连续求值各自原子，结果与依据始终同源', () => {
  const repo = createRepository(memoryStorage())
  const version = repo.getCurrentVersion()
  const scenarios = ['b2c', 'b2b', 'crossborder', 'omnichannel']
  const outcomes = scenarios.map((scenario) =>
    evaluateRequirements({ businessScale: 'medium', warehousing: 'standard', scenario, remark: '' }, version)
  )
  for (const outcome of outcomes) {
    // 无论命中还是拒绝，版本标签都与求值所用版本一致
    assert.equal(outcome.version, version.version)
    if (outcome.status === 'ok') {
      assert.equal(outcome.requirement.scenario, outcome.rationale.find((r) => r.dimension === 'scenario') ? outcome.requirement.scenario : null)
      assert.ok(outcome.rationale.every((r) => r.matched))
    }
  }
})

test('持久化：仓库状态经存储介质往返后保持一致', () => {
  const storage = memoryStorage()
  const repo1 = createRepository(storage)
  const draft = repo1.getDraft()
  draft.push(makeRule({ id: 'R-NEW', name: '新规则', priority: 60 }))
  repo1.saveDraft(ROLES.RULE_ADMIN, draft)
  repo1.publish(ROLES.RULE_ADMIN, '新增规则')

  const repo2 = createRepository(storage)
  assert.equal(repo2.getCurrentVersion().version, 'v2')
  assert.equal(repo2.getCurrentVersion().rules.length, seedRules().length + 1)
})
