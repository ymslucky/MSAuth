# MSAuth UI/UX 设计规范（SPEC）

> 版本 v1.1 · 2026-10 · 按前端行业规范修订
> 适用于 web 包全部页面（现有 + Phase 2a/4/5 规划页面）。
> 本文档是唯一视觉与交互事实源；实现不得偏离，改动需先改本文档。

**遵循的行业标准**

- W3C Design Tokens Community Group（令牌分层：primitive → semantic → component）
- WCAG 2.2 AA（引用具体条款，见 §9）
- WAI-ARIA Authoring Practices Guide（Dialog / Alert / Status Message 模式）
- 4px 基线网格（8pt Grid，4 作半步长）
- Core Web Vitals 性能预算（见 §10）
- Tailwind CSS v4 `@theme` 令牌约定（令牌 → 原子类自动映射）

---

## 1. 背景与目标

MSAuth 是面向个人与家人朋友的自托管身份平台。浏览器端完成：登录/注册、会话管理、
批准第三方应用（OAuth 同意）、批准 Agent 委托、（管理员）平台管理。

**设计目标**

1. 「授权」是高风险动作，必须在视觉上清晰、可信任、可预期。
2. 家人朋友零学习成本：路径短、反馈即时、文案说人话。
3. 气质：清新、自然、轻盈的亮色玻璃拟态（visionOS 式空间感）。
4. 桌面优先，移动端完整可用（WCAG 2.2 AA 全程达标）。

**审美锚点**（用户三轮确认）：亮色玻璃拟态；奶白底；清新自然绿强调；
半透明 + 背景模糊 + 光边框 + 渐变 + 大圆角 + 中席轻动效；
参照 Stripe Dashboard 的秩序感、Apple 设置页的清爽感。

**反面清单**（当前版本被点名的问题）：视觉风格、布局与信息结构、交互反馈、
细节打磨、动画编排五个维度全部重做。

---

## 2. 设计原则

1. **玻璃层级制**：背景（奶白+环境光）→ 玻璃卡片 → 玻璃浮层，三层景深用
   模糊度/阴影/描边递进表达；层级不混乱。
2. **绿色即交互**：自然绿只用于可交互与状态确认；环境光可多彩，交互色保持单一绿。
3. **内容优先**：文字永远落在足够实的玻璃面上；对比度不足时加深玻璃而非加粗文字。
4. **反馈即时且有生命**：任何异步动作 ≤100ms 内给出视觉回应；页面入场一次编排
   stagger，之后不打扰。
5. **破坏性操作必须二次确认**：对话框模式（ARIA APG Dialog）。
6. **动效预算克制**：同屏 1 组入场编排；`prefers-reduced-motion` 全量降级（WCAG 2.3.3）。

---

## 3. 设计令牌（Design Tokens）

### 3.0 分层架构

| 层 | 职责 | 举例 |
|---|---|---|
| Primitive | 原始值，无语义，不含用途 | `milk-50`、`leaf-600`、`space-4` |
| Semantic | 引用 primitive，绑定用途 | `--color-canvas`、`--color-action`、`--color-text-primary` |
| Component | 绑定组件状态 | `--color-btn-primary-bg`、`--color-input-border-focus` |

实现约定：Tailwind v4 `@theme` 中声明 semantic 层（页面代码只用 semantic/component）；
primitive 值写在同文件注释块中备查。**组件代码禁止裸色值/裸尺寸**，只引用令牌。

### 3.1 Primitive 色板

| 名称 | HEX | OKLCH（参考） |
|---|---|---|
| milk-50 | `#FDFCF9` | `oklch(0.99 0.006 106)` |
| milk-100 | `#FAF7F0` | `oklch(0.98 0.01 100)` |
| milk-200 | `#F3EFE4` | `oklch(0.95 0.015 98)` |
| ink-900 | `#1C2B25` | `oklch(0.28 0.03 165)` |
| ink-700 | `#33453C` | `oklch(0.37 0.03 165)` |
| ink-500 | `#5F7066` | `oklch(0.51 0.03 165)` |
| ink-400 | `#8B988F` | `oklch(0.66 0.02 160)` |
| leaf-50 | `#F0F9F3` | `oklch(0.97 0.03 155)` |
| leaf-100 | `#DFF2E6` | `oklch(0.94 0.05 155)` |
| leaf-300 | `#8FD3AC` | `oklch(0.82 0.10 155)` |
| leaf-500 | `#3BA76E` | `oklch(0.68 0.12 155)` |
| leaf-600 | `#2C8A58` | `oklch(0.59 0.11 155)` |
| leaf-700 | `#237048` | `oklch(0.51 0.10 155)` |
| warn-500 | `#C98A2E` / 底 `#FBF3E2` | — |
| danger-500 | `#CE4A52` / 底 `#FBEFEF` | — |
| info-500 | `#3E8FA8` / 底 `#EDF5F8` | — |

### 3.2 Semantic 令牌（`@theme` 声明）

```css
--color-canvas: milk-50;        /* 页面底 */
--color-canvas-2: milk-100;     /* 次级底/渐变端点 */
--color-surface-input: milk-200;
--color-text-primary: ink-900;  /* ≥12:1 on canvas（AAA） */
--color-text-secondary: ink-700;
--color-text-tertiary: ink-500; /* 仅 ≥12.5px 辅助小字，≥4.5:1（AA） */
--color-text-disabled: ink-400;
--color-line: rgb(ink-900 / 0.10);
--color-action: leaf-600;       /* 唯一交互主色 */
--color-action-hover: leaf-700;
--color-action-subtle: leaf-50;
--color-success / --color-warning / --color-danger / --color-info：见 3.1 语义行
```

### 3.3 环境光（Ambient Light）

奶白底 + 2–3 个超柔和径向光斑，只出现在页面级背景（玻璃卡片之下）：

```
光斑A：radial 880×520 @ (18%, -8%)   #CDE9D6 40% → 透明   （薄荷绿）
光斑B：radial 720×480 @ (86%, 108%)  #F3E6C4 36% → 透明   （奶金）
光斑C：radial 560×420 @ (60%, 30%)   #DCEFE8 30% → 透明   （浅青绿，仅认证/同意页）
```

规则：高密度页只用 A+B；光斑不参与对比度计算，文字不直接压光斑。

### 3.4 玻璃材质（三档，elevation 体系的一部分）

| 档位 | 背景 | 模糊/饱和 | 阴影 | 用途 |
|---|---|---|---|---|
| `.glass-1` | `rgb(255 255 255 / 0.62)` | `14px / 1.4` | `--shadow-1` | 页面卡片 |
| `.glass-2` | `rgb(255 255 255 / 0.74)` | `18px / 1.5` | `--shadow-2` | toast、下拉、抽屉 |
| `.glass-3` | `rgb(255 255 255 / 0.82)` | `22px / 1.6` | `--shadow-3` | 模态对话框 |

共同描边：外 `1px rgb(ink / 0.06~0.10)` + 顶部内高光
`inset 0 1px 0 rgb(255 255 255 / 0.9)`（visionOS 光边框）。

**性能护栏**：同屏 backdrop-filter 元素 ≤12；模糊 ≤22px；
`@supports not (backdrop-filter…)` 与 `prefers-reduced-transparency` 回退为
实底 `canvas` + 同阴影。

### 3.5 字体策略（行业规范：中文不加载 webfont）

| 角色 | 家族 | 字重 |
|---|---|---|
| Display | `Sora Variable` | 600/700 |
| UI/正文 | `Onest Variable` | 400/500/600 |
| 数据 | `JetBrains Mono Variable` | 400/500 |

```css
--font-display: 'Sora Variable', 'Onest Variable', 'PingFang SC', 'HarmonyOS Sans SC',
                'MiSans', 'Microsoft YaHei', sans-serif;
--font-sans:    'Onest Variable', <同上中文栈>;
--font-mono:    'JetBrains Mono Variable', ui-monospace, 'Cascadia Mono', monospace;
```

拉丁字符用自托管 woff2（`font-display: swap`、`font-src 'self'` 满足 CSP），
**中文一律系统字体**（中文 webfont 体积不可接受）。字重子集化：Sora 2 / Onest 3 / Mono 2。

字阶（桌面，<768px 各降 1 档，比例 ~1.25 Major Third）：

| 令牌 | 规格 | 用途 |
|---|---|---|
| `text-display` | Sora 700 · 30/34 · -0.01em | 页主标题 |
| `text-title` | Sora 600 · 20/26 | 卡片标题 |
| `text-body` | Onest 400 · 14.5/24 | 正文 |
| `text-body-strong` | Onest 600 · 14.5/24 | 列表主字段、按钮 |
| `text-caption` | Onest 400 · 12.5/19 | 辅助说明 |
| `text-data` | Mono 400 · 12.5/20 | ID/IP/UA/时间 |
| `text-overline` | Mono 500 · 11px · 0.14em · 大写 | 区块眉标 |

### 3.6 空间 / 圆角 / 尺寸

- **4px 基线网格**：间距阶 `4·8·12·16·24·32·48·64`；组件高度对齐 4 的倍数
  （44 表单控件 / 40 默认按钮 / 32 紧凑按钮 / 52 表格行）。
- 圆角：卡片 16（`rounded-2xl`）、控件 12（`rounded-xl`）、对话框 24（`rounded-3xl`）、
  徽标 8、头像全圆。
- 卡片内边距 20 / 主卡 24；内容宽：表单 420 / 账户区 720 / 管理列表 1080。
- 触控目标 ≥44×44（超出 WCAG 2.5.8 的 24px 最低要求，取移动最佳实践）。

### 3.7 图标

`lucide-react`，`strokeWidth=1.75`；尺寸阶 16/20/24（对齐 4pt）；
按钮内 16、行内 18、空态 24。禁止混用填充与线性。

### 3.8 Elevation 与 z-index 阶梯

| 层 | z-index |
|---|---|
| 内容基础 | 0 |
| sticky 表头/侧栏 | 10 |
| 下拉/抽屉 | 100 |
| toast | 200 |
| 模态对话框 | 300 |
| tooltip | 400 |

阴影阶梯 `--shadow-1/2/3` 与玻璃三档一一对应，禁止临时阴影。

---

## 4. 动效系统（中席：有生命感）

**时长规范**（行业共识区间）：微交互 100–150ms；入场 200–300ms；
模态/页面 300–400ms。只动 `opacity/transform`（合成层），禁止过渡
`backdrop-filter/box-shadow`（阴影切换用预定义两态类切换）。

| 令牌 | 值 |
|---|---|
| `dur-fast` | 140ms |
| `dur-base` | 220ms |
| `dur-slow` | 360ms |
| `ease-out-soft` | `cubic-bezier(0.22, 0.61, 0.36, 1)` |
| `ease-spring` | `cubic-bezier(0.34, 1.3, 0.5, 1)` |

编排规则：

1. 页面入场 stagger：区块 60ms 间隔 `rise-in`（12px 上移 + 淡入，`dur-slow`），
   每页一次，≤4 层级。
2. 悬浮抬升：可点击卡片 hover `translateY(-2px)` + 阴影升一档（`dur-fast`）。
3. 玻璃高光：主按钮/卡片 hover 一道斜向高光位移（CSS `background-position`）。
4. 对话框：`scale(0.96)→1` + 淡入（`ease-spring`）；遮罩 `canvas 40% + blur(4px)`。
5. Toast：右上滑入 16px / 240ms；消失淡出。
6. 列表条目移除：高度收起 + 淡出 240ms。
7. `prefers-reduced-motion: reduce`：位移动画 → 纯淡入淡出，时长减半（WCAG 2.3.3）。

---

## 5. 布局系统

### 5.1 认证布局（登录/注册）

环境光加强背景（A+B+C）→ 品牌区（菱形 logo 自然绿渐变描边 + Sora 字标 + 眉标）
→ 玻璃主卡 `.glass-1` 420px（眉标 + Display 标题 + 表单/分隔/GitHub 按钮/主按钮）
→ 底部切换链接 → 页脚 mono 小字。

### 5.2 应用壳（账户区）

左 240px 玻璃侧栏（`.glass-1`，整高）：logo、导航（图标+文字，激活态
`leaf-50` 底 + `leaf-600` 字 + 左 3px 绿圆角条）、底部用户卡（头像/显示名/
mono 邮箱/角色徽标）+ 退出（quiet）。内容区 720px 居中：页眉（眉标 + Display
标题 + 右侧主操作）+ 卡片组 stagger。<768px 侧栏折叠为顶部玻璃条 + 抽屉（`.glass-2`）。

### 5.3 管理壳（Phase 5）

复用 AppShell；列表页 1080px「玻璃卡内嵌表格」：sticky 表头 caption 级字、
行 hover `leaf-50 40%`、行高 52；详情页左信息卡 + 右操作卡（<1024 单栏）。

### 5.4 断点（Tailwind 标准命名，桌面优先）

| 断点 | 行为 |
|---|---|
| `xl` ≥1280 | 管理列表全宽 |
| `lg` 1024–1279 | 标准桌面 |
| `md` 768–1023 | 侧栏图标化；两栏 → 单栏 |
| `<md`（sm 及以下） | 侧栏→抽屉；表单页全宽 -32px；表格卡片化 |

---

## 6. 组件规范

### 6.0 通用状态矩阵（所有交互组件必达）

| 状态 | 定义 |
|---|---|
| default | 规范主样式 |
| hover | 仅指针设备；`dur-fast` |
| focus-visible | 2px `action` 外环 + 2px 间距（WCAG 2.4.7；禁止 outline:none 裸奔） |
| active | 按下：亮度加深或 `scale(0.98)` |
| disabled | 40% 透明 + `cursor:not-allowed` + `aria-disabled` |
| loading | 16px 旋转环，文案不变，交互锁定 |
| error | danger 描边/文字（表单类） |

### 6.1 Button

| 变体 | 样式 | 用途 |
|---|---|---|
| `primary` | `action` 实底白字 + 白 8% 内高光；hover `action-hover` + 抬升 | 每页至多 1 |
| `glass` | `.glass-2` + `text-secondary`；hover 光边框转绿 | 次级 |
| `danger` | 透明底 + danger 描边字；hover danger 浅底 | 破坏性（配 Dialog） |
| `quiet` | 无底 `text-tertiary`；hover `action` | 文字级 |

尺寸 40（默认）/32（紧凑）。

### 6.2 Field / Input

标签 = overline 且 `for` 关联；输入 44 高、`surface-input` 底、1px `line` 描边、
圆角 12。焦点：描边 `leaf-300` + 外扩 4px `leaf-50/60%` 光环（150ms）。
错误：danger 描边 + 行内 caption（图标+文案）。必带 HTML 语义属性：
`autocomplete`（email/current-password/new-password 等）、`inputmode`、
`aria-invalid`、`aria-describedby`（错误 id）。

### 6.3 GlassCard / Badge / Avatar / Skeleton / EmptyState

- **GlassCard**：`.glass-1` + 可选头（title/desc/右动作）；可点击变体加抬升。
- **Badge**：admin=leaf-600 实底白字（唯一实底）；member/viewer=leaf-50+leaf-700；
  中性=milk-200+ink-500；成功=leaf-50+圆点；危险=danger 浅底。mono 11px/22 高/圆角 8。
- **Avatar**：40px 圆，显示名首字，背景 = 名字哈希 → 绿色系 5 档渐变。
- **Skeleton**：`milk-100→milk-200` 呼吸渐变，形状对齐目标组件。
- **EmptyState**：图标 24 + 标题 + 一句话 + 主操作，居中大留白。

### 6.4 Toast（ARIA APG Status/Alert）

- 顶部右侧 20px；`.glass-2`；360 宽；圆角 14。
- 成功 3.5s 自动消失、错误 6s 或手动关；同屏 ≤3 条堆叠。
- `role="status"`（成功）/ `role="alert"`（错误）——满足 WCAG 4.1.3 Status Messages。
- **表单校验错误不用 toast**（留在表单内）；toast 只反馈动作结果。

### 6.5 Dialog（ARIA APG Dialog 模式）

`.glass-3` 420 圆角 24，spring 进出；`role="dialog"` + `aria-modal="true"` +
标题 `aria-labelledby`；打开时焦点移入、Tab 循环、Esc/遮罩关闭、关闭后焦点还原；
正文滚动锁定。结构：危险图标（danger 浅底圆）+ 标题 + 说明 + 取消（glass）
+ 确认（danger/primary）。

### 6.6 数据表（管理端）

玻璃容器 + 实底行（性能护栏）；表头 sticky；行分隔 1px `canvas-2`；
hover `leaf-50/40`；操作列 hover 前图标 50% 透明；空态用 EmptyState。

---

## 7. 页面规范（逐页）

### 7.1 登录 `/login`

AuthLayout；眉标 `SIGN IN · 登录`；标题「欢迎回来」。邮箱/密码（可切明文）/
主按钮全宽/分隔「或」/GitHub 玻璃按钮。凭据错误 → 卡顶 danger 玻璃条统一文案
「邮箱或密码不正确」（防枚举一致）；`?error=github_failed` → 同位置提示。

### 7.2 注册 `/register`

字段：显示名/邮箱/密码。密码仅长度反馈（≥10 变绿勾），与后端策略一致。

### 7.3 账户概览 `/account`

三卡 stagger：①身份卡（头像、Display 显示名、mono 邮箱、角色徽标）
②登录方式卡（密码状态、GitHub 绑定状态与入口）③账户信息卡（ID 可复制、
创建/最近登录）。「安全建议」卡取消，改为会话卡内一行链接。

### 7.4 会话管理 `/account/sessions`

页眉主操作「撤销其他会话」（glass，无其他会话禁用）。设备行卡：设备类型图标 +
摘要 + `text-data`（ID 前缀 · IP · 活跃时间）+ 当前徽标 + 撤销（danger quiet）。
撤销 → Dialog 确认（当前会话文案不同）→ toast + 行收起动画。
「撤销其他」→ Dialog 显示数量 → toast「已撤销 N 个会话」。

### 7.5 改密码 `/account/password`

单卡：当前密码（GitHub-only 显示「首次设置可留空」提示）/ 新密码 / 确认新密码
（不一致行内即时提示）。成功 → toast「密码已更新，其他设备已退出」+ 表单重置，
不跳转（当前会话保留）。

### 7.6 OAuth 同意页 `/consent?request_id=`（Phase 2a 新建）

防钓鱼第一：①请求来源域名条（锁图标 + 绿色粗体域名）②应用身份（名 + 图标 +
描述）③scope 清单（图标 + 名称 + 人话说明，取自 shared SCOPES）④将获得什么
（caption）⑤操作区：拒绝（glass）+ 授权（primary，倒计时 3s 防误触）。
未登录 → 登录后带 returnTo 回跳；request_id 无效 → 空态卡。

### 7.7 Agent 委托同意页 `/agent-consent`（Phase 4 规划）

7.6 基础 + 委托链可视化（节点玻璃小卡线性图）+ 权限收窄对比（父级列表、
保留项高亮）+ 时效徽标（5 分钟倒计时，warning）。按钮文案绑定资源：
「授权访问 mstor（只读文件）」。

### 7.8 管理后台（Phase 5 规划）

- 概览：指标卡 ×3 + 最近事件时间线。
- 用户：表格（头像/姓名/邮箱/角色/GitHub/最近登录/状态）；详情 = 信息卡 + 角色分配
  （Switch 列表）+ 会话管理（复用 7.4）+ 危险区（红边玻璃卡 + Dialog）。
- 客户端：列表 + 详情（信息/scope/TTL/redirect URI/secret 轮换）。secret 一次性
  展示 = `.glass-3` 专用对话框，mono 大字 + 复制 + warning「关闭后无法再查看」。
- 审计：过滤器条 + 时间线（mono 时间 + 动作中文名 + actor + 结果徽标），
  行展开 metadata JSON。
- 策略：表单卡。

### 7.9 帮助页 `/help`（Phase 5 规划）

左 sticky 目录 + 右 react-markdown 正文（glass-1 大卡，代码块 `surface-input` 底 mono）。

### 7.10 404 / ErrorBoundary

404：居中玻璃卡 + 线条图形 +「页面不存在」+ 返回账户。
**ErrorBoundary（新增，工程标配）**：渲染异常兜底页（玻璃卡 + 「出错了」+
错误 id mono + 刷新按钮），避免白屏。

---

## 8. 交互反馈模式（全局矩阵）

| 场景 | 反馈 |
|---|---|
| 路由切换 | 立即骨架（若有异步数据）+ 一次 stagger |
| 列表加载 | Skeleton |
| 表单提交 | 按钮 loading ≤100ms 出现；期间表单锁定 |
| 操作成功 | Toast 3.5s + 数据刷新（会话撤销 = 乐观更新 + 失败回滚） |
| 操作失败 | Toast 6s（人话原因）+ 状态回滚 |
| 破坏性操作 | Dialog 二次确认；确认按钮 3s 防重复 |
| 网络错误 | Toast「网络异常」；幂等 GET 自动重试 1 次 |
| 401 失效 | 静默跳登录（returnTo 回跳），不弹 toast |
| 校验错误 | 失焦行内校验 + 提交聚焦首个错误字段 |
| 渲染异常 | ErrorBoundary 兜底页 |

---

## 9. 无障碍（WCAG 2.2 条款化）

| 条款 | 要求 | 落点 |
|---|---|---|
| 1.4.3 对比度 | ≥4.5:1 | 令牌已验算（§3.2）；玻璃+环境光叠加后复测 |
| 2.4.7 焦点可见 | 全组件 focus-visible 环 | §6.0 |
| 2.4.3 焦点顺序 | DOM 顺序 = 视觉顺序 | 布局约束 |
| 2.5.8 目标尺寸 | ≥24（AA），目标 44 | §3.6 |
| 2.3.3 动效自交互 | reduced-motion 降级 | §4 |
| 4.1.3 状态消息 | toast role=status/alert | §6.4 |
| 1.4.13 悬停内容 | —（无 tooltip 持续悬停场景） | — |
| 4.1.2 名称/角色/值 | 图标按钮 aria-label；Switch aria-checked | 组件 |

键盘全程可用：Dialog 焦点陷阱 + Esc；侧栏/表格/下拉可 Tab。

---

## 10. 性能预算（Core Web Vitals，构建版）

| 指标 | 预算 |
|---|---|
| LCP | < 2.5s（桌面本地构建） |
| INP | < 200ms |
| CLS | < 0.1（字体 swap + 骨架占位防跳） |
| JS gz | 首包 ≤ 180KB（当前 ~160KB，禁止引入动画/UI 大库） |
| backdrop-filter | 同屏 ≤12 元素、blur ≤22px |
| Lighthouse | Performance ≥ 90 / Accessibility ≥ 95 |

工程约束：**CSP 无 unsafe-inline** → 渐变/动效全部 CSS 类 + 外链 `@keyframes`，
零内联 style（动态值走 CSS 变量）；字体 woff2 子集 + swap；动画仅
`opacity/transform`；长列表（审计）「玻璃容器 + 实底行」。

---

## 11. 验收清单

- [ ] `@theme` 令牌与 §3 一一对应；组件无裸色值/裸尺寸（code review 项）
- [ ] 玻璃三档 + 降级回退（`@supports` / reduced-transparency）
- [ ] 7.1–7.5 + 404 + ErrorBoundary 按规范实现，视觉走查通过
- [ ] Toast / Dialog / Skeleton / EmptyState / Avatar 落地并接入 §8 矩阵
- [ ] stagger + 悬浮动效 + reduced-motion 降级可演示
- [ ] 键盘走查（Tab/Esc/焦点还原/焦点陷阱）通过
- [ ] `md` 与 `<md` 断点走查通过
- [ ] 对比度抽测（玻璃面 + 环境光叠加处）达标
- [ ] Lighthouse 双指标达标（构建版）
- [ ] 同意页（Phase 2a 前）按 §7.6 实现（域名条 + 倒计时 + 防钓鱼走查）

---

## 12. 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v1.0-draft | 2026-10-04 | 首版：用户三轮确认（亮色玻璃/自然绿/中席动效/桌面优先/全页面） |
| v1.1 | 2026-10-04 | 行业规范修订：令牌三层架构、WCAG 2.2 条款化、状态矩阵、z-index/elevation 阶梯、Core Web Vitals 预算、中文系统字体策略、ARIA APG（Dialog/Toast）、ErrorBoundary、4px 基线网格 |
