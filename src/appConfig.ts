import {
  Activity,
  BrainCircuit,
  FileOutput,
  LayoutDashboard,
  LineChart,
  ShieldAlert,
  Target,
} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {
  buildUiModelOption,
  type ModelMode,
} from './modelStrategy';
import type {AppState, ProductData} from './types';

export interface SidebarSubItem {
  id: string;
  label: string;
}

export interface SidebarModuleConfig {
  id: AppState['activeModule'];
  label: string;
  icon: LucideIcon;
  subItems: SidebarSubItem[];
}

export interface ModelOption {
  mode: Extract<ModelMode, 'fast' | 'reasoning'>;
  label: string;
  description: string;
  displayName: string;
}

const BASE_PROJECT: Omit<ProductData, 'id' | 'name'> = {
  coreValue: '',
  usp: '',
  productComposition: '',
  userStories: [],
  directCompetitors: '',
  potentialThreats: '',
  userPersona: '',
  gtmModel: 'PLG',
  pricingModel: 'Freemium',
  targetMarket: {
    country: '',
    age: '',
    occupation: '',
    income: '',
  },
  salesCycle: 'Short',
  gtmStrategy: {
    contentMarketing: { volume: 0, unitCost: 5000, cvr: 2 },
    paidAds: { volume: 0, unitCost: 100, cvr: 5 },
    referral: { volume: 0, unitCost: 10, cvr: 10 },
    viral: { volume: 0, kFactor: 1.2, cvr: 8 }, // Replaced outboundSales -> viral
    seoAso: { volume: 0, unitCost: 100 },
    retentionRate: 30, // 30% default retention
  },
  costStructure: {
    dailyFreeUses: 5,
    costPerCall: 0.01,
    targetMau: 100000,
    paidConversionRate: 3,
    monthlySubscription: 19.99,
  },
  scores: {
    feasibility: 0,
    marketPotential: 0,
    riskResilience: 0,
  },
};

export const DEFAULT_PROJECT_ID = 'default-1';
export const DEFAULT_PROJECT_NAME = '未命名项目';

export const createProject = (
  id: string,
  name = DEFAULT_PROJECT_NAME,
): ProductData => ({
  id,
  name,
  ...structuredClone(BASE_PROJECT),
});

export const MOCK_CHART_DATA = [
  {name: '1月', users: 400, revenue: 2400},
  {name: '2月', users: 1200, revenue: 8000},
  {name: '3月', users: 2100, revenue: 15000},
  {name: '4月', users: 3800, revenue: 32000},
  {name: '5月', users: 5100, revenue: 48000},
  {name: '6月', users: 7200, revenue: 75000},
];

export const AUTO_FILL_TAGS = ['核心身份', '用户故事', '竞品格局', '用户画像'];

export const TARGET_MARKET_COUNTRIES = [
  '中国',
  '中国台湾',
  '米国 (美国)',
  '美国',
  '英国',
  '小日本',
  '德国',
  '法国',
  '俄罗斯',
  '加拿大',
  '澳大利亚',
  '巴西',
  '印度',
  '韩国',
  '新加坡',
  '意大利',
  '西班牙',
  '墨西哥',
  '印度尼西亚',
  '沙特阿拉伯',
  '土耳其',
  '荷兰',
  '瑞士',
  '瑞典',
  '挪威',
  '丹麦',
  '芬兰',
  '希腊',
  '葡萄牙',
  '爱尔兰',
  '奥地利',
  '比利时',
  '捷克',
  '波兰',
  '匈牙利',
  '罗马尼亚',
  '越南',
  '泰国',
  '马来西亚',
  '菲律宾',
  '哈萨克斯坦',
  '阿拉伯联合酋长国',
  '以色列',
  '埃及',
  '南非',
  '尼日利亚',
  '阿根廷',
  '智利',
  '哥伦比亚',
  '秘鲁',
  '新西兰',
  '乌克兰',
  '巴基斯坦',
  '孟加拉国',
  '伊朗',
  '伊拉克',
  '阿尔及利亚',
  '摩洛哥',
  '肯尼亚',
  '埃塞俄比亚',
  '加纳',
  '坦桑尼亚',
];

export const MODEL_OPTIONS: ModelOption[] = [
  buildUiModelOption('fast'),
  buildUiModelOption('reasoning'),
];

export const SIDEBAR_MODULES: SidebarModuleConfig[] = [
  {
    id: 'input',
    label: '灵感实验室',
    icon: LayoutDashboard,
    subItems: [
      {id: 'input-identity', label: '核心身份'},
      {id: 'input-stories', label: '用户故事'},
      {id: 'input-competition', label: '竞品格局'},
      {id: 'input-upload', label: '资产上传'},
      {id: 'input-persona', label: '用户画像'},
    ],
  },
  {
    id: 'gtm',
    label: 'GTM 营销布局',
    icon: Target,
    subItems: [
      {id: 'gtm-model', label: '增长模型'},
      {id: 'gtm-cost', label: '产品运营成本计算'},
      {id: 'gtm-summary', label: 'GTM 操盘计划总结'},
    ],
  },
  {
    id: 'sandbox',
    label: '动态沙盘推演',
    icon: ShieldAlert,
    subItems: [
      {id: 'sandbox-analysis', label: '解析结果'},
      {id: 'sandbox-engine', label: '剧本生成'},
      {id: 'sandbox-simulation', label: '深度推演'},
    ],
  },
  {
    id: 'diagnostics',
    label: '诊断与评分',
    icon: Activity,
    subItems: [
      {id: 'diagnostics-radar', label: '健康雷达'},
      {id: 'diagnostics-heatmap', label: '风险热图'},
      {id: 'diagnostics-breakdown', label: '评分透明化'},
    ],
  },
  {
    id: 'monitoring',
    label: '监控哨所',
    icon: LineChart,
    subItems: [
      {id: 'monitoring-live', label: '实时指标'},
      {id: 'monitoring-sentiment', label: '情感趋势'},
      {id: 'monitoring-backtest', label: '预测回测'},
    ],
  },
  {
    id: 'generator',
    label: '资产生成',
    icon: FileOutput,
    subItems: [
      {id: 'generator-ppt', label: 'PPT 报告'},
      {id: 'generator-prd', label: 'PRD V2.0'},
      {id: 'generator-marketing', label: '营销素材'},
    ],
  },
  {
    id: 'advisor',
    label: '进化顾问',
    icon: BrainCircuit,
    subItems: [
      {id: 'advisor-chat', label: '进化对话'},
      {id: 'advisor-knowledge', label: '知识库'},
      {id: 'advisor-history', label: '历史推演'},
    ],
  },
];

export const DEFAULT_SUBMODULE_BY_MODULE: Record<AppState['activeModule'], string> =
  SIDEBAR_MODULES.reduce(
    (acc, module) => {
      acc[module.id] = module.subItems[0]?.id ?? '';
      return acc;
    },
    {} as Record<AppState['activeModule'], string>,
  );

export const SIMULATION_CSV_HEADERS = [
  'ID',
  'Timestamp',
  'Scenario',
  'Outcome',
  'Impact',
  'Risks',
  'Recommendations',
  'Inference Cost',
];
