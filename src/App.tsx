/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useEffect, useRef, useState} from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Compass,
  DollarSign,
  FileInput,
  FileOutput,
  LayoutDashboard,
  Link as LinkIcon,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import type {AppState, ProductData, SimulationResult} from './types';
import {
  analyzeAssetFromFileWithMode,
  analyzeAssetFromLinkWithMode,
  generateStrategyResponse,
  generateSimulationScenarios,
  runSandboxSimulation,
} from './services/geminiService';
import {
  resolveModelStrategy,
  type ModelMode,
} from './modelStrategy';
import ReactMarkdown from 'react-markdown';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as ReLineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AUTO_FILL_TAGS,
  createProject,
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
  DEFAULT_SUBMODULE_BY_MODULE,
  MOCK_CHART_DATA,
  MODEL_OPTIONS,
  SIDEBAR_MODULES,
  SIMULATION_CSV_HEADERS,
  TARGET_MARKET_COUNTRIES,
} from './appConfig';
import {createShortId, downloadTextFile, toCsvCell} from './appUtils';
import {
  computeGtmProjection,
  formatCompactNumber,
  formatUsd,
} from './gtmMetrics';
import {
  GtmMetricInput,
  MetricCard,
  RiskCell,
  ScoreDetail,
  SidebarItem,
  StatCard,
} from './uiComponents';

type GtmEditableChannel =
  | 'contentMarketing'
  | 'paidAds'
  | 'referral'
  | 'viral'
  | 'seoAso';

export default function App() {
  const [state, setState] = useState<AppState>({
    projects: [createProject(DEFAULT_PROJECT_ID)],
    currentProjectId: DEFAULT_PROJECT_ID,
    simulations: [],
    scenarios: [],
    isSimulating: false,
    activeModule: 'sandbox',
    activeSubModule: 'sandbox-engine',
  });

  const currentProject = state.projects.find(p => p.id === state.currentProjectId) || state.projects[0];
  const latestSimulation = state.simulations[0];
  const gtmProjection = computeGtmProjection(currentProject);
  const advisorSessionId = useRef(createShortId(5).toUpperCase()).current;

  const updateCurrentProject = (updates: Partial<ProductData>) => {
    setState(s => ({
      ...s,
      projects: s.projects.map(p => p.id === s.currentProjectId ? { ...p, ...updates } : p)
    }));
  };

  const updateTargetMarket = (updates: Partial<ProductData['targetMarket']>) => {
    if (!currentProject) return;
    updateCurrentProject({
      targetMarket: {
        ...currentProject.targetMarket,
        ...updates,
      },
    });
  };

  const updateCostStructure = (
    updates: Partial<NonNullable<ProductData['costStructure']>>,
  ) => {
    if (!currentProject?.costStructure) return;
    updateCurrentProject({
      costStructure: {
        ...currentProject.costStructure,
        ...updates,
      },
    });
  };

  const updateGtmStrategy = (updates: Partial<ProductData['gtmStrategy']>) => {
    if (!currentProject) return;
    updateCurrentProject({
      gtmStrategy: {
        ...currentProject.gtmStrategy,
        ...updates,
      },
    });
  };

  const updateGtmChannel = (
    channel: GtmEditableChannel,
    updates: Partial<ProductData['gtmStrategy'][GtmEditableChannel]>,
  ) => {
    const currentChannel = currentProject?.gtmStrategy[channel];
    if (!currentChannel || typeof currentChannel !== 'object') return;

    updateGtmStrategy({
      [channel]: {
        ...currentChannel,
        ...updates,
      },
    } as Partial<ProductData['gtmStrategy']>);
  };

  const updateUserStory = (index: number, value: string) => {
    const nextStories = [...(currentProject?.userStories || [])];
    nextStories[index] = value;
    updateCurrentProject({userStories: nextStories});
  };

  const removeUserStory = (index: number) => {
    updateCurrentProject({
      userStories: currentProject?.userStories?.filter((_, i) => i !== index),
    });
  };

  const addUserStory = () => {
    updateCurrentProject({
      userStories: [...(currentProject?.userStories || []), ''],
    });
  };

  const navigateToModule = (
    module: AppState['activeModule'],
    options?: {scrollToTop?: boolean},
  ) => {
    if (options?.scrollToTop) {
      window.scrollTo({top: 0, behavior: 'smooth'});
    }
    setActiveModule(module);
  };

  const setActiveSubModule = (subModule: string) => {
    setState(s => ({ ...s, activeSubModule: subModule }));
  };

  const setModuleAndSubModule = (module: AppState['activeModule'], subModule: string) => {
    setState(s => ({ ...s, activeModule: module, activeSubModule: subModule }));
  };

  const selectProject = (projectId: string) => {
    setState(s => ({ ...s, currentProjectId: projectId }));
  };

  const removeProject = (projectId: string) => {
    setState(s => {
      const nextProjects = s.projects.filter(project => project.id !== projectId);
      return {
        ...s,
        projects: nextProjects,
        currentProjectId:
          s.currentProjectId === projectId
            ? nextProjects[nextProjects.length - 1].id
            : s.currentProjectId,
      };
    });
  };

  const createNewProject = () => {
    const newId = createShortId();
    setState(s => ({
      ...s,
      projects: [
        ...s.projects,
        createProject(newId, `${DEFAULT_PROJECT_NAME} ${s.projects.length + 1}`),
      ],
      currentProjectId: newId,
      activeModule: 'input',
    }));
  };

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['sandbox']));
  const [showSettings, setShowSettings] = useState(false);

  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkInput, setLinkInput] = useState('');
  const runAssetAnalysis = async (
    analyze: () => Promise<Partial<ProductData>>,
    errorLog: string,
    errorMessage: string,
    onSuccess?: () => void,
  ) => {
    setUploadState('uploading');
    try {
      const data = await analyze();
      updateCurrentProject(data);
      setUploadState('success');
      onSuccess?.();
    } catch (error) {
      console.error(errorLog, error);
      setUploadState('idle');
      alert(errorMessage);
    }
  };

  const handleLinkSubmit = async () => {
    if (!linkInput) return;
    await runAssetAnalysis(
      () => analyzeAssetFromLinkWithMode(linkInput, modelMode),
      'Link analysis failed:',
      '分析失败，请检查链接或稍后重试',
      () => setLinkInput(''),
    );
  };

  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSubModule('input-upload');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await runAssetAnalysis(
      () => analyzeAssetFromFileWithMode(file, modelMode),
      'File analysis failed:',
      '文件分析失败，请稍后重试',
    );
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
      activeSubModule: subModule || DEFAULT_SUBMODULE_BY_MODULE[module]
    }));
    // Also expand when setting active
    setExpandedModules(prev => new Set(prev).add(module));
  };

  const getPanelProps = (id: string, baseClassName: string) => {
    const isActive = state.activeSubModule === id;
    return {
      id,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveSubModule(id);
      },
      className: `${baseClassName} cursor-pointer transition-all duration-300 ${isActive ? 'ring-2 ring-zenith-accent border-transparent shadow-lg shadow-zenith-accent/10' : 'hover:border-slate-300'}`
    };
  };

  useEffect(() => {
    if (!state.activeSubModule) return;

    const timeoutId = window.setTimeout(() => {
      const element = document.getElementById(state.activeSubModule);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);

    return () => window.clearTimeout(timeoutId);
  }, [state.activeSubModule, state.activeModule]);

  const [modelMode, setModelMode] = useState<ModelMode>('fast');
  const assetAnalysisStrategy = resolveModelStrategy('asset-analysis', modelMode);
  const sandboxScenarioStrategy = resolveModelStrategy('sandbox-scenario', modelMode);
  const sandboxSimulationStrategy = resolveModelStrategy('sandbox-simulation', modelMode);
  const [advisorChat, setAdvisorChat] = useState<{role: string, content: string}[]>([]);
  const [chatInput, setChatInput] = useState("");

  const runWithSimulationState = async (
    task: () => Promise<void>,
    errorLabel: string,
  ) => {
    setState(prev => ({...prev, isSimulating: true}));
    try {
      await task();
    } catch (error) {
      console.error(errorLabel, error);
    } finally {
      setState(prev => ({...prev, isSimulating: false}));
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    const newUserMsg = { role: 'user', content: chatInput };
    setAdvisorChat(prev => [...prev, newUserMsg]);
    setChatInput("");
    
    const response = await generateStrategyResponse(chatInput, modelMode);
    setAdvisorChat(prev => [...prev, { role: 'assistant', content: response || "No response" }]);
  };

  const handleGenerateScenarios = async () => {
    await runWithSimulationState(async () => {
      const newScenarios = await generateSimulationScenarios(currentProject, modelMode);
      setState(prev => ({
        ...prev,
        scenarios: newScenarios,
      }));
    }, 'Scenario generation failed:');
  };

  const runSimulation = async (scenario: string) => {
    await runWithSimulationState(async () => {
      const resultText = await runSandboxSimulation(scenario, currentProject, modelMode);
      
      // Extract recommendations from AI response
      const recMatches = resultText?.match(/(?:建议|对策|措施)[：:]\s*([\s\S]*?)(?:\n\n|$)/gi) || [];
      const recommendations = recMatches.length > 0 
        ? recMatches[0].split(/\d+[.、]/).filter(Boolean).map(s => s.trim()).slice(0, 3)
        : ["优化获客成本结构", "提升用户留存率至 40%+", "建立竞品监控体系"];

      const newSim: SimulationResult = {
        id: createShortId(),
        timestamp: Date.now(),
        scenario,
        outcome: resultText || "推演完成，未获取到详细结果。",
        risks: ["市场饱和", "高获客成本 (CAC)"],
        impact: "如果不解决，LTV 可能会下降 20%。",
        recommendations
      };

      setState(prev => ({
        ...prev,
        simulations: [newSim, ...prev.simulations],
      }));
    }, 'Simulation failed:');
  };

  const downloadSimulationJson = (simulation: SimulationResult) => {
    downloadTextFile(
      `simulation-${simulation.id}.json`,
      'application/json',
      JSON.stringify(simulation, null, 2),
    );
  };

  const downloadSimulationCsv = (simulation: SimulationResult) => {
    const row = [
      simulation.id,
      new Date(simulation.timestamp).toISOString(),
      simulation.scenario,
      simulation.outcome,
      simulation.impact,
      simulation.risks.join(', '),
      simulation.recommendations.join(', '),
      simulation.inferenceCost ?? '',
    ];

    downloadTextFile(
      `simulation-${simulation.id}.csv`,
      'text/csv',
      `${SIMULATION_CSV_HEADERS.join(',')}\n${row.map(toCsvCell).join(',')}`,
    );
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
          {SIDEBAR_MODULES.map(({ id, icon: Icon, label, subItems }) => (
            <SidebarItem
              key={id}
              icon={<Icon size={18} />}
              label={label}
              active={state.activeModule === id}
              isExpanded={expandedModules.has(id)}
              onToggleExpand={() => toggleExpand(id)}
              onClick={() => setActiveModule(id)}
              subItems={subItems}
              activeSubId={state.activeSubModule}
              onSubClick={(subItemId) => setModuleAndSubModule(id, subItemId)}
            />
          ))}
        </nav>

        <div className="p-6 space-y-3">
          {/* Model Selector */}
          <div className="space-y-2">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-50/70 backdrop-blur-sm border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <BrainCircuit size={16} className="text-zenith-accent" />
                <div className="text-left">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">AI 模型</p>
                  <p className="text-xs font-medium text-slate-700">
                    {MODEL_OPTIONS.find(option => option.mode === modelMode)?.displayName ?? 'Gemini Pro'}
                  </p>
                </div>
              </div>
              <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${showSettings ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showSettings && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5 px-1 py-2">
                    {MODEL_OPTIONS.map((option) => {
                      const isActive = modelMode === option.mode;
                      return (
                        <button
                          key={option.mode}
                          onClick={() => {
                            setModelMode(option.mode);
                            setShowSettings(false);
                          }}
                          className={`w-full text-left px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-zenith-accent/10 border border-zenith-accent/20' : 'hover:bg-slate-50 border border-transparent'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-xs font-bold ${isActive ? 'text-zenith-accent' : 'text-slate-700'}`}>{option.label}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{option.description}</p>
                            </div>
                            {isActive && <div className="w-2 h-2 rounded-full bg-zenith-accent" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Profile */}
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
                onClick={() => selectProject(p.id)}
                className={`group relative flex items-center gap-3 px-6 py-3 rounded-t-xl border-t border-x cursor-pointer transition-all min-w-32 max-w-xs flex-shrink-0 ${state.currentProjectId === p.id ? 'bg-white border-slate-200 text-zenith-accent z-10 before:absolute before:-bottom-px before:left-0 before:right-0 before:h-px before:bg-white' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100 shadow-inner'}`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${state.currentProjectId === p.id ? 'bg-zenith-accent shadow-[0_0_8px_rgba(0,122,255,0.4)]' : 'bg-slate-300 group-hover:bg-slate-400'}`} />
                <span className={`text-sm font-medium truncate flex-1 transition-colors ${state.currentProjectId === p.id ? 'text-slate-900' : 'text-slate-500'}`}>{p.name || '未命名项目'}</span>
                {state.projects.length > 1 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProject(p.id);
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
            <button 
              onClick={createNewProject}
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
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-zenith-accent font-bold">
                      <BrainCircuit size={12} />
                      Strategic Simulation Engine
                    </div>
                    <h2 className="text-4xl font-sans font-bold tracking-tight text-slate-900">动态沙盘推演</h2>
                    <p className="text-slate-500 max-w-lg text-sm">基于灵感实验室与 GTM 布局数据，AI 将为您推演多条可能的增长路径并识别核心难题。</p>
                  </div>
                  
                  {state.scenarios.length > 0 && (
                    <button 
                      onClick={handleGenerateScenarios}
                      disabled={state.isSimulating}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50"
                    >
                      <Zap size={14} />
                      重新生成剧本
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      title: '输入解析',
                      subtitle: 'Assets Ingestion',
                      strategy: assetAnalysisStrategy,
                      accentClass: 'from-emerald-50 to-white border-emerald-100',
                      dotClass: 'bg-emerald-500',
                    },
                    {
                      title: '剧本生成',
                      subtitle: 'Scenario Planning',
                      strategy: sandboxScenarioStrategy,
                      accentClass: 'from-indigo-50 to-white border-indigo-100',
                      dotClass: 'bg-indigo-500',
                    },
                    {
                      title: '深度推演',
                      subtitle: 'Simulation Engine',
                      strategy: sandboxSimulationStrategy,
                      accentClass: 'from-rose-50 to-white border-rose-100',
                      dotClass: 'bg-rose-500',
                    },
                  ].map(({title, subtitle, strategy, accentClass, dotClass}) => (
                    <div
                      key={title}
                      className={`rounded-3xl border bg-gradient-to-br ${accentClass} p-5 shadow-sm`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-slate-400">
                            {subtitle}
                          </p>
                          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
                        </div>
                        <div className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
                          <span className="text-slate-400 font-bold">Provider</span>
                          <span className="text-slate-700 font-bold">{strategy.provider}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
                          <span className="text-slate-400 font-bold">Mode</span>
                          <span className="text-slate-700 font-bold">{strategy.effectiveMode}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-100/80">
                          <p className="text-xs font-bold text-slate-900">{strategy.displayName}</p>
                          <p className="text-[10px] text-slate-500 mt-1 font-mono break-all">
                            {strategy.modelId}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {state.scenarios.length === 0 ? (
                  <div className="glass-panel p-20 flex flex-col items-center text-center space-y-6 bg-gradient-to-b from-white to-slate-50 border-slate-100">
                    <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center text-indigo-500 relative">
                      <Zap size={40} />
                      <div className="absolute inset-0 rounded-3xl bg-indigo-400/20 animate-ping" />
                    </div>
                    <div className="space-y-2 max-w-md">
                      <h3 className="text-xl font-bold text-slate-900">准备开启 AI 增长推演</h3>
                      <p className="text-sm text-slate-400 leading-relaxed italic">
                        我们将提取您的 USP、用户画像及渠道配比数据，预测接下来 12 个月可能发生的博弈场景。
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateScenarios}
                      disabled={state.isSimulating}
                      className="px-10 py-5 bg-slate-900 text-white rounded-3xl text-sm font-bold shadow-2xl shadow-indigo-200 hover:bg-zenith-accent transition-all flex items-center gap-4 disabled:opacity-50"
                    >
                      {state.isSimulating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          正在推演可能路径...
                        </>
                      ) : (
                        <>
                          生成增长剧本 <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {state.scenarios.map((scenario) => (
                      <button
                        key={scenario.id}
                        onClick={() => runSimulation(scenario.title)}
                        disabled={state.isSimulating}
                        className={`text-left p-6 rounded-3xl border transition-all duration-300 group relative overflow-hidden flex flex-col justify-between h-full bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 ${latestSimulation?.scenario === scenario.title ? 'border-zenith-accent ring-2 ring-zenith-accent/20' : 'border-slate-100'}`}
                      >
                        <div className="relative z-10 space-y-4">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-slate-900 line-clamp-1">{scenario.title}</h4>
                            <div className={`px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-widest ${latestSimulation?.scenario === scenario.title ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors'}`}>
                              {latestSimulation?.scenario === scenario.title ? '已推演' : '待激活'}
                            </div>
                          </div>
                          
                          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3 italic">
                            {scenario.description}
                          </p>

                          <div className="p-3 bg-red-50/50 rounded-xl border border-red-100/30">
                            <p className="text-[8px] uppercase tracking-widest font-bold text-red-400 mb-1 flex items-center gap-1.5">
                              <AlertTriangle size={10} /> 遇到的难题 / Challenge
                            </p>
                            <p className="text-[10px] text-slate-700 font-medium leading-snug">
                              {scenario.difficulty}
                            </p>
                          </div>
                        </div>
                        
                        <div className="mt-6 flex items-center justify-between text-[9px] font-bold uppercase tracking-tighter relative z-10">
                          <span className="text-slate-400">触发阈值: {scenario.trigger}</span>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {state.simulations.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-12"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                      <div className="lg:col-span-8 space-y-8 h-full">
                        <div className="glass-panel p-8 bg-white border-slate-100 flex-1">
                          <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-indigo-50 rounded-xl">
                              <Activity size={18} className="text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">推演深度分析：{latestSimulation?.scenario}</h3>
                          </div>
                          
                          <div className="prose prose-sm max-w-none text-slate-600 leading-relaxed min-h-[400px]">
                            <ReactMarkdown>{latestSimulation?.outcome || ''}</ReactMarkdown>
                          </div>
                        </div>

                        {/* Charts from active logic */}
                        <div className="glass-panel p-8 bg-white border-slate-100 h-[400px]">
                          <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500 mb-10">经营指数走势 / Business Projection</h3>
                          <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={MOCK_CHART_DATA}>
                                <defs>
                                  <linearGradient id="colorUsersS" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                  </linearGradient>
                                  <linearGradient id="colorRevS" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#007AFF" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#007AFF" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)' }} />
                                <Area type="monotone" dataKey="users" stroke="#10b981" fill="url(#colorUsersS)" strokeWidth={3} />
                                <Area type="monotone" dataKey="revenue" stroke="#007AFF" fill="url(#colorRevS)" strokeWidth={3} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-4 flex flex-col gap-8 h-full">
                        <div className="p-8 bg-slate-900 rounded-[2.5rem] shadow-2xl text-white space-y-6 relative overflow-hidden group flex-1">
                          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
                            <TrendingUp size={80} />
                          </div>
                          <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-white/50">核心博弈对策</h4>
                          <div className="space-y-4">
                            {latestSimulation?.recommendations?.slice(0, 3).map((rec, i) => (
                              <div key={i} className="flex gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                                <span className="text-zenith-accent font-bold">0{i+1}</span>
                                <p className="text-xs text-white/90 leading-relaxed">{rec}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <StatCard label="推演获客成本" value={'$' + (currentProject?.gtmStrategy.paidAds.unitCost || 12).toFixed(1)} trend="模拟值" />
                        <StatCard label="损益平衡点" value="Q4 - 第 10 个月" trend="关键时间" negative />
                        <StatCard label="模型鲁棒性" value="高" trend="博弈结果" />
                      </div>
                    </div>

                    <div className="flex justify-end pt-12">
                      <button
                        onClick={() => navigateToModule('diagnostics', {scrollToTop: true})}
                        className="group flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-xl hover:shadow-zenith-accent/20"
                      >
                        下一步：诊断与评分
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </motion.div>
                )}
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
                        Session ID: {advisorSessionId}
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
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
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
                      onClick={() => navigateToModule('input')}
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
                className="space-y-12"
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
                    {...getPanelProps("input-upload", "lg:col-span-4 glass-panel p-8 flex flex-col text-center group hover:border-zenith-accent/40 hover:shadow-md transition-all h-full min-h-[320px]")}
                    onClick={handleUploadClick}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleFileChange} 
                      accept=".pdf,.md,.docx,.png,.jpg,.jpeg,.webp"
                    />
                    {uploadState === 'idle' && (
                      <div className="w-full flex flex-col items-center flex-1">
                        {/* Header */}
                        <h4 className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500 flex items-center gap-3 self-start mb-6">
                          <FileOutput size={14} className="text-zenith-accent" />
                          多模态资产上传
                        </h4>

                        {/* Content Container for even distribution */}
                        <div className="w-full flex-1 flex flex-col justify-evenly py-2">
                          {/* Upload File Button */}
                          <button 
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            className="w-full p-8 border-2 border-dashed border-slate-200 rounded-2xl hover:border-zenith-accent/40 hover:bg-zenith-accent/5 transition-all group/upload flex flex-col items-center justify-center gap-3"
                          >
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover/upload:bg-zenith-accent/10 group-hover/upload:scale-110 transition-all">
                              <Plus size={20} className="text-slate-400 group-hover/upload:text-zenith-accent transition-colors" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700">选择文件上传</p>
                              <p className="text-[10px] text-slate-400 mt-1">支持 PDF / Markdown / Word / 图片</p>
                            </div>
                          </button>

                          {/* Divider */}
                          <div className="flex items-center w-full">
                            <div className="flex-1 h-px bg-slate-100"></div>
                            <span className="px-4 text-[10px] text-slate-400 uppercase tracking-widest font-bold">或粘贴链接</span>
                            <div className="flex-1 h-px bg-slate-100"></div>
                          </div>

                          {/* Paste Link */}
                          <div className="w-full flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <div className="relative flex-1">
                              <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input 
                                type="text" 
                                placeholder="粘贴文章或竞品链接..." 
                                className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-zenith-accent/50 focus:ring-2 focus:ring-zenith-accent/10 transition-all text-slate-700 placeholder:text-slate-400"
                                value={linkInput}
                                onChange={e => setLinkInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && linkInput) handleLinkSubmit(); }}
                              />
                            </div>
                            <button 
                              onClick={handleLinkSubmit}
                              disabled={!linkInput}
                              className="px-6 py-3 bg-zenith-accent text-white text-xs font-bold rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                            >
                              提取
                            </button>
                          </div>
                        </div>

                        {/* Target Fill Tags */}
                        <div className="w-full mt-auto">
                          <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-wider font-bold text-left">AI 将自动填充</p>
                          <div className="flex flex-wrap gap-1.5">
                            {AUTO_FILL_TAGS.map(tag => (
                              <span key={tag} className="px-2.5 py-1 bg-zenith-accent/5 border border-zenith-accent/15 rounded-lg text-[10px] text-zenith-accent font-medium">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {uploadState === 'uploading' && (
                      <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                        <div className="relative">
                          <div className="w-16 h-16 border-2 border-zenith-accent/20 rounded-full"></div>
                          <div className="absolute inset-0 w-16 h-16 border-2 border-zenith-accent border-t-transparent rounded-full animate-spin"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <BrainCircuit size={20} className="text-zenith-accent" />
                          </div>
                        </div>
                        <div className="space-y-2 text-center">
                          <p className="text-sm font-bold text-slate-900">AI 正在分析资产</p>
                          <p className="text-xs text-slate-400">正在提取核心信息并填充各模块...</p>
                        </div>
                        <div className="flex gap-2">
                          {AUTO_FILL_TAGS.map((tag, i) => (
                            <motion.span 
                              key={tag}
                              initial={{ opacity: 0.3 }}
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                              className="px-2 py-0.5 bg-zenith-accent/10 rounded-md text-[9px] text-zenith-accent font-medium"
                            >{tag}</motion.span>
                          ))}
                        </div>
                      </div>
                    )}
                    {uploadState === 'success' && (
                      <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                        <motion.div 
                          initial={{ scale: 0 }} 
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', bounce: 0.4 }}
                          className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center"
                        >
                          <CheckCircle2 size={28} className="text-emerald-500" />
                        </motion.div>
                        <div className="space-y-2 text-center">
                          <h4 className="text-base font-bold text-slate-900">解析完成</h4>
                          <p className="text-xs text-slate-500">已成功填充以下模块</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 justify-center">
                          {AUTO_FILL_TAGS.map((tag, i) => (
                            <motion.span 
                              key={tag}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.15 }}
                              className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] text-emerald-600 font-medium flex items-center gap-1"
                            >
                              <CheckCircle2 size={10} />
                              {tag}
                            </motion.span>
                          ))}
                        </div>
                        <div className="flex gap-3 mt-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setUploadState('idle'); }}
                            className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-colors"
                          >
                            重新上传
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); navigateToModule('gtm'); }}
                            className="px-4 py-2 bg-zenith-accent text-white text-xs font-bold rounded-xl hover:bg-blue-600 transition-colors flex items-center gap-1.5"
                          >
                            下一步 <ChevronRight size={14} />
                          </button>
                        </div>
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
                            onChange={(e) => updateUserStory(i, e.target.value)}
                            className="w-full bg-transparent border-none outline-none text-sm font-medium leading-relaxed text-slate-900 placeholder:text-slate-300 resize-none overflow-hidden pr-8"
                            rows={2}
                            placeholder="输入用户故事..."
                          />
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              removeUserStory(i);
                            }}
                            className="absolute right-3 top-3 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          addUserStory();
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

                  <div {...getPanelProps("input-persona", "lg:col-span-4 glass-panel p-8 space-y-6 border-slate-200 bg-white h-full flex flex-col")}>
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

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => navigateToModule('gtm')}
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
                  <div {...getPanelProps("gtm-model", "lg:col-span-7 glass-panel p-6 space-y-4 border-slate-200 bg-white h-full")}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-slate-100">
                      <div className="space-y-3">
                        <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 flex items-center gap-2">
                          <Compass size={12} className="text-zenith-accent" />增长模型 / Growth Model
                        </h3>
                        <div className="flex items-center gap-3">
                          <div className="px-4 py-1.5 rounded-xl text-xs font-bold bg-zenith-accent text-white shadow-md shadow-zenith-accent/20 flex items-center gap-2 cursor-help group/plg relative">
                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            PLG (产品驱动增长)
                            
                            {/* Tooltip for the single model */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-slate-900 text-white text-[10px] font-normal leading-relaxed p-4 rounded-2xl opacity-0 translate-y-2 pointer-events-none group-hover/plg:opacity-100 group-hover/plg:translate-y-0 transition-all duration-300 z-[100] shadow-2xl border border-white/10">
                              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45 border-b border-r border-white/10"></div>
                              <p className="font-bold text-zenith-accent border-b border-white/10 pb-1 uppercase tracking-widest mb-2">Product-Led Growth</p>
                              <p className="text-slate-300">以产品为核心驱动力，通过优异的用户体验、口碑传播和自助服务实现增长。适合低客单价、高频使用的 SaaS 软件。</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 italic">当前项目默认采用</span>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 flex items-center gap-2">
                          <Target size={12} className="text-indigo-500" />目标客群 / Target Market
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            list="countries-list"
                            placeholder="搜索国家/地区..." 
                            value={currentProject?.targetMarket?.country || ''} 
                            onChange={e => updateTargetMarket({ country: e.target.value })}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl focus:outline-none focus:border-indigo-400 focus:bg-white w-full shadow-sm transition-all"
                          />
                          <datalist id="countries-list">
                            {TARGET_MARKET_COUNTRIES.map(country => (
                              <option key={country} value={country} />
                            ))}
                          </datalist>
                          <input 
                            placeholder="年龄段..." 
                            value={currentProject?.targetMarket?.age || ''} 
                            onChange={e => updateTargetMarket({ age: e.target.value })}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl focus:outline-none focus:border-indigo-400 focus:bg-white w-full"
                          />
                          <input 
                            placeholder="职业..." 
                            value={currentProject?.targetMarket?.occupation || ''} 
                            onChange={e => updateTargetMarket({ occupation: e.target.value })}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl focus:outline-none focus:border-indigo-400 focus:bg-white w-full"
                          />
                          <input 
                            placeholder="收入范围 (USD/月)..." 
                            value={currentProject?.targetMarket?.income || ''} 
                            onChange={e => updateTargetMarket({ income: e.target.value })}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl focus:outline-none focus:border-indigo-400 focus:bg-white w-full"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 flex items-center gap-2">
                          <DollarSign size={12} className="text-amber-500" />定价策略 / Pricing
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { id: 'Freemium', label: '免费增值' },
                            { id: 'FreeTrial', label: '免费试用' },
                            { id: 'Tiered', label: '分级订阅' },
                            { id: 'PayAsYouGo', label: '按量付费' }
                          ].map(p => (
                            <button key={p.id} onClick={() => updateCurrentProject({ pricingModel: p.id as any })} className={`px-2 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${currentProject?.pricingModel === p.id ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>{p.label}</button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 flex items-center gap-2">
                          <Activity size={12} className="text-rose-500" />销售周期 / Sales Cycle
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { id: 'Short', label: '短 (<1周)' },
                            { id: 'Medium', label: '中 (1-3月)' },
                            { id: 'Long', label: '长 (>6月)' },
                            { id: 'ExtraLong', label: '超长 (>12月)' }
                          ].map(s => (
                            <button key={s.id} onClick={() => updateCurrentProject({ salesCycle: s.id as any })} className={`px-2 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${currentProject?.salesCycle === s.id ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>{s.label}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-4 border-t border-slate-100/60 relative">
                      <div className="absolute -top-3 left-0 bg-white px-3 text-[10px] uppercase tracking-[0.3em] font-bold text-slate-400">
                        执行指标 / Execution Metrics
                      </div>
                      <GtmMetricInput 
                        label="内容营销 (Content)" 
                        description="内容营销投入资源"
                        value={currentProject?.gtmStrategy.contentMarketing?.volume || 0} 
                        onChange={(v) => updateGtmChannel('contentMarketing', { volume: v })}
                        icon={<FileInput size={14} className="text-emerald-500" />}
                      />
                      
                      <GtmMetricInput 
                        label="付费投放 (Paid Ads)" 
                        description="我们将获得多少付费流量？相关增长模型将自动生成辅助指标"
                        value={currentProject?.gtmStrategy.paidAds?.volume || 0} 
                        onChange={(v) => {
                          if (!currentProject) return;
                          const gtm = currentProject.gtmStrategy;
                          updateGtmStrategy({
                            paidAds: { ...gtm.paidAds, volume: v },
                            referral: { ...gtm.referral, volume: Math.floor(v * 0.15) },
                            viral: { ...gtm.viral, volume: Math.floor(v * 0.3) },
                            seoAso: { ...gtm.seoAso, volume: Math.floor(v * 0.2) },
                          });
                        }}
                        icon={<Zap size={14} className="text-blue-500" />}
                      />

                      {/* 营销花费模块 / Marketing Spend */}
                      <div className="md:col-span-2 pt-0 mb-0">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Content Marketing Cost */}
                          <div className="p-4 bg-gradient-to-br from-blue-50/80 to-white border border-blue-100 rounded-2xl flex items-center gap-4">
                            <div className="w-[64px] h-[64px] flex-shrink-0">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={[
                                      { name: '内容营销', value: gtmProjection.contentSpend || 1 },
                                      { name: '剩余', value: gtmProjection.totalMarketingSpend > 0 ? Math.max(0, gtmProjection.totalMarketingSpend - gtmProjection.contentSpend) : 1 },
                                    ]}
                                    cx="50%" cy="50%"
                                    innerRadius={22} outerRadius={30}
                                    startAngle={90} endAngle={-270}
                                    dataKey="value"
                                    stroke="none"
                                  >
                                    <Cell fill="#10b981" />
                                    <Cell fill="#e2e8f0" />
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="text-left py-1">
                              <h4 className="text-[11px] font-bold text-slate-800 leading-tight">内容营销花费</h4>
                              <p className="text-[9px] text-slate-400 mb-1 leading-tight">Content Marketing</p>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-base font-sans font-bold text-emerald-600 leading-tight">{formatUsd(gtmProjection.contentSpend)}</span>
                                <span className="text-[9px] text-slate-400 font-mono font-medium">{gtmProjection.contentVolume}条</span>
                              </div>
                            </div>
                          </div>

                          {/* Paid Ads Cost */}
                          <div className="p-4 bg-gradient-to-br from-blue-50/80 to-white border border-blue-100 rounded-2xl flex items-center gap-4">
                            <div className="w-[64px] h-[64px] flex-shrink-0">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={[
                                      { name: '付费投放', value: gtmProjection.adsSpend || 1 },
                                      { name: '剩余', value: gtmProjection.totalMarketingSpend > 0 ? Math.max(0, gtmProjection.totalMarketingSpend - gtmProjection.adsSpend) : 1 },
                                    ]}
                                    cx="50%" cy="50%"
                                    innerRadius={22} outerRadius={30}
                                    startAngle={90} endAngle={-270}
                                    dataKey="value"
                                    stroke="none"
                                  >
                                    <Cell fill="#3b82f6" />
                                    <Cell fill="#e2e8f0" />
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="text-left py-1">
                              <h4 className="text-[11px] font-bold text-slate-800 leading-tight">付费投放花费</h4>
                              <p className="text-[9px] text-slate-400 mb-1 leading-tight">Paid Ads</p>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-base font-sans font-bold text-blue-600 leading-tight">{formatUsd(gtmProjection.adsSpend)}</span>
                                <span className="text-[9px] text-slate-400 font-mono font-medium">{gtmProjection.adsVolume}条</span>
                              </div>
                            </div>
                          </div>

                          {/* Total Spend Summary */}
                          <div className="p-4 bg-gradient-to-br from-blue-50/80 to-white border border-blue-100 rounded-2xl flex items-center gap-4">
                            <div className="w-[64px] h-[64px] flex-shrink-0">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={gtmProjection.totalMarketingSpend > 0 ? [
                                      { name: '内容营销', value: gtmProjection.contentSpend },
                                      { name: '付费投放', value: gtmProjection.adsSpend },
                                    ] : [{ name: '无数据', value: 1 }]}
                                    cx="50%" cy="50%"
                                    innerRadius={22} outerRadius={30}
                                    startAngle={90} endAngle={-270}
                                    paddingAngle={gtmProjection.totalMarketingSpend > 0 ? 3 : 0}
                                    dataKey="value"
                                    stroke="none"
                                  >
                                    {gtmProjection.totalMarketingSpend > 0 ? (
                                      <>
                                        <Cell fill="#10b981" />
                                        <Cell fill="#3b82f6" />
                                      </>
                                    ) : (
                                      <Cell fill="#cbd5e1" />
                                    )}
                                  </Pie>
                                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '10px', color: '#0f172a' }} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="text-left py-1">
                              <h4 className="text-[11px] font-bold text-slate-800 leading-tight">营销总花费</h4>
                              <p className="text-[9px] text-slate-400 mb-1 leading-tight">Total Marketing Spend</p>
                              <span className="text-base font-sans font-bold text-slate-900 leading-tight">{formatUsd(gtmProjection.totalMarketingSpend)}</span>
                              {gtmProjection.totalMarketingSpend > 0 && (
                                <div className="mt-1 flex items-center gap-2 text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{gtmProjection.contentSpendPercent}%</span>
                                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{gtmProjection.adsSpendPercent}%</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 mt-0">
                        <GtmMetricInput 
                          label="推荐与裂变 (Referral)" 
                          description="通过系统 APP 跳转了多少次"
                          value={currentProject?.gtmStrategy.referral?.volume || 0} 
                          onChange={(v) => updateGtmChannel('referral', { volume: v })}
                          icon={<Users size={14} className="text-purple-500" />}
                        />

                        <GtmMetricInput 
                          label="自传播 (Viral / Referral)" 
                          description="用户分享了多少次对应的应用"
                          value={currentProject?.gtmStrategy.viral?.volume || 0} 
                          onChange={(v) => updateGtmChannel('viral', { volume: v })}
                          icon={<Target size={14} className="text-rose-500" />}
                        />

                        <GtmMetricInput 
                          label="自然搜索 (SEO / ASO)" 
                          description="投入的 SEO 资源点数"
                          value={currentProject?.gtmStrategy.seoAso?.volume || 0} 
                          onChange={(v) => updateGtmChannel('seoAso', { volume: v })}
                          icon={<Search size={14} className="text-indigo-500" />}
                        />
                      </div>

                      {/* 获取用户转换 / User Acquisition & Conversion */}
                      <div className="md:col-span-2 mt-4">
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="p-1.5 bg-indigo-50 rounded-lg">
                              <TrendingUp size={14} className="text-indigo-600" />
                            </div>
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">获取用户转换 / User Acquisition</h3>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">曝光总量</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-xl font-sans font-bold text-slate-800">{formatCompactNumber(gtmProjection.totalImpressions)}</span>
                                <span className="text-[10px] text-slate-400">次曝光</span>
                              </div>
                            </div>
                            
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">直接转化</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-xl font-sans font-bold text-emerald-600">+{formatCompactNumber(gtmProjection.directInstalls)}</span>
                                <span className="text-[10px] text-slate-400">新用户</span>
                              </div>
                            </div>
                            
                            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                              <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">病毒增长 (K={gtmProjection.kFactor})</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-xl font-sans font-bold text-indigo-600">+{formatCompactNumber(gtmProjection.viralInstalls)}</span>
                                <span className="text-[10px] text-indigo-400">裂变</span>
                              </div>
                            </div>
                            
                            <div className="p-4 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl shadow-lg shadow-indigo-200">
                              <p className="text-[10px] font-bold text-white/70 uppercase mb-1">总获客预估</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-xl font-sans font-bold text-white">{formatCompactNumber(gtmProjection.totalNewUsers)}</span>
                                <span className="text-[10px] text-white/70">/月</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex items-center gap-4 text-[9px] font-medium text-slate-400">
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> 内容转化: {gtmProjection.contentInstalls}</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> 付费转化: {gtmProjection.adsInstalls}</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> 推荐转化: {gtmProjection.referralInstalls}</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> SEO转化: {gtmProjection.seoInstalls}</span>
                          </div>
                        </div>
                      </div>
                    </div>


                  </div>

                  <div {...getPanelProps("gtm-cost", "lg:col-span-5 glass-panel p-6 space-y-4 border-slate-200 bg-white h-full flex flex-col justify-between")}>
                    <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 flex items-center gap-2 mb-4">
                      <Calculator size={12} className="text-indigo-500" />产品运营成本计算 / COST CALCULATOR
                    </h3>
                    <div className="space-y-5 overflow-y-auto pr-2 custom-scrollbar">
                      {/* GTM Sync -> Estimated MAU */}
                      <div className="p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-400">预估月活 (基于GTM)</span>
                          <button 
                            onClick={() => updateCostStructure({ targetMau: gtmProjection.estimatedMauFromGtm })}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-2 transition-colors"
                          >
                            同步到目标
                          </button>
                        </div>
                        <div className="text-xl font-sans font-bold text-indigo-600">
                          {gtmProjection.estimatedMauFromGtm.toLocaleString()} <span className="text-xs font-normal text-indigo-400 uppercase ml-1">MAU</span>
                        </div>
                      </div>

                      {/* Daily Free Uses Slider */}
                      <div>
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                          <span>日免费次</span>
                          <span className="text-indigo-600 font-sans">{currentProject?.costStructure?.dailyFreeUses ?? 5}</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="20" 
                          step="1" 
                          value={currentProject?.costStructure?.dailyFreeUses ?? 5}
                          onChange={e => updateCostStructure({ dailyFreeUses: parseInt(e.target.value) })}
                          className="w-full accent-indigo-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Target MAU */}
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-3 block">目标月活 (MAU)</label>
                        <input 
                          type="number" 
                          value={currentProject?.costStructure?.targetMau ?? 100000}
                          onChange={e => updateCostStructure({ targetMau: parseInt(e.target.value) || 0 })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-400 shadow-sm font-sans transition-all"
                        />
                      </div>

                      {/* Cost Per Call Input */}
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-3 block">单次成本 (USD)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold z-10">$</span>
                          <input 
                            type="number" 
                            step="0.001"
                            value={currentProject?.costStructure?.costPerCall !== undefined ? currentProject.costStructure.costPerCall : 0.01}
                            onChange={e => updateCostStructure({ costPerCall: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pl-6 text-xs focus:outline-none focus:bg-white focus:border-emerald-400 shadow-sm font-sans transition-all"
                          />
                        </div>
                      </div>

                      {/* Paid Conversion Rate Slider */}
                      <div>
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                          <span>付费转化率</span>
                          <span className="text-emerald-500 font-sans">{currentProject?.costStructure?.paidConversionRate ?? 3}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="50" 
                          step="1" 
                          value={currentProject?.costStructure?.paidConversionRate ?? 3}
                          onChange={e => updateCostStructure({ paidConversionRate: parseInt(e.target.value) })}
                          className="w-full accent-emerald-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Subscription Price Tabs */}
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-3 block">订阅价格 (USD/月)</label>
                        <div className="grid grid-cols-4 gap-2">
                          {[4.99, 9.99, 14.99, 19.99].map(price => (
                            <button
                              key={price}
                              onClick={() => updateCostStructure({ monthlySubscription: price })}
                              className={`py-2.5 rounded-xl text-[10px] font-bold transition-all ${
                                (currentProject?.costStructure?.monthlySubscription ?? 19.99) === price 
                                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20' 
                                  : 'bg-white border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                              }`}
                            >
                              ${price}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Results Card */}
                    <div className="mt-0 bg-slate-50 border border-slate-100 shadow-[0_2px_15px_rgb(0,0,0,0.02)] rounded-3xl p-5 space-y-4">
                      <>
                        <div className="flex justify-between items-center border-b border-white pb-4">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">营收预估</span>
                          <span className="text-emerald-500 font-sans font-bold text-lg">+{formatUsd(gtmProjection.revenue)} /月</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-white pb-4">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">模型成本</span>
                          <span className="text-rose-500 font-sans font-bold text-lg">-{formatUsd(gtmProjection.modelCost)} /月</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-white pb-4">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">营销成本</span>
                          <span className="text-rose-500 font-sans font-bold text-lg">-{formatUsd(gtmProjection.totalMarketingSpend)} /月</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">预估运营毛利</span>
                          <div className="text-right">
                            <span className="text-slate-900 font-sans font-bold text-2xl">{formatUsd(gtmProjection.profit)}</span>
                          </div>
                        </div>
                      </>
                      
                      {/* Growth Assumptions Panel - Temporarily removed for logic re-evaluation */}
                    </div>
                  </div>







                </div>

                {/* GTM 操盘计划总结 / Operations Summary */}
                <div {...getPanelProps("gtm-summary", "glass-panel p-4 border-slate-200 bg-white mt-6")}>
                  <>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center shadow-md">
                          <BarChart3 size={14} className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-900">GTM 操盘计划总结</h3>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider">Operations Summary → Sandbox Input</p>
                        </div>
                      </div>
                      <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">数据将送往沙盘推演</span>
                      </div>
                    </div>

                    {/* 3-Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                      {/* Left: Radar Chart */}
                      <div className="lg:col-span-3 bg-slate-50/50 border border-slate-100/60 rounded-xl p-3 flex flex-col justify-center">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center">渠道投入雷达图</p>
                        <div className="h-[120px] mt-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={gtmProjection.radarData} cx="50%" cy="50%" outerRadius="80%">
                              <PolarGrid stroke="#f1f5f9" />
                              <PolarAngleAxis dataKey="channel" tick={{ fontSize: 9, fill: '#64748b' }} />
                              <Radar name="投入" dataKey="value" stroke="#334155" fill="#334155" fillOpacity={0.1} strokeWidth={1.5} />
                              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '10px', padding: '4px 8px' }} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Center: KPI Cards */}
                      <div className="lg:col-span-5 grid grid-cols-2 gap-3 items-center">
                        {/* Total Acquisition */}
                        <div className="p-3 bg-slate-50/50 hover:bg-white transition-colors border border-slate-100/60 rounded-xl">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">月新增获客</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-sans font-bold text-indigo-600">{formatCompactNumber(gtmProjection.totalNewUsers)}</span>
                            <span className="text-[9px] text-slate-400">/月</span>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[8px] text-slate-400 uppercase tracking-tighter">
                            <span>直接 {formatCompactNumber(gtmProjection.directInstalls)}</span>
                            <span className="text-slate-300">|</span>
                            <span>裂变 {formatCompactNumber(gtmProjection.viralInstalls)}</span>
                          </div>
                        </div>

                        {/* Estimated MAU */}
                        <div className="p-3 bg-slate-50/50 hover:bg-white transition-colors border border-slate-100/60 rounded-xl">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">预估月活 MAU</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-sans font-bold text-emerald-500">{formatCompactNumber(gtmProjection.estimatedMauFromGtm)}</span>
                            <span className="text-[9px] text-slate-400">用户</span>
                          </div>
                          <div className="mt-1 text-[8px] text-slate-400 uppercase tracking-tighter">
                            付费转化 {gtmProjection.paidConversionRate}% → {formatCompactNumber(gtmProjection.estimatedPaidUsersFromGtm)} 付费用户
                          </div>
                        </div>

                        {/* Marketing Spend */}
                        <div className="p-3 bg-slate-50/50 hover:bg-white transition-colors border border-slate-100/60 rounded-xl">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">营销总花费</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-sans font-bold text-rose-500">{formatUsd(gtmProjection.totalMarketingSpend)}</span>
                            <span className="text-[9px] text-slate-400">/月</span>
                          </div>
                          <div className="mt-1 text-[8px] text-slate-400 uppercase tracking-tighter">
                            CAC ≈ {gtmProjection.customerAcquisitionCost !== null ? `$${gtmProjection.customerAcquisitionCost.toFixed(2)}` : 'N/A'}
                          </div>
                        </div>

                        {/* Operating Margin */}
                        <div className="p-3 bg-slate-50/50 hover:bg-white transition-colors border border-slate-100/60 rounded-xl">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">预估运营毛利</p>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-xl font-sans font-bold ${gtmProjection.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatUsd(gtmProjection.profit)}</span>
                            <span className="text-[9px] text-slate-400">/月</span>
                          </div>
                          <div className="mt-1 text-[8px] text-slate-400 uppercase tracking-tighter">
                            利润率 {gtmProjection.marginPercent.toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      {/* Right: Bar Chart */}
                      <div className="lg:col-span-4 bg-slate-50/50 border border-slate-100/60 rounded-xl p-3 flex flex-col justify-center">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center">收支结构对比</p>
                        <div className="h-[120px] mt-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={gtmProjection.barData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                              <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={(v: number) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} width={50} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '10px', padding: '4px 8px' }}
                                formatter={(value: number) => [formatUsd(value), '']}
                              />
                              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                                {gtmProjection.barData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                    </div>
                  </>
                </div>

                <div className="flex flex-col items-end gap-3 pt-8 pb-4">
                  <p className="text-[10px] text-slate-400 font-medium italic">配置完以上 GTM 组合后，点击下方进入沙盘推演</p>
                  <button
                    onClick={() => navigateToModule('sandbox', {scrollToTop: true})}
                    className="group flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl text-sm font-bold hover:bg-zenith-accent transition-all shadow-xl hover:shadow-zenith-accent/20"
                  >
                    下一步：进入沙盘推演
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
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
                  <MetricCard label="获客成本 (CAC)" value="$12.40 USD" change="4.2%" trend="down" />
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
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tick={{ dx: -10 }} tickFormatter={(value) => `$${value}`} />
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
                    onClick={() => navigateToModule('generator')}
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
                    onClick={() => navigateToModule('monitoring')}
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
                    onClick={() => navigateToModule('advisor')}
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
