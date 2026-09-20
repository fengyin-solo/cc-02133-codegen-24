<template>
  <div class="rule-admin-page">
    <!-- 页面头部 -->
    <section class="page-header">
      <div class="container">
        <h1 class="page-title">推荐规则管理</h1>
        <p class="page-subtitle">维护业务规模、仓储需求与配送场景的匹配条件，发布后访客端立即生效</p>
        <div class="header-meta">
          <el-tag effect="dark" round>当前发布版本：{{ currentVersion?.version || '无' }}</el-tag>
          <el-tag effect="dark" type="warning" round>草稿规则：{{ draft.length }} 条</el-tag>
        </div>
      </div>
    </section>

    <section class="section section-gray">
      <div class="container">
        <!-- 操作被拒（如会话中角色被切换） -->
        <el-alert
          v-if="rejection"
          class="rejection-alert"
          :title="rejection.message"
          type="error"
          :closable="true"
          show-icon
          @close="rejection = null"
        >
          <template #default>
            <p class="rejection-code">拒绝码：{{ rejection.code }}</p>
            <div class="rejection-alternatives">
              <el-button
                v-for="alt in rejection.alternatives"
                :key="alt.action"
                size="small"
                @click="handleAlternative(alt.action)"
              >
                {{ alt.label }}
              </el-button>
            </div>
          </template>
        </el-alert>

        <!-- 发布校验失败 -->
        <el-alert
          v-if="publishProblems.length"
          class="rejection-alert"
          title="草稿未通过发布校验，请修订后重试"
          type="warning"
          :closable="true"
          show-icon
          @close="publishProblems = []"
        >
          <template #default>
            <ul class="problem-list">
              <li v-for="(problem, index) in publishProblems" :key="index">{{ problem.message }}</li>
            </ul>
            <div class="rejection-alternatives">
              <el-button size="small" type="primary" @click="publishProblems = []">修订草稿规则</el-button>
              <el-button size="small" @click="handleDiscard">放弃本次修改</el-button>
            </div>
          </template>
        </el-alert>

        <!-- 草稿规则 -->
        <div class="card admin-card">
          <div class="card-head">
            <h3 class="card-title">
              <el-icon><SetUp /></el-icon>
              草稿规则（未发布）
            </h3>
            <div class="card-actions">
              <el-button @click="openEditor()">
                <el-icon class="el-icon--left"><Plus /></el-icon>
                新增规则
              </el-button>
              <el-button @click="handleDiscard">放弃修改</el-button>
              <el-button type="primary" @click="handlePublish">
                <el-icon class="el-icon--left"><Promotion /></el-icon>
                发布新版本
              </el-button>
            </div>
          </div>

          <el-table :data="draft" class="rule-table" row-key="id">
            <el-table-column label="优先级" width="90" align="center">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ row.priority }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="规则名称" min-width="160">
              <template #default="{ row }">
                <span class="rule-name">{{ row.name }}</span>
                <p class="rule-id">{{ row.id }}</p>
              </template>
            </el-table-column>
            <el-table-column label="匹配条件" min-width="280">
              <template #default="{ row }">
                <div class="condition-cell">
                  <div v-for="field in REQUIREMENT_FIELDS" :key="field" class="condition-line">
                    <span class="condition-dim">{{ DIMENSION_LABELS[field] }}</span>
                    <template v-if="row.conditions[field]?.length">
                      <el-tag
                        v-for="value in row.conditions[field]"
                        :key="value"
                        size="small"
                        class="condition-tag"
                      >
                        {{ optionLabel(DIMENSION_OPTIONS[field], value) }}
                      </el-tag>
                    </template>
                    <span v-else class="condition-any">不限</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="推荐方案" min-width="200">
              <template #default="{ row }">
                <span>{{ row.solution?.title || '—' }}</span>
                <p class="rule-id">{{ row.solution?.code }}</p>
              </template>
            </el-table-column>
            <el-table-column label="启用" width="80" align="center">
              <template #default="{ row }">
                <el-switch :model-value="row.enabled" @change="toggleRule(row, $event)" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" align="center">
              <template #default="{ row, $index }">
                <el-button size="small" text type="primary" @click="openEditor(row)">编辑</el-button>
                <el-button size="small" text type="danger" @click="handleDelete(row, $index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 版本历史 -->
        <div class="card admin-card">
          <h3 class="card-title">
            <el-icon><Clock /></el-icon>
            版本历史（已发布版本不可修改）
          </h3>
          <el-timeline class="version-timeline">
            <el-timeline-item
              v-for="version in [...versions].reverse()"
              :key="version.version"
              :type="version.version === currentVersion?.version ? 'primary' : ''"
              :timestamp="formatTime(version.publishedAt)"
              placement="top"
            >
              <div class="version-item">
                <div class="version-head">
                  <span class="version-tag-text">{{ version.version }}</span>
                  <el-tag v-if="version.version === currentVersion?.version" size="small" type="success">
                    当前生效
                  </el-tag>
                </div>
                <p class="version-log">{{ version.changelog }}</p>
                <p class="version-meta">
                  发布人：{{ roleLabelOf(version.publishedBy) }} ｜ 规则 {{ version.rules.length }} 条
                </p>
              </div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>
    </section>

    <!-- 规则编辑对话框 -->
    <el-dialog
      v-model="editorVisible"
      :title="editingRule?.id && draft.some((r) => r.id === editingRule.id) ? '编辑规则' : '新增规则'"
      width="640px"
      class="rule-editor-dialog"
    >
      <el-form v-if="editingRule" label-position="top">
        <el-form-item label="规则名称" required>
          <el-input v-model="editingRule.name" placeholder="例如：中小电商仓配一体方案" />
        </el-form-item>

        <div class="editor-row">
          <el-form-item label="优先级（数值越大越优先）" class="editor-col">
            <el-input-number v-model="editingRule.priority" :min="0" :max="999" class="full-width" />
          </el-form-item>
          <el-form-item label="是否启用" class="editor-col">
            <el-switch v-model="editingRule.enabled" />
          </el-form-item>
        </div>

        <el-form-item
          v-for="field in REQUIREMENT_FIELDS"
          :key="field"
          :label="`匹配条件 - ${DIMENSION_LABELS[field]}（不选表示不限）`"
        >
          <el-select
            v-model="editingRule.conditions[field]"
            multiple
            clearable
            class="full-width"
            :placeholder="`不限${DIMENSION_LABELS[field]}`"
          >
            <el-option
              v-for="item in DIMENSION_OPTIONS[field]"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-divider content-position="left">推荐方案</el-divider>

        <el-form-item label="方案标题" required>
          <el-input v-model="editingRule.solution.title" placeholder="例如：轻量仓配一体方案（WMS + DMS）" />
        </el-form-item>
        <div class="editor-row">
          <el-form-item label="方案编号" class="editor-col">
            <el-input v-model="editingRule.solution.code" placeholder="SOL-XXX" />
          </el-form-item>
          <el-form-item label="预计实施周期" class="editor-col">
            <el-input v-model="editingRule.solution.estimatedCycle" placeholder="例如：4-6 周" />
          </el-form-item>
        </div>
        <el-form-item label="包含产品（每行一个）">
          <el-input
            v-model="productsText"
            type="textarea"
            :rows="3"
            placeholder="智慧仓储管理系统 WMS&#10;配送调度系统 DMS"
          />
        </el-form-item>
        <el-form-item label="方案摘要">
          <el-input v-model="editingRule.solution.summary" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveRule">保存到草稿</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  BUSINESS_SCALES,
  WAREHOUSING_NEEDS,
  DELIVERY_SCENARIOS,
  REQUIREMENT_FIELDS,
  DIMENSION_LABELS,
  ROLE_OPTIONS,
  ROLES,
  optionLabel
} from '@/recommender/constants.js'
import { useRecommenderStore } from '@/recommender/store.js'
import { useSession } from '@/recommender/session.js'

const DIMENSION_OPTIONS = {
  businessScale: BUSINESS_SCALES,
  warehousing: WAREHOUSING_NEEDS,
  scenario: DELIVERY_SCENARIOS
}

const router = useRouter()
const store = useRecommenderStore()
const { session, setRole } = useSession()

const draft = computed(() => store.state.draft)
const versions = computed(() => store.state.versions)
const currentVersion = computed(() => store.currentVersion.value)

const rejection = ref(null) // 写操作被拒（权限不足等）
const publishProblems = ref([]) // 发布校验问题

// ============ 规则编辑 ============
const editorVisible = ref(false)
const editingRule = ref(null)
const productsText = ref('')

const newRuleTemplate = () => ({
  id: `R-${Date.now().toString(36).toUpperCase()}`,
  name: '',
  enabled: true,
  priority: 50,
  conditions: { businessScale: [], warehousing: [], scenario: [] },
  solution: { code: '', title: '', products: [], summary: '', estimatedCycle: '' }
})

const openEditor = (rule) => {
  const source = rule ? JSON.parse(JSON.stringify(rule)) : newRuleTemplate()
  editingRule.value = source
  productsText.value = (source.solution.products || []).join('\n')
  editorVisible.value = true
}

const handleSaveRule = () => {
  const rule = editingRule.value
  if (!rule.name.trim()) {
    ElMessage.warning('请填写规则名称')
    return
  }
  if (!rule.solution.title.trim()) {
    ElMessage.warning('请填写方案标题')
    return
  }
  rule.solution.products = productsText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const next = draft.value.map((r) => (r.id === rule.id ? rule : r))
  if (!draft.value.some((r) => r.id === rule.id)) next.push(rule)
  commitDraft(next, '规则已保存到草稿')
}

const toggleRule = (rule, enabled) => {
  const next = draft.value.map((r) => (r.id === rule.id ? { ...r, enabled } : r))
  commitDraft(next, enabled ? '规则已启用' : '规则已停用')
}

const handleDelete = async (rule) => {
  try {
    await ElMessageBox.confirm(`确定删除规则「${rule.name}」吗？`, '删除规则', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  commitDraft(draft.value.filter((r) => r.id !== rule.id), '规则已删除')
}

// 所有草稿写操作统一入口：越权时展示拒绝原因与替代路径
const commitDraft = (rules, successMessage) => {
  const result = store.saveDraft(session.role, rules)
  if (result.status === 'rejected') {
    rejection.value = result
    return
  }
  rejection.value = null
  editorVisible.value = false
  ElMessage.success(successMessage)
}

// ============ 发布 / 放弃 ============
const handlePublish = async () => {
  let changelog = ''
  try {
    const { value } = await ElMessageBox.prompt('请输入本次发布的变更说明', '发布新版本', {
      confirmButtonText: '发布',
      cancelButtonText: '取消',
      inputPlaceholder: '例如：新增跨境场景规则',
      inputValidator: (v) => (v && v.trim() ? true : '变更说明不能为空')
    })
    changelog = value.trim()
  } catch {
    return
  }

  const result = store.publishVersion(session.role, changelog)
  if (result.status === 'rejected') {
    if (result.problems) {
      publishProblems.value = result.problems
    } else {
      rejection.value = result
    }
    return
  }
  publishProblems.value = []
  ElMessage.success(`已发布 ${result.version.version}，访客端推荐即刻生效`)
}

const handleDiscard = async () => {
  try {
    await ElMessageBox.confirm('草稿将回滚到当前已发布版本，确定放弃全部修改吗？', '放弃修改', {
      confirmButtonText: '放弃修改',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  const result = store.discardDraft(session.role)
  if (result.status === 'rejected') {
    rejection.value = result
    return
  }
  publishProblems.value = []
  ElMessage.success('草稿已回滚')
}

// ============ 替代路径 ============
const handleAlternative = async (action) => {
  switch (action) {
    case 'switch-role':
      setRole(ROLES.RULE_ADMIN)
      ElMessage.success('已切换为规则管理员')
      break
    case 'goto-recommend':
      router.push('/recommend')
      break
    case 'goto-home':
      router.push('/')
      break
    case 'discard-draft':
      handleDiscard()
      break
    case 'fix-draft':
    default:
      document.querySelector('.rule-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
  }
}

// ============ 展示辅助 ============
const roleLabelOf = (role) => ROLE_OPTIONS.find((r) => r.value === role)?.label || role

const formatTime = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.page-header {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: $spacing-xxl 0;
  text-align: center;
  color: #fff;
}

.page-title {
  font-size: $font-size-xxxl;
  font-weight: 700;
  margin-bottom: $spacing-sm;
}

.page-subtitle {
  font-size: $font-size-lg;
  opacity: 0.75;
  margin-bottom: $spacing-lg;
}

.header-meta {
  display: flex;
  justify-content: center;
  gap: $spacing-md;
  flex-wrap: wrap;
}

.rejection-alert {
  margin-bottom: $spacing-lg;
}

.rejection-code {
  font-size: $font-size-xs;
  color: $text-secondary;
  margin: 4px 0 $spacing-sm;
}

.rejection-alternatives {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  margin-top: $spacing-sm;
}

.problem-list {
  margin: $spacing-xs 0 $spacing-sm;
  padding-left: 18px;
  font-size: $font-size-sm;

  li {
    margin-bottom: 4px;
  }
}

.admin-card {
  margin-bottom: $spacing-lg;

  &:hover {
    transform: none;
  }
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $spacing-md;
  margin-bottom: $spacing-lg;
}

.card-title {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  font-size: $font-size-lg;
  color: $text-primary;
}

.card-actions {
  display: flex;
  gap: $spacing-sm;
  flex-wrap: wrap;

  .el-button {
    margin-left: 0;
  }
}

.rule-name {
  font-weight: 600;
  color: $text-primary;
}

.rule-id {
  font-size: $font-size-xs;
  color: $text-placeholder;
}

.condition-cell {
  .condition-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 4px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .condition-dim {
    flex-shrink: 0;
    font-size: $font-size-xs;
    color: $text-secondary;
    min-width: 60px;
  }

  .condition-tag {
    margin-right: 0;
  }

  .condition-any {
    font-size: $font-size-xs;
    color: $text-placeholder;
  }
}

.version-timeline {
  margin-top: $spacing-md;
  padding-left: 4px;
}

.version-item {
  .version-head {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    margin-bottom: 4px;
  }

  .version-tag-text {
    font-weight: 700;
    color: $text-primary;
  }

  .version-log {
    font-size: $font-size-sm;
    color: $text-regular;
  }

  .version-meta {
    font-size: $font-size-xs;
    color: $text-secondary;
  }
}

.editor-row {
  display: flex;
  gap: $spacing-md;

  .editor-col {
    flex: 1;
  }
}

.full-width {
  width: 100%;
}

@media (max-width: $breakpoint-md) {
  .page-title {
    font-size: $font-size-xxl;
  }

  .card-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .editor-row {
    flex-direction: column;
    gap: 0;
  }
}
</style>
