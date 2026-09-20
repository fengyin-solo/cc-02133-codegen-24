import { createRouter, createWebHistory } from 'vue-router'
import { currentCan } from '@/recommender/session.js'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '首页' }
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/AboutView.vue'),
    meta: { title: '关于我们' }
  },
  {
    path: '/products',
    name: 'Products',
    component: () => import('@/views/ProductView.vue'),
    meta: { title: '产品服务' }
  },
  {
    path: '/cases',
    name: 'Cases',
    component: () => import('@/views/CaseView.vue'),
    meta: { title: '案例展示' }
  },
  {
    path: '/contact',
    name: 'Contact',
    component: () => import('@/views/ContactView.vue'),
    meta: { title: '联系我们' }
  },
  {
    path: '/recommend',
    name: 'Recommend',
    component: () => import('@/views/RecommendView.vue'),
    meta: { title: '方案推荐' }
  },
  {
    path: '/admin/rules',
    name: 'RuleAdmin',
    component: () => import('@/views/RuleAdminView.vue'),
    meta: { title: '规则管理', requiresPermission: 'rule:write' }
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/ForbiddenView.vue'),
    meta: { title: '权限不足' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth', top: 80 }
    }
    return { top: 0 }
  }
})

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title} - 广州知运信息技术有限公司`
  // 权限守卫：未授权角色访问受限页面时，引导至 403 并提供替代路径
  if (to.meta.requiresPermission && !currentCan(to.meta.requiresPermission)) {
    return next({ path: '/403', query: { from: to.fullPath } })
  }
  next()
})

export default router
