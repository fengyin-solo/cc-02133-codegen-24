<template>
  <div class="admin-view">
    <el-card shadow="never" class="draft-card">
      <template #header>
        <div class="card-head">
          <span class="card-title">
            <el-icon><Setting /></el-icon>
            规则草稿
            <el-tag size="small" effect="plain" type="info">
              基于 {{ state.draft.baseVersionId || '初始模板' }}
            </el-tag>
          </span>
          <div class="head-actions">
            <el-button @click="addDemoConflict">
              <el-icon><Warning /></el-icon> 注入冲突规则（演示）
            </el-button>
            <el-button @click="onResetDraft">
              <el-icon><RefreshLeft /></el-icon> 重置为生效版本
            </el-button>
            <el-button type="primary" @click="openEditor(null)">
              <el-icon><Plus /></el-icon> 新建规则
            </el-button>
          </div>
        </div>
      </template>

      <el-alert
        v-if="diagnostics.conflicts.length > 0"
        type="error"
        show-icon
        :closable="false"
        class="issue-alert"
        title="检测到规则冲突：以下规则条件重叠，但推荐了不同方案，发布将被拒绝"
      >
        <div v-for="(c, i) in diagnostics.conflicts" :key="i" class="issue-line">
          · 规则「{{ c.ruleA.name }}」与「{{ c.ruleB.name }}」
          —— {{ solutionName(c.ruleA.solutionId) }} ≠ {{ solutionName(c.ruleB.solutionId) }}
        </div>
      </el-alert>
      <el-alert
        v-if="diagnostics.errors.length > 0"
        type="warning"
        show-icon
        :closable="false"
        class="issue-alert"
        title="存在非法规则，发布将被拒绝"
      >
        <div v-for="(e, i) in diagnostics.errors" :key="i" class="issue-line">· {{ e }}</div>
      </el-alert>
      <el-alert
        v-if="diagnostics.conflicts.length === 0 && diagnostics.errors.length === 0"
        type="success"
        show-icon
        :closable="false"
        class="issue-alert"
        title="草稿校验通过：无非法规则、无冲突，可发布"
      />

      <el-table :data="state.draft.rules" stripe class="rule-table">
        <el-table-column label="规则名称" prop="name" min-width="180" />
        <el-table-column label="推荐方案" min-width="200">
          <template #default="{ row }">
            {{ solutionName(row.solutionId) }}
          </template>
        </el-table-column>
        <el-table-column label="匹配条件" min-width="320">
          <template #default="{ row }">
            <div class="cond-cell">
              <el-tag
                v-for="dim in dimensionList"
                :key="dim.key"
                size="small"
                :type="isWild(row, dim.key) ? 'info' : 'primary'"
                effect="plain"
                class="cond-tag"
              >
                {{ dim.label }}：{{ conditionText(row, dim.key) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="优先级" prop="priority" width="80" align="center" />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled !== false"
              @change="(v) => onToggle(row.id, v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditor(row)">编辑</el-button>
            <el-popconfirm title="确认从草稿删除该规则？" @confirm="onDelete(row.id)">
              <template #reference>
                <el-button link type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div class="publish-bar">
        <el-input
          v-model="publishNote"
          placeholder="版本说明（可选），例如：新增小微仓储场景规则"
          class="note-input"
        />
        <el-button
          type="danger"
          size="large"
          :disabled="!canPublish"
          @click="onPublish"
        >
          <el-icon><Promotion /></el-icon>
          发布新版本（{{ nextVersionId }}）
        </el-button>
      </div>
      <p class="publish-hint">
        发布后版本立即对业务访客生效且不可修改；历史版本与匹配依据继续保留。
      </p>
    </el-card>

    <VersionTimeline :versions="state.versions" :active-id="state.publishedVersionId" />

    <RuleEditorDialog
      v-model="editorOpen"
      :rule="editingRule"
      @closed="editingRule = null"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { store } from '../store.state.js'
import { DIMENSIONS, DIMENSION_KEYS, WILDCARD } from '../engine/constants.js'
import { SOLUTIONS } from '../seed.js'
import RuleEditorDialog from '../components/RuleEditorDialog.vue'
import VersionTimeline from '../components/VersionTimeline.vue'

const { state } = store
const dimensionList = DIMENSION_KEYS.map((k) => DIMENSIONS[k])

const editorOpen = ref(false)
const editingRule = ref(null)
const publishNote = ref('')

const diagnostics = computed(() => store.draftDiagnostics())
const canPublish = computed(
  () =>
    diagnostics.value.errors.length === 0 &&
    diagnostics.value.conflicts.length === 0 &&
    state.draft.rules.length > 0
)
const nextVersionId = computed(() => `v${state.versions.length + 1}`)

function openEditor(rule) {
  editingRule.value = rule
  editorOpen.value = true
}

function isWild(row, key) {
  const c = row.conditions?.[key]
  return !c || c === WILDCARD
}

function conditionText(row, key) {
  const c = row.conditions?.[key]
  if (!c || c === WILDCARD) return '不限'
  const values = Array.isArray(c) ? c : [c]
  return values.map((v) => DIMENSIONS[key].options.find((o) => o.value === v)?.label || v).join(' / ')
}

function solutionName(id) {
  return SOLUTIONS[id]?.name || id
}

function onToggle(id, enabled) {
  try {
    store.toggleRule(id, enabled)
  } catch (err) {
    ElMessage.error(`${err.message}。替代路径：请切换为规则管理员角色`)
  }
}

function onDelete(id) {
  try {
    store.deleteRule(id)
    ElMessage.success('规则已从草稿删除')
  } catch (err) {
    ElMessage.error(`${err.message}。替代路径：请切换为规则管理员角色`)
  }
}

async function onResetDraft() {
  try {
    await ElMessageBox.confirm('将放弃草稿中的全部修改，重置为当前生效版本。确认继续？', '重置草稿', {
      type: 'warning'
    })
    store.resetDraft()
    ElMessage.success('草稿已重置')
  } catch (err) {
    if (err === 'cancel') return
    ElMessage.error(`${err.message}。替代路径：请切换为规则管理员角色`)
  }
}

/** 注入一条与既有规则条件重叠、方案不同的规则，用于演示冲突拒绝与替代路径 */
function addDemoConflict() {
  try {
    store.upsertRule({
      name: '演示冲突：大型智能全渠道 → 专家咨询',
      solutionId: 's_consult',
      conditions: { businessScale: 'large', storageNeed: 'intelligent', deliveryScene: 'omni' },
      priority: 10,
      enabled: true
    })
    ElMessage.warning('已注入冲突规则，发布将被拒绝（可删除该规则或调整优先级/条件）')
  } catch (err) {
    ElMessage.error(`${err.message}。替代路径：请切换为规则管理员角色`)
  }
}

function onPublish() {
  try {
    const version = store.publish(publishNote.value)
    ElMessage.success(`版本 ${version.id} 已发布，业务访客将基于该版本获得推荐`)
    publishNote.value = ''
  } catch (err) {
    if (err.name === 'RuleValidationError') {
      const lines = [...(err.details.errors || []), ...(err.details.conflicts || [])]
      ElMessageBox.alert(lines.join('\n') || err.message, '发布被拒绝：请先消除规则问题', {
        type: 'error',
        confirmButtonText: '知道了'
      })
    } else {
      ElMessage.error(`${err.message}。替代路径：请切换为规则管理员角色`)
    }
  }
}
</script>

<style lang="scss">
.admin-view {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.draft-card {
  border-radius: $radius-lg;
  border: 1px solid $border-light;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.card-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.head-actions {
  display: flex;
  gap: $spacing-xs;
  flex-wrap: wrap;
}

.issue-alert {
  margin-bottom: $spacing-md;

  .issue-line {
    font-size: $font-size-sm;
    line-height: 1.8;
  }
}

.cond-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cond-tag {
  margin: 2px 0;
}

.publish-bar {
  display: flex;
  gap: $spacing-md;
  align-items: center;
  margin-top: $spacing-lg;

  .note-input {
    flex: 1;
  }
}

.publish-hint {
  margin: $spacing-xs 0 0;
  font-size: $font-size-xs;
  color: $text-secondary;
}
</style>
