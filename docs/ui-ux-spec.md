# MSAuth UI/UX 设计规范（SPEC）

> 版本 v1.2 · 2026-10 · Bento 网格 / 轻质感 SaaS 仪表盘（按用户参考图重定向）
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
3. 气质：现代 Bento 网格布局的轻质感 SaaS 仪表盘——浅灰画布上白色悬浮卡片，
   信息密度清晰、重点数据一眼可读。
4. 桌面优先，移动端完整可用（WCAG 2.2 AA 全程达标）。

**审美锚点**（用户确认 + 参考图 HR Tool 仪表盘）：浅灰背景；白色悬浮卡片；
柔和弥散阴影；大圆角（16–24px）；亮蓝色为主色；紫/橙/红点缀；
无衬线字体；数据可视化（环形进度 donut + 渐变填充面积图）；
大号粗体数字 + 小号灰色说明文字；胶囊实底蓝按钮；圆形彩色头像。
参照 Linear / Notion Calendar / Stripe Dashboard 的秩序感。

**反面清单**：禁止玻璃拟态（backdrop-filter）、禁止绿色主色、禁止花哨渐变背景、
禁止裸色值/裸尺寸、禁止 outline:none 裸奔、禁止引入图表/动画大库。

---

## 2. 设计原则

1. **画布与卡片两层景深**：浅灰画布承载白色卡片；层级靠阴影深浅（不是模糊度）
   表达，浮层（toast/dialog）阴影最重。
2. **蓝色即交互**：亮蓝只用于可交互元素与主数据强调；紫/橙/红仅作
   语义点缀（分类/状态/趋势），不参与主交互。
3. **数据优先**：概览类页面用 Bento 网格组织「大数字 + 图形 + 说明」统计卡；
   数字用 Display 粗体大号，说明用 caption 灰色。
4. **反馈即时**：任何异步动作 ≤100ms 内给出视觉回应；页面入场一次编排
   stagger，之后不打扰。
5. **破坏性操作必须二次确认**：对话框模式（ARIA APG Dialog）。
6. **动效预算克制**：同屏 1 组入场编排；`prefers-reduced-motion` 全量降级（WCAG 2.3.3）。

---

## 3. 设计令牌（Design Tokens）

### 3.0 分层架构

| 层 | 职责 | 举例 |
|---|---|---|
| Primitive | 原始值，无语义 | `slate-500`、`blue-600`、`space-4` |
| Semantic | 引用 primitive，绑定用途 | `--color-canvas`、`--color-action`、`--color-text-primary` |
| Component | 绑定组件状态 | `--color-btn-primary-bg`、`--color-input-border-focus` |

实现约定：Tailwind v4 `@theme` 中声明 semantic 层（页面代码只用 semantic/component）；
primitive 值写在同文件注释块中备查。**组件代码禁止裸色值/裸尺寸**，只引用令牌
（例外：纯 SVG 数据可视化组件可用 accent primitive 常量，集中在组件文件顶部）。

### 3.1 Primitive 色板

| 名称 | HEX | 备注 |
|---|---|---|
| slate-900 | `#0F172A` | 主文本 |
| slate-700 | `#334155` | 次级文本 |
| slate-500 | `#64748B` | 辅助文本（画布上 ≥4.5:1） |
| slate-400 | `#94A3B8` | 占位/禁用/图表轴 |
| gray-100 | `#F4F5F8` | 输入框底、骨架屏 |
| canvas | `#F1F2F6` | 页面画布（浅灰） |
| line | `rgb(15 23 42 / 0.08)` | 描边（白卡上） |
| blue-500 | `#3B82F6` | 主色 |
| blue-600 | `#2563EB` | 主色 hover |
| blue-50 | `#EFF6FF` | 主色浅底 |
| purple-500 | `#8B5CF6` / 底 `#F5F3FF` / 文字级 `#6D28D9` | 点缀：委托/Agent 相关 |
| orange-500 | `#F97316` / 底 `#FFF7ED` / 文字级 `#C2410C` | 点缀：警示/等待 |
| red-500 | `#EF4444` / 底 `#FEF2F2` / 文字级 `#DC2626` | 危险/错误（图标点用 500，文字用 600 级） |
| green-500 | `#10B981` / 底 `#ECFDF5` / 文字级 `#059669` | 成功/在线（仅状态，不作交互色） |
| sky-500 | `#0EA5E9` / 底 `#F0F9FF` / 文字级 `#0369A1` | 信息 |
| amber-500 | `#F59E0B` / 底 `#FFFBEB` / 文字级 `#B45309` | 警告 |

> 规则：语义色分两档——`-vivid`（500 级）用于图标点/图表弧/装饰，文字与描边一律用
> 文字级（600–700 级）保证白底/浅底 ≥4.5:1（WCAG 1.4.3）。

### 3.2 Semantic 令牌（`@theme` 声明）

```css
--color-canvas: #f1f2f6;          /* 页面底 */
--color-surface: #ffffff;          /* 卡片底 */
--color-surface-input: #f4f5f8;    /* 输入框底 */
--color-ink: slate-900;            /* 主文本 ≥14:1 on canvas（AAA） */
--color-ink-2: slate-700;
--color-ink-3: slate-500;          /* 辅助 ≥4.5:1（AA） */
--color-ink-4: slate-400;
--color-line: rgb(15 23 42 / 0.08);
--color-action: blue-500;          /* 唯一交互主色 */
--color-action-hover: blue-600;
--color-action-subtle: blue-50;
--color-success / --color-warning / --color-danger / --color-info：见 3.1 语义行
--color-accent-purple / --color-accent-orange：点缀语义（§6.8 数据可视化、委托场景）
```

### 3.3 画布背景

纯浅灰 `canvas`，无渐变光斑、无纹理。认证页可加一个极淡的顶部蓝色光晕
（`radial 900px 400px @ (50%, -10%) blue-500/8% → transparent`，仅此一处），
不参与对比度计算。

### 3.4 卡片材质（elevation 体系）

实底白色，**无 backdrop-filter**。三档阴影：

| 档位 | 类名 | 阴影 | 用途 |
|---|---|---|---|
| 1 | `.card` | `0 1px 2px rgb(15 23 42/0.04), 0 8px 24px -12px rgb(15 23 42/0.10)` | 页面卡片 |
| 2 | `.card-float` | `0 2px 4px rgb(15 23 42/0.05), 0 16px 40px -16px rgb(15 23 42/0.16)` | toast、下拉、抽屉 |
| 3 | `.card-modal` | `0 4px 8px rgb(15 23 42/0.06), 0 24px 64px -24px rgb(15 23 42/0.24)` | 模态对话框 |

共同规格：`background: --color-surface`；描边 `1px --color-line`（可选，卡片默认有，
浮层可省）。可点击卡片 hover：阴影升一档 + `translateY(-2px)`。

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
**中文一律系统字体**。字重子集化：Sora 2 / Onest 3 / Mono 2。

字阶（桌面，<768px 各降 1 档，比例 ~1.25 Major Third）：

| 令牌 | 规格 | 用途 |
|---|---|---|
| `text-display` | Sora 700 · 30/34 · -0.01em | 页主标题、问候语 |
| `text-stat` | Sora 700 · 32/36 · -0.01em | 统计卡大数字 |
| `text-title` | Sora 600 · 18/24 | 卡片标题 |
| `text-body` | Onest 400 · 14.5/24 | 正文 |
| `text-body-strong` | Onest 600 · 14.5/24 | 列表主字段、按钮 |
| `text-caption` | Onest 400 · 12.5/19 | 辅助说明 |
| `text-data` | Mono 400 · 12.5/20 | ID/IP/UA/时间 |
| `text-overline` | Mono 500 · 11px · 0.14em · 大写 | 区块眉标 |

### 3.6 空间 / 圆角 / 尺寸

- **4px 基线网格**：间距阶 `4·8·12·16·20·24·32·48`；组件高度对齐 4 的倍数
  （44 表单控件 / 40 默认按钮 / 32 紧凑按钮 / 52 表格行）。
- 圆角：**卡片 20**（`rounded-card`）、对话框 24（`rounded-dialog`）、
  控件 12（`rounded-xl`）、徽标 8、头像/图标容器全圆。
- 卡片内边距 20 / 主卡 24；Bento 网格 gap 16–20。
- 内容宽：表单 420 / 账户区 960（Bento 需要横向空间）/ 管理列表 1080。
- 触控目标 ≥44×44（超出 WCAG 2.5.8 的 24px 最低要求，取移动最佳实践）。

### 3.7 图标

`lucide-react`，`strokeWidth=1.75`；尺寸阶 16/20/24（对齐 4pt）；
按钮内 16、行内 18、空态 24。侧栏导航 20。禁止混用填充与线性。

### 3.8 Elevation 与 z-index 阶梯

| 层 | z-index |
|---|---|
| 内容基础 | 0 |
| sticky 表头/侧栏 | 10 |
| 下拉/抽屉 | 100 |
| toast | 200 |
| 模态对话框 | 300 |
| tooltip | 400 |

阴影阶梯 `.card` / `.card-float` / `.card-modal` 三档一一对应，禁止临时阴影。

---

## 4. 动效系统（轻快：有生命感）

**时长规范**：微交互 100–150ms；入场 200–300ms；模态/页面 300–400ms。
只动 `opacity/transform`（合成层），禁止过渡 `box-shadow`（阴影切换用
预定义两态类切换）。

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
3. 对话框：`scale(0.96)→1` + 淡入（`ease-spring`）；遮罩 `rgb(15 23 42/0.32)`
   半透明深灰，不用模糊。
4. Toast：右上滑入 16px / 240ms；消失淡出。
5. 数据可视化入场：donut 弧线 `stroke-dashoffset` 展开一次 400ms；折线图
   `clip-path` 自左向右揭示 400ms（仅 CSS 类，CSP 安全）。
6. `prefers-reduced-motion: reduce`：位移动画 → 纯淡入淡出，时长减半（WCAG 2.3.3）。

---

## 5. 布局系统

### 5.1 Bento 网格（核心布局原语）

`.bento`：CSS Grid，`gap-4`（20 于 lg）；列定义随页面：

- 账户概览：`md:grid-cols-2 lg:grid-cols-3`，卡片可 `col-span/row-span` 合并。
- 管理概览（Phase 5）：`md:grid-cols-2 xl:grid-cols-4`。
- 移动端一律单列堆叠。

网格内卡片高度由内容决定、同行等高（`items-stretch` 默认）。

### 5.2 认证布局（登录/注册）

浅灰画布（+顶部淡蓝光晕）→ 居中品牌（亮蓝圆角方块 logo + Sora 字标 + 眉标）
→ 白色主卡 `.card` 420px 圆角 20（眉标 + Display 标题 + 表单/分隔/GitHub 按钮/
主按钮）→ 底部切换链接 → 页脚 mono 小字。

### 5.3 应用壳（账户区）

**左 76px 白色悬浮图标侧栏**：`.card` 圆角 20、与画布留 12–16px（非贴边通栏），
内部：logo（居中）、**图标导航**（每项 44×44 圆角 12，图标 20；激活态 `action`
实底白图标 + `shadow-card`，hover `canvas` 底；`aria-label` + `title` 必带）、
底部头像（36px）+ 角色徽标 + 退出图标按钮（hover danger 浅底）。
文字标签仅出现在移动端抽屉（`.card-float`，w-64，图标+文字导航项 +
用户卡显示名/mono 邮箱 + 全宽退出）。

内容区：`max-w-[960px]` 居中，页眉（问候语 Display + caption 副标题 + 右侧主操作）
+ Bento 网格 stagger。<768px 侧栏折叠为顶部白条 + 抽屉（`.card-float`）。

### 5.4 管理壳（Phase 5）

复用 AppShell；列表页 1080px「白卡内嵌表格」：sticky 表头 caption 级字、
行 hover `canvas`、行高 52；详情页左信息卡 + 右操作卡（<1024 单栏）。

### 5.5 断点（Tailwind 标准命名，桌面优先）

| 断点 | 行为 |
|---|---|
| `xl` ≥1280 | 管理列表全宽 |
| `lg` 1024–1279 | 标准桌面，Bento 3 列 |
| `md` 768–1023 | 侧栏图标化；Bento 2 列 |
| `<md`（sm 及以下） | 侧栏→抽屉；表单页全宽 -32px；表格卡片化；Bento 单列 |

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
| `primary` | `action` 实底白字（胶囊感圆角 12）+ hover `action-hover` + 微抬升 | 每页至多 1 |
| `secondary` | 白底 + `line` 描边 + `ink-2` 字；hover `canvas` 底描边加深 | 次级 |
| `danger` | 透明底 + danger 描边字；hover danger 浅底 | 破坏性（配 Dialog） |
| `quiet` | 无底 `ink-3`；hover `action` | 文字级 |

尺寸 40（默认）/32（紧凑）。

### 6.2 Field / Input

标签 = overline 且 `for` 关联；输入 44 高、`surface-input` 底、1px `line` 描边、
圆角 12。焦点：描边 `action` + 外扩 4px `blue-500/15%` 光环（150ms）。
错误：danger 描边 + 行内 caption（图标+文案）。必带 HTML 语义属性：
`autocomplete`、`inputmode`、`aria-invalid`、`aria-describedby`（错误 id）。

### 6.3 Card / Badge / Avatar / Skeleton / EmptyState

- **Card**：`.card` 圆角 20 + 可选头（title/desc/右动作，头下 1px 分隔线）；
  可点击变体加抬升。
- **Badge**：admin=`action` 实底白字（唯一实底）；member/viewer=`blue-50`+`blue-600`；
  中性=`canvas`+`ink-3`；成功=green 底+字 + 圆点；危险=danger 浅底；
  警告=amber 浅底；信息=sky 浅底；紫=委托场景。mono 11px/22 高/圆角 8。
- **Avatar**：40px 圆（身份卡 56），显示名首字白字，背景 = 名字哈希 →
  蓝/紫/橙/天蓝/靛蓝 5 档渐变。
- **Skeleton**：`gray-100 → canvas` 呼吸渐变，形状对齐目标组件。
- **EmptyState**：图标 24 + 标题 + 一句话 + 主操作，居中大留白；图标容器
  `blue-50` 底 `action` 字。

### 6.4 Toast（ARIA APG Status/Alert）

- 顶部右侧 20px；`.card-float`；360 宽；圆角 14。
- 成功 3.5s 自动消失、错误 6s 或手动关；同屏 ≤3 条堆叠。
- `role="status"`（成功/信息）/ `role="alert"`（错误）——满足 WCAG 4.1.3。
- **表单校验错误不用 toast**（留在表单内）；toast 只反馈动作结果。

### 6.5 Dialog（ARIA APG Dialog 模式）

`.card-modal` 白底 420 圆角 24，spring 进出；`role="dialog"` + `aria-modal="true"`
+ 标题 `aria-labelledby`；打开时焦点移入、Tab 循环、Esc/遮罩关闭、关闭后焦点还原；
正文滚动锁定。结构：图标圆（danger 浅底 / blue-50）+ 标题 + 说明 +
取消（secondary）+ 确认（danger/primary）。

### 6.6 数据表（管理端）

白卡容器 + 实底行；表头 sticky；行分隔 1px `line`；hover `canvas`；
行高 52；操作列 hover 前图标 50% 透明；空态用 EmptyState。

### 6.7 侧栏图标导航（AppShell 专用）

每项 44×44、圆角 12、图标 20；`aria-label` + `title` 必带（图标-only）；
激活 `action` 实底白图标 + `shadow-card`；hover `canvas` 底。
文字标签仅出现在移动端抽屉（13px）。

### 6.8 数据可视化（纯 SVG 手写，禁引图表库）

统一约束：viewBox 固定、`role="img"` + `aria-label` 描述结论
（如「活跃会话 3，当前设备占 1」）；动画仅入场一次；颜色取 accent primitive。

| 组件 | 规格 |
|---|---|
| **Donut**（环形进度） | SVG 圆环：轨道 `gray-100` 8px，值弧 `action`/accent 8px 圆头；中心可叠大数字；尺寸 64/80 |
| **Sparkbar**（迷你柱状） | 7 根圆角柱，`blue-500/25` 底、当天 `action` 实底；高 48 |
| **AreaTrend**（面积折线，Phase 5） | 平滑折线 `action` 2px + 线性渐变填充 `blue-500/20→0`；轴 `ink-4` caption；hover 数据点待 Phase 5 |

---

## 7. 页面规范（逐页）

### 7.1 登录 `/login`

AuthLayout；眉标 `SIGN IN · 登录`；标题「欢迎回来」。邮箱/密码（可切明文）/
主按钮全宽/分隔「或」/GitHub secondary 按钮。凭据错误 → 卡顶 danger 浅底条
统一文案「邮箱或密码不正确」（防枚举一致）；`?error=github_failed` → 同位置提示。

### 7.2 注册 `/register`

字段：显示名/邮箱/密码。密码仅长度反馈（≥10 变绿勾），与后端策略一致。

### 7.3 账户概览 `/account`（Bento）

页眉：问候「你好，{显示名}」Display + caption「欢迎回到你的身份中心」。

Bento 网格（`md:2 / lg:3` 列，gap 16）：

1. **身份卡**（lg:col-span-2）：亮蓝渐变底（`blue-500 → indigo-500`）白字，
   大头像（白描边）+ Display 显示名 + 角色（白色半透明徽标）+ mono 邮箱 +
   用户 ID（可复制，白色 70%）。
2. **活跃会话统计卡**：`text-stat` 大数字 = 会话总数；右侧 Donut（当前设备 1/N，
   `action` 弧）；caption「N 台设备在线」；底部 quiet 链接「管理会话 →」。
3. **登录方式统计卡**：大数字 = 已启用方式数（密码/GitHub）；下方两个图标胶囊
   （KeyRound 密码状态、Github 绑定状态，启用=`blue-50`+`action`，未启用=`canvas`+`ink-3`）。
4. **账户信息卡**（lg:col-span-2）：Row 列表（ID 可复制 / 创建时间 / 最近登录）。
5. **快捷操作卡**：修改密码 / 管理设备 两个 secondary 按钮纵排。

### 7.4 会话管理 `/account/sessions`

页眉主操作「撤销其他会话」（secondary，无其他会话禁用）。白卡容器内设备行：
图标圆（`blue-50` 底 `action` 字）+ 摘要 + `text-data`（ID 前缀 · IP · 活跃时间）
+ 当前徽标 + 撤销（danger quiet）。撤销 → Dialog 确认（当前会话文案不同）→
toast + 行移除。「撤销其他」→ Dialog 显示数量 → toast「已撤销 N 个会话」。

### 7.5 改密码 `/account/password`

单白卡：当前密码（GitHub-only 显示「首次设置可留空」提示）/ 新密码 / 确认新密码
（不一致行内即时提示）。成功 → toast「密码已更新，其他设备已退出」+ 表单重置，
不跳转（当前会话保留）。

### 7.6 OAuth 同意页 `/consent?request_id=`（Phase 2a 新建）

防钓鱼第一：①请求来源域名条（锁图标 + 绿色粗体域名）②应用身份（名 + 图标 +
描述）③scope 清单（图标 + 名称 + 人话说明，取自 shared SCOPES）④将获得什么
（caption）⑤操作区：拒绝（secondary）+ 授权（primary，倒计时 3s 防误触）。
未登录 → 登录后带 returnTo 回跳；request_id 无效 → 空态卡。

### 7.7 Agent 委托同意页 `/agent-consent`（Phase 4 规划）

7.6 基础 + 委托链可视化（节点白色小卡线性图，`accent-purple` 主视觉）+
权限收窄对比（父级列表、保留项高亮）+ 时效徽标（5 分钟倒计时，warning）。
按钮文案绑定资源：「授权访问 mstor（只读文件）」。

### 7.8 管理后台（Phase 5 规划）

- 概览：Bento 指标卡 ×4（大数字 + Sparkbar/donut 点缀）+ 最近事件 AreaTrend。
- 用户：表格（头像/姓名/邮箱/角色/GitHub/最近登录/状态）；详情 = 信息卡 + 角色分配
  （Switch 列表）+ 会话管理（复用 7.4）+ 危险区（danger 浅底白卡 + Dialog）。
- 客户端：列表 + 详情（信息/scope/TTL/redirect URI/secret 轮换）。secret 一次性
  展示 = `.card-modal` 专用对话框，mono 大字 + 复制 + warning「关闭后无法再查看」。
- 审计：过滤器条 + 时间线（mono 时间 + 动作中文名 + actor + 结果徽标），
  行展开 metadata JSON。
- 策略：表单卡。

### 7.9 帮助页 `/help`（Phase 5 规划）

左 sticky 目录 + 右 react-markdown 正文（`.card` 大卡，代码块 `surface-input` 底 mono）。

### 7.10 404 / ErrorBoundary

404：居中白卡 + 线条图形 +「页面不存在」+ 返回账户（primary）。
**ErrorBoundary（工程标配）**：渲染异常兜底页（白卡 + 「出错了」+ 错误 id mono +
刷新按钮），避免白屏。

---

## 8. 交互反馈模式（全局矩阵）

| 场景 | 反馈 |
|---|---|
| 路由切换 | 立即骨架（若有异步数据）+ 一次 stagger |
| 列表加载 | Skeleton |
| 表单提交 | 按钮 loading ≤100ms 出现；期间表单锁定 |
| 操作成功 | Toast 3.5s + 数据刷新（会话撤销 = 乐观更新 + 失败回滚） |
| 操作失败 | Toast 6s（人话原因）+ 状态回滚 |
| 破坏性操作 | Dialog 二次确认；确认按钮 loading 锁定 |
| 网络错误 | Toast「网络异常」；幂等 GET 自动重试 1 次 |
| 401 失效 | 静默跳登录（returnTo 回跳），不弹 toast |
| 校验错误 | 失焦行内校验 + 提交聚焦首个错误字段 |
| 渲染异常 | ErrorBoundary 兜底页 |

---

## 9. 无障碍（WCAG 2.2 条款化）

| 条款 | 要求 | 落点 |
|---|---|---|
| 1.4.3 对比度 | ≥4.5:1 | 令牌已验算（§3.2）；蓝底白字（blue-600 上白字 ≥4.5） |
| 2.4.7 焦点可见 | 全组件 focus-visible 环 | §6.0 |
| 2.4.3 焦点顺序 | DOM 顺序 = 视觉顺序 | 布局约束 |
| 2.5.8 目标尺寸 | ≥24（AA），目标 44 | §3.6 |
| 2.3.3 动效自交互 | reduced-motion 降级 | §4 |
| 4.1.3 状态消息 | toast role=status/alert | §6.4 |
| 1.4.1 颜色使用 | 图表不以颜色为唯一信息载体 | donut 有中心数字/label |
| 4.1.2 名称/角色/值 | 图标按钮 aria-label；Switch aria-checked | 组件 |

键盘全程可用：Dialog 焦点陷阱 + Esc；侧栏/表格/下拉可 Tab。
图表容器 `role="img"` + 结论性 `aria-label`（§6.8）。

---

## 10. 性能预算（Core Web Vitals，构建版）

| 指标 | 预算 |
|---|---|
| LCP | < 2.5s（桌面本地构建） |
| INP | < 200ms |
| CLS | < 0.1（字体 swap + 骨架占位防跳） |
| JS gz | 首包 ≤ 180KB（禁止引入图表/动画/UI 大库） |
| backdrop-filter | 0 元素（v1.2 起全面移除） |
| Lighthouse | Performance ≥ 90 / Accessibility ≥ 95 |

工程约束：**CSP 无 unsafe-inline** → 渐变/动效全部 CSS 类 + 外链 `@keyframes`，
零内联 style（动态值走 CSS 变量）；字体 woff2 子集 + swap；动画仅
`opacity/transform`；长列表（审计）白卡容器 + 实底行。

---

## 11. 验收清单

- [ ] `@theme` 令牌与 §3 一一对应；组件无裸色值/裸尺寸（SVG 可视化 accent 常量除外，§3.0）
- [ ] 卡片三档阴影 + 大圆角；全局无 backdrop-filter / 无绿色主色
- [ ] 7.1–7.5 + 404 + ErrorBoundary 按规范实现，视觉走查通过
- [ ] 账户概览为 Bento 网格 + Donut 数据可视化（§7.3）
- [ ] Toast / Dialog / Skeleton / EmptyState / Avatar 落地并接入 §8 矩阵
- [ ] stagger + 悬浮动效 + reduced-motion 降级可演示
- [ ] 键盘走查（Tab/Esc/焦点还原/焦点陷阱）通过
- [ ] `md` 与 `<md` 断点走查通过
- [ ] 对比度抽测达标（白卡上 ink-3 / 画布上 ink-3 / 蓝底白字）
- [ ] Lighthouse 双指标达标（构建版）
- [ ] 同意页（Phase 2a 前）按 §7.6 实现（域名条 + 倒计时 + 防钓鱼走查）

---

## 12. 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v1.0-draft | 2026-10-04 | 首版：用户三轮确认（亮色玻璃/自然绿/中席动效/桌面优先/全页面） |
| v1.1 | 2026-10-04 | 行业规范修订：令牌三层架构、WCAG 2.2 条款化、状态矩阵、z-index/elevation 阶梯、Core Web Vitals 预算、中文系统字体策略、ARIA APG（Dialog/Toast）、ErrorBoundary、4px 基线网格 |
| v1.2 | 2026-10-04 | 风格重定向（用户参考图确认）：玻璃拟态/自然绿 → Bento 网格/浅灰画布/白色悬浮卡片/柔和大圆角/亮蓝主色+紫橙红点缀/SaaS 数据可视化（Donut/Sparkbar/AreaTrend 纯 SVG）；悬浮侧栏改图标导航；账户区内容宽 720→960；移除全部 backdrop-filter；新增 §6.8 数据可视化组件规范 |
