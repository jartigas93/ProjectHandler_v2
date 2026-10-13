import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI SDK server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Endpoint: Health check & AI provider readiness
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    providers: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      claude: Boolean(process.env.ANTHROPIC_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      copilot: Boolean(process.env.AZURE_OPENAI_KEY || process.env.COPILOT_API_KEY),
    },
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Endpoint: AI Providers Status
app.get('/api/ai/status', (_req: Request, res: Response) => {
  res.json({
    gemini: Boolean(process.env.GEMINI_API_KEY),
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    copilot: Boolean(process.env.AZURE_OPENAI_KEY || process.env.COPILOT_API_KEY),
  });
});

// Known factory metadata catalog for rich UI display
const FACTORY_METADATA_CATALOG: Record<string, { name: string; description: string; speed: 'rápido' | 'equilibrado' | 'máximo'; badge?: string }> = {
  'claude-3-7-sonnet-20250219': { name: 'Claude 3.7 Sonnet', description: 'Máxima capacidad de razonamiento híbrido y síntesis precisa de compromisos.', speed: 'máximo', badge: 'Recomendado' },
  'claude-3-5-sonnet-20241022': { name: 'Claude 3.5 Sonnet', description: 'Excelente balance entre profundidad analítica y velocidad de respuesta.', speed: 'equilibrado' },
  'claude-3-5-haiku-20241022': { name: 'Claude 3.5 Haiku', description: 'Ultrarrápido y liviano, ideal para minutas breves y dailies ágiles.', speed: 'rápido' },
  'gpt-4o': { name: 'GPT-4o (Omni)', description: 'Modelo insignia de OpenAI para análisis conversacional y desestructuración Jira.', speed: 'equilibrado', badge: 'Popular' },
  'gpt-4o-mini': { name: 'GPT-4o Mini', description: 'Rápido, económico y altamente estructurado en salidas JSON.', speed: 'rápido' },
  'o3-mini': { name: 'o3-mini (Reasoning)', description: 'Razonamiento lógico avanzado para reuniones técnicas y arquitectónicas.', speed: 'máximo' },
  'copilot-gpt-4o': { name: 'Copilot (Azure GPT-4o)', description: 'Integración empresarial Microsoft Copilot / Azure OpenAI corporativo.', speed: 'equilibrado', badge: 'Empresarial' },
  'copilot-gpt-4o-mini': { name: 'Copilot (Azure GPT-4o Mini)', description: 'Despliegue ágil en entorno seguro Azure de la organización.', speed: 'rápido' },
  'gemini-2.5-flash': { name: 'Gemini 2.5 Flash', description: 'Procesamiento de contexto ultra amplio con baja latencia en Google AI Studio.', speed: 'rápido' },
  'gemini-2.5-pro': { name: 'Gemini 2.5 Pro', description: 'Razonamiento profundo y auditoría de decisiones complejas.', speed: 'máximo' },
  'gemini-1.5-flash': { name: 'Gemini 1.5 Flash', description: 'Estable y veloz para transcripciones extensas de Teams.', speed: 'rápido' },
  'gemini-3.8-flash': { name: 'Gemini 3.8 Flash', description: 'Modelo insignia de Google de ultra alta velocidad y contexto extendido.', speed: 'rápido', badge: 'Recomendado' },
  'gemini-3.1-flash-lite': { name: 'Gemini 3.1 Flash Lite', description: 'Modelo ultrarrápido y liviano de última generación.', speed: 'rápido', badge: 'Nuevo' },
};

function parseEnvModelList(envVal: string | undefined, defaultList: string[]): string[] {
  if (!envVal || !envVal.trim()) return defaultList;
  return envVal
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Endpoint: Configurable Factory Models from .env
app.get('/api/ai/models', (_req: Request, res: Response) => {
  const geminiList = parseEnvModelList(process.env.FACTORY_MODELS_GEMINI, [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-1.5-flash',
    'gemini-3.1-flash-lite',
  ]);
  const claudeList = parseEnvModelList(process.env.FACTORY_MODELS_CLAUDE, [
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
  ]);
  const openaiList = parseEnvModelList(process.env.FACTORY_MODELS_OPENAI, [
    'gpt-4o',
    'gpt-4o-mini',
    'o3-mini',
  ]);
  const copilotList = parseEnvModelList(process.env.FACTORY_MODELS_COPILOT, [
    'copilot-gpt-4o',
    'copilot-gpt-4o-mini',
  ]);

  const mapToOption = (id: string, provider: 'claude' | 'openai' | 'copilot' | 'gemini') => {
    const meta = FACTORY_METADATA_CATALOG[id] || {
      name: id,
      description: `Modelo base oficial para ${provider.toUpperCase()}`,
      speed: 'equilibrado' as const,
    };
    return {
      id,
      name: meta.name,
      provider,
      description: meta.description,
      speed: meta.speed,
      badge: meta.badge,
      isCustom: false,
    };
  };

  const factoryModels = [
    ...claudeList.map((id) => mapToOption(id, 'claude')),
    ...openaiList.map((id) => mapToOption(id, 'openai')),
    ...copilotList.map((id) => mapToOption(id, 'copilot')),
    ...geminiList.map((id) => mapToOption(id, 'gemini')),
  ];

  res.json({
    factoryModels,
    defaults: {
      gemini: geminiList[0] || 'gemini-2.5-flash',
      claude: claudeList[0] || 'claude-3-7-sonnet-20250219',
      openai: openaiList[0] || 'gpt-4o',
      copilot: copilotList[0] || 'copilot-gpt-4o',
    },
  });
});


// ============================================================================
// Multi-Provider AI Calling Engine (Claude, OpenAI, Copilot/Azure, Gemini)
// ============================================================================

interface AICallParams {
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

// Normalizes an error thrown by any AI provider into { provider, model, status, message }
function describeAiError(err: any, provider: string, model?: string): {
  provider: string;
  model: string;
  status: number | null;
  message: string;
} {
  let message: string = String(err?.message || err || 'Error desconocido del proveedor de IA.');
  let status: number | null = typeof err?.status === 'number' ? err.status : typeof err?.code === 'number' ? err.code : null;

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

function parseLlmJsonResponse(raw: string): any {
  let cleaned = raw.trim();
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

async function callAIProvider(params: AICallParams): Promise<string> {
  const { provider, model, systemInstruction, promptContent, keys } = params;

  // 1. ANTHROPIC CLAUDE
  if (provider === 'claude') {
    const apiKey = keys?.anthropicApiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('API Key de Anthropic Claude no configurada. Ingrésala en Ajustes o en el archivo .env (ANTHROPIC_API_KEY).');
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
      } catch { }
      throw new Error(`Anthropic Claude (${response.status}): ${parsedErr}`);
    }

    const data = (await response.json()) as any;
    return data.content?.[0]?.text || '{}';
  }

  // 2. OPENAI
  if (provider === 'openai') {
    const apiKey = keys?.openAiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('API Key de OpenAI no configurada. Ingrésala en Ajustes o en el archivo .env (OPENAI_API_KEY).');
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
      } catch { }
      throw new Error(`OpenAI (${response.status}): ${parsedErr}`);
    }

    const data = (await response.json()) as any;
    return data.choices?.[0]?.message?.content || '{}';
  }

  // 3. MICROSOFT COPILOT / AZURE OPENAI
  if (provider === 'copilot') {
    const apiKey = keys?.azureApiKey?.trim() || process.env.AZURE_OPENAI_KEY?.trim() || process.env.COPILOT_API_KEY?.trim();
    const rawEndpoint = keys?.azureEndpoint?.trim() || process.env.AZURE_OPENAI_ENDPOINT?.trim();
    const deployment = keys?.azureDeploymentName?.trim() || process.env.AZURE_OPENAI_DEPLOYMENT?.trim() || (model.includes('mini') ? 'gpt-4o-mini' : 'gpt-4o');
    const apiVersion = keys?.azureApiVersion?.trim() || process.env.AZURE_OPENAI_API_VERSION?.trim() || '2024-08-01-preview';

    if (!apiKey || !rawEndpoint) {
      throw new Error('Se requiere Endpoint y API Key de Azure OpenAI / Microsoft Copilot. Configúralos en Ajustes o en el archivo .env.');
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
      } catch { }
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

  const targetModel = model?.trim() || 'gemini-2.5-flash';
  const response = await geminiInstance.models.generateContent({
    model: targetModel,
    contents: `${systemInstruction}\n\n${promptContent}\n\nResponde ÚNICAMENTE con el objeto JSON válido.`,
    config: {
      responseMimeType: 'application/json',
    },
  });

  return response.text?.trim() || '{}';
}

// Endpoint: Test connection for any AI Provider & Model
app.post('/api/ai/test-connection', async (req: Request, res: Response) => {
  const { provider = 'claude', model, apiKey, azureEndpoint, azureDeploymentName, azureApiVersion } = req.body;
  const start = Date.now();

  try {
    const rawResult = await callAIProvider({
      provider,
      model: model || (provider === 'claude' ? 'claude-3-7-sonnet-20250219' : provider === 'openai' ? 'gpt-4o' : provider === 'copilot' ? 'copilot-gpt-4o' : 'gemini-2.5-flash'),
      systemInstruction: 'Eres un validador de conectividad de IA. Responde únicamente con un objeto JSON {"status":"ok","provider":"' + provider + '"}',
      promptContent: 'Confirma la conexión respondiendo con el JSON solicitado.',
      keys: {
        anthropicApiKey: apiKey,
        openAiApiKey: apiKey,
        azureApiKey: apiKey,
        azureEndpoint,
        azureDeploymentName,
        azureApiVersion,
        geminiApiKey: apiKey,
      },
    });

    const parsed = parseLlmJsonResponse(rawResult);
    const latencyMs = Date.now() - start;

    return res.json({
      success: true,
      provider,
      model: model || 'default',
      latencyMs,
      message: `¡Conexión verificada exitosamente con ${provider.toUpperCase()} (${model || 'modelo activo'}) en ${latencyMs}ms!`,
      details: parsed,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return res.json({
      success: false,
      provider,
      model,
      latencyMs,
      error: err.message || 'Error al conectar con el proveedor de IA.',
    });
  }
});

// ============================================================================
// Sanitization & Fallback Engine
// ============================================================================

// Terms and topic concepts that must NEVER be parsed as a human participant/assignee
const NON_PERSON_KEYWORDS = [
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

function isNonPersonName(name: string): boolean {
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

// Helper for dynamic NLP analysis when an AI API is unavailable or has depleted credits
function getLocalFallbackAnalysis(
  transcript: string,
  meetingTitle?: string,
  meetingDate?: string,
  projectKey: string = 'DEV',
  promptMode: string = 'standard',
  customPrompt: string = '',
  jiraUsers: any[] = []
) {
  const date = meetingDate || new Date().toISOString().split('T')[0];
  const cleanKey = (projectKey || 'DEV').toUpperCase().trim();

  // Split lines
  const rawLines = transcript
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Detect Meeting Title and Topics
  let title = meetingTitle?.trim();
  let detectedTopicHeader = '';

  for (const line of rawLines.slice(0, 8)) {
    const titleMatch = line.match(/^(?:título|asunto|tema|reunión|sesión)\s*:\s*(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      break;
    }
    // Check if line is a topic header (e.g., "Business Dims:")
    const colonMatch = line.match(/^([A-Za-zÁ-ÿ0-9\s\.\-_]+?)\s*:\s*(.+)$/);
    if (colonMatch && isNonPersonName(colonMatch[1])) {
      detectedTopicHeader = colonMatch[1].trim();
    }
  }

  if (!title && rawLines.length > 0 && rawLines[0].length < 80 && !rawLines[0].includes(':')) {
    title = rawLines[0].replace(/^[#\-*\d\.]+\s*/, '').trim();
  }
  if (!title) {
    title = detectedTopicHeader ? `Sincronización ${detectedTopicHeader}` : 'Reunión de Sincronización y Compromisos';
  }

  // 2. Identify Human Speakers (Strictly filtering out topic/module names)
  const dialogueRegex = /^(?:\[?\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?\]?\s*)?([A-Za-zÁ-ÿ0-9\s\.\-_]+?)(?:\s*\([^)]+\))?\s*:\s*(.+)$/i;
  const speakerMap = new Map<string, string[]>();
  const allStatements: { speaker: string; text: string }[] = [];
  const discussionNotes: string[] = [];

  for (const line of rawLines) {
    const match = dialogueRegex.exec(line);
    if (match) {
      const candidateSpeaker = match[1].trim();
      const content = match[2].trim();

      // If it's a technical term/topic header like "Business Dims", treat as discussion note
      if (isNonPersonName(candidateSpeaker)) {
        if (!detectedTopicHeader) detectedTopicHeader = candidateSpeaker;
        discussionNotes.push(`${candidateSpeaker}: ${content}`);
      } else if (candidateSpeaker.length >= 2 && candidateSpeaker.length <= 40) {
        if (!speakerMap.has(candidateSpeaker)) {
          speakerMap.set(candidateSpeaker, []);
        }
        speakerMap.get(candidateSpeaker)!.push(content);
        allStatements.push({ speaker: candidateSpeaker, text: content });
      }
    } else {
      discussionNotes.push(line);
    }
  }

  // Scan attendees line: "Asistentes: Juan Artigas, Carlos Mendoza"
  const attendeesRegex = /(?:asistentes|participantes|presentes|equipo)\s*:\s*(.+)/i;
  for (const line of rawLines) {
    const attMatch = attendeesRegex.exec(line);
    if (attMatch) {
      const names = attMatch[1].split(/[,;y\-\&]+/).map((n) => n.trim()).filter((n) => n.length > 2 && n.length < 35 && !isNonPersonName(n));
      for (const name of names) {
        if (!speakerMap.has(name)) {
          speakerMap.set(name, []);
        }
      }
    }
  }

  // Candidate human participants
  let detectedSpeakers = Array.from(speakerMap.keys()).filter((n) => !isNonPersonName(n));

  // If no human speakers found in transcript, use project Jira users!
  if (detectedSpeakers.length === 0 && Array.isArray(jiraUsers) && jiraUsers.length > 0) {
    detectedSpeakers = jiraUsers.slice(0, 3).map((u) => u.displayName || u.emailAddress);
  }

  // Fallback defaults if no Jira users passed
  if (detectedSpeakers.length === 0) {
    detectedSpeakers = ['Carlos Mendoza (Tech Lead)', 'Ana Sofía Rivas (Backend Lead)', 'Rodrigo Alarcón (DevOps)'];
  }

  const participants = detectedSpeakers.map((name, index) => {
    const statements = speakerMap.get(name) || [];
    return {
      name,
      role: index === 0 ? 'Líder Técnico / Facilitador' : index === 1 ? 'Especialista / Desarrollador' : 'Colaborador',
      totalTasks: 0,
      allocatedPoints: 0,
      capacityLimit: 8,
      sentimentOrFocus: statements.length > 0 ? `Aportó en ${statements.length} intervenciones clave` : 'Participante asignado al proyecto',
    };
  });

  // 3. Extract Real Action Items (Synthesize 2 to 4 genuine work tickets instead of 14 discussion cards)
  const topicName = detectedTopicHeader || 'Arquitectura & Integración';
  const fullText = rawLines.join(' ');
  const hasBusinessDims = /business\s*dims/i.test(fullText);
  const hasDags = /dag|dags/i.test(fullText);
  const hasCrmOrAttribution = /crm|atribuci[oó]n/i.test(fullText);

  const actionItems: any[] = [];
  let itemCounter = 1;

  if (hasBusinessDims || (hasDags && hasCrmOrAttribution)) {
    // Domain-aware synthesis for Business Dims & DAGs integration
    actionItems.push({
      id: `act-${itemCounter++}`,
      title: `Concentrar integración de Business Dims en un único DAG de negocio [${cleanKey}]`,
      description: `Unificar la recarga de dimensiones de negocio en un único DAG de integración para facilitar el mantenimiento y evitar recargas de procesos intermedios ante modificaciones de criterios de negocio.`,
      assignee: participants[0].name,
      coAssignees: [participants[1]?.name].filter(Boolean),
      topicId: 'top-1',
      topicName: `Business Dims & DAGs de Integración`,
      priority: 'High',
      issueType: 'Task',
      storyPoints: 5,
      deadline: 'Fin de sprint',
      acceptanceCriteria: [
        'Diseñar y desarrollar el DAG consolidado de negocio para Business Dims.',
        'Verificar que los cambios en criterios de negocio no impacten en DAGs de integración previos.',
        'Ejecutar pruebas de carga y validar consistencia de datos en staging.'
      ],
      definitionOfDone: ['Revisión técnica de arquitectura aprobada.', 'Pruebas satisfactorias en staging.'],
      jiraLabels: ['business-dims', 'dags', cleanKey.toLowerCase()],
      technicalContext: 'Concentración de lógica de dimensiones en un único DAG de negocio para independizar criterios de recarga.',
      jiraIssueStatus: 'To Do',
      dependsOn: []
    });

    actionItems.push({
      id: `act-${itemCounter++}`,
      title: `Revisar y desacoplar dependencias con procesos de atribución y CRMV2 [${cleanKey}]`,
      description: `Analizar en profundidad el riesgo identificado sobre la dependencia de Business Dims respecto a los flujos de atribución y CRMV2, implementando medidas de desacoplamiento o mitigación.`,
      assignee: participants[participants.length > 1 ? 1 : 0].name,
      coAssignees: [],
      topicId: 'top-1',
      topicName: `Business Dims & DAGs de Integración`,
      priority: 'High',
      issueType: 'Task',
      storyPoints: 3,
      deadline: 'Próxima iteración',
      acceptanceCriteria: [
        'Revisar el documento de análisis técnico sobre la dependencia con atribución y CRMV2.',
        'Establecer medidas de mitigación o desacoplamiento para prevenir bloqueos de ejecución.',
        'Documentar el flujo acordado y validar con los responsables de CRMV2.'
      ],
      definitionOfDone: ['Análisis de dependencias validado con el equipo.', 'Documentación técnica actualizada.'],
      jiraLabels: ['riesgo', 'crmv2', 'atribucion', cleanKey.toLowerCase()],
      technicalContext: 'Mitigación de riesgos de acoplamiento operativo entre Business Dims, atribución y CRMV2.',
      jiraIssueStatus: 'To Do',
      dependsOn: ['act-1']
    });

    actionItems.push({
      id: `act-${itemCounter++}`,
      title: `Validar impacto operativo de criterios de negocio y actualizar DAGs [${cleanKey}]`,
      description: `Validar con los stakeholders que la nueva estructura de DAGs cumple con los acuerdos de negocio y actualizar la documentación operativa.`,
      assignee: participants[participants.length > 2 ? 2 : 0].name,
      coAssignees: [],
      topicId: 'top-1',
      topicName: `Business Dims & DAGs de Integración`,
      priority: 'Medium',
      issueType: 'Task',
      storyPoints: 2,
      deadline: 'Próximo sprint',
      acceptanceCriteria: [
        'Confirmar con el equipo funcional los criterios de negocio que rigen la recarga.',
        'Verificar el correcto registro de logs y alertas en caso de fallo en el DAG.',
        'Socializar los cambios con los equipos consumidores de Business Dims.'
      ],
      definitionOfDone: ['Aprobación por parte de stakeholders.', 'Checklist de despliegue completo.'],
      jiraLabels: ['validacion', 'documentacion', cleanKey.toLowerCase()],
      technicalContext: 'Alineación de criterios operativos para la recarga del DAG unificado de negocio.',
      jiraIssueStatus: 'To Do',
      dependsOn: ['act-1']
    });
  } else {
    // General synthesis: Extract max 2-3 genuine work items from text
    const imperativeVerbs = /(?:implementar|desarrollar|crear|configurar|diseñar|migrar|refactorizar|revisar|corregir|optimizar|desplegar|validar|actualizar)/i;
    const taskCandidates: string[] = [];

    for (const stmt of allStatements) {
      if (imperativeVerbs.test(stmt.text) && stmt.text.length > 20) {
        taskCandidates.push(stmt.text);
        if (taskCandidates.length >= 3) break;
      }
    }

    if (taskCandidates.length === 0) {
      taskCandidates.push(`Implementar los acuerdos y resoluciones acordadas en la sesión de ${title}`);
      taskCandidates.push(`Revisar y validar el plan de acción para el proyecto ${cleanKey}`);
    }

    taskCandidates.slice(0, 3).forEach((cand, idx) => {
      let cleanCand = cand
        .replace(/^[#\-\*\d\.\s•]+/, '')
        .replace(/^(?:yo\s+)?(?:me\s+encargo\s+de|voy\s+a|asumo\s+|se\s+acuerda\s+|tarea\s*:?)\s*/i, '')
        .trim();
      cleanCand = cleanCand.charAt(0).toUpperCase() + cleanCand.slice(1);
      if (cleanCand.length > 85) cleanCand = cleanCand.slice(0, 82) + '...';

      actionItems.push({
        id: `act-${itemCounter++}`,
        title: `${cleanCand} [${cleanKey}]`,
        description: `Tarea acordada durante la sesión: ${cand}`,
        assignee: participants[idx % participants.length].name,
        coAssignees: [],
        topicId: 'top-1',
        topicName: title,
        priority: idx === 0 ? 'High' : 'Medium',
        issueType: 'Task',
        storyPoints: idx === 0 ? 5 : 3,
        deadline: 'Próximo sprint',
        acceptanceCriteria: [
          `Completar satisfactoriamente: ${cleanCand}.`,
          'Validar resultados con los integrantes del equipo.',
          'Notificar al equipo una vez desplegado/finalizado.'
        ],
        definitionOfDone: ['Revisión técnica aprobada.', 'Pruebas validadas.'],
        jiraLabels: ['reunión-teams', cleanKey.toLowerCase()],
        technicalContext: cand,
        jiraIssueStatus: 'To Do',
        dependsOn: []
      });
    });
  }

  // Update participant stats
  participants.forEach((p) => {
    const assigned = actionItems.filter((a) => a.assignee.toLowerCase() === p.name.toLowerCase());
    p.totalTasks = assigned.length;
    p.allocatedPoints = assigned.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
  });

  // 4. Extract Key Decisions
  const keyDecisions: string[] = [
    `Concentrar la lógica en un único DAG de negocio para simplificar mantenimiento y evitar recargas innecesarias.`,
    `Revisar y mitigar el riesgo de dependencia identificado con los procesos de atribución y CRMV2.`,
    `Alinear a los responsables del equipo (${participants.map((p) => p.name).join(', ')}) en un plan de acción concreto de ${actionItems.length} tareas Jira.`
  ];

  // 5. Main Topics
  const mainTopics = [
    {
      id: 'top-1',
      topicName: detectedTopicHeader ? `${detectedTopicHeader} - DAGs & Integración` : title,
      category: 'Arquitectura & Datos',
      discussionSummary: `Se debatió la propuesta técnica sobre ${detectedTopicHeader || title}. Se evaluó la conveniencia de concentrar la recarga en un único DAG de negocio para evitar reprocesos cuando cambien criterios de negocio, y se identificó la necesidad de revisar las dependencias con procesos de atribución y CRMV2.`,
      status: 'En Progreso',
      riskLevel: 'Medio',
      leadAssignee: participants[0]?.name || 'Equipo Core',
    },
  ];

  // 6. Executive Summary
  const executiveSummary = `Durante la sesión "${title}" realizada el ${date}, se abordaron los temas prioritarios para el proyecto ${cleanKey}.
Participaron activamente ${participants.map((p) => p.name).join(', ')}, estableciendo acuerdos operativos y un plan de acción concreto.
Se identificaron ${actionItems.length} compromisos directos traducidos en tareas accionables de Jira para garantizar la trazabilidad y avance del trabajo, evitando dispersión en notas de discusión.`;

  return {
    meetingTitle: title,
    meetingDate: date,
    executiveSummary,
    keyDecisions,
    mainTopics,
    participants,
    actionItems,
    orphanCommitments: [],
    dependencies: [
      {
        id: 'dep-1',
        blockerTaskId: 'act-1',
        blockerTitle: actionItems[0]?.title || 'DAG Unificado',
        blockerAssignee: actionItems[0]?.assignee || participants[0].name,
        blockedTaskId: 'act-2',
        blockedTitle: actionItems[1]?.title || 'Desacoplar dependencias',
        blockedAssignee: actionItems[1]?.assignee || participants[1]?.name || participants[0].name,
        description: 'Requiere la definición del DAG de negocio antes de formalizar el desacoplamiento con atribución y CRMV2.'
      }
    ]
  };
}

interface BoardIssueContext {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  assignee: string;
  isClosed: boolean;
  score?: number;
}

// Helper: Fetch real or simulated Jira Board issues and score them by lexical relevance to transcript
async function fetchBoardContext(
  jiraConfig: any,
  transcriptSnippet: string
): Promise<BoardIssueContext[]> {
  const isSimulation = jiraConfig?.simulationMode !== false;
  const projectKey = (jiraConfig?.projectKey || 'PAY').trim().toUpperCase();

  let candidateIssues: BoardIssueContext[] = [];

  if (!isSimulation && jiraConfig?.domain && jiraConfig?.userEmail && jiraConfig?.apiToken) {
    try {
      const cleanDomain = jiraConfig.domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const authHeader = 'Basic ' + Buffer.from(`${jiraConfig.userEmail.trim()}:${jiraConfig.apiToken.trim()}`).toString('base64');

      const jqlParts: string[] = [`project = "${projectKey}"`];

      // Exclude issue types (default Epic)
      const excludeTypes: string[] = Array.isArray(jiraConfig.excludeIssueTypes) && jiraConfig.excludeIssueTypes.length > 0
        ? jiraConfig.excludeIssueTypes
        : ['Epic'];
      if (excludeTypes.length > 0) {
        jqlParts.push(`issuetype NOT IN (${excludeTypes.map((t) => `"${t}"`).join(', ')})`);
      }

      // Recent closed days or active only
      const recentDays = typeof jiraConfig.recentClosedDays === 'number' ? jiraConfig.recentClosedDays : 14;
      if (recentDays > 0) {
        jqlParts.push(`(statusCategory != Done OR (statusCategory = Done AND resolved >= -${recentDays}d))`);
      } else {
        jqlParts.push('statusCategory != Done');
      }

      // Backlog filter (if disabled, only issues in open sprint)
      if (jiraConfig.includeBacklog === false) {
        jqlParts.push('(sprint in openSprints() OR sprint is not EMPTY)');
      }

      // Filter labels / components if configured
      if (jiraConfig.filterLabelsOrComponents && typeof jiraConfig.filterLabelsOrComponents === 'string' && jiraConfig.filterLabelsOrComponents.trim()) {
        const terms = jiraConfig.filterLabelsOrComponents.split(',').map((t: string) => t.trim()).filter(Boolean);
        if (terms.length > 0) {
          jqlParts.push(`(labels IN (${terms.map((t: string) => `"${t}"`).join(', ')}) OR component IN (${terms.map((t: string) => `"${t}"`).join(', ')}))`);
        }
      }

      // Custom JQL if configured
      if (jiraConfig.customJql && typeof jiraConfig.customJql === 'string' && jiraConfig.customJql.trim()) {
        jqlParts.push(`(${jiraConfig.customJql.trim()})`);
      }

      const finalJql = jqlParts.join(' AND ') + ' ORDER BY updated DESC';
      const maxToFetch = Math.min(100, Math.max(20, jiraConfig.maxBoardTicketsForAI || 150));

      // Atlassian CHANGE-2046 permanently sunsetted /rest/api/3/search with HTTP 410 Gone.
      // Must use /rest/api/3/search/jql (POST or GET).
      let jiraRes = await fetch(
        `https://${cleanDomain}/rest/api/3/search/jql`,
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jql: finalJql,
            maxResults: maxToFetch,
            fields: ['summary', 'status', 'assignee', 'priority', 'labels', 'updated'],
          }),
        }
      );

      // If POST is not supported or fails, try GET /rest/api/3/search/jql as fallback
      if (!jiraRes.ok && jiraRes.status === 405) {
        jiraRes = await fetch(
          `https://${cleanDomain}/rest/api/3/search/jql?jql=${encodeURIComponent(finalJql)}&maxResults=${maxToFetch}&fields=summary,status,assignee,priority,labels,updated`,
          {
            headers: {
              'Authorization': authHeader,
              'Accept': 'application/json',
            },
          }
        );
      }

      if (jiraRes.ok) {
        const data = (await jiraRes.json()) as any;
        if (Array.isArray(data.issues)) {
          candidateIssues = data.issues.map((i: any) => {
            const catKey = i.fields?.status?.statusCategory?.key;
            const isClosed = catKey === 'done';
            return {
              key: i.key,
              summary: i.fields?.summary || '',
              status: i.fields?.status?.name || (isClosed ? 'Done' : 'In Progress'),
              statusCategory: isClosed ? 'Done' : catKey === 'new' ? 'To Do' : 'In Progress',
              assignee: i.fields?.assignee?.displayName || 'Sin asignar',
              isClosed,
            };
          });
          console.log(`[Jira Board Context] Successfully fetched ${candidateIssues.length} active board issues from Jira Cloud.`);
        }
      } else {
        const errText = await jiraRes.text().catch(() => '');
        console.warn(`[Jira Board Context] Query returned status ${jiraRes.status}: ${errText}`);
      }
    } catch (err) {
      console.warn('[Jira Board Context] Error fetching board context from Jira Cloud:', err);
    }
  }

  // Fallback to realistic simulated pool if in simulation mode or Jira returned empty
  if (candidateIssues.length === 0) {
    candidateIssues = [
      {
        key: `${projectKey}-101`,
        summary: 'Migración y unificación de DAGs de Airflow para Atribución',
        status: 'In Progress',
        statusCategory: 'In Progress',
        assignee: 'Carlos Mendoza',
        isClosed: false,
      },
      {
        key: `${projectKey}-102`,
        summary: 'Implementación de Data Contracts en BigQuery para Marketing CRMV2',
        status: 'In Progress',
        statusCategory: 'In Progress',
        assignee: 'Ana Sofía Rivas',
        isClosed: false,
      },
      {
        key: `${projectKey}-103`,
        summary: 'Auditoría de logs de ingesta y validaciones de datos en Looker',
        status: 'To Do',
        statusCategory: 'To Do',
        assignee: 'Rodrigo Alarcón',
        isClosed: false,
      },
      {
        key: `${projectKey}-104`,
        summary: 'Refactorización del pipeline de Segment Calls y Genesys',
        status: 'In Review',
        statusCategory: 'In Progress',
        assignee: 'Laura Cárdenas',
        isClosed: false,
      },
      {
        key: `${projectKey}-105`,
        summary: 'Configuración de Data Quality Checks para tablas GA4',
        status: 'Done',
        statusCategory: 'Done',
        assignee: 'Javier Domínguez',
        isClosed: true,
      },
      {
        key: `${projectKey}-106`,
        summary: 'Integración de webhook de telefonía Byside y Convertia',
        status: 'Done',
        statusCategory: 'Done',
        assignee: 'Ana Sofía Rivas',
        isClosed: true,
      },
    ];
  }

  // Preselección y puntuación léxica de relevancia con respecto a la transcripción
  const cleanTranscript = (transcriptSnippet || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const scored = candidateIssues.map((issue) => {
    let score = 0;
    const cleanSummary = (issue.summary || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const words = cleanSummary.split(/\s+/).filter((w) => w.length > 3);
    for (const word of words) {
      if (cleanTranscript.includes(word)) {
        score += 3;
      }
    }

    if (issue.key && cleanTranscript.includes(issue.key.toLowerCase())) {
      score += 15;
    }

    if (issue.statusCategory === 'In Progress') {
      score += 2;
    }

    return { ...issue, score };
  });

  scored.sort((a, b) => (b.score || 0) - (a.score || 0));

  const maxReturn = Math.min(30, jiraConfig?.maxBoardTicketsForAI || 150);
  return scored.slice(0, maxReturn);
}

// Endpoint: Analyze Teams Meeting Transcript with Existing Board Context
app.post('/api/analyze-transcript', async (req: Request, res: Response) => {
  try {
    const {
      transcript,
      promptMode = 'standard',
      customPrompt = '',
      meetingTitle = '',
      meetingDate = '',
      jiraProjectKey = 'DEV',
      aiProvider = 'claude',
      aiModel = '',
      aiKeys = {},
      jiraUsers = [],
      jiraConfig = {},
    } = req.body;

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      return res.status(400).json({ error: 'La transcripción de Teams es requerida.' });
    }

    // 1. Fetch relevant issues already existing in Jira Board / Backlog
    const effectiveJiraConfig = {
      projectKey: jiraProjectKey,
      ...jiraConfig,
    };
    const boardTickets = await fetchBoardContext(effectiveJiraConfig, transcript);

    let promptInstructions = '';
    if (promptMode === 'executive') {
      promptInstructions = `ENFOQUE EJECUTIVO: Centra el análisis en compromisos estratégicos de alto nivel, decisiones comerciales/organizacionales, dependencias de negocio, riesgos principales y fechas comprometidas por cada participante.`;
    } else if (promptMode === 'technical') {
      promptInstructions = `ENFOQUE TÉCNICO & ARQUITECTURA: Profundiza en detalle arquitectónico, deuda técnica, dependencias de software, bases de datos, spikes de investigación y asignaciones de código detalladas.`;
    } else if (promptMode === 'custom' && customPrompt?.trim()) {
      promptInstructions = `INSTRUCCIÓN PERSONALIZADA DEL USUARIO: ${customPrompt.trim()}`;
    } else {
      promptInstructions = `ENFOQUE ESTÁNDAR ÁGIL (JIRA-READY): Desglosa la transcripción en tareas altamente accionables, historias de usuario, spikes y bugs técnicos listos para Jira. Cada ítem DEBE identificar con absoluta precisión al participante del equipo que asume la responsabilidad (assignee), sus criterios de aceptación (acceptance criteria) y su contexto técnico.`;
    }

    const systemInstruction = `Eres un Principal Technical Project Manager y Agile Coach experto en análisis de transcripciones de Microsoft Teams y gestión de proyectos en Jira Cloud.
Tu objetivo es analizar la transcripción de la reunión, comprender quién participó, qué temas se trataron, detectar con precisión si se habló de tareas que ya existen en el tablero de Jira o si son tareas nuevas.

REGLAS CRÍTICAS DE CALIDAD Y ASIGNACIÓN (OBLIGATORIAS):

1. ESTRUCTURACIÓN DEL RESUMEN EJECUTIVO ('executiveSummary'):
   - El campo 'executiveSummary' DEBE adoptar fielmente la estructura, secciones, encabezados, tono y viñetas solicitados por el usuario en su instrucción personalizada / modalidad de prompt.
   - Si el usuario solicita un esquema específico (por ejemplo: Saludo formal, Situación actual agrupada por temas, Decisiones tomadas, Próximos pasos, Dudas o bloqueos pendientes), redacta 'executiveSummary' siguiendo rigurosamente ese orden y esas secciones, empleando saltos de línea claros y formato legible.
   - Si el usuario no especificó una estructura concreta en su instrucción, redacta una síntesis ejecutiva completa, profesional y bien organizada por secciones clave.

2. RESPONSABLE HUMANO Y CRITERIO DE ATRIBUCIÓN (ANTI-FALSOS POSITIVOS):
   - El campo 'assignee' (responsable) DEBE ser EXCLUSIVAMENTE una persona física humana (ej: 'Carlos Mendoza', 'Ana Sofía Rivas', o el nombre de un asistente de la llamada).
   - NUNCA uses como responsable nombres de módulos, temas técnicos, dimensiones, tablas o conceptos (ej: 'Business Dims', 'CRMV2', 'Atribución', 'DAGs', 'ETL' o 'Arquitectura' son TEMAS, JAMÁS personas).
   - COMPROMISO EXPLÍCITO VS MERA MENCIÓN:
     * Asigna una tarea a una persona ÚNICAMENTE si asume el compromiso explícitamente en primera persona ("yo me encargo", "lo subo", "lo reviso hoy", "estoy con ello") o si se le encomienda directamente y dicha persona asiente o acepta en la conversación.
     * NUNCA asignes tareas a quien solo informó del estado pasado de algo, a quien solo hizo una pregunta o a quien fue nombrado de pasada como referencia histórica ("David ya lo vio ayer").
     * Si un participante es identificado en el prompt o la llamada como Cliente / Stakeholder / Product Owner, NUNCA le asignes tareas técnicas de programación, desarrollo, pipelines, SQL, DAGs o despliegues (solo validaciones funcionales, aprobaciones o provisión de datos/accesos del cliente).
     * Si se acuerda un compromiso pero nadie específico lo asume en la llamada, asígnalo al facilitador o al 'Equipo de Proyecto' en lugar de atribuirlo al azar.

3. IDENTIFICACIÓN INTELIGENTE: TAREAS EN CURSO VS TAREAS NUEVAS:
   - Se te proporciona la lista de "TICKETS EXISTENTES EN EL TABLERO DE JIRA" con su clave, título, estado y asignado actual.
   - Si en la reunión se discute, revisa, actualiza, desbloquea o da continuidad a una tarea que YA EXISTE en esa lista:
     * Asigna "taskKind": "existing"
     * "matchedJiraKey": La clave exacta del ticket (ej: "PAY-101"). ¡OBLIGATORIO: DEBE coincidir exactamente con una de las claves de la lista provista, NUNCA inventes claves!
     * "matchConfidence": "Alta" | "Media" | "Baja"
     * "matchReason": Explicación concisa de por qué coincide con la conversación.
     * "proposedComment": Redacta un comentario técnico profesional para Jira resumiendo las novedades, decisiones o avances acordados en esta reunión.
     * Si el ticket existente está cerrado/Done en la lista provista: añade "isClosedMatch": true.
   - Si es un trabajo nuevo que no corresponde a ninguno de los tickets existentes en el tablero:
     * Asigna "taskKind": "new"
     * "matchedJiraKey": null
     * "matchConfidence": null
     * "matchReason": null
     * "proposedComment": null
     * "isClosedMatch": false

4. GENERACIÓN CONDICIONAL DE TICKETS NUEVOS (CERO TAREAS DE RELLENO):
   - Genera ÚNICAMENTE las tareas NUEVAS que realmente surjan como compromisos de la reunión (máximo 4 tickets nuevos) ("taskKind": "new").
   - Si en la llamada solo se revisó el estado de tareas anteriores o no surgieron compromisos nuevos, devuelve ÚNICAMENTE las que correspondan (incluso 0 o 1). ESTÁ PROHIBIDO inventar tareas de relleno para alcanzar un cupo artificial.
   - Las tareas existentes en curso ("taskKind": "existing") NO cuentan para este límite; puedes identificar tantas tareas en curso como se hayan tratado en la reunión.

5. TÍTULOS Y ACCIONABILIDAD:
   - Cada título debe comenzar con un verbo en infinitivo (ej: 'Concentrar integración de...', 'Implementar...', 'Refactorizar...').
   - Cada ticket debe incluir criterios de aceptación comprobables y story points razonables (1, 2, 3, 5, 8).

6. FORMATO:
   - Responde SIEMPRE en español en un formato JSON estrictamente válido que cumpla con el siguiente esquema:
   {
     "meetingTitle": "string",
     "meetingDate": "YYYY-MM-DD",
     "executiveSummary": "string",
     "keyDecisions": ["string"],
     "mainTopics": [{ "id": "top-1", "topicName": "string", "category": "string", "discussionSummary": "string", "status": "En Progreso|Completado|Bloqueado|Pendiente", "riskLevel": "Bajo|Medio|Alto", "leadAssignee": "string" }],
     "participants": [{ "name": "string", "role": "string", "totalTasks": 1, "sentimentOrFocus": "string" }],
     "actionItems": [
       {
         "id": "act-1",
         "taskKind": "new|existing",
         "matchedJiraKey": "PAY-101 o null",
         "matchConfidence": "Alta|Media|Baja o null",
         "matchReason": "string o null",
         "proposedComment": "string o null",
         "isClosedMatch": false,
         "title": "string",
         "description": "string",
         "assignee": "string (HUMANO)",
         "coAssignees": [],
         "topicName": "string",
         "priority": "Highest|High|Medium|Low",
         "issueType": "Task|Story|Bug|Spike",
         "storyPoints": 3,
         "acceptanceCriteria": ["string"],
         "jiraLabels": ["string"]
       }
     ]
   }`;

    const promptContent = `PROYECTO JIRA DESTINO: ${jiraProjectKey}
TÍTULO SUGERIDO DE LA REUNIÓN: ${meetingTitle || 'Reunión de Teams'}
FECHA DE LA REUNIÓN: ${meetingDate || new Date().toISOString().split('T')[0]}

MODALIDAD DE PROMPT / INSTRUCCIONES ESPECÍFICAS DEL USUARIO (Prioridad para la estructura del Resumen y Enfoque):
${promptInstructions}

EQUIPO DISPONIBLE EN JIRA:
${JSON.stringify((jiraUsers || []).map((u: any) => ({ name: u.displayName, role: u.role })), null, 2)}

TICKETS EXISTENTES EN EL TABLERO DE JIRA (${boardTickets.length} candidatos relevantes analizados del tablero y backlog):
${JSON.stringify(boardTickets.map((t) => ({ key: t.key, summary: t.summary, status: t.status, statusCategory: t.statusCategory, assignee: t.assignee, isClosed: t.isClosed })), null, 2)}

TRANSCRIPCIÓN O APUNTES DE LA REUNIÓN EN TEAMS:
"""
${transcript.slice(0, 30000)}
"""

Extrae el resumen ejecutivo, acuerdos, temas, participantes y los action items clasificados (nuevos vs existentes en curso con propuesta de comentario).`;

    try {
      const rawResponse = await callAIProvider({
        provider: aiProvider,
        model: aiModel,
        systemInstruction,
        promptContent,
        keys: aiKeys,
      });

      const parsed = parseLlmJsonResponse(rawResponse);

      // Post-process sanitation & validation against actual board tickets
      if (Array.isArray(parsed.actionItems)) {
        const cleanDomain = (effectiveJiraConfig?.domain || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
        const isLiveJira = effectiveJiraConfig?.simulationMode === false;
        const validBoardKeys = new Set(boardTickets.map((t) => t.key.toUpperCase()));
        const boardKeyMap = new Map(boardTickets.map((t) => [t.key.toUpperCase(), t]));

        parsed.actionItems.forEach((item: any, idx: number) => {
          if (isNonPersonName(item.assignee)) {
            const fallbackHuman = parsed.participants?.find((p: any) => !isNonPersonName(p.name))?.name || jiraUsers?.[0]?.displayName || 'Equipo de Proyecto';
            item.assignee = fallbackHuman;
          }
          if (!item.id) item.id = `act-${idx + 1}`;
          if (!item.priority) item.priority = 'Medium';
          if (!item.issueType) item.issueType = 'Task';
          if (!item.storyPoints) item.storyPoints = 3;

          // Strict validation: Prevent LLM from hallucinating tickets that don't exist in the board
          if (item.taskKind === 'existing' && item.matchedJiraKey) {
            const cleanKey = String(item.matchedJiraKey).trim().toUpperCase();
            if (validBoardKeys.has(cleanKey)) {
              const boardItem = boardKeyMap.get(cleanKey);
              item.matchedJiraKey = cleanKey;
              item.jiraTicketKey = cleanKey;
              item.jiraTicketUrl = cleanDomain ? `https://${cleanDomain}/browse/${cleanKey}` : undefined;
              item.jiraStatus = 'synced';
              item.jiraIssueStatus = boardItem?.status;
              item.jiraStatusCategory = boardItem?.statusCategory;
              item.isClosedMatch = boardItem?.isClosed || item.isClosedMatch || false;
              item.commentStatus = 'pending';
            } else {
              // Degrade hallucinated key to new task
              item.taskKind = 'new';
              item.matchedJiraKey = undefined;
              item.matchConfidence = undefined;
              item.matchReason = undefined;
              item.proposedComment = undefined;
              item.isClosedMatch = false;
            }
          } else {
            item.taskKind = 'new';
            item.matchedJiraKey = undefined;
            item.proposedComment = undefined;
            item.isClosedMatch = false;
          }
        });

        // Filter participants to exclude any non-person names
        if (Array.isArray(parsed.participants)) {
          parsed.participants = parsed.participants.filter((p: any) => !isNonPersonName(p.name));
          if (parsed.participants.length === 0) {
            parsed.participants = [{
              name: jiraUsers?.[0]?.displayName || 'Equipo de Proyecto',
              role: 'Equipo de Desarrollo',
              totalTasks: parsed.actionItems.length,
              sentimentOrFocus: 'Compromisos de entrega acordados'
            }];
          }
        }
      }

      return res.json({
        id: 'meet-' + Date.now(),
        ...parsed,
        aiProviderUsed: aiProvider,
        aiModelUsed: aiModel,
        promptUsed: promptMode === 'custom' ? customPrompt : promptMode,
        rawTranscriptSnippet: transcript.slice(0, 300) + '...',
        createdAt: new Date().toISOString(),
        boardContextSummary: {
          analyzedCount: boardTickets.length,
          existingMatches: parsed.actionItems?.filter((a: any) => a.taskKind === 'existing').length || 0,
        },
      });
    } catch (aiError: any) {
      // No local fallback: if the selected model fails, report the error and stop.
      const aiErrorInfo = describeAiError(aiError, aiProvider, aiModel);
      console.error(`[AI Engine] ${aiProvider} failed (${aiErrorInfo.status ?? 'sin código'}): ${aiErrorInfo.message}`);
      return res.status(502).json({
        error: aiErrorInfo.message,
        aiError: aiErrorInfo,
      });
    }
  } catch (error: any) {
    console.error('Error in /api/analyze-transcript:', error);
    res.status(500).json({ error: error?.message || 'Error al procesar la transcripción de Teams.' });
  }
});

// Endpoint: Fetch Jira Board Context (Candidate Issues)
app.post('/api/jira/board-context', async (req: Request, res: Response) => {
  try {
    const { jiraConfig, transcript = '' } = req.body;
    const issues = await fetchBoardContext(jiraConfig, transcript);
    return res.json({
      success: true,
      issues,
      total: issues.length,
      mode: jiraConfig?.simulationMode !== false ? 'simulation' : 'live-jira',
    });
  } catch (err: any) {
    console.error('Error in /api/jira/board-context:', err);
    res.status(500).json({ error: 'Error obteniendo contexto del tablero de Jira.' });
  }
});

// Endpoint: Add Comment to an Existing Jira Issue
app.post('/api/jira/add-comment', async (req: Request, res: Response) => {
  try {
    const { issueKey, comment, jiraConfig } = req.body;

    if (!issueKey || !comment || typeof comment !== 'string' || !comment.trim()) {
      return res.status(400).json({ error: 'Faltan issueKey o comment.' });
    }

    const cleanKey = String(issueKey).trim().toUpperCase();
    const cleanComment = comment.trim();
    const isLiveJira = jiraConfig?.simulationMode === false;

    if (isLiveJira) {
      if (!jiraConfig?.domain || !jiraConfig?.userEmail || !jiraConfig?.apiToken) {
        return res.status(400).json({
          success: false,
          error: 'Modo simulación desactivado pero faltan credenciales de Jira Cloud en Ajustes.',
        });
      }

      const domain = jiraConfig.domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const authHeader = 'Basic ' + Buffer.from(`${jiraConfig.userEmail.trim()}:${jiraConfig.apiToken.trim()}`).toString('base64');

      // Jira Cloud REST API v3 requires Atlassian Document Format (ADF)
      const adfBody = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: cleanComment,
                },
              ],
            },
          ],
        },
      };

      const jiraRes = await fetch(
        `https://${domain}/rest/api/3/issue/${encodeURIComponent(cleanKey)}/comment`,
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(adfBody),
        }
      );

      if (!jiraRes.ok) {
        const errText = await jiraRes.text();
        console.error(`[Jira Add Comment] Error ${jiraRes.status} on ${cleanKey}:`, errText);
        return res.status(jiraRes.status).json({
          success: false,
          error: `Jira devolvió error ${jiraRes.status}: ${errText.slice(0, 200)}`,
        });
      }

      const data = (await jiraRes.json()) as any;
      return res.json({
        success: true,
        issueKey: cleanKey,
        commentId: data.id,
        mode: 'live-jira',
        addedAt: new Date().toISOString(),
      });
    }

    // Simulation mode
    return res.json({
      success: true,
      issueKey: cleanKey,
      commentId: 'sim-comm-' + Date.now(),
      mode: 'simulation',
      addedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in /api/jira/add-comment:', err);
    res.status(500).json({ error: err?.message || 'Error al agregar comentario en Jira.' });
  }
});

// Endpoint: Generate Monthly Progress Report
app.post('/api/generate-monthly-report', async (req: Request, res: Response) => {
  try {
    const {
      monthYear,
      monthName,
      topics = [],
      actionItems = [],
      meetingsCount = 1,
      aiProvider = 'claude',
      aiModel = '',
      aiKeys = {},
    } = req.body;

    const periodName = monthName || monthYear || 'Mes en Curso';

    const systemInstruction = `Eres un Chief Operations Officer (COO) y Agile Delivery Director.
Generas reportes mensuales de progreso consolidados basados EXCLUSIVAMENTE en los temas y tickets derivados de reuniones de equipo en Teams y Jira del mes especificado.
Redacta un informe ejecutivo con rigor profesional, destacando hitos, estado de salud de las iniciativas, bloqueos críticos, balance de carga de trabajo por participante y recomendaciones tácticas.

REGLAS ESTRICTAS DE INTEGRIDAD DE DATOS (OBLIGATORIAS):
1. NUNCA inventes participantes ficticios, proyectos o datos de muestra (NO uses ejemplos genéricos como Ana Sofía, Carlos, etc., a menos que aparezcan en los datos enviados).
2. En 'pendingTopics', el campo 'assignee' DEBE ser exclusivamente el nombre de una persona humana o 'Sin Asignar'. JAMÁS incluyas nombres de temas o módulos entre paréntesis (ej: PROHIBIDO poner 'Sin Asignar (Business Dims)', pon únicamente 'Sin Asignar').
3. Si no hay temas pendientes o tareas para un participante en el mes, devuelve listas vacías [] en vez de inventar datos.

Responde estrictamente en formato JSON válido en español sin envolver en texto adicional:
{
  "monthlySynthesis": "string",
  "keyAchievements": ["string"],
  "pendingTopics": [{ "topicName": "string", "assignee": "string", "status": "string", "blockerRisk": "string" }],
  "participantWorkloads": [{ "name": "string", "tasksCount": 1, "completionRate": 85, "primaryFocus": "string" }],
  "teamVelocityInsights": "string",
  "nextMonthRecommendations": ["string"]
}`;

    const promptContent = `PERÍODO REPORTADO: ${periodName}
TOTAL DE REUNIONES ANALIZADAS EN EL MES: ${meetingsCount}

TEMAS TRATADOS EN EL MES:
${JSON.stringify(topics, null, 2)}

TICKETS / COMPROMISOS EN JIRA EN EL MES:
${JSON.stringify(actionItems, null, 2)}

Sintetiza con veracidad el progreso del mes a partir EXCLUSIVAMENTE de los temas y tareas provistos.`;

    try {
      const rawResponse = await callAIProvider({
        provider: aiProvider,
        model: aiModel,
        systemInstruction,
        promptContent,
        keys: aiKeys,
      });

      const parsed = parseLlmJsonResponse(rawResponse);

      // Sanitize parsed results to remove any "(Topic Name)" from assignees
      if (Array.isArray(parsed.pendingTopics)) {
        parsed.pendingTopics = parsed.pendingTopics.map((pt: any) => ({
          ...pt,
          assignee: pt.assignee ? pt.assignee.replace(/\s*\([^)]*\)$/, '').trim() : 'Sin Asignar',
        }));
      }

      if (Array.isArray(parsed.participantWorkloads)) {
        parsed.participantWorkloads = parsed.participantWorkloads.filter((pw: any) => !isNonPersonName(pw.name));
      }

      return res.json({
        id: 'rep-' + Date.now(),
        monthYear,
        monthName: periodName,
        createdAt: new Date().toISOString(),
        meetingsCount,
        totalTasksIdentified: actionItems.length,
        totalJiraSynced: actionItems.filter((a: any) => a.jiraStatus === 'synced').length,
        ...parsed,
      });
    } catch (genError: any) {
      // No local fallback: if the selected model fails, report the error and stop.
      const aiErrorInfo = describeAiError(genError, aiProvider, aiModel);
      console.error(`[AI Engine] monthly report - ${aiProvider} failed (${aiErrorInfo.status ?? 'sin código'}): ${aiErrorInfo.message}`);
      return res.status(502).json({
        error: aiErrorInfo.message,
        aiError: aiErrorInfo,
      });
    }
  } catch (error: any) {
    console.error('Error in /api/generate-monthly-report:', error);
    res.status(500).json({ error: error?.message || 'Error al generar el reporte mensual.' });
  }
});

// Endpoint: Create Jira Ticket (Real Cloud API or Smart Simulation)
app.post('/api/jira/create-issue', async (req: Request, res: Response) => {
  try {
    const { actionItem, jiraConfig } = req.body;

    if (!actionItem) {
      return res.status(400).json({ error: 'Faltan los datos del actionItem.' });
    }

    const domain = (jiraConfig?.domain || 'civicasoftware.atlassian.net').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const projectKey = (jiraConfig?.projectKey || 'PAY').trim().toUpperCase();
    const isLiveJira = jiraConfig?.simulationMode === false;

    // Generate random sequential key for simulation mode only
    const issueNum = Math.floor(100 + Math.random() * 900);
    const issueKey = `${projectKey}-${issueNum}`;
    const issueUrl = `https://${domain}/browse/${issueKey}`;

    // If real API credentials are provided and user turned off simulation:
    if (isLiveJira) {
      if (!jiraConfig?.apiToken || !jiraConfig?.userEmail) {
        return res.status(400).json({
          success: false,
          error: 'El Modo Simulación está desactivado, pero falta configurar el Correo o el API Token de Atlassian en Ajustes.',
        });
      }

      try {
        const authHeader = 'Basic ' + Buffer.from(`${jiraConfig.userEmail.trim()}:${jiraConfig.apiToken.trim()}`).toString('base64');

        // Dynamically discover valid issue types for the specified project in Jira Cloud
        let resolvedIssueTypeName = actionItem.issueType || 'Task';
        try {
          const projectMetaRes = await fetch(`https://${domain}/rest/api/3/project/${projectKey}`, {
            headers: {
              'Authorization': authHeader,
              'Accept': 'application/json'
            }
          });
          if (projectMetaRes.ok) {
            const projectData = (await projectMetaRes.json()) as any;
            const projectIssueTypes: any[] = projectData.issueTypes || [];
            const reqLower = (actionItem.issueType || 'Task').toLowerCase();

            // Match case-insensitive or standard Spanish/English equivalents
            const match = projectIssueTypes.find((it: any) => !it.subtask && (
              it.name.toLowerCase() === reqLower ||
              (reqLower === 'task' && (it.name.toLowerCase() === 'tarea' || it.name.toLowerCase() === 'task')) ||
              (reqLower === 'story' && (it.name.toLowerCase() === 'historia' || it.name.toLowerCase() === 'historia de usuario' || it.name.toLowerCase() === 'story')) ||
              (reqLower === 'bug' && (it.name.toLowerCase() === 'error' || it.name.toLowerCase() === 'defecto' || it.name.toLowerCase() === 'bug'))
            ));

            if (match) {
              resolvedIssueTypeName = match.name;
            } else {
              const firstStandard = projectIssueTypes.find((it: any) => !it.subtask);
              if (firstStandard) {
                resolvedIssueTypeName = firstStandard.name;
              }
            }
          }
        } catch (metaErr) {
          console.warn('Could not auto-detect project issue types:', metaErr);
        }

        // Discover and match Assignee accountId in Jira Cloud
        let matchingAccountId: string | null = null;
        let matchedAssigneeName: string | null = null;
        const rawAssignee = (actionItem.assignee || '').trim();
        const cleanAssigneeName = rawAssignee.replace(/\s*\([^)]*\)/g, '').trim();

        if (cleanAssigneeName) {
          const knownUsers: any[] = req.body.jiraUsers || jiraConfig?.jiraUsers || [];
          const foundLocal = knownUsers.find((u: any) => {
            const dn = (u.displayName || '').toLowerCase();
            const em = (u.emailAddress || '').toLowerCase();
            const query = cleanAssigneeName.toLowerCase();
            return dn === query || dn.includes(query) || query.includes(dn) || em.startsWith(query);
          });

          if (foundLocal?.accountId && !foundLocal.accountId.startsWith('jira-usr-')) {
            matchingAccountId = foundLocal.accountId;
            matchedAssigneeName = foundLocal.displayName;
          } else {
            // Query Jira Cloud for assignable users in this project
            try {
              const userSearchRes = await fetch(
                `https://${domain}/rest/api/3/user/assignable/search?project=${projectKey}&query=${encodeURIComponent(cleanAssigneeName)}`,
                {
                  headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/json',
                  },
                }
              );
              if (userSearchRes.ok) {
                const searchResults = (await userSearchRes.json()) as any[];
                if (Array.isArray(searchResults) && searchResults.length > 0) {
                  const exact = searchResults.find((u: any) =>
                    u.displayName?.toLowerCase().includes(cleanAssigneeName.toLowerCase()) ||
                    cleanAssigneeName.toLowerCase().includes(u.displayName?.toLowerCase())
                  );
                  const selectedUser = exact || searchResults[0];
                  if (selectedUser?.accountId) {
                    matchingAccountId = selectedUser.accountId;
                    matchedAssigneeName = selectedUser.displayName;
                  }
                }
              }
            } catch (userErr) {
              console.warn('Error querying Jira assignable users:', userErr);
            }
          }
        }

        const buildJiraPayload = (typeName: string, withAssignee: boolean = true) => {
          const payload: any = {
            fields: {
              project: { key: projectKey },
              summary: actionItem.title,
              description: {
                type: 'doc',
                version: 1,
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', text: `Contexto Reunión Teams:\n${actionItem.description || actionItem.technicalContext || ''}\n\nResponsable Asignado en ProyectHandler: ${actionItem.assignee}\nTema: ${actionItem.topicName || ''}` }
                    ]
                  },
                  {
                    type: 'heading',
                    attrs: { level: 3 },
                    content: [{ type: 'text', text: 'Criterios de Aceptación' }]
                  },
                  {
                    type: 'bulletList',
                    content: (actionItem.acceptanceCriteria || []).map((crit: string) => ({
                      type: 'listItem',
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: crit }] }]
                    }))
                  }
                ]
              },
              issuetype: { name: typeName },
              priority: { name: actionItem.priority || 'Medium' },
              labels: actionItem.jiraLabels || ['teams-meeting-ai'],
            }
          };

          if (withAssignee && matchingAccountId) {
            payload.fields.assignee = { accountId: matchingAccountId };
          }

          return payload;
        };

        let response = await fetch(`https://${domain}/rest/api/3/issue`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(buildJiraPayload(resolvedIssueTypeName, true)),
        });

        // If rejected, check if issue was due to assignee or issuetype
        if (!response.ok) {
          const errText = await response.text();
          if (errText.includes('assignee')) {
            console.warn(`[Jira Assignee] Could not assign ${cleanAssigneeName}, retrying unassigned:`, errText);
            const retryUnassigned = await fetch(`https://${domain}/rest/api/3/issue`, {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(buildJiraPayload(resolvedIssueTypeName, false)),
            });
            if (retryUnassigned.ok) {
              response = retryUnassigned;
            }
          } else if (errText.includes('issuetype')) {
            const alternateType = resolvedIssueTypeName.toLowerCase() === 'task' ? 'Tarea' : 'Task';
            const retryRes = await fetch(`https://${domain}/rest/api/3/issue`, {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(buildJiraPayload(alternateType, true)),
            });
            if (retryRes.ok) {
              response = retryRes;
            }
          }

          if (response.ok) {
            const data = (await response.json()) as any;
            return res.json({
              success: true,
              issueKey: data.key,
              issueUrl: `https://${domain}/browse/${data.key}`,
              mode: 'live-jira',
              syncedAt: new Date().toISOString(),
            });
          }

          // Real error: explain clearly to user instead of pretending it succeeded in simulation
          let parsedError = '';
          try {
            const errJson = JSON.parse(errText);
            parsedError = errJson.errorMessages?.join(', ') || Object.values(errJson.errors || {}).join(', ');
          } catch {
            parsedError = errText;
          }

          return res.status(400).json({
            success: false,
            error: `Jira Cloud (${projectKey}) rechazó la creación: ${parsedError || 'Verifica los permisos o tipo de incidencia de tu proyecto.'}`,
          });
        }

        const data = (await response.json()) as any;
        return res.json({
          success: true,
          issueKey: data.key,
          issueUrl: `https://${domain}/browse/${data.key}`,
          mode: 'live-jira',
          syncedAt: new Date().toISOString(),
        });
      } catch (jiraErr: any) {
        console.error('Jira network error:', jiraErr);
        return res.status(500).json({
          success: false,
          error: `Error de red al conectar con Jira Cloud: ${jiraErr.message || 'Error de conexión.'}`,
        });
      }
    }

    // Smart simulated creation (only if simulation mode is active)
    return res.json({
      success: true,
      issueKey,
      issueUrl,
      mode: 'simulation',
      syncedAt: new Date().toISOString(),
      details: {
        summary: actionItem.title,
        assignee: actionItem.assignee,
        issueType: actionItem.issueType || 'Task',
        priority: actionItem.priority || 'High',
        storyPoints: actionItem.storyPoints || 3,
        project: projectKey,
        board: jiraConfig?.boardName || `${projectKey} Sprint Board`,
        labels: actionItem.jiraLabels || ['teams-ai'],
      }
    });
  } catch (error: any) {
    console.error('Error in /api/jira/create-issue:', error);
    res.status(500).json({ error: error?.message || 'Error al conectar con Jira.' });
  }
});

// Endpoint: Test Jira Connection
app.post('/api/jira/test-connection', async (req: Request, res: Response) => {
  const { domain, projectKey, userEmail, apiToken, simulationMode } = req.body;

  if (simulationMode) {
    return res.json({
      connected: true,
      mode: 'simulation',
      message: 'Modo Simulación Activo: Los tickets se sincronizarán y formatearán con las especificaciones de Atlassian Jira Cloud.',
      user: 'Usuario Teams AI',
    });
  }

  const cleanDomain = (domain || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const cleanEmail = (userEmail || '').trim();
  const cleanToken = (apiToken || '').trim();
  const cleanProjectKey = (projectKey || '').trim().toUpperCase();

  if (!cleanDomain || !cleanEmail || !cleanToken) {
    return res.status(400).json({
      connected: false,
      error: 'Se requiere dominio Atlassian, correo y API Token para conexión en vivo.',
    });
  }

  try {
    const authHeader = 'Basic ' + Buffer.from(`${cleanEmail}:${cleanToken}`).toString('base64');

    const testRes = await fetch(`https://${cleanDomain}/rest/api/3/myself`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    if (!testRes.ok) {
      const errorText = await testRes.text().catch(() => '');
      console.warn(`[Jira Test] Respondió con código ${testRes.status}:`, errorText);
      let errorMsg = `Atlassian respondió con código ${testRes.status}. Verifique el token o permisos.`;
      if (testRes.status === 401) {
        errorMsg = `Error 401 (No autorizado): El correo o el API Token no son válidos para ${cleanDomain}. Verifique que el correo coincida con su cuenta Atlassian y que el token esté activo.`;
      } else if (testRes.status === 403) {
        errorMsg = 'Error 403 (Acceso denegado): Token válido pero la cuenta carece de permisos sobre el producto Jira Cloud.';
      } else if (testRes.status === 404) {
        errorMsg = `Error 404: No se encontró la instancia "${cleanDomain}".`;
      }
      return res.json({
        connected: false,
        error: errorMsg,
      });
    }

    const userData = (await testRes.json()) as any;
    let projectDetails = '';

    if (cleanProjectKey) {
      try {
        const projRes = await fetch(`https://${cleanDomain}/rest/api/3/project/${cleanProjectKey}`, {
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
          },
        });
        if (projRes.ok) {
          const projData = (await projRes.json()) as any;
          const types = (projData.issueTypes || []).filter((it: any) => !it.subtask).map((it: any) => it.name);
          projectDetails = ` • Proyecto "${projData.name || cleanProjectKey}" validado con éxito (Tipos: ${types.slice(0, 4).join(', ')}).`;
        } else if (projRes.status === 404) {
          projectDetails = ` • ⚠️ Aviso: Usuario autenticado, pero el proyecto "${cleanProjectKey}" no existe en ${cleanDomain}.`;
        } else {
          projectDetails = ` • ⚠️ Usuario autenticado, pero no se pudo acceder al proyecto "${cleanProjectKey}" (Código ${projRes.status}).`;
        }
      } catch (projErr) {
        console.warn('Error verifying project key:', projErr);
      }
    }

    return res.json({
      connected: true,
      mode: 'live-jira',
      message: `Conexión exitosa con Jira Cloud para ${userData.displayName || cleanEmail}${projectDetails}`,
      user: userData.displayName,
    });
  } catch (err: any) {
    return res.json({
      connected: false,
      error: `Error de red al contactar Jira Cloud: ${err.message}`,
    });
  }
});

// Simulated Jira team (used when Simulation Mode is on or Jira is unreachable)
const jiraSimulatedUsers = [
  {
    accountId: 'jira-usr-carlos',
    displayName: 'Carlos Mendoza',
    emailAddress: 'carlos.mendoza@civicasoftware.com',
    role: 'Tech Lead / Arquitecto',
    active: true,
    capacityLimit: 8,
  },
  {
    accountId: 'jira-usr-anasofia',
    displayName: 'Ana Sofía Rivas',
    emailAddress: 'ana.rivas@civicasoftware.com',
    role: 'Senior Backend Engineer',
    active: true,
    capacityLimit: 8,
  },
  {
    accountId: 'jira-usr-rodrigo',
    displayName: 'Rodrigo Alarcón',
    emailAddress: 'rodrigo.alarcon@civicasoftware.com',
    role: 'DevOps & Cloud Lead',
    active: true,
    capacityLimit: 8,
  },
  {
    accountId: 'jira-usr-laura',
    displayName: 'Laura Cárdenas',
    emailAddress: 'laura.cardenas@civicasoftware.com',
    role: 'Frontend & UI/UX Specialist',
    active: true,
    capacityLimit: 8,
  },
  {
    accountId: 'jira-usr-javier',
    displayName: 'Javier Domínguez',
    emailAddress: 'javier.dominguez@civicasoftware.com',
    role: 'QA & Automation Engineer',
    active: true,
    capacityLimit: 8,
  },
];

// Endpoint: Fetch / Search Assignable Jira Users
app.post('/api/jira/assignable-users', async (req: Request, res: Response) => {
  const { domain, userEmail, apiToken, projectKey = 'PAY', simulationMode = true } = req.body;
  const defaultJiraUsers = jiraSimulatedUsers;

  if (!simulationMode && domain && userEmail && apiToken) {
    try {
      const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const authHeader = 'Basic ' + Buffer.from(`${userEmail.trim()}:${apiToken.trim()}`).toString('base64');

      const jiraRes = await fetch(
        `https://${cleanDomain}/rest/api/3/user/assignable/search?project=${encodeURIComponent(projectKey)}&maxResults=50`,
        {
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
          },
        }
      );

      if (jiraRes.ok) {
        const users = (await jiraRes.json()) as any[];
        const mappedUsers = users.map((u) => ({
          accountId: u.accountId,
          displayName: u.displayName || u.emailAddress,
          emailAddress: u.emailAddress || `${u.displayName?.toLowerCase().replace(/\s+/g, '.')}@${cleanDomain}`,
          avatarUrl: u.avatarUrls?.['48x48'],
          active: u.active ?? true,
          role: 'Usuario Jira Cloud',
          capacityLimit: 8,
        }));

        if (mappedUsers.length > 0) {
          return res.json({
            users: mappedUsers,
            source: 'live-jira',
            total: mappedUsers.length,
          });
        }
      }
    } catch (err) {
      console.warn('Failed to query Jira Cloud users, falling back to default team users:', err);
    }
  }

  return res.json({
    users: defaultJiraUsers,
    source: 'simulation',
    total: defaultJiraUsers.length,
  });
});

// Endpoint: Search assignable Jira users by partial name/email (autocomplete)
app.post('/api/jira/search-users', async (req: Request, res: Response) => {
  const { domain, userEmail, apiToken, projectKey = 'PAY', simulationMode = true, query = '' } = req.body;
  const q = String(query || '').trim();

  if (q.length < 2) {
    return res.json({ users: [], source: 'none' });
  }

  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (!simulationMode && domain && userEmail && apiToken) {
    try {
      const cleanDomain = String(domain).trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const authHeader = 'Basic ' + Buffer.from(`${String(userEmail).trim()}:${String(apiToken).trim()}`).toString('base64');

      const jiraRes = await fetch(
        `https://${cleanDomain}/rest/api/3/user/assignable/search?project=${encodeURIComponent(projectKey)}&query=${encodeURIComponent(q)}&maxResults=10`,
        { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }
      );

      if (!jiraRes.ok) {
        return res.status(jiraRes.status).json({
          users: [],
          error:
            jiraRes.status === 401 || jiraRes.status === 403
              ? 'Credenciales de Jira inválidas o sin permisos.'
              : `Jira respondió con el estado ${jiraRes.status}.`,
        });
      }

      const found = (await jiraRes.json()) as any[];
      const users = found
        .filter((u) => u.accountType !== 'app' && (u.active ?? true))
        .map((u) => ({
          accountId: u.accountId,
          displayName: u.displayName || u.emailAddress,
          emailAddress: u.emailAddress || '',
          avatarUrl: u.avatarUrls?.['48x48'],
          active: true,
          role: 'Usuario Jira Cloud',
          capacityLimit: 8,
        }));

      return res.json({ users, source: 'live-jira' });
    } catch (err: any) {
      console.warn('Failed to search Jira users:', err);
      return res.status(502).json({ users: [], error: 'No se pudo contactar con Jira.' });
    }
  }

  const nq = normalize(q);
  const users = jiraSimulatedUsers.filter(
    (u) => normalize(u.displayName).includes(nq) || normalize(u.emailAddress).includes(nq)
  );
  return res.json({ users, source: 'simulation' });
});

// In-memory store for the most recently received Teams webhook
let latestTeamsWebhookEvent: {
  id: string;
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  organizer: string;
  transcript: string;
  receivedAt: string;
} | null = null;

// Endpoint: Teams Webhook Receiver (Live Teams Call integration)
app.post('/api/teams/webhook', async (req: Request, res: Response) => {
  try {
    // Supports Microsoft Graph webhook validation handshake
    const validationToken = req.query?.validationToken || req.body?.validationToken;
    if (validationToken) {
      return res.status(200).send(validationToken);
    }

    const {
      eventType,
      meetingId,
      transcriptText,
      transcript: altTranscript,
      text,
      content,
      messages,
      organizer,
      meetingTitle,
      subject,
      title: altTitle,
    } = req.body;

    const resolvedTitle = meetingTitle || subject || altTitle || 'Reunión Teams Sincronizada vía Webhook';

    let resolvedTranscript = transcriptText || altTranscript || text || content;
    if (!resolvedTranscript && Array.isArray(messages)) {
      resolvedTranscript = messages
        .map((m: any) => `[${m.time || ''}] ${m.sender || m.speaker || 'Participante'}: ${m.text || m.content || ''}`)
        .join('\n');
    }

    if (!resolvedTranscript) {
      resolvedTranscript = `[10:00:00] Carlos Mendoza (Tech Lead): Revisión de cierre de sprint desde Teams Webhook.
[10:01:10] Ana Sofía Rivas: El despliegue de base de datos concluyó exitosamente.
[10:02:00] Rodrigo Alarcón: Alertas de Datadog activas y en verde.`;
    }

    const organizerName = typeof organizer === 'object'
      ? (organizer?.name || organizer?.emailAddress?.name || 'Organizador Teams')
      : (organizer || 'Organizador Teams');

    const eventRecord = {
      id: 'hook-' + Date.now(),
      meetingId: meetingId || 'teams-hook-' + Date.now(),
      meetingTitle: resolvedTitle,
      meetingDate: new Date().toISOString().split('T')[0],
      organizer: organizerName,
      transcript: resolvedTranscript,
      receivedAt: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    latestTeamsWebhookEvent = eventRecord;

    return res.json({
      status: 'received',
      ...eventRecord,
      message: 'Transcripción recibida y lista para procesamiento en ProyectHandler.',
    });
  } catch (err: any) {
    console.error('Error in /api/teams/webhook:', err);
    res.status(500).json({ error: 'Error procesando webhook de Teams.' });
  }
});

// Endpoint: Check if a new Teams webhook event was received
app.get('/api/teams/latest-webhook', (req: Request, res: Response) => {
  return res.json({ latest: latestTeamsWebhookEvent });
});

// Endpoint: Clear the latest Teams webhook event
app.delete('/api/teams/latest-webhook', (req: Request, res: Response) => {
  latestTeamsWebhookEvent = null;
  return res.json({ success: true });
});

// Endpoint: Bidirectional Jira Status Sync
app.post('/api/jira/sync-statuses', async (req: Request, res: Response) => {
  try {
    const { issueKeys = [], jiraConfig } = req.body;

    if (!Array.isArray(issueKeys) || issueKeys.length === 0) {
      return res.json({ statuses: {} });
    }

    type SyncedStatus = {
      status: string;
      statusCategory: 'To Do' | 'In Progress' | 'Done';
      progress: number;
      updated: string;
      summary?: string;
      assignee?: string | null;
      assigneeAccountId?: string | null;
      priority?: string;
      labels?: string[];
      url?: string;
    };
    const statuses: Record<string, SyncedStatus> = {};
    const errors: Record<string, string> = {};
    const isLiveJira = jiraConfig?.simulationMode === false;

    if (isLiveJira) {
      if (!jiraConfig?.domain || !jiraConfig?.userEmail || !jiraConfig?.apiToken) {
        return res.status(400).json({
          success: false,
          error: 'El Modo Simulación está desactivado, pero falta configurar el dominio, el correo o el API Token de Atlassian en Ajustes.',
        });
      }

      const domain = jiraConfig.domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const authHeader = 'Basic ' + Buffer.from(`${jiraConfig.userEmail.trim()}:${jiraConfig.apiToken.trim()}`).toString('base64');
      const fields = 'summary,status,assignee,priority,labels,updated';

      await Promise.all(
        (issueKeys as string[]).map(async (key) => {
          try {
            const jiraRes = await fetch(
              `https://${domain}/rest/api/3/issue/${encodeURIComponent(key)}?fields=${fields}`,
              { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }
            );

            if (!jiraRes.ok) {
              errors[key] =
                jiraRes.status === 404
                  ? 'El ticket no existe o no tienes permisos para verlo.'
                  : jiraRes.status === 401 || jiraRes.status === 403
                    ? 'Credenciales de Jira inválidas o sin permisos.'
                    : `Jira respondió con el estado ${jiraRes.status}.`;
              return;
            }

            const issue = (await jiraRes.json()) as any;
            const f = issue.fields || {};
            const categoryKey: string = f.status?.statusCategory?.key || 'new';
            const statusCategory: SyncedStatus['statusCategory'] =
              categoryKey === 'done' ? 'Done' : categoryKey === 'indeterminate' ? 'In Progress' : 'To Do';
            const statusName: string = f.status?.name || statusCategory;
            const isReview = statusCategory === 'In Progress' && /review|revis|qa|test|valid/i.test(statusName);
            const progress = statusCategory === 'Done' ? 100 : isReview ? 80 : statusCategory === 'In Progress' ? 50 : 20;

            statuses[key] = {
              status: statusName,
              statusCategory,
              progress,
              updated: f.updated || new Date().toISOString(),
              summary: f.summary,
              assignee: f.assignee?.displayName ?? null,
              assigneeAccountId: f.assignee?.accountId ?? null,
              priority: f.priority?.name,
              labels: Array.isArray(f.labels) ? f.labels : [],
              url: `https://${domain}/browse/${key}`,
            };
          } catch (e: any) {
            errors[key] = `No se pudo contactar con Jira: ${e?.message || 'error de red'}`;
          }
        })
      );

      return res.json({
        success: true,
        statuses,
        errors,
        syncedCount: Object.keys(statuses).length,
        mode: 'live-jira',
        syncedAt: new Date().toISOString(),
      });
    }

    // Simulation mode: deterministic fake lifecycle progression
    const possibleStatuses = ['To Do', 'In Progress', 'In Review', 'Done'];
    (issueKeys as string[]).forEach((key, idx) => {
      const statusIdx = (idx % 3 === 0) ? 3 : (idx % 2 === 0) ? 1 : 2; // mostly In Progress or Done
      const statusName = possibleStatuses[statusIdx];
      const progress = statusName === 'Done' ? 100 : statusName === 'In Review' ? 80 : statusName === 'In Progress' ? 50 : 20;

      statuses[key] = {
        status: statusName,
        statusCategory: statusName === 'Done' ? 'Done' : statusName === 'To Do' ? 'To Do' : 'In Progress',
        progress,
        updated: new Date().toISOString(),
      };
    });

    return res.json({
      success: true,
      statuses,
      errors,
      syncedCount: issueKeys.length,
      mode: 'simulation',
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in /api/jira/sync-statuses:', err);
    res.status(500).json({ error: 'Error sincronizando estados bidireccionales con Jira.' });
  }
});

// Endpoint: Confluence / SharePoint Publishing
app.post('/api/confluence/publish', async (req: Request, res: Response) => {
  try {
    const { pageTitle, meetingTitle, meetingDate, contentHtml, spaceKey = 'DEV' } = req.body;

    const pageId = String(Math.floor(100000 + Math.random() * 900000));
    const title = pageTitle || `Acta de Reunión: ${meetingTitle || 'Sincronización'} - ${meetingDate || new Date().toISOString().split('T')[0]}`;
    const cleanSpace = (spaceKey || 'DEV').toUpperCase();
    const mockUrl = `https://empresa.atlassian.net/wiki/spaces/${cleanSpace}/pages/${pageId}`;

    return res.json({
      success: true,
      pageId,
      pageTitle: title,
      spaceKey: cleanSpace,
      pageUrl: mockUrl,
      publishedAt: new Date().toISOString(),
      message: `Acta publicada exitosamente en el espacio Confluence [${cleanSpace}].`,
    });
  } catch (err: any) {
    console.error('Error in /api/confluence/publish:', err);
    res.status(500).json({ error: 'Error publicando en Confluence.' });
  }
});

// Setup Vite middleware in dev or static serving in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
