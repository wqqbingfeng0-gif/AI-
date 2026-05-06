import { GoogleGenAI, Type } from "@google/genai";

async function callGeminiProxy(params: any) {
  // Check for custom user-provided API key, otherwise fallback to platform default
  const customApiKey = localStorage.getItem('CUSTOM_GEMINI_API_KEY');
  const ai = new GoogleGenAI({ apiKey: customApiKey || process.env.GEMINI_API_KEY });
  
  let modelsToTry = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash"
  ];

  if (params.model && !modelsToTry.includes(params.model) && !params.model.includes('preview')) {
    modelsToTry.unshift(params.model);
  }

  let lastError = null;

  for (const modelToUse of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: params.contents,
        config: params.config
      });
      
      return {
        text: response.text
      };
    } catch (error: any) {
      console.warn(`Model ${modelToUse} failed:`, error?.message || error);
      lastError = error;
      
      // If it's an authorization error and we are out of models, we should break
      if (error?.message?.includes('API key not valid') || error?.message?.includes('API_KEY_INVALID')) {
         break;
      }

      // If entity not found, it means model tier is not accessible, fallback quietly
      if (error?.message?.includes('Requested entity was not found')) {
         continue;
      }
      
      // Also fallback on 500s or resource exhausted, otherwise we keep trying
      continue;
    }
  }

  console.error("Gemini API Error after fallbacks:", lastError);
  throw lastError;
}

export const geminiService = {
  /**
   * Analyzes the visual tone of an image (lighting, color, atmosphere, etc.)
   */
  async analyzeVisualTone(imageBase64: string, mimeType: string) {
    const prompt = `
      任务：作为影视摄影专家，请通过 4 个核心维度对这张剧照进行参数化拆解。
      
      输出结构要求 (zh 字段)：
      必须严格遵循以下格式，每一项必须独立成行，禁用加粗、禁用列表符号、禁用 Markdown 语法。
      
      风格：{描述流派与艺术色调}
      光影与色彩：{描述光效性质、色彩倾向、空间氛围}
      技术/镜头参数：{焦段建议、画幅、景深、颗粒感}
      
      注意：zh 字段不要包含任何其他说明文字，仅输出以上 3 行内容。
      
      输出要求：
      - zh: 仅包含上述 3 行精简参数，确保每行末尾都有换行符。全部使用中文。
      - json: 关键参数字典。
    `;

    const response = await callGeminiProxy({
      model: "gemini-3.1-pro-preview", 
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    return parseJSONResponse(response.text);
  },

  /**
   * Generates a character cinematic still prompt based on character description and a visual tone.
   */
  async generateCharacterStill(characterDesc: string, toneDesc: string, globalContext: string = "") {
    const prompt = `
      任务：作为影视角色设计师，基于提供的“视觉基调模板”、“项目全局风格”和“角色描述”，合成最终的剧照方案。所有描述均需使用中文。
      
      项目全局风格 (核心前提): ${globalContext}

      视觉基调模板:
      """
      ${toneDesc}
      """
      
      角色描述输入:
      """
      ${characterDesc}
      """
      
      合成规则：
      1. 识别模板中 [通用画质锁定：]、[环境锁定：]、[质感锁定：] 的内容。
      2. 根据“角色描述输入”，撰写极具镜头感、高清写实细节的“角色与服饰描述”。
      3. 最终输出的“zh”字段必须严格遵循以下纵向排版格式，每个标签必须独占一行，标签后紧随具体描述文本，严禁出现加粗（**）或斜体：
      
      [通用画质锁定：]
      {模板内容}
      
      [环境锁定：]
      {模板内容，可根据角色描述微调环境细节}
      
      [角色描写&服饰描写：]
      {AI生成的角色与服饰细节描述，中文描写，强调物理真实感，去AI塑料感}
      
      [质感锁定：]
      {模板内容}
      
      输出要求：
      - zh: 按上述模版生成的完整中文方案，确保换行清晰。全部使用中文。
      - json: 角色核心视觉参数。
    `;

    const response = await callGeminiProxy({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    return parseJSONResponse(response.text);
  },

  /**
   * Generates a character three-view prompt based on character description and a visual tone.
   */
  async generateCharacterThreeView(characterDesc: string, toneDesc: string, globalContext: string = "") {
    const prompt = `
      任务：根据提供的“角色核心描述”和“项目全局风格”，合成“工业级角色设计三视图”规格书。所有内容使用中文。
      
      项目全局风格 (核心前提): ${globalContext}

      角色核心描述输入:
      """
      ${characterDesc}
      """
      
      输出规范（zh 字段必须严格按照以下中文模版排版，严禁使用加粗）：
      
      [任务设定]： 生成一张纯白背景（RGB: 255,255,255）的四格人物三视图。
      
      [结构规则]： 横向四等分构图，必须有明确分割线。从左到右：1.面部特写；2.全身正面；3.全身侧面；4.全身背面。
      
      [角色主体]： {请根据用户输入提炼出角色的具体物理描写：如年龄、表情、肤色纹理细节、服装样式与层级、材质表现等。确保描述简洁且具备高还原度。全部使用中文。}
      
      [视觉风格锁定]： 真实摄影风格，严禁CGI渲染感。皮肤必须具备真实人体的毛孔与纹理，哑光质感，禁止任何磨皮与反光。灯光采用均匀的室内工作室平光，禁止产生复杂阴影，禁止环境光干扰。色彩饱和度中性，禁止偏色。
      
      [负面约束]： (环境背景), (大漠/户外), (室外光), (CGI建模感), (过度磨皮), (高光油腻), (多图拼接错误), (偏色), (色彩饱和度过高), 文字, 水印, logo, 模糊。

      输出要求：
      - zh: 按上述模版生成的完整中文规格书，排版必须清晰，每个部分（如 [任务设定]）单独成行。全部使用中文。
      - json: 角色特征参数字典.
    `;

    const response = await callGeminiProxy({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    return parseJSONResponse(response.text);
  },

  /**
   * Generates a screenplay outline and storyboard based on user input.
   */
  async generateStoryboard(input: string, globalContext: string = "") {
    const prompt = `
      请作为资深真人短剧导演（擅长5-15秒快节奏短视频叙事），结合“项目全局风格”，对以下输入内容进行深度重构与分镜设计。
      
      项目全局风格 (核心前提): ${globalContext}

      输入内容包含：【项目背景/故事梗概/人物小传】以及【剧本正文】。
      输入数据: "${input}"
      
      任务目标：
      1. 导演级分析：识别“剧本正文”并结合背景，以专业导演视角规划镜头。
      2. 节奏控制：每个片段时长必须严格控制在 5-15秒 之间，适应主流短视频工具。
      3. 台词严谨性：【核心要求】必须严格区分“配音角色”。剧本中由特定角色说出的台词，必须归属于该角色名下，严禁笼统归类为“旁白”。只有剧本明确标注为旁白或内心独白的，才可标注为旁白。
      4. 严格结构：输出内容必须严格按照以下 Markdown 结构排版（zh 字段）：

      # 故事梗概
      内容梗概：{简述剧情冲突与核心走向}

      # 剧本亮点
      亮点1：{简述第1个核心看点/动作设计}
      亮点2：{简述第2个核心看看点/叙事反转}
      亮点3：{简述第3个视觉奇观/情感共鸣}

      # 美术风格
      基础画风风格词：{如：真人古风 / 未来科幻 / 都市写实}
      视觉风格描述：{详细描述光影、色调、颗粒感、构图倾向等}

      # 主体列表
      {角色名}：{角色详尽视觉描述, 强调物理真实感}

      # 场景列表
      {场景名}：{环境细节、物理材质、光影氛围描述}

      # 分镜剧本
      剧本摘要
      片段数量：{片段总数}
      旁白音色
      {描述配音员音色特征}

      ## 片段1
      时长：{建议时长}s
      
      ### 分镜 1
      - 画面描述：{详细画面内容}
      - 构图设计：{如：大远景，三分法构图}
      - 运镜调度：{如：固定镜头 / 环绕运镜}
      - 配音角色：{角色名，必须与剧本对话者一致}
      - 台词内容："{台词}"

       {以此类推记录每个分镜...}

      5. 资产提取：同步提取核心资产到 json 字段中。必须严格按照以下 JSON 结构：
      {
        "assets": {
          "characters": ["角色1描述", "角色2描述"],
          "scenes": ["场景1描述", "场景2描述"],
          "props": ["道具1", "道具2"]
        },
        "summary": "...",
        "highlights": ["...", "..."]
      }

      输出要求：
      - zh: 按照上述严谨模版生成的完整中文文档，严禁使用加粗（**）或斜体（*）。全部使用中文。
      - json: 返回格式化数据。
    `;

    let response;
    try {
      response = await callGeminiProxy({
        model: "gemini-3.1-pro-preview", 
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA
        }
      });
    } catch (error) {
      console.error("Storyboard generic fallback generation failed:", error);
      throw error;
    }

    return parseJSONResponse(response.text);
  },

  /**
   * Performs an AI audit/verification on the generated storyboard.
   */
  async verifyStoryboard(script: string, storyboard: string) {
    const prompt = `
      任务：作为【总台级首席编审】，对初版分镜描述进行严格的一致性审计更正。
      
      核心指令：
      1. 【严禁幻觉】：分镜中的台词必须100%直接取自下方的“原始剧本”。严禁改写台词，严禁 AI 自行扩充台词。
      2. 【角色对齐】：识别原始剧本中每一句台词的真实说话者。如果初版中将“秦棠”的台词标为了“旁白”，必须立即修正为“配音角色：秦棠”。
      3. 【格式强制】：输出的 "zh" 字段内容必须是完整的、结构化的 Markdown。它必须是修正后的“分镜剧本”本身，严禁包含任何“审计报告”、“编审寄语”或前言。
      
      原始剧本内容 (必须以此为准):
      """
      ${script}
      """
      
      待审计分镜初稿:
      """
      ${storyboard}
      """
      
      输出结构要求 (zh 字段必须严格遵循此格式):
      # 故事梗概
      内容梗概：...
      
      # 剧本亮点
      亮点1：...
      
      # 美术风格
      基础画风风格词：...
      视觉风格描述：...
      
      # 主体列表
      ...
      
      # 场景列表
      ...
      
      # 分镜剧本
      剧本摘要
      片段数量：...
      旁白音色
      ...
      
      ## 片段1
      时长：...s
      ### 分镜 1
      - 画面描述：...
      - 构图设计：...
      - 运镜调度：...
      - 配音角色：...
      - 台词内容："{必须原汁原味取自剧本}"
      
      反面案例 (绝对禁止出现在 zh 字段):
      "作为编审，我发现..." -> 错误！直接输出剧本。
      "台词已修正..." -> 错误！直接输出剧本。
      
      审计反馈 (必须放在 json 字段):
      必须严格按照以下 JSON 结构：
      {
        "audit_score": 0-100, 
        "audit_suggestions": "简述你修正了哪些具体的幻觉或逻辑错误",
        "assets": {
          "characters": ["角色1描述", "角色2描述"], 
          "scenes": ["场景1描述", "场景2描述"],
          "props": ["道具1", "道具2"]
        }
      }
    `;

    const response = await callGeminiProxy({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    return parseJSONResponse(response.text);
  },

  /**
   * Generates scene description prompt.
   */
  async generateScenePrompt(sceneDesc: string, toneDesc: string, globalContext: string = "") {
    const prompt = `
      任务：结合“场景描述”、“项目全局风格”和“视觉基调模板”，合成工业级场景概念设计方案。所有内容使用中文。
      
      项目全局风格 (核心前提): ${globalContext}

      视觉基调模板 (作为基础参考):
      """
      ${toneDesc}
      """
      
      场景原始描述:
      """
      ${sceneDesc}
      """
      
      合成规则：
      1. 识别模板中 [通用画质锁定：]、[环境锁定：]、[质感锁定：] 的内容。
      2. 根据“场景原始描述”，撰写具备极致空间感、宏大环境细节与物理材质细节的“场景空间描写”。
      3. 最终输出的“zh”字段必须严格遵循以下纵向排版格式，标签后紧随具体描述文本，严禁出现加粗（**）或斜体：
      
      [通用画质锁定：]
      {模板内容}
      
      [环境锁定：]
      {模板内容，必须根据“场景原始描述”高度融合，补充具体的地理地貌、建筑结构、天气、光线入射方向等细节}
      
      [场景空间描写：]
      {AI生成的空间细节描述。强调环境深度、空间物理比例、建筑材质、地面细节、点景物（如旗帜、马车、植物）、气氛（如风沙、薄雾等）}
      
      [质感锁定：]
      {模板内容}
      
      输出要求：
      - zh: 按上述模版生成的完整中文方案，确保换行清晰。全部使用中文。
      - json: 场景核心视觉参数（包含天气、光影、主要材质、焦距建议）。
    `;

    const response = await callGeminiProxy({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });
    return parseJSONResponse(response.text);
  },

  /**
   * Reverses a prompt from an image for reproduction with 'nanobanana'.
   */
  async reversePrompt(imageBase64: string, mimeType: string) {
    const prompt = `
      任务：作为“提示词反推专家”，请对上传图片进行极致参数化拆解。
      
      输出结果规范 (zh 字段)：
      必须严格按以下格式输出，禁用加粗、禁用列表符号。每一项必须独占一行。
      
      风格：{简述流派风格}
      主体：{详细描述人物/物体的外貌、服饰、动作}
      光影与色彩：{描述背景光效、色彩倾向}
      技术/镜头参数：{焦段建议、虚化程度、构图}
      
      [nanobanana 中文复刻提示词]
      {在此合成一段包含 'nanobanana' 关键字的繁体或简体中文提示词，必须与上述分析匹配，字数详尽，排版整洁，确保能够真实复刻原图神韵}
      
      输出字段分配：
      - zh: 仅包含上述 4 行参数和 [nanobanana 中文复刻提示词] 部分。全部使用中文。
      - json: 关键词数组。
    `;

    const response = await callGeminiProxy({
      model: "gemini-3.1-pro-preview", 
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    return parseJSONResponse(response.text);
  },

  /**
   * Generates raw content using a system instruction and user input.
   */
  async generateRawContent(input: string, systemPrompt: string) {
    const response = await callGeminiProxy({
      model: "gemini-1.5-pro",
      contents: input,
      config: {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        temperature: 0.7
      }
    });

    return typeof response.text === 'function' ? response.text() : String(response.text || "");
  }
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    zh: { type: "string" },
    en: { type: "string" },
    json: { type: "string" }
  },
  required: ["zh", "json"]
};

function parseJSONResponse(text: string | any) {
  if (typeof text !== 'string') {
    return {
      zh: text?.zh || "",
      en: text?.en || "",
      json: typeof text?.json === 'string' ? JSON.parse(text.json) : (text?.json || {})
    };
  }
  try {
    const data = JSON.parse(text);
    return {
      zh: data.zh || "",
      en: data.en || "",
      json: typeof data.json === 'string' ? JSON.parse(data.json) : (data.json || {})
    };
  } catch (e) {
    console.error("Failed to parse Gemini JSON response:", e);
    return { zh: text, en: "", json: {} };
  }
}
