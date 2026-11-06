import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { agnosticDb, DatabaseConfig } from './server/db/agnosticDb';
import { buildIssueDescriptionAdf, buildCommentAdf } from './server/services/jiraAdf';
import {
  discoverStoryPointsFieldId,
  resolveJiraAssigneeAccountId,
  linkJiraIssuesInCloud,
  fetchBoardContext,
  publishToConfluenceCloud,
} from './server/services/jiraCloud';
import {
  callAIProvider,
  describeAiError,
  parseLlmJsonResponse,
  isNonPersonName,
} from './server/services/aiProviders';

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
  'gemini-3.6-flash': { name: 'Gemini 3.6 Flash', description: 'Alta velocidad y precisión analítica, máxima disponibilidad sin congestión.', speed: 'rápido', badge: 'Recomendado' },
  'gemini-3.5-flash-lite': { name: 'Gemini 3.5 Flash Lite', description: 'Ultrarrápido y liviano (~600ms), diseñado para respuestas instantáneas.', speed: 'rápido', badge: 'Ultra Rápido' },
  'gemini-flash-lite-latest': { name: 'Gemini Flash Lite (Latest)', description: 'Versión lite continua de alta resiliencia ante picos de demanda.', speed: 'rápido' },
  'gemini-3.8-flash': { name: 'Gemini 3.8 Flash', description: 'Modelo insignia experimental de Google con fallback automático ante alta demanda.', speed: 'rápido' },
  'gemini-3.1-flash-lite': { name: 'Gemini 3.1 Flash Lite', description: 'Modelo ultrarrápido y liviano de última generación.', speed: 'rápido' },
  'gemini-2.5-flash': { name: 'Gemini 2.5 Flash', description: 'Procesamiento de contexto ultra amplio con baja latencia en Google AI Studio.', speed: 'rápido' },
  'gemini-2.5-pro': { name: 'Gemini 2.5 Pro', description: 'Razonamiento profundo y auditoría de decisiones complejas.', speed: 'máximo' },
  'gemini-1.5-flash': { name: 'Gemini 1.5 Flash', description: 'Estable y veloz para transcripciones extensas de Teams.', speed: 'rápido' },
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
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.8-flash',
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
      gemini: geminiList[0] || 'gemini-3.8-flash',
      claude: claudeList[0] || 'claude-3-7-sonnet-20250219',
      openai: openaiList[0] || 'gpt-4o',
      copilot: copilotList[0] || 'copilot-gpt-4o',
    },
  });
});


// (Multi-Provider AI Calling Engine & Error Handlers modularized in ./server/services/aiProviders)

// Endpoint: Test connection for any AI Provider & Model
app.post('/api/ai/test-connection', async (req: Request, res: Response) => {
  const { provider = 'claude', model, apiKey, azureEndpoint, azureDeploymentName, azureApiVersion } = req.body;
  const start = Date.now();

  try {
    const rawResult = await callAIProvider({
      provider,
      model: model || (provider === 'claude' ? 'claude-3-7-sonnet-20250219' : provider === 'openai' ? 'gpt-4o' : provider === 'copilot' ? 'copilot-gpt-4o' : 'gemini-3.8-flash'),
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

// (Non-person keywords & isNonPersonName helper modularized in ./server/services/aiProviders)

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

// (BoardIssueContext and fetchBoardContext modularized in ./server/services/jiraCloud)

// (fetchBoardContext is modularized and imported from ./server/services/jiraCloud)

function normalizeCategoryText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' y ')
    .replace(/\s+de\s+/g, ' y ')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchClosestCategory(rawCategory: string, availableCategories: string[]): string {
  if (!availableCategories || availableCategories.length === 0) return rawCategory || 'General';
  const cleanRaw = (rawCategory || '').trim();
  if (!cleanRaw) return availableCategories[0];

  const exact = availableCategories.find((c) => c.toLowerCase() === cleanRaw.toLowerCase());
  if (exact) return exact;

  const normRaw = normalizeCategoryText(cleanRaw);
  const normalizedMatch = availableCategories.find((c) => normalizeCategoryText(c) === normRaw);
  if (normalizedMatch) return normalizedMatch;

  const rawWords = normRaw.split(' ').filter((w) => w.length > 2);
  let bestCategory = '';
  let bestScore = 0;

  for (const cat of availableCategories) {
    const normCat = normalizeCategoryText(cat);
    let score = 0;
    if (normCat.includes(normRaw) || normRaw.includes(normCat)) score += 6;
    for (const rw of rawWords) {
      if (normCat.includes(rw)) score += 3;
    }
    if (normRaw.includes('arquitectura') && normCat.includes('arquitectura')) score += 10;
    if (
      (normRaw.includes('infraestructura') || normRaw.includes('pipeline') || normRaw.includes('cloud') || normRaw.includes('devops')) &&
      (normCat.includes('devops') || normCat.includes('cloud'))
    ) score += 10;
    if (
      (normRaw.includes('calidad') || normRaw.includes('qa') || normRaw.includes('test') || normRaw.includes('validacion')) &&
      normCat.includes('qa')
    ) score += 10;
    if (
      (normRaw.includes('reingenieria') || normRaw.includes('refactor') || normRaw.includes('migracion')) &&
      normCat.includes('reingenieria')
    ) score += 10;
    if (
      (normRaw.includes('ia') || normRaw.includes('inteligencia') || normRaw.includes('ml')) &&
      normCat.includes('ia')
    ) score += 10;
    if (
      (normRaw.includes('backend') || normRaw.includes('api') || normRaw.includes('servicio')) &&
      normCat.includes('backend')
    ) score += 10;
    if (
      (normRaw.includes('frontend') || normRaw.includes('ui') || normRaw.includes('ux') || normRaw.includes('interfaz')) &&
      normCat.includes('frontend')
    ) score += 10;

    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  if (bestScore >= 3 && bestCategory) {
    return bestCategory;
  }

  return availableCategories[0];
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
      existingTopics = [],
      topicCategories = [],
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

    const effectiveCategories = Array.isArray(topicCategories) && topicCategories.length > 0
      ? topicCategories
      : [
          'Backend & APIs',
          'DevOps & Cloud',
          'Arquitectura & Datos',
          'Seguridad & Compliance',
          'QA & Automatización',
          'Gestión & Producto',
          'Reingenieria',
          'IA'
        ];

    const systemInstruction = `Eres un Principal Technical Project Manager y Agile Coach experto en análisis de transcripciones de Microsoft Teams y gestión de proyectos en Jira Cloud.
Tu objetivo es analizar la transcripción de la reunión, comprender quién participó, qué temas se trataron, detectar con precisión si se habló de tareas que ya existen en el tablero de Jira o si son tareas nuevas.

REGLAS CRÍTICAS DE CALIDAD Y ASIGNACIÓN (OBLIGATORIAS):

1. ESTRUCTURACIÓN DEL RESUMEN EJECUTIVO ('executiveSummary'):
   - El campo 'executiveSummary' DEBE adoptar fielmente la estructura, secciones, encabezados, tono y viñetas solicitados por el usuario en su instrucción personalizada / modalidad de prompt.
   - No generes un resumen corto y escueto. No te limites a generar una lista de tareas. Genera un resumen ejecutivo completo y profesional, incluye todas las secciones que consideres relevantes para el contexto de la reunión. A menos que el usuario indique lo contrario explícitamente.
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

3. UNIFICACIÓN DE TEMAS EN SEGUIMIENTO ('mainTopics'):
   - Se te provee la lista de "TICKETS EXISTENTES EN EL TABLERO DE JIRA" y de "TEMAS PREVIOS EN EL HISTÓRICO".
   - Si en la reunión se habla, debate, actualiza o revisa un tema que corresponde a un ticket abierto del tablero o a la continuidad de un tema previo:
     * 'matchedJiraKey': La clave exacta del ticket de Jira (ej: 'PAY-101' o null). ¡Debe coincidir exactamente con una de las claves provistas!
     * 'existingTopicId': El ID del tema previo en el histórico (ej: 'topic-123' o null) si corresponde a la continuidad de un tema ya registrado.
     * 'isExistingTicketTopic': true si corresponde a un ticket abierto o tema en seguimiento.
     * 'topicName': Utiliza el título del ticket existente o del tema previo en el histórico. ¡ESTÁ TERMINANTEMENTE PROHIBIDO crear un título nuevo o divergente para un ticket o tema que ya está abierto (ej: si ya existe "Modelado de Business Dims y cálculo de Channel STK", mantén ese mismo nombre en lugar de inventar "Lógica de Channel STK y Filtrado de Amagadores")!
     * 'proposedProgressNote': Redacta una síntesis técnica concisa de las novedades, decisiones o avances discutidos sobre este ticket en esta reunión (ej: "Debate sobre transformar la fecha de cancelación en un flag (not null) para excluir amagadores en marcas del norte y adición del campo de tarifa en prepago."). Esta nota se guardará como nota de avance en el histórico de temas.
   - Si es un tema nuevo que no corresponde a ningún ticket del tablero ni tema previo:
     * 'matchedJiraKey': null
     * 'existingTopicId': null
     * 'isExistingTicketTopic': false
     * 'proposedProgressNote': null

4. IDENTIFICACIÓN INTELIGENTE: TAREAS EN CURSO VS TAREAS NUEVAS:
   - Se te proporciona la lista de "TICKETS EXISTENTES EN EL TABLERO DE JIRA" con su clave, título, estado y asignado actual.
   - Si en la reunión se discute, revisa, actualiza, desbloquea o da continuidad a una tarea que YA EXISTE en esa lista:
     * Asigna "taskKind": "existing"
     * "matchedJiraKey": La clave exacta del ticket (ej: "PAY-101"). ¡OBLIGATORIO: DEBE coincidir exactamente con una de las claves de la lista provista, NUNCA inventes claves!
     * "matchConfidence": "Alta" | "Media" | "Baja"
     * "matchReason": Explicación concisa de por qué coincide con la conversación.
     * "proposedComment": Redacta un comentario técnico profesional para Jira con el siguiente formato obligatorio: "Avance [FECHA_REUNIÓN]: [Resumen conciso y técnico de novedades, decisiones o avances acordados en esta reunión].\n\nCriterios de Aceptación ([N]):\n[Criterio 1 acordado o verificado]\n[Criterio 2 acordado o verificado]..." (donde [N] es el número de criterios de aceptación y se listan uno por línea).
     * Si el ticket existente está cerrado/Done en la lista provista: añade "isClosedMatch": true.
   - Si es un trabajo nuevo que no corresponde a ninguno de los tickets existentes en el tablero:
     * Asigna "taskKind": "new"
     * "matchedJiraKey": null
     * "matchConfidence": null
     * "matchReason": null
     * "proposedComment": null
     * "isClosedMatch": false

5. GENERACIÓN CONDICIONAL DE TICKETS NUEVOS (CERO TAREAS DE RELLENO):
   - Genera ÚNICAMENTE las tareas NUEVAS que realmente surjan como compromisos de la reunión (máximo 4 tickets nuevos), si se mencionan mas de una tarea del mismo tema agrupalas en una sola tarjeta. ("taskKind": "new").
   - Si en la llamada solo se revisó el estado de tareas anteriores o no surgieron compromisos nuevos, devuelve ÚNICAMENTE las que correspondan (incluso 0 o 1). ESTÁ PROHIBIDO inventar tareas de relleno para alcanzar un cupo artificial.
   - Las tareas existentes en curso ("taskKind": "existing") NO cuentan para este límite; puedes identificar tantas tareas en curso como se hayan tratado en la reunión.

6. TÍTULOS Y ACCIONABILIDAD:
   - Cada título de tarea nueva debe comenzar con un verbo en infinitivo (ej: 'Concentrar integración de...', 'Implementar...', 'Refactorizar...').
   - Cada ticket nuevo debe incluir criterios de aceptación comprobables y story points razonables (1, 2, 3, 5, 8).

7. COMPROMISOS HUÉRFANOS ('orphanCommitments'):
   - Identifica compromisos, acuerdos o tareas que se mencionaron en la reunión pero que quedaron sin un responsable explícito o inequívoco (ej: 'habría que revisar los logs', 'después preparamos el reporte').
   - Para cada uno, define un título conciso, el contexto hablado, el tema y sugiere la persona más adecuada del equipo ('suggestedAssignee') según su rol o contexto. Si no hay compromisos huérfanos, devuelve un array vacío [].

8. DEPENDENCIAS Y BLOQUEOS ('dependencies'):
   - Si la tarea de un participante bloquea o es prerrequisito para que otro participante pueda comenzar o finalizar la suya (ej: 'hasta que Juan no suba la macro, María no puede probar el modelo'), extrae la dependencia vinculándola con los IDs de las tareas ('blockerTaskId' y 'blockedTaskId' correspondientes a 'actionItems').
   - Si no se identifican dependencias de bloqueo mutuo en la sesión, devuelve un array vacío [].

9. MATRIZ RACI ('raciMatrix'):
   - Para los temas o entregables principales de la reunión, genera filas RACI asignando:
     * 'responsible': quién realiza operativamente el trabajo.
     * 'accountable': quién aprueba o responde por el entregable ante el negocio/cliente.
     * 'consulted': array de nombres de participantes a quienes se consulta soporte técnico o diseño.
     * 'informed': array de nombres de participantes que deben mantenerse al tanto del avance.

10. CATEGORÍAS DE TEMAS OBLIGATORIAS:
   - El campo 'category' de cada tema en 'mainTopics' y en 'raciMatrix' DEBE pertenecer RIGUROSAMENTE a una de las siguientes categorías configuradas en el proyecto:
${effectiveCategories.map((c: string) => `     * "${c}"`).join('\n')}
   - ESTÁ TERMINANTEMENTE PROHIBIDO inventar categorías libres o sinónimos fuera de esa lista (ej: usa siempre "Arquitectura & Datos", NUNCA inventes "General", "Calidad de Datos", "Infraestructura y Pipelines" o "Arquitectura de Datos").

11. FORMATO:
   - Responde SIEMPRE en español en un formato JSON estrictamente válido que cumpla con el siguiente esquema:
   {
     "meetingTitle": "string",
     "meetingDate": "YYYY-MM-DD",
     "executiveSummary": "string",
     "keyDecisions": ["string"],
     "mainTopics": [
       {
         "id": "top-1",
         "topicName": "string",
         "category": "string",
         "discussionSummary": "string",
         "status": "En Progreso|Completado|Bloqueado|Pendiente",
         "riskLevel": "Bajo|Medio|Alto",
         "leadAssignee": "string",
         "matchedJiraKey": "PAY-101 o null",
         "existingTopicId": "topic-123 o null",
         "isExistingTicketTopic": false,
         "proposedProgressNote": "string o null"
       }
     ],
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
     ],
     "orphanCommitments": [
       {
         "id": "orph-1",
         "title": "string",
         "context": "string",
         "topicName": "string",
         "suggestedAssignee": "string (HUMANO)",
         "priority": "Highest|High|Medium|Low"
       }
     ],
     "dependencies": [
       {
         "id": "dep-1",
         "blockerTaskId": "act-1",
         "blockerTitle": "string",
         "blockerAssignee": "string (HUMANO)",
         "blockedTaskId": "act-2",
         "blockedTitle": "string",
         "blockedAssignee": "string (HUMANO)",
         "description": "string"
       }
     ],
     "raciMatrix": [
       {
         "id": "raci-1",
         "topicOrDeliverable": "string",
         "responsible": "string (HUMANO)",
         "accountable": "string (HUMANO)",
         "consulted": ["string"],
         "informed": ["string"],
         "category": "string",
         "status": "string"
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

TEMAS PREVIOS EN EL HISTÓRICO DEL PROYECTO (${existingTopics.length} temas registrados):
${JSON.stringify((existingTopics || []).slice(0, 30).map((t: any) => ({ id: t.id, topicName: t.topicName, category: t.category, associatedJiraKeys: t.associatedJiraKeys, leadParticipant: t.leadParticipant, status: t.status })), null, 2)}

CATEGORÍAS DE SEGUIMIENTO CONFIGURADAS EN EL PROYECTO (OBLIGATORIAS):
${effectiveCategories.join(', ')}

TRANSCRIPCIÓN O APUNTES DE LA REUNIÓN EN TEAMS:
"""
${transcript.slice(0, 30000)}
"""

Extrae el resumen ejecutivo, acuerdos, temas (unificando con tickets/temas previos si corresponde), participantes, action items clasificados, compromisos huérfanos ('orphanCommitments'), dependencias ('dependencies') y matriz RACI ('raciMatrix').`;

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
      const cleanDomain = (effectiveJiraConfig?.domain || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const validBoardKeys = new Set(boardTickets.map((t) => t.key.toUpperCase()));
      const boardKeyMap = new Map(boardTickets.map((t) => [t.key.toUpperCase(), t]));
      const existingTopicIds = new Set((existingTopics || []).map((t: any) => t.id));

      if (Array.isArray(parsed.actionItems)) {
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

              // Ensure proposedComment contains acceptance criteria formatted if available
              if (item.proposedComment && Array.isArray(item.acceptanceCriteria) && item.acceptanceCriteria.length > 0) {
                const norm = item.proposedComment.toLowerCase();
                if (!norm.includes('criterios de aceptación') && !norm.includes('criterios de aceptacion')) {
                  const criteriaList = item.acceptanceCriteria.map((c: string) => String(c).trim()).filter(Boolean);
                  if (criteriaList.length > 0) {
                    item.proposedComment = `${item.proposedComment.trim()}\n\nCriterios de Aceptación (${criteriaList.length}):\n${criteriaList.join('\n')}`;
                  }
                }
              }
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

      // Post-process sanitation for mainTopics
      if (Array.isArray(parsed.mainTopics)) {
        parsed.mainTopics.forEach((top: any, idx: number) => {
          if (!top.id) top.id = `top-${idx + 1}`;
          if (!top.status) top.status = 'En Progreso';
          if (!top.riskLevel) top.riskLevel = 'Medio';
          top.category = matchClosestCategory(top.category, effectiveCategories);

          // Validate matchedJiraKey against real board keys
          if (top.matchedJiraKey) {
            const cleanKey = String(top.matchedJiraKey).trim().toUpperCase();
            if (validBoardKeys.has(cleanKey)) {
              top.matchedJiraKey = cleanKey;
              top.isExistingTicketTopic = true;
            } else {
              top.matchedJiraKey = null;
              top.isExistingTicketTopic = false;
            }
          }

          // If the topic has no matchedJiraKey, check if any actionItem under this topic matched a ticket
          if (!top.matchedJiraKey && Array.isArray(parsed.actionItems)) {
            const matchingAction = parsed.actionItems.find(
              (a: any) =>
                a.matchedJiraKey &&
                (a.topicName?.toLowerCase().trim() === top.topicName?.toLowerCase().trim() ||
                  top.topicName?.toLowerCase().includes(a.matchedJiraKey.toLowerCase()))
            );
            if (matchingAction && matchingAction.matchedJiraKey) {
              top.matchedJiraKey = matchingAction.matchedJiraKey;
              top.isExistingTicketTopic = true;
              if (!top.proposedProgressNote && matchingAction.proposedComment) {
                top.proposedProgressNote = matchingAction.proposedComment;
              }
            }
          }

          // Validate existingTopicId
          if (top.existingTopicId && !existingTopicIds.has(top.existingTopicId)) {
            top.existingTopicId = null;
          }

          // Fallback note if it's an existing ticket topic but proposedProgressNote was omitted
          if ((top.matchedJiraKey || top.existingTopicId || top.isExistingTicketTopic) && !top.proposedProgressNote) {
            top.proposedProgressNote = top.discussionSummary || 'Seguimiento y revisión del estado de la tarea en reunión.';
          }
        });
      }

      // Post-process sanitation for orphanCommitments
      if (!Array.isArray(parsed.orphanCommitments)) {
        parsed.orphanCommitments = [];
      } else {
        parsed.orphanCommitments = parsed.orphanCommitments
          .filter((o: any) => o && typeof o.title === 'string' && o.title.trim().length > 0)
          .map((o: any, idx: number) => {
            const fallbackAssignee =
              parsed.participants?.find((p: any) => !isNonPersonName(p.name))?.name ||
              jiraUsers?.[0]?.displayName ||
              'Equipo';
            return {
              id: o.id || `orph-${idx + 1}`,
              title: String(o.title || '').trim(),
              context: String(o.context || o.title || '').trim(),
              topicName: String(o.topicName || parsed.mainTopics?.[0]?.topicName || 'General').trim(),
              suggestedAssignee: isNonPersonName(o.suggestedAssignee)
                ? fallbackAssignee
                : o.suggestedAssignee || fallbackAssignee,
              priority: ['Highest', 'High', 'Medium', 'Low'].includes(o.priority) ? o.priority : 'High',
            };
          });
      }

      // Post-process sanitation for dependencies
      if (!Array.isArray(parsed.dependencies)) {
        parsed.dependencies = [];
      } else {
        parsed.dependencies = parsed.dependencies
          .filter((d: any) => d && (d.blockerTitle || d.blockedTitle || d.description))
          .map((d: any, idx: number) => {
            const fallbackP1 = parsed.participants?.[0]?.name || 'Equipo';
            const fallbackP2 = parsed.participants?.[1]?.name || fallbackP1;
            return {
              id: d.id || `dep-${idx + 1}`,
              blockerTaskId: String(d.blockerTaskId || `act-${idx + 1}`),
              blockerTitle: String(d.blockerTitle || 'Tarea bloqueante').trim(),
              blockerAssignee: isNonPersonName(d.blockerAssignee) ? fallbackP1 : d.blockerAssignee || fallbackP1,
              blockedTaskId: String(d.blockedTaskId || `act-${idx + 2}`),
              blockedTitle: String(d.blockedTitle || 'Tarea bloqueada').trim(),
              blockedAssignee: isNonPersonName(d.blockedAssignee) ? fallbackP2 : d.blockedAssignee || fallbackP2,
              description: String(d.description || 'Precedencia técnica identificada en la sesión.').trim(),
            };
          });
      }

      // Post-process sanitation for raciMatrix
      if (!Array.isArray(parsed.raciMatrix)) {
        parsed.raciMatrix = [];
      } else {
        parsed.raciMatrix = parsed.raciMatrix
          .filter((r: any) => r && r.topicOrDeliverable)
          .map((r: any, idx: number) => {
            const fallbackLead =
              parsed.participants?.find((p: any) => !isNonPersonName(p.name))?.name ||
              jiraUsers?.[0]?.displayName ||
              'Equipo';
            return {
              id: r.id || `raci-${idx + 1}`,
              topicOrDeliverable: String(r.topicOrDeliverable || `Entregable ${idx + 1}`).trim(),
              responsible: isNonPersonName(r.responsible) ? fallbackLead : r.responsible || fallbackLead,
              accountable: isNonPersonName(r.accountable) ? fallbackLead : r.accountable || fallbackLead,
              consulted: Array.isArray(r.consulted) ? r.consulted.filter((c: any) => !isNonPersonName(c)).map(String) : [],
              informed: Array.isArray(r.informed) ? r.informed.filter((i: any) => !isNonPersonName(i)).map(String) : [],
              category: matchClosestCategory(r.category || parsed.mainTopics?.[0]?.category, effectiveCategories),
              status: String(r.status || 'En Progreso').trim(),
            };
          });
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

// (linkJiraIssuesInCloud modularized in ./server/services/jiraCloud)

// Endpoint: Fetch Active Epics from Jira Project (Funcionalidad 4)
app.post('/api/jira/epics', async (req: Request, res: Response) => {
  try {
    const { jiraConfig } = req.body;
    const isSimulation = jiraConfig?.simulationMode !== false;
    const projectKey = (jiraConfig?.projectKey || 'PAY').trim().toUpperCase();

    if (!isSimulation && jiraConfig?.domain && jiraConfig?.userEmail && jiraConfig?.apiToken) {
      try {
        const cleanDomain = jiraConfig.domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
        const authHeader =
          'Basic ' + Buffer.from(`${jiraConfig.userEmail.trim()}:${jiraConfig.apiToken.trim()}`).toString('base64');

        const jql = `project = "${projectKey}" AND issuetype IN ("Epic", "Épica") AND statusCategory != Done ORDER BY updated DESC`;

        let jiraRes = await fetch(`https://${cleanDomain}/rest/api/3/search/jql`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jql,
            maxResults: 50,
            fields: ['summary', 'status'],
          }),
        });

        if (!jiraRes.ok && jiraRes.status === 405) {
          jiraRes = await fetch(
            `https://${cleanDomain}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,status`,
            {
              headers: {
                Authorization: authHeader,
                Accept: 'application/json',
              },
            }
          );
        }

        if (jiraRes.ok) {
          const data = (await jiraRes.json()) as any;
          if (Array.isArray(data.issues)) {
            const epics = data.issues.map((i: any) => ({
              key: i.key,
              summary: i.fields?.summary || i.key,
              status: i.fields?.status?.name || 'En Progreso',
            }));
            return res.json({
              success: true,
              epics,
              mode: 'live-jira',
            });
          }
        }
      } catch (err) {
        console.warn('[Jira Epics] Error fetching live epics from Jira Cloud:', err);
      }
    }

    // Fallback / Simulation mode Epics
    const simulatedEpics = [
      {
        key: `${projectKey}-10`,
        summary: 'Arquitectura Centralizada Business Dims & Tablas Externas CDP',
        status: 'In Progress',
      },
      {
        key: `${projectKey}-11`,
        summary: 'Modernización de Pipelines Airflow & Observabilidad',
        status: 'In Progress',
      },
      {
        key: `${projectKey}-12`,
        summary: 'Gobierno de Datos, Contratos & Calidad en Capa 40',
        status: 'To Do',
      },
    ];

    return res.json({
      success: true,
      epics: simulatedEpics,
      mode: 'simulation',
    });
  } catch (err: any) {
    console.error('Error in /api/jira/epics:', err);
    res.status(500).json({ error: 'Error obteniendo épicas del proyecto en Jira.' });
  }
});

// (buildCommentAdf modularized in ./server/services/jiraAdf)

// Endpoint: Add or Update Comment on an Existing Jira Issue
app.post('/api/jira/add-comment', async (req: Request, res: Response) => {
  try {
    const { issueKey, comment, jiraConfig, commentId } = req.body;

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
      const adfBody = buildCommentAdf(cleanComment);

      const targetCommentId = commentId && !String(commentId).startsWith('sim-') ? String(commentId).trim() : null;

      let jiraRes: any = null;

      // If existing commentId is provided, attempt to update it directly in Jira Cloud (avoiding duplicates)
      if (targetCommentId) {
        jiraRes = await fetch(
          `https://${domain}/rest/api/3/issue/${encodeURIComponent(cleanKey)}/comment/${encodeURIComponent(targetCommentId)}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(adfBody),
          }
        );
      }

      // If no commentId or PUT returned 404 (comment was removed), create as new comment
      if (!jiraRes || (!jiraRes.ok && jiraRes.status === 404)) {
        jiraRes = await fetch(
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
      }

      if (!jiraRes.ok) {
        const errText = await jiraRes.text();
        console.error(`[Jira Add/Update Comment] Error ${jiraRes.status} on ${cleanKey}:`, errText);
        return res.status(jiraRes.status).json({
          success: false,
          error: `Jira devolvió error ${jiraRes.status}: ${errText.slice(0, 200)}`,
        });
      }

      const data = (await jiraRes.json()) as any;
      return res.json({
        success: true,
        issueKey: cleanKey,
        commentId: data.id || targetCommentId,
        mode: 'live-jira',
        addedAt: new Date().toISOString(),
      });
    }

    // Simulation mode
    return res.json({
      success: true,
      issueKey: cleanKey,
      commentId: commentId || ('sim-comm-' + Date.now()),
      mode: 'simulation',
      addedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in /api/jira/add-comment:', err);
    res.status(500).json({ error: err?.message || 'Error al agregar comentario en Jira.' });
  }
});

// Endpoint: Update an Existing Jira Issue (Summary, Description, Acceptance Criteria, Priority, Assignee, Labels)
app.post('/api/jira/update-issue', async (req: Request, res: Response) => {
  try {
    const { issueKey, actionItem, jiraConfig, jiraUsers } = req.body;

    if (!issueKey || !actionItem) {
      return res.status(400).json({ error: 'Faltan issueKey o actionItem.' });
    }

    const cleanKey = String(issueKey).trim().toUpperCase();
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

      // Discover Story Points field and Assignee accountId in Jira Cloud
      const spFieldId = await discoverStoryPointsFieldId(domain, authHeader);
      const rawAssignee = (actionItem.assignee || '').trim();
      const cleanAssigneeName = rawAssignee.replace(/\s*\([^)]*\)/g, '').trim();
      const assigneeRes = await resolveJiraAssigneeAccountId(
        domain,
        authHeader,
        cleanKey.split('-')[0],
        cleanAssigneeName,
        jiraUsers || jiraConfig?.jiraUsers || []
      );
      const matchingAccountId = assigneeRes?.accountId || null;

      const buildUpdatePayload = (
        withAssignee: boolean = true,
        withPriority: boolean = true,
        withParent: boolean = true,
        withStoryPoints: boolean = true
      ) => {
        const descAdf = buildIssueDescriptionAdf(
          actionItem.description,
          actionItem.technicalContext,
          actionItem.acceptanceCriteria,
          actionItem.title || 'Actualizado desde ProyectHandler'
        );

        const payload: any = {
          fields: {
            summary: (actionItem.title || '').trim(),
            description: descAdf,
            labels: actionItem.jiraLabels || [],
          },
        };

        if (withPriority && actionItem.priority) {
          payload.fields.priority = { name: actionItem.priority };
        }

        if (withAssignee && matchingAccountId) {
          payload.fields.assignee = { accountId: matchingAccountId };
        }

        if (withParent && actionItem.epicKey && String(actionItem.epicKey).trim()) {
          payload.fields.parent = { key: String(actionItem.epicKey).trim().toUpperCase() };
        }

        if (
          withStoryPoints &&
          spFieldId &&
          typeof actionItem.storyPoints === 'number' &&
          actionItem.storyPoints > 0
        ) {
          payload.fields[spFieldId] = Number(actionItem.storyPoints);
        }

        return payload;
      };

      let response = await fetch(`https://${domain}/rest/api/3/issue/${encodeURIComponent(cleanKey)}`, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(buildUpdatePayload(true, true, true, true)),
      });

      // If rejected, check if due to story points, parent, assignee or priority
      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Jira Update Issue] Response ${response.status} on ${cleanKey}:`, errText);

        if (spFieldId && (errText.includes(spFieldId) || /story\s*point/i.test(errText))) {
          console.warn(`[Jira Story Points] Could not set story points on ${cleanKey}, retrying without story points:`, errText);
          response = await fetch(`https://${domain}/rest/api/3/issue/${encodeURIComponent(cleanKey)}`, {
            method: 'PUT',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(buildUpdatePayload(true, true, true, false)),
          });
        } else if (errText.includes('parent') || errText.includes('hierarchy')) {
          response = await fetch(`https://${domain}/rest/api/3/issue/${encodeURIComponent(cleanKey)}`, {
            method: 'PUT',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(buildUpdatePayload(true, true, false, true)),
          });
        } else if (errText.includes('assignee')) {
          response = await fetch(`https://${domain}/rest/api/3/issue/${encodeURIComponent(cleanKey)}`, {
            method: 'PUT',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(buildUpdatePayload(false, true, false, true)),
          });
        } else if (errText.includes('priority')) {
          response = await fetch(`https://${domain}/rest/api/3/issue/${encodeURIComponent(cleanKey)}`, {
            method: 'PUT',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(buildUpdatePayload(true, false, false, true)),
          });
        }

        if (!response.ok) {
          const finalErrText = await response.text();
          let parsedError = '';
          try {
            const errJson = JSON.parse(finalErrText);
            parsedError = errJson.errorMessages?.join(', ') || Object.values(errJson.errors || {}).join(', ');
          } catch {
            parsedError = finalErrText;
          }
          return res.status(400).json({
            success: false,
            error: `Jira Cloud (${cleanKey}) rechazó la actualización: ${parsedError || 'Verifica los campos y permisos.'}`,
          });
        }
      }

      return res.json({
        success: true,
        issueKey: cleanKey,
        issueUrl: `https://${domain}/browse/${cleanKey}`,
        mode: 'live-jira',
        updatedAt: new Date().toISOString(),
      });
    }

    // Simulation mode
    return res.json({
      success: true,
      issueKey: cleanKey,
      issueUrl: `https://${(jiraConfig?.domain || 'civicasoftware.atlassian.net').replace(/^https?:\/\//, '').replace(/\/$/, '')}/browse/${cleanKey}`,
      mode: 'simulation',
      updatedAt: new Date().toISOString(),
      details: {
        summary: actionItem.title,
        description: actionItem.description,
        acceptanceCriteria: actionItem.acceptanceCriteria,
        priority: actionItem.priority,
        assignee: actionItem.assignee,
        labels: actionItem.jiraLabels,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/jira/update-issue:', error);
    res.status(500).json({ error: error?.message || 'Error al actualizar el ticket en Jira.' });
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

        // Discover Story Points field
        const spFieldId = await discoverStoryPointsFieldId(domain, authHeader);

        // Discover and match Assignee accountId in Jira Cloud
        const rawAssignee = (actionItem.assignee || '').trim();
        const cleanAssigneeName = rawAssignee.replace(/\s*\([^)]*\)/g, '').trim();
        const assigneeRes = await resolveJiraAssigneeAccountId(
          domain,
          authHeader,
          projectKey,
          cleanAssigneeName,
          req.body.jiraUsers || jiraConfig?.jiraUsers || []
        );
        const matchingAccountId = assigneeRes?.accountId || null;

        const buildJiraPayload = (
          typeName: string,
          withAssignee: boolean = true,
          withParent: boolean = true,
          withStoryPoints: boolean = true
        ) => {
          const descAdf = buildIssueDescriptionAdf(
            actionItem.description,
            actionItem.technicalContext,
            actionItem.acceptanceCriteria,
            actionItem.title || 'Generado desde ProyectHandler'
          );

          const payload: any = {
            fields: {
              project: { key: projectKey },
              summary: actionItem.title,
              description: descAdf,
              issuetype: { name: typeName },
              priority: { name: actionItem.priority || 'Medium' },
              labels: actionItem.jiraLabels || ['teams-meeting-ai'],
            },
          };

          if (withAssignee && matchingAccountId) {
            payload.fields.assignee = { accountId: matchingAccountId };
          }

          if (withParent && actionItem.epicKey && String(actionItem.epicKey).trim()) {
            payload.fields.parent = { key: String(actionItem.epicKey).trim().toUpperCase() };
          }

          if (
            withStoryPoints &&
            spFieldId &&
            typeof actionItem.storyPoints === 'number' &&
            actionItem.storyPoints > 0
          ) {
            payload.fields[spFieldId] = Number(actionItem.storyPoints);
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
          body: JSON.stringify(buildJiraPayload(resolvedIssueTypeName, true, true, true)),
        });

        // If rejected, check if issue was due to story points, parent, assignee or issuetype
        if (!response.ok) {
          const errText = await response.text();
          if (spFieldId && (errText.includes(spFieldId) || /story\s*point/i.test(errText))) {
            console.warn(`[Jira Story Points] Could not set story points on ${resolvedIssueTypeName}, retrying without story points:`, errText);
            const retryWithoutSp = await fetch(`https://${domain}/rest/api/3/issue`, {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(buildJiraPayload(resolvedIssueTypeName, true, true, false)),
            });
            if (retryWithoutSp.ok) {
              response = retryWithoutSp;
            }
          } else if (errText.includes('parent') || errText.includes('hierarchy')) {
            console.warn(`[Jira Parent Epic] Could not set parent ${actionItem.epicKey}, retrying without parent:`, errText);
            const retryWithoutParent = await fetch(`https://${domain}/rest/api/3/issue`, {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(buildJiraPayload(resolvedIssueTypeName, true, false, true)),
            });
            if (retryWithoutParent.ok) {
              response = retryWithoutParent;
            }
          } else if (errText.includes('assignee')) {
            console.warn(`[Jira Assignee] Could not assign ${cleanAssigneeName}, retrying unassigned:`, errText);
            const retryUnassigned = await fetch(`https://${domain}/rest/api/3/issue`, {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(buildJiraPayload(resolvedIssueTypeName, false, false, true)),
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
              body: JSON.stringify(buildJiraPayload(alternateType, true, false, false)),
            });
            if (retryRes.ok) {
              response = retryRes;
            }
          }

          if (!response.ok) {
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
        }

        const data = (await response.json()) as any;
        const createdKey = data.key;

        // Funcionalidad 1: Execute native Jira Issue Link if requested
        let linkResult: { linked: boolean; linkTypeName?: string; warning?: string } | undefined;
        const linkToIssue = req.body.linkToIssue;
        if (
          linkToIssue &&
          linkToIssue.sourceKey &&
          linkToIssue.linkType &&
          linkToIssue.linkType !== 'none'
        ) {
          linkResult = await linkJiraIssuesInCloud(
            domain,
            authHeader,
            createdKey,
            String(linkToIssue.sourceKey).trim().toUpperCase(),
            linkToIssue.linkType
          );
        }

        return res.json({
          success: true,
          issueKey: createdKey,
          issueUrl: `https://${domain}/browse/${createdKey}`,
          mode: 'live-jira',
          syncedAt: new Date().toISOString(),
          linkResult,
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
    const simLink = req.body.linkToIssue;
    return res.json({
      success: true,
      issueKey,
      issueUrl,
      mode: 'simulation',
      syncedAt: new Date().toISOString(),
      linkResult:
        simLink && simLink.sourceKey && simLink.linkType && simLink.linkType !== 'none'
          ? { linked: true, linkTypeName: simLink.linkType }
          : undefined,
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

// Endpoint: Link two Jira Issues (Blocks / Is blocked by / Relates)
app.post('/api/jira/link-issues', async (req: Request, res: Response) => {
  try {
    const { blockerKey, blockedKey, relationType = 'blocks', jiraConfig } = req.body;

    if (!blockerKey || !blockedKey) {
      return res.status(400).json({ error: 'Faltan las claves de los tickets (blockerKey y blockedKey).' });
    }

    const domain = (jiraConfig?.domain || 'civicasoftware.atlassian.net').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const isLiveJira = jiraConfig?.simulationMode === false;

    if (!isLiveJira) {
      return res.json({
        success: true,
        mode: 'simulation',
        message: `[Simulación] Tickets ${blockerKey} y ${blockedKey} vinculados con relación ${relationType}.`,
      });
    }

    if (!jiraConfig?.apiToken || !jiraConfig?.userEmail) {
      return res.status(400).json({
        success: false,
        error: 'Falta configurar el Correo o el API Token de Atlassian para vincular tickets en Jira Cloud.',
      });
    }

    const authHeader = 'Basic ' + Buffer.from(`${jiraConfig.userEmail.trim()}:${jiraConfig.apiToken.trim()}`).toString('base64');
    
    // newIssueKey: blockerKey, sourceIssueKey: blockedKey, relationType: 'blocks'
    const result = await linkJiraIssuesInCloud(domain, authHeader, blockerKey, blockedKey, relationType);

    if (!result.linked) {
      return res.status(400).json({
        success: false,
        error: result.warning || 'No se pudo crear la vinculación en Jira Cloud.',
      });
    }

    return res.json({
      success: true,
      mode: 'live-jira',
      linkTypeName: result.linkTypeName,
      message: `Enlace creado en Jira: ${blockerKey} bloquea a ${blockedKey}`,
    });
  } catch (error: any) {
    console.error('Error in /api/jira/link-issues:', error);
    res.status(500).json({ error: error?.message || 'Error al vincular tickets en Jira.' });
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
    const { pageTitle, meetingTitle, meetingDate, contentHtml, spaceKey = 'DEV', parentPageId, jiraConfig } = req.body;

    const title = pageTitle || `Acta de Reunión: ${meetingTitle || 'Sincronización'} - ${meetingDate || new Date().toISOString().split('T')[0]}`;
    const cleanSpace = (spaceKey || jiraConfig?.confluenceSpace || 'DEV').toUpperCase();

    const isLive = jiraConfig?.simulationMode === false && jiraConfig?.domain && jiraConfig?.userEmail && jiraConfig?.apiToken;

    if (isLive) {
      try {
        const liveResult = await publishToConfluenceCloud({
          domain: jiraConfig.domain,
          userEmail: jiraConfig.userEmail,
          apiToken: jiraConfig.apiToken,
          spaceKey: cleanSpace,
          pageTitle: title,
          contentHtml: contentHtml || '',
          parentPageId,
        });
        return res.json(liveResult);
      } catch (cloudErr: any) {
        console.error('Confluence Cloud publishing error:', cloudErr);
        return res.status(400).json({
          success: false,
          error: cloudErr.message || 'Error al conectar con la API de Confluence Cloud.',
        });
      }
    }

    const pageId = String(Math.floor(100000 + Math.random() * 900000));
    const cleanDomain = (jiraConfig?.domain || 'empresa.atlassian.net').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const mockUrl = `https://${cleanDomain}/wiki/spaces/${cleanSpace}/pages/${pageId}`;

    return res.json({
      success: true,
      pageId,
      pageTitle: title,
      spaceKey: cleanSpace,
      pageUrl: mockUrl,
      publishedAt: new Date().toISOString(),
      message: `Acta publicada exitosamente en el espacio Confluence [${cleanSpace}] (Modo Simulado).`,
    });
  } catch (err: any) {
    console.error('Error in /api/confluence/publish:', err);
    res.status(500).json({ error: 'Error publicando en Confluence.' });
  }
});

// ============================================================================
// Agnostic Database API Endpoints
// ============================================================================

// Endpoint: Test connection to configured agnostic database
app.post('/api/db/test-connection', async (req: Request, res: Response) => {
  try {
    const config: DatabaseConfig = req.body;
    const result = await agnosticDb.testConnection(config);
    return res.json(result);
  } catch (err: any) {
    console.error('Error testing agnostic database connection:', err);
    return res.status(500).json({
      success: false,
      latencyMs: 0,
      engine: req.body?.type || 'none',
      message: 'Fallo al ejecutar la prueba de conexión con la base de datos.',
      error: err.message,
    });
  }
});

// Endpoint: Check for environment-based database configuration
app.get('/api/db/env-config', (_req: Request, res: Response) => {
  const envUrl = process.env.DATABASE_URL || '';
  const envType = process.env.DATABASE_TYPE || (envUrl ? 'postgres' : 'none');
  const envSnowflakeAccount = process.env.SNOWFLAKE_ACCOUNT || '';
  const hasEnvDb = Boolean(envUrl || (envType && envType !== 'none') || envSnowflakeAccount);

  return res.json({
    hasEnvDb,
    envDbType: envType,
    hasConnectionString: Boolean(envUrl),
    snowflakeAccount: envSnowflakeAccount ? envSnowflakeAccount.replace(/(.{2}).+(.{2})/, '$1***$2') : undefined,
  });
});

// Endpoint: Read collection from agnostic database
app.post('/api/db/data', async (req: Request, res: Response) => {
  try {
    const { config, collection } = req.body;
    if (!collection) {
      return res.status(400).json({ error: 'Falta especificar la colección o tabla solicitada.' });
    }
    const data = await agnosticDb.getData(config || { enabled: false, type: 'none' }, collection);
    return res.json({ success: true, collection, data });
  } catch (err: any) {
    console.error('Error getting data from agnostic database:', err);
    return res.status(500).json({ error: 'Error al recuperar datos de la base de datos.' });
  }
});

// Endpoint: Save single document or entity to agnostic database
app.post('/api/db/save', async (req: Request, res: Response) => {
  try {
    const { config, collection, key, data } = req.body;
    if (!collection || !key) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (collection, key).' });
    }
    const ok = await agnosticDb.saveItem(config || { enabled: false, type: 'none' }, collection, key, data);
    return res.json({ success: ok, collection, key });
  } catch (err: any) {
    console.error('Error saving item to agnostic database:', err);
    return res.status(500).json({ error: 'Error al persistir el elemento en la base de datos.' });
  }
});

// Endpoint: Delete document or entity from agnostic database
app.post('/api/db/delete', async (req: Request, res: Response) => {
  try {
    const { config, collection, key } = req.body;
    if (!collection || !key) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (collection, key).' });
    }
    const ok = await agnosticDb.deleteItem(config || { enabled: false, type: 'none' }, collection, key);
    return res.json({ success: ok, collection, key });
  } catch (err: any) {
    console.error('Error deleting item from agnostic database:', err);
    return res.status(500).json({ error: 'Error al eliminar el elemento de la base de datos.' });
  }
});

// Endpoint: Bulk migrate local data (localStorage) to agnostic database
app.post('/api/db/migrate', async (req: Request, res: Response) => {
  try {
    const { config, payload } = req.body;
    if (!payload) {
      return res.status(400).json({ error: 'Falta la carga de datos para migrar.' });
    }
    const result = await agnosticDb.bulkMigrate(config || { enabled: false, type: 'none' }, payload);
    return res.json(result);
  } catch (err: any) {
    console.error('Error during bulk migration to database:', err);
    return res.status(500).json({ error: 'Error durante la migración a la base de datos.' });
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
