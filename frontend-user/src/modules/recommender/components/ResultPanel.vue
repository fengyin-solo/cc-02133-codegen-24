<template>
  <el-card shadow="never" class="result-card" :class="`is-${snapshot.status}`">
    <template #header>
      <div class="card-head">
        <span class="card-title">
          <el-icon><DocumentChecked /></el-icon>
          推荐结果与匹配依据
        </span>
        <el-tag
          :type="snapshot.status === 'OK' ? 'success' : snapshot.status === 'RULE_CONFLICT' ? 'danger' : 'warning'"
          effect="light"
        >
          {{ statusText }}
        </el-tag>
      </div>
    </template>

    <!-- 成功推荐 -->
    <template v-if="snapshot.status === 'OK'">
      <el-result icon="success" :title="snapshot.solution.name" sub-title="依据当前已发布规则版本匹配命中">
        <template #extra>
          <el-tag effect="plain" type="info">命中规则：{{ snapshot.recommended.name }}</el-tag>
        </template>
      </el-result>

      <p class="solution-summary">{{ snapshot.solution.summary }}</p>

      <div class="solution-block">
        <h4>方案能力</h4>
        <el-tag
          v-for="f in snapshot.solution.features"
          :key="f"
          class="feature-tag"
          type="primary"
          effect="light"
        >
          {{ f }}
        </el-tag>
      </div>

      <div class="solution-block">
        <h4>适用对象</h4>
        <p class="muted">{{ snapshot.solution.suitable }}</p>
      </div>

      <el-divider content-position="left">匹配依据（逐条维度）</el-divider>
      <el-timeline>
        <el-timeline-item
          v-for="b in snapshot.basis"
          :key="b.dimension"
          :type="b.matched ? 'success' : 'danger'"
          :hollow="!b.matched"
          :timestamp="b.conditionText === '不限' ? '规则条件：不限（通配）' : `规则条件：${b.conditionText}`"
          placement="top"
        >
          <strong>{{ b.dimensionLabel }}</strong>
          <p class="basis-text" :class="{ muted: !b.matched }">{{ b.text }}</p>
        </el-timeline-item>
      </el-timeline>
    </template>

    <!-- 拒绝 / 替代路径 -->
    <template v-else>
      <el-result :icon="resultIcon" :title="rejectTitle" :sub-title="rejectMessage">
        <template #extra>
          <div class="alt-paths">
            <template v-if="snapshot.status === 'EMPTY_DEMAND' || snapshot.status === 'INCOMPLETE_DEMAND'">
              <el-button type="primary" @click="$emit('complete-demand')">
                去补全需求（{{ missingLabels }}）
              </el-button>
              <el-button @click="$emit('use-quick-scene')">使用快速场景一键填充</el-button>
            </template>

            <template v-else-if="snapshot.status === 'NO_MATCH'">
              <el-button type="primary" @click="$emit('contact-consultant')">
                预约解决方案专家（人工兜底）
              </el-button>
              <el-button @click="$emit('adjust-demand')">调整匹配维度后重试</el-button>
            </template>

            <template v-else-if="snapshot.status === 'RULE_CONFLICT'">
              <el-alert
                type="error"
                :closable="false"
                show-icon
                class="conflict-alert"
                title="当前版本规则冲突，系统已拒绝给出唯一推荐"
              >
                <div class="conflict-rules">
                  <div v-for="r in snapshot.matchedRules" :key="r.id">
                    · 规则「{{ r.name }}」→ {{ solutionName(r.solutionId) }}
                  </div>
                </div>
                <div class="conflict-actions">
                  <el-button size="small" type="primary" :disabled="!canEdit" @click="$emit('goto-admin')">
                    前往规则管理消除冲突
                  </el-button>
                  <el-button size="small" @click="$emit('contact-consultant')">联系专家获取建议</el-button>
                  <el-tag v-if="!canEdit" size="small" type="info" effect="plain">
                    仅规则管理员可修改规则
                  </el-tag>
                </div>
              </el-alert>
            </template>

            <template v-else-if="snapshot.status === 'NO_PUBLISHED_RULES'">
              <el-button type="primary" :disabled="!canEdit" @click="$emit('goto-admin')">
                前往规则管理并发布首个版本
              </el-button>
              <el-tag v-if="!canEdit" size="small" type="info" effect="plain">
                规则尚未发布，请联系规则管理员
              </el-tag>
            </template>
          </div>
        </template>
      </el-result>
    </template>

    <div class="version-foot">
      <el-icon><CollectionTag /></el-icon>
      <span>
        结果版本：
        <strong>{{ snapshot.versionLabel }}</strong>
        <template v-if="snapshot.versionNote">｜{{ snapshot.versionNote }}</template>
        <template v-if="snapshot.publishedAt">｜发布于 {{ formatTime(snapshot.publishedAt) }}</template>
        ｜评估于 {{ formatTime(snapshot.evaluatedAt) }}
      </span>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { DIMENSIONS, STATUS } from '../engine/constants.js'
import { SOLUTIONS } from '../seed.js'

const props = defineProps({
  snapshot: { type: Object, required: true },
  canEdit: { type: Boolean, default: false }
})
defineEmits([
  'complete-demand',
  'use-quick-scene',
  'contact-consultant',
  'adjust-demand',
  'goto-admin'
])

const STATUS_TEXT = {
  [STATUS.OK]: '匹配成功',
  [STATUS.EMPTY_DEMAND]: '需求为空，已拒绝',
  [STATUS.INCOMPLETE_DEMAND]: '需求不完整，已拒绝',
  [STATUS.NO_MATCH]: '无匹配规则，已拒绝',
  [STATUS.RULE_CONFLICT]: '规则冲突，已拒绝',
  [STATUS.NO_PUBLISHED_RULES]: '尚无已发布规则'
}

const statusText = computed(() => STATUS_TEXT[props.snapshot.status] || props.snapshot.status)

const resultIcon = computed(() => {
  if (props.snapshot.status === 'RULE_CONFLICT') return 'error'
  return 'warning'
})

const rejectTitle = computed(() => {
  switch (props.snapshot.status) {
    case STATUS.EMPTY_DEMAND:
      return '需求为空，无法推荐'
    case STATUS.INCOMPLETE_DEMAND:
      return '需求不完整，无法推荐'
    case STATUS.NO_MATCH:
      return '当前版本没有能命中该需求的规则'
    case STATUS.RULE_CONFLICT:
      return '规则冲突，系统拒绝猜测'
    case STATUS.NO_PUBLISHED_RULES:
      return '规则管理员尚未发布任何版本'
    default:
      return '无法推荐'
  }
})

const rejectMessage = computed(() => {
  switch (props.snapshot.status) {
    case STATUS.EMPTY_DEMAND:
      return '三个维度均未选择。请先补全业务需求，或使用快速场景一键填充。'
    case STATUS.INCOMPLETE_DEMAND:
      return `还缺少：${missingLabels.value}。补全后系统将基于同一推荐入口重新评估。`
    case STATUS.NO_MATCH:
      return '没有任何已启用规则同时满足这三个维度。可调整维度重试，或由专家给出人工方案。'
    case STATUS.RULE_CONFLICT:
      return '同一需求命中了推荐不同方案的多条同级规则，需规则管理员处理冲突后方可推荐。'
    case STATUS.NO_PUBLISHED_RULES:
      return '草稿规则尚未发布。规则发布版本后，访客才能看到推荐结果。'
    default:
      return ''
  }
})

const missingLabels = computed(() =>
  (props.snapshot.missing || [])
    .map((k) => DIMENSIONS[k]?.label || k)
    .join('、')
)

function solutionName(id) {
  return SOLUTIONS[id]?.name || id
}

function formatTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<style lang="scss">
.result-card {
  border-radius: $radius-lg;
  border: 1px solid $border-light;
  min-height: 420px;

  &.is-OK {
    border-top: 3px solid $success-color;
  }
  &.is-RULE_CONFLICT {
    border-top: 3px solid $danger-color;
  }
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: $text-primary;
}

.solution-summary {
  color: $text-regular;
  line-height: $line-height-base;
  margin: 0 0 $spacing-md;
  padding: $spacing-sm $spacing-md;
  background: $bg-color;
  border-radius: $radius-md;
}

.solution-block {
  margin-bottom: $spacing-md;

  h4 {
    margin: 0 0 $spacing-xs;
    font-size: $font-size-sm;
    color: $text-primary;
  }
}

.feature-tag {
  margin: 0 $spacing-xs $spacing-xs 0;
}

.muted {
  color: $text-secondary;
  margin: 0;
}

.basis-text {
  margin: 4px 0 0;
  font-size: $font-size-sm;
  color: $text-regular;
}

.alt-paths {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  justify-content: center;
  align-items: center;
}

.conflict-alert {
  text-align: left;
  max-width: 640px;
  margin: 0 auto;

  .conflict-rules {
    margin: 8px 0;
    font-size: $font-size-sm;
    color: $text-regular;
  }
  .conflict-actions {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-xs;
    align-items: center;
    margin-top: 8px;
  }
}

.version-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: $spacing-md;
  padding-top: $spacing-sm;
  border-top: 1px dashed $border-light;
  font-size: $font-size-xs;
  color: $text-secondary;
}
</style>
