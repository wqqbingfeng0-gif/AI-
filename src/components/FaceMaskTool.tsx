import React, { useRef, useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import JSZip from 'jszip';
import { 
  Upload, 
  Download, 
  RefreshCcw, 
  ShieldCheck, 
  Check, 
  Info, 
  Loader2, 
  CheckCircle2, 
  ImagePlus, 
  X, 
  Box,
  MousePointer2,
  Trash2,
  Square,
  Pentagon,
  Combine,
  Zap,
  DownloadCloud,
  Eraser,
  Plus,
  Copy,
  Layers,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Point {
  x: number;
  y: number;
}

interface SafetyAsset {
  id: string;
  source: string;
  fileName: string;
  aiLandmarks: any[];
  manualPolygons: Point[][];
}

type ManualTool = 'point' | 'rect' | 'lasso' | 'circle';

export function FaceMaskTool() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<SafetyAsset[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [gridDensity, setGridDensity] = useState(() => {
    const saved = localStorage.getItem('face-mask-density');
    return saved ? Number(saved) : 32;
  });
  const [opacity, setOpacity] = useState(() => {
    const saved = localStorage.getItem('face-mask-opacity');
    return saved ? Number(saved) : 0.3;
  });
  const [lineWidth, setLineWidth] = useState(() => {
    const saved = localStorage.getItem('face-mask-linewidth');
    return saved ? Number(saved) : 2;
  });
  const [color, setColor] = useState(() => {
    const saved = localStorage.getItem('face-mask-color');
    return saved || '#ffffff';
  });
  const [patchRadius, setPatchRadius] = useState(() => {
    const saved = localStorage.getItem('face-mask-radius');
    return saved ? Number(saved) : 110;
  });

  const [maskColor, setMaskColor] = useState(() => {
    const saved = localStorage.getItem('face-mask-opaque-color');
    return saved || '#222222';
  });

  useEffect(() => {
    localStorage.setItem('face-mask-density', gridDensity.toString());
    localStorage.setItem('face-mask-opacity', opacity.toString());
    localStorage.setItem('face-mask-linewidth', lineWidth.toString());
    localStorage.setItem('face-mask-color', color);
    localStorage.setItem('face-mask-radius', patchRadius.toString());
    localStorage.setItem('face-mask-opaque-color', maskColor);
  }, [gridDensity, opacity, lineWidth, color, patchRadius, maskColor]);

  const [status, setStatus] = useState<string>('等待上传图片...');
  const [faceMesh, setFaceMesh] = useState<any>(null);
  
  // Tool states
  const [toolMode, setToolMode] = useState<'auto' | 'manual'>('manual');
  const [manualTool, setManualTool] = useState<ManualTool>('circle');
  
  // Drawing states
  const [currentPolygon, setCurrentPolygon] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Dual Export results
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportResults, setExportResults] = useState<{ img1: string; img2: string } | null>(null);

  const activeAsset = assets[activeIndex] || null;

  // Load Mediapipe scripts
  useEffect(() => {
    const loadScripts = async () => {
      if ((window as any).FaceMesh) {
        initFaceMesh();
        return;
      }

      setStatus('正在载入离线算法库...');
      const scripts = [
        'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js',
        'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js'
      ];

      for (const src of scripts) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = src;
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }
      initFaceMesh();
    };

    const initFaceMesh = () => {
      const fm = new (window as any).FaceMesh({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });

      fm.setOptions({
        maxNumFaces: 10,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      fm.onResults(onResults);
      setFaceMesh(fm);
      setStatus('算法库已就绪，请上传图片');
    };

    loadScripts();
  }, []);

  const onResults = useCallback((results: any) => {
    const currentIndex = activeIndexRef.current;
    if (results.multiFaceLandmarks && currentIndex >= 0) {
      const landmarks = results.multiFaceLandmarks;
      setAssets(prev => prev.map((asset, idx) => 
        idx === currentIndex ? { ...asset, aiLandmarks: landmarks } : asset
      ));
      
      if (landmarks.length === 0) {
        setStatus('AI未识别到面部，建议使用右侧[手动模式]进行圈选');
      } else {
        setStatus(`已自动定位 ${landmarks.length} 处面部区域`);
      }
    }
    setIsProcessing(false);
  }, []);

  // Combined Rendering Logic
  useEffect(() => {
    if (!activeAsset) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = activeAsset.source;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      renderFrame(ctx, activeAsset, img.width, img.height);
    };
  }, [activeAsset, gridDensity, opacity, lineWidth, color, currentPolygon]);

  const renderFrame = (ctx: CanvasRenderingContext2D, asset: SafetyAsset, width: number, height: number) => {
    const img = new Image();
    img.src = asset.source;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0);

    // AI Masks
    if (asset.aiLandmarks.length > 0) {
      asset.aiLandmarks.forEach(landmarks => {
        applyGridToLandmarks(ctx, landmarks, width, height);
      });
    }

    // Manual Masks
    asset.manualPolygons.forEach(poly => {
      applyGridToPolygon(ctx, poly);
    });

    // Current draw preview
    if (currentPolygon.length > 0) {
      drawPolygonPreview(ctx, currentPolygon);
    }
  };

  const applyGridToLandmarks = (ctx: CanvasRenderingContext2D, landmarks: any, width: number, height: number, mode: 'grid' | 'opaque' = 'grid') => {
    ctx.save();
    const faceOvalIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
    ctx.beginPath();
    faceOvalIndices.forEach((idx, i) => {
      const p = landmarks[idx];
      if (i === 0) ctx.moveTo(p.x * width, p.y * height);
      else ctx.lineTo(p.x * width, p.y * height);
    });
    ctx.closePath();
    ctx.clip();
    if (mode === 'grid') {
      drawGrid(ctx, width, height);
    } else {
      ctx.fillStyle = maskColor;
      ctx.globalAlpha = 1.0;
      ctx.fill();
    }
    ctx.restore();
  };

  const applyGridToPolygon = (ctx: CanvasRenderingContext2D, poly: Point[], mode: 'grid' | 'opaque' = 'grid') => {
    ctx.save();
    ctx.beginPath();
    poly.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.clip();
    if (mode === 'grid') {
      drawGrid(ctx, ctx.canvas.width, ctx.canvas.height);
    } else {
      ctx.fillStyle = maskColor;
      ctx.globalAlpha = 1.0;
      ctx.fill();
    }
    ctx.restore();
  };

  const drawPolygonPreview = (ctx: CanvasRenderingContext2D, poly: Point[]) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    poly.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    
    if (manualTool !== 'point') ctx.closePath();
    ctx.stroke();
    
    // Draw points for feedback
    poly.forEach(p => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = opacity;
    const size = gridDensity;
    for (let i = -width; i < width * 2; i += size) {
      ctx.beginPath(); ctx.moveTo(i, -height); ctx.lineTo(i + height * 2, height * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, height * 2); ctx.lineTo(i + height * 2, -height); ctx.stroke();
    }
  };

  // --- Interaction Logic ---
  const getCanvasCoords = (e: React.MouseEvent | MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (toolMode !== 'manual' || !activeAsset) return;
    const p = getCanvasCoords(e);
    
    if (manualTool === 'point') {
      setCurrentPolygon(prev => [...prev, p]);
    } else if (manualTool === 'rect') {
      setIsDrawing(true);
      setCurrentPolygon([p, p, p, p]); // Initial box
    } else if (manualTool === 'lasso') {
      setIsDrawing(true);
      setCurrentPolygon([p]);
    } else if (manualTool === 'circle') {
      // Create a circular polygon approximation
      const circlePoints: Point[] = [];
      const segments = 24;
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        circlePoints.push({
          x: p.x + Math.cos(angle) * patchRadius,
          y: p.y + Math.sin(angle) * patchRadius
        });
      }
      setAssets(prev => prev.map((asset, idx) => 
        idx === activeIndex ? { ...asset, manualPolygons: [...asset.manualPolygons, circlePoints] } : asset
      ));
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (toolMode !== 'manual' || !isDrawing || !activeAsset) return;
    const p = getCanvasCoords(e);

    if (manualTool === 'rect') {
      const start = currentPolygon[0];
      setCurrentPolygon([
        start,
        { x: p.x, y: start.y },
        p,
        { x: start.x, y: p.y }
      ]);
    } else if (manualTool === 'lasso') {
      // Add points as we move
      const last = currentPolygon[currentPolygon.length - 1];
      const dist = Math.hypot(p.x - last.x, p.y - last.y);
      if (dist > 5) {
        setCurrentPolygon(prev => [...prev, p]);
      }
    }
  };

  const handleMouseUp = () => {
    if (toolMode !== 'manual' || !isDrawing || !activeAsset) return;
    
    if (manualTool === 'rect' || manualTool === 'lasso') {
      if (currentPolygon.length > 2) {
        setAssets(prev => prev.map((asset, idx) => 
          idx === activeIndex ? { ...asset, manualPolygons: [...asset.manualPolygons, currentPolygon] } : asset
        ));
      }
      setCurrentPolygon([]);
      setIsDrawing(false);
    }
  };

  const completePolygon = () => {
    if (currentPolygon.length < 3) return;
    setAssets(prev => prev.map((asset, idx) => 
      idx === activeIndex ? { ...asset, manualPolygons: [...asset.manualPolygons, currentPolygon] } : asset
    ));
    setCurrentPolygon([]);
  };

  // --- Asset Management ---
  const processFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const source = e.target?.result as string;
        setAssets(prev => [...prev, {
          id: `safety-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          source,
          fileName: file.name,
          aiLandmarks: [],
          manualPolygons: []
        }]);
        if (assets.length === 0) setStatus('素材已就绪，请选择处理模式');
      };
      reader.readAsDataURL(file);
    });
  }, [assets.length]);

  const deleteAsset = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setAssets(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      if (activeIndex >= updated.length) setActiveIndex(Math.max(0, updated.length - 1));
      return updated;
    });
  };

  // Global paste
  useEffect(() => {
    const handlePaste = (e: any) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) processFiles([file] as any);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFiles]);

  const runAiDetection = () => {
    if (!faceMesh || !activeAsset) return;
    const img = new Image();
    img.src = activeAsset.source;
    img.onload = () => {
      setIsProcessing(true);
      setStatus(`正在识别 [${activeAsset.fileName}] ...`);
      faceMesh.send({ image: img });
    };
  };

  const handleDownloadSingle = () => {
    const canvas = canvasRef.current;
    if (!canvas || !activeAsset) return;
    const prefix = activeAsset.fileName.substring(0, activeAsset.fileName.lastIndexOf('.')) || activeAsset.fileName;
    const link = document.createElement('a');
    link.download = `${prefix}_face_mask.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleDownloadAll = async () => {
    if (assets.length === 0) return;
    setStatus('正在进行批量素材打包...');
    setIsProcessing(true);

    try {
      const zip = new JSZip();
      
      const renderPromises = assets.map(async (asset) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.src = asset.source;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });

        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.clearRect(0, 0, img.width, img.height);
        ctx.drawImage(img, 0, 0);
        
        if (asset.aiLandmarks.length > 0) {
          asset.aiLandmarks.forEach(landmarks => {
            applyGridToLandmarks(ctx, landmarks, img.width, img.height);
          });
        }
        asset.manualPolygons.forEach(poly => {
          applyGridToPolygon(ctx, poly);
        });

        // 优化方案：使用 JPEG 格式并设置 0.9 的质量，极大地减小带网格图片的体积
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
        });

        if (blob) {
          const prefix = asset.fileName.substring(0, asset.fileName.lastIndexOf('.')) || asset.fileName;
          zip.file(`${prefix}_face_mask.jpg`, blob);
        }
      });

      await Promise.all(renderPromises);
      
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `exported_assets_${Date.now()}.zip`;
      link.click();
      
      setStatus('批量素材打包导出完成');
      confetti({
        particleCount: 200,
        spread: 90,
        origin: { y: 0.5 }
      });
    } catch (err) {
      console.error(err);
      setStatus('打包失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateDualRefImages = useCallback(async () => {
    if (!activeAsset) return;
    const tempCanvas = document.createElement('canvas');
    const tCtx = tempCanvas.getContext('2d');
    if (!tCtx) return;

    const img = new Image();
    img.src = activeAsset.source;
    await new Promise((r) => (img.onload = r));

    const width = img.width;
    const height = img.height;
    tempCanvas.width = width;
    tempCanvas.height = height;

    // --- Image 1: Clothes Reference (Faces Painted Black/Gray) ---
    tCtx.clearRect(0, 0, width, height);
    tCtx.drawImage(img, 0, 0);
    activeAsset.aiLandmarks.forEach(l => applyGridToLandmarks(tCtx, l, width, height, 'opaque'));
    activeAsset.manualPolygons.forEach(p => applyGridToPolygon(tCtx, p, 'opaque'));
    const img1 = tempCanvas.toDataURL('image/png');

    // --- Image 2: Face Reference (Isolated Faces + Grid) ---
    tCtx.clearRect(0, 0, width, height);
    // Background is transparent
    
    const drawFaceRef = (asset: SafetyAsset) => {
      asset.aiLandmarks.forEach(landmarks => {
        tCtx.save();
        const faceOvalIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
        tCtx.beginPath();
        faceOvalIndices.forEach((idx, i) => {
          const p = landmarks[idx];
          if (i === 0) tCtx.moveTo(p.x * width, p.y * height);
          else tCtx.lineTo(p.x * width, p.y * height);
        });
        tCtx.closePath();
        tCtx.clip();
        tCtx.drawImage(img, 0, 0);
        drawGrid(tCtx, width, height);
        tCtx.restore();
      });
      asset.manualPolygons.forEach(poly => {
        tCtx.save();
        tCtx.beginPath();
        poly.forEach((p, i) => {
          if (i === 0) tCtx.moveTo(p.x, p.y);
          else tCtx.lineTo(p.x, p.y);
        });
        tCtx.closePath();
        tCtx.clip();
        tCtx.drawImage(img, 0, 0);
        drawGrid(tCtx, width, height);
        tCtx.restore();
      });
    };
    drawFaceRef(activeAsset);
    const img2 = tempCanvas.toDataURL('image/png');

    setExportResults({ img1, img2 });
  }, [activeAsset, maskColor, gridDensity, opacity, lineWidth, color]);

  // Reactive generation for modal only when opened or settings change
  useEffect(() => {
    if (showExportModal && activeAsset) {
      generateDualRefImages();
    }
  }, [showExportModal, maskColor]);

  const handleOpenExportModal = () => {
    if (!activeAsset) return;
    setStatus('正在生成高级参考对图...');
    generateDualRefImages().then(() => {
      setShowExportModal(true);
      setStatus('高级参考图生成完毕');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#E2B53E', '#FFFFFF', maskColor]
      });
    });
  };

  return (
    <div className="flex-1 flex flex-col p-8 gap-6 overflow-hidden bg-brand-bg relative">
      <AnimatePresence>
        {showExportModal && exportResults && (
           <motion.div 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-8 overflow-y-auto"
           >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="bg-brand-sidebar/60 border border-brand-accent/30 rounded-3xl p-8 max-w-5xl w-full flex flex-col gap-8 shadow-2xl relative"
              >
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-8 h-8 text-brand-accent animate-pulse" />
                      <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-widest">高级过审导出结果</h3>
                        <p className="text-[10px] text-brand-accent/60 font-black tracking-widest">DUAL-REF PIPELINE GENERATED</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-2 px-4 py-1.5 bg-black/40 border border-white/10 rounded-xl">
                          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">涂抹亮度</span>
                          <input 
                            type="range" min="0" max="255" 
                            value={parseInt(maskColor.replace('#', '').substring(0, 2), 16) || 0} 
                            onChange={(e) => {
                              const v = Number(e.target.value).toString(16).padStart(2, '0');
                              const newColor = `#${v}${v}${v}`;
                              setMaskColor(newColor);
                            }}
                            className="w-24 accent-brand-accent h-1"
                          />
                       </div>
                       <button 
                         onClick={() => {
                           if (!activeAsset) return;
                           const prefix = activeAsset.fileName.substring(0, activeAsset.fileName.lastIndexOf('.')) || activeAsset.fileName;
                           const l1 = document.createElement('a'); l1.download = `${prefix}_ref_clothes.png`; l1.href = exportResults.img1; l1.click();
                           setTimeout(() => {
                             const l2 = document.createElement('a'); l2.download = `${prefix}_ref_face.png`; l2.href = exportResults.img2; l2.click();
                           }, 300);
                         }}
                         className="px-6 py-2.5 bg-brand-accent text-black text-[11px] font-black rounded-xl hover:brightness-110 flex items-center gap-2 uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(226,181,62,0.2)]"
                       >
                         <DownloadCloud className="w-4 h-4" /> 一键打包导出两张图
                       </button>
                       <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-white/10 rounded-full text-white/40 transition-all"><X className="w-6 h-6" /></button>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Img 1 */}
                    <div className="flex flex-col gap-4 group">
                       <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">图 1: 服装参考 (涂抹处理)</span>
                       </div>
                       <div className="aspect-video bg-black/40 border border-white/5 rounded-2xl overflow-hidden relative shadow-inner">
                          <img src={exportResults.img1} className="w-full h-full object-contain" />
                       </div>
                    </div>

                    {/* Img 2 */}
                    <div className="flex flex-col gap-4 group">
                       <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">图 2: 面部参考 (独立打码)</span>
                       </div>
                       <div className="aspect-video bg-black/40 border border-white/5 rounded-2xl overflow-hidden relative shadow-inner [background-image:linear-gradient(45deg,#111_25%,transparent_25%),linear-gradient(-45deg,#111_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#111_75%),linear-gradient(-45deg,transparent_75%,#111_75%)] [background-size:20px_20px] [background-position:0_0,0_10px,10px_-10px,-10px_0px]">
                          <img src={exportResults.img2} className="w-full h-full object-contain" />
                       </div>
                    </div>
                 </div>

                 <div className="bg-black/60 p-6 rounded-2xl border border-brand-accent/20 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black text-brand-accent uppercase tracking-[0.2em]">合并提示词 (Seedance 2.0 专用)</span>
                       <button 
                         onClick={() => { 
                           const combined = `角色服装严格参考图1生成写实风格\n角色面部严格参考图2生成写实风格人脸`;
                           navigator.clipboard.writeText(combined); 
                           setStatus('合并提示词已复制'); 
                         }} 
                         className="flex items-center gap-2 px-4 py-1.5 bg-brand-accent/10 border border-brand-accent/30 text-brand-accent text-[10px] font-black rounded-lg hover:bg-brand-accent hover:text-black transition-all"
                       >
                         <Copy className="w-3.5 h-3.5" /> 一键复制全部
                       </button>
                    </div>
                    <div className="bg-black/40 p-4 rounded-xl text-xs text-white/80 leading-relaxed font-medium">
                       角色服装严格参考图1生成写实风格<br/>
                       角色面部严格参考图2生成写实风格人脸
                    </div>
                 </div>

                 <div className="mt-4 flex flex-col items-center gap-2">
                    <p className="text-[10px] text-white/20 italic tracking-widest uppercase">Seedance 模型专用过审流 / 当前版本 PRO 2.0</p>
                    <button 
                      onClick={() => setShowExportModal(false)}
                      className="px-12 py-3 bg-brand-accent text-black text-xs font-black rounded-xl hover:brightness-110 shadow-2xl transition-all uppercase tracking-[0.3em]"
                    >
                      返回实验室
                    </button>
                 </div>
              </motion.div>
           </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-accent/10 rounded-2xl flex items-center justify-center border border-brand-accent/20 shadow-[0_0_20px_rgba(226,181,62,0.1)]">
            <ShieldCheck className="w-7 h-7 text-brand-accent" />
          </div>
          <div>
            <div className="flex items-center gap-3">
               <h2 className="text-xl font-black text-white tracking-tight uppercase">面部脱敏实验室 <span className="text-[10px] bg-brand-accent/20 text-brand-accent px-2 py-0.5 rounded ml-2">PRO EDITION</span></h2>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
               <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 rounded text-[9px] font-black text-green-500 uppercase tracking-widest border border-green-500/20">
                 <CheckCircle2 className="w-2.5 h-2.5" /> 离线安全沙箱就绪
               </div>
               <p className="text-[10px] text-text-secondary tracking-wide italic ml-2 opacity-60">
                 针对 Seedance 2.0，建议结合【高级对图导出】使用。
               </p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
           {activeAsset && (
             <div className="flex gap-2">
                <button
                  onClick={handleDownloadAll}
                  className="px-6 py-3 bg-brand-accent/5 border border-brand-accent/30 text-brand-accent text-[11px] font-black rounded-xl hover:bg-brand-accent hover:text-black transition-all flex items-center gap-2 tracking-widest shadow-[0_0_15px_rgba(226,181,62,0.1)]"
                >
                  <DownloadCloud className="w-4 h-4" /> 一键打包导出素材池
                </button>
                <button
                  onClick={handleDownloadSingle}
                  className="px-6 py-3 bg-black/20 border border-white/5 text-white/60 text-[11px] font-black rounded-xl hover:bg-black/40 transition-all flex items-center gap-2 tracking-widest"
                >
                  <Download className="w-4 h-4" /> 导出当图
                </button>
                <button
                  onClick={handleOpenExportModal}
                  className="px-8 py-3 bg-brand-accent text-black text-[11px] font-black rounded-xl hover:brightness-110 flex items-center gap-2 transition-all shadow-[0_0_30px_rgba(226,181,62,0.3)] uppercase tracking-widest"
                >
                  <Layers className="w-4 h-4" /> 高级过审对图导出
                </button>
             </div>
           )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0">
        <div className="lg:col-span-4 flex flex-col gap-6 overflow-hidden">
          
          <div 
            className={`flex-none bg-brand-sidebar/40 rounded-2xl border border-brand-border p-5 space-y-4 flex flex-col max-h-[300px] transition-all ${isDraggingOver ? 'bg-brand-accent/5 border-brand-accent' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => { e.preventDefault(); setIsDraggingOver(false); processFiles(e.dataTransfer.files); }}
          >
             <div className="flex items-center justify-between shrink-0">
               <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">素材池 ({assets.length})</span>
               <label className="text-brand-accent hover:text-white transition-all cursor-pointer p-1">
                 <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => processFiles(e.target.files)} />
                 <Plus className="w-4 h-4" />
               </label>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <div className="grid grid-cols-4 gap-2">
                   {assets.map((asset, idx) => (
                     <div 
                       key={asset.id} 
                       onClick={() => { setActiveIndex(idx); setCurrentPolygon([]); }}
                       className={`aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all relative group ${activeIndex === idx ? 'border-brand-accent scale-95 z-10 shadow-[0_0_20px_rgba(226,181,62,0.15)]' : 'border-white/5 hover:border-white/20 opacity-50 hover:opacity-100'}`}
                     >
                       <img src={asset.source} className="w-full h-full object-cover" />
                       <button onClick={(e) => deleteAsset(idx, e)} className="absolute top-1 right-1 w-5 h-5 bg-black/80 text-white/30 hover:text-red-500 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                         <Trash2 className="w-2.5 h-2.5" />
                       </button>
                       {(asset.aiLandmarks.length > 0 || asset.manualPolygons.length > 0) && (
                         <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full" />
                       )}
                     </div>
                   ))}
                   <label className="aspect-square rounded-xl border-2 border-dashed border-white/5 hover:border-brand-accent/30 flex flex-col items-center justify-center cursor-pointer group transition-all">
                      <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => processFiles(e.target.files)} />
                      <ImagePlus className="w-4 h-4 text-text-secondary group-hover:text-brand-accent" />
                   </label>
                </div>
             </div>
             <div className="shrink-0 pt-2 border-t border-white/5">
                <p className="text-[10px] font-mono text-brand-accent/60 truncate uppercase tracking-tighter">{status}</p>
             </div>
          </div>

          <div className="bg-brand-sidebar/40 rounded-2xl border border-brand-border p-5 space-y-4 shrink-0">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">操作模式</span>
                <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                   <button 
                     onClick={() => setToolMode('auto')}
                     className={`px-4 py-1.5 rounded-md text-[10px] font-black transition-all flex items-center gap-1.5 ${toolMode === 'auto' ? 'bg-brand-accent text-black' : 'text-text-secondary hover:text-white'}`}
                   >
                     AI 智能
                   </button>
                   <button 
                     onClick={() => setToolMode('manual')}
                     className={`px-4 py-1.5 rounded-md text-[10px] font-black transition-all flex items-center gap-1.5 ${toolMode === 'manual' ? 'bg-brand-accent text-black' : 'text-text-secondary hover:text-white'}`}
                   >
                     手工纠偏
                   </button>
                </div>
             </div>

             {toolMode === 'auto' ? (
                <button 
                  onClick={runAiDetection}
                  disabled={!activeAsset || isProcessing}
                  className="w-full py-4 bg-brand-accent/10 border border-brand-accent/40 text-brand-accent text-[11px] font-black rounded-xl hover:bg-brand-accent hover:text-black transition-all flex items-center justify-center gap-2 disabled:opacity-30 uppercase tracking-[0.2em]"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                  执行面部 AI 识别
                </button>
             ) : (
                <div className="space-y-4">
                   <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'circle', icon: <Zap className="w-3.5 h-3.5" />, label: '点选' },
                        { id: 'rect', icon: <Square className="w-3.5 h-3.5" />, label: '矩形' },
                        { id: 'lasso', icon: <Combine className="w-3.5 h-3.5" />, label: '套索' },
                        { id: 'point', icon: <Pentagon className="w-3.5 h-3.5" />, label: '多边' }
                      ].map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setManualTool(m.id as ManualTool); setCurrentPolygon([]); }}
                          className={`flex flex-col items-center gap-1.5 py-2 rounded-xl border-2 transition-all ${manualTool === m.id ? 'border-brand-accent bg-brand-accent/10 text-brand-accent' : 'border-white/5 bg-black/20 text-text-secondary hover:border-white/20'}`}
                        >
                          {m.icon}
                          <span className="text-[8px] font-bold uppercase tracking-tighter">{m.label}</span>
                        </button>
                      ))}
                   </div>

                   {manualTool === 'circle' && (
                     <div className="space-y-3 p-3 bg-brand-accent/5 border border-brand-accent/20 rounded-xl relative overflow-hidden group">
                        <div className="flex justify-between items-center text-[10px] font-bold text-white uppercase tracking-widest relative z-10">
                           <span className="text-brand-accent">打点半径 (RADIUS)</span>
                           <input 
                             type="number" 
                             value={patchRadius} 
                             onChange={(e) => setPatchRadius(Number(e.target.value))}
                             className="w-16 bg-black/60 border border-brand-accent/30 rounded px-1.5 py-0.5 text-right text-brand-accent outline-none font-mono text-[11px]"
                           />
                        </div>
                        <input 
                          type="range" 
                          min="10" 
                          max="350" 
                          value={patchRadius} 
                          onChange={(e) => setPatchRadius(Number(e.target.value))} 
                          className="w-full accent-brand-accent bg-white/5 h-1 rounded-lg appearance-none cursor-pointer relative z-10" 
                        />
                        <p className="text-[8px] text-text-secondary italic opacity-60">提示：在人脸位置点一下即可快速增加网格 patches。</p>
                     </div>
                   )}
                   
                   <div className="flex gap-2">
                       {manualTool === 'point' && (
                         <button 
                           onClick={completePolygon}
                           disabled={currentPolygon.length < 3}
                           className="flex-1 py-2.5 bg-brand-accent text-black text-[10px] font-black rounded-lg hover:brightness-110 disabled:opacity-30 uppercase tracking-widest"
                         >
                           闭合选区
                         </button>
                       )}
                       <button 
                          onClick={() => {
                            setAssets(prev => prev.map((asset, idx) => 
                              idx === activeIndex ? { ...asset, manualPolygons: [], aiLandmarks: [] } : asset
                            ));
                            setCurrentPolygon([]);
                          }}
                          className="flex-1 py-2.5 bg-red-400/5 border border-red-400/20 text-red-500 text-[10px] font-black rounded-lg hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                       >
                          <Eraser className="w-3.5 h-3.5" /> 重置本图
                       </button>
                   </div>
                </div>
             )}
          </div>

          <div className="bg-brand-sidebar/40 rounded-2xl border border-brand-border p-5 space-y-6 shrink-0">
             <div className="space-y-4">
                <div className="flex items-center gap-2">
                   <Box className="w-3.5 h-3.5 text-brand-accent" />
                   <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">渲染管线参数</span>
                </div>
                <div className="space-y-5">
                   <div className="space-y-2">
                     <div className="flex justify-between items-center text-[10px] font-bold text-white/50 uppercase tracking-widest">
                       <span>网格密度 (MESH)</span>
                       <input 
                         type="number" 
                         value={gridDensity} 
                         onChange={(e) => setGridDensity(Number(e.target.value))}
                         className="w-16 bg-black/60 border border-white/5 rounded px-1.5 py-0.5 text-right text-brand-accent outline-none font-mono text-[11px]"
                       />
                     </div>
                     <input type="range" min="5" max="100" value={gridDensity} onChange={(e) => setGridDensity(Number(e.target.value))} className="w-full accent-brand-accent bg-white/5 h-1 rounded-lg appearance-none cursor-pointer" />
                   </div>
                   <div className="space-y-2">
                     <div className="flex justify-between items-center text-[10px] font-bold text-white/50 uppercase tracking-widest">
                       <span>透明度 (ALPHA)</span>
                       <div className="flex items-center gap-1.5">
                          <input 
                            type="number" 
                            value={Math.round(opacity * 100)} 
                            onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                            className="w-16 bg-black/60 border border-white/5 rounded px-1.5 py-0.5 text-right text-brand-accent outline-none font-mono text-[11px]"
                          />
                          <span className="text-[9px] text-brand-accent/50 font-bold">%</span>
                       </div>
                     </div>
                     <input type="range" min="0" max="1" step="0.01" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-brand-accent bg-white/5 h-1 rounded-lg appearance-none cursor-pointer" />
                   </div>
                   <div className="flex gap-4">
                      <div className="flex-1 space-y-1.5">
                         <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">网格颜色</span>
                         <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-9 bg-black/40 border border-white/5 rounded-lg cursor-pointer" />
                      </div>
                      <div className="flex-1 space-y-1.5">
                         <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">涂抹颜色</span>
                         <input type="color" value={maskColor} onChange={(e) => setMaskColor(e.target.value)} className="w-full h-9 bg-black/40 border border-white/5 rounded-lg cursor-pointer" />
                      </div>
                      <div className="flex-1 space-y-1.5">
                         <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">网格线宽</span>
                         <input type="number" value={lineWidth} step="0.5" onChange={(e) => setLineWidth(Number(e.target.value))} className="w-full h-9 bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-brand-accent outline-none font-bold" />
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col bg-black/60 rounded-3xl border-2 border-brand-border/30 relative overflow-hidden h-full">
          {!activeAsset ? (
            <div 
              className={`flex-1 flex flex-col items-center justify-center gap-8 text-center transition-all ${isDraggingOver ? 'bg-brand-accent/10' : ''}`}
            >
              <div className="w-32 h-32 bg-brand-accent/5 rounded-[40px] flex items-center justify-center border border-brand-accent/10 animate-pulse">
                <Layers className="w-12 h-12 text-brand-accent/30" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white uppercase tracking-widest">导入生产素材</h3>
                <p className="text-[10px] text-text-secondary uppercase tracking-[0.2em]">支持拖拽批量上传、跨屏粘贴、点击选择</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 relative flex items-center justify-center p-8">
               <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} 
                 className={`max-w-full max-h-full object-contain rounded-2xl shadow-3xl bg-black/60 ${toolMode === 'manual' ? 'cursor-crosshair' : 'cursor-default'}`} />
               
               {toolMode === 'manual' && (
                 <div className="absolute top-12 left-1/2 -translate-x-1/2 flex items-center gap-5 bg-black/80 backdrop-blur-md border border-brand-accent/30 text-brand-accent px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-3xl z-20">
                   <div className="flex items-center gap-2"><div className="w-2 h-2 bg-brand-accent rounded-full animate-ping" /><span>{manualTool.toUpperCase()} MODE</span></div>
                   <div className="w-px h-3 bg-white/10" />
                   <span className="text-white/60 italic tracking-normal">{manualTool === 'circle' ? '点击画面一键打补丁' : manualTool === 'point' ? '点击打点' : manualTool === 'rect' ? '拉框框选' : '涂抹套索'}</span>
                 </div>
               )}
            </div>
          )}

          {isProcessing && (
            <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center gap-6">
                <Loader2 className="w-12 h-12 text-brand-accent animate-spin" />
                <p className="text-[10px] text-brand-accent font-black uppercase tracking-[0.3em]">算法引擎正在校准面部特征...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
