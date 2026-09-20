// 方案推荐器 - 角色会话（Vue 响应式单例）
// 静态站点无后端登录，角色用于演示权限控制；
// 会话存 sessionStorage：刷新页面保留、关闭标签页失效。

import { reactive, readonly } from 'vue'
import { ROLES, ROLE_OPTIONS, hasPermission } from './constants.js'

const SESSION_KEY = 'zhiyun-recommender-role'

function restoreRole() {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved && ROLE_OPTIONS.some((r) => r.value === saved)) return saved
  } catch {
    // sessionStorage 不可用时使用默认角色
  }
  return ROLES.VISITOR // 默认以业务访客身份浏览
}

// 模块级响应式状态：组件与路由守卫共享同一会话
const state = reactive({
  role: restoreRole()
})

export function currentRole() {
  return state.role
}

export function currentCan(permission) {
  return hasPermission(state.role, permission)
}

export function useSession() {
  const setRole = (role) => {
    if (!ROLE_OPTIONS.some((r) => r.value === role)) return
    state.role = role
    try {
      sessionStorage.setItem(SESSION_KEY, role)
    } catch {
      // 忽略持久化失败
    }
  }

  return {
    session: readonly(state),
    setRole,
    can: currentCan
  }
}
