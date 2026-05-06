/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Clapperboard, 
  Sparkles, 
  Copy, 
  Check, 
  Layout, 
  Image as ImageIcon, 
  User, 
  Loader2, 
  Send,
  Trash2,
  ChevronRight,
  Bookmark,
  Plus,
  X,
  Upload,
  FolderOpen,
  Settings,
  Settings2,
  ImagePlus,
  Eye,
  Box,
  FileJson,
  Languages,
  Globe,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  Map as MapIcon,
  Maximize2,
  Columns,
  History,
  CheckCircle2,
  AlertCircle,
  Terminal,
  ScanSearch,
  RefreshCcw,
  Zap,
  Layers,
} from 'lucide-react';
import { diffWordsWithSpace } from 'diff';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { geminiService } from './services/geminiService';
import { FaceMaskTool } from './components/FaceMaskTool';
import { PromptLibrary } from './components/PromptLibrary';
import { ScriptAssetLab } from './components/ScriptAssetLab';
import { PromptLab } from './components/PromptLab';
import { AuthComponent } from './components/AuthComponent';
import { useSyncPresets } from './lib/useSyncPresets';
import { Beaker } from 'lucide-react';

// --- Types ---

type TopTab = 'script' | 'asset' | 'prompt' | 'safety' | 'lab';
type ScriptSubTab = 'video' | 'storyboard' | 'asset_extract';
type AssetSubTab = 'tone' | 'character' | 'scene';

interface TripleResult {
  zh: string;
  en: string;
  json: string;
}

interface TonePreset {
  id: string;
  name: string;
  description: TripleResult | null;
}

interface ExtractedAssets {
  characters: string[];
  scenes: string[];
  props: string[];
}

interface ContextPreset {
  id: string;
  name: string;
  description: string;
}

export interface Preset {
  id: string;
  name: string;
  prompt: string;
}

interface Project {
  id: string;
  name: string;
  referenceImage: string; // Base64 of the uploaded image
  toneAnalysis: TripleResult | null;
  tonePresets: TonePreset[];
  characterInput: string;
  characterStill: TripleResult | null;
  characterThreeView: TripleResult | null;
  sceneInput: string;
  sceneResult: TripleResult | null;
  storyboardInput: string;
  storyboardPresets: Preset[]; // Added
  videoPresets: Preset[]; // Added
  assetExtractInput: string;
  assetExtractPresets: Preset[];
  assetExtractResult: string;
  storyboardResult: TripleResult | null;
  reversePromptResult: TripleResult | null;
  pendingAudit: {
    result: TripleResult;
    score: number;
    suggestions: string;
    extractedAssets?: ExtractedAssets | null;
  } | null;
  extractedAssets: ExtractedAssets | null;
  selectedPresetId?: string | 'live' | null;
  globalStyle: string;
  styleCategory: string;
  genreCategory: string;
}

const STYLE_OPTIONS = ['中式', '欧美', '自定义'] as const;
const GENRE_OPTIONS = ['写实', '奇幻', '玄幻', '悬疑', '惊悚'] as const;

const INITIAL_PROJECT_NAME = "新影视项目 01";

const DEFAULT_VIDEO_PRESETS: Preset[] = [
  { id: 'video-default', name: '视频脚本生成', prompt: '# Role \n你是一位资深电影导演兼分镜艺术大师。你的任务是分析用户提供的【故事剧情/剧本】，并将其拆解为一个结构严谨、节奏合理的【AI 视频分镜脚本】。\n\n# Rules & Constraints\n1. 视听逻辑：严格遵循电影视听语言，镜头切换需流畅。时间估算必须符合真人表演的合理语速与动作时间（通常单镜头 3-8 秒）。\n2. 结构化输出：必须使用 Markdown 表格输出，不要任何废话和引言。\n3. 声音分离：将画面描述与台词/音效严格分开，便于后期 AI 视频制作。\n\n# Output Format (请严格按照此表格输出)\n### 🎬 《[生成剧名]》视频分镜脚本\n| 镜头序号 | 时间估算 | 画面描述 (Visual/Action) | 景别与运镜 (Shot & Camera) | 台词与音效 (Audio/Dialogue) |\n| :--- | :--- | :--- | :--- | :--- |\n| 1 |[如: 4s] | [描述画面主体、动作、环境] | [如: 全景，缓慢推镜头] |[如: (风沙声) 台词内容] |\n| 2 | ... | ... | ... | ... |' }
];

const DEFAULT_STORYBOARD_PRESETS: Preset[] = [
  { id: 'storyboard-default', name: '分镜图提示词生成', prompt: '# Role\n你是一位好莱坞顶级的影视美术指导兼 AI 生图提示词（Prompt）专家。你的任务是将用户提供的【视频分镜脚本】，转化为 AI 生图工具可直接使用的【单帧画面生成提示词】。\n\n# Rules & Constraints\n1. 画面一致性：提取脚本中的共同元素（如角色长相、服装、核心场景色调），并在每个镜头的提示词中保持这些元素的绝对统一。\n2. 格式标准：提示词必须采用“画面主体 + 环境光影 + 摄影机参数 + 质感风格”的结构。\n3. 语言要求：直接输出中文提示词（或中英双语），语句必须是极其具象的视觉描述，禁止出现“很好看”、“很有趣”等抽象词汇。\n4. 纯净输出：仅输出提示词内容，不要任何问候语、引言或解释性废话。\n\n# Base Style (全局视觉基调 - 每次生成必须自带)\n电影级真实感，院线截帧，21:9宽银幕。Kodak 500T 胶片质感，35mm 胶片颗粒。极度写实的物理材质与皮肤纹理，虚幻引擎5级光影，高对比度。\n\n# Output Format (请严格按照以下格式输出每个镜头)\n\n**[镜头 1] 提示词：**\n[全局视觉基调] +[将脚本镜头1的画面翻译为具象描述] + [运镜带来的画面构图（如特写/全景）] +[光影氛围]。\n*(例如：电影级真实感... 画面中央是一位穿着黑铁铠甲的将军，特写镜头，眼神锐利。大漠黄昏，漫反射柔和光线...)*\n\n**[镜头 2] 提示词：**\n...（以此类推，直到遍历完所有镜头）' }
];

const DEFAULT_ASSET_EXTRACT_PRESETS: Preset[] = [
  {
    id: 'char-art',
    name: '美术资产提取 (人/景/物)',
    prompt: `# Role (角色设定)\n你是一位顶级的“影视世界观架构师兼资深美术指导”。精通角色设计、场景搭建、道具设定以及视觉化呈现。\n\n# Task (任务目标)\n仔细阅读剧本，提取并构建【全维度视觉资产设定库】，直接用于 AI 绘图引擎或 3D 建模。\n\n# Core Rules (核心规则)\n1. **【推理补充】强制打标**：对剧本未明确但视觉化必需的细节（如材质、骨相、光影），基于人设进行极致脑补并在句末加 \`【推理补充】\` 标签。\n2. **结构完整**：严格按《资产模板》输出。没有的资产输出“暂无”。\n3. **视觉描述**：必须使用具象的视觉语言（如“哑光黑铁质感”），禁用抽象词汇。\n\n# Template (资产模板)\n请严格使用以下 Markdown 格式输出（使用 ### 作为大类标题，使用 #### 作为每一个输出资产的唯一标题卡片）：\n\n### 一、人物资产提取\n#### 1. [人物姓名] ([英文/代号])\n- **身份**：[剧本设定]\n- **年纪**：[生理年龄]，[视觉气场]\n- **脸型五官**：[骨相特征及肤色，眉眼鼻唇耳细节]\n- **妆发特征**：[发型/妆容/伤疤印记]\n- **服饰鞋履**：[上下装/鞋袜配饰的款式材质颜色]\n- **核心气质**：[3-4个概括词]\n\n### 二、场景资产提取\n#### 1. [场景名称] ([英文名称])\n- **特征分类**：[时代背景/空间尺度/光影色调]\n- **材质陈设**：[场景材质/重要摆件特征]\n- **核心氛围**：[3-4个概括词]\n\n### 三、物品道具资产提取\n#### 1. [物品名称] ([英文名称])\n- **物品类型**：[功能定义]\n- **材质工艺**：[主要材质及制作工艺]\n- **造型细节**：[整体形状、表面花纹特色]\n- **使用痕迹**：[磨损、包浆、战损、血迹等]\n- **核心气质**：[3-4个概括词]\n`
  }
];

// --- Helpers ---

const compressImage = (base64: string, maxWidth = 1024, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxWidth) {
          width *= maxWidth / height;
          height = maxWidth;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        resolve(base64);
        return;
      }
      // Fill background to prevent transparency issues when converting to jpeg
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Image compression failed'));
  });
};

// --- Components ---

// --- Error Boundary ---

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full bg-brand-bg flex items-center justify-center p-10">
          <div className="max-w-md w-full bg-brand-card border border-red-500/30 p-8 rounded-2xl space-y-6 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">系统遇到了异常</h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                这通常是由于浏览器缓存或本地存储异常引起的。建议您保存当前工作并刷新页面。
              </p>
            </div>
            <pre className="p-4 bg-black/40 rounded-lg text-[10px] text-red-400 overflow-x-auto text-left whitespace-pre-wrap">
              {this.state.error?.message}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-xl transition-all"
            >
              刷新应用程序
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TopTab>('script');
  const [activeScriptTab, setActiveScriptTab] = useState<ScriptSubTab>('video');
  const [activeAssetTab, setActiveAssetTab] = useState<AssetSubTab>('tone');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [worldviewPresets, setWorldviewPresets] = useSyncPresets<ContextPreset[]>('cinescript_worldview_v1', [
    { id: 'ancient-ch', name: '中国古代', description: '中国古代传统背景，包含古风建筑、传统服饰、历史韵味，强调古典美学与文化底蕴。' },
    { id: 'modern-ch', name: '中国现代', description: '当代中国都市背景，赛博朋克或生活化写实，包含现代建筑、街头文化、都市生活节奏。' },
    { id: 'western-fant', name: '欧美魔幻', description: '中世纪欧美奇幻背景，魔法与剑，哥特式建筑，史诗感与神话色彩。' },
    { id: 'sci-fi', name: '未来科幻', description: '硬核科幻或星际时代，高科技机械、外星景观、极简工业设计与霓虹美学。' }
  ]);
  const [editingContext, setEditingContext] = useState<ContextPreset | null>(null);
  const [showContextManager, setShowContextManager] = useState(false);

  // Global Presets explicitly managed and synced
  const [globalVideoPresets, setGlobalVideoPresets] = useSyncPresets<Preset[]>('video_presets', DEFAULT_VIDEO_PRESETS);
  const [globalStoryboardPresets, setGlobalStoryboardPresets] = useSyncPresets<Preset[]>('storyboard_presets', DEFAULT_STORYBOARD_PRESETS);
  const [globalAssetExtractPresets, setGlobalAssetExtractPresets] = useSyncPresets<Preset[]>('asset_extract_presets', DEFAULT_ASSET_EXTRACT_PRESETS);

  // Modal States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(localStorage.getItem('CUSTOM_GEMINI_API_KEY') || '');
  const [renamingProject, setRenamingProject] = useState<Project | null>(null);
  const [renamingPreset, setRenamingPreset] = useState<{ projectId: string, presetId: string, name: string } | null>(null);
  const [editingPreset, setEditingPreset] = useState<{ projectId: string, preset: TonePreset } | null>(null);
  const [newName, setNewName] = useState("");
  const [showStorageWarning, setShowStorageWarning] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<{ 
    title: string, 
    message: string, 
    onConfirm: () => void 
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportData = () => {
    // 聚合我们需要导出的本地全部数据
    const data: any = {
      projects,
      version: 'v8', // Bump to v8 for advanced export
      globalVideoPresets,
      globalStoryboardPresets,
      globalAssetExtractPresets,
      worldviewPresets
    };

    // 抓取可能只在独立组件里控制的本地预设
    const promptPresets = localStorage.getItem('prompt_presets');
    if (promptPresets) data.prompt_presets = JSON.parse(promptPresets);
    
    const labPresets = localStorage.getItem('lab_presets_v2');
    if (labPresets) data.lab_presets_v2 = JSON.parse(labPresets);

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cinescript-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setAlertMessage("项目数据导出成功！\n\n(提示词预设已随项目核心同频导出备份)");
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && json.projects && Array.isArray(json.projects)) {
           const newProjects = [...projects];
           (json.projects as Project[]).forEach((importedProject: Project) => {
              const idx = newProjects.findIndex(p => p.id === importedProject.id);
              if (idx === -1) {
                 newProjects.push(importedProject);
              } else {
                 newProjects[idx] = importedProject;
              }
           });
           setProjects(newProjects);
           
           // Restore presets if they exist in the payload
           if (json.globalVideoPresets) setGlobalVideoPresets(json.globalVideoPresets);
           if (json.globalStoryboardPresets) setGlobalStoryboardPresets(json.globalStoryboardPresets);
           if (json.globalAssetExtractPresets) setGlobalAssetExtractPresets(json.globalAssetExtractPresets);
           if (json.worldviewPresets) setWorldviewPresets(json.worldviewPresets);
           
           if (json.prompt_presets) localStorage.setItem('prompt_presets', JSON.stringify(json.prompt_presets));
           if (json.lab_presets_v2) localStorage.setItem('lab_presets_v2', JSON.stringify(json.lab_presets_v2));

           // Reload maybe to adopt new localStorage sync cleanly for components
           setConfirmData({
             title: "数据导入成功",
             message: `共合并或覆盖 ${json.projects.length} 个项目。由于修改了全局预设缓存，建议立即刷新页面使所有数据生效。`,
             onConfirm: () => {
               window.location.reload();
             }
           });
           
        } else {
           setAlertMessage("导入失败：此文件不包含有效的项目数据结构。");
        }
      } catch (err) {
        setAlertMessage("导入失败：文件解析错误。");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getProjectContext = (project: Project) => {
    const style = project.styleCategory;
    const genre = project.genreCategory;
    const lock = project.globalStyle;
    const preset = worldviewPresets.find(p => p.name === lock);
    const lockDesc = preset ? preset.description : lock;
    return `[风格基调: ${style}] [题材类型: ${genre}] [核心锁定描述: ${lockDesc}]`;
  };

  // Initialization
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cinescript_projects_v7');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProjects(parsed);
          setActiveProjectId(parsed[0].id);
        } else {
          throw new Error("Empty or invalid project list");
        }
      } else {
        const firstProject: Project = createNewProject(INITIAL_PROJECT_NAME);
        setProjects([firstProject]);
        setActiveProjectId(firstProject.id);
      }
    } catch (e) {
      console.warn("Storage load failed, initializing defaults...", e);
      const p = createNewProject(INITIAL_PROJECT_NAME);
      setProjects([p]);
      setActiveProjectId(p.id);
    }

    // Persistent Worldview Presets
    const savedPresets = localStorage.getItem('cinescript_worldview_v1');
    if (savedPresets) {
      try {
        setWorldviewPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.error("Failed to load worldview presets");
      }
    }
  }, []);

  // Persistence with adaptive pruning
  useEffect(() => {
    if (projects.length > 0) {
      const saveToStorage = (data: Project[]) => {
        try {
          localStorage.setItem('cinescript_projects_v7', JSON.stringify(data));
          setShowStorageWarning(false);
          return true;
        } catch (e: any) {
          if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
            return false;
          }
          console.error("Unknown storage error:", e);
          return true; // Stop trying if not quota
        }
      };

      if (!saveToStorage(projects)) {
        // Quota exceeded: Try more aggressive pruning
        console.warn("Storage quota exceeded, attempting multi-stage pruning...");
        let pruned = [...projects];

        // Stage 1: Prune all reference images EXCEPT for the active project
        for (let i = 0; i < pruned.length; i++) {
          if (pruned[i].id !== activeProjectId && pruned[i].referenceImage) {
            pruned[i] = { ...pruned[i], referenceImage: '' };
            if (saveToStorage(pruned)) {
              setProjects(pruned); // Sync state with storage
              return;
            }
          }
        }

        // Stage 2: Prune the active project's image if still full
        const activeIdx = pruned.findIndex(p => p.id === activeProjectId);
        if (activeIdx !== -1 && pruned[activeIdx].referenceImage) {
          pruned[activeIdx] = { ...pruned[activeIdx], referenceImage: '' };
          if (saveToStorage(pruned)) {
            setProjects(pruned);
            setAlertMessage("由于存储空间极度不足，已自动清理当前项目的图片缓存。");
            return;
          }
        }

        // Stage 3: Prune large text blobs from other projects
        for (let i = 0; i < pruned.length; i++) {
          if (pruned[i].id !== activeProjectId) {
            const hasLargeData = pruned[i].storyboardResult || pruned[i].pendingAudit;
            if (hasLargeData) {
              pruned[i] = { 
                ...pruned[i], 
                storyboardResult: null, 
                pendingAudit: null,
                sceneResult: null,
                characterStill: null,
                characterThreeView: null
              };
              if (saveToStorage(pruned)) {
                setProjects(pruned);
                return;
              }
            }
          }
        }
        
        // Final fallback: Still failing?
        setShowStorageWarning(true);
        console.error("Storage still full after exhaustive pruning.");
      }
    }
  }, [projects, activeProjectId]);

  function createNewProject(name: string): Project {
    const defaultTone: TripleResult = {
      zh: "[通用画质锁定：] 院线电影原始截帧，21:9，Kodak 500T 胶片质感，35mm胶片颗粒，冷灰调，去饱和。\n[环境锁定：] 柔和漫反射自然光，背景极浅景深。\n[角色描写&服饰描写：]\n[质感锁定：] 皮肤毛孔清晰，衣服材质哑光粗糙，真实碎发，没有任何美颜滤镜。没有AI塑料感，极强的物理真实感。\nPS：环境锁定上，可以加入一些烟雾、灰尘等描述，但是要根据场景来，比如城市很干净就不需要加。",
      en: "[Global Quality Lock:] Original theatrical film frame, 21:9, Kodak 500T film texture, 35mm film grain, cold gray tone, desaturated.\n[Environmental Lock:] Soft diffused natural light, background with extremely shallow depth of field.\n[Texture Lock:] Clear skin pores, matte and rough clothing materials, realistic loose hair, no beauty filters. No AI plastic feeling, extremely strong physical realism.\nPS: For Environmental Lock, descriptions like smoke or dust can be added depending on the scene (e.g., not needed for clean city scenes).",
      json: JSON.stringify({
        quality: "Theatrical, 21:9, Kodak 500T, 35mm grain",
        environment: "Soft diffused natural light, shallow DOF, conditional smoke/dust",
        texture: "Real skin pores, matte rough clothing, no beauty filters"
      })
    };

    return {
      id: Date.now().toString(),
      name,
      referenceImage: '',
      toneAnalysis: null,
      tonePresets: [
        { id: 'default-tone', name: '院线电影质感', description: defaultTone }
      ],
      videoPresets: [
        { id: 'video-default', name: '视频脚本生成', prompt: '# Role \n你是一位资深电影导演兼分镜艺术大师。你的任务是分析用户提供的【故事剧情/剧本】，并将其拆解为一个结构严谨、节奏合理的【AI 视频分镜脚本】。\n\n# Rules & Constraints\n1. 视听逻辑：严格遵循电影视听语言，镜头切换需流畅。时间估算必须符合真人表演的合理语速与动作时间（通常单镜头 3-8 秒）。\n2. 结构化输出：必须使用 Markdown 表格输出，不要任何废话和引言。\n3. 声音分离：将画面描述与台词/音效严格分开，便于后期 AI 视频制作。\n\n# Output Format (请严格按照此表格输出)\n### 🎬 《[生成剧名]》视频分镜脚本\n| 镜头序号 | 时间估算 | 画面描述 (Visual/Action) | 景别与运镜 (Shot & Camera) | 台词与音效 (Audio/Dialogue) |\n| :--- | :--- | :--- | :--- | :--- |\n| 1 |[如: 4s] | [描述画面主体、动作、环境] | [如: 全景，缓慢推镜头] |[如: (风沙声) 台词内容] |\n| 2 | ... | ... | ... | ... |' }
      ],
      storyboardPresets: [
        { id: 'storyboard-default', name: '分镜图提示词生成', prompt: '# Role\n你是一位好莱坞顶级的影视美术指导兼 AI 生图提示词（Prompt）专家。你的任务是将用户提供的【视频分镜脚本】，转化为 AI 生图工具可直接使用的【单帧画面生成提示词】。\n\n# Rules & Constraints\n1. 画面一致性：提取脚本中的共同元素（如角色长相、服装、核心场景色调），并在每个镜头的提示词中保持这些元素的绝对统一。\n2. 格式标准：提示词必须采用“画面主体 + 环境光影 + 摄影机参数 + 质感风格”的结构。\n3. 语言要求：直接输出中文提示词（或中英双语），语句必须是极其具象的视觉描述，禁止出现“很好看”、“很有趣”等抽象词汇。\n4. 纯净输出：仅输出提示词内容，不要任何问候语、引言或解释性废话。\n\n# Base Style (全局视觉基调 - 每次生成必须自带)\n电影级真实感，院线截帧，21:9宽银幕。Kodak 500T 胶片质感，35mm 胶片颗粒。极度写实的物理材质与皮肤纹理，虚幻引擎5级光影，高对比度。\n\n# Output Format (请严格按照以下格式输出每个镜头)\n\n**[镜头 1] 提示词：**\n[全局视觉基调] +[将脚本镜头1的画面翻译为具象描述] + [运镜带来的画面构图（如特写/全景）] +[光影氛围]。\n*(例如：电影级真实感... 画面中央是一位穿着黑铁铠甲的将军，特写镜头，眼神锐利。大漠黄昏，漫反射柔和光线...)*\n\n**[镜头 2] 提示词：**\n...（以此类推，直到遍历完所有镜头）' }
      ],
      assetExtractInput: '',
      assetExtractResult: '',
      assetExtractPresets: [
        {
          id: 'char-art',
          name: '美术资产提取 (人/景/物)',
          prompt: `# Role (角色设定)\n你是一位顶级的“影视世界观架构师兼资深美术指导”。精通角色设计、场景搭建、道具设定以及视觉化呈现。\n\n# Task (任务目标)\n仔细阅读剧本，提取并构建【全维度视觉资产设定库】，直接用于 AI 绘图引擎或 3D 建模。\n\n# Core Rules (核心规则)\n1. **【推理补充】强制打标**：对剧本未明确但视觉化必需的细节（如材质、骨相、光影），基于人设进行极致脑补并在句末加 \`【推理补充】\` 标签。\n2. **结构完整**：严格按《资产模板》输出。没有的资产输出“暂无”。\n3. **视觉描述**：必须使用具象的视觉语言（如“哑光黑铁质感”），禁用抽象词汇。\n\n# Template (资产模板)\n请严格使用以下 Markdown 格式输出（使用 ### 作为大类标题，使用 #### 作为每一个输出资产的唯一标题卡片）：\n\n### 一、人物资产提取\n#### 1. [人物姓名] ([英文/代号])\n- **身份**：[剧本设定]\n- **年纪**：[生理年龄]，[视觉气场]\n- **脸型五官**：[骨相特征及肤色，眉眼鼻唇耳细节]\n- **妆发特征**：[发型/妆容/伤疤印记]\n- **服饰鞋履**：[上下装/鞋袜配饰的款式材质颜色]\n- **核心气质**：[3-4个概括词]\n\n### 二、场景资产提取\n#### 1. [场景名称] ([英文名称])\n- **特征分类**：[时代背景/空间尺度/光影色调]\n- **材质陈设**：[场景材质/重要摆件特征]\n- **核心氛围**：[3-4个概括词]\n\n### 三、物品道具资产提取\n#### 1. [物品名称] ([英文名称])\n- **物品类型**：[功能定义]\n- **材质工艺**：[主要材质及制作工艺]\n- **造型细节**：[整体形状、表面花纹特色]\n- **使用痕迹**：[磨损、包浆、战损、血迹等]\n- **核心气质**：[3-4个概括词]\n`
        }
      ],
      characterInput: '',
      characterStill: null,
      characterThreeView: null,
      sceneInput: '',
      sceneResult: null,
      storyboardInput: '',
      storyboardResult: null,
      reversePromptResult: null,
      extractedAssets: null,
      selectedPresetId: 'live',
      pendingAudit: null,
      globalStyle: '中国古代风格',
      styleCategory: '中式',
      genreCategory: '写实'
    };
  }

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  if (!activeProject && projects.length === 0) {
    return (
      <div className="h-screen w-full bg-brand-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  const updateActiveProject = (updates: Partial<Project>) => {
    setProjects(prev => {
      const currentActiveId = activeProjectId || (prev.length > 0 ? prev[0].id : null);
      if (!currentActiveId) return prev;
      return prev.map(p => p.id === currentActiveId ? { ...p, ...updates } : p);
    });
  };

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
      }).catch(err => {
        console.error("Clipboard copy failed: ", err);
      });
    } else {
      // Fallback for non-https or restricted iframes
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
      } catch (err) {
        console.error("Fallback copy failed: ", err);
      }
      document.body.removeChild(textArea);
    }
  };

  // --- Handlers ---

  const handleDeleteProject = () => {
    if (!activeProjectId) return;
    setConfirmData({
      title: "删除项目",
      message: "确定删除此项目？这将清除本项目的所有资产数据且不可恢复。",
      onConfirm: () => {
        setProjects(prev => {
          const remaining = prev.filter(p => p.id !== activeProjectId);
          if (remaining.length > 0) {
            setActiveProjectId(remaining[0].id);
          } else {
            const first = createNewProject(INITIAL_PROJECT_NAME);
            remaining.push(first);
            setActiveProjectId(first.id);
          }
          return remaining;
        });
        setConfirmData(null);
      }
    });
  };

  const handleDeletePreset = (presetId: string) => {
    if (!activeProject) return;
    if (presetId === 'default-tone') {
      setAlertMessage("院线电影质感是系统核心基调，无法删除。");
      return;
    }
    setConfirmData({
      title: "删除预设",
      message: "确定从本项目基调库中永久删除此预设？",
      onConfirm: () => {
        const updatedPresets = activeProject.tonePresets.filter(p => p.id !== presetId);
        const updates: Partial<Project> = { tonePresets: updatedPresets };
        if (activeProject.selectedPresetId === presetId) {
          updates.selectedPresetId = 'live';
        }
        updateActiveProject(updates);
        setConfirmData(null);
      }
    });
  };

  const processImage = async (file: File) => {
    setLoading(true);
    setLoadingText('正在智能压缩并准备解析图像...');
    try {
      const reader = new FileReader();
      reader.onerror = () => {
        console.error("FileReader error");
        setLoading(false);
        setLoadingText(null);
      };
      reader.onloadend = async () => {
        try {
          const fullBase64 = reader.result as string;
          if (!fullBase64) throw new Error("File reading yielded no result");
          
          // Apply compression before saving to state and localStorage
          const compressedBase64 = await compressImage(fullBase64);
          const base64Data = compressedBase64.split(',')[1];
          
          updateActiveProject({ referenceImage: compressedBase64 });
          
          // Trigger both analyses in parallel
          const [analysis, reversal] = await Promise.all([
            geminiService.analyzeVisualTone(base64Data, 'image/jpeg'),
            geminiService.reversePrompt(base64Data, 'image/jpeg')
          ]);
          
          updateActiveProject({ 
            toneAnalysis: analysis, 
            selectedPresetId: 'live',
            reversePromptResult: reversal
          });
        } catch (innerError) {
          console.error("图片处理或分析内部失败:", innerError);
        } finally {
          setLoading(false);
          setLoadingText(null);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("图片读取启动失败:", error);
      setLoading(false);
      setLoadingText(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) processImage(file);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImage(file);
    }
  };

  const handleSaveToTonePreset = () => {
    if (!activeProject || !activeProject.toneAnalysis) return;
    const newPreset: TonePreset = {
      id: Date.now().toString(),
      name: `预设-${new Date().toLocaleTimeString()}`,
      description: activeProject.toneAnalysis
    };
    updateActiveProject({ 
      tonePresets: [...activeProject.tonePresets, newPreset] 
    });
  };

  const handleGenerateCharacterAssets = async () => {
    if (!activeProject || !activeProject.characterInput.trim()) return;
    setLoading(true);
    // Clear previous results to show loading state in cards
    updateActiveProject({ characterStill: null, characterThreeView: null });
    
    try {
      const toneStr = activeProject.toneAnalysis?.zh || (activeProject.tonePresets[0]?.description?.zh || "电影级别真实感色彩基调");
      const context = getProjectContext(activeProject);
      
      const [stillResult, threeViewResult] = await Promise.all([
        geminiService.generateCharacterStill(activeProject.characterInput, toneStr, context),
        geminiService.generateCharacterThreeView(activeProject.characterInput, toneStr, context)
      ]);
      
      updateActiveProject({ 
        characterStill: stillResult, 
        characterThreeView: threeViewResult 
      });
    } catch (error) {
      console.error("生成角色资产失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateScene = async () => {
    if (!activeProject || !activeProject.sceneInput.trim()) return;
    setLoading(true);
    try {
      const toneStr = activeProject.toneAnalysis?.zh || (activeProject.tonePresets[0]?.description?.zh || "电影级别真实感色彩基调");
      const context = getProjectContext(activeProject);
      const result = await geminiService.generateScenePrompt(activeProject.sceneInput, toneStr, context);
      updateActiveProject({ sceneResult: result });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleReversePrompt = async () => {
    if (!activeProject || !activeProject.referenceImage) return;
    setLoading(true);
    setLoadingText('提示词反推智能体正在深度解析画面...');
    try {
      const [mimeType, base64] = activeProject.referenceImage.split(';base64,');
      const result = await geminiService.reversePrompt(base64, mimeType.split(':')[1]);
      updateActiveProject({ reversePromptResult: result });
    } catch (error) {
      console.error("提示词反推失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateStoryboard = async () => {
    if (!activeProject || !activeProject.storyboardInput.trim()) return;
    setLoading(true);
    setLoadingText('正在由导演进行初版剧本拆解...');
    // Clear previous results to avoid "Audit Overlay" bug and force clean state
    updateActiveProject({ storyboardResult: null, pendingAudit: null });
    
    try {
      const context = getProjectContext(activeProject);
      const result = await geminiService.generateStoryboard(activeProject.storyboardInput, context);
      
      // -- Robust Asset Extraction --
      let assets: any = null;
      try {
        const parsed = JSON.parse(result.json);
        // Try multiple potential paths for assets
        const rawAssets = parsed.assets || parsed;
        
        if (rawAssets.characters || rawAssets.scenes || rawAssets.props) {
          assets = {
            characters: Array.isArray(rawAssets.characters) ? rawAssets.characters : [],
            scenes: Array.isArray(rawAssets.scenes) ? rawAssets.scenes : [],
            props: Array.isArray(rawAssets.props) ? rawAssets.props : []
          };
        }
      } catch (e) {
        console.warn("Could not parse extracted assets from AI JSON", e);
      }

      // -- Fallback: Manual Extraction from Markdown if JSON failed or is too sparse --
      if (!assets || (!assets.characters.length && !assets.scenes.length)) {
        const lines = result.zh.split('\n');
        let currentSection = '';
        const fallbackAssets = { characters: [] as string[], scenes: [] as string[], props: [] as string[] };
        
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith('# 主体列表')) currentSection = 'characters';
          else if (trimmed.startsWith('# 场景列表')) currentSection = 'scenes';
          else if (trimmed.startsWith('# ')) currentSection = '';
          else if (currentSection && trimmed && !trimmed.startsWith('片段数量')) {
            // Basic extraction: "Name: Description" -> "Name: Description"
            if (trimmed.includes('：') || trimmed.includes(':')) {
              if (currentSection === 'characters') fallbackAssets.characters.push(trimmed);
              if (currentSection === 'scenes') fallbackAssets.scenes.push(trimmed);
            }
          }
        });
        
        if (fallbackAssets.characters.length || fallbackAssets.scenes.length) {
          assets = fallbackAssets;
        }
      }

      updateActiveProject({ 
        storyboardResult: result,
        extractedAssets: assets || activeProject.extractedAssets
      });
      
      if (assets) {
        setAlertMessage("初向剧本拆解完成！您可以继续点击“专家校审”进行深度逻辑审查。");
      }
    } catch (error) {
      console.error(error);
      setAlertMessage("剧本分析过程中遇到网络或系统异常，请稍后刷新重试。");
    } finally {
      // Ensure state is ALWAYS reset
      setTimeout(() => {
        setLoading(false);
        setLoadingText(null);
      }, 500); 
    }
  };

  const handleVerifyStoryboard = async () => {
    if (!activeProject || !activeProject.storyboardResult) return;
    setLoading(true);
    setLoadingText('专家级编审正在进行深度逻辑审查与校对...');
    try {
      const auditedResult = await geminiService.verifyStoryboard(
        activeProject.storyboardInput, 
        activeProject.storyboardResult.zh
      );
      
      let score = 0;
      let suggestions = "";
      let assets: any = null;
      try {
        const parsed = JSON.parse(auditedResult.json);
        score = parsed.audit_score || 0;
        suggestions = parsed.audit_suggestions || "";
        
        const rawAssets = parsed.assets || parsed;
        if (rawAssets.characters || rawAssets.scenes || rawAssets.props) {
          assets = {
            characters: Array.isArray(rawAssets.characters) ? rawAssets.characters : [],
            scenes: Array.isArray(rawAssets.scenes) ? rawAssets.scenes : [],
            props: Array.isArray(rawAssets.props) ? rawAssets.props : []
          };
        }
      } catch (e) {
        console.warn("Could not parse audit data", e);
      }

      // Fallback extraction for audit too
      if (!assets || (!assets.characters.length && !assets.scenes.length)) {
        const lines = auditedResult.zh.split('\n');
        let currentSection = '';
        const fallbackAssets = { characters: [] as string[], scenes: [] as string[], props: [] as string[] };
        
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith('# 主体列表')) currentSection = 'characters';
          else if (trimmed.startsWith('# 场景列表')) currentSection = 'scenes';
          else if (trimmed.startsWith('# ')) currentSection = '';
          else if (currentSection && trimmed && !trimmed.startsWith('片段数量')) {
            if (trimmed.includes('：') || trimmed.includes(':')) {
              if (currentSection === 'characters') fallbackAssets.characters.push(trimmed);
              if (currentSection === 'scenes') fallbackAssets.scenes.push(trimmed);
            }
          }
        });
        
        if (fallbackAssets.characters.length || fallbackAssets.scenes.length) {
          assets = fallbackAssets;
        }
      }

      updateActiveProject({ 
        pendingAudit: {
          result: auditedResult,
          score,
          suggestions,
          extractedAssets: assets
        }
      });
      setAlertMessage("专家级编审已完成审查方案。请在分镜区域查看建议并选择是否应用该修正版本。");
    } catch (error) {
      console.error(error);
      setAlertMessage("专家校审过程中遇到问题。");
    } finally {
      setLoading(false);
      setLoadingText(null);
    }
  };

  const handleApplyAudit = () => {
    if (!activeProject || !activeProject.pendingAudit) return;
    updateActiveProject({
      storyboardResult: activeProject.pendingAudit.result,
      extractedAssets: activeProject.pendingAudit.extractedAssets || activeProject.extractedAssets,
      pendingAudit: null
    });
    setAlertMessage("成功应用专家修正方案！同时同步更新了剧本资源提取列表。");
  };

  const handleDiscardAudit = () => {
    updateActiveProject({ pendingAudit: null });
  };

  const handleResetApp = () => {
    if (!activeProjectId) return;
    setConfirmData({
      title: "确定要清空工作区内容吗？",
      message: "这将重置当前项目的所有输入、生成的资产及分镜数据，但会保留您的项目及基调库。此操作不可撤销。",
      onConfirm: () => {
        updateActiveProject({
          referenceImage: '',
          toneAnalysis: null,
          characterInput: '',
          characterStill: null,
          characterThreeView: null,
          sceneInput: '',
          sceneResult: null,
          storyboardInput: '',
          storyboardResult: null,
          pendingAudit: null,
          extractedAssets: null,
          reversePromptResult: null
        });
        setConfirmData(null);
        setAlertMessage("工作区已清空，您可以重新开始创作。");
      }
    });
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-brand-bg overflow-hidden text-white font-sans selection:bg-brand-accent/30">
      {!activeProject && projects.length === 0 && (
         <div className="fixed inset-0 z-[100] bg-brand-bg flex flex-col items-center justify-center gap-6">
            <Loader2 className="w-12 h-12 text-brand-accent animate-spin" />
            <div className="text-sm font-bold tracking-[0.3em] text-brand-accent animate-pulse">初始化实验室核心组件...</div>
         </div>
      )}
      {/* 1. Sidebar Project List */}
      <aside className="w-64 bg-brand-sidebar border-r border-brand-border flex flex-col py-6 relative z-30">
        <div className="px-6 pb-6 flex items-center gap-3 border-b border-brand-border/50">
          <div className="p-2 bg-brand-accent rounded-lg shadow-lg">
            <Box className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold text-sm tracking-widest text-white uppercase">影视资产生成器</span>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
          <div className="px-3 pb-2 text-[10px] uppercase tracking-[0.2em] text-text-secondary font-bold">我的项目</div>
          {projects.map(project => (
            <div key={project.id} className="group relative">
              <button
                onClick={() => setActiveProjectId(project.id)}
                className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg transition-all text-xs font-medium ${
                  activeProjectId === project.id 
                    ? 'bg-brand-accent/10 border border-brand-accent/30 text-brand-accent' 
                    : 'text-text-secondary hover:bg-white/5 border border-transparent'
                }`}
              >
                <FolderOpen className={`w-3.5 h-3.5 flex-shrink-0 ${activeProjectId === project.id ? 'text-brand-accent' : 'text-gray-600'}`} />
                <span className="truncate pr-12 text-left">{project.name}</span>
              </button>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-[60]">
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRenamingProject(project);
                    setNewName(project.name);
                  }}
                  className="p-1.5 hover:text-brand-accent text-text-secondary bg-brand-sidebar rounded-md"
                  title="重命名项目"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                {projects.length > 1 && (
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (activeProjectId === project.id) {
                        handleDeleteProject();
                      } else {
                        // Delete non-active project directly
                        setConfirmData({
                          title: "删除项目",
                          message: `确定删除项目「${project.name}」？这将清除该项目的所有资产数据且不可恢复。`,
                          onConfirm: () => {
                            setProjects(prev => prev.filter(p => p.id !== project.id));
                            setConfirmData(null);
                          }
                        });
                      }
                    }}
                    className="p-1.5 text-text-secondary hover:text-red-500 bg-brand-sidebar rounded-md"
                    title="删除项目"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button 
            onClick={() => {
              const p = createNewProject(`项目 ${projects.length + 1}`);
              setProjects([...projects, p]);
              setActiveProjectId(p.id);
            }}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-white hover:bg-white/5 transition-all mt-4 border border-dashed border-brand-border"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新建项目</span>
          </button>

          <div className="mt-8 px-4 py-6 border-t border-brand-border/30 space-y-4">
             <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-brand-accent font-black flex items-center gap-2">
                   <ShieldCheck className="w-3 h-3" />
                   项目核心设定
                </div>
             </div>
             
             <div className="space-y-4">
                {/* 风格选择 Select */}
                <div className="space-y-2">
                   <div className="text-[9px] text-text-secondary uppercase font-bold px-1 flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-brand-accent/50" />
                      视觉基调
                   </div>
                   <div className="relative group/select">
                      <select 
                        value={activeProject?.styleCategory}
                        onChange={(e) => {
                           const opt = e.target.value;
                           const updates: Partial<Project> = { styleCategory: opt };
                           if (opt === '中式') updates.globalStyle = '中国古代风格';
                           else if (opt === '欧美') updates.globalStyle = '中世纪欧美风格';
                           updateActiveProject(updates);
                        }}
                        className="w-full bg-black/40 border border-brand-border/50 rounded-lg px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-brand-accent appearance-none cursor-pointer hover:bg-black/60 transition-all"
                      >
                         {STYLE_OPTIONS.map(opt => (
                           <option key={opt} value={opt} className="bg-brand-sidebar text-white">{opt}</option>
                         ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary group-hover/select:text-brand-accent transition-colors">
                         <ChevronRight className="w-3 h-3 rotate-90" />
                      </div>
                   </div>
                </div>

                {/* 题材选择 Select */}
                <div className="space-y-2">
                   <div className="text-[9px] text-text-secondary uppercase font-bold px-1 flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-brand-accent/50" />
                      题材类型
                   </div>
                   <div className="relative group/select">
                      <select 
                        value={activeProject?.genreCategory}
                        onChange={(e) => updateActiveProject({ genreCategory: e.target.value })}
                        className="w-full bg-black/40 border border-brand-border/50 rounded-lg px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-brand-accent appearance-none cursor-pointer hover:bg-black/60 transition-all"
                      >
                         {GENRE_OPTIONS.map(opt => (
                           <option key={opt} value={opt} className="bg-brand-sidebar text-white">{opt}</option>
                         ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary group-hover/select:text-brand-accent transition-colors">
                         <ChevronRight className="w-3 h-3 rotate-90" />
                      </div>
                   </div>
                </div>
                
                <div className="space-y-1.5 pt-2 border-t border-brand-border/20">
                   <div className="text-[9px] text-text-secondary uppercase font-bold px-1">核心锁定词 (风格组合定义)</div>
                   <input 
                     value={activeProject?.globalStyle || ''}
                     onChange={(e) => updateActiveProject({ globalStyle: e.target.value })}
                     placeholder="例：中式+奇幻+商周背景..."
                     className="w-full bg-black/40 border border-brand-border rounded px-3 py-2 text-[11px] outline-none focus:border-brand-accent transition-all text-gray-200"
                   />
                </div>
                
                <div className="space-y-2 px-1">
                   <div className="text-[9px] text-text-secondary/60 font-bold uppercase tracking-wider">常用推荐示例 (点击应用)</div>
                   <div className="flex flex-col gap-1.5">
                      {[
                        '中式+奇幻+商周背景',
                        '欧美+写实+维多利亚时代',
                        '中式+悬疑+大唐盛世',
                        '未来+科幻+赛博朋克'
                      ].map(example => (
                        <button
                          key={example}
                          onClick={() => updateActiveProject({ globalStyle: example })}
                          className="text-left text-[9px] text-brand-accent/70 hover:text-brand-accent transition-colors py-0.5 border-b border-white/5 truncate"
                        >
                          {example}
                        </button>
                      ))}
                   </div>
                   <p className="text-[8px] text-text-secondary/40 leading-relaxed mt-1 italic">
                      系统将结合“视觉+题材+锁定词”进行工业级考据生成。
                   </p>
                </div>
             </div>
          </div>
        </div>

        <div className="p-4 border-t border-brand-border/50 space-y-1">
           <div 
             onClick={handleResetApp}
             className="flex items-center gap-3 px-4 py-2 text-xs text-red-500/60 cursor-pointer hover:text-red-500 transition-colors group"
           >
             <History className="w-3.5 h-3.5 group-hover:rotate-[-45deg] transition-transform" />
             <span>重置工作区</span>
           </div>
           <div 
             onClick={() => setShowSettingsModal(true)}
             className="flex items-center gap-3 px-4 py-2 text-xs text-text-secondary cursor-pointer hover:text-white transition-colors"
           >
             <Settings className="w-3.5 h-3.5" />
             <span>系统设置</span>
           </div>
        </div>
      </aside>

      {/* 2. Main Workspace */}
      <main className="flex-1 flex flex-col h-full bg-brand-bg relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-accent/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        <header className="h-16 px-8 border-b border-brand-border flex justify-between items-center bg-brand-sidebar z-20 shrink-0">
          <div className="flex items-center gap-8">
            <h1 className="text-sm font-bold tracking-widest uppercase text-white/90 border-r border-brand-border pr-8 mr-2">
              {activeProject?.name}
            </h1>
            <nav className="flex items-center gap-1">
              {[
                { id: 'script', name: '剧本分析', icon: <Layout className="w-4 h-4" /> },
                { id: 'asset', name: '美术资产生成', icon: <ImageIcon className="w-4 h-4" /> },
                { id: 'prompt', name: '提示词预设', icon: <Bookmark className="w-4 h-4" /> },
                { id: 'safety', name: '过审工具', icon: <ShieldCheck className="w-4 h-4" /> },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TopTab)}
                  className={`px-4 h-16 flex items-center gap-2 text-[13px] font-bold uppercase tracking-widest transition-all border-b-2 relative ${
                    activeTab === tab.id 
                      ? 'text-brand-accent border-brand-accent' 
                      : 'text-text-secondary border-transparent hover:text-white'
                  }`}
                >
                  {tab.icon}
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
             <AuthComponent />
             <button onClick={() => setShowSettingsModal(true)} className="p-2 text-white/50 hover:text-brand-accent hover:bg-white/5 rounded-lg transition-all" title="模型 & 设置">
                <Settings className="w-5 h-5" />
             </button>
          </div>
        </header>

        {activeTab === 'script' && (
          <div className="h-12 px-8 flex items-center gap-8 border-b border-brand-border bg-brand-sidebar/80 z-10 shrink-0">
            {[
              { id: 'video', name: '视频脚本' },
              { id: 'storyboard', name: '分镜图脚本' },
              { id: 'asset_extract', name: '美术资产提取' }
            ].map(sub => (
              <button
                key={sub.id}
                onClick={() => setActiveScriptTab(sub.id as ScriptSubTab)}
                className={`h-full flex items-center text-[12px] font-bold tracking-widest uppercase transition-all border-b-2 ${
                  activeScriptTab === sub.id 
                    ? 'text-brand-accent border-brand-accent' 
                    : 'text-text-secondary border-transparent hover:text-white'
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'asset' && (
          <div className="h-12 px-8 flex items-center gap-8 border-b border-brand-border bg-brand-sidebar/80 z-10 shrink-0">
            {[
              { id: 'tone', name: '视觉基调设定' },
              { id: 'character', name: '角色资产生成' },
              { id: 'scene', name: '场景资产生成' }
            ].map(sub => (
              <button
                key={sub.id}
                onClick={() => setActiveAssetTab(sub.id as AssetSubTab)}
                className={`h-full flex items-center text-[10px] font-bold tracking-widest uppercase transition-all border-b-2 ${
                  activeAssetTab === sub.id 
                    ? 'text-brand-accent border-brand-accent' 
                    : 'text-text-secondary border-transparent hover:text-white'
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence>
          {showStorageWarning && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-500/10 border-b border-red-500/20 px-8 py-2 flex items-center justify-between z-10"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
                  警告: 浏览器本地存储空间已满。系统已自动清理旧项目的图片缓存以确保存储安全。
                </span>
              </div>
              <button 
                onClick={() => {
                   setProjects(prev => prev.map(p => ({ ...p, referenceImage: '' })));
                   setShowStorageWarning(false);
                }}
                className="text-[9px] font-black text-red-500 hover:underline underline-offset-4"
              >
                立即清理所有缓存图片
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar relative">
          <AnimatePresence mode="wait">
            {activeTab === 'asset' && activeAssetTab === 'tone' && (
              <motion.div
                key="tone-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="w-full min-h-full space-y-8 flex flex-col"
              >
                {/* Unified Upload Area */}
                <div 
                  onPaste={handlePaste}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="bg-brand-card rounded-2xl border border-brand-border flex flex-col items-center justify-center min-h-[300px] lg:min-h-[400px] card-shadow overflow-hidden relative group bg-black/40"
                >
                  {activeProject.referenceImage ? (
                    <div className="w-full h-full flex items-center justify-center relative">
                      <img 
                        src={activeProject.referenceImage} 
                        alt="参考图" 
                        referrerPolicy="no-referrer"
                        className="max-w-full max-h-[600px] object-contain transition-opacity group-hover:opacity-40"
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity space-y-4">
                         <div className="p-4 bg-brand-accent/20 rounded-full text-brand-accent backdrop-blur-md">
                           <Upload className="w-8 h-8" />
                         </div>
                         <p className="text-xs font-bold text-brand-accent px-4 py-2 bg-black/80 border border-brand-accent/30 rounded-full shadow-2xl backdrop-blur-sm">点击、拖入或粘贴以更换图片分析</p>
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageUpload} 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        accept="image/*" 
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-6">
                      <div className="p-6 bg-brand-accent/5 rounded-full text-brand-accent">
                        <ImagePlus className="w-12 h-12" />
                      </div>
                      <div className="text-center space-y-2 px-6">
                         <h3 className="text-lg font-bold">粘贴、拖入或上传剧照</h3>
                         <p className="text-xs text-text-secondary">AI 将为您一次性完成 [视觉基调提取] 与 [nanobanana 提示词反推]</p>
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageUpload} 
                        className="hidden" 
                        accept="image/*" 
                      />
                      <button 
                         onClick={() => fileInputRef.current?.click()}
                         disabled={loading}
                         className="px-8 py-3 bg-brand-accent text-black font-bold text-xs uppercase tracking-widest rounded-lg hover:brightness-110 shadow-lg active:scale-95 transition-all flex items-center gap-2"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        立即上传图片开始双向分析
                      </button>
                    </div>
                  )}
                </div>

                <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch min-h-[600px]">
                  {/* Result 1: Analysis Result */}
                  <div className="flex flex-col space-y-4 h-full">
                    <div className="flex items-center gap-2 px-1 flex-shrink-0">
                      <Zap className="w-4 h-4 text-brand-accent" />
                      <span className="text-[10px] font-bold tracking-widest text-text-secondary uppercase">模块一：复刻画面分析结果</span>
                    </div>
                    <div className="flex-1 flex flex-col">
                      <TripleOutputCard 
                        title="视觉特征提取"
                        result={activeProject.toneAnalysis}
                        onCopy={handleCopy}
                        onChange={(val: TripleResult) => updateActiveProject({ toneAnalysis: val, selectedPresetId: 'live' })}
                        loading={loading}
                        loadingText={loadingText}
                        onResetLoading={() => { setLoading(false); setLoadingText(null); }}
                        onSavePreset={handleSaveToTonePreset}
                        isMarkdown={true}
                      />
                    </div>
                  </div>

                  {/* Result 2: Reverse Prompt Agent */}
                  <div className="flex flex-col space-y-4 h-full">
                    <div className="flex items-center gap-2 px-1 flex-shrink-0">
                      <Terminal className="w-4 h-4 text-brand-accent" />
                      <span className="text-[10px] font-bold tracking-widest text-text-secondary uppercase">提示词反推 (nanobanana)</span>
                    </div>
                    
                    <div className="bg-brand-card rounded-2xl border border-brand-border card-shadow flex flex-col flex-1 overflow-hidden h-full">
                      {/* Integrated Action Header */}
                      <div className="px-6 py-4 border-b border-brand-border bg-white/[0.02] flex items-center justify-between shrink-0">
                         <div className="flex items-center gap-2">
                           <div className="w-2 h-2 bg-brand-accent rounded-full animate-pulse shadow-[0_0_8px_rgba(226,181,62,0.6)]" />
                           <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest leading-none">智能体方案输出</span>
                         </div>
                         {activeProject.reversePromptResult && (
                           <div className="flex items-center gap-2">
                             <button 
                               onClick={() => handleCopy(activeProject.reversePromptResult?.zh || '', 'reverse-zh')}
                               className="px-3 py-1 bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent rounded text-[9px] font-bold transition-all flex items-center gap-1.5 border border-brand-accent/20"
                               title="复制全词"
                             >
                               {copied === 'reverse-zh' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                               {copied === 'reverse-zh' ? '已复制' : '复制分析'}
                             </button>
                           </div>
                         )}
                      </div>

                      <div className="flex-1 relative bg-black/10 flex flex-col min-h-0">
                        {loading && !activeProject.reversePromptResult ? (
                           <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-50 px-10 text-center">
                              <Loader2 className="w-10 h-10 animate-spin text-brand-accent" />
                              <div className="space-y-1">
                                <span className="block text-[11px] font-black tracking-[0.3em] uppercase text-white/90">识别中</span>
                                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest animate-pulse">提示词反推智能体正在解析画面细节...</p>
                              </div>
                           </div>
                        ) : !activeProject.reversePromptResult ? (
                          <div className="flex-1 border border-dashed border-brand-border/40 rounded-xl flex flex-col items-center justify-center text-center m-6 p-8 space-y-3 opacity-60">
                            <div className="p-4 bg-brand-accent/5 rounded-full">
                               <ScanSearch className="w-8 h-8 text-brand-accent/40" />
                            </div>
                            <div className="space-y-1">
                               <p className="text-[10px] uppercase font-bold tracking-tighter text-white">等待分析指令</p>
                               <p className="text-[9px] text-text-secondary">上传参考图后，系统将为您反向生成 nanobanana 复刻提示词</p>
                            </div>
                          </div>
                         ) : (
                          <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden">
                             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar text-[12px] leading-relaxed text-gray-300 space-y-6">
                                 {(activeProject.reversePromptResult.zh || '').replace(/\\n/g, '\n').split('\n').map((line: string, idx: number) => {
                                   if (!line.trim()) return <div key={idx} className="h-2" />;
                                   
                                   const titleMatch = line.match(/^\[(.*?)\]$/);
                                   if (titleMatch) {
                                     return (
                                       <div key={idx} className="pt-4 pb-2 flex items-center gap-3">
                                          <div className="w-1 h-3 rounded-full bg-brand-accent" />
                                          <h4 className="text-xs font-bold uppercase tracking-wider !my-0 text-brand-accent">{titleMatch[1]}</h4>
                                       </div>
                                     );
                                   }

                                   const parts = line.split(/[：:]/);
                                   if (parts.length >= 2 && !line.startsWith('[')) {
                                      return (
                                        <div key={idx} className="flex gap-4 text-[12px] leading-relaxed group">
                                          <span className="text-brand-accent/70 font-black uppercase tracking-tighter shrink-0 min-w-[90px] text-right">{parts[0]}</span>
                                          <span className="text-gray-200 font-medium flex-1">{parts.slice(1).join('：')}</span>
                                        </div>
                                      );
                                   }

                                   return (
                                      <p key={idx} className="text-white bg-black/20 p-4 rounded-xl border border-white/5 whitespace-pre-wrap leading-loose">
                                        {line}
                                      </p>
                                   );
                                 })}
                             </div>
                            
                            <div className="p-6 bg-brand-accent/5 border-t border-brand-border shrink-0 space-y-3">
                               <div className="flex items-center justify-between px-1">
                                  <div className="flex items-center gap-2">
                                     <Globe className="w-3 h-3 text-text-secondary" />
                                     <span className="text-[9px] uppercase font-bold text-text-secondary tracking-widest text-white/60">Nanobanana English Prompt</span>
                                  </div>
                                  <button 
                                    onClick={() => handleCopy(activeProject.reversePromptResult?.en || '', 'reverse-en')}
                                    className="text-[9px] font-bold text-brand-accent hover:underline flex items-center gap-1 bg-brand-accent/10 px-2 py-0.5 rounded shadow-sm"
                                  >
                                    {copied === 'reverse-en' ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                    {copied === 'reverse-en' ? '已复制' : '复制英文内容'}
                                  </button>
                               </div>
                               <div className="p-4 bg-black/40 border border-white/5 rounded-xl text-[10px] text-gray-400 italic font-medium leading-relaxed font-mono">
                                  {activeProject.reversePromptResult.en}
                               </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Saved Presets Table */}
                <div className="bg-brand-card rounded-2xl border border-brand-border card-shadow overflow-hidden">
                   <div className="px-6 py-4 border-b border-brand-border bg-white/[0.02] flex justify-between items-center">
                      <span className="text-[10px] font-bold tracking-widest text-text-secondary uppercase">本项目已保存基调库</span>
                      <button 
                        onClick={() => {
                          const newId = `manual-${Date.now()}`;
                          const newPreset: TonePreset = {
                            id: newId,
                            name: `自定义预设-${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
                            description: { zh: '', en: '', json: '' }
                          };
                          updateActiveProject({
                            tonePresets: [...(activeProject?.tonePresets || []), newPreset]
                          });
                          setEditingPreset({ projectId: activeProject.id, preset: newPreset });
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/30 text-brand-accent text-[9px] font-black rounded-lg transition-all"
                      >
                        <Plus className="w-3 h-3" /> 手动增加预设
                      </button>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs table-fixed">
                        <thead>
                          <tr className="border-b border-brand-border/50 text-text-secondary uppercase font-bold tracking-wider">
                            <th className="px-6 py-4 w-48">预设名称</th>
                            <th className="px-6 py-4">视觉特征提取摘要</th>
                            <th className="px-6 py-4 text-right w-32">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border/50">
                          {activeProject.tonePresets.map(preset => (
                            <tr key={preset.id} className="hover:bg-white/[0.01] transition-colors group">
                              <td className="px-6 py-4 font-bold text-brand-accent truncate">{preset.name}</td>
                              <td className="px-6 py-4 text-text-secondary truncate">{preset.description?.zh.substring(0, 100)}...</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-1">
                                  <button 
                                    onClick={() => handleDeletePreset(preset.id)}
                                    className="p-2 hover:bg-red-500/10 text-text-secondary hover:text-red-500 rounded-lg transition-all"
                                    title="删除预设"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setRenamingPreset({ projectId: activeProject.id, presetId: preset.id, name: preset.name });
                                      setNewName(preset.name);
                                    }}
                                    className="p-2 hover:bg-white/10 rounded text-text-secondary hover:text-brand-accent transition-all z-50"
                                    title="重命名预设"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => setEditingPreset({ projectId: activeProject.id, preset })}
                                    className="p-2 hover:bg-white/10 rounded text-text-secondary hover:text-brand-accent transition-all"
                                    title="修改预设内容"
                                  >
                                    <Settings className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      updateActiveProject({ 
                                        toneAnalysis: preset.description,
                                        pendingAudit: null
                                      });
                                      setAlertMessage(`已应用基调: ${preset.name}`);
                                    }} 
                                    className="p-2 hover:bg-white/10 rounded text-text-secondary hover:text-brand-accent transition-all" 
                                    title="应用此基调"
                                  >
                                     <Eye className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {activeProject.tonePresets.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-6 py-12 text-center text-text-secondary opacity-20 font-bold tracking-widest">暂无保存的预设内容</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'asset' && activeAssetTab === 'character' && (
              <motion.div
                key="character-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full h-full grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8"
              >
                {/* Inputs Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-brand-card rounded-2xl border border-brand-border p-6 space-y-4">
                     <div className="text-[10px] font-bold tracking-widest text-text-secondary uppercase">1. 输入角色描述</div>
                     {activeProject.extractedAssets?.characters && activeProject.extractedAssets.characters.length > 0 && (
                       <AssetGallery 
                         title="从剧本中提取的角色" 
                         assets={activeProject.extractedAssets.characters} 
                         icon={User}
                         onSelect={(val: string) => updateActiveProject({ characterInput: val })}
                       />
                     )}
                     <textarea 
                        value={activeProject.characterInput}
                        onChange={(e) => updateActiveProject({ characterInput: e.target.value })}
                        placeholder="例如：一位身穿唐代铠甲的女将军，眼神坚毅..."
                        className="w-full h-44 bg-brand-bg border border-brand-border rounded-xl p-4 text-sm focus:border-brand-accent outline-none resize-none transition-all scrollbar-hide"
                     />
                  </div>

                  <div className="bg-brand-card rounded-2xl border border-brand-border p-6 space-y-4">
                     <div className="text-[10px] font-bold tracking-widest text-text-secondary uppercase">2. 锁定视觉基调</div>
                     <div className="space-y-3">
                        {/* Current Analysis Option */}
                        <div className="space-y-2">
                           <div className="text-[9px] font-black text-text-secondary uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                              <div className={`w-1 h-1 rounded-full ${activeProject.selectedPresetId === 'live' || !activeProject.selectedPresetId ? 'bg-brand-accent animate-pulse' : 'bg-white/20'}`} />
                              实时会话捕获
                           </div>
                           <button 
                             onClick={() => {
                               if (activeProject.toneAnalysis) {
                                 updateActiveProject({ 
                                   toneAnalysis: { ...activeProject.toneAnalysis },
                                   selectedPresetId: 'live' 
                                 }); 
                               }
                             }}
                             className={`w-full px-5 py-4 rounded-xl border-2 text-left text-xs font-black transition-all group relative overflow-hidden ${
                               activeProject.selectedPresetId === 'live' || !activeProject.selectedPresetId
                                 ? 'border-brand-accent bg-brand-accent/20 text-brand-accent shadow-[0_0_25px_rgba(226,181,62,0.2)] ring-1 ring-brand-accent/50' 
                                 : 'border-white/5 bg-white/5 text-text-secondary opacity-40 hover:opacity-60'
                             }`}
                           >
                              <div className="flex justify-between items-center relative z-10">
                                 <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] opacity-50 uppercase tracking-tighter">实时会话</span>
                                    <span>{activeProject.toneAnalysis ? '已激活当前视频基调' : '未进行基调分析'}</span>
                                 </div>
                                 {(activeProject.selectedPresetId === 'live' || !activeProject.selectedPresetId) && activeProject.toneAnalysis && (
                                   <div className="flex items-center gap-2">
                                      <div className="p-1 px-2 bg-brand-accent text-black rounded font-black text-[9px]">已激活</div>
                                   </div>
                                 )}
                              </div>
                           </button>
                        </div>
                        
                        <div className="h-px bg-white/5 mx-2" />

                        {/* Presets List */}
                        {activeProject.tonePresets.map(p => {
                          const isSelected = activeProject.selectedPresetId === p.id;
                          return (
                            <div key={p.id} className="relative group/item">
                              <button 
                                onClick={() => updateActiveProject({ 
                                  toneAnalysis: p.description ? { ...p.description } : null,
                                  selectedPresetId: p.id
                                })}
                                className={`w-full px-5 py-5 rounded-xl border-2 text-left text-xs transition-all font-black group relative overflow-hidden ${
                                  isSelected 
                                    ? 'border-brand-accent bg-brand-accent/20 text-brand-accent shadow-[0_0_30px_rgba(226,181,62,0.3)] ring-1 ring-brand-accent/50 scale-[1.01]' 
                                    : 'border-white/5 bg-white/5 text-text-secondary hover:bg-white/10'
                                }`}
                              >
                                <div className="flex justify-between items-center relative z-10 pr-6">
                                  <div className="flex items-center gap-3">
                                     <div className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${isSelected ? 'border-brand-accent bg-brand-accent' : 'border-white/20 bg-transparent'}`} />
                                     <span className={isSelected ? 'text-white text-sm' : 'text-text-secondary'}>{p.name}</span>
                                  </div>
                                  {isSelected && (
                                     <div className="text-[9px] font-black bg-brand-accent text-black px-2 py-0.5 rounded tracking-widest">SELECTED</div>
                                  )}
                                </div>
                              </button>
                              
                              {p.id !== 'default-tone' && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePreset(p.id);
                                  }}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/20 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all z-20"
                                  title="删除此预设"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                     </div>
                  </div>

                  <button 
                    onClick={handleGenerateCharacterAssets}
                    disabled={loading || !activeProject.characterInput}
                    className="w-full py-4 bg-brand-accent text-black font-bold rounded-xl shadow-xl hover:brightness-110 active:scale-95 transition-all text-sm uppercase tracking-wider disabled:opacity-30 flex justify-center items-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    一键合成全套角色方案
                  </button>
                </div>

                <div className="lg:col-span-2 xl:col-span-3 gap-8 flex flex-col h-full">
                   <div className="flex-1 min-h-0 flex flex-col">
                       <TripleOutputCard 
                          title="角色剧照设计方案"
                          result={activeProject.characterStill}
                          onCopy={handleCopy}
                          onChange={(val: TripleResult) => updateActiveProject({ characterStill: val })}
                          loading={loading}
                          loadingText={loadingText}
                          onResetLoading={() => { setLoading(false); setLoadingText(null); }}
                       />
                   </div>

                   <div className="flex-1 min-h-0 flex flex-col">
                       <TripleOutputCard 
                          title="角色三视图技术规范" 
                          result={activeProject.characterThreeView} 
                          onCopy={handleCopy}
                          onChange={(val: TripleResult) => updateActiveProject({ characterThreeView: val })}
                          loading={loading}
                          loadingText={loadingText}
                          onResetLoading={() => { setLoading(false); setLoadingText(null); }}
                       />
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'asset' && activeAssetTab === 'scene' && (
              <motion.div
                key="scene-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full h-full grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8"
              >
                {/* Inputs Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-brand-card rounded-2xl border border-brand-border p-6 space-y-4">
                     <div className="text-[10px] font-bold tracking-widest text-text-secondary uppercase">1. 输入场景描述</div>
                     {activeProject.extractedAssets?.scenes && activeProject.extractedAssets.scenes.length > 0 && (
                       <AssetGallery 
                         title="从剧本中提取的场景" 
                         assets={activeProject.extractedAssets.scenes} 
                         icon={ImageIcon}
                         onSelect={(val: string) => updateActiveProject({ sceneInput: val })}
                       />
                     )}
                     <textarea 
                        value={activeProject.sceneInput}
                        onChange={(e) => updateActiveProject({ sceneInput: e.target.value })}
                        placeholder="描述场景的地理地貌、建筑形式、视觉重点..."
                        className="w-full h-44 bg-brand-bg border border-brand-border rounded-xl p-4 text-sm focus:border-brand-accent outline-none resize-none transition-all scrollbar-hide"
                     />
                  </div>

                  <div className="bg-brand-card rounded-2xl border border-brand-border p-6 space-y-4">
                     <div className="text-[10px] font-bold tracking-widest text-text-secondary uppercase">2. 锁定视觉基调</div>
                     {/* Reuse the same tone selection UI (could be a component but internalizing for now) */}
                     <div className="space-y-3">
                        <div className="space-y-2">
                           <div className="text-[9px] font-black text-text-secondary uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                              <div className={`w-1 h-1 rounded-full ${activeProject.selectedPresetId === 'live' || !activeProject.selectedPresetId ? 'bg-brand-accent animate-pulse' : 'bg-white/20'}`} />
                              实时会话捕获
                           </div>
                           <button 
                             onClick={() => {
                               if (activeProject.toneAnalysis) {
                                 updateActiveProject({ 
                                   toneAnalysis: { ...activeProject.toneAnalysis },
                                   selectedPresetId: 'live' 
                                 }); 
                               }
                             }}
                             className={`w-full px-5 py-4 rounded-xl border-2 text-left text-xs font-black transition-all group relative overflow-hidden ${
                               activeProject.selectedPresetId === 'live' || !activeProject.selectedPresetId
                                 ? 'border-brand-accent bg-brand-accent/20 text-brand-accent shadow-[0_0_25px_rgba(226,181,62,0.2)] ring-1 ring-brand-accent/50' 
                                 : 'border-white/5 bg-white/5 text-text-secondary opacity-40 hover:opacity-60'
                             }`}
                           >
                              <div className="flex justify-between items-center relative z-10">
                                 <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] opacity-50 uppercase tracking-tighter">实时会话</span>
                                    <span>{activeProject.toneAnalysis ? '已激活当前视频基调' : '未进行基调分析'}</span>
                                 </div>
                                 {(activeProject.selectedPresetId === 'live' || !activeProject.selectedPresetId) && activeProject.toneAnalysis && (
                                   <div className="flex items-center gap-2">
                                      <div className="p-1 px-2 bg-brand-accent text-black rounded font-black text-[9px]">已激活</div>
                                   </div>
                                 )}
                              </div>
                           </button>
                        </div>
                        <div className="h-px bg-white/5 mx-2" />
                        {activeProject.tonePresets.map(p => {
                          const isSelected = activeProject.selectedPresetId === p.id;
                          return (
                            <div key={p.id} className="relative group/item">
                              <button 
                                onClick={() => updateActiveProject({ 
                                  toneAnalysis: p.description ? { ...p.description } : null,
                                  selectedPresetId: p.id
                                })}
                                className={`w-full px-5 py-5 rounded-xl border-2 text-left text-xs transition-all font-black group relative overflow-hidden ${
                                  isSelected 
                                    ? 'border-brand-accent bg-brand-accent/20 text-brand-accent shadow-[0_0_30px_rgba(226,181,62,0.3)] ring-1 ring-brand-accent/50 scale-[1.01]' 
                                    : 'border-white/5 bg-white/5 text-text-secondary hover:bg-white/10'
                                }`}
                              >
                                <div className="flex justify-between items-center relative z-10 pr-6">
                                  <div className="flex items-center gap-3">
                                     <div className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${isSelected ? 'border-brand-accent bg-brand-accent' : 'border-white/20 bg-transparent'}`} />
                                     <span className={isSelected ? 'text-white text-sm' : 'text-text-secondary'}>{p.name}</span>
                                  </div>
                                  {isSelected && (
                                     <div className="text-[9px] font-black bg-brand-accent text-black px-2 py-0.5 rounded tracking-widest">SELECTED</div>
                                  )}
                                </div>
                              </button>
                            </div>
                          );
                        })}
                     </div>
                  </div>

                    <button 
                      onClick={handleGenerateScene}
                      disabled={loading || !activeProject.sceneInput}
                      className="w-full py-4 bg-brand-accent text-black font-bold rounded-xl shadow-xl hover:brightness-110 active:scale-95 transition-all text-sm uppercase tracking-wider disabled:opacity-30 flex justify-center items-center gap-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapIcon className="w-5 h-5" />}
                      一键合成场景提示词
                    </button>
                </div>

                <div className="lg:col-span-2 xl:col-span-3 gap-8 flex flex-col h-full">
                    <div className="flex-1 min-h-0 flex flex-col">
                        <TripleOutputCard 
                           title="场景视觉概念方案"
                           result={activeProject.sceneResult}
                           onCopy={handleCopy}
                           onChange={(val: TripleResult) => updateActiveProject({ sceneResult: val })}
                           loading={loading}
                           loadingText={loadingText}
                           onResetLoading={() => { setLoading(false); setLoadingText(null); }}
                        />
                    </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'script' && activeScriptTab === 'storyboard' && (
              <motion.div
                key="storyboard-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full flex flex-col"
              >
                  <PromptLab 
                    title="分镜图提示词生成"
                    presets={globalStoryboardPresets}
                    setPresets={setGlobalStoryboardPresets}
                    script={activeProject.storyboardInput}
                    setScript={(script) => updateActiveProject({ storyboardInput: script })}
                    result={activeProject.storyboardResult?.zh || ''}
                    setResult={(result) => updateActiveProject({ storyboardResult: { zh: result, en: '', json: '' } })}
                    placeholder="在此粘贴视频分镜脚本内容..."
                    generateAction={async (script, systemPrompt) => {
                        const result = await geminiService.generateRawContent(script, systemPrompt); 
                        return result;
                    }}
                  />
                  {/* ... Extract logic ... */}
              </motion.div>
            )}
            {activeTab === 'script' && activeScriptTab === 'video' && (
              <motion.div
                key="video-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full flex flex-col"
              >
                  <PromptLab 
                    title="视频脚本生成"
                    presets={globalVideoPresets}
                    setPresets={setGlobalVideoPresets}
                    script={activeProject.storyboardInput}
                    setScript={(script) => updateActiveProject({ storyboardInput: script })}
                    result={activeProject.storyboardResult?.zh || ''}
                    setResult={(result) => updateActiveProject({ storyboardResult: { zh: result, en: '', json: '' } })}
                    placeholder="在此粘贴剧本原文或题材描述..."
                    generateAction={async (script, systemPrompt) => {
                        const result = await geminiService.generateRawContent(script, systemPrompt);
                        return result;
                    }}
                  />
              </motion.div>
            )}

            {activeTab === 'safety' && (
              <motion.div
                key="safety-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col"
              >
                <FaceMaskTool />
              </motion.div>
            )}

            {activeTab === 'prompt' && (
              <motion.div
                key="prompt-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full h-full flex flex-col"
              >
                <div className="flex-1 bg-brand-sidebar/40 rounded-3xl border border-brand-border p-8 flex flex-col shadow-2xl relative">
                   <PromptLibrary setStatus={setAlertMessage} />
                </div>
              </motion.div>
            )}

            {activeTab === 'script' && activeScriptTab === 'asset_extract' && (
              <motion.div
                key="lab-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full flex flex-col"
              >
                <PromptLab 
                  title="美术资产提取"
                  presets={globalAssetExtractPresets}
                  setPresets={setGlobalAssetExtractPresets}
                  script={activeProject.assetExtractInput}
                  setScript={(script) => updateActiveProject({ assetExtractInput: script })}
                  result={activeProject.assetExtractResult}
                  setResult={(result) => updateActiveProject({ assetExtractResult: result })}
                  placeholder="在此粘贴剧本原文，AI 将自动分析提取人物、场景与道具资产细节..."
                  generateAction={async (script, systemPrompt) => {
                      const result = await geminiService.generateRawContent(script, systemPrompt);
                      return result;
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="h-10 px-8 border-t border-brand-border bg-brand-sidebar flex items-center justify-between text-[9px] text-text-secondary uppercase tracking-[0.2em] font-bold">
           <div className="flex gap-10">
              <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-green-500" /> 项目数据同步已就绪</span>
              <span>工作空间: 影视资产创意实验室 v5.0</span>
           </div>
           <div className="flex gap-6">
               <span>2026 智能影视资产生产管线</span>
           </div>
        </footer>
      </main>
      
      {/* Modals Container */}
      <AnimatePresence>
        {/* Project Rename Modal */}
        {renamingProject && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-brand-card border border-brand-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
             >
                <div className="flex justify-between items-center">
                   <h3 className="font-bold text-[10px] uppercase tracking-widest text-brand-accent">重新命名项目</h3>
                   <button onClick={() => setRenamingProject(null)} className="text-text-secondary hover:text-white p-1"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] text-text-secondary uppercase font-bold tracking-tighter">新名称</label>
                   <input 
                     autoFocus
                     value={newName}
                     onChange={(e) => setNewName(e.target.value)}
                     className="w-full bg-brand-bg border border-brand-border rounded-lg p-3 text-sm focus:border-brand-accent outline-none text-white"
                   />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                   <button onClick={() => setRenamingProject(null)} className="px-5 py-2 text-[10px] font-bold text-text-secondary hover:text-white uppercase">取消</button>
                   <button 
                     onClick={() => {
                       if (newName.trim()) {
                         setProjects(prev => prev.map(p => p.id === renamingProject.id ? { ...p, name: newName.trim() } : p));
                       }
                       setRenamingProject(null);
                     }}
                     className="px-6 py-2 bg-brand-accent text-black text-[10px] font-bold rounded-lg hover:brightness-110 uppercase tracking-widest"
                   >
                     确认修改
                   </button>
                </div>
             </motion.div>
          </div>
        )}

        {/* Preset Rename Modal */}
        {renamingPreset && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-brand-card border border-brand-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
             >
                <div className="flex justify-between items-center">
                   <h3 className="font-bold text-[10px] uppercase tracking-widest text-brand-accent">重新命名基调预设</h3>
                   <button onClick={() => setRenamingPreset(null)} className="text-text-secondary hover:text-white p-1"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] text-text-secondary uppercase font-bold tracking-tighter">新预设名称</label>
                   <input 
                     autoFocus
                     value={newName}
                     onChange={(e) => setNewName(e.target.value)}
                     className="w-full bg-brand-bg border border-brand-border rounded-lg p-3 text-sm focus:border-brand-accent outline-none text-white"
                   />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                   <button onClick={() => setRenamingPreset(null)} className="px-5 py-2 text-[10px] font-bold text-text-secondary hover:text-white uppercase">取消</button>
                   <button 
                     onClick={() => {
                        if (newName.trim() && activeProject) {
                           updateActiveProject({
                             tonePresets: activeProject.tonePresets.map(p => p.id === renamingPreset.presetId ? { ...p, name: newName.trim() } : p)
                           });
                        }
                        setRenamingPreset(null);
                     }}
                     className="px-6 py-2 bg-brand-accent text-black text-[10px] font-bold rounded-lg hover:brightness-110 uppercase tracking-widest"
                   >
                     确认修改
                   </button>
                </div>
             </motion.div>
          </div>
        )}

        {/* Worldview Preset Manager Modal */}
        {showContextManager && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-brand-card border border-brand-border rounded-3xl p-8 w-full max-w-2xl space-y-8 my-auto shadow-[0_0_100px_rgba(0,0,0,0.8)] relative"
             >
                <div className="flex justify-between items-center">
                   <div className="space-y-1">
                      <h3 className="font-black text-[12px] uppercase tracking-[0.3em] text-brand-accent flex items-center gap-3">
                         <ShieldCheck className="w-5 h-5" />
                         项目世界观预设管理
                      </h3>
                      <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest pl-8 opacity-60">管理跨项目的视觉叙事底色</p>
                   </div>
                   <button onClick={() => { setShowContextManager(false); setEditingContext(null); }} className="p-2 hover:bg-white/5 rounded-full transition-all text-text-secondary"><X className="w-5 h-5" /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {/* Left Col: Preset List */}
                   <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                         <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">所有预设库</span>
                         <button 
                           onClick={() => setEditingContext({ id: `ctx-${Date.now()}`, name: '', description: '' })}
                           className="text-[9px] font-black text-brand-accent hover:brightness-125 transition-all uppercase flex items-center gap-1"
                         >
                            <Plus className="w-3 h-3" /> 新建预设
                         </button>
                      </div>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                         {worldviewPresets.map(preset => (
                            <div 
                               key={preset.id} 
                               className={`group p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                  editingContext?.id === preset.id 
                                     ? 'bg-brand-accent/5 border-brand-accent/30' 
                                     : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                               }`}
                               onClick={() => setEditingContext(preset)}
                            >
                               <div className="space-y-1">
                                  <div className="text-xs font-bold text-white group-hover:text-brand-accent transition-colors">{preset.name}</div>
                                  <div className="text-[9px] text-text-secondary line-clamp-1 max-w-[180px]">{preset.description}</div>
                                </div>
                               <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                  <button 
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       setWorldviewPresets(prev => prev.filter(p => p.id !== preset.id));
                                       if (editingContext?.id === preset.id) setEditingContext(null);
                                    }}
                                    className="p-1.5 hover:text-red-400 transition-colors"
                                  >
                                     <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>

                   {/* Right Col: Editor */}
                   <div className="bg-black/20 rounded-3xl p-6 border border-white/5 space-y-6">
                      {editingContext ? (
                         <div className="space-y-6">
                            <div className="space-y-2">
                               <label className="text-[10px] text-text-secondary uppercase font-black px-1">预设标签名称</label>
                               <input 
                                 value={editingContext.name}
                                 onChange={(e) => setEditingContext({ ...editingContext, name: e.target.value })}
                                 placeholder="如：商周玄幻风格"
                                 className="w-full bg-brand-bg border border-brand-border rounded-xl p-4 text-sm focus:border-brand-accent outline-none text-white transition-all shadow-inner"
                               />
                            </div>
                            <div className="space-y-2">
                               <label className="text-[10px] text-text-secondary uppercase font-black px-1">规则详细描述 (AI 理解底色)</label>
                               <textarea 
                                 value={editingContext.description}
                                 onChange={(e) => setEditingContext({ ...editingContext, description: e.target.value })}
                                 placeholder="尽可能详细地描述该世界观下的建筑细节、文化符号、光影特质等..."
                                 rows={8}
                                 className="w-full bg-brand-bg border border-brand-border rounded-xl p-4 text-xs focus:border-brand-accent outline-none text-text-secondary transition-all resize-none leading-relaxed custom-scrollbar"
                               />
                            </div>
                            <button 
                              onClick={() => {
                                 if (!editingContext.name.trim()) return;
                                 setWorldviewPresets(prev => {
                                    const exists = prev.find(p => p.id === editingContext.id);
                                    if (exists) {
                                       return prev.map(p => p.id === editingContext.id ? editingContext : p);
                                    }
                                    return [...prev, editingContext];
                                 });
                                 setAlertMessage(`已保存预设: ${editingContext.name}`);
                              }}
                              className="w-full py-4 bg-brand-accent text-black text-[10px] font-black rounded-xl hover:opacity-90 transition-all uppercase tracking-[0.2em] shadow-lg shadow-brand-accent/20"
                            >
                               保存当前配置
                            </button>
                         </div>
                      ) : (
                         <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 py-12">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                               <Plus className="w-8 h-8" />
                            </div>
                            <p className="text-[11px] font-bold tracking-widest uppercase">请选择预览或点击新建</p>
                         </div>
                      )}
                   </div>
                </div>
             </motion.div>
          </div>
        )}

        {/* Preset Content Editor Modal */}
        {editingPreset && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 20 }}
               className="bg-brand-card border border-brand-border rounded-2xl p-0 w-full max-w-5xl shadow-[0_0_100px_rgba(226,181,62,0.1)] flex flex-col max-h-[90vh] overflow-hidden"
             >
                <div className="p-8 border-b border-brand-border flex justify-between items-center bg-white/[0.02]">
                   <div>
                     <h3 className="font-bold text-lg text-brand-accent">编辑预设内容规格</h3>
                     <p className="text-[10px] text-text-secondary uppercase tracking-widest mt-1">Preset: {editingPreset.preset.name}</p>
                   </div>
                   <button onClick={() => setEditingPreset(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all text-text-secondary hover:text-white">
                      <X className="w-5 h-5" />
                   </button>
                </div>
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1 flex flex-col min-h-0">
                   <div className="flex-1 min-h-[520px] flex flex-col">
                      <TripleOutputCard 
                        title="核心视觉基调参数 (支持即时同步)"
                        result={editingPreset.preset.description}
                        onCopy={handleCopy}
                        onChange={(newDesc: TripleResult) => {
                          const updatedPreset = { ...editingPreset.preset, description: newDesc };
                          setEditingPreset({ ...editingPreset, preset: updatedPreset });
                          if (activeProject) {
                             const updates: Partial<Project> = {
                               tonePresets: activeProject.tonePresets.map(p => p.id === editingPreset.preset.id ? updatedPreset : p)
                             };
                             // If the edited preset is currently selected, keep current analysis in sync
                             if (activeProject.selectedPresetId === editingPreset.preset.id) {
                               updates.toneAnalysis = newDesc;
                             }
                             updateActiveProject(updates);
                          }
                        }}
                      />
                   </div>
                </div>
                <div className="p-8 border-t border-brand-border flex justify-between items-center bg-white/[0.02]">
                   <span className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">
                     修改将实时同步至本项目基调库
                   </span>
                   <button 
                     onClick={() => setEditingPreset(null)}
                     className="px-10 py-3 bg-brand-accent text-black text-xs font-bold rounded-lg hover:brightness-110 shadow-lg transition-all"
                   >
                     保存并关闭
                   </button>
                </div>
             </motion.div>
          </div>
        )}
        
        {/* Confirm Modal */}
        {confirmData && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-brand-card border border-brand-border p-8 rounded-2xl max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">{confirmData.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{confirmData.message}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmData(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={confirmData.onConfirm}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-500/20"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* API Settings Modal */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-brand-card border border-brand-border p-8 rounded-2xl max-w-md w-full shadow-2xl space-y-6"
            >
              <div className="space-y-2 text-center">
                <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                  <Settings className="w-5 h-5 text-brand-accent" />
                  模型与 API 设置
                </h3>
                <p className="text-[11px] text-text-secondary leading-relaxed max-w-[280px] mx-auto">
                  此平台已内置可免费调用的 Gemini 1.5/2.5 系列模型，遇到异常时会自动顺延使用次一级模型。
                </p>
              </div>

              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-secondary uppercase">如果遇到请求报错，需要平台系统级切换可以</label>
                    <button 
                      onClick={() => {
                        setShowSettingsModal(false);
                        if (typeof window !== 'undefined' && 'aistudio' in window) {
                          (window as any).aistudio.openSelectKey();
                        } else {
                          setAlertMessage("当前环境不支持呼出平台 API 面板");
                        }
                      }}
                      className="w-full py-3 bg-brand-sidebar border border-brand-border hover:bg-white/5 text-xs font-bold text-white rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Layers className="w-4 h-4 text-brand-accent" />
                      呼出平台 API 设置面板
                    </button>
                    <p className="text-[9px] text-white/30 text-center">在这里你也可以选择填入你在 Google AI Studio 的 Gemini 模型 API 密钥</p>
                 </div>

                 <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-brand-border/50"></div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-secondary uppercase">自定义其它模型的 API Key</label>
                    <input 
                      type="password"
                      placeholder="填入您的自定义 API Key (空则使用默认)"
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      className="w-full bg-black/40 border border-brand-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 transition-all font-mono"
                    />
                 </div>

                 <div className="relative flex py-4 items-center">
                    <div className="flex-grow border-t border-brand-border/50"></div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-secondary uppercase">本地数据与备份</label>
                    <div className="flex gap-2">
                      <button 
                         onClick={() => {
                           setShowSettingsModal(false);
                           fileInputRef.current?.click();
                         }} 
                         className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                      >
                         <Upload className="w-4 h-4" />
                         导入项目数据
                      </button>
                      <button 
                         onClick={() => {
                           setShowSettingsModal(false);
                           handleExportData();
                         }} 
                         className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                      >
                         <FileJson className="w-4 h-4" />
                         导出项目数据
                      </button>
                    </div>
                    <p className="text-[9px] text-white/30 text-center">提示词预设已自动同步至云端，导出仅包含所有独立项目的脚本内容与进度</p>
                    <input 
                      type="file" 
                      accept="application/json" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleImportData} 
                    />
                 </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    if (customApiKey.trim()) {
                      localStorage.setItem('CUSTOM_GEMINI_API_KEY', customApiKey.trim());
                    } else {
                      localStorage.removeItem('CUSTOM_GEMINI_API_KEY');
                    }
                    setShowSettingsModal(false);
                    setAlertMessage("设置已保存！将重新加载系统以生效。");
                    setTimeout(() => window.location.reload(), 1500);
                  }}
                  className="flex-1 py-3 bg-brand-accent text-black rounded-xl text-xs font-bold hover:brightness-110 transition-all"
                >
                  保存并刷新
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Alert Modal */}
        {alertMessage && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-brand-card border border-brand-border p-8 rounded-2xl max-w-sm w-full shadow-2xl space-y-6 text-center"
            >
              <div className="w-12 h-12 bg-brand-accent/10 rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6 text-brand-accent" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">操作提示</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{alertMessage}</p>
              </div>
              <button 
                onClick={() => setAlertMessage(null)}
                className="w-full py-3 bg-brand-accent text-black rounded-xl text-xs font-bold hover:brightness-110 transition-all"
              >
                我知道了
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

function DiffViewer({ original, audited, inlineOnly = false }: { original: string, audited: string, inlineOnly?: boolean }) {
  // If we are inline (inside markdown components), comparing full sources is bad.
  // We'll try to find the specific field or paragraph in the original source, 
  // but that's very brittle. 
  // Let's just diff the audited value itself against "something".
  // Actually, the most robust way is to just show what was added/changed in the audited version
  // if we can't perfectly align.
  
  // Real implementation of local diffing:
  const diff = diffWordsWithSpace(original && !inlineOnly ? original : "", audited);
  
  const Tag = inlineOnly ? "span" : "div";
  
  return (
    <Tag className={inlineOnly ? "inline" : "whitespace-pre-wrap font-sans text-[12px] leading-relaxed"}>
      {diffWordsWithSpace(original || "", audited).map((part, index) => {
        if (part.added) {
          return <span key={index} className="text-red-500 font-bold bg-red-500/10 px-0.5 rounded underline decoration-red-500/30 underline-offset-2">{part.value}</span>;
        }
        if (part.removed && !inlineOnly) {
          return <span key={index} className="text-gray-600 line-through opacity-50">{part.value}</span>;
        }
        if (part.removed && inlineOnly) return null;
        return <span key={index} className={inlineOnly ? "" : "text-gray-400"}>{part.value}</span>;
      })}
    </Tag>
  );
}

// --- Triple Output Component ---

function TripleOutputCard({ 
  title, 
  result, 
  onCopy, 
  loading, 
  onSavePreset, 
  isMarkdown, 
  onChange, 
  singleTab, 
  isStoryboard, 
  loadingText,
  onVerify,
  onResetLoading,
  pendingAudit,
  onApplyAudit,
  onDiscardAudit
}: any) {
  const [activeTab, setActiveTab] = useState<'zh' | 'en' | 'json'>('zh');
  const [viewMode, setViewMode] = useState<'original' | 'audited'>('original');

  useEffect(() => {
    if (pendingAudit) {
      setViewMode('audited');
    } else {
      setViewMode('original');
    }
  }, [pendingAudit]);

  // if (!result && !loading) return null; // Removed to allow showing placeholder boxes

  const content = (result && result[activeTab]) || "";
  const auditContent = (pendingAudit?.result?.[activeTab]) || "";

  // Custom components for Markdown to give it a "card" look
  const getMarkdownComponents = (isAudited: boolean = false, originalSource: string = "") => {
    // Utility to find original field content for comparison
    const getOriginalField = (label: string) => {
      if (!originalSource) return "";
      const lines = originalSource.split('\n');
      const line = lines.find(l => l.toLowerCase().includes(label.toLowerCase()));
      if (!line) return "";
      const parts = line.split(/[:：]/);
      return parts.slice(1).join(':').trim();
    };

    return isStoryboard && isMarkdown && activeTab === 'zh' ? {
      h1: ({ children }: any) => (
        <div className="flex items-center gap-2 mb-8 group">
          <div className={`p-2 rounded-lg ${isAudited ? 'bg-brand-accent/20 text-brand-accent' : 'bg-cyan-500/20 text-cyan-400'}`}>
            <Clapperboard className="w-4 h-4" />
          </div>
          <h1 className={`text-sm font-black uppercase tracking-[0.3em] !my-0 ${isAudited ? 'text-brand-accent' : 'text-cyan-400'}`}>{children}</h1>
        </div>
      ),
      h2: ({ children }: any) => {
        const text = Array.isArray(children) ? children.join('') : String(children);
        if (text.startsWith('片段')) {
          const parts = text.split('时长');
          return (
            <div className={`mt-10 mb-4 px-4 py-2.5 rounded-xl border flex justify-between items-center group transition-all ${isAudited ? 'bg-brand-accent/5 border-brand-accent/20' : 'bg-white/[0.03] border-white/5'}`}>
              <h2 className="text-sm font-bold text-white/90 !my-0 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isAudited ? 'bg-brand-accent' : 'bg-cyan-400'}`} />
                {parts[0]}
              </h2>
              {parts[1] && (
                 <div className="flex items-center gap-2">
                   <span className="text-[9px] text-text-secondary font-black uppercase tracking-widest opacity-50">Duration</span>
                   <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${isAudited ? 'bg-brand-accent text-black' : 'bg-white/10 text-white'}`}>
                     {parts[1].replace(/[:：]/, '').trim()}
                   </span>
                 </div>
              )}
            </div>
          );
        }
        return <h2 className="mt-10 mb-4 text-sm font-bold text-white/90 !my-0">{children}</h2>;
      },
      h3: ({ children }: any) => (
        <div className="mt-6 mb-3 flex items-center gap-2">
          <div className={`w-1 h-3 rounded-full ${isAudited ? 'bg-brand-accent' : 'bg-gray-600'}`} />
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider !my-0">{children}</h3>
        </div>
      ),
      ul: ({ children }: any) => {
        return <ul className="mb-6 space-y-2 !mt-0 list-none">{children}</ul>;
      },
      li: ({ children }: any) => {
        const contentStr = String(children);
        const match = contentStr.match(/^(.*?)[:：](.*)$/);
        if (match) {
          const label = match[1].trim();
          const value = match[2].trim();
          const isCritical = label.includes('台词') || label.includes('角色');
          
          return (
            <li className="flex gap-3 text-[12px] leading-relaxed group py-0.5">
              <span className={`text-[10px] opacity-30 mt-1 select-none ${isAudited ? 'text-brand-accent' : 'text-white'}`}>•</span>
              <span className={`font-bold transition-all whitespace-nowrap min-w-[70px] ${isAudited ? 'text-brand-accent/80' : 'text-gray-400'}`}>
                {label}
              </span>
              <div className={`transition-colors flex-1 ${isAudited ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-300'}`}>
                {isAudited ? (
                   <DiffViewer original={getOriginalField(label)} audited={value} inlineOnly />
                ) : (
                  <span className={isCritical ? 'text-gray-300' : ''}>{value}</span>
                )}
              </div>
            </li>
          );
        }
        return (
          <li className="flex gap-3 text-[12px] text-gray-500 leading-relaxed !ml-0 py-0.5">
            <span className="text-gray-400 opacity-30 select-none">•</span>
            <div className="flex-1">
               {children}
            </div>
          </li>
        );
      },
      p: ({ children }: any) => {
         const text = Array.isArray(children) ? children.join('') : String(children);
         // Check for "Summary" or "Highlights" patterns
         if (text.startsWith('内容梗概') || text.startsWith('剧本阐述') || text.startsWith('旁白音色') || text.startsWith('描述：') || text.match(/^亮点\d/)) {
           const parts = text.split(/[:：]/);
           const label = parts[0];
           const value = parts.slice(1).join(':').trim();
           return (
             <div className={`p-4 rounded-xl border mb-6 transition-all ${isAudited ? 'bg-brand-accent/5 border-brand-accent/10' : 'bg-white/[0.02] border-white/5'}`}>
               <span className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${isAudited ? 'text-brand-accent' : 'text-gray-500'}`}>{label}</span>
               <div className={`text-[12px] leading-relaxed font-medium !my-0 ${isAudited ? 'text-gray-200' : 'text-gray-400'}`}>
                  {isAudited ? <DiffViewer original={getOriginalField(label)} audited={value} inlineOnly /> : value}
               </div>
             </div>
           );
         }
         return <div className={`mb-6 text-[12px] leading-relaxed font-medium ${isAudited ? 'text-gray-300' : 'text-gray-500'}`}>
           {children}
         </div>;
      }
    } : {};
  };

  // Helper to render dual column or single
  const renderContent = (text: string, isAudited: boolean = false) => {
    const components = getMarkdownComponents(isAudited, content);
    
    // Safety check: sometimes AI outputs literal "\n" strings instead of actual newline characters
    const processedText = text.replace(/\\n/g, '\n');

    if (isMarkdown && activeTab === 'zh' && isStoryboard) {
       return (
         <div className={`flex-1 overflow-y-auto p-6 custom-scrollbar max-w-none break-words ${isAudited ? 'bg-brand-sidebar/40 shadow-inner' : 'bg-brand-sidebar/10'}`}>
           <Markdown components={components}>{processedText}</Markdown>
         </div>
       );
    }

    if (isMarkdown && activeTab === 'zh') {
      return (
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
          {processedText.split('\n').map((line, idx) => {
             if (!line.trim()) return <div key={idx} className="h-1" />;
             
             // Detect nanobanana section
             if (line.includes('[nanobanana 中文复刻提示词]')) {
                return (
                  <div key={idx} className="mt-8 mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
                    <h4 className="text-xs font-bold uppercase tracking-widest text-brand-accent">智能体方案输出</h4>
                  </div>
                );
             }

             const parts = line.split(/[：:]/);
             if (parts.length >= 2 && !line.startsWith('[') && !line.startsWith('-')) {
               const isBanana = processedText.includes('[nanobanana');
               return (
                 <div key={idx} className={`flex gap-4 text-[12px] leading-relaxed ${isBanana ? 'bg-white/[0.03] p-4 rounded-xl border border-white/5' : ''}`}>
                   <span className="text-brand-accent/70 font-black uppercase tracking-tighter shrink-0 min-w-[90px] text-left">{parts[0]}：</span>
                   <span className="text-gray-200 font-medium flex-1 whitespace-pre-wrap">{parts.slice(1).join('：')}</span>
                 </div>
               );
             }

             if (line.startsWith('[')) {
                return (
                  <div key={idx} className="pt-4 pb-1 flex items-center gap-3">
                    <div className="w-1 h-3 rounded-full bg-brand-accent" />
                    <h4 className="text-xs font-bold uppercase tracking-wider !my-0 text-brand-accent">{line.replace(/[\[\]]/g, '')}</h4>
                  </div>
                );
             }

             return (
               <p key={idx} className="text-[12px] leading-relaxed text-gray-400 whitespace-pre-wrap ml-[104px]">
                 {line}
               </p>
             );
          })}
        </div>
      );
    }

    return (
      <textarea 
        value={processedText}
        onChange={(e) => !isAudited && onChange && result && onChange({ ...result, [activeTab]: e.target.value })}
        readOnly={isAudited}
        placeholder={isAudited ? "等待专家修正输出..." : "在此编辑结果..."}
        className={`flex-1 w-full h-full p-8 bg-transparent border-none outline-none resize-none text-sm leading-relaxed text-gray-300 font-sans custom-scrollbar ${activeTab === 'json' ? 'font-mono text-xs' : ''} whitespace-pre-wrap break-words`}
      />
    );
  };

  return (
    <div className="bg-brand-card rounded-2xl border border-brand-border flex flex-col card-shadow shadow-2xl overflow-hidden h-full">
      <div className="px-6 py-4 border-b border-brand-border bg-white/[0.02] flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{title}</span>
            {!singleTab && (
              <div className="flex bg-black/40 p-1 rounded-lg">
                  <button 
                    onClick={() => setActiveTab('zh')}
                    className={`px-3 py-1 rounded-md text-[9px] font-bold transition-all flex items-center gap-1.5 ${activeTab === 'zh' ? 'bg-brand-accent text-black shadow-inner' : 'text-text-secondary hover:text-white'}`}
                  >
                    <Languages className="w-3 h-3" /> 中文
                  </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
             {onVerify && !pendingAudit && !loading && (
                <button 
                  onClick={onVerify}
                  className="px-4 py-1.5 bg-brand-accent/10 border border-brand-accent/30 text-brand-accent text-[9px] font-black rounded-lg hover:bg-brand-accent hover:text-black transition-all uppercase tracking-widest flex items-center gap-2"
                >
                  <ShieldCheck className="w-3 h-3" />
                  专家级深度分析
                </button>
             )}
             {onSavePreset && result && (
               <button 
                 onClick={onSavePreset}
                 className="flex items-center gap-1.5 text-[9px] font-bold text-brand-accent hover:underline"
               >
                 <Bookmark className="w-3 h-3" /> 保存预设
               </button>
             )}
             {result && (
                <button 
                  onClick={() => onCopy(content, `copy-${activeTab}`)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-brand-accent transition-all group"
                  title="复制当前内容"
                >
                  <Copy className="w-4 h-4 group-active:scale-90" />
                </button>
             )}
          </div>
        </div>

        {pendingAudit && (
           <motion.div 
             initial={{ opacity: 0, height: 0 }}
             animate={{ opacity: 1, height: 'auto' }}
             className="border border-brand-accent/30 bg-brand-accent/5 rounded-xl p-4 space-y-4"
           >
              <div className="flex justify-between items-center border-b border-brand-accent/10 pb-3">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-accent text-black rounded-full flex items-center justify-center font-black text-xs">
                       {pendingAudit.score}
                    </div>
                    <div>
                       <h5 className="text-[10px] font-bold text-white uppercase tracking-wider">专家校审评分</h5>
                       <p className="text-[9px] text-text-secondary uppercase">建议应用此深度修正方案</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2 bg-black/30 p-1 rounded-lg">
                    <button 
                       onClick={() => setViewMode('original')}
                       className={`px-3 py-1.5 rounded-md text-[9px] font-bold transition-all ${viewMode === 'original' ? 'bg-white/10 text-white' : 'text-text-secondary'}`}
                    >
                       原版内容
                    </button>
                    <button 
                       onClick={() => setViewMode('audited')}
                       className={`px-3 py-1.5 rounded-md text-[9px] font-bold transition-all ${viewMode === 'audited' ? 'bg-brand-accent text-black' : 'text-text-secondary'}`}
                    >
                       修正预览
                    </button>
                 </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                 <div className="space-y-1 max-w-lg">
                    <span className="text-[9px] font-black text-brand-accent uppercase tracking-widest">编审修改意见</span>
                    <p className="text-[11px] text-text-secondary leading-relaxed italic">"{pendingAudit.suggestions}"</p>
                 </div>
                 <div className="flex justify-end gap-3 shrink-0 pt-2">
                    <button 
                      onClick={onDiscardAudit}
                      className="px-4 py-2 text-[9px] font-black text-text-secondary hover:text-red-400 uppercase tracking-widest"
                    >
                      废弃方案
                    </button>
                    <button 
                      onClick={onApplyAudit}
                      className="px-6 py-2 bg-brand-accent text-black text-[9px] font-black rounded-lg hover:opacity-90 transition-all uppercase tracking-widest"
                    >
                      应用修正并替换
                    </button>
                 </div>
              </div>
           </motion.div>
        )}
      </div>
      
      <div className="flex-1 bg-black/10 overflow-hidden relative flex flex-col min-h-[400px]">
        {!result && !loading ? (
          <div className="flex-1 border border-dashed border-brand-border/40 rounded-xl flex flex-col items-center justify-center text-center m-6 p-8 space-y-3 opacity-60">
            <div className="p-4 bg-brand-accent/5 rounded-full">
               <ScanSearch className="w-8 h-8 text-brand-accent/40" />
            </div>
            <div className="space-y-1">
               <p className="text-[10px] uppercase font-bold tracking-tighter text-white">等待分析指令</p>
               <p className="text-[9px] text-text-secondary">上传剧照或场景后，此处将呈现视觉特征提取方案</p>
            </div>
          </div>
        ) : loading && !result ? (
           <div className="flex-1 flex flex-col items-center justify-center gap-5 px-10 text-center">
              <div className="relative">
                <Loader2 className="w-10 h-10 animate-spin text-brand-accent/40" />
                <Loader2 className="w-10 h-10 animate-spin text-brand-accent absolute inset-0 blur-[2px] opacity-50" />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="block text-[11px] font-black tracking-[0.3em] uppercase text-white/90">智能分析中</span>
                  <span className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest max-w-xs leading-relaxed animate-pulse">
                    {loadingText || "正在构建智能资源..."}
                  </span>
                </div>
                <button 
                  onClick={onResetLoading}
                  className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-lg text-[9px] font-bold text-text-secondary uppercase tracking-widest transition-all"
                >
                  强制重置状态
                </button>
              </div>
           </div>
        ) : (
          <div className="flex-1 overflow-hidden w-full flex flex-row h-full divide-x divide-white/5 relative">
             {loading && result && (
                <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                   <div className="bg-black/60 border border-white/10 px-6 py-4 rounded-2xl flex items-center gap-4 shadow-2xl animate-in fade-in zoom-in duration-300">
                      <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
                      <div className="flex flex-col">
                         <span className="text-[10px] font-black uppercase tracking-widest text-white">
                           {loadingText?.includes('编审') || loadingText?.includes('审查') ? '正在进行深度专家校审' : '正在更新方案内容'}
                         </span>
                         <span className="text-[9px] text-brand-accent/80 font-bold uppercase tracking-tighter">
                           {loadingText || '请稍等，AI 正在为您全力处理中...'}
                         </span>
                      </div>
                   </div>
                </div>
             )}
             
             {/* Left Column: Original */}
             <div className={`flex-1 flex flex-col flex-shrink-0 min-w-0 transition-all ${pendingAudit ? 'w-1/2' : 'w-full'}`}>
                {pendingAudit && (
                   <div className="px-6 py-2 bg-white/[0.02] border-b border-brand-border flex items-center justify-between">
                      <span className="text-[9px] font-black text-gray-500 uppercase flex items-center gap-2"><History className="w-3 h-3" /> 原始分析稿</span>
                      {viewMode === 'original' && <span className="text-[8px] bg-white/10 px-2 py-0.5 rounded text-white font-black uppercase">查看中</span>}
                   </div>
                )}
                {renderContent(content, false)}
             </div>

             {/* Right Column: Audited (Horizontal Comparison) */}
             {pendingAudit && (
                <div className="flex-1 flex flex-col flex-shrink-0 min-w-0 bg-brand-accent/5">
                   <div className="px-6 py-2 bg-brand-accent/10 border-b border-brand-accent/20 flex items-center justify-between">
                      <span className="text-[9px] font-black text-brand-accent uppercase flex items-center gap-2"><ShieldCheck className="w-3 h-3" /> 专家修正稿</span>
                      <div className="flex items-center gap-2">
                         <div className="w-6 h-6 bg-brand-accent text-black rounded-full flex items-center justify-center font-black text-[9px]">{pendingAudit.score}</div>
                         <span className="text-[9px] font-black text-brand-accent uppercase">差异标注显现</span>
                      </div>
                   </div>
                   <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                      {isMarkdown && activeTab === 'zh' && isStoryboard ? (
                         <Markdown components={getMarkdownComponents(true, content)}>{auditContent}</Markdown>
                      ) : (
                         <DiffViewer original={content} audited={auditContent} />
                      )}
                   </div>
                </div>
             )}
          </div>
        )}
      </div>
      
      {result && (
        <div className="px-6 py-3 border-t border-brand-border/50 bg-white/[0.01] flex justify-between items-center">
           <div className="text-[8px] text-text-secondary uppercase tracking-widest font-bold">
              渲染格式: {activeTab.toUpperCase()} | 字符数: {content.length} | 支持直接编辑
           </div>
           <button 
             onClick={() => onCopy(content, `copy-btn-${activeTab}`)}
             className="text-[9px] font-bold text-brand-accent tracking-[0.2em] flex items-center gap-2 hover:brightness-125 transition-all uppercase"
           >
             复制该版本内容
             <ChevronRight className="w-3 h-3" />
           </button>
        </div>
      )}
    </div>
  );
}

const AssetGallery = ({ title, assets, onSelect, icon: Icon }: any) => {
  if (!assets || assets.length === 0) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Icon className="w-4 h-4 text-brand-accent" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{title}</span>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {assets.map((asset: string, idx: number) => (
          <button
            key={idx}
            onClick={() => onSelect(asset)}
            className="group relative bg-white/[0.03] border border-brand-border px-5 py-4 rounded-2xl text-left hover:bg-white/[0.08] hover:border-brand-accent/50 transition-all active:scale-[0.98] card-shadow"
          >
            <p className="text-[11px] text-text-secondary group-hover:text-white line-clamp-2 leading-relaxed font-medium">
              {asset}
            </p>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all">
              <Plus className="w-4 h-4 text-brand-accent" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
