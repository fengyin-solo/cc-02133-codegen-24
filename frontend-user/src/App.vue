<template>
  <div id="app">
    <template v-if="isRecommenderRoute">
      <!-- 方案推荐器使用独立布局（自带顶栏/页脚），不渲染官网导航 -->
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </template>
    <template v-else>
      <NavHeader />
      <main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
      <FooterSection />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavHeader from '@/components/NavHeader.vue'
import FooterSection from '@/components/FooterSection.vue'

const route = useRoute()
// 仅方案推荐器路由跳过官网框架；官网既有页面结构保持不变
const isRecommenderRoute = computed(() => route.meta.noChrome === true)
</script>

<style lang="scss">
@use '@/assets/styles/variables.scss' as *;

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  padding-top: 70px; // 导航栏高度
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
