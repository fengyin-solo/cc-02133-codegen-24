<template>
  <div class="recommend-page">
    <!-- 页面头部 -->
    <section class="page-header">
      <div class="container">
        <h1 class="page-title">方案推荐器</h1>
        <p class="page-subtitle">填写业务需求，基于已发布规则实时匹配专属智慧物流方案</p>
        <div class="header-meta">
          <el-tag effect="dark" round class="version-tag">
            <el-icon class="tag-icon"><Collection /></el-icon>
            当前规则版本：{{ currentVersion?.version || '未发布' }}
          </el-tag>
          <el-tag effect="dark" type="info" round class="version-tag">
            <el-icon class="tag-icon"><User /></el-icon>
            当前角色：{{ roleLabel }}（只读）
          </el-tag>
        </div>
      </div>
    </section>

    <section class="section section-gray">
      <div class="container">
        <div class="recommend-grid">
          <!-- 需求表单 -->
          <div class="form-panel card">
            <h3 class="panel-title">
              <el-icon><EditPen /></el-icon>
              业务需求
            </h3>
            <p class="panel-desc">至少填写一项，需求越完整推荐越精准</p>

            <el-form label-position="top" @submit.prevent>
              <el-form-item label="业务规模">
                <el-select
                  v-model="form.businessScale"
                  placeholder="请选择业务规模"
                  clearable
                  class="full-width"
                >
                  <el-option
                    v-for="item in BUSINESS_SCALES"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="仓储需求">
                <el-select
                  v-model="form.warehousing"
                  placeholder="请选择仓储需求"
                  clearable
                  class="full-width"
                >
                  <el-option
                    v-for="item in WAREHOUSING_NEEDS"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="配送场景">
                <div class="scenario-cards">
                  <button
                    v-for="item in DELIVERY_SCENARIOS"
                    :key="item.value"
                    type="button"
                    class="scenario-card"
                    :class="{ active: form.scenario === item.value }"
                    @click="toggleScenario(item.value)"
                  >
                    {{ item.label }}
                  </button>
                </div>
              </el-form-item>

              <el-form-item label="补充说明（选填）">
                <el-input
                  v-model="form.remark"
                  type="textarea"
                  :rows="3"
                  maxlength="200"
                  show-word-limit
                  placeholder="例如：日均单量、主要配送区域、现有系统等"
                />
              </el-form-item>

              <div class="form-actions">
                <el-button type="primary" size="large" class="submit-btn" @click="handleSubmit">
                  获取推荐方案
                  <el-icon class="el-icon--right"><Promotion /></el-icon>
                </el-button>
                <el-button size="large" @click="handleClear">清空</el-button>
              </div>
            </el-form>
          </div>

          <!-- 推荐结果区：结果与匹配依据始终来自同一次求值、同一规则版本 -->
          <div class="result-panel">
            <!-- 未评估 -->
            <div v-if="!evaluation" class="card result-placeholder">
              <el-icon :size="56" class="placeholder-icon"><Aim /></el-icon>
              <h3>等待评估</h3>
              <p>填写左侧需求并提交，这里将展示推荐方案与完整匹配依据</p>
            </div>

            <!-- 评估成功 -->
            <template v-else-if="evaluation.status === 'ok'">
              <div class="card result-card">
                <div class="result-head">
                  <el-tag type="success" effect="dark" round>推荐成功</el-tag>
                  <span class="result-version">规则版本 {{ evaluation.version }}</span>
                </div>
                <h3 class="solution-title">{{ evaluation.result.solution.title }}</h3>
                <p class="solution-code">方案编号：{{ evaluation.result.solution.code }}</p>
                <p class="solution-summary">{{ evaluation.result.solution.summary }}</p>
                <div class="solution-products">
                  <el-tag
                    v-for="product in evaluation.result.solution.products"
                    :key="product"
                    class="product-tag"
                  >
                    {{ product }}
                  </el-tag>
                </div>
                <div class="solution-meta">
                  <span>
                    <el-icon><Timer /></el-icon>
                    预计实施周期：{{ evaluation.result.solution.estimatedCycle }}
                  </span>
                  <span>
                    <el-icon><Document /></el-icon>
                    命中规则：{{ evaluation.result.ruleName }}（优先级 {{ evaluation.result.priority }}）
                  </span>
                </div>
                <el-button type="primary" round @click="$router.push('/contact')">
                  咨询该方案
                  <el-icon class="el-icon--right"><ArrowRight /></el-icon>
                </el-button>
              </div>

              <!-- 匹配依据：与推荐结果同一次求值产出 -->
              <div class="card rationale-card">
                <h4 class="rationale-title">
                  <el-icon><View /></el-icon>
                  匹配依据
                  <span class="rationale-version">版本 {{ evaluation.version }}</span>
                </h4>
                <div class="rationale-table">
                  <div class="rationale-row rationale-head">
                    <span>需求维度</span>
                    <span>您的需求</span>
                    <span>规则条件</span>
                    <span>命中</span>
                  </div>
                  <div v-for="item in evaluation.rationale" :key="item.dimension" class="rationale-row">
                    <span>{{ item.dimensionLabel }}</span>
                    <span>{{ item.requirementLabel }}</span>
                    <span>{{ item.ruleCondition }}</span>
                    <span>
                      <el-icon v-if="item.matched" class="hit-icon"><CircleCheckFilled /></el-icon>
                      <el-icon v-else class="miss-icon"><CircleClose /></el-icon>
                    </span>
                  </div>
                </div>
                <div class="requirement-snapshot">
                  <span class="snapshot-label">本次评估需求快照：</span>
                  <el-tag
                    v-for="chip in requirementChips"
                    :key="chip"
                    size="small"
                    effect="plain"
                    class="snapshot-chip"
                  >
                    {{ chip }}
                  </el-tag>
                  <span class="snapshot-time">{{ formatTime(evaluation.evaluatedAt) }}</span>
                </div>
              </div>
            </template>

            <!-- 评估被拒绝：原因 + 替代路径 -->
            <div v-else class="card reject-card">
              <el-alert
                :title="evaluation.message"
                :description="`拒绝码：${evaluation.code} ｜ 规则版本：${evaluation.version}`"
                type="warning"
                :closable="false"
                show-icon
              />
              <div v-if="evaluation.matchedRules?.length" class="conflict-rules">
                <p class="conflict-title">冲突规则：</p>
                <el-tag
                  v-for="rule in evaluation.matchedRules"
                  :key="rule.id"
                  type="danger"
                  effect="plain"
                  class="conflict-tag"
                >
                  {{ rule.name }}（优先级 {{ rule.priority }} → {{ rule.solutionCode }}）
                </el-tag>
              </div>
              <div class="alternatives">
                <p class="alternatives-title">您可以选择以下替代路径：</p>
                <div
                  v-for="alt in evaluation.alternatives"
                  :key="alt.action"
                  class="alternative-item"
                  @click="handleAlternative(alt.action)"
                >
                  <div class="alternative-label">
                    <el-icon><Right /></el-icon>
                    {{ alt.label }}
                  </div>
                  <p class="alternative-desc">{{ alt.description }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  BUSINESS_SCALES,
  WAREHOUSING_NEEDS,
  DELIVERY_SCENARIOS,
  ROLES,
  ROLE_OPTIONS,
  DIMENSION_LABELS,
  optionLabel,
  emptyRequirement
} from '@/recommender/constants.js'
import { useRecommenderStore } from '@/recommender/store.js'
import { useSession } from '@/recommender/session.js'

const router = useRouter()
const store = useRecommenderStore()
const { session, setRole } = useSession()

const form = reactive(emptyRequirement())

const evaluation = computed(() => store.state.evaluation)
const currentVersion = computed(() => store.currentVersion.value)

const roleLabel = computed(() => {
  const hit = ROLE_OPTIONS.find((r) => r.value === session.role)
  return hit ? hit.label : session.role
})

// 需求快照标签：与结果同对象取值，保证展示一致
const requirementChips = computed(() => {
  const req = evaluation.value?.requirement
  if (!req) return []
  const chips = []
  if (req.businessScale) chips.push(`${DIMENSION_LABELS.businessScale}：${optionLabel(BUSINESS_SCALES, req.businessScale)}`)
  if (req.warehousing) chips.push(`${DIMENSION_LABELS.warehousing}：${optionLabel(WAREHOUSING_NEEDS, req.warehousing)}`)
  if (req.scenario) chips.push(`${DIMENSION_LABELS.scenario}：${optionLabel(DELIVERY_SCENARIOS, req.scenario)}`)
  return chips
})

// 场景快速切换：仅更新表单，不触发求值；
// 已展示的结果与依据仍保持提交时的同一版本快照，不受切换影响
const toggleScenario = (value) => {
  form.scenario = form.scenario === value ? '' : value
}

const handleSubmit = () => {
  const outcome = store.submitRequirement({ ...form })
  if (!outcome) return // 过期求值被丢弃
  if (outcome.status === 'rejected') {
    ElMessage.warning(outcome.message)
  } else {
    ElMessage.success(`已基于规则版本 ${outcome.version} 生成推荐`)
  }
}

const handleClear = () => {
  Object.assign(form, emptyRequirement())
  store.resetEvaluation()
}

const formatTime = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

// 替代路径动作
const handleAlternative = async (action) => {
  switch (action) {
    case 'fill-form':
      document.querySelector('.form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    case 'reset-form':
      handleClear()
      break
    case 'goto-products':
      router.push('/products')
      break
    case 'goto-contact':
      router.push('/contact')
      break
    case 'goto-home':
      router.push('/')
      break
    case 'goto-recommend':
      handleClear()
      break
    case 'notify-admin':
    case 'switch-role':
      try {
        await ElMessageBox.confirm(
          '将切换为「规则管理员」角色并前往规则管理页处理，是否继续？',
          '切换角色',
          { confirmButtonText: '切换并前往', cancelButtonText: '取消', type: 'info' }
        )
        setRole(ROLES.RULE_ADMIN)
        router.push('/admin/rules')
      } catch {
        // 用户取消
      }
      break
    default:
      break
  }
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

.version-tag {
  .tag-icon {
    margin-right: 4px;
    vertical-align: -2px;
  }
}

.recommend-grid {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: $spacing-lg;
  align-items: start;
}

.form-panel {
  position: sticky;
  top: 90px;

  &:hover {
    transform: none;
  }
}

.panel-title {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  font-size: $font-size-lg;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.panel-desc {
  font-size: $font-size-sm;
  color: $text-secondary;
  margin-bottom: $spacing-lg;
}

.full-width {
  width: 100%;
}

.scenario-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-sm;
  width: 100%;
}

.scenario-card {
  padding: 10px 8px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $bg-white;
  color: $text-regular;
  font-size: $font-size-sm;
  cursor: pointer;
  transition: all 0.25s;

  &:hover {
    border-color: $primary-color;
    color: $primary-color;
  }

  &.active {
    background: $primary-color;
    border-color: $primary-color;
    color: #fff;
    font-weight: 500;
  }
}

.form-actions {
  display: flex;
  gap: $spacing-sm;

  .submit-btn {
    flex: 1;
  }
}

.result-panel {
  min-height: 420px;
}

.result-placeholder {
  height: 100%;
  min-height: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: $text-secondary;
  text-align: center;

  &:hover {
    transform: none;
  }

  .placeholder-icon {
    color: $border-color;
    margin-bottom: $spacing-md;
  }

  h3 {
    color: $text-primary;
    margin-bottom: $spacing-xs;
  }
}

.result-card {
  margin-bottom: $spacing-lg;

  &:hover {
    transform: none;
  }
}

.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-md;
}

.result-version {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.solution-title {
  font-size: $font-size-xl;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.solution-code {
  font-size: $font-size-xs;
  color: $text-placeholder;
  margin-bottom: $spacing-md;
}

.solution-summary {
  color: $text-regular;
  line-height: $line-height-loose;
  margin-bottom: $spacing-md;
}

.solution-products {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
  margin-bottom: $spacing-md;

  .product-tag {
    margin-right: 0;
  }
}

.solution-meta {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-lg;
  font-size: $font-size-sm;
  color: $text-secondary;
  margin-bottom: $spacing-lg;

  .el-icon {
    vertical-align: -2px;
    margin-right: 4px;
    color: $primary-color;
  }
}

.rationale-card {
  &:hover {
    transform: none;
  }
}

.rationale-title {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  font-size: $font-size-base;
  color: $text-primary;
  margin-bottom: $spacing-md;
}

.rationale-version {
  margin-left: auto;
  font-size: $font-size-xs;
  color: $text-secondary;
  font-weight: normal;
}

.rationale-table {
  border: 1px solid $border-light;
  border-radius: $radius-md;
  overflow: hidden;
  margin-bottom: $spacing-md;
}

.rationale-row {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1.4fr 60px;
  padding: 10px $spacing-sm;
  font-size: $font-size-sm;
  color: $text-regular;
  border-bottom: 1px solid $border-light;
  align-items: center;

  &:last-child {
    border-bottom: none;
  }

  &.rationale-head {
    background: $bg-color;
    font-weight: 600;
    color: $text-primary;
  }
}

.hit-icon {
  color: $success-color;
  font-size: 18px;
}

.miss-icon {
  color: $danger-color;
  font-size: 18px;
}

.requirement-snapshot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $spacing-xs;
  font-size: $font-size-xs;
  color: $text-secondary;

  .snapshot-label {
    flex-shrink: 0;
  }

  .snapshot-chip {
    margin-right: 0;
  }

  .snapshot-time {
    margin-left: auto;
    color: $text-placeholder;
  }
}

.reject-card {
  &:hover {
    transform: none;
  }
}

.conflict-rules {
  margin-top: $spacing-md;

  .conflict-title {
    font-size: $font-size-sm;
    color: $text-primary;
    margin-bottom: $spacing-xs;
  }

  .conflict-tag {
    margin: 0 $spacing-xs $spacing-xs 0;
  }
}

.alternatives {
  margin-top: $spacing-lg;
}

.alternatives-title {
  font-size: $font-size-sm;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-sm;
}

.alternative-item {
  padding: $spacing-sm $spacing-md;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  margin-bottom: $spacing-sm;
  cursor: pointer;
  transition: all 0.25s;

  &:hover {
    border-color: $primary-color;
    background: rgba($primary-color, 0.04);
  }
}

.alternative-label {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  font-size: $font-size-sm;
  font-weight: 600;
  color: $primary-color;
}

.alternative-desc {
  font-size: $font-size-xs;
  color: $text-secondary;
  margin-top: 2px;
  padding-left: 20px;
}

@media (max-width: $breakpoint-lg) {
  .recommend-grid {
    grid-template-columns: 1fr;
  }

  .form-panel {
    position: static;
  }
}

@media (max-width: $breakpoint-md) {
  .page-title {
    font-size: $font-size-xxl;
  }

  .scenario-cards {
    grid-template-columns: 1fr;
  }

  .rationale-row {
    grid-template-columns: 1fr 1.2fr 1.2fr 44px;
    font-size: $font-size-xs;
  }

  .solution-meta {
    gap: $spacing-sm;
  }
}
</style>
