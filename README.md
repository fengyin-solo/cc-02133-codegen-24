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
```

## 2. Services

| 服务 | 端口 | 说明 |
|------|------|------|
| 官网前端 | 8081 | Vue 3 静态页面 |

## 3. 测试账号

本项目为纯静态官网，无需登录账号。

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
│   │   │   ├── NavHeader.vue     # 导航栏
│   │   │   ├── FooterSection.vue # 页脚
│   │   │   ├── HeroBanner.vue    # 首页横幅
│   │   │   ├── FeatureCard.vue   # 特性卡片
│   │   │   ├── ProductCard.vue   # 产品卡片
│   │   │   ├── CaseCard.vue      # 案例卡片
│   │   │   └── SectionTitle.vue  # 区块标题
│   │   ├── router/               # 路由配置
│   │   │   └── index.js
│   │   ├── views/                # 页面视图
│   │   │   ├── HomeView.vue      # 首页
│   │   │   ├── AboutView.vue     # 关于我们
│   │   │   ├── ProductView.vue   # 产品服务
│   │   │   ├── CaseView.vue      # 案例展示
│   │   │   └── ContactView.vue   # 联系我们
│   │   ├── App.vue               # 根组件
│   │   └── main.js               # 入口文件
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

### 技术特性

- ✅ Vue 3 Composition API
- ✅ Vue Router 路由管理
- ✅ Element Plus UI组件库
- ✅ SCSS 样式预处理
- ✅ 响应式布局适配
- ✅ Docker 容器化部署

## 7. 方案推荐器（新增模块）

独立于官网页面的方案推荐功能，访问入口：

| 页面 | 地址 | 说明 |
|------|------|------|
| 方案推荐（业务访客） | http://localhost:8081/recommend | 选择业务规模、仓储需求、配送场景，查看推荐结果与逐条匹配依据 |
| 规则管理（规则管理员） | http://localhost:8081/recommend/admin | 维护匹配规则、冲突预检、发布不可变版本 |

- 角色通过推荐器右上角下拉切换：**规则管理员 / 业务访客 / 未授权访客**；未授权角色不能改动规则，也无法直接进入规则管理。
- 需求为空、需求不完整、无匹配规则、规则冲突、权限不足时系统拒绝执行并给出替代路径。
- 推荐结果只在点击「获取方案推荐」时生成并锁定版本；快速切换场景、清空需求、缩放窗口均不改变当前结果与依据。
- 详细设计见 [`docs/recommender_design.md`](docs/recommender_design.md)；单元测试：

```bash
cd frontend-user
npm test
```

> 该模块为纯增量：不改动官网导航、页脚及五个既有页面的任何内容。
