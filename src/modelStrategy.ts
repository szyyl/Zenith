export type ModelProvider = 'gemini' | 'openai' | 'anthropic';

export type ModelMode = 'fast' | 'reasoning' | 'creative' | 'long-context';

export type ModelTask =
  | 'asset-analysis'
  | 'advisor-chat'
  | 'sandbox-scenario'
  | 'sandbox-simulation';

export type ModelProfileKey =
  | 'gemini.flash'
  | 'gemini.pro'
  | 'openai.fast'
  | 'openai.reasoning'
  | 'anthropic.fast'
  | 'anthropic.reasoning';

export interface ModelProfile {
  key: ModelProfileKey;
  provider: ModelProvider;
  modelId: string;
  displayName: string;
  description: string;
}

export interface ModelTaskStrategy {
  task: ModelTask;
  fallbackMode: ModelMode;
  profileByMode: Partial<Record<ModelMode, ModelProfileKey>>;
}

export interface ResolvedModelStrategy {
  task: ModelTask;
  selectedMode: ModelMode;
  effectiveMode: ModelMode;
  profileKey: ModelProfileKey;
  provider: ModelProvider;
  modelId: string;
  displayName: string;
  description: string;
}

export interface UiModelOption {
  mode: Extract<ModelMode, 'fast' | 'reasoning'>;
  label: string;
  description: string;
  displayName: string;
}

const MODEL_MODE_LABELS: Record<Extract<ModelMode, 'fast' | 'reasoning'>, string> = {
  fast: '⚡ 快速模式',
  reasoning: '🧠 深度推理',
};

export const MODEL_PROFILES: Record<ModelProfileKey, ModelProfile> = {
  'gemini.flash': {
    key: 'gemini.flash',
    provider: 'gemini',
    modelId: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    description: '低延迟响应',
  },
  'gemini.pro': {
    key: 'gemini.pro',
    provider: 'gemini',
    modelId: 'gemini-2.5-pro-preview-05-06',
    displayName: 'Gemini 2.5 Pro',
    description: '复杂逻辑分析',
  },
  'openai.fast': {
    key: 'openai.fast',
    provider: 'openai',
    modelId: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 mini',
    description: '低延迟响应',
  },
  'openai.reasoning': {
    key: 'openai.reasoning',
    provider: 'openai',
    modelId: 'o4-mini',
    displayName: 'o4-mini',
    description: '复杂逻辑分析',
  },
  'anthropic.fast': {
    key: 'anthropic.fast',
    provider: 'anthropic',
    modelId: 'claude-3-5-haiku-latest',
    displayName: 'Claude 3.5 Haiku',
    description: '低延迟响应',
  },
  'anthropic.reasoning': {
    key: 'anthropic.reasoning',
    provider: 'anthropic',
    modelId: 'claude-3-7-sonnet-latest',
    displayName: 'Claude 3.7 Sonnet',
    description: '复杂逻辑分析',
  },
};

export const MODEL_TASK_STRATEGIES: Record<ModelTask, ModelTaskStrategy> = {
  'asset-analysis': {
    task: 'asset-analysis',
    fallbackMode: 'fast',
    profileByMode: {
      fast: 'gemini.flash',
      reasoning: 'gemini.pro',
      creative: 'gemini.flash',
      'long-context': 'gemini.pro',
    },
  },
  'advisor-chat': {
    task: 'advisor-chat',
    fallbackMode: 'fast',
    profileByMode: {
      fast: 'gemini.flash',
      reasoning: 'gemini.pro',
      creative: 'gemini.flash',
      'long-context': 'gemini.pro',
    },
  },
  'sandbox-scenario': {
    task: 'sandbox-scenario',
    fallbackMode: 'fast',
    profileByMode: {
      fast: 'gemini.flash',
      reasoning: 'gemini.pro',
      creative: 'gemini.flash',
      'long-context': 'gemini.pro',
    },
  },
  'sandbox-simulation': {
    task: 'sandbox-simulation',
    fallbackMode: 'reasoning',
    profileByMode: {
      fast: 'gemini.flash',
      reasoning: 'gemini.pro',
      creative: 'gemini.pro',
      'long-context': 'gemini.pro',
    },
  },
};

export const resolveModelStrategy = (
  task: ModelTask,
  selectedMode: ModelMode = 'fast',
): ResolvedModelStrategy => {
  const taskStrategy = MODEL_TASK_STRATEGIES[task];
  const effectiveMode =
    taskStrategy.profileByMode[selectedMode] !== undefined
      ? selectedMode
      : taskStrategy.fallbackMode;

  const profileKey = taskStrategy.profileByMode[effectiveMode];
  if (!profileKey) {
    throw new Error(`No model profile configured for task "${task}" and mode "${effectiveMode}".`);
  }

  const profile = MODEL_PROFILES[profileKey];

  return {
    task,
    selectedMode,
    effectiveMode,
    profileKey,
    provider: profile.provider,
    modelId: profile.modelId,
    displayName: profile.displayName,
    description: profile.description,
  };
};

export const buildUiModelOption = (
  mode: Extract<ModelMode, 'fast' | 'reasoning'>,
  task: ModelTask = 'advisor-chat',
): UiModelOption => {
  const strategy = resolveModelStrategy(task, mode);

  return {
    mode,
    label: MODEL_MODE_LABELS[mode],
    description: `${strategy.displayName} · ${strategy.description}`,
    displayName: strategy.displayName,
  };
};
