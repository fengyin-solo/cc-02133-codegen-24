// 方案推荐器 - store 集成测试（node --test）
// 验证 UI 实际使用的单例状态流转：原子求值、序号防串扰、越权拒绝、发布后旧结果版本不变
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { useRecommenderStore } from '../src/recommender/store.js'
import { ROLES, REJECT_CODES, emptyRequirement } from '../src/recommender/constants.js'

test('store 集成：求值原子性、快速切换、权限拒绝、版本一致性', () => {
  const store = useRecommenderStore()

  // 1. 初始：未评估，当前版本 v1
  assert.equal(store.state.evaluation, null)
  assert.equal(store.currentVersion.value.version, 'v1')

  // 2. 空白需求提交 → 拒绝并携带替代路径，evaluation 原子替换
  const empty = store.submitRequirement(emptyRequirement())
  assert.equal(empty.status, 'rejected')
  assert.equal(empty.code, REJECT_CODES.EMPTY_REQUIREMENT)
  assert.ok(empty.alternatives.length >= 2)
  // state 为响应式代理，与返回值结构一致（同一次求值的原子结果）
  assert.deepEqual(store.state.evaluation, empty)

  // 3. 有效需求 → 结果与依据同源同版本
  const requirement = { businessScale: 'small', warehousing: 'light', scenario: 'b2c', remark: '' }
  const ok = store.submitRequirement(requirement)
  assert.equal(ok.status, 'ok')
  assert.equal(ok.version, 'v1')
  assert.ok(ok.rationale.length === 3)
  assert.equal(store.state.evaluation.version, ok.version)

  // 4. 快速连续切换场景并提交：只有最后一次求值落在 state 上
  const first = store.submitRequirement({ ...requirement, scenario: 'b2b' })
  const second = store.submitRequirement({ ...requirement, scenario: 'crossborder' })
  assert.notEqual(first, null)
  assert.notEqual(second, null)
  assert.deepEqual(store.state.evaluation, second)
  assert.equal(store.state.evaluation.requirement.scenario, 'crossborder')
  // 两次求值各自完整：结果、依据、版本号同属一次求值
  for (const outcome of [first, second]) {
    assert.equal(outcome.version, 'v1')
    assert.ok(['ok', 'rejected'].includes(outcome.status))
  }

  // 5. 越权写操作：访客 / 未授权角色一律拒绝并给出替代路径
  for (const role of [ROLES.VISITOR, ROLES.GUEST]) {
    const denied = store.saveDraft(role, [])
    assert.equal(denied.status, 'rejected')
    assert.equal(denied.code, REJECT_CODES.PERMISSION_DENIED)
    assert.ok(denied.alternatives.length >= 2)
    const deniedPublish = store.publishVersion(role, '越权发布')
    assert.equal(deniedPublish.status, 'rejected')
    assert.equal(deniedPublish.code, REJECT_CODES.PERMISSION_DENIED)
  }

  // 6. 管理员发布含冲突草稿 → 拒绝并列出问题
  const conflictDraft = store.state.draft.map((r) => ({ ...r, conditions: { ...r.conditions } }))
  conflictDraft.push({
    id: 'R-CONFLICT',
    name: '冲突规则',
    enabled: true,
    priority: 100, // 与 R-001 同优先级、条件重叠、方案不同
    conditions: { businessScale: ['small'], warehousing: [], scenario: ['b2c'] },
    solution: { code: 'SOL-OTHER', title: '另一方案', products: [], summary: '', estimatedCycle: '' }
  })
  assert.equal(store.saveDraft(ROLES.RULE_ADMIN, conflictDraft).status, 'ok')
  const badPublish = store.publishVersion(ROLES.RULE_ADMIN, '引入冲突')
  assert.equal(badPublish.status, 'rejected')
  assert.equal(badPublish.code, REJECT_CODES.DRAFT_INVALID)
  assert.ok(badPublish.problems.length > 0)
  assert.ok(badPublish.alternatives.length >= 1)
  assert.equal(store.currentVersion.value.version, 'v1') // 未发布成功，版本不变

  // 7. 回滚草稿后正常发布 v2
  assert.equal(store.discardDraft(ROLES.RULE_ADMIN).status, 'ok')
  const published = store.publishVersion(ROLES.RULE_ADMIN, '例行更新')
  assert.equal(published.status, 'ok')
  assert.equal(store.currentVersion.value.version, 'v2')

  // 8. 发布前的评估结果仍归属 v1：结果与依据版本不随后续发布漂移
  assert.equal(second.version, 'v1')
  assert.equal(store.state.evaluation.version, 'v1')

  // 9. 新版本下的求值归属 v2
  const after = store.submitRequirement(requirement)
  assert.equal(after.version, 'v2')
  assert.equal(store.state.evaluation.version, 'v2')
})
