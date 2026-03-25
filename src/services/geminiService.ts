import {Type} from '@google/genai';
import {generateWithModelStrategy} from '../modelRuntime';
import type {ModelMode, ModelTask} from '../modelStrategy';
import type {SimulationScenario} from '../types';

const projectSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "产品名称" },
    coreValue: { type: Type.STRING, description: "核心价值主张" },
    usp: { type: Type.STRING, description: "核心卖点" },
    productComposition: { type: Type.STRING, description: "产品构成" },
    userStories: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "用户故事列表"
    },
    directCompetitors: { type: Type.STRING, description: "直接竞品" },
    potentialThreats: { type: Type.STRING, description: "潜在威胁" },
    userPersona: { type: Type.STRING, description: "用户画像" }
  },
  required: ["name", "coreValue", "usp", "productComposition", "userStories", "directCompetitors", "potentialThreats", "userPersona"]
};

export async function analyzeAssetFromLink(url: string) {
  return analyzeAssetFromLinkWithMode(url, 'fast');
}

export async function analyzeAssetFromLinkWithMode(
  url: string,
  selectedMode: ModelMode = 'fast',
) {
  try {
    const response = await generateWithModelStrategy({
      task: 'asset-analysis',
      selectedMode,
      contents: `Extract the product information from the following URL and fill in the required fields: ${url}`,
      tools: [{ urlContext: {} }],
      responseMimeType: 'application/json',
      responseSchema: projectSchema,
    });
    
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('Error analyzing link:', error);
    throw error;
  }
}

export async function analyzeAssetFromFile(file: File) {
  return analyzeAssetFromFileWithMode(file, 'fast');
}

export async function analyzeAssetFromFileWithMode(
  file: File,
  selectedMode: ModelMode = 'fast',
) {
  try {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    let mimeType = file.type;
    if (!mimeType) {
      if (file.name.endsWith('.pdf')) mimeType = 'application/pdf';
      else if (file.name.endsWith('.md')) mimeType = 'text/markdown';
      else if (file.name.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else mimeType = 'text/plain';
    }

    const response = await generateWithModelStrategy({
      task: 'asset-analysis',
      selectedMode,
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        "Extract the product information from the provided document and fill in the required fields."
      ],
      responseMimeType: 'application/json',
      responseSchema: projectSchema,
    });
    
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('Error analyzing file:', error);
    throw error;
  }
}

async function generateTaskResponse(
  prompt: string,
  selectedMode: ModelMode,
  task: ModelTask,
  systemInstruction?: string,
) {
  try {
    const response = await generateWithModelStrategy({
      task,
      selectedMode,
      contents: prompt,
      systemInstruction:
        systemInstruction ||
        '你是 Product-Zenith AI，世界级的产品策略专家。请提供结构化、有见地且数据驱动的建议。',
      temperature: selectedMode === 'creative' ? 0.8 : 0.2,
    });
    return response.text;
  } catch (error) {
    console.error('AI Generation Error:', error);
    return '生成响应时出错。请检查你的网络连接。';
  }
}

export async function generateStrategyResponse(
  prompt: string,
  mode: ModelMode = 'fast',
  systemInstruction?: string,
  task: ModelTask = 'advisor-chat',
) {
  return generateTaskResponse(prompt, mode, task, systemInstruction);
}

export async function analyzeScenarioInputs(
  productData: any,
  selectedMode: ModelMode = 'fast',
) {
  const prompt = `
    作为产品战略分析师，请对以下产品原始输入进行综合解析和摘要，为接下来的增长沙盘推演提供上下文背景。
    
    1. 【灵感实验室】数据：包括核心价值、USP、用户故事、竞品及画像。
    2. 【GTM 营销布局】数据：包括增长模型、定价模型、获客渠道（内容、付费、推介、病毒式、SEO）及成本结构。
    
    原始数据: ${JSON.stringify(productData)}
    
    请输出一段精炼的“输入解析”摘要（200字以内），总结当前项目的核心优势和 GTM 现状。
  `;

  const response = await generateWithModelStrategy({
    task: 'asset-analysis',
    selectedMode,
    contents: prompt,
    systemInstruction: '你是一个专业的产品分析助手。请提供客观、精炼且具有洞察力的分析摘要。',
  });

  return response.text;
}

export async function generateSimulationScenarios(
  productData: any,
  selectedMode: ModelMode = 'fast',
): Promise<{ scenarios: SimulationScenario[]; recommendedCategory: string }> {
  const prompt = `
    作为世界级战略预测专家，分析以下产品及其 GTM 策略，并识别 3-4 个可能的增长剧本或挑战。
    
    产品数据: ${JSON.stringify(productData)}
    
    在生成剧本时，请参考以下四类经典沙盘环境（Archetypes），根据当前产品的实际情况进行针对性演化：
    1. 【巨头降维打击型】：评估当行业巨头或超级应用通过内置免费功能进行竞争时，产品的护城河与留存策略。
    2. 【Aha时刻流量黑洞型】：分析在高新增量下，用户在核心价值体验路径中的流失风险，以及产品闭环的紧凑度。
    3. 【商业化“白嫖”陷阱型】：探讨高日活但低付费转化的情况，评估商业化路径、免费/付费边界以及可能的广告策略影响。
    4. 【需求“超载”与定位偏移型】：分析用户实际需求偏离产品初衷时的抉择，即坚持初衷还是顺应数据修改核心定位。
    
    请返回一个 JSON 对象，包含：
    1. recommendedCategory: 针对该项目的 AI 推荐剧本总分类。
    2. scenarios: 一个数组，每个对象包含：
       - id: 唯一标识符
       - title: 剧本标题
       - description: 剧本描述 (结合上述原型，提供具深度和背景的情况说明)
       - trigger: 触发因子 (具体的数据指标或市场事件)
       - difficulty: 核心难题 (使用者在该剧本下面临的最具挑战性的抉择)
  `;

  const response = await generateWithModelStrategy({
    task: 'sandbox-scenario',
    selectedMode,
    contents: prompt,
    responseMimeType: 'application/json',
    systemInstruction:
      '你是一个专业的博弈论专家和产品经理。请提供具有挑战性、现实性且逻辑严密的场景分类与剧本。',
  });

  try {
    const data = JSON.parse(response.text || '{"scenarios": [], "recommendedCategory": "未分类"}');
    return {
      scenarios: data.scenarios || [],
      recommendedCategory: data.recommendedCategory || "综合增长型"
    };
  } catch (e) {
    return { scenarios: [], recommendedCategory: "数据解析异常" };
  }
}

export async function runSandboxSimulation(
  scenario: string,
  productData: any,
  selectedMode: ModelMode = 'reasoning',
  difficulty: 'Easy' | 'Normal' | 'Hard' = 'Normal',
) {
  const difficultyMap = {
    'Easy': '低难度 (增长较容易, 外部干扰少)',
    'Normal': '标准难度 (现实情况, 存在正常的市场波动)',
    'Hard': '噩梦难度 (极具挑战性, 市场竞争激烈, 意外频发)',
  };

  const prompt = `
    针对以下产品数据运行深度沙盘模拟：
    产品数据: ${JSON.stringify(productData)}
    
    针对以下模拟场景进行博弈推演: "${scenario}"
    推演难度等级: ${difficultyMap[difficulty]}
    
    请运用你的核心数学引擎，详细推演以下维度：
    1. 【潜在结果】：推演 12 个月后的产品状态 (月活、月收入、损益平衡点)。
    2. 【关键风险】：导致该场景失败的灰天鹅或黑天鹅事件 (随难度增加而增加风险频率)。
    3. 【解决难题的关键对策】：针对该场景及难度，提供 3 条实战建议。
    
    请以精炼、专业且利于阅读的格式返回。
  `;
  
  return generateStrategyResponse(
    prompt,
    selectedMode,
    "你是一个沙盘模拟引擎。请基于数据事实驱动，保持批判性，并给出清晰的博弈结论。",
    'sandbox-simulation',
  );
}
