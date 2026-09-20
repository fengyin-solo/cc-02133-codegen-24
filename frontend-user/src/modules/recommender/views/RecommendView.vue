<template>
  <div class="recommend-view">
    <el-alert
      v-if="deniedByRole"
      class="head-alert"
      type="error"
      show-icon
      :closable="false"
      title="权限不足：您当前的角色不能改动规则"
    >
      <div class="new-version-actions">
        <span>替代路径：切换为「规则管理员」角色后进入规则管理；或保持只读浏览推荐结果。</span>
        <div>
          <el-button size="small" @click="deniedByRole = null">我知道了</el-button>
          <el-button size="small" type="primary" @click="becomeAdmin">切换为规则管理员并进入</el-button>
        </div>
      </div>
    </el-alert>

    <el-alert
      v-if="store.state.versions.length === 0"
      class="head-alert"
      type="warning"
      show-icon
      :closable="false"
      title="规则管理员尚未发布任何规则版本"
      description="提交需求会被拒绝。可切换为规则管理员，到「规则管理」发布首个版本。"
    />
    <el-alert
      v-else-if="newerVersion"
      class="head-alert"
      type="info"
      show-icon
      :closable="false"
      :title="`规则已发布新版本 ${newerVersion.id}，当前结果仍锁定在 ${snapshot.versionId}`"
    >
      <div class="new-version-actions">
        <span>{{ newerVersion.note }}</span>
        <el-button size="small" type="primary" @click="reevaluateWithLatest">
          基于最新版本重新评估
        </el-button>
      </div>
    </el-alert>

    <el-page-header v-if="snapshot" class="snapshot-bar" :icon="null">
      <template #content>
        <div class="snapshot-meta">
          <el-tag size="small" type="success" effect="plain">
            结果已锁定版本 {{ snapshot.versionLabel }}
          </el-tag>
          <span class="snapshot-tip">
            <el-icon><Lock /></el-icon>
            修改选择、快速切换场景或缩放窗口都不会改变当前结果与依据；请点击「获取方案推荐」显式重新评估。
          </span>
        </div>
      </template>
    </el-page-header>

    <div class="view-grid">
      <DemandForm
        v-model="demand"
        :loading="loading"
        @submit="onSubmit"
        @quick-scene="onQuickScene"
        @clear="onClear"
      />

      <ResultPanel
        v-if="snapshot"
        :snapshot="snapshot"
        :can-edit="store.canEdit.value"
        @complete-demand="scrollToForm"
        @use-quick-scene="applyFirstScene"
        @contact-consultant="contactConsultant"
        @adjust-demand="scrollToForm"
        @goto-admin="router.push('/recommend/admin')"
      />
      <el-card v-else shadow="never" class="empty-panel">
        <el-empty description="填写业务需求后，这里将展示推荐结果与逐条匹配依据" />
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { store } from '../store.state.js'
import { QUICK_SCENES } from '../seed.js'
import DemandForm from '../components/DemandForm.vue'
import ResultPanel from '../components/ResultPanel.vue'

const router = useRouter()
const currentRoute = useRoute()

const emptyDemand = () => ({ businessScale: '', storageNeed: '', deliveryScene: '' })
const demand = ref(emptyDemand())
const snapshot = ref(null)
const loading = ref(false)
const deniedByRole = ref(null)
let resizeTimer = null

/**
 * 只在显式点击时评估；评估结果整体存为快照，
 * 快照内自带 versionId，与当前需求编辑状态完全解耦。
 */
function onSubmit() {
  loading.value = true
  // 微小延时仅用于展示 loading 态；评估本身是同步纯函数
  setTimeout(() => {
    snapshot.value = store.evaluate(demand.value)
    loading.value = false
  }, 120)
}

/**
 * 快速切换场景：只更新表单，不重算推荐。
 * 若已有快照，继续展示旧版本结果，保证结果与依据版本一致。
 */
function onQuickScene(scene) {
  demand.value = { ...scene.demand }
  ElMessage({
    message: snapshot.value
      ? `已切换到「${scene.label}」，当前结果仍保持版本 ${snapshot.value.versionLabel}；点击推荐按钮重新评估。`
      : `已填充「${scene.label}」，点击推荐按钮获取结果。`,
    type: snapshot.value ? 'info' : 'success'
  })
}

function onClear() {
  demand.value = emptyDemand()
  ElMessage.info('需求已清空，当前推荐结果与依据保持不变')
}

function applyFirstScene() {
  demand.value = { ...QUICK_SCENES[0].demand }
  ElMessage.success(`已填充「${QUICK_SCENES[0].label}」，点击推荐按钮重新评估`)
  scrollToForm()
}

function reevaluateWithLatest() {
  snapshot.value = store.evaluate(demand.value)
  ElMessage.success(`已基于最新版本 ${snapshot.value.versionLabel} 重新评估`)
}

function contactConsultant() {
  ElMessage({
    type: 'success',
    duration: 3000,
    message: '已记录您的咨询意向，解决方案专家将在 1 个工作日内联系您（也可直接访问官网「联系我们」）。'
  })
}

function scrollToForm() {
  document.querySelector('.recommend-view')?.scrollIntoView({ behavior: 'smooth' })
}

function becomeAdmin() {
  store.setRole('admin')
  deniedByRole.value = null
  router.push('/recommend/admin')
}

/**
 * 新版本提示：已发布新版本且与快照版本不同时出现，
 * 但不自动替换结果——访客明确点击后才重新评估。
 */
const newerVersion = computed(() => {
  const current = store.publishedVersion.value
  if (!snapshot.value || !current) return null
  return current.id !== snapshot.value.versionId ? current : null
})

/**
 * 窗口调整：监听仅做布局用途，明确不触发重新评估，
 * 保证缩放后结果与依据仍对应同一版本。
 */
function onResize() {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    // 故意为空：结果快照与视口无关，不做任何数据动作
  }, 150)
}
onMounted(() => {
  window.addEventListener('resize', onResize)
  if (currentRoute.query.denied === 'admin') {
    deniedByRole.value = currentRoute.query.role || 'guest'
    ElMessage.warning('权限不足：规则管理仅对「规则管理员」开放')
  }
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  clearTimeout(resizeTimer)
})
</script>

<style lang="scss">
.head-alert {
  margin-bottom: $spacing-md;
  border-radius: $radius-md;
}

.new-version-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  flex-wrap: wrap;
}

.snapshot-bar {
  margin-bottom: $spacing-md;
  padding: $spacing-sm $spacing-md;
  background: $bg-white;
  border: 1px solid $border-light;
  border-radius: $radius-md;

  .snapshot-meta {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    flex-wrap: wrap;
  }
  .snapshot-tip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: $font-size-xs;
    color: $text-secondary;
  }
}

.view-grid {
  display: grid;
  grid-template-columns: minmax(360px, 5fr) minmax(360px, 6fr);
  gap: $spacing-lg;
  align-items: start;
}

.empty-panel {
  border-radius: $radius-lg;
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: $breakpoint-lg) {
  .view-grid {
    grid-template-columns: 1fr;
  }
}
</style>
