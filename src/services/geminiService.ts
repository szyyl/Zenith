import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "UNCONFIGURED_API_KEY";
const ai = new GoogleGenAI({ apiKey });

export type ModelMode = 'fast' | 'reasoning' | 'creative' | 'long-context';

export const MODEL_MAP: Record<ModelMode, string> = {
  'fast': 'gemini-3-flash-preview',
  'reasoning': 'gemini-3.1-pro-preview',
  'creative': 'gemini-3-flash-preview', // Flash is actually quite creative and fast
  'long-context': 'gemini-3.1-pro-preview',
};

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
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Extract the product information from the following URL and fill in the required fields: ${url}`,
      config: {
        tools: [{ urlContext: {} }],
        responseMimeType: "application/json",
        responseSchema: projectSchema
      }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error analyzing link:", error);
    throw error;
  }
}

export async function analyzeAssetFromFile(file: File) {
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

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        "Extract the product information from the provided document and fill in the required fields."
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: projectSchema
      }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error analyzing file:", error);
    throw error;
  }
}

export async function generateStrategyResponse(prompt: string, mode: ModelMode = 'fast', systemInstruction?: string) {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_MAP[mode],
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || "你是 Product-Zenith AI，世界级的产品策略专家。请提供结构化、有见地且数据驱动的建议。",
        temperature: mode === 'creative' ? 0.8 : 0.2,
      },
    });
    return response.text;
  } catch (error) {
    console.error("AI Generation Error:", error);
    return "生成响应时出错。请检查你的网络连接。";
  }
}

export async function runSandboxSimulation(scenario: string, productData: any) {
  const prompt = `
    针对以下产品和场景运行沙盘模拟。
    产品数据: ${JSON.stringify(productData)}
    场景: ${scenario}
    
    提供详细分析，包括：
    1. 潜在结果 (成功/失败)
    2. 关键风险
    3. 财务影响 (预估)
    4. 建议行动
    
    以适合解析的结构化格式返回响应。
  `;
  
  return generateStrategyResponse(prompt, 'reasoning', "你是一个模拟引擎。请保持批判性、现实性，并使用数学逻辑。");
}
