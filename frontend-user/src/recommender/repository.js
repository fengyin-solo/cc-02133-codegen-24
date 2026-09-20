// 方案推荐器 - 规则版本仓库（纯 JS，不依赖 Vue）
// 职责：种子数据、草稿维护、发布不可变版本快照、写操作权限校验。
// 存储介质通过参数注入：浏览器传 localStorage，测试传内存适配器。

import {
  ROLES,
  REJECT_CODES,
  REJECT_MESSAGES,
  REJECT_ALTERNATIVES,
  hasPermission
} from './constants.js'
import { deepClone, deepFreeze, validateDraft } from './engine.js'

const STORAGE_KEY = 'zhiyun-recommender-repo-v1'

// ============ 种子规则（首次启动内置，发布为 v1） ============
export function seedRules() {
  return [
    {
      id: 'R-001',
      name: '中小电商仓配一体方案',
      enabled: true,
      priority: 100,
      conditions: {
        businessScale: ['micro', 'small'],
        warehousing: ['none', 'light'],
        scenario: ['b2c']
      },
      solution: {
        code: 'SOL-WMS-DMS-LITE',
        title: '轻量仓配一体方案（WMS + DMS）',
        products: ['智慧仓储管理系统 WMS', '配送调度系统 DMS'],
        summary: '面向中小电商的轻量级仓配组合：单仓精细化管理 + 智能派单，4 周内完成上线。',
        estimatedCycle: '4-6 周'
      }
    },
    {
      id: 'R-002',
      name: '成长型企业多仓协同方案',
      enabled: true,
      priority: 90,
      conditions: {
        businessScale: ['medium'],
        warehousing: ['standard'],
        scenario: []
      },
      solution: {
        code: 'SOL-WMS-TMS-STD',
        title: '多仓协同履约方案（WMS + TMS）',
        products: ['智慧仓储管理系统 WMS', '运输管理系统 TMS'],
        summary: '多仓多货主统一管控，干线运输智能调度，支撑日均万单级履约。',
        estimatedCycle: '8-12 周'
      }
    },
    {
      id: 'R-003',
      name: '大型企业全渠道智能物流方案',
      enabled: true,
      priority: 95,
      conditions: {
        businessScale: ['large'],
        warehousing: ['standard', 'automated'],
        scenario: ['omnichannel']
      },
      solution: {
        code: 'SOL-FULL-SUITE',
        title: '全渠道智能物流套件（WMS + TMS + DMS + 数据分析）',
        products: ['智慧仓储管理系统 WMS', '运输管理系统 TMS', '配送调度系统 DMS', '数据分析平台'],
        summary: '四大系统一体化部署，自动化仓储对接 + 全渠道订单履约 + 数据大屏决策。',
        estimatedCycle: '12-16 周'
      }
    },
    {
      id: 'R-004',
      name: 'B2B 门店补货运输方案',
      enabled: true,
      priority: 80,
      conditions: {
        businessScale: [],
        warehousing: [],
        scenario: ['b2b']
      },
      solution: {
        code: 'SOL-TMS-B2B',
        title: 'B2B 干线补货方案（TMS）',
        products: ['运输管理系统 TMS'],
        summary: '整合运力资源，按门店波次智能排线，运输全程可视追踪。',
        estimatedCycle: '6-8 周'
      }
    },
    {
      id: 'R-005',
      name: '跨境物流数据洞察方案',
      enabled: true,
      priority: 70,
      conditions: {
        businessScale: [],
        warehousing: [],
        scenario: ['crossborder']
      },
      solution: {
        code: 'SOL-DATA-CB',
        title: '跨境物流数据洞察方案（TMS + 数据分析平台）',
        products: ['运输管理系统 TMS', '数据分析平台'],
        summary: '跨境干线追踪 + 多维报表分析，异常预警与趋势预测辅助决策。',
        estimatedCycle: '8-10 周'
      }
    },
    {
      id: 'R-006',
      name: '自动化仓储升级方案',
      enabled: true,
      priority: 85,
      conditions: {
        businessScale: ['medium', 'large'],
        warehousing: ['automated'],
        scenario: []
      },
      solution: {
        code: 'SOL-WMS-AUTO',
        title: '自动化仓储升级方案（WMS 自动化版）',
        products: ['智慧仓储管理系统 WMS'],
        summary: '对接 AGV / 立体库等自动化设备，AI 库位引擎持续优化空间利用率。',
        estimatedCycle: '10-14 周'
      }
    }
  ]
}

function rejectPermission() {
  return {
    status: 'rejected',
    code: REJECT_CODES.PERMISSION_DENIED,
    message: REJECT_MESSAGES[REJECT_CODES.PERMISSION_DENIED],
    alternatives: REJECT_ALTERNATIVES[REJECT_CODES.PERMISSION_DENIED]
  }
}

// ============ 仓库 ============
export function createRepository(storage) {
  const persist = () => {
    if (!storage) return
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // 存储不可用时降级为纯内存态
    }
  }

  const load = () => {
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && Array.isArray(parsed.versions) && parsed.versions.length > 0) {
            return parsed
          }
        }
      } catch {
        // 数据损坏时回退到种子数据
      }
    }
    const v1 = deepFreeze({
      version: 'v1',
      publishedAt: new Date().toISOString(),
      publishedBy: ROLES.RULE_ADMIN,
      changelog: '初始发布：内置 6 条推荐规则',
      rules: deepClone(seedRules())
    })
    return { versions: [v1], draft: deepClone(seedRules()) }
  }

  const state = load()
  persist()

  const currentVersion = () => state.versions[state.versions.length - 1]

  return {
    // ---- 只读接口（业务访客可用） ----
    getCurrentVersion: () => currentVersion(),
    getVersions: () => state.versions.slice(),
    getDraft: () => deepClone(state.draft),

    // ---- 写接口（仅规则管理员；越权一律拒绝并给出替代路径） ----
    saveDraft(role, rules) {
      if (!hasPermission(role, 'rule:write')) return rejectPermission()
      if (!Array.isArray(rules)) {
        return {
          status: 'rejected',
          code: REJECT_CODES.DRAFT_INVALID,
          message: '草稿数据格式无效',
          alternatives: REJECT_ALTERNATIVES[REJECT_CODES.DRAFT_INVALID]
        }
      }
      state.draft = deepClone(rules)
      persist()
      return { status: 'ok' }
    },

    discardDraft(role) {
      if (!hasPermission(role, 'rule:write')) return rejectPermission()
      state.draft = deepClone(currentVersion().rules)
      persist()
      return { status: 'ok' }
    },

    publish(role, changelog = '') {
      if (!hasPermission(role, 'rule:publish')) return rejectPermission()

      const check = validateDraft(state.draft)
      if (!check.valid) {
        return {
          status: 'rejected',
          code: REJECT_CODES.DRAFT_INVALID,
          message: REJECT_MESSAGES[REJECT_CODES.DRAFT_INVALID],
          alternatives: REJECT_ALTERNATIVES[REJECT_CODES.DRAFT_INVALID],
          problems: check.problems,
          conflicts: check.conflicts
        }
      }

      const version = deepFreeze({
        version: `v${state.versions.length + 1}`,
        publishedAt: new Date().toISOString(),
        publishedBy: role,
        changelog: changelog || '规则例行更新',
        rules: deepClone(state.draft)
      })
      state.versions.push(version)
      persist()
      return { status: 'ok', version }
    }
  }
}
