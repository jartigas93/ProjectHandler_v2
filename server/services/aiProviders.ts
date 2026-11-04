import { GoogleGenAI } from '@google/genai';

export interface AICallParams {
  provider: 'claude' | 'openai' | 'copilot' | 'gemini';
  model: string;
  systemInstruction: string;
  promptContent: string;
  keys?: {
    anthropicApiKey?: string;
    openAiApiKey?: string;
    azureApiKey?: string;
    azureEndpoint?: string;
    azureDeploymentName?: string;
    azureApiVersion?: string;
    geminiApiKey?: string;
  };
}

/**
 * Normalizes an error thrown by any AI provider into { provider, model, status, message }
 */
export function describeAiError(
  err: any,
  provider: string,
  model?: string
): {
  provider: string;
  model: string;
  status: number | null;
  message: string;
} {
  let message: string = String(err?.message || err || 'Error desconocido del proveedor de IA.');
  let status: number | null =
    typeof err?.status === 'number' ? err.status : typeof err?.code === 'number' ? err.code : null;

  // Claude / OpenAI / Azure errors are thrown as "Proveedor (STATUS): detalle"
  if (status === null) {
    const m = message.match(/\((\d{3})\)/);
    if (m) status = parseInt(m[1], 10);
  }

  // Gemini SDK embeds a JSON payload in the message: {"error":{"code":503,"message":"...","status":"UNAVAILABLE"}}
  const jsonStart = message.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(message.slice(jsonStart));
      const inner = parsed?.error || parsed;
      if (inner?.message) message = String(inner.message);
      if (status === null && typeof inner?.code === 'number') status = inner.code;
    } catch {}
  }

  if (err instanceof SyntaxError) {
    message = 'El modelo devolvió una respuesta que no es un JSON válido. Inténtalo de nuevo.';
  }

  return { provider, model: model || 'default', status, message };
}

/**
 * Robust JSON extraction from LLM text responses, handling markdown code fences
 * or preamble/postscript text.
 */
export function parseLlmJsonResponse(raw: string): any {
  let cleaned = (raw || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx >= 0 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }
  return JSON.parse(cleaned);
}

/**
 * Executes a prompt with structured JSON output against Claude, OpenAI, Azure Copilot, or Gemini.
 */
export async function callAIProvider(params: AICallParams): Promise<string> {
  const { provider, model, systemInstruction, promptContent, keys } = params;

  // 1. ANTHROPIC CLAUDE
  if (provider === 'claude') {
    const apiKey = keys?.anthropicApiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        'API Key de Anthropic Claude no configurada. Ingrésala en Ajustes o en el archivo .env (ANTHROPIC_API_KEY).'
      );
    }

    const targetModel = model?.trim() || 'claude-3-7-sonnet-20250219';
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: targetModel,
        max_tokens: 4096,
        system: systemInstruction,
        messages: [
          {
            role: 'user',
            content: `${promptContent}\n\nIMPORTANTE: Responde ÚNICAMENTE con el objeto JSON válido que cumple exactamente el esquema, sin texto previo ni posterior, sin comillas triples markdown.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedErr = errText;
      try {
        const jsonErr = JSON.parse(errText);
        parsedErr = jsonErr.error?.message || errText;
      } catch {}
      throw new Error(`Anthropic Claude (${response.status}): ${parsedErr}`);
    }

    const data = (await response.json()) as any;
    return data.content?.[0]?.text || '{}';
  }

  // 2. OPENAI
  if (provider === 'openai') {
    const apiKey = keys?.openAiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        'API Key de OpenAI no configurada. Ingrésala en Ajustes o en el archivo .env (OPENAI_API_KEY).'
      );
    }

    const targetModel = model?.trim() || 'gpt-4o';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: targetModel,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: promptContent },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedErr = errText;
      try {
        const jsonErr = JSON.parse(errText);
        parsedErr = jsonErr.error?.message || errText;
      } catch {}
      throw new Error(`OpenAI (${response.status}): ${parsedErr}`);
    }

    const data = (await response.json()) as any;
    return data.choices?.[0]?.message?.content || '{}';
  }

  // 3. MICROSOFT COPILOT / AZURE OPENAI
  if (provider === 'copilot') {
    const apiKey =
      keys?.azureApiKey?.trim() || process.env.AZURE_OPENAI_KEY?.trim() || process.env.COPILOT_API_KEY?.trim();
    const rawEndpoint = keys?.azureEndpoint?.trim() || process.env.AZURE_OPENAI_ENDPOINT?.trim();
    const deployment =
      keys?.azureDeploymentName?.trim() ||
      process.env.AZURE_OPENAI_DEPLOYMENT?.trim() ||
      (model.includes('mini') ? 'gpt-4o-mini' : 'gpt-4o');
    const apiVersion =
      keys?.azureApiVersion?.trim() || process.env.AZURE_OPENAI_API_VERSION?.trim() || '2024-08-01-preview';

    if (!apiKey || !rawEndpoint) {
      throw new Error(
        'Se requiere Endpoint y API Key de Azure OpenAI / Microsoft Copilot. Configúralos en Ajustes o en el archivo .env.'
      );
    }

    const endpoint = rawEndpoint.replace(/\/$/, '');
    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: promptContent },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedErr = errText;
      try {
        const jsonErr = JSON.parse(errText);
        parsedErr = jsonErr.error?.message || errText;
      } catch {}
      throw new Error(`Microsoft Copilot / Azure (${response.status}): ${parsedErr}`);
    }

    const data = (await response.json()) as any;
    return data.choices?.[0]?.message?.content || '{}';
  }

  // 4. GOOGLE GEMINI
  const geminiKey = keys?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) {
    throw new Error('API Key de Google Gemini no configurada.');
  }

  const geminiInstance = new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const targetModel = model?.trim() || 'gemini-3.6-flash';
  const modelsToTry = [
    targetModel,
    ...['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'].filter(
      (m) => m !== targetModel
    ),
  ];

  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    try {
      const response = await geminiInstance.models.generateContent({
        model: currentModel,
        contents: `${systemInstruction}\n\n${promptContent}\n\nResponde ÚNICAMENTE con el objeto JSON válido.`,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (currentModel !== targetModel) {
        console.warn(
          `[AI Gemini Fallback] El modelo '${targetModel}' no estaba disponible temporalmente (503/404). Solicitud resuelta exitosamente usando '${currentModel}'.`
        );
      }

      return response.text?.trim() || '{}';
    } catch (err: any) {
      lastError = err;
      const errStr = String(err?.message || err);
      const is503 =
        err?.status === 503 ||
        err?.code === 503 ||
        /503|high demand|unavailable|overloaded/i.test(errStr);
      const is404 =
        err?.status === 404 ||
        err?.code === 404 ||
        /404|not found|no longer available/i.test(errStr);

      if (is503 || is404) {
        console.warn(
          `[AI Gemini] Modelo '${currentModel}' no disponible temporalmente (${is503 ? '503 Alta Demanda' : '404 No Disponible'}). Probando alternativa resiliente...`
        );
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

// Terms and topic concepts that must NEVER be parsed as a human participant/assignee
export const NON_PERSON_KEYWORDS = [
  'business dims', 'business dim', 'business', 'dim', 'dims',
  'dag', 'dags', 'etl', 'crm', 'crmv2', 'atribución', 'atribucion',
  'pipeline', 'pipelines', 'api', 'apis', 'backend', 'frontend',
  'arquitectura', 'devops', 'cloud', 'database', 'base de datos', 'bd',
  'análisis', 'analisis', 'riesgo', 'riesgos', 'objetivo', 'objetivos',
  'tema', 'temas', 'conclusión', 'conclusion', 'acuerdo', 'acuerdos',
  'resumen', 'minuta', 'nota', 'notas', 'pendiente', 'pendientes',
  'discusión', 'discusion', 'sesión', 'sesion', 'reunión', 'reunion',
  'daily', 'sprint', 'planning', 'criterio', 'criterios', 'propuesta',
  'propuestas', 'documento', 'equipo', 'asistentes', 'participantes', 'contexto'
];

export function isNonPersonName(name: string): boolean {
  if (!name) return true;
  const clean = name.toLowerCase().trim().replace(/^[#\-*\d\.\s:]+/, '').replace(/[:\-_]+$/, '');
  if (clean.length < 2) return true;
  for (const kw of NON_PERSON_KEYWORDS) {
    if (clean === kw || clean.startsWith(kw + ' ') || clean.endsWith(' ' + kw)) {
      return true;
    }
  }
  if (/\b(dag|dags|dim|dims|business dims|crm|crmv2|etl|api|pipeline|backend|frontend|arquitectura)\b/i.test(clean)) {
    return true;
  }
  return false;
}

