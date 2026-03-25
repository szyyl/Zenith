import {GoogleGenAI, type GenerateContentResponse} from '@google/genai';
import {
  resolveModelStrategy,
  type ModelMode,
  type ModelProvider,
  type ModelTask,
  type ResolvedModelStrategy,
} from './modelStrategy';

const geminiApiKey = process.env.GEMINI_API_KEY || 'UNCONFIGURED_API_KEY';
const geminiClient = new GoogleGenAI({apiKey: geminiApiKey});

export interface ModelRuntimeRequest {
  task: ModelTask;
  selectedMode?: ModelMode;
  contents: string | Array<unknown>;
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: unknown;
  tools?: Array<unknown>;
  temperature?: number;
}

export interface ModelRuntimeResponse {
  text: string;
  strategy: ResolvedModelStrategy;
}

interface ModelProviderAdapter {
  generateContent(
    strategy: ResolvedModelStrategy,
    request: ModelRuntimeRequest,
  ): Promise<GenerateContentResponse>;
}

const geminiAdapter: ModelProviderAdapter = {
  async generateContent(strategy, request) {
    return geminiClient.models.generateContent({
      model: strategy.modelId,
      contents: request.contents as never,
      config: {
        systemInstruction: request.systemInstruction,
        responseMimeType: request.responseMimeType,
        responseSchema: request.responseSchema as never,
        tools: request.tools as never,
        temperature: request.temperature,
      },
    });
  },
};

const PROVIDER_ADAPTERS: Partial<Record<ModelProvider, ModelProviderAdapter>> = {
  gemini: geminiAdapter,
};

const getProviderAdapter = (provider: ModelProvider) => {
  const adapter = PROVIDER_ADAPTERS[provider];
  if (!adapter) {
    throw new Error(
      `Model provider "${provider}" is configured but no runtime adapter has been installed yet.`,
    );
  }
  return adapter;
};

export const generateWithModelStrategy = async (
  request: ModelRuntimeRequest,
): Promise<ModelRuntimeResponse> => {
  const strategy = resolveModelStrategy(request.task, request.selectedMode);
  const adapter = getProviderAdapter(strategy.provider);
  const response = await adapter.generateContent(strategy, request);

  return {
    text: response.text || '',
    strategy,
  };
};
