import { createRouter, createWebHistory } from 'vue-router'
import { recommenderStore } from '@/modules/recommender/store.js'

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
  // 方案推荐器：独立布局，不使用官网导航与页脚
  {
    path: '/recommend',
    component: () => import('@/modules/recommender/components/RecommenderLayout.vue'),
    meta: { title: '方案推荐', noChrome: true },
    children: [
      {
        path: '',
        name: 'Recommender',
        component: () => import('@/modules/recommender/views/RecommendView.vue'),
        meta: { title: '方案推荐', noChrome: true }
      },
      {
        path: 'admin',
        name: 'RecommenderAdmin',
        component: () => import('@/modules/recommender/views/AdminView.vue'),
        meta: { title: '规则管理', noChrome: true, requiresAdmin: true }
      }
    ]
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
  // 未授权角色（业务访客 / 未授权访客）不能进入规则管理
  if (to.matched.some((r) => r.meta.requiresAdmin) && recommenderStore.state.role !== 'admin') {
    return next({
      path: '/recommend',
      query: { denied: 'admin', role: recommenderStore.state.role }
    })
  }
  document.title = `${to.meta.title} - 广州知运信息技术有限公司`
  next()
})

export default router
