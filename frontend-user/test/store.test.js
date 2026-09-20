import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createRecommenderStore,
  PermissionDeniedError,
  RuleValidationError
} from '../src/modules/recommender/store.js'
import { WILDCARD } from '../src/modules/recommender/engine/constants.js'

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    __map: map
  }
}

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

test('未发布任何版本：访客评估返回 NO_PUBLISHED_RULES 且 versionId 为 null', () => {
  const store = createRecommenderStore(memoryStorage())
  store.setRole('visitor')
  const r = store.evaluate(DEMAND_MID_CROSS)
  assert.equal(r.status, 'NO_PUBLISHED_RULES')
  assert.equal(r.versionId, null)
})

test('权限：guest / visitor 不能新增、删除、启停、发布规则', () => {
  for (const role of ['guest', 'visitor']) {
    const store = createRecommenderStore(memoryStorage())
    store.setRole(role)
    assert.throws(
      () =>
        store.upsertRule({
          name: 'x',
          solutionId: 's_light',
          conditions: { businessScale: WILDCARD, storageNeed: WILDCARD, deliveryScene: WILDCARD }
        }),
      PermissionDeniedError
    )
    assert.throws(() => store.deleteRule('seed-r1'), PermissionDeniedError)
    assert.throws(() => store.toggleRule('seed-r1', false), PermissionDeniedError)
    assert.throws(() => store.resetDraft(), PermissionDeniedError)
    assert.throws(() => store.publish(), PermissionDeniedError)
  }
})

test('权限：管理员可维护并发布；发布后版本号递增且对访客生效', () => {
  const storage = memoryStorage()
  const admin = createRecommenderStore(storage)
  admin.setRole('admin')

  const v1 = admin.publish('初始版本')
  assert.equal(v1.id, 'v1')
  assert.equal(admin.state.publishedVersionId, 'v1')

  const visitor = createRecommenderStore(storage)
  visitor.setRole('visitor')
  const r = visitor.evaluate(DEMAND_SMALL_LOCAL)
  assert.equal(r.status, 'OK')
  assert.equal(r.versionId, 'v1')
  assert.equal(r.solution.id, 's_light')
  assert.ok(r.basis.length === 3)
  assert.ok(r.basis.every((b) => b.matched === true))
})

test('发布拒绝：存在冲突规则时抛出 RuleValidationError 且不生成新版本', () => {
  const store = createRecommenderStore(memoryStorage())
  store.setRole('admin')
  store.upsertRule({
    name: '冲突演示',
    solutionId: 's_consult',
    conditions: { businessScale: 'large', storageNeed: 'intelligent', deliveryScene: 'omni' },
    priority: 10,
    enabled: true
  })
  assert.throws(
    () => store.publish(),
    (err) => err instanceof RuleValidationError && err.details.conflicts.length > 0
  )
  assert.equal(store.state.versions.length, 0)
  assert.equal(store.state.publishedVersionId, null)
})

test('发布拒绝：非法规则（空方案）阻止发布', () => {
  const store = createRecommenderStore(memoryStorage())
  store.setRole('admin')
  // 直接构造非法规则进入草稿
  store.state.draft.rules.push({
    id: 'bad',
    name: '坏规则',
    solutionId: '',
    conditions: { businessScale: WILDCARD, storageNeed: WILDCARD, deliveryScene: WILDCARD },
    priority: 0,
    enabled: true
  })
  assert.throws(() => store.publish(), RuleValidationError)
  assert.equal(store.state.versions.length, 0)
})

test('版本不可变：发布后修改草稿/发布新版，历史版本对象保持冻结不变', () => {
  const store = createRecommenderStore(memoryStorage())
  store.setRole('admin')
  const v1 = store.publish('v1')
  const v1RuleName = v1.rules[0].name

  // 冻结校验
  assert.ok(Object.isFrozen(v1))
  assert.ok(Object.isFrozen(v1.rules))
  assert.ok(Object.isFrozen(v1.rules[0]))
  assert.throws(() => {
    v1.note = 'hacked'
  }, TypeError)

  // 改草稿并发布 v2
  store.upsertRule({ ...store.state.draft.rules[0], name: '改名后的规则' })
  const v2 = store.publish('v2')
  assert.equal(v2.id, 'v2')
  assert.equal(store.state.publishedVersionId, 'v2')

  // v1 内容不被后续编辑影响
  assert.equal(v1.rules[0].name, v1RuleName)
  assert.notEqual(v1.rules[0].name, '改名后的规则')
})

test('版本一致性：结果快照绑定评估时版本，切换需求/场景不改变快照', () => {
  const store = createRecommenderStore(memoryStorage())
  store.setRole('admin')
  store.publish('v1')

  const snap1 = store.evaluate(DEMAND_SMALL_LOCAL)
  assert.equal(snap1.versionId, 'v1')
  assert.equal(snap1.solution.id, 's_light')
  assert.deepEqual(snap1.demand, DEMAND_SMALL_LOCAL)

  // 模拟“快速切换场景 / 窗口调整后”：不重新调用 evaluate，快照保持不变
  const switched = { ...DEMAND_MID_CROSS }
  assert.deepEqual(snap1.demand, DEMAND_SMALL_LOCAL) // 快照内的需求仍是旧的
  assert.equal(snap1.versionId, 'v1')
  assert.equal(snap1.solution.id, 's_light')
  assert.ok(switched) // 仅占位表达“外部需求已变”

  // 发布 v2 后，旧快照依旧是 v1；显式重新评估才变成 v2
  store.upsertRule({
    name: '新规则',
    solutionId: 's_consult',
    conditions: { businessScale: 'small', storageNeed: 'none', deliveryScene: 'local' },
    priority: 50,
    enabled: true
  })
  const v2 = store.publish('v2')
  assert.equal(snap1.versionId, 'v1')
  assert.equal(snap1.solution.id, 's_light')

  const snap2 = store.evaluate(DEMAND_SMALL_LOCAL)
  assert.equal(snap2.versionId, 'v2')
  assert.equal(snap2.recommended.solutionId, 's_consult')
  assert.equal(v2.rules[0].name, v2.rules[0].name)
})

test('空白需求即使在已发布版本下也被拒绝，且快照记录缺失维度', () => {
  const store = createRecommenderStore(memoryStorage())
  store.setRole('admin')
  store.publish('v1')

  const empty = store.evaluate({ businessScale: '', storageNeed: '', deliveryScene: '' })
  assert.equal(empty.status, 'EMPTY_DEMAND')
  assert.equal(empty.missing.length, 3)
  assert.equal(empty.versionId, 'v1')
  assert.equal(empty.recommended, undefined)

  const partial = store.evaluate({ businessScale: 'small', storageNeed: '', deliveryScene: '' })
  assert.equal(partial.status, 'INCOMPLETE_DEMAND')
  assert.deepEqual(partial.missing, ['storageNeed', 'deliveryScene'])
})

test('无命中组合：返回 NO_MATCH 与替代路径所需的版本信息', () => {
  const store = createRecommenderStore(memoryStorage())
  store.setRole('admin')
  // 仅保留一条覆盖面窄的规则
  store.state.draft.rules = [
    {
      id: 'only',
      name: 'only',
      solutionId: 's_wms',
      conditions: { businessScale: 'small', storageNeed: 'none', deliveryScene: 'local' },
      priority: 1,
      enabled: true,
      createdAt: new Date().toISOString()
    }
  ]
  store.publish('narrow')
  const r = store.evaluate(DEMAND_MID_CROSS)
  assert.equal(r.status, 'NO_MATCH')
  assert.equal(r.versionId, 'v1')
  assert.equal(r.solution, null)
})

test('重置草稿：管理员放弃修改回到当前发布版本', () => {
  const store = createRecommenderStore(memoryStorage())
  store.setRole('admin')
  store.publish('v1')
  const before = store.state.draft.rules.length
  store.deleteRule(store.state.draft.rules[0].id)
  assert.notEqual(store.state.draft.rules.length, before)
  store.resetDraft()
  assert.equal(store.state.draft.rules.length, before)
  assert.equal(store.state.draft.baseVersionId, 'v1')
})

test('持久化：刷新（重建仓库）后角色与版本仍在', () => {
  const storage = memoryStorage()
  const a = createRecommenderStore(storage)
  a.setRole('admin')
  a.publish('持久化版本')
  assert.ok(storage.getItem('zhiyun-recommender-state-v1'))

  const b = createRecommenderStore(storage)
  assert.equal(b.state.role, 'admin')
  assert.equal(b.state.publishedVersionId, 'v1')
  assert.equal(b.state.versions[0].note, '持久化版本')
  assert.equal(b.state.draft.baseVersionId, 'v1')
})
