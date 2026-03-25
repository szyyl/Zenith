import {Type} from '@google/genai';
import {generateWithModelStrategy} from '../modelRuntime';
import type {ModelMode, ModelTask} from '../modelStrategy';

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

export async function generateSimulationScenarios(
  productData: any,
  selectedMode: ModelMode = 'fast',
) {
  const prompt = `
    作为世界级战略预测专家，分析以下产品及其 GTM 策略，并识别 3-4 个可能的增长剧本或挑战。
    产品数据: ${JSON.stringify(productData)}
    
    返回 JSON 数组，每个对象包含：
    - id: 唯一标识符
    - title: 剧本标题 (如 "病毒式爆发"、"获客成本陷阱"、"留存危机")
    - description: 剧本描述，解释为什么会发生这种情况。
    - trigger: 触发该剧本的关键因素 (例如 "如果付费渠道 CVR > 8%")
    - difficulty: 使用者将面临的核心难题 (遇到的难题)
  `;
  
  const response = await generateWithModelStrategy({
    task: 'sandbox-scenario',
    selectedMode,
    contents: prompt,
    responseMimeType: 'application/json',
    systemInstruction:
      '你是一个专业的博弈论专家和产品经理。请提供具有挑战性、现实性且逻辑严密的场景。',
  });

  return JSON.parse(response.text || '[]');
}

export async function runSandboxSimulation(
  scenario: string,
  productData: any,
  selectedMode: ModelMode = 'reasoning',
) {
  const prompt = `
    针对以下产品数据运行深度沙盘模拟：
    产品数据: ${JSON.stringify(productData)}
    
    针对以下模拟场景进行博弈推演: "${scenario}"
    
    请运用你的核心数学引擎，详细推演以下维度：
    1. 【潜在结果】：推演 12 个月后的产品状态（月活、月收入、损益平衡点）。
    2. 【关键风险】：导致该场景失败的灰天鹅或黑天鹅事件。
    3. 【解决难题的关键对策】：针对该场景面临的难题，提供 3 条实战建议。
    
    请以精炼、专业且利于阅读的格式返回。
  `;
  
  return generateStrategyResponse(
    prompt,
    selectedMode,
    "你是一个沙盘模拟引擎。请基于数据事实驱动，保持批判性，并给出清晰的博弈结论。",
    'sandbox-simulation',
  );
}
