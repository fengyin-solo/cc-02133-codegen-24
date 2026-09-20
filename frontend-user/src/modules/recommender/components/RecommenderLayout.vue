<template>
  <div class="recommender-layout">
    <header class="rc-header">
      <div class="rc-header-inner">
        <div class="rc-brand" @click="router.push('/recommend')">
          <div class="rc-brand-icon">荐</div>
          <div class="rc-brand-text">
            <strong>知运方案推荐器</strong>
            <span>按业务规模 · 仓储需求 · 配送场景匹配物流方案</span>
          </div>
        </div>

        <nav class="rc-tabs">
          <router-link to="/recommend" class="rc-tab" active-class="active" end>
            方案推荐
          </router-link>
          <router-link
            v-if="store.canEdit.value"
            to="/recommend/admin"
            class="rc-tab"
            active-class="active"
          >
            规则管理
          </router-link>
          <span v-else class="rc-tab rc-tab-locked" title="仅规则管理员可进入" @click="goAdminDenied">
            <el-icon><Lock /></el-icon> 规则管理
          </span>
        </nav>

        <el-dropdown trigger="click" @command="store.setRole">
          <span class="rc-role">
          <el-tag :type="roleTag" effect="dark" round>
            <el-icon class="role-icon"><UserFilled /></el-icon>
            {{ roleLabel }}
          </el-tag>
          <el-icon class="caret"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="r in ROLE_LIST"
                :key="r.value"
                :command="r.value"
                :disabled="r.value === store.state.role"
              >
                <strong>{{ r.label }}</strong>
                <span class="role-desc">｜{{ r.desc }}</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <router-link to="/" class="rc-back-site">
          <el-icon><Back /></el-icon> 返回官网
        </router-link>
      </div>
    </header>

    <main class="rc-main">
      <div class="rc-container">
        <router-view v-slot="{ Component }">
          <transition name="rc-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>

    <footer class="rc-footer">
      广州知运信息技术有限公司 · 方案推荐器（推荐结果以已发布规则版本为准）
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { store } from '../store.state.js'
import { ROLE_LIST, ROLES } from '../engine/constants.js'

const router = useRouter()

const roleLabel = computed(() => ROLES[store.state.role]?.label || '未授权')
const roleTag = computed(() => {
  if (store.state.role === 'admin') return 'danger'
  if (store.state.role === 'visitor') return 'primary'
  return 'info'
})

function goAdminDenied() {
  ElMessage.warning('权限不足：规则管理仅对「规则管理员」开放，可切换右上角角色后重试')
}
</script>

<style lang="scss">
.recommender-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: $bg-color;
}

.rc-header {
  background: linear-gradient(135deg, $primary-dark 0%, $primary-color 100%);
  color: #fff;
  box-shadow: $shadow-md;
  position: sticky;
  top: 0;
  z-index: 100;
}

.rc-header-inner {
  max-width: $container-width;
  margin: 0 auto;
  padding: 0 $spacing-lg;
  height: 64px;
  display: flex;
  align-items: center;
  gap: $spacing-lg;
}

.rc-brand {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  cursor: pointer;

  .rc-brand-icon {
    width: 38px;
    height: 38px;
    border-radius: $radius-md;
    background: rgba(255, 255, 255, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
  }

  .rc-brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.3;

    strong {
      font-size: $font-size-base;
    }
    span {
      font-size: $font-size-xs;
      opacity: 0.85;
    }
  }
}

.rc-tabs {
  display: flex;
  gap: $spacing-sm;
  margin-left: auto;
}

.rc-tab {
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  padding: 6px 14px;
  border-radius: $radius-md;
  font-size: $font-size-sm;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }
  &.active {
    background: #fff;
    color: $primary-dark;
    font-weight: 600;
  }
}

.rc-tab-locked {
  cursor: not-allowed;
  opacity: 0.65;
}

.rc-role {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  outline: none;

  .role-icon {
    vertical-align: -1px;
  }
  .caret {
    color: #fff;
    font-size: 12px;
  }
}

.role-desc {
  color: $text-secondary;
  font-size: $font-size-xs;
}

.rc-back-site {
  color: rgba(255, 255, 255, 0.85);
  font-size: $font-size-xs;
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    color: #fff;
  }
}

.rc-main {
  flex: 1;
  padding: $spacing-lg 0 $spacing-xxl;
}

.rc-container {
  max-width: $container-width;
  margin: 0 auto;
  padding: 0 $spacing-lg;
}

.rc-footer {
  text-align: center;
  padding: $spacing-lg;
  color: $text-secondary;
  font-size: $font-size-xs;
  border-top: 1px solid $border-light;
  background: $bg-white;
}

.rc-fade-enter-active,
.rc-fade-leave-active {
  transition: opacity 0.2s ease;
}
.rc-fade-enter-from,
.rc-fade-leave-to {
  opacity: 0;
}

@media (max-width: $breakpoint-lg) {
  .rc-header-inner {
    flex-wrap: wrap;
    height: auto;
    padding: $spacing-sm $spacing-md;
    gap: $spacing-sm;
  }
  .rc-brand-text span {
    display: none;
  }
  .rc-tabs {
    order: 3;
    width: 100%;
    margin-left: 0;
  }
  .rc-back-site {
    display: none;
  }
}
</style>
