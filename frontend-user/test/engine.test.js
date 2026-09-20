import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isEmptyDemand,
  validateDemand,
  ruleMatches,
  specificity,
  recommend,
  validateRule,
  detectConflicts,
  conditionsOverlap
} from '../src/modules/recommender/engine/matcher.js'
import { WILDCARD } from '../src/modules/recommender/engine/constants.js'
import { buildSeedRules } from '../src/modules/recommender/seed.js'

const DEMAND_MID_CROSS = {
  businessScale: 'medium',
  storageNeed: 'standard',
  deliveryScene: 'cross'
}
const DEMAND_SMALL_LOCAL = {
  businessScale: 'small',
  storageNeed: 'none',
  deliveryScene: 'local'
}

test('需求校验：空白需求判定为空', () => {
  assert.equal(isEmptyDemand({ businessScale: '', storageNeed: '', deliveryScene: '' }), true)
  const r = validateDemand({ businessScale: '', storageNeed: '', deliveryScene: '' })
  assert.equal(r.ok, false)
  assert.equal(r.status, 'EMPTY_DEMAND')
  assert.equal(r.missing.length, 3)
})

test('需求校验：部分填写判定为不完整并给出缺失维度', () => {
  const r = validateDemand({ businessScale: 'small', storageNeed: '', deliveryScene: '' })
  assert.equal(r.ok, false)
  assert.equal(r.status, 'INCOMPLETE_DEMAND')
  assert.deepEqual(r.missing, ['storageNeed', 'deliveryScene'])
})

test('规则命中：精确条件、通配条件与数组条件', () => {
  const exact = {
    conditions: { businessScale: 'small', storageNeed: 'none', deliveryScene: 'local' }
  }
  assert.equal(ruleMatches(exact, DEMAND_SMALL_LOCAL), true)
  assert.equal(ruleMatches(exact, DEMAND_MID_CROSS), false)

  const wild = { conditions: { businessScale: 'small', storageNeed: WILDCARD, deliveryScene: WILDCARD } }
  assert.equal(
    ruleMatches(wild, { businessScale: 'small', storageNeed: 'basic', deliveryScene: 'omni' }),
    true
  )

  const multi = {
    conditions: { businessScale: ['medium', 'large'], storageNeed: WILDCARD, deliveryScene: WILDCARD }
  }
  assert.equal(ruleMatches(multi, DEMAND_MID_CROSS), true)
})

test('具体度：通配维度越少越具体', () => {
  assert.equal(
    specificity({ conditions: { businessScale: 'small', storageNeed: WILDCARD, deliveryScene: WILDCARD } }),
    1
  )
  assert.equal(
    specificity({ conditions: { businessScale: 'small', storageNeed: 'none', deliveryScene: 'local' } }),
    3
  )
})

test('种子规则上推荐：小微即配 → 轻配版', () => {
  const r = recommend(buildSeedRules(), DEMAND_SMALL_LOCAL)
  assert.equal(r.status, 'OK')
  assert.equal(r.recommended.id, 'seed-r1')
  assert.equal(r.recommended.solutionId, 's_light')
})

test('种子规则上推荐：中型跨区 → 仓配一体', () => {
  const r = recommend(buildSeedRules(), DEMAND_MID_CROSS)
  assert.equal(r.status, 'OK')
  assert.equal(r.recommended.solutionId, 's_wms')
  assert.equal(r.recommended.id, 'seed-r4')
})

test('通配兜底：小微+简易仓储+任意配送仍可由通用规则兜到轻配版', () => {
  const r = recommend(buildSeedRules(), {
    businessScale: 'small',
    storageNeed: 'basic',
    deliveryScene: 'omni'
  })
  assert.equal(r.status, 'OK')
  assert.equal(r.recommended.solutionId, 's_light')
  assert.equal(r.recommended.id, 'seed-r2')
})

test('通配未覆盖：小微+智能仓储不在任何规则覆盖范围 → NO_MATCH', () => {
  const r = recommend(buildSeedRules(), {
    businessScale: 'small',
    storageNeed: 'intelligent',
    deliveryScene: 'omni'
  })
  assert.equal(r.status, 'NO_MATCH')
})

test('无规则启用：返回 NO_PUBLISHED_RULES', () => {
  const r = recommend([], DEMAND_MID_CROSS)
  assert.equal(r.status, 'NO_PUBLISHED_RULES')
})

test('无命中：未覆盖的组合返回 NO_MATCH', () => {
  const rules = [
    {
      id: 'x',
      name: 'x',
      solutionId: 's_wms',
      conditions: { businessScale: 'medium', storageNeed: 'basic', deliveryScene: 'omni' },
      enabled: true
    }
  ]
  const r = recommend(rules, DEMAND_MID_CROSS)
  assert.equal(r.status, 'NO_MATCH')
})

test('规则冲突：同具体度同优先级但方案不同 → RULE_CONFLICT', () => {
  const rules = [
    {
      id: 'a',
      name: 'a',
      solutionId: 's_wms',
      conditions: { businessScale: 'medium', storageNeed: 'standard', deliveryScene: 'cross' },
      priority: 10,
      enabled: true
    },
    {
      id: 'b',
      name: 'b',
      solutionId: 's_smart',
      conditions: { businessScale: 'medium', storageNeed: 'standard', deliveryScene: 'cross' },
      priority: 10,
      enabled: true
    }
  ]
  const r = recommend(rules, DEMAND_MID_CROSS)
  assert.equal(r.status, 'RULE_CONFLICT')
  assert.equal(r.matchedRules.length, 2)
  assert.deepEqual([...new Set(r.matchedRules.map((x) => x.solutionId))].sort(), ['s_smart', 's_wms'])
})

test('优先级可消解冲突：具体度相同、优先级不同时取高优先级单方案', () => {
  const rules = [
    {
      id: 'lo',
      name: 'lo',
      solutionId: 's_wms',
      conditions: { businessScale: 'medium', storageNeed: 'standard', deliveryScene: 'cross' },
      priority: 5,
      enabled: true
    },
    {
      id: 'hi',
      name: 'hi',
      solutionId: 's_smart',
      conditions: { businessScale: 'medium', storageNeed: 'standard', deliveryScene: 'cross' },
      priority: 9,
      enabled: true
    }
  ]
  const r = recommend(rules, DEMAND_MID_CROSS)
  assert.equal(r.status, 'OK')
  assert.equal(r.recommended.id, 'hi')
})

test('具体度优先于优先级：更具体的低优先级规则胜出', () => {
  const rules = [
    {
      id: 'general-high',
      name: 'g',
      solutionId: 's_light',
      conditions: { businessScale: 'medium', storageNeed: WILDCARD, deliveryScene: WILDCARD },
      priority: 99,
      enabled: true
    },
    {
      id: 'specific-low',
      name: 's',
      solutionId: 's_wms',
      conditions: { businessScale: 'medium', storageNeed: 'standard', deliveryScene: 'cross' },
      priority: 1,
      enabled: true
    }
  ]
  const r = recommend(rules, DEMAND_MID_CROSS)
  assert.equal(r.status, 'OK')
  assert.equal(r.recommended.id, 'specific-low')
})

test('规则校验：空名称/空方案/非法取值/空数组均报错', () => {
  assert.equal(validateRule({}).valid, false)
  const badValue = validateRule({
    name: 'n',
    solutionId: 's_wms',
    conditions: { businessScale: 'nope', storageNeed: WILDCARD, deliveryScene: WILDCARD }
  })
  assert.equal(badValue.valid, false)
  assert.match(badValue.errors[0], /非法取值/)

  const emptyArr = validateRule({
    name: 'n',
    solutionId: 's_wms',
    conditions: { businessScale: [], storageNeed: WILDCARD, deliveryScene: WILDCARD }
  })
  assert.equal(emptyArr.valid, false)
  assert.match(emptyArr.errors[0], /不能为空数组/)
})

test('冲突检测：条件重叠且方案不同才报冲突', () => {
  const conflictRules = [
    {
      id: 'a',
      name: 'a',
      solutionId: 's_wms',
      conditions: { businessScale: ['medium', 'large'], storageNeed: WILDCARD, deliveryScene: WILDCARD },
      enabled: true
    },
    {
      id: 'b',
      name: 'b',
      solutionId: 's_smart',
      conditions: { businessScale: 'large', storageNeed: WILDCARD, deliveryScene: WILDCARD },
      enabled: true
    },
    {
      id: 'c',
      name: 'c',
      solutionId: 's_wms',
      conditions: { businessScale: 'large', storageNeed: WILDCARD, deliveryScene: WILDCARD },
      enabled: true
    }
  ]
  const conflicts = detectConflicts(conflictRules)
  // a(中/大,wms) 与 b(大,smart) 冲突；b(大,smart) 与 c(大,wms) 也冲突；a 与 c 同方案不冲突
  assert.equal(conflicts.length, 2)
  assert.deepEqual(conflicts.map((c) => [c.ruleA.id, c.ruleB.id]), [['a', 'b'], ['b', 'c']])
})

test('条件交集：通配恒相交，不相交集合返回 false', () => {
  assert.equal(conditionsOverlap(WILDCARD, ['a', 'b']), true)
  assert.equal(conditionsOverlap(['a'], ['b']), false)
  assert.equal(conditionsOverlap(['a', 'b'], ['b', 'c']), true)
})

test('停用规则不参与匹配', () => {
  const rules = buildSeedRules().map((r) => (r.id === 'seed-r4' ? { ...r, enabled: false } : r))
  const r = recommend(rules, DEMAND_MID_CROSS)
  // r4 停用后该精确组合无人命中
  assert.equal(r.status, 'NO_MATCH')
})
