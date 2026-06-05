# CineScript 影视资产生成器 — AI 架构与协作开发手册
> **CineScript Developer Handover & AI Collaboration Guide**

本手册旨在为后续接手开发本项目的 AI 智能体（如 Claude、GPT 等）或人类开发者提供高可读性、像素级精准的架构解析与状态运行逻辑，确保可以零磨合直接接手和迭代。

---

## 🛠 一、 技术栈与系统边界 (Tech Stack & Architecture)

CineScript 采用全栈一体化架构，本地存储、云端数据库、生成式 AI 服务无缝串联：

*   **前端架构**: React 19 + TypeScript + Vite 6 + Tailwind CSS
*   **动画系统**: Framer Motion (由 `motion/react` 包提供原生动画驱动)
*   **后端代理**: Node.js + Express (`server.ts` 结合 Vite 中间件开发部署，规避跨域并隐藏 API 密钥)
*   **云端与多端同步**:
    *   **Firebase Authentication**: 统一用户体系，通过弹窗 Google 登录同步。
    *   **Firebase Firestore**: 提供跨终端实时状态云同步。
    *   **本地双向降级**: 未登录状态或者无网络时，自动降级并持久化到浏览器本地 `localStorage`，登录后支持无缝向上合并。
*   **生成式内核**: 封装了轻量级、响应式的 `@google/genai` TypeScript 客户端（通过 `/api/gemini` 由 Node 端进行代理安全请求）。

---

## 💾 二、 数据结构与核心模型 (Core Data Models)

为了保证极佳的类型安全，所有核心概念和组件都在主入口定义了极度严谨的 TypeScript 接口（可参阅 `/src/types.ts` 或 `/src/App.tsx` 中的声明）：

### 1. 三语输出对象 (`TripleResult`)
系统所有 AI 产出的结构，为了便于国际化、渲染和多系统读取，均采用固定的三语封装格式：
```typescript
interface TripleResult {
  zh: string;    // 优雅的中文渲染结果
  en: string;    // 英文精准翻译结果（常用于生图引擎如 SD / Midjourney 提示词）
  json: string;  // 结构化纯净 JSON 字符串，便于二级脚本或自动化解析
}
```

### 2. 项目核心实例 (`Project`)
项目采用多项目制。每个项目相互完全隔离，包含该项目的剧本、镜头参数、角色面部遮罩图、AI 提取与生成的所有多语快照：
```typescript
interface Project {
  id: string;
  name: string;
  referenceImage: string;        // 参考图/面部特征图的 Base64 编码
  toneAnalysis: TripleResult | null;    // 视觉基调解析最终结果
  tonePresets: TonePreset[];            // 项目专属风格预设
  characterInput: string;               // 角色文字描述
  characterStill: TripleResult | null;  // 角色定妆照生成提示词 (zh, en, json)
  characterThreeView: TripleResult | null; // 角色三视图生成提示词 (zh, en, json)
  sceneInput: string;                   // 场景描述输入
  sceneResult: TripleResult | null;     // 场景渲染提示词反馈
  storyboardInput: string;              // 分镜剧本原始输入
  storyboardResult: TripleResult | null; // 影视分镜表格解析
  storyboardPresets: Preset[];          // 分镜级特定覆写 Prompt 模板
  videoPresets: Preset[];               // 视频脚本特定覆写 Prompt 模板
  assetExtractInput: string;            // 剧本美术资产待提取文本
  assetExtractPresets: Preset[];        // 资产预设模板
  assetExtractResult: string;           // 资产解析渲染结果
  reversePromptResult: TripleResult | null; // 反向反推（对参考图的反向推导词）
  extractedAssets: ExtractedAssets | null;  // 从当前项目提取出的结构化资产目录
  selectedPresetId?: string | 'live' | null;
  globalStyle: string;                  // 全局锁定的视觉基调描述
  styleCategory: string;                // 风格属性 (如 '中式' | '欧美')
  genreCategory: string;                // 题材属性 (如 '写实' | '奇幻' | '玄幻' | '惊悚')
  pendingAudit: {                       // 等待渲染或过审分析的缓冲带
    result: TripleResult;
    score: number;
    suggestions: string;
    extractedAssets?: ExtractedAssets | null;
  } | null;
}
```

### 3. 可恢复/可导入预设 (`Preset` / `ContextPreset`)
```typescript
// 模板提示词
interface Preset {
  id: string;
  name: string;
  prompt: string;
}

// 影视世界观基调
interface ContextPreset {
  id: string;
  name: string;
  description: string;
}
```

---

## 📂 三、 文件结构与职责分布 (Project Directories)

在接手后进行增量修改时，请务必保持如下的代码设计逻辑，切忌在一个主文件中过分堆叠：

```
/
├── server.ts                 # Full-stack 后端，承载 Node APIs，开发模式提供 Vite Middleware 注入
├── package.json              # 核心依赖说明（已包含 framer-motion、@google/genai 等）
├── metadata.json             # 平台应用运行权限清单
├── firestore.rules           # Firebase 精细到用户粒度的强权限安全校验规则
├── src/
│   ├── main.tsx              # 应用渲染总入口
│   ├── App.tsx               # 1. 核心视图控制器；2. 侧边栏与总导航；3. 全局备份/恢复总引擎
│   ├── index.css             # Tailwind 核心注入与自定义设计变量
│   ├── components/           # 模块化独立交互工具包 (极其重要)
│   │   ├── AuthComponent.tsx      # 云端身份体系、Google 弹窗认证与退出
│   │   ├── FaceMaskTool.tsx       # 基于 Mediapipe FaceMesh 的人脸微网遮罩裁剪交互
│   │   ├── ScriptAssetLab.tsx     # 高端实验室：可视化视频镜头切片、脚本对照生成
│   │   ├── PromptLab.tsx          # 预设提示词编辑器 (核心分支，支持云端/本地持久化)
│   │   ├── PromptLibrary.tsx      # 常用系统预设快捷生成器
│   ├── services/
│   │   └── geminiService.ts       # AI 推理层，封装了模型回退、结构化解析、异常防御机制
│   └── lib/
│       ├── firebase.ts            # 云端数据库实例初始化
│       └── useSyncPresets.ts      # 自定义 Hook：智能多端云同步/本地降级缓存器
```

---

## ⚡ 四、 数据同步逻辑与云端容灾 (State Syncing Strategy)

在设计同步数据时，必须理解系统自带的 **双轨数据总线 (Dual-Bus State Sync)**：

1.  **全局状态 Hook: `useSyncPresets<T>`**
    *   此组件（定义在 `src/lib/useSyncPresets.ts`）会自动嗅探账户状态。
    *   **离线/未登录**: 直接读写 `localStorage` 中的特定 Key，保持离线极速响应。
    *   **在线/已登录**: 实时拉取 Firebase Firestore 当中属于当前 `request.auth.uid` 下的单文档集合，并与本地的默认基准进行静默合并。任何写操作（如更新剧本或自定义风格）会立即同步推回云端，保证换机或换流览器时体验绝对闭环。
2.  **整包数据导出与备份 (Export & Import Engine)**
    *   考虑到内容创作者对绝对数据所有权的诉求，系统在设置页面整合了**零损一键整包备份**。
    *   **导出阶段**:
        在 `App.tsx` 中使用 `handleExportData` 函数，将前端的所有项目 `projects` 和所有的全局系统预设模板（`globalVideoPresets`, `globalStoryboardPresets`, `worldviewPresets`, 以及组件内部的用户自定义提示词）打包组合成一个单一的带版本控制 `v8` 的 JSON 文件。
    *   **导入阶段**:
        在 `handleImportData` 中提供精细的安全合并。合并流程会逐个比对 `projectId`：若在当前工作区不存在，则追加；若存在最新重合，则执行覆盖，并恢复所有内置/自定义的局部 `localStorage` Key，随后提供确认提示，建议一键热更新。

---

## 🎨 五、 视觉美学、交互规范与 UI 哲学 (Design Language)

CineScript 具有极其独特的暗黑色调，专为视频编辑和专业编导视觉放松设计：

*   **色彩调色板**:
    *   背景基底: 极深墨水灰/夜空黑 (`#0B0D10` / `bg-brand-bg`)
    *   侧边面板: 软深灰黑 (`#12151A` / `bg-brand-sidebar`)
    *   卡片与部件: 科技感暗石墨 (`#181C22` / `bg-brand-card`)
    *   边框与边界线: 哑光中灰微透 (`rgba(255,255,255,0.08)` / `border-brand-border`)
    *   核心高亮/点睛色: 金砂色/琥珀金 (`#F5C453` / `text-brand-accent`) 搭配少许科技荧光紫
*   **空间表现**:
    *   为了杜绝传统的低级“AI废纸堆”杂乱感，排版处处使用大面积负空间（Padding），视觉密度高度克制。
    *   **严禁** 在界面上放置不必要的底层参数状态调试行、微小延迟、网络丢包、模拟终端日志或乱七八糟的运行代号。所有状态文字应以尊贵、沉稳的文学描述呈现（例如：“院线级真实感设定机制”）。
*   **动画规则**:
    *   凡是标签页切换、面板合拢、新项目创建、删除项目或遮罩层激活，**必须** 使用精简且带有微弹簧动画参数的 `AnimatePresence` 或 `motion` 元素。
    *   最常用的入场弹簧过渡：`initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}`。

---

## 🧠 六、 AI 驱动与提示词工程 (UI & Gemini Interface)

在开发新特性需要调用 AI 时，请遵循 `src/services/geminiService.ts` 的结构化工作流：

1.  **多级降级安全请求**:
    平台内置自动路由。由于多语复杂，会遇到极高烈度的参数。底层执行时，若最新的 `gemini-2.5` 遭遇配额极限或网络阻塞，系统会自动退避使用 `gemini-1.5` 系列。
2.  **强制 Schema 返回**:
    在系统生成角色方案、视觉基调等功能中，我们在 System Instruction 和 User Prompt 结尾中均深度捆绑了规范化拦截规则：
    *   要求 AI 生成一个严格的标记，里面包含：`=== TEXT PART ===`、`=== ENGLISH TRANSLATION ===` 和 `=== JSON CONFIG ===`。
    *   `geminiService` 会通过精细的 RegEx 段落捕获将这三部分完整切开，组装为 `TripleResult` 提交应用层。如此可确保不会因为 AI 吐出的额外冗余引言和 Markdown 代码块导致解析器溃散。

---

## ⚙️ 七、 自定义与增量开发调试 (Local Dev & Customization)

后续 AI/开发者若需要在自己的本地测试运行该配置，可以一键进行开发：

1.  **冷启动开发服务器**:
    ```bash
    npm run dev
    ```
    应用通过后端本地代理拦截 Vite，所有路由会自动绑定至 `0.0.0.0:3000`。
2.  **配置云端 Firebase 数据权限文件 (`firestore.rules`)**
    ```javascript
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        // 用户只能查看和修改属于自己 UID 的云端预设
        match /presets/{presetDocId} {
          allow get: if isSignedIn() && (resource == null || existing().userId == request.auth.uid);
          allow list: if isSignedIn() && resource.data.userId == request.auth.uid;
          allow write: if isSignedIn() && request.resource.data.userId == request.auth.uid;
        }
      }
    }
    ```
3.  **接入自定义中转 API 密钥**:
    用户和测试人员若有高速并发要求，点击系统左下角的 **“系统设置”** 或右上角账户一侧的 ⚙️ **设置图标**，即可在新弹出的控制后台中呼出平台 API 面板，或无缝录入第三方的自定义 Gemini 密钥。该密钥通过高安全级别的 local 浏览器沙箱缓存，在断网、重启浏览器或项目重载时持续隔离与保护。

---
**CineScript 设计师寄语:**
> "每一枚镜头的闪烁都是叙事的开场，希望你可以凭借此手册，将 CineScript 带往更远、更优雅的创作之境。"
