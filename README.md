# 广州知运信息技术有限公司官网

## 1. How to Run

### 方式一：Docker Compose（推荐）

```bash
# 构建并启动
docker-compose up --build -d

# 访问地址
http://localhost:8081
```

### 方式二：本地开发

```bash
# 进入前端目录
cd frontend-user

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行推荐引擎单元测试（node:test，无需额外依赖）
npm test
```

## 2. Services

| 服务 | 端口 | 说明 |
|------|------|------|
| 官网前端 | 8081 | Vue 3 静态页面 |

## 3. 测试账号

本项目为纯静态官网，无需登录账号。方案推荐器通过页面右上角「角色切换」演示三种角色：

| 角色 | 权限 |
|------|------|
| 业务访客（默认） | 只读推荐结果与匹配依据 |
| 规则管理员 | 维护匹配条件（业务规模 / 仓储需求 / 配送场景）、发布规则版本 |
| 未授权用户 | 仅浏览官网，改动规则一律被拒绝并给出替代路径 |

## 4. 题目内容

> 在此空文件夹帮我创建一个Vue项目，它是我公司的官网，静态页面来的，公司名称是广州知运信息技术有限公司，首页的内容先帮我随意填充，公司目前经营的内容是智慧物流的系统

## 5. 项目结构

```
├── docs/                          # 项目文档
│   └── project_design.md          # 设计文档
├── frontend-user/                 # 前端项目
│   ├── public/                    # 静态资源
│   ├── src/
│   │   ├── assets/               # 资源文件
│   │   │   └── styles/           # 样式文件
│   │   ├── components/           # 公共组件
│   │   │   ├── NavHeader.vue     # 导航栏（含角色切换）
│   │   │   ├── FooterSection.vue # 页脚
│   │   │   ├── HeroBanner.vue    # 首页横幅
│   │   │   ├── FeatureCard.vue   # 特性卡片
│   │   │   ├── ProductCard.vue   # 产品卡片
│   │   │   ├── CaseCard.vue      # 案例卡片
│   │   │   └── SectionTitle.vue  # 区块标题
│   │   ├── recommender/          # 方案推荐器（纯 JS 引擎 + Vue 状态）
│   │   │   ├── constants.js      # 维度选项、角色权限、拒绝码与替代路径
│   │   │   ├── engine.js         # 推荐引擎：匹配求值、冲突检测、草稿校验
│   │   │   ├── repository.js     # 规则版本仓库：草稿维护、发布不可变快照
│   │   │   ├── session.js        # 角色会话（sessionStorage）
│   │   │   └── store.js          # Vue 响应式单例：原子求值提交、序号防串扰
│   │   ├── router/               # 路由配置（含权限守卫）
│   │   │   └── index.js
│   │   ├── views/                # 页面视图
│   │   │   ├── HomeView.vue      # 首页
│   │   │   ├── AboutView.vue     # 关于我们
│   │   │   ├── ProductView.vue   # 产品服务
│   │   │   ├── CaseView.vue      # 案例展示
│   │   │   ├── ContactView.vue   # 联系我们
│   │   │   ├── RecommendView.vue # 方案推荐（访客只读）
│   │   │   ├── RuleAdminView.vue # 规则管理（仅规则管理员）
│   │   │   └── ForbiddenView.vue # 403 权限不足 + 替代路径
│   │   ├── App.vue               # 根组件
│   │   └── main.js               # 入口文件
│   ├── tests/                    # 推荐引擎测试（node --test）
│   │   ├── recommender.test.mjs  # 引擎 / 仓库纯逻辑测试
│   │   └── store.test.mjs        # store 集成测试
│   ├── Dockerfile                # Docker构建文件
│   ├── nginx.conf                # Nginx配置
│   ├── package.json              # 依赖配置
│   └── vite.config.js            # Vite配置
├── docker-compose.yml            # Docker编排
├── .gitignore                    # Git忽略配置
└── README.md                     # 项目说明
```

## 6. 功能清单

### 页面功能

| 页面 | 功能点 |
|------|--------|
| 首页 | Hero横幅、公司简介、核心优势、产品亮点、合作伙伴 |
| 关于我们 | 公司介绍、发展历程、企业文化、团队风采 |
| 产品服务 | 智慧物流系统介绍、功能模块、技术优势 |
| 案例展示 | 成功案例列表、案例详情 |
| 联系我们 | 联系方式、公司地址、在线留言表单 |
| 方案推荐 `/recommend` | 需求填写（业务规模/仓储需求/配送场景）、推荐结果与匹配依据同版本展示、拒绝场景替代路径 |
| 规则管理 `/admin/rules` | 草稿规则增删改、启用开关、冲突校验、发布新版本、版本历史（仅规则管理员） |
| 403 `/403` | 权限不足说明与替代路径引导 |

### 方案推荐器核心规则

- **角色权限**：业务访客只读推荐结果与匹配依据；规则管理员维护匹配条件并发布版本；未授权角色的任何写操作在仓库层被拒绝并返回替代路径
- **拒绝与替代路径**：需求为空 / 无匹配规则 / 规则冲突 / 权限不足 / 草稿校验失败，均拒绝操作并给出可执行的替代路径（完善需求、浏览产品、联系顾问、切换角色等）
- **版本一致性**：每次求值原子产出「推荐结果 + 匹配依据 + 版本号」，三者来自同一不可变版本快照；求值序号单调递增，快速切换场景时过期结果直接丢弃；窗口缩放不触发任何重算（纯 CSS 响应式）
- **版本不可变**：已发布版本深冻结，草稿后续修改不影响历史快照；同一需求在不同版本下求值，结果与依据各自归属对应版本

### 技术特性

- ✅ Vue 3 Composition API
- ✅ Vue Router 路由管理（含权限守卫）
- ✅ Element Plus UI组件库
- ✅ SCSS 样式预处理
- ✅ 响应式布局适配
- ✅ 纯 JS 推荐引擎（零依赖，node:test 单测覆盖）
- ✅ Docker 容器化部署
