# 方案推荐器模块设计

> 路径：`src/modules/recommender/`
> 访问：`/recommend`（业务访客推荐页）、`/recommend/admin`（规则管理员，需 admin 角色）
> 形态：纯前端模块（静态官网无后端），已发布版本使用 `localStorage` 持久化；逻辑层为纯函数，可独立单测。

## 1. 角色与权限

| 角色 | 选择方式 | 规则草稿 | 发布版本 | 推荐结果 | 匹配依据 |
|------|----------|----------|----------|----------|----------|
| 规则管理员 admin | 右上角角色切换 | 增删改、启停、重置 | 可发布 | 可看 | 可看 |
| 业务访客 visitor | 右上角角色切换 | 只读，禁止改动 | 禁止 | 可看 | 可看 |
| 未授权访客 guest（默认） | 右上角角色切换 | 只读，禁止改动 | 禁止 | 可看 | 可看 |

- 权限在**仓库方法层**强制：`upsertRule / deleteRule / toggleRule / resetDraft / publish` 首行 `requireAdmin`，非 admin 抛 `PermissionDeniedError`，UI 层捕获后提示并给出替代路径。
- 路由层二次拦截：非 admin 访问 `/recommend/admin` 会被重定向到 `/recommend?denied=admin`，页面展示「切换为规则管理员并进入」的替代入口。

## 2. 匹配模型

三个维度（全部为枚举，均必填）：

- 业务规模：小微 / 中型 / 大型
- 仓储需求：无需 / 简易 / 标准 / 智能
- 配送场景：同城即配 / 城际干线 / 跨区域分销 / 全渠道一盘货

规则条件每个维度支持：
- 通配 `*`：任意需求值命中；
- 单值或数组：命中其一即可。

排序裁决（`engine/matcher.js#recommend`）：
1. 只取启用规则；
2. 按**具体度**（非通配维度数）降序；
3. 同具体度按 `priority` 降序；
4. 再相同按 id 升序兜底。

若最终并列规则指向**多个不同方案**，返回 `RULE_CONFLICT`，拒绝猜测。发布前 `detectConflicts` 使用与推荐一致的口径（同具体度、同优先级、三维度条件均有交集且方案不同）预检，冲突或非法规则存在时**拒绝发布**。

## 3. 拒绝场景与替代路径

| 状态码 | 触发条件 | 页面替代路径 |
|--------|----------|--------------|
| `EMPTY_DEMAND` | 三个维度全空 | 去补全需求 / 一键使用快速场景 |
| `INCOMPLETE_DEMAND` | 部分维度未选，列出缺失维度 | 去补全 / 快速场景 |
| `NO_MATCH` | 已发布版本无规则命中 | 预约解决方案专家 / 调整维度重试 |
| `RULE_CONFLICT` | 同级规则多方案冲突 | admin 去消除冲突 / 联系专家；非 admin 仅只读提示 |
| `NO_PUBLISHED_RULES` | 从未发布 | admin 去发布首版；非 admin 提示联系管理员 |
| `PermissionDeniedError` | 非 admin 执行写操作 | 提示切换为规则管理员 |

## 4. 版本一致性（空白需求 / 快速切换 / 窗口缩放）

- 推荐只在用户点击「获取方案推荐」时执行；返回的快照包含 `versionId / versionNote / publishedAt / evaluatedAt / demand / solution / basis`。
- 快照由视图持有并整体渲染：之后修改下拉、点击快速场景、清空需求、浏览器窗口缩放都**不会重新评估**，结果与依据继续展示同一 `versionId`；页面有「结果已锁定版本」提示。
- 管理员发布新版本后，访客若已有旧快照，页面出现 info 横幅但不自动替换；点击「基于最新版本重新评估」才切换。
- 已发布版本深冻结（`Object.freeze` 递归）且独立存档；发布后自动生成下一版草稿，历史版本不可被草稿编辑影响。
- 窗口 resize 监听器不触发任何数据动作（视图内注释说明）。

## 5. 文件结构

```
src/modules/recommender/
├── engine/
│   ├── constants.js       # 维度/选项/角色/状态码
│   └── matcher.js         # 纯函数：需求校验、匹配、排序、冲突、命中依据
├── seed.js                # 方案库、快速场景、初始种子规则
├── store.js               # 权限、草稿、发布、版本冻结、评估快照（localStorage）
├── store.state.js         # 视图层取单例的薄封装
├── components/
│   ├── RecommenderLayout.vue  # 独立顶栏/页脚布局
│   ├── DemandForm.vue         # 三维度表单 + 快速场景
│   ├── ResultPanel.vue        # 推荐结果 / 匹配依据 / 拒绝与替代路径
│   ├── RuleEditorDialog.vue   # 规则编辑器
│   └── VersionTimeline.vue    # 已发布版本时间线
└── views/
    ├── RecommendView.vue  # 访客推荐页（快照锁定）
    └── AdminView.vue      # 管理员规则维护与发布
test/
├── engine.test.js         # 引擎纯函数测试（17 例）
├── store.test.js          # 权限/发布/冻结/快照/持久化测试（11 例）
├── vue-stub.js            # 仓库测试用的 vue 响应式桩
└── vue-loader.js          # 测试时把 'vue' 重定向到桩
```

## 6. 运行与测试

```bash
cd frontend-user
npm run dev       # 开发
npm run build     # 构建
npm test          # 28 个单元测试（Node 内置 test runner，无需额外依赖）
```

## 7. 与官网的边界

- 仅新增文件与路由；`App.vue` 只增加 `meta.noChrome` 条件（官网路由不走该分支），`router/index.js` 仅追加 `/recommend` 路由组与守卫。
- 官网导航 `NavHeader`、页脚与五个既有页面内容零改动；推荐器使用独立布局，导航上不增加入口，通过 URL 直达。
