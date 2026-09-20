// 方案推荐器 - 响应式状态（Vue 单例）
// 一致性设计：
// 1. evaluation 为单一响应式对象，每次求值整体替换 —— 推荐结果、匹配依据、版本号
//    由引擎在同一次同步调用中产自同一版本快照，UI 任何时刻只渲染完整的一份。
// 2. seq 单调递增，提交前校验序号：快速切换场景 / 连续点击时，过期求值结果直接丢弃，
//    只有最后一次求值能落到界面上。
// 3. 窗口尺寸变化不触发任何重算（响应式布局纯 CSS 实现），展示状态不受 resize 影响。

import { reactive, computed } from 'vue'
import { createRepository } from './repository.js'
import { evaluateRequirements, deepFreeze, deepClone } from './engine.js'

const repository = createRepository(typeof localStorage !== 'undefined' ? localStorage : undefined)

const state = reactive({
  // 最近一次求值的原子结果（成功或拒绝），null 表示尚未评估
  evaluation: null,
  // 求值序号：每次提交 +1，用于丢弃过期结果
  seq: 0,
  // 仓库镜像（发布 / 保存草稿后刷新，驱动界面更新）
  versions: repository.getVersions(),
  draft: repository.getDraft()
})

function refreshRepo() {
  state.versions = repository.getVersions()
  state.draft = repository.getDraft()
}

export function useRecommenderStore() {
  const currentVersion = computed(() => state.versions[state.versions.length - 1] || null)

  // 提交需求并求值：需求快照在入口处冻结，结果与依据同源同版本
  const submitRequirement = (requirement) => {
    const seq = ++state.seq
    const snapshot = deepFreeze(deepClone(requirement))
    const outcome = evaluateRequirements(snapshot, repository.getCurrentVersion())
    if (seq !== state.seq) return null // 已有更新的求值，丢弃过期结果
    state.evaluation = outcome
    return outcome
  }

  const resetEvaluation = () => {
    state.seq++ // 使进行中的求值失效
    state.evaluation = null
  }

  // ---- 管理端动作（权限在仓库层校验，越权返回拒绝对象） ----
  const saveDraft = (role, rules) => {
    const result = repository.saveDraft(role, rules)
    if (result.status === 'ok') refreshRepo()
    return result
  }

  const discardDraft = (role) => {
    const result = repository.discardDraft(role)
    if (result.status === 'ok') refreshRepo()
    return result
  }

  const publishVersion = (role, changelog) => {
    const result = repository.publish(role, changelog)
    if (result.status === 'ok') refreshRepo()
    return result
  }

  return {
    state,
    currentVersion,
    submitRequirement,
    resetEvaluation,
    saveDraft,
    discardDraft,
    publishVersion
  }
}
