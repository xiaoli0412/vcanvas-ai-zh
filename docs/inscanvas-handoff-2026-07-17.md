# inscanvas Canvas 2.0 交接日志

> 交接日期：2026-07-17
>
> 这份文档是给下一位编程器的工作入口。它记录仓库当前的真实状态、已经完成的能力、仍然只是 local/mock 或 contract-only 的能力、下一阶段的优先级、验证方式和发布规则。
>
> 当前产品名：inscanvas。vcanvas 只作为兼容性的技术名称保留，不要未经迁移设计就删除。

## 0. 一分钟接手

### 当前快照

| 项目 | 当前值 |
| --- | --- |
| 本地仓库 | D:\workspaces\vcanvas |
| 当前实际分支 | public-server |
| 产品目标分支语义 | Canvas Lab Public Server / Canvas 2.0 public-server core |
| 交接起点版本 | 1.11.28 |
| 交接起点 HEAD | 8f7f843 |
| 交接起点提交 | feat: add notice lifecycle governance |
| 交接起点 tag | v1.11.28 |
| 本轮文档发布目标 | 1.11.29 |
| GitHub 仓库 | xiaoli0412/vcanvas-ai-zh |
| 发布 remote | publish |
| 当前 upstream | publish/public-server |
| main 发布分支 | publish/main，与当前 HEAD 一致 |
| origin | https://github.com/e01-ai/vcanvas.git；本项目发布流程不要推这里 |
| 最近一次完整验证 | 2026-06-09；交接日没有代码改动 |
| 当前工作树 | 干净 |

### 接手后第一组命令

~~~powershell
Set-Location D:\workspaces\vcanvas
git status --short --branch
git log -5 --oneline --decorate
git fetch publish --prune
git branch -vv
Get-Content package.json | Select-String '"version"'
npm run typecheck
npm run typecheck:server
npm run build
~~~

如果这组命令出现和本文不同的版本、分支或提交，先以 Git 实际状态为准，再更新本文。本文的 HEAD 和版本字段记录的是本轮文档提交前的交接起点；完成本轮发布后，实际版本应为 1.11.29。不要因为旧文档中出现 codex/canvas-lab-public-server 就自动切换分支；当前实际交接分支是 public-server。

### 当前最重要的判断

这个仓库已经不是单纯的静态画布 demo，但也还不是可宣称生产就绪的多用户平台。它目前是：

~~~text
画布前端
  + Fastify public-server 骨架
  + scripts/serve-vcanvas.mjs 轻量部署入口
  + shared contracts
  + local JSON adapter
  + local/mock 账号、额度、作品、审核和运维闭环
  + 规划中的 newapi/subapi/octopus、队列、数据库、KMS 和分布式调度接口
~~~

下一位编程器最容易犯的错误，是把 local/mock 接口当成真实平台能力，或者为了补平台功能把设置、模型、公告等常驻控件重新塞回画布。两条红线都不能碰。

## 1. 产品总目标

### 1.1 北极星目标

把 VCanvas 演进成 inscanvas Canvas Lab Public Server：

- 画布仍然是第一功能、第一视觉焦点、第一交互面积。
- 用户不需要复杂配置就能从草图、图片、视频、网址和一句话提示开始创作。
- Generate、Refine、Plan 三条工作流可以带上清晰、可控、可恢复的上下文。
- Guest 可以浏览器本地 BYOK；登录用户逐步进入服务端托管、额度、会话和作品体系。
- 账号、权限、密钥、额度、作品、鉴赏厅、公告、运维、更新迁移最终成为真正可运行的平台能力。
- 平台对于尚未生产化的部分必须诚实显示成熟度，不能用漂亮 UI 掩盖实际没有执行 worker、没有真实认证或没有可靠持久化的问题。

### 1.2 两份源文件

主方案与补充细则固定为：

- C:\Users\李昊桐\Downloads\Canvas重构方案2.0.md
- C:\Users\李昊桐\Downloads\Canvas_2.0_重构计划注意细则.md

补充细则优先于主方案。仓库内对应索引：

- docs/canvas-2.0-implementation-roadmap.md
- docs/canvas-2.0-master-checklist.md
- docs/public-server-baseline.md

如果 Downloads 文件在下一台机器不存在，不要凭记忆重新发明需求；先从上述仓库文档恢复上下文，再向项目负责人索取源文件。

### 1.3 永久设计约束

1. 画布优先：模式、Studio、上下文、模型治理、作品、公告、设置和运维都必须是二级抽屉、弹层、控制中心或独立公开页。
2. 默认中文：界面默认 zh-CN，保留英文切换；发送给模型的生成提示、工作流上下文和代码生成要求保持英文。
3. 品牌统一：用户可见产品名使用 inscanvas；Provider 名称、模型 ID、URL、API Key、HTML/CSS/JS 等技术词按原文保留。
4. 视觉方向：暗紫/深蓝的基线可以保留，但当前主方向是深蓝微紫、简约、清晰、少副标题、少解释性装饰。
5. 中文可读性：正文和控件优先 HarmonyOS Sans/system sans；展示标题可以使用内嵌 Noto Serif SC；短品牌或趣味标题可以使用 Fusion Pixel。不要让像素字体承担长段正文。
6. 不虚构模型：没有官方文档或 live /models 证据，不把模型写成“最新”或默认预置模型。
7. 不假装生产就绪：local JSON、local/mock 登录、planned-only dispatch、local safety policy 都必须在 readiness 中标明真实成熟度。
8. 兼容优先：未经迁移设计不要改动 vcanvas_* localStorage key、VCANVAS_* 环境变量、/_vcanvas_proxy、/opt/vcanvas、package 技术名和 Electron 行为。
9. 发布身份：对 xiaoli0412/vcanvas-ai-zh 操作；不要推 origin。
10. 不把密钥、服务器密码、GitHub Token、.vcanvas-data 或运行日志提交进仓库。

## 2. 仓库地图

### 2.1 前端

~~~text
src/App.tsx
  主 orchestrator：Excalidraw、模式、Provider、生成/润色/Plan、Preview、控制中心和持久化状态

src/components/
  Canvas.tsx                  Excalidraw 画布
  Header.tsx                  顶部紧凑工具区、模型快速切换、控制中心、语言切换
  PromptBar.tsx               底部 prompt、Plan、Generate/Refine、细调入口
  FramePicker.tsx             Frame 选择和画布工具条
  Preview.tsx                 HTML 产物 sandbox 预览
  StreamOverlay.tsx           流式输出、思考/速度/phase 显示
  PlanOverlay.tsx              Plan phase 展示
  ModePanel.tsx               12 模式二级面板
  ModelQuickSwitch.tsx        顶部快速切换，不负责完整渠道编辑
  ProviderModal.tsx            渠道/模型详细设置的旧兼容组件
  PersonalSettingsModal.tsx   个人设置、模型与渠道、托管开关
  ControlCenterModal.tsx      账号、站点、公告、用户、鉴赏厅、运维、流程
  WorkCenterModal.tsx         保存、导入、导出、分享、鉴赏厅和删除
  WebEmbedPanel.tsx           网页嵌入 URL、替换、iframe 预览和失败兜底
  PreviewAnnotations.tsx      预览位置批注
  NoticeOverlay.tsx           warning/realtime/force 提示层

src/lib/
  api.ts                      Provider 请求、流式响应、HTML 抽取
  providers.ts                Provider 定义、本地 key/state、模型和能力
  canvasModes.ts              12 模式、旧模式迁移和模式持久化
  promptBuilder.ts            英文 system/generate/refine/plan prompt
  workflowContext.ts          上一轮、画布、网页、视频、批注等上下文
  websiteReference.ts         网站首页 HTML/CSS/screenshot/style hints
  webEmbeds.ts                Web Embed 元数据和画布占位
  videoReferences.ts          视频关键帧抽取和选择
  previewAnnotations.ts       预览批注数据
  export.ts                   画布/预览导出
  sessionClient.ts            vcanvas_public_session 和显式 session headers
  store.ts                    前端数据类型/本地存储辅助
  i18n.ts                     中英字典，默认中文
  proxy.ts                    /_vcanvas_proxy 同源代理路径

src/styles/
  globals.css                 颜色、字体、全局 token
  app.css                     画布布局、overlay、响应式

public/fonts/
  noto-serif-sc.css           内嵌 Noto Serif SC / Source Han Serif 风格展示字体
  fusion-pixel.css             内嵌 Fusion Pixel 短标题字体
  OFL-*.txt                   字体许可证
~~~

### 2.2 服务端

~~~text
server/index.ts               npm run server 入口
server/app.ts                 Fastify 创建、CORS、traffic guard、静态 fallback
server/config.ts              VCANVAS_HOST / VCANVAS_PORT / VCANVAS_STATIC_DIR
server/data/defaults.ts       默认站点、用户、额度、Provider、notice
server/data/localDataStore.ts .vcanvas-data/public-server.json 读写和串行 update 队列

server/lib/
  platformPolicy.ts           actor、权限、session、quota、traffic guard
  platformReadiness.ts         production/local-mock/contract-only/missing 地图
  providerKeyVault.ts          local AES-256-GCM 密钥封装；不是 KMS
  gallerySafety.ts             local policy safety preflight
  dataPortability.ts            local JSON export/import
  updateChecker.ts              GitHub Release 只读检查

server/services/workflowService.ts
  workflow record、24h retention、hosting policy、context compression、execution plan

server/routes/
  session.ts, users.ts, security.ts, quotas.ts
  providers.ts, settings.ts, notices.ts
  workflows.ts, assets.ts, remix.ts
  works.ts, publicPages.ts
  ops.ts, dispatch.ts, data.ts, updates.ts, platform.ts, proxy.ts

scripts/serve-vcanvas.mjs
  不依赖 tsx/Fastify 的轻量部署服务；必须和 Fastify 保持 API parity
scripts/deploy-remote.mjs
  当前静态 dist + serve-vcanvas.mjs 部署脚本
~~~

### 2.3 技术边界

当前没有把 newapi、subapi、octopus 的源码放进工作区；shared contracts 只有 bridge 形态。也没有 PostgreSQL、Redis、真实 worker 或真实跨节点调度。不要在交接后文案里写成“已接入”。

## 3. 当前分支与发布状态

### 3.1 Git 状态

~~~text
交接起点 HEAD: 8f7f843
交接起点版本: 1.11.28
本轮文档发布: 1.11.29
基线 tag:     v1.11.28
Branch:     public-server
Upstream:   publish/public-server
publish/main:       8f7f843
publish/public-server: 8f7f843
origin:     不参与本项目发布
~~~

远端分支中还保留以下历史分支：

- publish/codex/canvas-lab-public-server
- publish/codex/canvas-lab-public-server-v1.10.9
- publish/codex/creative-lab
- publish/main
- publish/public-server

当前开发沿用 public-server。如果要重新命名或合并分支，必须先检查远端指针和工作树，不能用 reset/checkout 强行覆盖用户变化。

### 3.2 已发布版本序列

当前主要里程碑：

- v1.11.17：自然日额度、guest IP 限额、metered guard
- v1.11.18：兑换码本地/mock 管理
- v1.11.19：鉴赏厅审核流程
- v1.11.20：鉴赏厅安全预检
- v1.11.21：作品级安全状态和分享护栏
- v1.11.22：公开分享/鉴赏厅 stale exposure 收口
- v1.11.23：readiness 真实性更新
- v1.11.24：流程恢复入口
- v1.11.25：运维清理 dry-run/apply
- v1.11.26：作品/鉴赏厅额度可见性
- v1.11.27：管理员额度策略编辑
- v1.11.28：提示治理 v2，管理员启停/删除，普通用户按等级过滤

### 3.3 v1.11.28 精确变化

涉及文件：

- server/routes/notices.ts
- scripts/serve-vcanvas.mjs
- src/components/ControlCenterModal.tsx
- src/components/ControlCenterModal.css
- src/lib/i18n.ts
- server/lib/platformReadiness.ts
- CHANGELOG.md
- docs/canvas-2.0-master-checklist.md
- docs/public-server-baseline.md
- package.json
- package-lock.json

行为：

- GET /api/notices 根据 enabled、audience tier、expiresAt 过滤。
- 普通用户不再获得 allNotices。
- host-admin/admin 可看到完整 notice 列表，包括停用项。
- host-admin/admin 可 PATCH /api/notices/:id 启用/停用。
- host-admin/admin 可 DELETE /api/notices/:id。
- notice 写操作写入 audit event。
- Fastify 与轻量服务保持同样的权限、过滤和 404 行为。
- 非法 expiresAt 不向用户展示。

## 4. 已完成能力清单

下面的“完成”指当前 local/mock 或前端功能已落地，不代表已经达到公网生产等级。

### 4.1 画布和创作入口

- Excalidraw 画布仍占主要区域。
- 经典/自定义模式默认紧凑底栏。
- Studio、上下文、starter、模式、网页嵌入、视频关键帧、作品等都在二级入口。
- Header 在移动端使用可滚动/压缩布局，语言切换保持可见。
- Frame 选择、图片导入、视频导入均保留。
- HTML 产物在右侧 Preview sandbox 中展示。
- Generate、Refine、Plan、Plan Refine 四条前端链路已经接入上下文层。
- 当前画布不因为 Control Center、Works Center 或 Personal Settings 常驻而减少。

### 4.2 模式

当前 CanvasModeId 是 12 个：

~~~text
custom       兼容经典/自定义工作台
pure         原汁原味
video        视频创作/视频理解入口
web-copy     网址重构/网站参考
inspiration  灵感喷涌
cinema       叙事/电影感
lite-app     轻应用
eclectic     失控实验/混搭
ppt          演示文稿
docs         文档/知识界面
showcase     展示页
frontier     前沿实验
~~~

旧模式迁移：

~~~text
classic-studio -> custom
spark          -> inspiration
map            -> docs
story          -> cinema
wild           -> eclectic
remix          -> web-copy
~~~

模式切换只改变状态、默认提示、视觉和生成上下文，不自动修改 Excalidraw 元素。

### 4.3 媒体、网页和上下文

- 图片与视频同级导入。
- 视频本地抽取约 3-4 个关键帧，用户可以选择/取消选择。
- 如果模型没有 video=true，视频模式走关键帧/视觉转译，不假装支持原生视频理解。
- 预览批注支持点击定位和文本修改意见；切换/清空产物时清理旧批注。
- Web Embed v1：URL 占位、替换、移除、iframe 预览、失败后链接兜底、URL 元数据注入 prompt。
- Website Remix/Copy 与 Web Embed 是两条独立链路。
- Website Remix 读取首页 HTML、有限 CSS、screenshot 和 style hints；不递归全站，不以复刻商标为默认目标。
- WorkflowContext 支持当前 prompt、画布标签、上一轮 prompt、上一轮产物 HTML/screenshot、网站参考、Web Embed、批注和视频关键帧。
- workflow run 目标留存 24h，context 有 local-summary-v1 压缩路径。

### 4.4 Provider 和模型入口

- Compatible OpenAI 是未配置用户默认 Provider，内部兼容旧 custom 存储逻辑。
- ChatGPT、Kimi 是独立 Provider 卡片。
- 另外保留 z.ai、Google、Fireworks、OpenRouter，并提供 ModelScope、Ollama、DMX、百炼、MiMo、StepFun、Nvidia 的渠道入口。
- Header 只负责快速切换已保存渠道/模型。
- 完整渠道编辑进入 Personal Settings -> Models & Channels。
- 支持模型搜索、滚动、手动模型 ID、收藏/固定和能力徽标字段。
- Provider API key 在 server local adapter 中使用 AES-256-GCM 封装后再写 JSON；响应不会返回 ciphertext。
- 当前默认 Provider 模型列表刻意为空或等待官方/live /models 核查，不要把 README 中的旧模型表当作服务端事实源。

### 4.5 账户、权限、额度和安全骨架

- 五级 tier：host-admin、admin、vip、user、guest。
- local/mock session 有 8h 不活跃过期逻辑。
- guest 有临时身份和浏览器本地 BYOK 路径。
- session 请求使用显式 x-vcanvas-session-id、x-vcanvas-user-id，不再通过“最近一次 session”兜底。
- login/register 不信任浏览器提交的 tier。
- admin 用户管理、等级启用/禁用、用户搜索、IP 封禁/解封已进入 Control Center。
- local/mock rate-limit、guest 日额度、普通用户小时级额度和自然日 reset 已有基础实现。
- blockedIps、rateLimitEvents、signInRecords、auditEvents 已持久化。
- 访客关闭时 /api/session/guest 和受保护重接口返回一致的 guest-access-disabled。
- 作品/鉴赏厅有 local policy safety preflight：passed、needs-review、blocked。
- 强警告 notice 可从主应用弹出；普通可关闭 notice 记本地 dismiss，强警告只在当前 session 确认。

### 4.6 作品、分享和鉴赏厅

- Works Center 在二级 modal 中提供保存、列表、导入 HTML、编辑标题/简介、导出、删除。
- 默认每个 owner 最多 10 件作品；超过时弹出删除选择，不压回画布。
- 保存的 WorkRecord 记录 HTML、snapshot、mode、安全状态和 export metadata。
- 分享接口：POST /api/works/:id/share。
- 分享页：/share/:slug。
- 鉴赏厅提交：POST /api/works/:id/gallery-submit。
- 鉴赏厅前台：/gallery，默认只看 published 且 safety 允许的作品。
- 管理员可发布、退回、恢复审核条目。
- blocked 作品不能创建分享；作品编辑变 blocked 会禁用旧分享并使已发布条目退回待审。
- 公共路由重新检查 work/link/entry safety，避免旧 enabled 状态泄漏危险内容。
- per-tier gallery publish limits 已有 local/mock 配置；作品上限目前是 site-wide，不是每 tier 独立 work limit。

### 4.7 控制中心、公开页和视觉

- inscanvas Control Center 是二级 modal，默认成熟度/readiness 页。
- 现有 tabs 包含 readiness、overview、personal、workflows、users、site、data、notices、gallery、ops。
- /gallery 是独立简约、轻量流式公开页，不是常驻画布区域。
- /share/:slug 是独立分享渲染/兜底页。
- UI 默认中文，有中英切换。
- 正文使用 HarmonyOS/system sans 优先栈。
- 标题使用内嵌 Noto Serif SC，短品牌/像素 accent 使用 Fusion Pixel。
- 颜色基线为深蓝微紫，保留旧暗紫的气质但减少大面积紫色。
- Control Center、Works Center、Personal Settings 的桌面和移动布局已做过截图审查。

### 4.8 运维、迁移和调度

- /api/ops/status 返回 local JSON、数量、托管策略、cleanup 候选和 dispatch 状态。
- /api/maintenance/cleanup 支持 GET dry-run 预览、POST 管理员 apply。
- 清理 24h 过期 workflows、旧 rate-limit events、过期 blocked IP 和过期 sessions。
- /api/data/export、/api/data/import 是 admin-only local JSON portability v1。
- /api/updates/check 是 admin-only GitHub Release 只读检查。
- /api/dispatch/status、POST /api/dispatch/route 是 planned-only weighted dispatch contract。
- 当前 dispatch 没有真实队列、健康探针、CPU/memory/disk telemetry 或跨服务器执行。

## 5. 未完成任务总表

状态含义：

- todo：尚未真正落地。
- in_progress：已有前端、contract 或 local/mock 骨架，但距离目标仍有明确缺口。
- local-mock：本地可演示、可烟测，不应宣称生产能力。
- contract-only：接口/类型/计划存在，真正执行仍未接入。

### P0：下一位编程器先做的事情

#### P0.1 重新建立基线

- 检查当前 Git、版本和 remote。
- 跑 typecheck、server typecheck、build。
- 分别启动 Fastify 和 scripts/serve-vcanvas.mjs，验证 health、proxy、session、works、notices、gallery、workflow。
- 检查浏览器 1440x960 和 390x844，确认 canvas workspace 没被控制中心或新入口挤压。
- 如果服务部署要碰公网服务器，先 SSH 检查现有 service、端口、openresty/防火墙和实际活动目录；不要假定之前的 18087 或用户曾要求的 10666 仍然是现状。

#### P0.2 清理状态文档的漂移

- docs/canvas-2.0-master-checklist.md 中仍有历史分支、历史提交信息和旧日期叙述。
- README 的 Provider 模型表可能比当前 defaults/模型 registry 更新，必须标注来源或改成“以 live fetch/官方核查为准”。
- 本交接文档作为当前真实状态入口；每次版本发布后更新它或新增日期日志。

### P1：真实身份、权限和密钥安全

#### P1.1 NewApiBridge

目标：把 local/mock session 替换为可插拔的真实账号来源。

需要做：

- 定义 AuthService 和 NewApiBridge 的真实 request/response contract。
- 接入 newapi 的注册、登录、邮箱、用户资料、等级/权限映射、钱包/额度语义。
- subapi 只承担 notice/audit/IP/设备等明确 bridge 能力，不把外部逻辑塞进 React。
- 真实 session 使用签名 cookie 或不可伪造 bearer/session token。
- 保留 guest 本地路径，但把 guest、user、vip、admin、host-admin 的来源分开。
- 任何浏览器 body 里的 tier、ownerId、quota 都不能覆盖服务端身份。

验收：

- 真实登录后重启服务仍能识别身份。
- 8h 不活跃过期和主动 logout 不会误删其他用户 session。
- 普通用户不能读取/修改别人的 provider、works、quota、audit。
- bridge 不可用时 readiness 明确显示降级，不静默伪装成生产登录。

#### P1.2 Production KeyVault

当前 providerKeyVault.ts：

- 使用 VCANVAS_KEY_SECRET 或 VCANVAS_PROVIDER_KEY_SECRET 派生 AES key。
- 没有配置时使用 local-dev-fallback，只适合开发。
- ciphertext 不返回到普通 API response。

需要做：

- 生产 KMS/secret manager adapter。
- 密钥轮换、版本、撤销和失败恢复。
- 管理员视图只显示状态、hint 和最后更新时间，不显示密钥。
- 数据迁移时不能把旧 ciphertext 当成新 key material。

验收：

- 生产环境没有 secret 时服务拒绝 server-managed provider execution，或明确切回 browser-local。
- 普通 admin 也不能越权读其他 owner 的 secret。
- 日志和错误中不出现 key、ciphertext、Authorization header。

#### P1.3 Notice 和 HTML 安全

- Markdown 渲染必须使用 allowlist sanitizer。
- imageUrl 限制协议、来源和大小。
- 公共 HTML、分享页、Web Embed、Remix srcdoc 需要 CSP / iframe sandbox 策略。
- 安全审查必须覆盖 prompt injection、script injection、外链跟踪和用户 HTML 的危险标签。
- local policy 只作为 fallback，外部安全模型接入后仍要保留本地硬阻断。

### P2：Provider 与模型治理

需要按官方来源逐个核查并实现：

- ModelScope
- Ollama
- DMX
- Alibaba Cloud Bailian
- Xiaomi MiMo
- StepFun
- Nvidia NIM
- 已有 Compatible OpenAI、ChatGPT、Kimi、Google、z.ai、Fireworks、OpenRouter

每个渠道必须有：

- endpoint/API type
- 官方文档 URL
- live /models 能否读取
- 模型 ID、显示名、更新时间
- vision、video、toolCalling、contextWindow
- 能力来源、置信度、人工 override
- 失败时的错误信息和手动模型 ID 入口

不要做：

- 从博客或记忆中写“最新模型”。
- 把一个 UI 卡片叫成 Provider 但请求仍偷偷走另一个渠道。
- 让没有 video 能力的模型直接收到视频二进制。

下一步建议：先实现 ModelRegistry service 和 verification record，再逐个接 Provider adapter。模型列表更新应是可缓存的后台/手动动作，不要在每次打开设置时阻塞画布。

### P3：服务端真实工作流与性能

当前 WorkflowService 主要负责记录、策略和计划，不是完整的后端模型执行 worker。

需要做：

- 真实 server-managed Generate/Refine/Plan executor。
- 队列和任务状态：queued/running/completed/failed/cancelled。
- 任务重试、超时、幂等 key、取消、恢复和错误分类。
- guest browser-local BYOK 与 I-IV server-managed 的明确路由。
- 视频/网页 copy 默认客户端；只有开启 high-resource hosting 且额度允许才进后台。
- 额度扣减必须在任务生命周期中可审计，失败/取消要定义退款或不退款规则。
- 以模型 contextWindow 为依据压缩 HTML、图片摘要、网页参考和前序轮次。
- 24h retention 由 worker/cleanup 共同保证。

### P4：真实分布式调度

现有 /api/dispatch/status 和 /api/dispatch/route 只是 planned-only 入口。

真正落地需要：

- 节点注册和心跳。
- CPU、memory、disk、bandwidth、GPU/模型能力 telemetry。
- queue backend、任务租约、节点失活回收。
- weighted / least-loaded / capability-aware routing。
- 单节点降级、跨节点重试和一致性日志。
- 管理员可暂停节点，不影响正在执行任务。
- 不能把当前 currentLoad 手填 JSON 当真实负载。

### P5：持久化和公开平台

当前 .vcanvas-data/public-server.json 是零配置开发 adapter，不能承担长期公网多用户并发。

需要做：

- PostgreSQL schema/migrations。
- Redis 或等价队列/限流/短期缓存。
- 作品、workflow、审计、额度、notice 的事务边界。
- 数据备份、恢复、迁移版本和回滚。
- 跨节点数据一致性。
- 作品流程图导出、完整分享渲染页、SEO/安全提示。
- 鉴赏厅审核模型 adapter 和人工复核状态机。
- 每 tier 作品上限、发布上限、任务并发上限的真正服务端策略。

### P6：支付、更新和站点运营

- newapi/subapi 钱包/支付/兑换真实接入。
- 兑换商品、签到、额度、退款/撤销和幂等。
- GitHub 更新提醒升级为签名 update plan。
- 低峰更新、备份、回滚和数据库迁移锁。
- 邮件、公告、强警告、实时提示和管理员审计。
- 站点设置 IA 完整化：站点资料、用户、模型、安全、数据、邮件、公告、支付、权限、运维、更新。
- 个人设置 IA 完整化：资料、渠道、模型、额度、托管、会话、安全中心。

### P7：创作工具深化

- Web Embed 使用 Excalidraw 原生 embeddable element；当前是 URL placeholder + metadata fallback。
- 更准确识别 X-Frame-Options / CSP 阻断并在画布中提示原因。
- 同源静态 HTML 嵌入的交互、替换、导出和恢复。
- 视频二进制存储/服务器转码仍需明确的资源策略。
- MCP / tool calling / skill-gated execution contract。
- 上一轮完整产物和提示词的 context carry UI 继续细化，避免默认发送过重 payload。

## 6. 推荐里程碑路线

### M0：交接和基线冻结

交付：

- 交接文档、现状 checklist、分支/版本/远端一致。
- typecheck、build、Fastify/light smoke 和浏览器截图。
- 修正过时文档中的实际分支/版本信息。

完成标准：工作树干净，两个服务入口 API parity，画布 workspace 尺寸不变。

### M1：Notice/Settings/Provider 可操作性收口

交付：

- notice markdown/image sanitizer v1。
- 站点设置和个人设置字段分组、权限可见性、空态和错误态完整。
- ModelRegistry contract + verification metadata UI。
- Provider 搜索、收藏、能力批改的状态持久化和失败提示。

依赖：无真实外部仓库也可先用 local adapter。

### M2：账号与密钥生产边界

交付：

- NewApiBridge/SubapiBridge mock 与真实 adapter 接口分离。
- 签名 session/cookie。
- KMS/KeyVault adapter。
- permission matrix 和 audit。

完成标准：任何 local/mock fallback 都在 readiness、日志和 UI 中明确显示。

### M3：真实工作流执行

交付：

- Workflow executor、queue、retry、cancel、quota ledger。
- Generate/Refine/Plan server-managed path。
- client/server fallback 和 context compression。
- 24h retention 和恢复。

完成标准：一个登录用户能在服务端完成一条任务，刷新/重启后可以查看状态，失败不泄密、不重复扣费。

### M4：作品和鉴赏厅生产化

交付：

- PostgreSQL/Redis adapter。
- 作品/分享/鉴赏厅事务。
- 外部 safety review + 人工审核。
- 分享页、流程图、导入导出和审计。

### M5：分布式和运维

交付：

- 节点 heartbeat/telemetry。
- 真实队列调度。
- 备份、迁移、回滚、低峰更新。
- 邮件、公告、告警和运维面板。

### M6：平台上线验收

交付：

- Guest、user、vip、admin、host-admin 全链路。
- 公开作品、鉴赏厅、额度、支付、审核、安全、更新全部有端到端场景。
- 服务器安装、服务自启动、端口、防火墙、静态入口、健康检查和回滚演练。

## 7. API 交接清单

Fastify 路由位于 server/routes/；部署入口 scripts/serve-vcanvas.mjs 必须保持同等行为。新增接口要先写 shared contract，再实现两条路径。

### 基础和代理

- GET /health
- POST /proxy
- POST /_vcanvas_proxy

/health 默认端口由 VCANVAS_PORT 控制，默认 18087。代理只做同源转发，不要把 provider 业务混进代理层。

### Session / user / security

- GET /api/session/me
- POST /api/session/login
- POST /api/session/register
- POST /api/session/logout
- POST /api/session/guest
- GET /api/users
- PATCH /api/users/:id
- GET /api/security/blocked-ips
- POST /api/security/blocked-ips
- DELETE /api/security/blocked-ips/:ip

当前是 local/mock 权限，不是真实 newapi。所有需要身份的调用都应带：

~~~text
x-vcanvas-session-id
x-vcanvas-user-id
~~~

### Provider / settings / notices

- GET/POST /api/providers
- GET/PATCH/POST /api/settings/site
- GET/PATCH/POST /api/settings/personal
- GET/POST/PATCH/DELETE /api/notices
- GET /api/platform/readiness

Admin-only 写操作必须在服务端检查，不依赖按钮隐藏。

### Workflow / assets / remix

- GET /api/workflows
- GET /api/workflows/:id
- PATCH /api/workflows/:id
- POST /api/workflows/generate
- POST /api/workflows/refine
- POST /api/workflows/plan
- POST /api/assets/import
- POST /api/remix/fetch

当前 workflow 记录/计划/恢复已落地，但真实后端模型执行 worker 未完成。

### Works / share / gallery

- GET/POST /api/works
- POST /api/works/import-html
- GET/PATCH/DELETE /api/works/:id
- POST /api/works/:id/share
- POST /api/works/:id/gallery-submit
- GET /api/gallery
- PATCH /api/gallery/:id/review
- POST /api/gallery/:id/safety-review
- GET /share/:slug
- GET /gallery

默认公开 API 过滤待审、退回、blocked 和 stale exposure。管理员需要显式 includeReview=true 才看审核队列。

### Quota / ops / migration / update / dispatch

- GET/POST /api/quotas/sign-in
- GET/POST /api/quotas/redeem
- GET/POST /api/quotas/redeem-codes
- PATCH /api/quotas/redeem-codes/:id
- GET /api/ops/status
- GET/POST /api/maintenance/cleanup
- GET /api/data/export
- POST /api/data/import
- GET /api/updates/check
- GET /api/dispatch/status
- POST /api/dispatch/route

这些接口目前都是 local/mock、read-only 或 planned-only 的不同组合，新增服务端能力时必须在 readiness 里同步成熟度。

## 8. 数据和兼容性

### 8.1 本地 JSON

默认路径：

~~~text
VCANVAS_DATA_DIR/public-server.json
~~~

如果没有设置 VCANVAS_DATA_DIR，默认是当前工作目录下的：

~~~text
.vcanvas-data/public-server.json
~~~

数据集合包括：

- siteSettings
- personalSettings
- providerChannels
- notices
- works
- workflows
- sessions
- users
- quotaLedgers
- redeemCodes
- blockedIps
- rateLimitEvents
- signInRecords
- shareLinks
- galleryEntries
- auditEvents
- rateLimitPolicies
- disclaimerPolicy

LocalDataStore.update() 用串行 Promise queue 避免同一进程内并发覆盖，但它不是多进程/多节点事务存储。

### 8.2 前端 localStorage 兼容 key

已存在的 key 不要随意改名：

- vcanvas_locale
- vcanvas_mode_state
- vcanvas_prompt_presets
- vcanvas_prompt_studio
- vcanvas_provider_state
- vcanvas_vision_provider_state
- vcanvas_model_vision_support
- vcanvas_provider
- vcanvas_public_session
- 以及已有画布缓存/Excalidraw 相关 vcanvas_* key

新 key 必须有迁移或兼容读取策略。

### 8.3 环境变量和运行路径

- VCANVAS_HOST，默认 0.0.0.0
- VCANVAS_PORT，默认 18087
- VCANVAS_STATIC_DIR，默认 dist
- VCANVAS_DATA_DIR，默认 .vcanvas-data
- VCANVAS_KEY_SECRET / VCANVAS_PROVIDER_KEY_SECRET
- VCANVAS_BASE，用于 Vite base path
- VCANVAS_DEPLOY_HOST
- VCANVAS_DEPLOY_USER
- VCANVAS_DEPLOY_PASSWORD
- VCANVAS_PROXY_PORT

部署目录兼容名仍是 /opt/vcanvas。当前 scripts/deploy-remote.mjs 的 systemd 模板默认写入端口 18087；如果公网服务器实际需要 10666 或其他端口，必须先修改/参数化部署脚本并验证 openresty、防火墙和 systemd，不能只口头改端口。

## 9. 工作流和权限行为

### 9.1 Guest

- 默认 browser-local。
- Provider key 主要留在浏览器路径。
- guest 受 IP 自然日额度和 traffic guard 约束。
- guest 可以绘画、导入、生成（在已配置 BYOK 的前提下）、保存本地画布。
- guest 不能写站点设置、notice、Provider server channel、用户管理、审核队列。
- guestEnabled=false 后 guest session 和重型入口统一报 guest-access-disabled。

### 9.2 登录用户

- local/mock 登录后有显式 session。
- 默认可走 server-managed policy，但当前真正模型执行仍需继续接 Workflow executor。
- 作品、workflow、Provider channel 和个人设置按 owner 权限隔离。
- 24h workflow record 可在 Control Center 中查看/复制摘要/取消 local/mock queued/running。

### 9.3 Admin / host-admin

- 可管理 site settings、notices、users、blocked IP、quota policy、redeem code、gallery review、cleanup、data export/import、update check。
- host-admin 是默认 bootstrap local-admin。
- 当前 local/mock 管理员不等于生产管理员；真实来源必须由 newapi/bridge 决定。

## 10. 验证手册

### 10.1 静态验证

~~~powershell
npm install
npm run typecheck
npm run typecheck:server
node --check scripts/serve-vcanvas.mjs
npm run build
git diff --check
~~~

Vite 目前会提示若干大 chunk（通常超过 500 kB），这不是构建失败，但后续要通过 dynamic import/code splitting 优化。不要为了消除警告盲目拆 Excalidraw 或破坏启动路径。

### 10.2 Fastify

~~~powershell
$env:VCANVAS_HOST='127.0.0.1'
$env:VCANVAS_PORT='19130'
$env:VCANVAS_DATA_DIR=(Join-Path $env:TEMP 'inscanvas-smoke-fastify')
npm run server
~~~

另开终端验证：

- /health
- /_vcanvas_proxy
- guest /api/session/me
- login/register/guest/logout
- /api/providers
- /api/settings/site、/api/settings/personal
- /api/notices 权限、过期、启停、删除
- /api/works 保存/导入/更新/删除/上限
- share、gallery-submit、review、safety-review、/share/:slug、/gallery
- workflow generate/refine/plan/list/detail/cancel
- quotas、redeem、ops、cleanup、data export/import、updates、dispatch、remix

### 10.3 轻量部署入口

~~~powershell
$env:VCANVAS_HOST='127.0.0.1'
$env:VCANVAS_PORT='19131'
$env:VCANVAS_STATIC_DIR=(Join-Path (Get-Location) 'dist')
$env:VCANVAS_DATA_DIR=(Join-Path $env:TEMP 'inscanvas-smoke-light')
node scripts/serve-vcanvas.mjs
~~~

要求与 Fastify 结果一致。特别关注：

- allNotices 是否只给 admin。
- 非 admin 写 settings/notices/gallery/cleanup 是否 403。
- 删除作品是否同步清理 shareLinks/galleryEntries。
- 公开页面是否不泄漏 pending/rejected/blocked 内容。
- 静态 /assets/*.js、.css、.woff2 是否先返回真实资源，而不是 SPA index.html。

### 10.4 浏览器肉眼检查

至少截图：

- 主应用 1440x960
- 主应用 390x844
- ModePanel
- ModelQuickSwitch
- Personal Settings
- Control Center readiness/notices/users/ops/workflows
- Works Center
- Web Embed Panel
- /gallery 桌面/移动
- /share/:slug 桌面

重点检查：

- .workspace 尺寸在打开二级弹层前后不变。
- Header 不遮挡 Provider、语言和控制中心按钮。
- 底部 prompt 不覆盖画布和 FramePicker。
- 中英文没有交叉、截断到不可读或横向爆屏。
- mobile modal 内部滚动可用，按钮不超出屏幕。
- 画布本体可以选择、绘制、Frame、导入和缩放。

## 11. 发布和 GitHub 规则

### 11.1 每轮发布要求

项目负责人此前要求每完成一轮：

- patch 版本递增，例如 1.11.28 -> 1.11.29。
- 更新 package.json、package-lock.json、CHANGELOG.md。
- 只提交本轮相关文件。
- 创建对应 v1.11.x tag。
- 以 xiaoli0412 owner 身份操作 GitHub。
- 同时推送 publish/main 和 publish/public-server。
- 推送 tag。
- 创建 GitHub Release。
- 观察 Pages、main Desktop、tag Desktop Actions 到成功。
- 不推 origin。

### 11.2 推荐命令模板

~~~powershell
git status --short --branch
npm run typecheck
npm run typecheck:server
node --check scripts/serve-vcanvas.mjs
npm run build
git diff --check

# 修改版本和 changelog 后
git add <本轮相关文件>
git commit -m "<conventional commit>"
git tag v1.11.29
git push publish HEAD:public-server HEAD:main v1.11.29

gh release create v1.11.29 --repo xiaoli0412/vcanvas-ai-zh --title "inscanvas v1.11.29" --notes-file <release-notes.md>
gh run list --repo xiaoli0412/vcanvas-ai-zh --limit 10
gh run watch <run-id> --repo xiaoli0412/vcanvas-ai-zh --exit-status
git ls-remote publish refs/heads/main refs/heads/public-server refs/tags/v1.11.29
git status --short --branch
~~~

当前 owner 身份应通过：

~~~powershell
gh auth status
git config user.name
git config user.email
~~~

不要把 Token 写到日志、文档、命令历史或 commit message。密码不要写进交接文件。

### 11.3 GitHub Actions

.github/workflows/pages.yml：

- publish/main push 触发。
- 构建 GitHub Pages，使用 npm run build:gh。
- 发布到 gh-pages。

.github/workflows/desktop.yml：

- main push 和 v* tag 触发。
- Windows、Linux、macOS 构建 Electron 包。
- tag 触发 release artifact 上传。
- 当前使用 Node 22、Electron 镜像和 electron-builder binary 镜像。

历史 Actions 可见 Node.js 20 deprecation 和 Windows runner 迁移 warning；这类 warning 不一定是本轮失败原因，要以 job status 和日志为准。

## 12. 部署交接注意事项

历史对话中出现过多个服务器地址、端口和“重装/开放端口/不要反代”的互相调整。当前仓库没有在本交接日重新确认公网部署状态，因此下一位编程器必须把服务器视为“未验证状态”：

1. 先确认目标 IP、SSH 端口、账号和端口要求，不要使用历史密码。
2. 先在服务器检查：systemctl status vcanvas.service、监听端口、/opt/vcanvas、openresty/1Panel 配置、防火墙。
3. 确认是否要反代；用户最后一次明确要求曾是直接开放服务端口，但该要求需要以最新指令为准。
4. 当前部署脚本默认 VCANVAS_PORT=18087，如果目标是 10666，必须同步 systemd、健康检查、开放端口和前端访问方式。
5. 重装前备份 /opt/vcanvas 和 service 文件；不要只上传 dist 就声称完成。
6. 上线后验证：
   - systemctl is-active vcanvas.service
   - curl http://127.0.0.1:<port>/health
   - curl http://<server-ip>:<port>/
   - 首页主资源 hash 与本地 build 一致
   - POST /_vcanvas_proxy 同源代理可用
7. 不把服务器凭据写入仓库、交接日志或 GitHub issue。

## 13. 风险登记

### 高风险

- local JSON 不适合多进程、多节点和大量并发；可能出现锁、丢写、备份不一致。
- VCANVAS_KEY_SECRET 未设置时是 local-dev fallback，不能承载生产 provider key。
- local/mock 登录可以演示权限，但不是外部身份系统。
- workflow API 记录计划和状态，但真实后端模型执行 worker 未完成。
- planned-only dispatch 不是真实均衡负载。
- HTML/Markdown/Web Embed/Remix 输入存在 XSS、CSP、prompt injection 和外部资源风险。

### 中风险

- Provider defaults 有渠道入口但模型列表可能为空；README 旧表与实际 registry 可能发生漂移。
- 站点 work limit 当前是全站统一，不是完整 per-tier work limit。
- 作品流程图导出还未完成。
- 更新检查是只读，自动更新、低峰发布、加密迁移、备份回滚未完成。
- 大 chunk 会增加首屏和更新成本，需渐进式 code splitting。

### 低风险/维护性

- 历史文档仍混有 codex/canvas-lab-public-server、v1.10.9 和旧 commit 信息。
- scripts/serve-vcanvas.mjs 与 Fastify 双实现增加 parity 维护成本；每个新增路由都要双写/双测。
- 公开页、控制中心和个人设置的 i18n key 需要持续防止中英漏翻。

## 14. 推荐的首批实现任务拆分

### 任务 A：NoticePolicy v1

范围：server/lib/noticePolicy.ts、两套 routes、Control Center。

- Markdown allowlist sanitizer。
- image URL protocol/size/source 校验。
- per-tier / per-user targeting contract。
- warning acknowledgement 记录。
- 不改变默认画布布局。

验收：guest/admin 过滤、XSS payload、过期 notice、强警告和两套服务 parity。

### 任务 B：ModelRegistry v1

范围：shared/contracts/publicServer.ts、server/services/modelRegistry.ts、server/routes/providers.ts、Personal Settings。

- verificationMethod、verifiedSourceUrl、capabilityDetectionConfidence。
- live /models fetch 缓存。
- manual override 与批量能力编辑。
- 视频模式能力 gate。

验收：没有核查就不显示“已验证/最新”，请求失败不阻塞画布。

### 任务 C：AuthService + bridge

范围：server/services/authService.ts、bridge contract、session route、audit。

- local adapter 保持现有 smoke。
- NewApiBridge/SubapiBridge 只通过接口接入。
- 真实签名 session。
- 禁止 tier/ownerId/quota body 越权。

验收：登录、过期、logout、跨用户访问和服务重启恢复。

### 任务 D：KeyVault adapter

范围：server/services/keyVault.ts、现有 provider routes、settings UI。

- 生产 secret provider。
- key rotation。
- 失败时 browser-local fallback 或明确拒绝。
- 绝不返回 secret。

### 任务 E：Workflow worker v1

范围：server/services/workflowService.ts、queue adapter、workflow routes。

- execute/stream/retry/cancel。
- 幂等和 quota ledger。
- context compression worker。
- 24h cleanup/resume。

### 任务 F：持久化迁移 v1

范围：新的 DB/queue adapter，不删除 local adapter。

- PostgreSQL schema。
- Redis 限流和任务队列。
- import/export/migration version。
- 备份/恢复演练。

## 15. 交接结束语

接手顺序不是“先做更大的 UI”，而是：先证明当前基线可运行，再让现有 local/mock 能力逐步换成真实 adapter。每一个平台能力都要穿过 shared contract、Fastify、轻量服务、二级 UI、测试和 readiness 六个边界。只要坚持这些边界，后续即使引入 newapi、队列、数据库和多服务器，画布核心也不会被重新挤坏。

本文是当前日期交接入口；完成下一轮后，在文末追加：版本、提交、验证、发布链接、Actions、剩余风险，并同步 docs/canvas-2.0-master-checklist.md 与 docs/public-server-baseline.md。
