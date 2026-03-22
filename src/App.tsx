/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Compass, 
  BrainCircuit, 
  ShieldAlert, 
  Activity, 
  FileOutput, 
  ChevronRight,
  ChevronDown,
  Settings,
  Plus,
  Zap,
  LineChart,
  Target,
  AlertTriangle,
  CheckCircle2,
  Users,
  Link as LinkIcon,
  ArrowRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState, ProductData, SimulationResult } from './types';
import { generateStrategyResponse, runSandboxSimulation, ModelMode, analyzeAssetFromLink, analyzeAssetFromFile } from './services/geminiService';
import ReactMarkdown from 'react-markdown';
import { 
  LineChart as ReLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Mock data for initial state
const INITIAL_PROJECT: ProductData = {
  id: "default-1",
  name: "产品巅峰 (Zenith Alpha)",
  coreValue: "通过多模型 AI 编排，使高端产品策略大众化。",
  usp: "多模型协同的动态沙盘推演引擎",
  productComposition: "基于 React 构建前端，结合 Gemini AI 提供深度推理，通过可视化图表展示推演结果。",
  userStories: [
    "作为创始人，我希望模拟不同获客成本下的盈利点",
    "作为产品经理，我希望通过 AI 压力测试发现逻辑漏洞"
  ],
  directCompetitors: "Product A, Service B",
  potentialThreats: "Big Tech X",
  userPersona: "科技领域的初级创业者和产品负责人。",
  gtmModel: 'PLG',
  gtmStrategy: {
    contentMarketing: 40,
    paidAds: 40,
    referral: 20,
    kFactor: 1.2,
    ltvCac: 3.4
  },
  scores: {
    feasibility: 85,
    marketPotential: 78,
    riskResilience: 65
  }
};

const MOCK_CHART_DATA = [
  { name: '1月', users: 400, revenue: 2400 },
  { name: '2月', users: 1200, revenue: 8000 },
  { name: '3月', users: 2100, revenue: 15000 },
  { name: '4月', users: 3800, revenue: 32000 },
  { name: '5月', users: 5100, revenue: 48000 },
  { name: '6月', users: 7200, revenue: 75000 },
];

const ScoreDetail = ({ label, score, desc }: { label: string, score: number, desc: string }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-end">
      <span className="text-sm font-sans font-semibold text-slate-900">{label}</span>
      <span className="text-lg font-mono font-bold text-zenith-accent">{score}</span>
    </div>
    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="h-full bg-zenith-accent"
      />
    </div>
    <p className="text-[10px] text-slate-500 leading-relaxed italic">{desc}</p>
  </div>
);

export default function App() {
  const [state, setState] = useState<AppState>({
    projects: [INITIAL_PROJECT],
    currentProjectId: 'default-1',
    simulations: [],
    activeModule: 'sandbox',
    activeSubModule: 'sandbox-engine',
    isSimulating: false,
  });

  const currentProject = state.projects.find(p => p.id === state.currentProjectId) || state.projects[0];

  const updateCurrentProject = (updates: Partial<ProductData>) => {
    setState(s => ({
      ...s,
      projects: s.projects.map(p => p.id === s.currentProjectId ? { ...p, ...updates } : p)
    }));
  };

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['sandbox']));

  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkInput, setLinkInput] = useState('');
  const handleLinkSubmit = async () => {
    if (!linkInput) return;
    setUploadState('uploading');
    try {
      const data = await analyzeAssetFromLink(linkInput);
      updateCurrentProject(data);
      setUploadState('success');
      setLinkInput('');
    } catch (error) {
      console.error("Link analysis failed:", error);
      setUploadState('idle');
      alert("分析失败，请检查链接或稍后重试");
    }
  };

  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState(s => ({ ...s, activeSubModule: 'input-upload' }));
    if (uploadState === 'idle') {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadState('uploading');
      try {
        const data = await analyzeAssetFromFile(file);
        updateCurrentProject(data);
        setUploadState('success');
      } catch (error) {
        console.error("File analysis failed:", error);
        setUploadState('idle');
        alert("文件分析失败，请稍后重试");
      }
    }
  };

  const toggleExpand = (module: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  };

  const setActiveModule = (module: AppState['activeModule'], subModule?: string) => {
    setState(s => ({
      ...s, 
      activeModule: module, 
      activeSubModule: subModule || getDefaultSubModule(module)
    }));
    // Also expand when setting active
    setExpandedModules(prev => new Set(prev).add(module));
  };

  const getDefaultSubModule = (module: AppState['activeModule']): string => {
    switch(module) {
      case 'input': return 'input-identity';
      case 'gtm': return 'gtm-model';
      case 'advisor': return 'advisor-chat';
      case 'sandbox': return 'sandbox-engine';
      case 'monitoring': return 'monitoring-live';
      case 'diagnostics': return 'diagnostics-radar';
      case 'generator': return 'generator-ppt';
      default: return '';
    }
  };

  const getPanelProps = (id: string, baseClassName: string) => {
    const isActive = state.activeSubModule === id;
    return {
      id,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        setState(s => ({ ...s, activeSubModule: id }));
      },
      className: `${baseClassName} cursor-pointer transition-all duration-300 ${isActive ? 'ring-2 ring-zenith-accent border-transparent shadow-lg shadow-zenith-accent/10' : 'hover:border-slate-300'}`
    };
  };

  useEffect(() => {
    if (state.activeSubModule) {
      setTimeout(() => {
        const element = document.getElementById(state.activeSubModule!);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  }, [state.activeSubModule, state.activeModule]);

  const [modelMode, setModelMode] = useState<ModelMode>('fast');
  const [advisorChat, setAdvisorChat] = useState<{role: string, content: string}[]>([]);
  const [chatInput, setChatInput] = useState("");

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    const newUserMsg = { role: 'user', content: chatInput };
    setAdvisorChat(prev => [...prev, newUserMsg]);
    setChatInput("");
    
    const response = await generateStrategyResponse(chatInput, modelMode);
    setAdvisorChat(prev => [...prev, { role: 'assistant', content: response || "No response" }]);
  };

  const runSimulation = async (scenario: string) => {
    setState(prev => ({ ...prev, isSimulating: true }));
    const resultText = await runSandboxSimulation(scenario, currentProject);
    
    const newSim: SimulationResult = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      scenario,
      outcome: resultText?.includes("Success") || resultText?.includes("成功") ? "成功" : "检测到风险",
      risks: ["市场饱和", "高获客成本 (CAC)"],
      impact: "如果不解决，LTV 可能会下降 20%。",
      recommendations: ["转向 B2B", "优化入职流程"]
    };

    setState(prev => ({
      ...prev,
      simulations: [newSim, ...prev.simulations],
      isSimulating: false
    }));
  };

  return (
    <div className="flex h-screen bg-zenith-bg text-slate-700 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-72 border-r border-zenith-border bg-white flex flex-col z-20">
        <div className="p-8 flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-200 shadow-sm">
            <Compass className="w-5 h-5 text-zenith-accent" />
          </div>
          <div>
            <h1 className="font-sans font-bold text-2xl tracking-tighter text-slate-900">Zenith</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold -mt-1">Strategist</p>
          </div>
        </div>

        <nav className="flex-1 px-6 space-y-1 py-8 overflow-y-auto scrollbar-hide">
          <SidebarItem 
            icon={<LayoutDashboard size={18} />} 
            label="灵感实验室" 
            active={state.activeModule === 'input'} 
            isExpanded={expandedModules.has('input')}
            onToggleExpand={() => toggleExpand('input')}
            onClick={() => setActiveModule('input')}
            subItems={[
              { id: 'input-identity', label: '核心身份' },
              { id: 'input-stories', label: '用户故事' },
              { id: 'input-competition', label: '竞品格局' },
              { id: 'input-upload', label: '资产上传' },
              { id: 'input-tech', label: '技术底座' },
              { id: 'input-persona', label: '用户画像' }
            ]}
            activeSubId={state.activeSubModule}
            onSubClick={(id) => setState(s => ({...s, activeModule: 'input', activeSubModule: id}))}
          />
          <SidebarItem 
            icon={<Target size={18} />} 
            label="GTM 营销布局" 
            active={state.activeModule === 'gtm'} 
            isExpanded={expandedModules.has('gtm')}
            onToggleExpand={() => toggleExpand('gtm')}
            onClick={() => setActiveModule('gtm')}
            subItems={[
              { id: 'gtm-model', label: '增长模型' },
              { id: 'gtm-mix', label: '渠道配比' },
              { id: 'gtm-roi', label: '渠道 ROI' },
              { id: 'gtm-insights', label: 'AI 洞察' }
            ]}
            activeSubId={state.activeSubModule}
            onSubClick={(id) => setState(s => ({...s, activeModule: 'gtm', activeSubModule: id}))}
          />
          <SidebarItem 
            icon={<ShieldAlert size={18} />} 
            label="动态沙盘推演" 
            active={state.activeModule === 'sandbox'} 
            isExpanded={expandedModules.has('sandbox')}
            onToggleExpand={() => toggleExpand('sandbox')}
            onClick={() => setActiveModule('sandbox')}
            subItems={[
              { id: 'sandbox-engine', label: '推演引擎' },
              { id: 'sandbox-tuning', label: '参数调优' },
              { id: 'sandbox-history', label: '推演历史' }
            ]}
            activeSubId={state.activeSubModule}
            onSubClick={(id) => setState(s => ({...s, activeModule: 'sandbox', activeSubModule: id}))}
          />
          <SidebarItem 
            icon={<Activity size={18} />} 
            label="诊断与评分" 
            active={state.activeModule === 'diagnostics'} 
            isExpanded={expandedModules.has('diagnostics')}
            onToggleExpand={() => toggleExpand('diagnostics')}
            onClick={() => setActiveModule('diagnostics')}
            subItems={[
              { id: 'diagnostics-radar', label: '健康雷达' },
              { id: 'diagnostics-heatmap', label: '风险热图' },
              { id: 'diagnostics-breakdown', label: '评分透明化' }
            ]}
            activeSubId={state.activeSubModule}
            onSubClick={(id) => setState(s => ({...s, activeModule: 'diagnostics', activeSubModule: id}))}
          />
          <SidebarItem 
            icon={<LineChart size={18} />} 
            label="监控哨所" 
            active={state.activeModule === 'monitoring'} 
            isExpanded={expandedModules.has('monitoring')}
            onToggleExpand={() => toggleExpand('monitoring')}
            onClick={() => setActiveModule('monitoring')}
            subItems={[
              { id: 'monitoring-live', label: '实时指标' },
              { id: 'monitoring-sentiment', label: '情感趋势' },
              { id: 'monitoring-backtest', label: '预测回测' }
            ]}
            activeSubId={state.activeSubModule}
            onSubClick={(id) => setState(s => ({...s, activeModule: 'monitoring', activeSubModule: id}))}
          />
          <SidebarItem 
            icon={<FileOutput size={18} />} 
            label="资产生成" 
            active={state.activeModule === 'generator'} 
            isExpanded={expandedModules.has('generator')}
            onToggleExpand={() => toggleExpand('generator')}
            onClick={() => setActiveModule('generator')}
            subItems={[
              { id: 'generator-ppt', label: 'PPT 报告' },
              { id: 'generator-prd', label: 'PRD V2.0' },
              { id: 'generator-marketing', label: '营销素材' }
            ]}
            activeSubId={state.activeSubModule}
            onSubClick={(id) => setState(s => ({...s, activeModule: 'generator', activeSubModule: id}))}
          />
          <SidebarItem 
            icon={<BrainCircuit size={18} />} 
            label="进化顾问" 
            active={state.activeModule === 'advisor'} 
            isExpanded={expandedModules.has('advisor')}
            onToggleExpand={() => toggleExpand('advisor')}
            onClick={() => setActiveModule('advisor')}
            subItems={[
              { id: 'advisor-chat', label: '进化对话' },
              { id: 'advisor-knowledge', label: '知识库' },
              { id: 'advisor-history', label: '历史推演' }
            ]}
            activeSubId={state.activeSubModule}
            onSubClick={(id) => setState(s => ({...s, activeModule: 'advisor', activeSubModule: id}))}
          />
        </nav>

        <div className="p-6">
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer group">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-slate-900">416717472@qq.com</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">专业版 (Pro)</p>
            </div>
            <Settings size={14} className="text-slate-400 group-hover:rotate-90 transition-transform duration-500" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-24 flex items-center justify-between pl-6 pr-12 bg-white sticky top-0 z-10 border-b border-slate-100">
          <div className="flex gap-2 flex-1 overflow-x-auto items-end h-full pt-6 scrollbar-hide mr-8">
            {state.projects.map(p => (
              <div 
                key={p.id}
                onClick={() => setState(s => ({...s, currentProjectId: p.id}))}
                className={`group relative flex items-center gap-3 px-6 py-3 rounded-t-xl border-t border-x cursor-pointer transition-all min-w-32 max-w-xs flex-shrink-0 ${state.currentProjectId === p.id ? 'bg-white border-slate-200 text-zenith-accent z-10 before:absolute before:-bottom-px before:left-0 before:right-0 before:h-px before:bg-white' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100 shadow-inner'}`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${state.currentProjectId === p.id ? 'bg-zenith-accent shadow-[0_0_8px_rgba(0,122,255,0.4)]' : 'bg-slate-300 group-hover:bg-slate-400'}`} />
                <span className={`text-sm font-medium truncate flex-1 transition-colors ${state.currentProjectId === p.id ? 'text-slate-900' : 'text-slate-500'}`}>{p.name || '未命名项目'}</span>
                {state.projects.length > 1 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setState(s => {
                        const newProjects = s.projects.filter(proj => proj.id !== p.id);
                        return {
                          ...s,
                          projects: newProjects,
                          currentProjectId: s.currentProjectId === p.id ? newProjects[newProjects.length - 1].id : s.currentProjectId
                        };
                      });
                    }}
                    className="p-1 rounded-md hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 absolute right-2"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-2xl p-1">
              <button 
                onClick={() => setModelMode('fast')}
                className={`px-4 py-1.5 text-xs rounded-xl transition-all ${modelMode === 'fast' ? 'bg-slate-900 text-white font-bold' : 'text-slate-500 hover:text-slate-900'}`}
              >
                快速
              </button>
              <button 
                onClick={() => setModelMode('reasoning')}
                className={`px-4 py-1.5 text-xs rounded-xl transition-all ${modelMode === 'reasoning' ? 'bg-slate-900 text-white font-bold' : 'text-slate-500 hover:text-slate-900'}`}
              >
                深度
              </button>
            </div>
            <button 
              onClick={() => {
                const newId = Math.random().toString(36).substr(2, 9);
                setState(s => ({
                  ...s,
                  projects: [...s.projects, { ...INITIAL_PROJECT, id: newId, name: `未命名项目 ${s.projects.length + 1}` }],
                  currentProjectId: newId,
                  activeModule: 'input'
                }));
              }}
              className="bg-slate-900 text-white px-6 py-2 rounded-2xl text-sm font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-md shrink-0"
            >
              <Plus size={18} />
              新建项目
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-12 py-8 scrollbar-hide">
          <AnimatePresence mode="wait">
            {state.activeModule === 'sandbox' && (
              <motion.div 
                key="sandbox"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-12"
              >
                <div className="flex justify-between items-end">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-zenith-accent font-bold">
                      <ShieldAlert size={12} />
                      Simulation Engine
                    </div>
                    <h2 className="text-4xl font-sans font-bold tracking-tight text-slate-900">动态沙盘推演</h2>
                    <p className="text-slate-500 max-w-lg text-sm">模拟 ICP 渗透、财务模型及极端变量压力测试。</p>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => runSimulation("极端测试：iOS 系统更新内置核心 AI 功能")}
                      disabled={state.isSimulating}
                      className="glass-panel px-6 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 disabled:opacity-50 group border-red-500/20"
                    >
                      <AlertTriangle size={16} className="text-red-500" />
                      系统更新冲击
                    </button>
                    <button 
                      onClick={() => runSimulation("爆发测试：单个 KOL 引爆病毒式增长")}
                      disabled={state.isSimulating}
                      className="glass-panel px-6 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 disabled:opacity-50 group"
                    >
                      <Zap size={16} className="text-yellow-500 group-hover:scale-125 transition-transform" />
                      爆发测试
                    </button>
                  </div>
                </div>

                <div {...getPanelProps("sandbox-engine", "grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch p-2 rounded-3xl")}>
                  <div className="lg:col-span-8 glass-panel p-8 min-h-[500px] relative overflow-hidden group h-full">
                    <div className="flex justify-between items-center mb-10">
                      <h3 className="text-lg font-sans font-semibold flex items-center gap-3">
                        ICP 渗透与财务推演
                      </h3>
                      <div className="flex gap-6 text-[10px] uppercase tracking-widest font-bold">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-slate-400">用户渗透</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          <span className="text-slate-400">损益平衡点</span>
                        </div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height="80%">
                      <AreaChart data={MOCK_CHART_DATA}>
                        <defs>
                          <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#007AFF" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#007AFF" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dx={-10} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', color: '#0f172a' }}
                          itemStyle={{ fontSize: '12px' }}
                        />
                        <Area type="monotone" dataKey="users" stroke="#10b981" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={3} />
                        <Area type="monotone" dataKey="revenue" stroke="#007AFF" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="lg:col-span-4 flex flex-col gap-8 h-full">
                    <StatCard label="LTV / CAC 比率" value="3.4x" trend="+0.2" />
                    <StatCard label="云端推理成本 (Est.)" value="$0.12/req" trend="稳定" />
                    <StatCard label="损益平衡周期" value="8.5 个月" trend="-1.2" />
                    <div {...getPanelProps("sandbox-tuning", "glass-panel p-8 space-y-6 border-slate-200 bg-white flex-1")}>
                      <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500 flex items-center gap-3">
                        <Settings size={14} className="text-blue-500" />
                        参数调优 / Parameter Tuning
                      </h3>
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-slate-600">市场波动率</label>
                          <input type="range" className="w-full accent-blue-500" />
                          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-slate-600">竞争强度</label>
                          <input type="range" className="w-full accent-red-500" />
                          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>Low</span>
                            <span>Medium</span>
                            <span>High</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div {...getPanelProps("sandbox-history", "space-y-6 p-4 rounded-3xl")}>
                  <div className="flex items-center gap-4">
                    <h3 className="text-xl font-sans font-bold text-slate-900">推演历史</h3>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {state.simulations.map((sim, index) => (
                      <motion.div 
                        key={sim.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="glass-panel p-6 hover:bg-slate-50 group cursor-pointer relative"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[10px] font-mono text-slate-500">{new Date(sim.timestamp).toLocaleTimeString()}</span>
                          <div className="flex items-center gap-3">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sim, null, 2));
                                  const downloadAnchorNode = document.createElement('a');
                                  downloadAnchorNode.setAttribute("href",     dataStr);
                                  downloadAnchorNode.setAttribute("download", `simulation-${sim.id}.json`);
                                  document.body.appendChild(downloadAnchorNode);
                                  downloadAnchorNode.click();
                                  downloadAnchorNode.remove();
                                }}
                                className="text-[10px] text-slate-500 hover:text-zenith-accent flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm"
                              >
                                JSON
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const headers = ['ID', 'Timestamp', 'Scenario', 'Outcome', 'Impact', 'Risks', 'Recommendations', 'Inference Cost'];
                                  const row = [
                                    sim.id,
                                    new Date(sim.timestamp).toISOString(),
                                    `"${sim.scenario.replace(/"/g, '""')}"`,
                                    sim.outcome,
                                    `"${sim.impact.replace(/"/g, '""')}"`,
                                    `"${sim.risks.join(', ')}"`,
                                    `"${sim.recommendations.join(', ')}"`,
                                    sim.inferenceCost || ''
                                  ];
                                  const csvContent = headers.join(',') + '\n' + row.join(',');
                                  const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
                                  const downloadAnchorNode = document.createElement('a');
                                  downloadAnchorNode.setAttribute("href",     dataStr);
                                  downloadAnchorNode.setAttribute("download", `simulation-${sim.id}.csv`);
                                  document.body.appendChild(downloadAnchorNode);
                                  downloadAnchorNode.click();
                                  downloadAnchorNode.remove();
                                }}
                                className="text-[10px] text-slate-500 hover:text-zenith-accent flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm"
                              >
                                CSV
                              </button>
                            </div>
                            <div className={`w-2 h-2 rounded-full ${sim.outcome === '成功' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          </div>
                        </div>
                        <h4 className="font-medium text-slate-900 mb-2 group-hover:text-zenith-accent transition-colors">{sim.scenario}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">{sim.impact}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2">
                            {sim.risks.map(risk => (
                              <span key={risk} className="text-[9px] uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-md text-slate-600 border border-slate-200">{risk}</span>
                            ))}
                          </div>
                          {sim.inferenceCost && (
                            <span className="text-[10px] text-slate-500 font-mono">Cost: ${sim.inferenceCost}</span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setState(s => ({ ...s, activeModule: 'diagnostics' }))}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-all shadow-sm hover:shadow-md"
                  >
                    下一步：诊断与评分 <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {state.activeModule === 'advisor' && (
              <motion.div 
                key="advisor"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-[calc(100vh-12rem)] flex flex-col"
              >
                <div className="mb-8">
                  <h2 className="text-3xl font-sans font-bold tracking-tight text-slate-900">进化顾问 <span className="text-lg font-sans font-normal text-slate-400 ml-2">Evolutionary Advisor</span></h2>
                  <p className="text-slate-400 mt-1 text-sm tracking-wide">苏格拉底式引导，通过深度对话完善你的产品愿景。</p>
                </div>

                <div className="flex-1 flex gap-8 overflow-hidden">
                  <div {...getPanelProps("advisor-chat", "flex-1 glass-panel flex flex-col overflow-hidden border-slate-200 bg-white")}>
                    <div className="px-8 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-zenith-accent animate-pulse" />
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">Zenith AI 实时在线</span>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.1em] font-mono text-slate-500">
                        Session ID: {Math.random().toString(36).substring(7).toUpperCase()}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
                      {advisorChat.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-60">
                          <div className="w-20 h-20 rounded-full border border-dashed border-slate-300 flex items-center justify-center">
                            <BrainCircuit size={32} className="text-zenith-accent" />
                          </div>
                          <div className="max-w-sm">
                            <p className="text-lg font-sans font-semibold text-slate-900 mb-2">“未经审视的产品不值得发布。”</p>
                            <p className="text-sm text-slate-500">询问我关于用户画像、定价策略或功能优先级的问题，让我们开始深度推演。</p>
                          </div>
                        </div>
                      )}
                      {advisorChat.map((msg, i) => (
                        <motion.div 
                          key={i} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[75%] px-6 py-4 rounded-[2rem] ${
                            msg.role === 'user' 
                              ? 'bg-slate-900 text-white font-medium shadow-xl shadow-slate-200' 
                              : 'bg-slate-100 border border-slate-200'
                          }`}>
                            <div className={`markdown-body prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : 'prose-neutral'}`}>
                              <ReactMarkdown>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    
                    <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                      <div className="relative flex items-center">
                        <input 
                          type="text" 
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="在此输入你的想法 or 问题..."
                          className="w-full bg-white border border-slate-200 rounded-full pl-6 pr-16 py-4 outline-none focus:border-zenith-accent/30 focus:ring-4 focus:ring-zenith-accent/5 transition-all font-light tracking-wide text-slate-900 placeholder:text-slate-400"
                        />
                        <button 
                          onClick={handleSendMessage}
                          className="absolute right-2 p-3 bg-zenith-accent text-white rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg shadow-zenith-accent/20"
                        >
                          <Zap size={18} fill="currentColor" />
                        </button>
                      </div>
                      <p className="text-[9px] text-center text-slate-500 mt-4 uppercase tracking-[0.2em]">由 Zenith Deep-Reasoning 引擎驱动</p>
                    </div>
                  </div>

                  <div className="w-80 flex flex-col gap-6 hidden xl:block">
                    <div {...getPanelProps("advisor-knowledge", "glass-panel p-8 space-y-6 bg-slate-50 border-slate-200")}>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">知识库 / Knowledge Base</h3>
                      <div className="space-y-4">
                        <div className="p-4 bg-white border border-slate-100 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-slate-50 transition-all">
                          <div className="flex items-center gap-3">
                            <FileOutput size={16} className="text-blue-500" />
                            <span className="text-xs text-slate-700">行业白皮书.pdf</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">2.4MB</span>
                        </div>
                        <div className="p-4 bg-white border border-slate-100 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-slate-50 transition-all">
                          <div className="flex items-center gap-3">
                            <FileOutput size={16} className="text-emerald-500" />
                            <span className="text-xs text-slate-700">竞品分析报告.docx</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">1.1MB</span>
                        </div>
                      </div>
                    </div>
                    
                    <div {...getPanelProps("advisor-history", "glass-panel p-8 space-y-4 flex-1 border-slate-200 bg-white")}>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">历史推演 / History</h3>
                      <div className="space-y-4">
                        {[1, 2].map(i => (
                          <div key={i} className="group cursor-pointer">
                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-1">2026.03.{20-i}</p>
                            <p className="text-xs text-slate-400 group-hover:text-slate-900 transition-colors line-clamp-2">关于“{currentProject?.name}”的定价策略深度推演报告...</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setState(s => ({ ...s, activeModule: 'input' }))}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-all shadow-sm hover:shadow-md"
                  >
                    重新开始：灵感实验室 <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {state.activeModule === 'input' && (
              <motion.div 
                key="input"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12 max-w-5xl"
              >
                <div>
                  <h2 className="text-3xl font-sans font-bold tracking-tight text-slate-900">灵感实验室 <span className="text-lg font-sans font-normal text-slate-400 ml-2">Idea Genesis</span></h2>
                  <p className="text-slate-400 mt-1 text-sm tracking-wide">定义产品的核心 DNA，将零散的想法转化为结构化的语义资产。</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                  {/* Row 1: Identity & Upload */}
                  <div {...getPanelProps("input-identity", "lg:col-span-8 glass-panel p-8 space-y-6 border-slate-200 bg-white h-full")}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500 flex items-center gap-3">
                        <Compass size={14} className="text-zenith-accent" />
                        核心身份 / Identity
                      </h3>
                      <span className="text-[10px] font-mono text-slate-500">ID: PRD-001</span>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 focus-within:border-zenith-accent/30 focus-within:bg-white transition-all">
                        <label className="text-[9px] uppercase tracking-widest font-bold text-slate-400 ml-1">产品名称 (Product Name)</label>
                        <input 
                          type="text" 
                          value={currentProject?.name}
                          onChange={(e) => updateCurrentProject({ name: e.target.value })}
                          className="w-full bg-transparent border-none outline-none text-sm font-medium leading-relaxed text-slate-900 placeholder:text-slate-300"
                          placeholder="输入产品名称..."
                        />
                      </div>
                      
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 focus-within:border-zenith-accent/30 focus-within:bg-white transition-all">
                        <label className="text-[9px] uppercase tracking-widest font-bold text-slate-400 ml-1">产品构成 (Product Composition)</label>
                        <textarea 
                          rows={3}
                          value={currentProject?.productComposition || ''}
                          onChange={(e) => updateCurrentProject({ productComposition: e.target.value })}
                          className="w-full bg-transparent border-none outline-none text-sm font-medium leading-relaxed resize-none text-slate-900 placeholder:text-slate-300"
                          placeholder="一句话描述产品设计思路..."
                        />
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 focus-within:border-zenith-accent/30 focus-within:bg-white transition-all">
                        <label className="text-[9px] uppercase tracking-widest font-bold text-slate-400 ml-1">核心价值主张 (Core Value)</label>
                        <input 
                          type="text" 
                          value={currentProject?.coreValue}
                          onChange={(e) => updateCurrentProject({ coreValue: e.target.value })}
                          className="w-full bg-transparent border-none outline-none text-sm font-medium leading-relaxed text-slate-900 placeholder:text-slate-300"
                          placeholder="描述你的产品如何解决核心痛点..."
                        />
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 focus-within:border-zenith-accent/30 focus-within:bg-white transition-all">
                        <label className="text-[9px] uppercase tracking-widest font-bold text-slate-400 ml-1">核心卖点 (USP)</label>
                        <input 
                          type="text" 
                          value={currentProject?.usp}
                          onChange={(e) => updateCurrentProject({ usp: e.target.value })}
                          className="w-full bg-transparent border-none outline-none text-sm font-medium leading-relaxed text-slate-900 placeholder:text-slate-300"
                          placeholder="输入或由 AI 提取核心卖点..."
                        />
                      </div>
                    </div>
                  </div>

                  <div 
                    {...getPanelProps("input-upload", "lg:col-span-4 glass-panel p-8 bg-slate-50/30 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-slate-50 hover:border-zenith-accent/40 hover:shadow-md transition-all h-full min-h-[320px]")}
                    onClick={handleUploadClick}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleFileChange} 
                      accept=".pdf,.md,.docx"
                    />
                    {uploadState === 'idle' && (
                      <div className="w-full flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full border border-slate-200 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 bg-white">
                          <FileOutput size={28} className="text-slate-400 group-hover:text-zenith-accent transition-colors" />
                        </div>
                        <div className="max-w-xs space-y-3 mb-6">
                          <h4 className="text-base font-sans font-bold text-slate-900">多模态资产上传</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">点击上传 PDF/Markdown/Docx 文件</p>
                        </div>
                        
                        <div className="flex items-center w-full max-w-xs mb-6">
                          <div className="flex-1 h-px bg-slate-200"></div>
                          <span className="px-3 text-[10px] text-slate-400 uppercase tracking-widest font-bold">OR</span>
                          <div className="flex-1 h-px bg-slate-200"></div>
                        </div>

                        <div className="w-full max-w-sm flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <div className="relative flex-1">
                            <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                              type="text" 
                              placeholder="粘贴文章或竞品链接..." 
                              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-zenith-accent/50 focus:ring-2 focus:ring-zenith-accent/10 transition-all text-slate-700 placeholder:text-slate-400"
                              value={linkInput}
                              onChange={e => setLinkInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && linkInput) handleLinkSubmit(); }}
                            />
                          </div>
                          <button 
                            onClick={handleLinkSubmit}
                            disabled={!linkInput}
                            className="px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                          >
                            提取
                          </button>
                        </div>
                      </div>
                    )}
                    {uploadState === 'uploading' && (
                      <div className="space-y-4 flex flex-col items-center">
                        <div className="w-8 h-8 border-2 border-zenith-accent border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-medium text-slate-600">正在解析资产并提取逻辑...</p>
                      </div>
                    )}
                    {uploadState === 'success' && (
                      <div className="space-y-6 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
                          <CheckCircle2 size={28} className="text-emerald-500" />
                        </div>
                        <div className="max-w-xs space-y-2">
                          <h4 className="text-base font-sans font-bold text-slate-900">解析完成</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">已成功提取核心价值与用户故事。</p>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveModule('gtm'); }}
                          className="mt-4 px-6 py-2.5 bg-zenith-accent text-white rounded-full text-sm font-bold shadow-lg shadow-zenith-accent/20 hover:bg-blue-600 transition-colors flex items-center gap-2"
                        >
                          下一步：GTM 营销布局
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Stories & Competition & Tech/Persona */}
                  <div {...getPanelProps("input-stories", "lg:col-span-4 glass-panel p-8 space-y-6 border-slate-200 bg-white h-full")}>
                    <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500 flex items-center gap-3">
                      <LayoutDashboard size={14} className="text-blue-500" />
                      用户故事 / User Stories
                    </h3>
                    <div className="space-y-4">
                      {currentProject?.userStories?.map((story, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus-within:border-zenith-accent/30 focus-within:bg-white transition-all group relative">
                          <CheckCircle2 size={14} className="text-emerald-500 mt-1 flex-shrink-0" />
                          <textarea 
                            value={story}
                            onChange={(e) => {
                              const newStories = [...(currentProject?.userStories || [])];
                              newStories[i] = e.target.value;
                              updateCurrentProject({ userStories: newStories });
                            }}
                            className="w-full bg-transparent border-none outline-none text-sm font-medium leading-relaxed text-slate-900 placeholder:text-slate-300 resize-none overflow-hidden"
                            rows={2}
                            placeholder="输入用户故事..."
                          />
                        </div>
                      ))}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          updateCurrentProject({ userStories: [...(currentProject?.userStories || []), ""] });
                        }}
                        className="w-full py-3 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus size={14} /> 添加用户故事
                      </button>
                    </div>
                  </div>

                  <div {...getPanelProps("input-competition", "lg:col-span-4 glass-panel p-8 space-y-6 border-slate-200 bg-white h-full flex flex-col")}>
                    <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500 flex items-center gap-3">
                      <Target size={14} className="text-orange-500" />
                      竞品格局 / Competition
                    </h3>
                    <div className="space-y-4 flex-1 flex flex-col">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 focus-within:border-zenith-accent/30 focus-within:bg-white transition-all flex-1 flex flex-col">
                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest ml-1">直接竞品 (Direct Competitors)</p>
                        <textarea 
                          value={currentProject?.directCompetitors || ''}
                          onChange={(e) => updateCurrentProject({ directCompetitors: e.target.value })}
                          className="w-full flex-1 bg-transparent border-none outline-none text-sm font-medium leading-relaxed text-slate-900 placeholder:text-slate-300 resize-none"
                          placeholder="输入直接竞品..."
                        />
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 focus-within:border-zenith-accent/30 focus-within:bg-white transition-all flex-1 flex flex-col">
                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest ml-1">潜在威胁 (Potential Threats)</p>
                        <textarea 
                          value={currentProject?.potentialThreats || ''}
                          onChange={(e) => updateCurrentProject({ potentialThreats: e.target.value })}
                          className="w-full flex-1 bg-transparent border-none outline-none text-sm font-medium leading-relaxed text-slate-900 placeholder:text-slate-300 resize-none"
                          placeholder="输入潜在威胁..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-4 glass-panel p-8 space-y-6 border-slate-200 bg-white h-full flex flex-col">
                    <div {...getPanelProps("input-persona", "space-y-6 flex-1 flex flex-col rounded-2xl")}>
                      <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500 flex items-center gap-3">
                        <Users size={14} className="text-emerald-500" />
                        用户画像 / Persona
                      </h3>
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 focus-within:border-zenith-accent/30 focus-within:bg-white transition-all flex-1 flex flex-col">
                        <label className="text-[9px] uppercase tracking-widest font-bold text-slate-400 ml-1">用户画像 (User Persona)</label>
                        <textarea 
                          value={currentProject?.userPersona}
                          onChange={(e) => updateCurrentProject({ userPersona: e.target.value })}
                          className="w-full flex-1 bg-transparent border-none outline-none text-sm font-medium leading-relaxed text-slate-900 placeholder:text-slate-300 resize-none"
                          placeholder="描述目标用户画像..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setState(s => ({ ...s, activeModule: 'gtm' }))}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-all shadow-sm hover:shadow-md"
                  >
                    下一步：GTM 营销布局 <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {state.activeModule === 'gtm' && (
              <motion.div 
                key="gtm"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12"
              >
                <div>
                  <h2 className="text-3xl font-sans font-bold tracking-tight text-slate-900">GTM 营销布局 <span className="text-lg font-sans font-normal text-slate-400 ml-2">Marketing Strategizer</span></h2>
                  <p className="text-slate-400 mt-1 text-sm tracking-wide">设计你的获客配比，通过 AI 预测各渠道的长期 ROI 与增长潜力。</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                  {/* Row 1: Model & ROI */}
                  <div {...getPanelProps("gtm-model", "lg:col-span-7 glass-panel p-8 space-y-6 border-slate-200 bg-white h-full")}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500">增长模型选择 / Model Selection</h3>
                      <div className="flex gap-3">
                        {['PLG', 'SLG', 'Content'].map(m => (
                          <div key={m} className="relative group">
                            <button 
                              onClick={() => updateCurrentProject({ gtmModel: m as any })}
                              className={`px-5 py-2 rounded-full text-[10px] font-bold transition-all ${currentProject?.gtmModel === m ? 'bg-zenith-accent text-white shadow-lg shadow-zenith-accent/20' : 'bg-slate-100 text-slate-500 hover:text-slate-900'}`}
                            >
                              {m}
                            </button>
                            {m === 'PLG' && (
                              <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 w-64 bg-slate-900 text-white text-xs font-normal leading-relaxed p-4 rounded-2xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 pointer-events-none z-50 shadow-2xl">
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45 rounded-sm"></div>
                                <div className="relative z-10">将产品本身打造为获客、转化与留存的核心引擎，通过让用户“先体验价值，后付费订阅”来实现低成本的病毒式增长</div>
                              </div>
                            )}
                            {m === 'SLG' && (
                              <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 w-64 bg-slate-900 text-white text-xs font-normal leading-relaxed p-4 rounded-2xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 pointer-events-none z-50 shadow-2xl">
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45 rounded-sm"></div>
                                <div className="relative z-10">依靠销售团队的主动触达、深度演示与一对一谈判，针对高客单价或复杂需求客户实现精准获客与价值转化。</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-12">
                      <GtmSlider 
                        label="内容营销" 
                        value={currentProject?.gtmStrategy.contentMarketing || 0} 
                        onChange={(v) => updateCurrentProject({ gtmStrategy: { ...currentProject!.gtmStrategy, contentMarketing: v } })}
                        color="bg-emerald-400"
                      />
                      <GtmSlider 
                        label="付费投放" 
                        value={currentProject?.gtmStrategy.paidAds || 0} 
                        onChange={(v) => updateCurrentProject({ gtmStrategy: { ...currentProject!.gtmStrategy, paidAds: v } })}
                        color="bg-blue-400"
                      />
                      <GtmSlider 
                        label="推荐与裂变" 
                        value={currentProject?.gtmStrategy.referral || 0} 
                        onChange={(v) => updateCurrentProject({ gtmStrategy: { ...currentProject!.gtmStrategy, referral: v } })}
                        color="bg-purple-400"
                      />
                    </div>
                  </div>

                  <div {...getPanelProps("gtm-roi", "lg:col-span-5 glass-panel p-8 space-y-6 border-slate-200 bg-white h-full")}>
                    <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500">预测渠道 ROI / Projections</h3>
                    <div className="space-y-8">
                      <RoiItem label="TikTok 广告" roi="4.2x" confidence={85} />
                      <RoiItem label="领英内容" roi="2.8x" confidence={92} />
                      <RoiItem label="谷歌搜索" roi="1.5x" confidence={70} />
                    </div>
                  </div>

                  {/* Row 2: Mix & Insights */}
                  <div {...getPanelProps("gtm-mix", "lg:col-span-7 glass-panel p-8 space-y-6 border-slate-200 bg-white h-full")}>
                    <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500">渠道配比可视化 / Channel Mix</h3>
                    <div className="h-[250px] w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: '内容营销', value: currentProject?.gtmStrategy.contentMarketing || 0 },
                              { name: '付费投放', value: currentProject?.gtmStrategy.paidAds || 0 },
                              { name: '推荐与裂变', value: currentProject?.gtmStrategy.referral || 0 },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#3b82f6" />
                            <Cell fill="#a855f7" />
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', fontSize: '12px', color: '#0f172a' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6">
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" /> 内容
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-blue-500" /> 付费
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-purple-500" /> 推荐
                      </div>
                    </div>
                  </div>

                  <div {...getPanelProps("gtm-insights", "lg:col-span-5 glass-panel p-8 bg-blue-50 border-blue-200 relative overflow-hidden group h-full min-h-[250px] flex flex-col justify-center")}>
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <BrainCircuit size={80} className="text-zenith-accent" />
                    </div>
                    <div className="relative z-10">
                      <p className="text-[10px] text-zenith-accent font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Zap size={12} fill="currentColor" />
                        AI 渠道洞察
                      </p>
                      <p className="text-sm text-slate-700 font-sans leading-relaxed">
                        “基于你的 {currentProject?.gtmModel} 模式，建议在初期重点投入‘内容营销’以建立品牌信任，随后通过‘推荐与裂变’降低获客成本。”
                      </p>
                    </div>
                  </div>

                  {/* Row 3: Stats */}
                  <div className="lg:col-span-7 grid grid-cols-2 gap-8">
                    <div className="glass-panel p-8 space-y-5 h-full">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-slate-600">预期裂变系数 (κ)</label>
                      <div className="flex items-end gap-5">
                        <span className="text-4xl font-sans font-bold text-slate-900">{currentProject?.gtmStrategy.kFactor}</span>
                        <span className="text-xs text-emerald-400 mb-1.5">High Viral</span>
                      </div>
                    </div>
                    <div className="glass-panel p-8 space-y-5 h-full">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-slate-600">LTV / CAC 预估</label>
                      <div className="flex items-end gap-5">
                        <span className="text-4xl font-sans font-bold text-slate-900">{currentProject?.gtmStrategy.ltvCac}x</span>
                        <span className="text-xs text-emerald-400 mb-1.5">Healthy</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setState(s => ({ ...s, activeModule: 'sandbox' }))}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-all shadow-sm hover:shadow-md"
                  >
                    下一步：动态沙盘推演 <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {state.activeModule === 'monitoring' && (
              <motion.div 
                key="monitoring"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12"
              >
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-sans font-bold tracking-tight text-slate-900">哨所监控 <span className="text-lg font-sans font-normal text-slate-400 ml-2">Sentinel Monitoring</span></h2>
                    <p className="text-slate-400 mt-1 text-sm tracking-wide">实时回测：沙盘预测 vs. 真实增长情况的深度偏差分析。</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      AI Personas Active (1000)
                    </div>
                  </div>
                </div>

                <div {...getPanelProps("monitoring-live", "grid grid-cols-1 md:grid-cols-3 gap-6 p-2 rounded-3xl")}>
                  <MetricCard label="活跃用户 (MAU)" value="12,480" change="12.4%" trend="up" />
                  <MetricCard label="情感指数 (Sentiment)" value="88%" change="2.1%" trend="up" />
                  <MetricCard label="获客成本 (CAC)" value="$12.40" change="4.2%" trend="down" />
                </div>

                <div {...getPanelProps("monitoring-sentiment", "glass-panel p-8 h-[300px] border-slate-200 bg-white")}>
                  <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500 mb-8 flex items-center gap-3">
                    <Activity size={14} className="text-emerald-500" />
                    用户情感趋势 / Sentiment Trend
                  </h3>
                  <ResponsiveContainer width="100%" height="80%">
                    <AreaChart data={MOCK_CHART_DATA}>
                      <defs>
                        <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tick={{ dy: 10 }} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tick={{ dx: -10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', fontSize: '12px', color: '#0f172a' }} />
                      <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorSentiment)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div {...getPanelProps("monitoring-backtest", "grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch p-2 rounded-3xl")}>
                  <div className="lg:col-span-8 glass-panel p-8 min-h-[500px] border-slate-200 bg-white h-full">
                    <div className="flex justify-between items-center mb-10">
                      <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500 flex items-center gap-3">
                        <Activity size={14} className="text-zenith-accent" />
                        预测回测 / Backtest
                      </h3>
                    </div>
                    <ResponsiveContainer width="100%" height="80%">
                      <ReLineChart data={MOCK_CHART_DATA}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tick={{ dy: 10 }} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tick={{ dx: -10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', fontSize: '12px', color: '#0f172a' }} />
                        <Line type="monotone" dataKey="users" stroke="#cbd5e1" strokeDasharray="8 8" strokeWidth={1.5} dot={false} />
                        <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} />
                      </ReLineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="lg:col-span-4 glass-panel p-8 space-y-6 border-slate-200 bg-white h-full">
                    <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500">影子用户回测 / AI Personas</h3>
                    <div className="space-y-6">
                      <div className="p-6 bg-slate-50 border border-slate-100 rounded-xl">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">转化瓶颈识别</p>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          影子用户在“定价页面”停留时间过长，流失率达 18%。建议简化定价层级。
                        </p>
                      </div>
                      <div className="p-6 bg-slate-50 border border-slate-100 rounded-xl">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">情感溯源</p>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          负面情绪主要源于“移动端响应速度”，已溯源至核心渲染引擎。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setState(s => ({ ...s, activeModule: 'generator' }))}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-all shadow-sm hover:shadow-md"
                  >
                    下一步：资产生成 <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {state.activeModule === 'diagnostics' && (
              <motion.div 
                key="diagnostics"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-12"
              >
                <div>
                  <h2 className="text-3xl font-sans font-bold tracking-tight text-slate-900">诊断与评分系统 <span className="text-lg font-sans font-normal text-slate-400 ml-2">Scoring & Diagnostics</span></h2>
                  <p className="text-slate-400 mt-1 text-sm tracking-wide">基于可行性、市场潜力与风险抵御力的多维度量化评估。</p>
                </div>

                <div {...getPanelProps("diagnostics-radar", "grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch p-2 rounded-3xl")}>
                  <div className="lg:col-span-5 glass-panel p-8 flex flex-col items-center justify-center border-slate-200 bg-white h-full min-h-[500px]">
                    <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500 mb-10 self-start">产品健康度雷达 / Health Radar</h3>
                    <div className="w-full h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                          { subject: '可行性 (Sf)', A: currentProject?.scores?.feasibility || 0, fullMark: 100 },
                          { subject: '市场潜力 (Sm)', A: currentProject?.scores?.marketPotential || 0, fullMark: 100 },
                          { subject: '风险抵御 (Sr)', A: currentProject?.scores?.riskResilience || 0, fullMark: 100 },
                        ]}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar name="Zenith Score" dataKey="A" stroke="#007AFF" fill="#007AFF" fillOpacity={0.3} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-8 text-center">
                      <p className="text-5xl font-sans font-bold text-slate-900">76<span className="text-xl text-slate-400 ml-1">/100</span></p>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zenith-accent font-bold mt-2">Overall Health Score</p>
                    </div>
                  </div>

                  <div className="lg:col-span-7 flex flex-col gap-8 h-full">
                    <div {...getPanelProps("diagnostics-breakdown", "glass-panel p-8 space-y-6 border-slate-200 bg-white flex-1")}>
                      <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500">评分逻辑透明化 / Transparency</h3>
                      <div className="space-y-8">
                        <ScoreDetail 
                          label="可行性分数 (Sf)" 
                          score={currentProject?.scores?.feasibility || 0} 
                          desc="基于技术成本与当前 AI 能力的匹配度。当前扣分项：云端推理成本略高。"
                        />
                        <ScoreDetail 
                          label="市场潜力分数 (Sm)" 
                          score={currentProject?.scores?.marketPotential || 0} 
                          desc="基于 LTV/CAC 模型和竞品重合度。当前优势：细分市场渗透率预测较高。"
                        />
                        <ScoreDetail 
                          label="风险抵御力 (Sr)" 
                          score={currentProject?.scores?.riskResilience || 0} 
                          desc="基于在极端变量模拟中的表现。需注意：对获客成本波动的敏感度较高。"
                        />
                      </div>
                    </div>

                    <div {...getPanelProps("diagnostics-heatmap", "glass-panel p-8 space-y-6 border-slate-200 bg-white")}>
                      <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500">风险热图 / Risk Heatmap</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <RiskCell label="技术性" level="low" />
                        <RiskCell label="市场性" level="medium" />
                        <RiskCell label="竞争性" level="high" />
                        <RiskCell label="合规性" level="low" />
                        <RiskCell label="财务性" level="medium" />
                        <RiskCell label="运营性" level="low" />
                      </div>
                    </div>
                    
                    <div className="p-8 bg-slate-50 border border-slate-100 rounded-2xl">
                      <p className="text-xs text-slate-500 leading-relaxed">
                        <span className="text-zenith-accent font-bold mr-2">计算公式：</span>
                        $Score = (S_f \times 0.4) + (S_m \times 0.4) + (S_r \times 0.2)$
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setState(s => ({ ...s, activeModule: 'monitoring' }))}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-all shadow-sm hover:shadow-md"
                  >
                    下一步：哨所监控 <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {state.activeModule === 'generator' && (
              <motion.div 
                key="generator"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12"
              >
                <div>
                  <h2 className="text-3xl font-sans font-bold tracking-tight text-slate-900">一键资产生成 <span className="text-lg font-sans font-normal text-slate-400 ml-2">Asset Generator</span></h2>
                  <p className="text-slate-400 mt-1 text-sm tracking-wide">将推演数据、评分与历史记录转化为汇报级资产。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div id="generator-ppt" className="glass-panel p-8 space-y-6 border-slate-200 bg-white group cursor-pointer hover:bg-slate-50 transition-all">
                    <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileOutput size={32} className="text-indigo-500" />
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-xl font-sans font-bold text-slate-900">汇报级 PPT 报告</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">包含自动生成的增长图表、竞品对比图及沙盘推演结论。适用于融资或内部汇报。</p>
                      <button className="text-[10px] uppercase tracking-widest font-bold text-indigo-500 flex items-center gap-2">
                        预览大纲 <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  <div id="generator-prd" className="glass-panel p-8 space-y-6 border-slate-200 bg-white group cursor-pointer hover:bg-slate-50 transition-all">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <CheckCircle2 size={32} className="text-emerald-500" />
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-xl font-sans font-bold text-slate-900">PRD 更新版 (V2.0)</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">经过 AI 优化后的最终开发文档，包含结构化 User Stories 与技术实现建议。</p>
                      <button className="text-[10px] uppercase tracking-widest font-bold text-emerald-500 flex items-center gap-2">
                        查看文档 <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  <div id="generator-marketing" className="glass-panel p-8 space-y-6 border-slate-200 bg-white group cursor-pointer hover:bg-slate-50 transition-all">
                    <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Zap size={32} className="text-orange-500" />
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-xl font-sans font-bold text-slate-900">营销素材包</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">自动生成 TikTok 脚本、领英推文及产品介绍短片大纲。一键开启冷启动。</p>
                      <button className="text-[10px] uppercase tracking-widest font-bold text-orange-500 flex items-center gap-2">
                        生成素材 <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setState(s => ({ ...s, activeModule: 'advisor' }))}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-all shadow-sm hover:shadow-md"
                  >
                    下一步：进化顾问 <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

    </div>
  );
}

function RiskCell({ label, level }: { label: string, level: 'low' | 'medium' | 'high' }) {
  const colors = {
    low: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    medium: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    high: 'bg-red-50 text-red-600 border-red-200'
  };
  return (
    <div className={`p-4 rounded-xl border ${colors[level]} text-center`}>
      <p className="text-[10px] uppercase font-bold tracking-widest mb-1">{label}</p>
      <p className="text-xs font-bold uppercase">{level}</p>
    </div>
  );
}

function SidebarItem({ 
  icon, 
  label, 
  active, 
  onClick, 
  subItems, 
  activeSubId, 
  onSubClick,
  isExpanded,
  onToggleExpand
}: { 
  icon: React.ReactNode, 
  label: string, 
  active?: boolean, 
  onClick: () => void,
  subItems?: { id: string, label: string }[],
  activeSubId?: string,
  onSubClick?: (id: string) => void,
  isExpanded?: boolean,
  onToggleExpand?: () => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 group">
        <button 
          onClick={onClick}
          className={`flex-1 flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-500 relative overflow-hidden ${active ? 'nav-item-active' : 'text-slate-500 hover:text-slate-900'}`}
        >
          {active && (
            <motion.div 
              layoutId="activeNav"
              className="absolute inset-0 bg-slate-900 z-0"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'} transition-colors relative z-10`}>
            {icon}
          </span>
          <span className="text-sm font-medium relative z-10">{label}</span>
          {active && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-1 h-1 rounded-full bg-white ml-auto relative z-10"
            />
          )}
        </button>
        
        {subItems && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
            className={`p-2 rounded-xl hover:bg-slate-100 transition-colors ${isExpanded ? 'text-zenith-accent' : 'text-slate-400'}`}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>
      
      <AnimatePresence>
        {isExpanded && subItems && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pl-14 space-y-1"
          >
            {subItems.map(item => (
              <button
                key={item.id}
                onClick={() => onSubClick?.(item.id)}
                className={`w-full text-left py-2 text-xs transition-colors ${activeSubId === item.id ? 'text-zenith-accent font-bold' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, trend, negative }: { label: string, value: string, trend: string, negative?: boolean }) {
  return (
    <div className="glass-panel p-8 hover:bg-slate-50 transition-colors group">
      <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold mb-3">{label}</p>
      <div className="flex items-baseline justify-between">
        <h4 className="text-2xl font-sans font-bold text-slate-900">{value}</h4>
        <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${trend === '稳定' ? 'bg-slate-100 text-slate-500' : (negative ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')}`}>
          {trend}
        </div>
      </div>
    </div>
  );
}

function GtmSlider({ label, value, onChange, color }: { label: string, value: number, onChange: (v: number) => void, color: string }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</span>
        <span className="text-sm font-mono font-bold text-slate-900">{value}%</span>
      </div>
      <div className="relative h-2 bg-slate-100 rounded-full">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className={`absolute inset-y-0 left-0 rounded-full ${color} shadow-sm`}
        />
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={value} 
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
      </div>
    </div>
  );
}

function RoiItem({ label, roi, confidence }: { label: string, roi: string, confidence: number }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:bg-slate-100 transition-colors group">
      <div className="space-y-1">
        <p className="text-sm font-bold text-slate-900 group-hover:text-zenith-accent transition-colors">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-slate-300" />
          <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">置信度: {confidence}%</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xl font-sans font-bold text-zenith-accent">{roi}</p>
        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">预估 ROI</p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, change, trend = 'up' }: { label: string, value: string, change: string, trend?: 'up' | 'down' }) {
  return (
    <div className="glass-panel p-8 space-y-4">
      <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">{label}</p>
      <div className="flex items-end justify-between">
        <h4 className="text-2xl font-sans font-bold text-slate-900">{value}</h4>
        <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          {trend === 'up' ? '↑' : '↓'} {change}
        </div>
      </div>
    </div>
  );
}

function AdvisorModeItem({ label, active = false }: { label: string, active?: boolean }) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
      active 
        ? 'bg-slate-100 border-slate-200 text-slate-900 shadow-sm' 
        : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
    }`}>
      <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      {active && <div className="w-1.5 h-1.5 rounded-full bg-zenith-accent shadow-[0_0_8px_rgba(0,122,255,0.3)]" />}
    </div>
  );
}
