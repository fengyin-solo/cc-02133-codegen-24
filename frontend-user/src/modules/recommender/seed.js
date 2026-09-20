/**
 * 方案推荐器 - 方案库 / 快速场景 / 初始种子规则
 */

import { WILDCARD as ALL } from './engine/constants.js'

/** 可被规则推荐的物流解决方案 */
export const SOLUTIONS = {
  s_light: {
    id: 's_light',
    name: '知运·轻配版（TMS 轻量配送）',
    summary: '面向小微商家的订单与配送调度 SaaS，按需开通、零部署。',
    features: ['订单聚合与电子面单', '同城 / 城配车辆调度', '运费试算与承运商比价', '轨迹跟踪与短信通知'],
    suitable: '业务量小、暂不自建仓储、以配送调度为主的初创团队'
  },
  s_omni: {
    id: 's_omni',
    name: '知运·全渠道一盘棋（OMS + 干线 TMS）',
    summary: '多平台订单统一接入，城际干线运输全程可视化。',
    features: ['电商 / 门店订单统一归集', '干线发运与回单管理', '在途预警与 ETA 预测', '对账结算与承运商考核'],
    suitable: '有标准仓储、以城际干线运输为主的中型企业'
  },
  s_wms: {
    id: 's_wms',
    name: '知运·仓配一体（WMS + TMS）',
    summary: '仓内作业与跨区域配送一体化，库存与发运数据打通。',
    features: ['入库 / 库位 / 波次拣货', '库存全链路可视', '跨区域调拨与越库', '仓配 KPI 看板'],
    suitable: '自有 / 租赁标准仓库、需要跨区域分销的成长型企业'
  },
  s_smart: {
    id: 's_smart',
    name: '知运·智慧物流中台（AIWMS + 全渠道路由）',
    summary: '自动化仓储与全渠道库存路由，面向大型集团的一体化中台。',
    features: ['WMS / WCS 设备联动', '全渠道一盘货与智能分仓', 'AI 补货与运力路由', '多组织 / 多租户结算'],
    suitable: '智能仓储、全渠道履约、多法人多仓网的大型集团'
  },
  s_consult: {
    id: 's_consult',
    name: '知运·专家咨询定制',
    summary: '由物流解决方案专家一对一梳理仓配流程并给出定制方案。',
    features: ['仓网规划与选型建议', '既有系统对接评估', '分阶段落地路线图', '专属实施与陪跑'],
    suitable: '需求暂时无法被标准规则覆盖、或处于方案选型早期的客户'
  }
}

export function getSolution(id) {
  return SOLUTIONS[id] || null
}

/** 业务访客一键填充的快速场景 */
export const QUICK_SCENES = [
  {
    key: 'startup-local',
    label: '小微 · 同城即配',
    desc: '刚起步，不租仓，订单在城区内即时送达',
    demand: { businessScale: 'small', storageNeed: 'none', deliveryScene: 'local' }
  },
  {
    key: 'growth-cross',
    label: '中型 · 仓配跨区',
    desc: '自有标准仓，货发全国多个区域',
    demand: { businessScale: 'medium', storageNeed: 'standard', deliveryScene: 'cross' }
  },
  {
    key: 'group-omni',
    label: '集团 · 智能全渠道',
    desc: '自动化仓 + 线上线下一盘货履约',
    demand: { businessScale: 'large', storageNeed: 'intelligent', deliveryScene: 'omni' }
  },
  {
    key: 'brand-city',
    label: '品牌 · 城际干线',
    desc: '中型品牌商，标准仓 + 城际整车零担',
    demand: { businessScale: 'medium', storageNeed: 'standard', deliveryScene: 'city' }
  }
]

/** 首次进入时内置的 v1 草稿规则（规则管理员可直接发布） */
export function buildSeedRules() {
  return [
    {
      id: 'seed-r1',
      name: '小微即配 → 轻配版',
      solutionId: 's_light',
      conditions: { businessScale: 'small', storageNeed: 'none', deliveryScene: 'local' },
      priority: 10,
      enabled: true,
      createdAt: '2026-09-01T09:00:00.000Z'
    },
    {
      id: 'seed-r2',
      name: '小微通用 → 轻配版',
      solutionId: 's_light',
      conditions: { businessScale: 'small', storageNeed: ['none', 'basic'], deliveryScene: ALL },
      priority: 1,
      enabled: true,
      createdAt: '2026-09-01T09:00:00.000Z'
    },
    {
      id: 'seed-r3',
      name: '中型城际 → 全渠道一盘棋',
      solutionId: 's_omni',
      conditions: { businessScale: 'medium', storageNeed: 'standard', deliveryScene: 'city' },
      priority: 10,
      enabled: true,
      createdAt: '2026-09-01T09:00:00.000Z'
    },
    {
      id: 'seed-r4',
      name: '中型跨区仓配 → 仓配一体',
      solutionId: 's_wms',
      conditions: { businessScale: 'medium', storageNeed: 'standard', deliveryScene: 'cross' },
      priority: 10,
      enabled: true,
      createdAt: '2026-09-01T09:00:00.000Z'
    },
    {
      id: 'seed-r5',
      name: '大型智能全渠道 → 智慧中台',
      solutionId: 's_smart',
      conditions: { businessScale: 'large', storageNeed: 'intelligent', deliveryScene: 'omni' },
      priority: 10,
      enabled: true,
      createdAt: '2026-09-01T09:00:00.000Z'
    },
    {
      id: 'seed-r6',
      name: '大型通用兜底 → 智慧中台',
      solutionId: 's_smart',
      conditions: { businessScale: 'large', storageNeed: ALL, deliveryScene: ALL },
      priority: 1,
      enabled: true,
      createdAt: '2026-09-01T09:00:00.000Z'
    }
  ]
}

export const RECOMMENDER_VERSION_PREFIX = 'v'
