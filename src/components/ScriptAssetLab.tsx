import React, { useState, useEffect, useMemo } from 'react';
import { Beaker, Send, Loader2, Copy, Trash2, Sparkles, AlertCircle, CheckCircle2, Layout, Settings, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
import confetti from 'canvas-confetti';
import { GoogleGenAI } from '@google/genai';

const DEFAULT_PRESETS = [
  {
    id: 'char-art',
    name: '美术资产提取 (人/景/物)',
    prompt: `# Role (角色设定)
你是一位顶级的“影视世界观架构师兼资深美术指导”。精通角色设计、场景搭建、道具设定以及视觉化呈现。

# Task (任务目标)
仔细阅读剧本，提取并构建【全维度视觉资产设定库】，直接用于 AI 绘图引擎或 3D 建模。

# Core Rules (核心规则)
1. **【推理补充】强制打标**：对剧本未明确但视觉化必需的细节（如材质、骨相、光影），基于人设进行极致脑补并在句末加 \`【推理补充】\` 标签。
2. **结构完整**：严格按《资产模板》输出。没有的资产输出“暂无”。
3. **视觉描述**：必须使用具象的视觉语言（如“哑光黑铁质感”），禁用抽象词汇。

# Template (资产模板)
请严格使用以下 Markdown 格式输出（使用 ### 作为大类标题，使用 #### 作为每一个输出资产的唯一标题卡片）：

### 一、人物资产提取
#### 1. [人物姓名] ([英文/代号])
- **身份**：[剧本设定]
- **年纪**：[生理年龄]，[视觉气场]
- **脸型五官**：[骨相特征及肤色，眉眼鼻唇耳细节]
- **妆发特征**：[发型/妆容/伤疤印记]
- **服饰鞋履**：[上下装/鞋袜配饰的款式材质颜色]
- **核心气质**：[3-4个概括词]

### 二、场景资产提取
#### 1. [场景名称] ([英文名称])
- **特征分类**：[时代背景/空间尺度/光影色调]
- **材质陈设**：[场景材质/重要摆件特征]
- **核心氛围**：[3-4个概括词]

### 三、物品道具资产提取
#### 1. [物品名称] ([英文名称])
- **物品类型**：[功能定义]
- **材质工艺**：[主要材质及制作工艺]
- **造型细节**：[整体形状、表面花纹特色]
- **使用痕迹**：[磨损、包浆、战损、血迹等]
- **核心气质**：[3-4个概括词]
`
  },
  {
    id: 'storyboard',
    name: '分镜脚本转换',
    prompt: `# Role
你是一位资深影视分镜师兼导演。

# Task
将用户提供的文字剧本，转化为可供执行的摄影机分镜脚本（Storyboard Script）。

# Format 
### [场景名称或编号]
#### 镜头 1. [景别] - [运镜方式]
- **画面内容**：[视觉描述，环境与人物动作]
- **光影/氛围**：[补光方式及视觉情绪]
- **台词/音效**：[相关对话及背景音效转述]

#### 镜头 2. [景别] - [运镜方式]
- ...
`
  }
];

import { useSyncPresets } from '../lib/useSyncPresets';

export const ScriptAssetLab: React.FC = () => {
  const [script, setScript] = useState(() => localStorage.getItem('lab_script') || '');
  const [result, setResult] = useState(() => localStorage.getItem('lab_result') || '');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [presets, setPresets, loadingFirebase] = useSyncPresets('lab_presets_v2', DEFAULT_PRESETS);
  
  // Update active preset whenever presets finishes loading initially
  useEffect(() => {
    if (presets && presets.length > 0) {
      const exists = presets.find((p: any) => p.id === activePresetId);
      if (!exists) {
        setActivePresetId(presets[0].id);
        setSystemPrompt(presets[0].prompt);
      }
    }
  }, [presets]);

  const [activePresetId, setActivePresetId] = useState(presets[0]?.id || DEFAULT_PRESETS[0].id);
  const [systemPrompt, setSystemPrompt] = useState(() => {
    const active = presets.find((p: any) => p.id === activePresetId);
    return active ? active.prompt : DEFAULT_PRESETS[0].prompt;
  });
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    localStorage.setItem('lab_script', script);
  }, [script]);

  useEffect(() => {
    localStorage.setItem('lab_result', result);
  }, [result]);

  const handlePresetChange = (id: string) => {
    const preset = presets.find((p: any) => p.id === id);
    if (preset) {
      setActivePresetId(id);
      setSystemPrompt(preset.prompt);
    }
  };

  const handleSystemPromptChange = (val: string) => {
    setSystemPrompt(val);
    setPresets((prev: any) => prev.map((p: any) => p.id === activePresetId ? { ...p, prompt: val } : p));
  };

  const handleAddPreset = () => {
    const newId = `custom-${Date.now()}`;
    const newPreset = { id: newId, name: `自定义预设 ${presets.length + 1}`, prompt: '在此输入新的系统提示词...' };
    setPresets([...presets, newPreset]);
    setActivePresetId(newId);
    setSystemPrompt(newPreset.prompt);
  };

  const handleDeletePreset = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (presets.length <= 1) return; // keep at least 1
    const remaining = presets.filter((p: any) => p.id !== id);
    setPresets(remaining);
    if (activePresetId === id) {
      setActivePresetId(remaining[0].id);
      setSystemPrompt(remaining[0].prompt);
    }
  };

  const handleRenamePreset = (id: string, newName: string) => {
    setPresets((prev: any) => prev.map((p: any) => p.id === id ? { ...p, name: newName } : p));
  };

  const handleGenerate = async () => {
    if (!script.trim()) {
      setStatus('请输入剧本内容');
      return;
    }

    setLoading(true);
    setStatus('AI 正在深度解析剧本资产...');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `剧本内容如下：\n\n${script}\n\n请开始执行任务。`,
        config: {
          systemInstruction: { parts: [{ text: systemPrompt }] },
          temperature: 0.7
        }
      });

      const generatedText = response.text || '';
      
      setResult(generatedText);
      setStatus('资产提取完成！');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#E2B53E', '#FFFFFF']
      });
    } catch (error: any) {
      console.error(error);
      setStatus(`生成失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    if (confirm('确定要清空当前实验室数据吗？')) {
      setScript('');
      setResult('');
      setStatus(null);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    setStatus('已复制到剪贴板');
    setTimeout(() => setStatus(null), 2000);
  };

  // Support both "**01. Name**" and "01. Name"
  const formattedResult = result.replace(/^(?:\*\*)?(0?\d+\.\s.*?)(?:\*\*)?\s*$/gm, '#### $1');

  const parsedSections = useMemo(() => {
    if (!formattedResult) return [];
    
    // Split by Markdown headers (H1, H2, H3) OR Chinese numeral headers like "一、人物资产提取" or "二、场景"
    // We add a generic split for anything that looks like a section header.
    const parts = formattedResult.split(/(?=^(?:#{1,3}\s+|[一二三四五六七八九十]+[、.][\s]*[^\n]+$))/m);
    
    const sections: { title: string, content: string }[] = [];
    
    parts.forEach(part => {
      if (!part.trim()) return;
      
      const match = part.match(/^(?:#{1,3}\s+)?([一二三四五六七八九十]+[、.]\s*)?([^\n]+)(?:\n|$)/);
      if (match && (part.startsWith('#') || match[1])) {
        let titleLine = match[2].trim();
        // Remove bold markers if present
        titleLine = titleLine.replace(/\*\*/g, '');
        // Clean title
        const cleanTitle = titleLine || match[1]?.trim() || '未命名分类';
        
        sections.push({
          title: cleanTitle,
          content: part
        });
      } else {
        if (sections.length === 0) {
          sections.push({
             title: '全局资产',
             content: part
          });
        } else {
          sections[sections.length - 1].content += '\n\n' + part;
        }
      }
    });

    return sections.filter(s => s.content.trim());
  }, [formattedResult]);

  const [activeTabIdx, setActiveTabIdx] = useState(0);

  useEffect(() => {
    if (parsedSections.length > 0 && activeTabIdx >= parsedSections.length) {
       setActiveTabIdx(0);
    }
  }, [parsedSections, activeTabIdx]);

  return (
    <div className="flex-1 flex flex-col space-y-6 min-h-0 h-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2 border-b border-white/5">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-white flex items-center gap-4">
            <div className="p-2.5 bg-brand-accent rounded-xl shadow-[0_0_20px_rgba(226,181,62,0.3)]">
              <Beaker className="w-6 h-6 text-black" />
            </div>
            美术资产提取实验室
          </h2>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowPresets(!showPresets)}
            className={`flex items-center gap-2 px-4 py-2 ${showPresets ? 'bg-brand-accent text-black' : 'bg-white/5 text-white/70'} hover:bg-brand-accent hover:text-black font-bold text-sm rounded-xl transition-all`}
          >
            <Settings className="w-4 h-4" />
            系统预设提示词
            <ChevronDown className={`w-4 h-4 transition-transform ${showPresets ? 'rotate-180' : ''}`} />
          </button>
          <button 
            onClick={clearAll}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/40 hover:text-red-400 transition-all"
            title="清空实验室"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showPresets && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-brand-sidebar/80 p-5 mb-2 grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="space-y-3">
                <span className="text-[10px] font-black text-brand-accent uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                  <Layout className="w-3 h-3" /> 预设模板
                </span>
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                  {presets.map((p: any) => (
                    <div 
                      key={p.id}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${activePresetId === p.id ? 'bg-brand-accent text-black shadow-lg' : 'bg-white/5 hover:bg-white/10'}`}
                      onClick={() => handlePresetChange(p.id)}
                    >
                      {activePresetId === p.id ? (
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => handleRenamePreset(p.id, e.target.value)}
                          className="bg-transparent border-none outline-none font-bold text-sm w-full"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="font-bold text-sm text-white/70 truncate">{p.name}</span>
                      )}
                      
                      {p.id.startsWith('custom-') && (
                        <button 
                          onClick={(e) => handleDeletePreset(e, p.id)}
                          className={`p-1.5 rounded-lg ml-2 transition-colors ${activePresetId === p.id ? 'hover:bg-black/10 text-black/40 hover:text-black' : 'hover:bg-red-500/10 text-white/20 hover:text-red-400'}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button 
                    onClick={handleAddPreset}
                    className="w-full text-left px-4 py-3 mt-2 rounded-xl text-sm font-bold border border-dashed border-white/20 text-white/40 hover:text-white/80 hover:border-white/40 transition-all flex items-center justify-between"
                  >
                    添加自定义预设 <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="lg:col-span-3 space-y-3 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                   <span className="text-[10px] font-black text-brand-accent uppercase tracking-[0.2em] flex items-center gap-2">
                    <Settings className="w-3 h-3" /> 提示词内容编辑器
                  </span>
                  <span className="text-[10px] text-white/40 font-bold">对提示词的修改会自动保存</span>
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => handleSystemPromptChange(e.target.value)}
                  className="w-full flex-1 min-h-[200px] bg-black/40 border border-white/10 rounded-2xl p-4 text-white/80 text-sm font-mono leading-relaxed outline-none focus:border-brand-accent/50 transition-colors custom-scrollbar"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0 pb-4">
        {/* Input Side */}
        <div className="flex flex-col space-y-4 min-h-0 h-full">
          <div className="bg-brand-sidebar/40 rounded-3xl border border-white/5 p-6 flex flex-col flex-1 relative group min-h-0">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-brand-accent uppercase tracking-[0.2em] flex items-center gap-2">
                <Sparkles className="w-3 h-3" /> 剧本正文输入
              </span>
              <span className="text-[9px] text-white/20 font-bold uppercase">Markdown Supported</span>
            </div>
            <div className="flex-1 relative overflow-hidden">
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="请在此粘贴您的剧本片段..."
                className="absolute inset-0 w-full h-full bg-transparent border-none outline-none text-white/80 placeholder:text-white/10 text-sm leading-relaxed resize-none custom-scrollbar"
              />
            </div>
          </div>
          
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="shrink-0 w-full py-5 bg-brand-accent text-black font-black text-sm rounded-2xl flex items-center justify-center gap-3 hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_10px_30px_rgba(226,181,62,0.2)] disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
            )}
            {loading ? 'AI 美术指导分析中...' : '开始执行提取任务'}
          </button>
        </div>

        {/* Result Side */}
        <div className="flex flex-col min-h-0 h-full">
          <div className="bg-[#111111] rounded-3xl border border-brand-accent/20 flex flex-col flex-1 relative overflow-hidden shadow-2xl min-h-0">
            <div className="flex items-center justify-between shrink-0 border-b border-white/5 p-5">
              <span className="text-[10px] font-black text-brand-accent uppercase tracking-[0.2em] flex items-center gap-2">
                <Layout className="w-3 h-3" /> 资产设定库输出
              </span>
              {result && (
                <button 
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-accent/10 hover:bg-brand-accent hover:text-black border border-brand-accent/30 rounded-lg text-brand-accent text-[11px] font-black transition-all"
                >
                  <Copy className="w-3.5 h-3.5" /> 复制结果
                </button>
              )}
            </div>
            
            <div className="flex-1 flex flex-col min-h-0 relative">
              {!result && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20 p-5">
                  <Sparkles className="w-12 h-12" />
                  <p className="text-xs font-bold uppercase tracking-widest">分析结果将在此呈现</p>
                </div>
              )}
              {loading && (
                <div className="h-full flex flex-col items-center justify-center space-y-6 text-brand-accent p-5">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 animate-spin" />
                    <Sparkles className="w-4 h-4 absolute top-0 right-0 animate-pulse" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-black uppercase tracking-[0.2em] animate-pulse">正在构建资产模型...</p>
                    <p className="text-[10px] opacity-60 italic">正在基于剧本逻辑补全视觉盲区 【推理补充】</p>
                  </div>
                </div>
              )}
              {result && !loading && parsedSections.length > 0 && (
                <div className="flex flex-col h-full min-h-0">
                  {/* Tabs Section */}
                  <div className="px-5 border-b border-white/5 flex overflow-x-auto custom-scrollbar shrink-0 gap-6 pt-2">
                    {parsedSections.map((section, idx) => (
                       <button 
                         key={idx}
                         onClick={() => setActiveTabIdx(idx)}
                         className={`pb-3 text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative ${activeTabIdx === idx ? 'text-brand-accent' : 'text-white/40 hover:text-white/80'}`}
                       >
                         {section.title}
                         {activeTabIdx === idx && (
                            <motion.div 
                              layoutId="activeTabMarker"
                              className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-accent rounded-t-full shadow-[0_-2px_10px_rgba(226,181,62,0.5)]"
                            />
                         )}
                       </button>
                    ))}
                  </div>
                  
                  {/* Content Section */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pb-8">
                     <AnimatePresence mode="wait">
                       <motion.div
                         key={activeTabIdx}
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         exit={{ opacity: 0, scale: 0.98 }}
                         transition={{ duration: 0.2 }}
                         className="prose prose-invert max-w-none"
                       >
                         {parsedSections[activeTabIdx].content.split(/^(?=#{3,4}\s)/m).map((part, idx) => {
                           if (!part.trim()) return null;
                           const isH4 = part.trim().startsWith('####');
                           
                           return (
                             <div key={idx} className={isH4 ? "relative bg-[#1a1a1a] rounded-2xl border border-white/5 p-5 mb-4 shadow-xl transition-all hover:border-brand-accent/30 hover:shadow-brand-accent/5 group/card" : "mb-2"}>
                               {isH4 && (
                                 <button 
                                   onClick={() => {
                                     navigator.clipboard.writeText(part.replace(/^####\s*/, '').trim());
                                     setStatus('已单独复制该卡片');
                                     setTimeout(() => setStatus(null), 2000);
                                   }}
                                   className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-brand-accent hover:text-black rounded-lg transition-all text-white/40 opacity-0 group-hover/card:opacity-100 flex items-center gap-2"
                                   title="单独复制此卡片"
                                 >
                                   <Copy className="w-3.5 h-3.5" />
                                   <span className="text-[10px] font-bold">复制</span>
                                 </button>
                               )}
                               <Markdown
                                 components={{
                                   h3: ({node, ...props}) => <h3 className="hidden" {...props} />, // Hide H3 since it's the tab title
                                   h4: ({node, ...props}) => <h4 className="text-white text-base font-bold mb-3 pr-20 flex items-center gap-2 before:content-[''] before:w-1 before:h-4 before:bg-brand-accent before:rounded-full mt-0" {...props} />,
                                   ul: ({node, ...props}) => <ul className="flex flex-col gap-2 list-none p-0 m-0 w-full" {...props} />,
                                   li: ({node, ...props}) => <li className="text-white/70 text-[13px] leading-[1.8] relative pl-4 before:content-['•'] before:absolute before:left-0 before:text-white/40 mb-1.5 whitespace-normal break-words" {...props} />,
                                   strong: ({node, ...props}) => <strong className="text-white/90 font-bold" {...props} />,
                                   p: ({node, ...props}) => <p className="text-white/70 text-[13px] leading-[1.8] my-2 whitespace-normal break-words" {...props} />
                                 }}
                               >
                                 {part}
                               </Markdown>
                             </div>
                           );
                         })}
                       </motion.div>
                     </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Status Bar */}
          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-3 px-4 py-3 bg-black/40 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest"
              >
                {status.includes('失败') ? (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                )}
                <span className={status.includes('失败') ? 'text-red-400' : 'text-green-400'}>
                  {status}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
