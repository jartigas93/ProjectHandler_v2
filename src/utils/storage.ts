import {
  MeetingAnalysis,
  TopicHistoryRecord,
  MonthlyReport,
  JiraConfig,
  ProjectSettings,
  JiraUser,
  AIProviderConfig,
  AIModelOption,
  SavedCustomPrompt
} from '../types';

const STORAGE_KEYS = {
  MEETINGS: 'teams2jira_meetings',
  TOPICS: 'teams2jira_topic_history',
  MONTHLY_REPORTS: 'teams2jira_monthly_reports',
  JIRA_CONFIG: 'teams2jira_jira_config',
  PROJECT_SETTINGS: 'proyecthandler_project_settings',
  ACTIVE_MEETING: 'teams2jira_active_meeting',
  CUSTOM_PROMPTS: 'teams2jira_custom_prompts',
  CUSTOM_AI_MODELS: 'teams2jira_custom_ai_models',
};

export const DEFAULT_JIRA_USERS: JiraUser[] = [
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

export const DEFAULT_TOPIC_CATEGORIES: string[] = [
  'Backend & APIs',
  'Frontend & UX',
  'DevOps & Cloud',
  'Arquitectura & Datos',
  'Seguridad & Compliance',
  'QA & Automatización',
  'Gestión & Producto',
];

export const DEFAULT_JIRA_CONFIG: JiraConfig = {
  domain: 'civicasoftware.atlassian.net',
  projectKey: 'PAY',
  boardName: 'Sprint 42 Scrum Board',
  userEmail: 'dev.lead@civicasoftware.com',
  apiToken: '',
  simulationMode: true,
  defaultIssueType: 'Task',
  confluenceSpace: '',
  includeBacklog: true,
  recentClosedDays: 14,
  maxBoardTicketsForAI: 150,
  filterLabelsOrComponents: '',
  excludeIssueTypes: ['Epic'],
  customJql: '',
};

export const DEFAULT_AI_CONFIG: AIProviderConfig = {
  activeProvider: 'claude',
  selectedModel: 'claude-3-7-sonnet-20250219',
  anthropicApiKey: '',
  openAiApiKey: '',
  openAiCustomModel: '',
  azureApiKey: '',
  azureEndpoint: '',
  azureDeploymentName: 'gpt-4o',
  azureApiVersion: '2024-08-01-preview',
  geminiApiKey: '',
};

export const AVAILABLE_AI_MODELS: AIModelOption[] = [
  // Anthropic Claude
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet',
    provider: 'claude',
    description: 'Máxima capacidad de razonamiento híbrido y síntesis precisa de compromisos.',
    speed: 'máximo',
    badge: 'Recomendado',
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'claude',
    description: 'Excelente balance entre profundidad analítica y velocidad de respuesta.',
    speed: 'equilibrado',
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'claude',
    description: 'Ultrarrápido y liviano, ideal para minutas breves y dailies ágiles.',
    speed: 'rápido',
  },

  // OpenAI
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Omni)',
    provider: 'openai',
    description: 'Modelo insignia de OpenAI para análisis conversacional y desestructuración Jira.',
    speed: 'equilibrado',
    badge: 'Popular',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Rápido, económico y altamente estructurado en salidas JSON.',
    speed: 'rápido',
  },
  {
    id: 'o3-mini',
    name: 'o3-mini (Reasoning)',
    provider: 'openai',
    description: 'Razonamiento lógico avanzado para reuniones técnicas y arquitectónicas.',
    speed: 'máximo',
  },

  // Microsoft Copilot / Azure OpenAI
  {
    id: 'copilot-gpt-4o',
    name: 'Copilot (Azure GPT-4o)',
    provider: 'copilot',
    description: 'Integración empresarial Microsoft Copilot / Azure OpenAI corporativo.',
    speed: 'equilibrado',
    badge: 'Empresarial',
  },
  {
    id: 'copilot-gpt-4o-mini',
    name: 'Copilot (Azure GPT-4o Mini)',
    provider: 'copilot',
    description: 'Despliegue ágil en entorno seguro Azure de la organización.',
    speed: 'rápido',
  },

  // Google Gemini
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Procesamiento de contexto ultra amplio con baja latencia en Google AI Studio.',
    speed: 'rápido',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    description: 'Razonamiento profundo y auditoría de decisiones complejas.',
    speed: 'máximo',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    description: 'Estable y veloz para transcripciones extensas de Teams.',
    speed: 'rápido',
  },
];

export const DEFAULT_SAVED_PROMPTS: SavedCustomPrompt[] = [
  {
    id: 'prompt-masorange',
    title: 'MASORANGE Data Stack',
    content: `Actúa como Principal Technical Project Manager y experto en gestión de proyectos de datos, Apache Airflow, Google BigQuery y Modern Data Stack para el proyecto MASORANGE.

Te proporciono la transcripción de una reunión de Microsoft Teams del proyecto MASORANGE. Tu objetivo es procesar y estructurar la sesión en un informe técnico de alta calidad, profesional, accionable y directamente compatible con el sistema de seguimiento de ProyectHandler y Jira Cloud.

Contexto del proyecto:
- Arquitectura: Pipelines de datos basados en Apache Airflow ejecutando SQL y Python sobre Google BigQuery. Archivos YAML de configuración de DAGs y tareas, ingestas, transformaciones, validaciones de calidad, alertas y documentación operativa.
- Restricción: NO asumas que el proyecto usa dbt salvo que la transcripción lo mencione explícitamente.
- Temas frecuentes: DAGs de Airflow, BigQuery, GA4, Marketing Online, CRMV2, Byside, Genesys, Convertia, atribución, llamadas, proveedores, Segment Calls, Marketing Final, data quality checks, auditoría/logs en Looker, data contracts y runbooks (dag.md).

Normalizaciones fonéticas obligatorias:
• "DAX", "DAC", "Dack", "Dac", "edad" ➔ DAG / DAGs
• "G a cuatro", "Gea cuatro", "GA cuatro" ➔ GA4
• "Bicueri", "Big Query", "Bquery" ➔ BigQuery
• "Yira", "Gira" ➔ Jira
• "perre", "pri", "pool request", "pull request" ➔ PR
• "Tims", "tenis" ➔ Teams
• "Shincha" ➔ Jinja
• "Sat", "Station" ➔ staging
• "Pro" ➔ producción
• "Vice Side", "Vaisaid", "Baisaid" ➔ Byside
• "Data Contract", "contrato de datos" ➔ data contract
• "Runbook", "dag.md" ➔ runbook (dag.md)
• "AppStream" ➔ upstream
• "DawnStream" ➔ downstream

Personas y roles:
• Samantha: Cliente (Stakeholder / Product Owner de MASORANGE).
• Juanjo / Juan José: Equipo proveedor / colaborador técnico.
• David: Equipo proveedor / colaborador técnico.
• Juan Carlos (o "Juan"): Equipo proveedor / colaborador técnico.
(No inventar personas ficticias).

Directivas para el resumen y tickets de Jira:
1. El Resumen Ejecutivo debe estructurarse con saludo formal, situación actual agrupada por temas, decisiones, acuerdos, próximos pasos y dudas pendientes.
2. Genera entre 2 y 4 tickets de Jira accionables con responsable asignado exclusivamente a una persona física (Juanjo, David, Juan Carlos, etc.), con criterios de aceptación claros y Story Points.`,
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  storyPointsScale: [1, 2, 3, 5, 8, 13, 21],
  defaultStoryPoints: 3,
  sprintCapacityPerMember: 8,
  enableCapacityAlerts: true,
  topicCategories: DEFAULT_TOPIC_CATEGORIES,
  jiraUsers: DEFAULT_JIRA_USERS,
  jira: DEFAULT_JIRA_CONFIG,
  ai: DEFAULT_AI_CONFIG,
  savedCustomPrompts: DEFAULT_SAVED_PROMPTS,
};

const SEED_TOPIC_IDS = new Set(['topic-stripe-integration', 'topic-k8s-multiregion', 'topic-security-soc2', 'topic-checkout-redesign']);
const SEED_MEETING_IDS = new Set(['sprint-payments', 'infra-kubernetes', 'security-audit']);

export function loadSavedMeetings(): MeetingAnalysis[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MEETINGS);
    if (!data) return [];
    const meetings: MeetingAnalysis[] = JSON.parse(data);
    return meetings.filter((m) => !SEED_MEETING_IDS.has(m.id));
  } catch (e) {
    console.error('Error loading meetings from localStorage:', e);
    return [];
  }
}

export function saveMeeting(meeting: MeetingAnalysis): void {
  try {
    const meetings = loadSavedMeetings();
    const index = meetings.findIndex((m) => m.id === meeting.id);
    if (index >= 0) {
      meetings[index] = meeting;
    } else {
      meetings.unshift(meeting);
    }
    localStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify(meetings));
  } catch (e) {
    console.error('Error saving meeting to localStorage:', e);
  }
}

export function deleteSavedMeeting(meetingId: string): void {
  try {
    const meetings = loadSavedMeetings();
    const updated = meetings.filter((m) => m.id !== meetingId);
    localStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify(updated));
  } catch (e) {
    console.error('Error deleting meeting from localStorage:', e);
  }
}

export function isTopicActiveInMonth(topic: TopicHistoryRecord, monthYear: string): boolean {
  if (!topic || !monthYear) return false;

  // 1. Direct match on first/last discussed dates
  if (topic.firstDiscussedDate && topic.firstDiscussedDate.startsWith(monthYear)) return true;
  if (topic.lastDiscussedDate && topic.lastDiscussedDate.startsWith(monthYear)) return true;

  // 2. Any meeting within the topic matching the month
  if (Array.isArray(topic.meetings) && topic.meetings.some((m) => m.date && m.date.startsWith(monthYear))) {
    return true;
  }

  // 3. UpdatedAt matching
  if (topic.updatedAt && topic.updatedAt.startsWith(monthYear)) return true;

  // 4. Notes with date tags matching monthYear (e.g., "2026-10" or "10/2026" or "10-2026")
  const [year, month] = monthYear.split('-');
  const monthSlashYearRegex = new RegExp(`(?:${month}[\\/\\.-]${year}|${year}[\\/\\.-]${month})`);
  if (Array.isArray(topic.notes) && topic.notes.some((n) => monthSlashYearRegex.test(n))) {
    return true;
  }

  return false;
}

export function filterTopicsForMonth(topics: TopicHistoryRecord[], monthYear: string): TopicHistoryRecord[] {
  return topics.filter((t) => isTopicActiveInMonth(t, monthYear));
}


export function loadTopicHistory(): TopicHistoryRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TOPICS);
    if (!data) return [];
    const topics: TopicHistoryRecord[] = JSON.parse(data);
    return topics.filter((t) => !SEED_TOPIC_IDS.has(t.id));
  } catch (e) {
    console.error('Error loading topic history:', e);
    return [];
  }
}

export function saveTopicHistory(topics: TopicHistoryRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(topics));
  } catch (e) {
    console.error('Error saving topic history:', e);
  }
}

export function deleteTopic(topicId: string): void {
  const topics = loadTopicHistory();
  const updated = topics.filter((t) => t.id !== topicId);
  saveTopicHistory(updated);
}

export function clearTopicHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.TOPICS);
  } catch (e) {
    console.error('Error clearing topic history:', e);
  }
}

export function updateOrAddTopic(topic: TopicHistoryRecord): void {
  const topics = loadTopicHistory();
  const index = topics.findIndex((t) => t.id === topic.id || t.topicName.toLowerCase() === topic.topicName.toLowerCase());
  if (index >= 0) {
    topics[index] = {
      ...topics[index],
      ...topic,
      updatedAt: new Date().toISOString(),
    };
  } else {
    topics.unshift(topic);
  }
  saveTopicHistory(topics);
}

export function loadJiraConfig(): JiraConfig {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.JIRA_CONFIG);
    return data ? { ...DEFAULT_JIRA_CONFIG, ...JSON.parse(data) } : DEFAULT_JIRA_CONFIG;
  } catch (e) {
    return DEFAULT_JIRA_CONFIG;
  }
}

export function loadProjectSettings(): ProjectSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROJECT_SETTINGS);
    if (data) {
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_PROJECT_SETTINGS,
        ...parsed,
        jira: { ...DEFAULT_JIRA_CONFIG, ...(parsed.jira || {}) },
        jiraUsers: parsed.jiraUsers?.length > 0 ? parsed.jiraUsers : DEFAULT_JIRA_USERS,
        topicCategories: parsed.topicCategories?.length > 0 ? parsed.topicCategories : DEFAULT_TOPIC_CATEGORIES,
        ai: { ...DEFAULT_AI_CONFIG, ...(parsed.ai || {}) },
        savedCustomPrompts: Array.isArray(parsed.savedCustomPrompts) && parsed.savedCustomPrompts.length > 0
          ? parsed.savedCustomPrompts.slice(0, 3)
          : loadSavedCustomPrompts(),
      };
    }
    // Also check if legacy JIRA_CONFIG exists
    const legacyJira = localStorage.getItem(STORAGE_KEYS.JIRA_CONFIG);
    if (legacyJira) {
      return {
        ...DEFAULT_PROJECT_SETTINGS,
        jira: { ...DEFAULT_JIRA_CONFIG, ...JSON.parse(legacyJira) },
      };
    }
    return DEFAULT_PROJECT_SETTINGS;
  } catch (e) {
    return DEFAULT_PROJECT_SETTINGS;
  }
}

export function saveProjectSettings(settings: ProjectSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROJECT_SETTINGS, JSON.stringify(settings));
    // Also sync legacy Jira config key for backwards compatibility
    if (settings.jira) {
      localStorage.setItem(STORAGE_KEYS.JIRA_CONFIG, JSON.stringify(settings.jira));
    }
  } catch (e) {
    console.error('Error saving project settings:', e);
  }
}

export function loadSavedCustomPrompts(): SavedCustomPrompt[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_PROMPTS);
    if (!data) return DEFAULT_SAVED_PROMPTS;
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.slice(0, 3) : DEFAULT_SAVED_PROMPTS;
  } catch (e) {
    console.error('Error loading custom prompts:', e);
    return DEFAULT_SAVED_PROMPTS;
  }
}

export function saveCustomPrompts(prompts: SavedCustomPrompt[]): void {
  try {
    const capped = prompts.slice(0, 3);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PROMPTS, JSON.stringify(capped));
    // Also sync to project settings if present
    const settingsStr = localStorage.getItem(STORAGE_KEYS.PROJECT_SETTINGS);
    if (settingsStr) {
      const parsed = JSON.parse(settingsStr);
      parsed.savedCustomPrompts = capped;
      localStorage.setItem(STORAGE_KEYS.PROJECT_SETTINGS, JSON.stringify(parsed));
    }
  } catch (e) {
    console.error('Error saving custom prompts:', e);
  }
}

export function loadMonthlyReports(): MonthlyReport[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MONTHLY_REPORTS);
    if (!data) return [];
    const reports: MonthlyReport[] = JSON.parse(data);
    return reports.map((r) => {
      // Clean any generic dummy assignees from pendingTopics
      const cleanedPendingTopics = (r.pendingTopics || []).map((pt) => ({
        ...pt,
        assignee: pt.assignee ? pt.assignee.replace(/\s*\([^)]*\)$/, '').trim() : 'Sin Asignar',
      }));
      // Filter out seed mock workloads
      const cleanedWorkloads = (r.participantWorkloads || []).filter((w) => {
        const isMockPreset = (w.name === 'Ana Sofía Rivas' && w.primaryFocus === 'Idempotencia & APIs') ||
                             (w.name === 'Rodrigo Alarcón' && w.primaryFocus === 'Observabilidad & Cloud') ||
                             (w.name === 'Laura Cárdenas' && w.primaryFocus === 'Checkout & UX');
        return !isMockPreset;
      });

      return {
        ...r,
        pendingTopics: cleanedPendingTopics,
        participantWorkloads: cleanedWorkloads,
      };
    });
  } catch (e) {
    return [];
  }
}

export function saveMonthlyReport(report: MonthlyReport): void {
  try {
    const reports = loadMonthlyReports();
    const index = reports.findIndex((r) => r.id === report.id || r.monthYear === report.monthYear);
    if (index >= 0) {
      reports[index] = report;
    } else {
      reports.unshift(report);
    }
    localStorage.setItem(STORAGE_KEYS.MONTHLY_REPORTS, JSON.stringify(reports));
  } catch (e) {
    console.error('Error saving monthly report:', e);
  }
}

export function deleteMonthlyReport(monthYearOrId: string): void {
  try {
    const reports = loadMonthlyReports();
    const updated = reports.filter((r) => r.id !== monthYearOrId && r.monthYear !== monthYearOrId);
    localStorage.setItem(STORAGE_KEYS.MONTHLY_REPORTS, JSON.stringify(updated));
  } catch (e) {
    console.error('Error deleting monthly report:', e);
  }
}

export function loadCustomAiModels(): AIModelOption[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_AI_MODELS);
    if (!raw) return [];
    const models: AIModelOption[] = JSON.parse(raw);
    return models.map((m) => ({ ...m, isCustom: true }));
  } catch (e) {
    console.error('Error loading custom AI models:', e);
    return [];
  }
}

export function saveCustomAiModel(model: AIModelOption): AIModelOption[] {
  try {
    const existing = loadCustomAiModels();
    const cleanModel: AIModelOption = {
      ...model,
      id: model.id.trim(),
      name: model.name?.trim() || model.id.trim(),
      provider: model.provider,
      description: model.description || `Modelo personalizado para ${model.provider.toUpperCase()}`,
      speed: model.speed || 'equilibrado',
      badge: 'Personalizado',
      isCustom: true,
    };
    const updated = [
      ...existing.filter((m) => !(m.id === cleanModel.id && m.provider === cleanModel.provider)),
      cleanModel,
    ];
    localStorage.setItem(STORAGE_KEYS.CUSTOM_AI_MODELS, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Error saving custom AI model:', e);
    return loadCustomAiModels();
  }
}

export function deleteCustomAiModel(modelId: string, provider?: string): AIModelOption[] {
  try {
    const existing = loadCustomAiModels();
    const updated = existing.filter((m) => {
      if (provider) {
        return !(m.id === modelId && m.provider === provider);
      }
      return m.id !== modelId;
    });
    localStorage.setItem(STORAGE_KEYS.CUSTOM_AI_MODELS, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Error deleting custom AI model:', e);
    return loadCustomAiModels();
  }
}

export async function fetchFactoryAiModels(): Promise<{ factoryModels: AIModelOption[]; defaults: Record<string, string> }> {
  try {
    const res = await fetch('/api/ai/models');
    if (!res.ok) throw new Error('Failed to fetch factory models');
    return await res.json();
  } catch (e) {
    console.warn('Using local fallback for factory models:', e);
    return {
      factoryModels: AVAILABLE_AI_MODELS,
      defaults: {
        claude: 'claude-3-7-sonnet-20250219',
        openai: 'gpt-4o',
        copilot: 'copilot-gpt-4o',
        gemini: 'gemini-2.5-flash',
      },
    };
  }
}


