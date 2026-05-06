import React, { useState, useEffect } from 'react';
import { Bookmark, Plus, Edit3, Trash2, Sparkles, Copy, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from "@google/genai";
import confetti from 'canvas-confetti';

interface Preset {
  id: string;
  title: string;
  content: string;
}

interface PromptLibraryProps {
  setStatus: (s: string) => void;
}

import { useSyncPresets } from '../lib/useSyncPresets';

export const PromptLibrary: React.FC<PromptLibraryProps> = ({ setStatus }) => {
  const [presets, setPresets] = useSyncPresets<Preset[]>('prompt_presets', [
      { id: '1', title: '分镜图单帧放大', content: '角色服装严格参考图1生成写实风格\n角色面部严格参考图2生成写实风格人脸\n高倍率放大，细节增强，电影质感，4K分辨率' }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAddOrEdit = () => {
    if (!newTitle.trim()) return;
    
    if (editingPreset) {
      setPresets(prev => prev.map(p => p.id === editingPreset.id ? { ...p, title: newTitle, content: newContent } : p));
    } else {
      const newPreset: Preset = {
        id: Date.now().toString(),
        title: newTitle,
        content: newContent
      };
      setPresets(prev => [...prev, newPreset]);
    }
    
    closeModal();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPreset(null);
    setNewTitle('');
    setNewContent('');
  };

  const openEdit = (preset: Preset, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPreset(preset);
    setNewTitle(preset.title);
    setNewContent(preset.content);
    setIsModalOpen(true);
  };

  const deletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresets(prev => prev.filter(p => p.id !== id));
  };

  const handleCopy = (content: string) => {
    if (!content) {
      setStatus('提示词内容为空，请先编辑');
      return;
    }
    navigator.clipboard.writeText(content);
    setStatus('✅ 提示词已复制 - 可直接在 Stable Diffusion 中粘贴');
    
    // Celebratory effect for a successful copy
    confetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.9 },
      colors: ['#E2B53E', '#FFFFFF']
    });
  };

  const generateWithAI = async () => {
    if (!newTitle.trim()) {
      setStatus('请输入预设名称，AI 将据此策划提示词');
      return;
    }
    
    setIsGenerating(true);
    setStatus('AI 正在构思专业提示词...');
    try {
      const apiKey = localStorage.getItem('CUSTOM_GEMINI_API_KEY');
      if (!apiKey) {
        setStatus('请先在右上角设置 Gemini API Key');
        setIsGenerating(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `你是一个专业的AI绘画提示词专家。请根据以下预设名称，生成一段高质量的Stable Diffusion或Midjourney提示词，要求包含画面细节、质感、光影、风格描述。
        
        预设名称：${newTitle}
        
        请直接输出提示词内容，不要包含其他解释信息。`,
      });
      
      const generatedText = response.text || '';
      setNewContent(generatedText.trim());
      setStatus('AI 提示词生成成功');
    } catch (error) {
      console.error('AI Generation failed:', error);
      setStatus('AI 生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');

  const filteredPresets = presets.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 shrink-0 pb-2 border-b border-white/5">
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-white flex items-center gap-4">
            <div className="p-2.5 bg-brand-accent rounded-xl shadow-[0_0_20px_rgba(226,181,62,0.3)]">
              <Bookmark className="w-6 h-6 text-black" />
            </div>
            提示词预设资产库
          </h2>
          <p className="text-[11px] text-text-secondary uppercase tracking-[0.3em] font-bold opacity-70 ml-14">
            Manage and iterate your AI generative prompts
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group flex-1 md:flex-none">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-brand-accent transition-colors">
              <Sparkles className="w-4 h-4" />
            </div>
            <input 
              type="text"
              placeholder="搜索提示词名称或内容..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl pl-11 pr-5 py-3 text-sm text-white outline-none focus:border-brand-accent/50 w-full md:w-80 transition-all placeholder:text-white/20"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-3 px-6 py-3 bg-brand-accent text-black text-[12px] font-black rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-[0_8px_20px_rgba(226,181,62,0.2)] uppercase tracking-widest whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            新增预设
          </button>
        </div>
      </div>

      {/* Grid View */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 min-h-0 pt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
          {filteredPresets.length === 0 && (
            <div className="col-span-full py-32 flex flex-col items-center justify-center text-center space-y-6 opacity-30">
              <div className="p-8 border-2 border-dashed border-white/10 rounded-full">
                <Bookmark className="w-16 h-16 text-white/10" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-bold uppercase tracking-[0.2em] text-white">未找到匹配的预设资产</p>
                <p className="text-xs text-text-secondary">尝试更换关键词，或者点击上方按钮新建一个</p>
              </div>
            </div>
          )}
          {filteredPresets.map(preset => (
            <motion.div 
              layout
              key={preset.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4, scale: 1.01 }}
              onClick={() => handleCopy(preset.content)}
              className="group p-5 bg-white/[0.02] border border-white/5 rounded-3xl hover:border-brand-accent/40 cursor-pointer transition-all flex flex-col gap-4 relative overflow-hidden backdrop-blur-sm shadow-xl h-full"
            >
              {/* Card Decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-full blur-[60px] -mr-12 -mt-12 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex items-start justify-between relative z-10 gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-brand-accent/10 rounded-xl text-brand-accent group-hover:bg-brand-accent group-hover:text-black transition-all shadow-inner shrink-0">
                    <Bookmark className="w-4 h-4" />
                  </div>
                  <span className="text-lg font-black text-white group-hover:text-brand-accent transition-colors truncate">
                    {preset.title}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <button 
                    onClick={(e) => openEdit(preset, e)}
                    className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-brand-accent transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => deletePreset(preset.id, e)}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-white/40 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-black/40 rounded-2xl p-5 min-h-[200px] relative group-hover:bg-black/60 transition-colors border border-white/5 flex flex-col">
                <p className="text-[14px] text-white/70 leading-relaxed font-medium group-hover:text-white transition-colors whitespace-pre-wrap flex-1 scrollbar-hide overflow-hidden">
                  {preset.content || '暂未设置详细提示词内容...'}
                </p>
                {/* Visual fade for overflow */}
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/20 to-transparent pointer-events-none rounded-b-2xl" />
              </div>

              <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5 relative z-10 shrink-0">
                <div className="flex items-center gap-2 text-brand-accent font-black uppercase tracking-[0.1em] text-[10px] transform transition-all group-hover:translate-x-1">
                  <span>点击复制</span>
                  <Copy className="w-3 h-3" />
                </div>
                <div className="text-[9px] font-black text-white/20 uppercase tracking-tighter">
                   #{preset.id.substring(0, 4)}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-brand-sidebar border border-brand-accent/20 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-white uppercase tracking-widest">
                  {editingPreset ? '编辑预设' : '新增提示词预设'}
                </h4>
                <button onClick={closeModal} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">预设名称</label>
                  <input 
                    type="text" 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="例如：分镜图单帧放大"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand-accent/50 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">提示词内容</label>
                    <button 
                      onClick={generateWithAI}
                      disabled={isGenerating}
                      className="flex items-center gap-1 text-[9px] font-black text-brand-accent hover:brightness-110 disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                      {isGenerating ? 'AI 生成中...' : 'AI 智能补全'}
                    </button>
                  </div>
                  <textarea 
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="输入您的提示词内容，或点击 AI 智能补全..."
                    rows={6}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 outline-none focus:border-brand-accent/50 transition-all resize-none custom-scrollbar"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={closeModal}
                  className="flex-1 py-2.5 bg-white/5 text-white/60 text-[10px] font-black rounded-xl hover:bg-white/10 transition-all uppercase tracking-widest"
                >
                  取消
                </button>
                <button 
                  onClick={handleAddOrEdit}
                  className="flex-1 py-2.5 bg-brand-accent text-black text-[10px] font-black rounded-xl hover:brightness-110 transition-all uppercase tracking-widest shadow-[0_4px_15px_rgba(226,181,62,0.2)]"
                >
                  {editingPreset ? '保存修改' : '确认添加'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
