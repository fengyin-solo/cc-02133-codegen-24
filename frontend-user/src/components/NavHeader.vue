<template>
  <header class="nav-header" :class="{ 'nav-scrolled': isScrolled }">
    <div class="container flex-between">
      <router-link to="/" class="logo">
        <div class="logo-icon">知</div>
        <span class="logo-text">广州知运信息技术</span>
      </router-link>
      
      <nav class="nav-menu" :class="{ 'nav-open': menuOpen }">
        <router-link
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          @click="menuOpen = false"
        >
          {{ item.name }}
        </router-link>
      </nav>

      <div class="nav-actions">
        <el-dropdown trigger="click" @command="handleRoleCommand">
          <button type="button" class="role-switch">
            <el-icon :size="16"><User /></el-icon>
            <span class="role-label">{{ currentRoleLabel }}</span>
            <el-icon :size="12"><ArrowDown /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="role in roleOptions"
                :key="role.value"
                :command="role.value"
                :class="{ 'role-active': role.value === session.role }"
              >
                {{ role.label }}
                <span class="role-desc">{{ role.description }}</span>
              </el-dropdown-item>
              <el-dropdown-item divided command="__admin__">
                规则管理后台
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="primary" round @click="$router.push('/contact')">
          联系我们
        </el-button>
        <div class="menu-toggle" @click="menuOpen = !menuOpen">
          <el-icon :size="24">
            <component :is="menuOpen ? 'Close' : 'Menu'" />
          </el-icon>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ROLE_OPTIONS } from '@/recommender/constants.js'
import { useSession } from '@/recommender/session.js'

const router = useRouter()
const { session, setRole } = useSession()

const menuItems = [
  { name: '首页', path: '/' },
  { name: '关于我们', path: '/about' },
  { name: '产品服务', path: '/products' },
  { name: '案例展示', path: '/cases' },
  { name: '方案推荐', path: '/recommend' },
  { name: '联系我们', path: '/contact' }
]

const roleOptions = ROLE_OPTIONS

const currentRoleLabel = computed(() => {
  const hit = ROLE_OPTIONS.find((r) => r.value === session.role)
  return hit ? hit.label : '选择角色'
})

const handleRoleCommand = (command) => {
  if (command === '__admin__') {
    menuOpen.value = false
    router.push('/admin/rules')
    return
  }
  setRole(command)
}

const isScrolled = ref(false)
const menuOpen = ref(false)

const handleScroll = () => {
  isScrolled.value = window.scrollY > 50
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.nav-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 70px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  z-index: 1000;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  
  &.nav-scrolled {
    box-shadow: $shadow-sm;
  }
}

.logo {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  color: $text-primary;
  
  &:hover {
    color: $text-primary;
  }
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, $primary-color, $primary-dark);
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 20px;
  font-weight: bold;
}

.logo-text {
  font-size: $font-size-lg;
  font-weight: 600;
}

.nav-menu {
  display: flex;
  gap: $spacing-xl;
}

.nav-item {
  color: $text-regular;
  font-size: $font-size-base;
  padding: $spacing-xs 0;
  position: relative;
  transition: color 0.3s;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 0;
    height: 2px;
    background: $primary-color;
    transition: width 0.3s;
  }
  
  &:hover,
  &.router-link-active {
    color: $primary-color;
    
    &::after {
      width: 100%;
    }
  }
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.role-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid $border-color;
  border-radius: 20px;
  background: #fff;
  color: $text-regular;
  font-size: $font-size-sm;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    border-color: $primary-color;
    color: $primary-color;
  }
}

.role-desc {
  display: block;
  font-size: $font-size-xs;
  color: $text-placeholder;
}

.role-active {
  color: $primary-color;
  font-weight: 600;
}

.menu-toggle {
  display: none;
  cursor: pointer;
  color: $text-primary;
}

@media (max-width: $breakpoint-lg) {
  .nav-menu {
    position: fixed;
    top: 70px;
    left: 0;
    right: 0;
    background: #fff;
    flex-direction: column;
    padding: $spacing-lg;
    gap: $spacing-md;
    box-shadow: $shadow-md;
    transform: translateY(-100%);
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
    
    &.nav-open {
      transform: translateY(0);
      opacity: 1;
      visibility: visible;
    }
  }
  
  .nav-item {
    padding: $spacing-sm 0;
    border-bottom: 1px solid $border-light;
  }
  
  .menu-toggle {
    display: block;
  }
  
  .nav-actions .el-button {
    display: none;
  }
}

@media (max-width: $breakpoint-md) {
  .logo-text {
    display: none;
  }
}
</style>
