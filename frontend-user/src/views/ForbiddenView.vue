<template>
  <div class="forbidden-page">
    <section class="section section-gray">
      <div class="container">
        <div class="card forbidden-card">
          <div class="forbidden-code">403</div>
          <h2 class="forbidden-title">权限不足，无法访问规则管理</h2>
          <p class="forbidden-desc">
            当前角色为「{{ roleLabel }}」，仅规则管理员可维护匹配条件与发布版本。
            您的推荐浏览不受影响，可选择以下替代路径继续：
          </p>

          <div class="alternatives">
            <div
              v-for="alt in alternatives"
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
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ROLES,
  ROLE_OPTIONS,
  REJECT_CODES,
  REJECT_ALTERNATIVES
} from '@/recommender/constants.js'
import { useSession } from '@/recommender/session.js'

const router = useRouter()
const route = useRoute()
const { session, setRole } = useSession()

const roleLabel = computed(() => {
  const hit = ROLE_OPTIONS.find((r) => r.value === session.role)
  return hit ? hit.label : session.role
})

const alternatives = REJECT_ALTERNATIVES[REJECT_CODES.PERMISSION_DENIED]

const handleAlternative = (action) => {
  switch (action) {
    case 'switch-role':
      setRole(ROLES.RULE_ADMIN)
      ElMessage.success('已切换为规则管理员')
      router.push(route.query.from || '/admin/rules')
      break
    case 'goto-recommend':
      router.push('/recommend')
      break
    case 'goto-home':
    default:
      router.push('/')
      break
  }
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.forbidden-card {
  max-width: 640px;
  margin: $spacing-xxl auto;
  text-align: center;
  padding: $spacing-xxl;

  &:hover {
    transform: none;
  }
}

.forbidden-code {
  font-size: 72px;
  font-weight: 700;
  color: $primary-color;
  line-height: 1;
  margin-bottom: $spacing-md;
}

.forbidden-title {
  font-size: $font-size-xl;
  color: $text-primary;
  margin-bottom: $spacing-md;
}

.forbidden-desc {
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: $line-height-loose;
  margin-bottom: $spacing-xl;
}

.alternatives {
  text-align: left;
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
</style>
