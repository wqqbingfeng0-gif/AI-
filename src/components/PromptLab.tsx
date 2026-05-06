import React, { useState, useEffect } from 'react';
import { Beaker, Send, Loader2, Copy, Trash2, Sparkles, AlertCircle, CheckCircle2, Layout, Settings, ChevronDown, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
import confetti from 'canvas-confetti';
import { GoogleGenAI } from '@google/genai';

interface Preset {
  id: string;
  name: string;
  prompt: string;
}

interface PromptLabProps {
    title: string;
    presets: Preset[];
    setPresets: (presets: Preset[]) => void;
    script: string;
    setScript: (script: string) => void;
    result: string;
    setResult: (result: string) => void;
    placeholder: string;
    generateAction: (script: string, systemPrompt: string) => Promise<string>;
}

export const PromptLab: React.FC<PromptLabProps> = ({ title, presets, setPresets, script, setScript, result, setResult, placeholder, generateAction }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [activePresetId, setActivePresetId] = useState((presets && presets.length > 0) ? presets[0].id : '');
  const [systemPrompt, setSystemPrompt] = useState(() => (presets && presets.length > 0) ? presets[0].prompt : '');
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    // Sync active prompt when presets change
    const active = (presets || []).find((p: any) => p.id === activePresetId);
    if (active && active.prompt !== systemPrompt) {
        setSystemPrompt(active.prompt);
    }
  }, [presets, activePresetId, systemPrompt]);

  const handlePresetChange = (id: string) => {
    const preset = (presets || []).find((p: any) => p.id === id);
    if (preset) {
      setActivePresetId(id);
      setSystemPrompt(preset.prompt);
    }
  };

  const handleSystemPromptChange = (val: string) => {
    setSystemPrompt(val);
    setPresets((presets || []).map((p: any) => p.id === activePresetId ? { ...p, prompt: val } : p));
  };

  const handleAddPreset = () => {
    const newId = `custom-${Date.now()}`;
    const newPreset = { id: newId, name: `自定义预设 ${(presets || []).length + 1}`, prompt: '在此输入新的系统提示词...' };
    setPresets([...(presets || []), newPreset]);
    setActivePresetId(newId);
    setSystemPrompt(newPreset.prompt);
  };

  const handleDeletePreset = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if ((presets || []).length <= 1) return; // keep at least 1
    const remaining = (presets || []).filter((p: any) => p.id !== id);
    setPresets(remaining);
    if (activePresetId === id) {
      setActivePresetId(remaining[0].id);
      setSystemPrompt(remaining[0].prompt);
    }
  };

  const handleRenamePreset = (id: string, newName: string) => {
    setPresets((presets || []).map((p: any) => p.id === id ? { ...p, name: newName } : p));
  };

  const handleGenerate = async () => {
    if (!script.trim()) {
      setStatus('请输入剧本内容');
      return;
    }

    setLoading(true);
    setStatus('AI 正在深度解析内容...');
    
    try {
      const generatedText = await generateAction(script, systemPrompt);
      
      setResult(generatedText);
      setStatus('生成完成！');
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result || '');
    setStatus('已复制到剪贴板');
    setTimeout(() => setStatus(null), 2000);
  };

  const formattedResult = (result || '').replace(/^(?:\*\*)?(0?\d+\.\s.*?)(?:\*\*)?\s*$/gm, '#### $1');

  return (
    <div className="flex-1 flex flex-col space-y-6 min-h-0 h-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2 border-b border-white/5">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-white flex items-center gap-4">
            <div className="p-2.5 bg-brand-accent rounded-xl shadow-[0_0_20px_rgba(226,181,62,0.3)]">
              <Beaker className="w-6 h-6 text-black" />
            </div>
            {title}
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
        </div>
      </div>
      <AnimatePresence>
        {showPresets && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-brand-sidebar/80 p-5 mb-2 grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="space-y-3">
                <span className="text-[10px] font-black text-brand-accent uppercase tracking-[0.2em] flex items-center gap-2 mb-4"><Layout className="w-3 h-3" /> 预设模板</span>
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                  {(presets || []).map((p: Preset) => (
                    <div key={p.id} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${activePresetId === p.id ? 'bg-brand-accent text-black shadow-lg' : 'bg-white/5 hover:bg-white/10'}`} onClick={() => handlePresetChange(p.id)}>
                      {activePresetId === p.id ? (
                        <input type="text" value={p.name} onChange={(e) => handleRenamePreset(p.id, e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm w-full" onClick={(e) => e.stopPropagation()} />
                      ) : (
                        <span className="font-bold text-sm text-white/70 truncate">{p.name}</span>
                      )}
                      {p.id.startsWith('custom-') && (
                        <button onClick={(e) => handleDeletePreset(e, p.id)} className={`p-1.5 rounded-lg ml-2 transition-colors ${activePresetId === p.id ? 'hover:bg-black/10 text-black/40 hover:text-black' : 'hover:bg-red-500/10 text-white/20 hover:text-red-400'}`}><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={handleAddPreset} className="w-full text-left px-4 py-3 mt-2 rounded-xl text-sm font-bold border border-dashed border-white/20 text-white/40 hover:text-white/80 hover:border-white/40 transition-all flex items-center justify-between">添加自定义预设 <Plus className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="lg:col-span-3 space-y-3 flex flex-col">
                <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-black text-brand-accent uppercase tracking-[0.2em] flex items-center gap-2"><Settings className="w-3 h-3" /> 提示词内容编辑器</span><span className="text-[10px] text-white/40 font-bold">对提示词的修改会自动保存</span></div>
                <textarea value={systemPrompt} onChange={(e) => handleSystemPromptChange(e.target.value)} className="w-full flex-1 min-h-[200px] bg-black/40 border border-white/10 rounded-2xl p-4 text-white/80 text-sm font-mono leading-relaxed outline-none focus:border-brand-accent/50 transition-colors custom-scrollbar" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0 pb-4">
        <div className="flex flex-col space-y-4 min-h-0 h-full">
          <div className="bg-brand-sidebar/40 rounded-3xl border border-white/5 p-6 flex flex-col flex-1 relative group min-h-0">
            <div className="flex items-center justify-between mb-4"><span className="text-[10px] font-black text-brand-accent uppercase tracking-[0.2em] flex items-center gap-2"><Sparkles className="w-3 h-3" /> 剧本正文输入</span></div>
            <div className="flex-1 relative overflow-hidden"><textarea value={script} onChange={(e) => setScript(e.target.value)} placeholder={placeholder} className="absolute inset-0 w-full h-full bg-transparent border-none outline-none text-white/80 placeholder:text-white/10 text-sm leading-relaxed resize-none custom-scrollbar" /></div>
          </div>
          <button onClick={handleGenerate} disabled={loading} className="shrink-0 w-full py-5 bg-brand-accent text-black font-black text-sm rounded-2xl flex items-center justify-center gap-3 hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_10px_30px_rgba(226,181,62,0.2)] disabled:opacity-50 disabled:cursor-not-allowed group">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />}
            {loading ? 'AI 美术指导分析中...' : '开始执行提取任务'}
          </button>
        </div>
        <div className="flex flex-col min-h-0 h-full">
          <div className="bg-[#111111] rounded-3xl border border-brand-accent/20 flex flex-col flex-1 relative overflow-hidden shadow-2xl min-h-0">
            <div className="flex items-center justify-between shrink-0 border-b border-white/5 p-5">
              <span className="text-[10px] font-black text-brand-accent uppercase tracking-[0.2em] flex items-center gap-2"><Layout className="w-3 h-3" /> 资产设定库输出</span>
              {result && <button onClick={copyToClipboard} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-accent/10 hover:bg-brand-accent hover:text-black border border-brand-accent/30 rounded-lg text-brand-accent text-[11px] font-black transition-all"><Copy className="w-3.5 h-3.5" /> 复制结果</button>}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pb-8 relative">
              {!result && !loading && <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20"><Sparkles className="w-12 h-12" /><p className="text-xs font-bold uppercase tracking-widest">分析结果将在此呈现</p></div>}
              {loading && <div className="h-full flex flex-col items-center justify-center space-y-6 text-brand-accent"><div className="relative"><Loader2 className="w-12 h-12 animate-spin" /><Sparkles className="w-4 h-4 absolute top-0 right-0 animate-pulse" /></div>
                    <div className="text-center space-y-2">
                        <p className="text-sm font-black uppercase tracking-[0.2em] animate-pulse">正在构建资产模型...</p>
                        <p className="text-[10px] opacity-60 italic">正在基于剧本逻辑补全视觉盲区 【推理补充】</p>
                    </div>
                </div>}
              {result && !loading && (
                <div className="pb-8">
                  <div className="prose prose-invert max-w-none">
                    {formattedResult.split(/^(?=#{3,4}\s)/m).map((part, idx) => {
                      if (!part.trim()) return null;
                      const isH4 = part.trim().startsWith('####');
                      return (
                        <div key={idx} className={isH4 ? "relative bg-[#1a1a1a] rounded-2xl border border-white/5 p-5 mb-4 shadow-xl transition-all hover:border-brand-accent/30 hover:shadow-brand-accent/5 group/card" : "mb-2"}>
                          {isH4 && <button onClick={() => { navigator.clipboard.writeText(part.replace(/^####\s*/, '').trim()); setStatus('已单独复制该卡片'); setTimeout(() => setStatus(null), 2000); }} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-brand-accent hover:text-black rounded-lg transition-all text-white/40 opacity-0 group-hover/card:opacity-100 flex items-center gap-2" title="单独复制此卡片"><Copy className="w-3.5 h-3.5" /><span className="text-[10px] font-bold">复制</span></button>}
                          <Markdown components={{ 
                                  h3: ({node, ...props}) => <h3 className="text-brand-accent text-xl font-black border-b border-brand-accent/20 pb-2 mt-4 mb-4 w-full" {...props} />, 
                                  h4: ({node, ...props}) => <h4 className="text-white text-base font-bold mb-3 pr-20 flex items-center gap-2 before:content-[''] before:w-1 before:h-4 before:bg-brand-accent before:rounded-full mt-0" {...props} />, 
                                  ul: ({node, ...props}) => <ul className="flex flex-col gap-2 list-none p-0 m-0 w-full" {...props} />, 
                                  li: ({node, ...props}) => <li className="text-white/70 text-[13px] leading-[1.8] relative pl-4 before:content-['•'] before:absolute before:left-0 before:text-white/40 mb-1.5 whitespace-normal break-words" {...props} />, 
                                  strong: ({node, ...props}) => <strong className="text-white/90 font-bold" {...props} />, 
                                  p: ({node, ...props}) => <p className="text-white/70 text-[13px] leading-[1.8] my-2 whitespace-normal break-words" {...props} /> 
                              }}
                          >{part}</Markdown>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
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
    </div>
  );
};
