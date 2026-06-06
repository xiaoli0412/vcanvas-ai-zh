# Codex Resume Handoff — 2026-05-31

## 当前分支
- 本地分支：`codex/canvas-lab-public-server`
- 远端跟踪：`publish/codex/canvas-lab-public-server`

## 当前目标上下文
- 依据文档：
  - `C:\Users\李昊桐\Downloads\Canvas重构方案2.0.md`
  - `C:\Users\李昊桐\Downloads\Canvas_2.0_重构计划注意细则.md`
- 当前执行策略：
  - 先把前台画布壳、12 模式、二级入口、上下文链路、文案基线稳定下来
  - 暂不直接跳到完整用户系统 / newapi 真桥接
  - 保持“画布第一”，重型控制继续退居二级入口

## 本轮已完成
- 已完成分支重命名与 upstream 切换：
  - `codex/creative-lab` -> `codex/canvas-lab-public-server`
- 已落地 public-server 一期骨架：
  - `server/`
  - `shared/`
  - `tsconfig.server.json`
- 已落地 Canvas 2.0 的 12 模式基础架构：
  - `custom`
  - `pure`
  - `video`
  - `web-copy`
  - `inspiration`
  - `cinema`
  - `lite-app`
  - `eclectic`
  - `ppt`
  - `docs`
  - `showcase`
  - `frontier`
- 已完成旧模式迁移兼容：
  - `classic-studio -> custom`
  - `spark -> inspiration`
  - `map -> docs`
  - `story -> cinema`
  - `wild -> eclectic`
  - `remix -> web-copy`
- 已把模式入口保持为二级面板，不再常驻压缩画布
- 已增加：
  - HTML 导出
  - 图片 / 视频同级导入入口
  - 工作流上下文携带选项
  - 网站参考抓取基础链路
- 本轮新增补完：
  - 模式分组信息与 badge 元数据
  - `ModePanel` 分组展示
  - compact 模式 starter chip 改为可翻译标签，不再直接截断英文 prompt
  - `PlanPhaseContext` 加入 `modeStarter`
  - `Plan Refine` 也补入 `modeStarter + workflowContextNotes`
  - 补齐缺失翻译：
    - `canvas.videoLabel`
    - `mode.remix.placeholder`
    - 全套 `mode.starter.*`
    - `mode.group.*`
    - `mode.badge.*`
  - 同步修正文档：
    - `docs/public-server-baseline.md`
    - `docs/canvas-2.0-master-checklist.md`
- 2026-06-06 续做新增：
  - 新增右侧预览批注模式：
    - `src/components/PreviewAnnotations.tsx`
    - `src/components/PreviewAnnotations.css`
    - `src/lib/previewAnnotations.ts`
  - 预览工具条增加 `批注` 开关和清批注按钮
  - 用户可在当前产物预览上点击放置位置化批注，并输入修改意见
  - 普通 `Refine` 与 `Plan Refine` 会把批注坐标和文字注入 `Workflow Context`
  - 产物切换或清空时会自动清理旧批注，避免批注错位
  - 新增视频模式关键帧引用路径：
    - `src/lib/videoReferences.ts`
    - 导入视频后自动切到 `video` 模式
    - 浏览器本地抽取 3-4 张关键帧
    - `PromptBar` 在视频模式显示关键帧缩略图，支持选择/取消选择
  - `Generate / Refine / Plan / Plan Refine` 都会把选中关键帧作为图片上下文发送
  - 新增 Web Embed v1：
    - `src/lib/webEmbeds.ts`
    - `src/components/WebEmbedPanel.tsx`
    - 左下工具栏可添加网页嵌入 URL，并在画布创建 URL 占位 Frame
    - 二级面板支持替换、移除、iframe 预览与失败兜底链接
    - 保存 / 加载 JSON 会携带 `webEmbeds`
    - `Generate / Refine / Plan / Plan Refine` 会把网页嵌入 URL 元数据注入上下文
  - 补齐 public-server phase-1 route contracts：
    - `/api/session/me|login|logout|guest`
    - `/api/settings/site|personal`
    - `/api/providers`
    - `/api/notices`
    - `/api/works` CRUD 占位

## 已验证
- `npm run typecheck` 通过
- `npm run typecheck:server` 通过
- `npm run build` 通过
- 当前仍有大 chunk 警告，但没有构建失败

## 当前工作树状态
- 尚未提交
- 当前有大量未提交修改，包含：
  - `src/App.tsx`
  - `src/components/Header.tsx`
  - `src/components/Header.css`
  - `src/components/PromptBar.tsx`
  - `src/components/PromptBar.css`
  - `src/components/ModePanel.tsx`
  - `src/components/ModePanel.css`
  - `src/components/PreviewAnnotations.tsx`
  - `src/components/PreviewAnnotations.css`
  - `src/lib/canvasModes.ts`
  - `src/lib/previewAnnotations.ts`
  - `src/lib/videoReferences.ts`
  - `src/lib/workflowContext.ts`
  - `src/lib/websiteReference.ts`
  - `src/lib/promptBuilder.ts`
  - `src/lib/i18n.ts`
  - `server/*`
  - `shared/*`
  - `docs/*`
  - `tsconfig.server.json`

## 下次启动后建议直接继续的顺序
1. 先运行：
   - `git status --short --branch`
   - `npm run typecheck`
   - `npm run build`
2. 先做前台稳定性继续项：
   - 检查 12 模式面板在中文下的实际显示
   - 检查 compact starter chips 是否符合预期
   - 实机确认 `Plan / Refine / Plan Refine` 的模式人格差异
3. 然后继续 Canvas 2.0 文档中的下一批高优先级前台项：
   - Provider / 模型管理迁到“个人设置 - 模型与渠道”的 IA
   - Web Embed v1 的浏览器实机回归，包括 CSP / X-Frame-Options 受限页面的可见兜底
4. 前台稳定后，再推进：
   - `newapi / subapi / octopus` bridge 空壳细化
   - session / auth / tier / quota 基础服务接口

## 重要约束
- 不要轻易改动以下兼容键：
  - `vcanvas_*` localStorage keys
  - `VCANVAS_*` env names
  - `/opt/vcanvas` 部署路径
- 用户当前更在意：
  - 画布空间不能被挤占
  - 二级入口而不是大面积常驻控制
  - 原本偏暗紫 / 深蓝的高级感
  - 先把前台体验打磨稳，再继续平台化
