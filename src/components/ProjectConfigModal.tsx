import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Database,
  Layers,
  Users,
  Sliders,
  Plus,
  Trash2,
  Check,
  Tag,
  Hash,
  AlertTriangle,
  Info,
  Server,
  BookOpen,
  UserCheck,
  Bot,
  Sparkles,
  Cpu,
  Key,
  Eye,
  EyeOff,
  Zap
} from 'lucide-react';
import { ProjectSettings, JiraConfig, JiraUser, IssueType, AIProvider, AIProviderConfig, AIModelOption } from '../types';
import {
  AVAILABLE_AI_MODELS,
  DEFAULT_AI_CONFIG,
  loadCustomAiModels,
  saveCustomAiModel,
  deleteCustomAiModel,
  fetchFactoryAiModels
} from '../utils/storage';
import { CivicaIsotype } from './CivicaLogo';
import { JiraUserAutocomplete } from './JiraUserAutocomplete';
import { AiErrorModal, AiErrorInfo } from './AiErrorModal';

interface ProjectConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProjectSettings;
  onSave: (newSettings: ProjectSettings) => void;
}

type ConfigTab = 'storyPoints' | 'categories' | 'jiraUsers' | 'jiraConnection' | 'aiProviders';

export const ProjectConfigModal: React.FC<ProjectConfigModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<ConfigTab>('storyPoints');

  // Story Points & Capacity Form State
  const [pointsScale, setPointsScale] = useState<number[]>([...settings.storyPointsScale]);
  const [newPointInput, setNewPointInput] = useState<string>('');
  const [defaultPoints, setDefaultPoints] = useState<number>(settings.defaultStoryPoints);
  const [sprintCapacity, setSprintCapacity] = useState<number>(settings.sprintCapacityPerMember);
  const [enableCapacityAlerts, setEnableCapacityAlerts] = useState<boolean>(settings.enableCapacityAlerts);

  // Categories Form State
  const [categories, setCategories] = useState<string[]>([...settings.topicCategories]);
  const [newCategoryInput, setNewCategoryInput] = useState<string>('');

  // Jira Users State
  const [jiraUsers, setJiraUsers] = useState<JiraUser[]>([...settings.jiraUsers]);
  const [showAddUserForm, setShowAddUserForm] = useState<boolean>(false);
  const [newUserForm, setNewUserForm] = useState({
    displayName: '',
    emailAddress: '',
    role: 'Desarrollador / Ingeniero',
    capacityLimit: 8,
    accountId: '', // set only when the user was picked from the Jira autocomplete
    avatarUrl: '',
  });

  // Jira Connection State
  const [jiraDomain, setJiraDomain] = useState(settings.jira.domain);
  const [jiraProjectKey, setJiraProjectKey] = useState(settings.jira.projectKey);
  const [jiraBoardName, setJiraBoardName] = useState(settings.jira.boardName);
  const [jiraUserEmail, setJiraUserEmail] = useState(settings.jira.userEmail);
  const [jiraApiToken, setJiraApiToken] = useState(settings.jira.apiToken);
  const [simulationMode, setSimulationMode] = useState(settings.jira.simulationMode);
  const [confluenceSpace, setConfluenceSpace] = useState(settings.jira.confluenceSpace || '');
  const [includeBacklog, setIncludeBacklog] = useState(settings.jira.includeBacklog !== false);
  const [recentClosedDays, setRecentClosedDays] = useState<number>(
    typeof settings.jira.recentClosedDays === 'number' ? settings.jira.recentClosedDays : 14
  );
  const [maxBoardTicketsForAI, setMaxBoardTicketsForAI] = useState<number>(settings.jira.maxBoardTicketsForAI || 150);
  const [filterLabelsOrComponents, setFilterLabelsOrComponents] = useState<string>(settings.jira.filterLabelsOrComponents || '');
  const [excludeIssueTypes, setExcludeIssueTypes] = useState<string>(
    (settings.jira.excludeIssueTypes || ['Epic']).join(', ')
  );
  const [customJql, setCustomJql] = useState<string>(settings.jira.customJql || '');

  // AI Providers & Models State
  const initialAi = settings.ai || DEFAULT_AI_CONFIG;
  const [activeAiProvider, setActiveAiProvider] = useState<AIProvider>(initialAi.activeProvider || 'claude');
  const [selectedAiModel, setSelectedAiModel] = useState<string>(initialAi.selectedModel || 'claude-3-7-sonnet-20250219');
  const [anthropicApiKey, setAnthropicApiKey] = useState<string>(initialAi.anthropicApiKey || '');
  const [openAiApiKey, setOpenAiApiKey] = useState<string>(initialAi.openAiApiKey || '');
  const [azureApiKey, setAzureApiKey] = useState<string>(initialAi.azureApiKey || '');
  const [azureEndpoint, setAzureEndpoint] = useState<string>(initialAi.azureEndpoint || '');
  const [azureDeploymentName, setAzureDeploymentName] = useState<string>(initialAi.azureDeploymentName || 'gpt-4o');
  const [azureApiVersion, setAzureApiVersion] = useState<string>(initialAi.azureApiVersion || '2024-08-01-preview');
  const [geminiApiKey, setGeminiApiKey] = useState<string>(initialAi.geminiApiKey || '');

  // Factory and Custom AI Models
  const [factoryAiModels, setFactoryAiModels] = useState<AIModelOption[]>(AVAILABLE_AI_MODELS);
  const [customAiModels, setCustomAiModels] = useState<AIModelOption[]>(() => loadCustomAiModels());

  // AI Error Popup Dialog
  const [aiErrorDialog, setAiErrorDialog] = useState<AiErrorInfo | null>(null);

  // Load factory models from .env endpoint and listen for custom models updates
  useEffect(() => {
    let isMounted = true;
    fetchFactoryAiModels().then(({ factoryModels }) => {
      if (isMounted && factoryModels && factoryModels.length > 0) {
        setFactoryAiModels(factoryModels);
      }
    });

    const handleCustomModelsUpdate = () => {
      setCustomAiModels(loadCustomAiModels());
    };
    window.addEventListener('teams2jira_custom_models_updated', handleCustomModelsUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('teams2jira_custom_models_updated', handleCustomModelsUpdate);
    };
  }, []);

  // Custom Model Tracking
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);
  const [customModelName, setCustomModelName] = useState<string>('');
  const [isSavingCustomModel, setIsSavingCustomModel] = useState<boolean>(false);

  // AI Test Connection State
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{
    success?: boolean;
    provider?: string;
    model?: string;
    latencyMs?: number;
    message?: string;
    error?: string;
  } | null>(null);
  const [showKeyPassword, setShowKeyPassword] = useState(false);


  // Test connection state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected?: boolean;
    mode?: string;
    message?: string;
    error?: string;
    user?: string;
  } | null>(null);

  // Status toast
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Handlers for Story Points Scale
  const handleAddStoryPoint = () => {
    const val = parseInt(newPointInput.trim(), 10);
    if (!isNaN(val) && val > 0 && !pointsScale.includes(val)) {
      const updated = [...pointsScale, val].sort((a, b) => a - b);
      setPointsScale(updated);
      setNewPointInput('');
    }
  };

  const handleRemoveStoryPoint = (pt: number) => {
    if (pointsScale.length <= 1) return;
    const updated = pointsScale.filter((p) => p !== pt);
    setPointsScale(updated);
    if (defaultPoints === pt) {
      setDefaultPoints(updated[0]);
    }
  };

  // Handlers for Categories
  const handleAddCategory = () => {
    const cat = newCategoryInput.trim();
    if (cat && !categories.includes(cat)) {
      setCategories([...categories, cat]);
      setNewCategoryInput('');
    }
  };

  const handleRemoveCategory = (cat: string) => {
    if (categories.length <= 1) return;
    setCategories(categories.filter((c) => c !== cat));
  };

  // Handlers for Jira Users
  const handleCreateJiraUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.displayName.trim()) return;
    // Email is mandatory only for manual entries; Jira may hide it for picked users
    if (!newUserForm.accountId && !newUserForm.emailAddress.trim()) return;

    if (newUserForm.accountId && jiraUsers.some((u) => u.accountId === newUserForm.accountId)) {
      return;
    }

    const newUser: JiraUser = {
      accountId: newUserForm.accountId || 'jira-usr-' + Date.now(),
      displayName: newUserForm.displayName.trim(),
      emailAddress: newUserForm.emailAddress.trim(),
      avatarUrl: newUserForm.avatarUrl || undefined,
      role: newUserForm.role.trim(),
      capacityLimit: newUserForm.capacityLimit || sprintCapacity,
      active: true,
    };

    setJiraUsers([newUser, ...jiraUsers]);
    setShowAddUserForm(false);
    setNewUserForm({
      displayName: '',
      emailAddress: '',
      role: 'Desarrollador / Ingeniero',
      capacityLimit: sprintCapacity,
      accountId: '',
      avatarUrl: '',
    });
  };

  const handleRemoveJiraUser = (accountId: string) => {
    if (jiraUsers.length <= 1) return;
    setJiraUsers(jiraUsers.filter((u) => u.accountId !== accountId));
  };

  // Test Jira Connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/jira/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: jiraDomain.trim(),
          projectKey: jiraProjectKey.trim().toUpperCase(),
          userEmail: jiraUserEmail.trim(),
          apiToken: jiraApiToken.trim(),
          simulationMode,
        }),
      });
      const data = await response.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        connected: false,
        error: err.message || 'No se pudo conectar con el servidor.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Test AI Model Connection
  const handleTestAiConnection = async () => {
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      const activeKey =
        activeAiProvider === 'claude'
          ? anthropicApiKey.trim()
          : activeAiProvider === 'openai'
          ? openAiApiKey.trim()
          : activeAiProvider === 'copilot'
          ? azureApiKey.trim()
          : geminiApiKey.trim();

      const effectiveModel = isCustomModel
        ? (customModelName.trim() || selectedAiModel || 'claude-3-7-sonnet-20250219')
        : selectedAiModel;

      const response = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeAiProvider,
          model: effectiveModel,
          apiKey: activeKey,
          azureEndpoint: azureEndpoint.trim(),
          azureDeploymentName: azureDeploymentName.trim() || 'gpt-4o',
          azureApiVersion: azureApiVersion.trim() || '2024-08-01-preview',
        }),
      });
      const data = await response.json();
      setAiTestResult(data);
    } catch (err: any) {
      setAiTestResult({
        success: false,
        error: err.message || 'No se pudo contactar al servidor para probar el modelo.',
      });
    } finally {
      setIsTestingAi(false);
    }
  };

  // Test and Save Custom AI Model
  const handleSaveAndTestCustomModel = async () => {
    const modelTechnicalName = customModelName.trim();
    if (!modelTechnicalName) {
      setAiErrorDialog({
        title: 'Nombre Técnico Requerido',
        provider: activeAiProvider,
        message: 'Por favor introduce el identificador técnico del modelo (ej: gemini-3.1-flash-lite, gpt-4.5-preview) antes de probar y guardarlo.',
      });
      return;
    }

    setIsSavingCustomModel(true);
    setAiTestResult(null);

    try {
      const activeKey =
        activeAiProvider === 'claude'
          ? anthropicApiKey.trim()
          : activeAiProvider === 'openai'
          ? openAiApiKey.trim()
          : activeAiProvider === 'copilot'
          ? azureApiKey.trim()
          : geminiApiKey.trim();

      const response = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeAiProvider,
          model: modelTechnicalName,
          apiKey: activeKey,
          azureEndpoint: azureEndpoint.trim(),
          azureDeploymentName: azureDeploymentName.trim() || 'gpt-4o',
          azureApiVersion: azureApiVersion.trim() || '2024-08-01-preview',
        }),
      });

      const data = await response.json();

      if (!data.success) {
        // Show error popup modal
        const statusMatch = data.error?.match(/\((\d{3})\)/);
        const parsedStatus = statusMatch ? parseInt(statusMatch[1], 10) : (data.status || null);
        setAiErrorDialog({
          title: `Fallo de Conexión: ${modelTechnicalName}`,
          provider: activeAiProvider,
          model: modelTechnicalName,
          status: parsedStatus,
          message: data.error || 'El proveedor de IA rechazó la conexión con este modelo. Revisa el nombre técnico y credenciales.',
        });
        return;
      }

      // Success: Save custom model permanently
      const updatedList = saveCustomAiModel({
        id: modelTechnicalName,
        name: modelTechnicalName,
        provider: activeAiProvider,
        description: `Modelo personalizado validado (${data.latencyMs}ms)`,
        speed: 'equilibrado',
      });
      setCustomAiModels(updatedList);
      setSelectedAiModel(modelTechnicalName);
      setIsCustomModel(false);
      setCustomModelName('');
      setAiTestResult(data);
      window.dispatchEvent(new Event('teams2jira_custom_models_updated'));
    } catch (err: any) {
      setAiErrorDialog({
        title: 'Error de Red al Validar Modelo',
        provider: activeAiProvider,
        model: modelTechnicalName,
        message: err.message || 'No se pudo contactar con el servidor local para probar el modelo.',
      });
    } finally {
      setIsSavingCustomModel(false);
    }
  };

  // Delete Custom AI Model
  const handleDeleteCustomModel = (modelId: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el modelo personalizado '${modelId}'?`)) {
      return;
    }
    const updated = deleteCustomAiModel(modelId, activeAiProvider);
    setCustomAiModels(updated);
    window.dispatchEvent(new Event('teams2jira_custom_models_updated'));
    if (selectedAiModel === modelId) {
      const fallback = factoryAiModels.find((m) => m.provider === activeAiProvider);
      if (fallback) {
        setSelectedAiModel(fallback.id);
      }
    }
  };


  // Save All Settings
  const handleSaveAll = () => {
    const updatedJira: JiraConfig = {
      domain: jiraDomain.trim() || 'civicasoftware.atlassian.net',
      projectKey: jiraProjectKey.trim().toUpperCase() || 'PAY',
      boardName: jiraBoardName.trim() || 'Sprint Board',
      userEmail: jiraUserEmail.trim(),
      apiToken: jiraApiToken.trim(),
      simulationMode,
      defaultIssueType: 'Task',
      confluenceSpace: confluenceSpace.trim().toUpperCase(),
      includeBacklog,
      recentClosedDays: Math.max(0, recentClosedDays),
      maxBoardTicketsForAI: Math.max(10, maxBoardTicketsForAI),
      filterLabelsOrComponents: filterLabelsOrComponents.trim(),
      excludeIssueTypes: excludeIssueTypes.split(',').map((t) => t.trim()).filter(Boolean),
      customJql: customJql.trim(),
    };

    const finalModel = isCustomModel
      ? (customModelName.trim() || selectedAiModel || 'claude-3-7-sonnet-20250219')
      : selectedAiModel;

    const updatedAi: AIProviderConfig = {
      activeProvider: activeAiProvider,
      selectedModel: finalModel,
      anthropicApiKey: anthropicApiKey.trim(),
      openAiApiKey: openAiApiKey.trim(),
      azureApiKey: azureApiKey.trim(),
      azureEndpoint: azureEndpoint.trim(),
      azureDeploymentName: azureDeploymentName.trim() || 'gpt-4o',
      azureApiVersion: azureApiVersion.trim() || '2024-08-01-preview',
      geminiApiKey: geminiApiKey.trim(),
    };

    const updatedSettings: ProjectSettings = {
      storyPointsScale: pointsScale,
      defaultStoryPoints: defaultPoints,
      sprintCapacityPerMember: sprintCapacity,
      enableCapacityAlerts,
      topicCategories: categories,
      jiraUsers,
      jira: updatedJira,
      ai: updatedAi,
    };

    onSave(updatedSettings);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs font-['Montserrat'] animate-in fade-in duration-200">
      <div className="bg-[#1C1E20] border border-[#2E3135] rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#2E3135] flex items-center justify-between bg-gradient-to-r from-[#1E2023] via-[#2A2321] to-[#1E2023]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF5038] to-[#EE880E] flex items-center justify-center text-white shadow-md shadow-[#FF5038]/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white font-['Lato'] flex items-center gap-2">
                Configuración del Proyecto & Jira
              </h2>
              <p className="text-xs text-slate-400">
                Ajusta Story Points, categorías de seguimiento, usuarios Jira y conexión Atlassian
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#25282B] hover:bg-[#2E3236] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-6 pt-3 pb-1 border-b border-[#2E3135] bg-[#161719] overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('storyPoints')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'storyPoints'
                ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-[#222428]'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Story Points & Capacidad</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'categories'
                ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-[#222428]'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Categorías de Temas ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('jiraUsers')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'jiraUsers'
                ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-[#222428]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Usuarios de Jira ({jiraUsers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('jiraConnection')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'jiraConnection'
                ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-[#222428]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Conexión Jira Cloud</span>
          </button>

          <button
            onClick={() => setActiveTab('aiProviders')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'aiProviders'
                ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-[#222428]'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Modelos & Proveedores IA</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300 flex-1">
          {/* TAB 1: STORY POINTS & CAPACITY */}
          {activeTab === 'storyPoints' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Story Points Scale */}
              <div className="bg-[#141517] border border-[#2A2C2F] rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white font-['Lato'] text-sm flex items-center gap-2">
                      <Hash className="w-4 h-4 text-[#EE880E]" />
                      Escala de Estimación de Story Points
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Puntajes permitidos para las tareas asignadas por la IA a los participantes de la reunión.
                    </p>
                  </div>
                </div>

                {/* Points pills */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {pointsScale.map((pt) => (
                    <span
                      key={pt}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1E20] border border-[#3E4247] text-white font-mono font-bold text-xs"
                    >
                      <span className="text-[#EE880E]">{pt} pts</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStoryPoint(pt)}
                        className="text-slate-500 hover:text-rose-400 p-0.5"
                        title="Eliminar este puntaje"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add new point */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#2A2C2F]">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="Nuevo valor (ej: 13)..."
                    value={newPointInput}
                    onChange={(e) => setNewPointInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddStoryPoint())}
                    className="w-40 bg-[#1C1E20] border border-[#3E4247] rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[#FF5038]"
                  />
                  <button
                    type="button"
                    onClick={handleAddStoryPoint}
                    className="px-3 py-1.5 bg-[#25282B] hover:bg-[#2E3236] text-slate-200 border border-[#3E4247] rounded-xl text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-[#FF5038]" />
                    <span>Añadir Puntaje</span>
                  </button>
                </div>
              </div>

              {/* Default Points & Sprint Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#141517] border border-[#2A2C2F] rounded-2xl p-4.5 space-y-2">
                  <label className="font-bold text-white block font-['Lato'] text-xs">
                    Story Points por Defecto
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Valor asignado a tareas cuando no se especifique una estimación.
                  </p>
                  <select
                    value={defaultPoints}
                    onChange={(e) => setDefaultPoints(parseInt(e.target.value, 10))}
                    className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-xl p-2.5 text-xs text-white mt-1"
                  >
                    {pointsScale.map((pt) => (
                      <option key={pt} value={pt}>
                        {pt} Story Points
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-[#141517] border border-[#2A2C2F] rounded-2xl p-4.5 space-y-2">
                  <label className="font-bold text-white block font-['Lato'] text-xs">
                    Capacidad Recomendada por Miembro
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Límite máximo recomendado por sprint (ej: 8 pts) antes de alertar sobrecarga.
                  </p>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    value={sprintCapacity}
                    onChange={(e) => setSprintCapacity(parseInt(e.target.value, 10) || 8)}
                    className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-xl p-2.5 text-xs text-white mt-1"
                  />
                </div>
              </div>

              {/* Burnout alert switch */}
              <div className="bg-[#141517] border border-[#2A2C2F] rounded-2xl p-4.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block font-['Lato'] text-xs">
                    Alertas de Sobrecarga de Trabajo (Sprint Velocity Alert)
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Muestra advertencias constructivas si un participante supera el límite de puntos asignados.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={enableCapacityAlerts}
                  onChange={(e) => setEnableCapacityAlerts(e.target.checked)}
                  className="w-4 h-4 accent-[#FF5038] cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 2: TOPIC CATEGORIES */}
          {activeTab === 'categories' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#141517] border border-[#2A2C2F] rounded-2xl p-4.5 space-y-3">
                <div>
                  <h3 className="font-bold text-white font-['Lato'] text-sm flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[#FF5038]" />
                    Categorías de Creación de Tema de Seguimiento
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Estas categorías aparecen en el desplegable al registrar nuevos temas en el Histórico de Temas.
                  </p>
                </div>

                {/* Add new category input */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Nueva categoría (ej: Inteligencia Artificial & MLOps)..."
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                    className="flex-1 bg-[#1C1E20] border border-[#3E4247] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[#FF5038]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-3.5 py-2 bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs font-['Lato']"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Categoría</span>
                  </button>
                </div>

                {/* Categories List */}
                <div className="space-y-2 pt-3 border-t border-[#2A2C2F]">
                  {categories.map((cat, idx) => (
                    <div
                      key={cat}
                      className="bg-[#1C1E20] border border-[#2A2C2F] rounded-xl p-3 flex items-center justify-between hover:border-[#3E4247] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-[#25282B] text-slate-400 flex items-center justify-center font-mono text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-white text-xs">{cat}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(cat)}
                        disabled={categories.length <= 1}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-[#25282B] transition-colors disabled:opacity-30"
                        title="Eliminar categoría"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REAL JIRA USERS */}
          {activeTab === 'jiraUsers' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#141517] border border-[#2A2C2F] rounded-2xl p-4.5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white font-['Lato'] text-sm flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#61BFED]" />
                      Usuarios Reales de Jira del Equipo
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Estos usuarios son los que aparecen en el desplegable de &ldquo;Responsable Principal&rdquo; al dar de alta nuevos temas.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddUserForm(!showAddUserForm)}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:opacity-90 text-white rounded-xl text-xs font-bold flex items-center gap-1 font-['Lato'] shadow-xs cursor-pointer transition-opacity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nuevo Usuario</span>
                    </button>
                  </div>
                </div>

                {/* Add User Form Drawer */}
                {showAddUserForm && (
                  <form
                    onSubmit={handleCreateJiraUser}
                    className="bg-[#1C1E20] border border-[#FF5038]/40 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150"
                  >
                    <h4 className="font-bold text-white text-xs font-['Lato']">
                      Dar de Alta Nuevo Usuario de Jira
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-400 text-[11px] block mb-1">
                          Nombre Completo
                          {newUserForm.accountId && (
                            <span className="ml-2 text-[#29E78C] font-semibold">✓ Usuario de Jira vinculado</span>
                          )}
                        </label>
                        <JiraUserAutocomplete
                          value={newUserForm.displayName}
                          // Typing again drops the link to a previously picked Jira user
                          onChange={(text) =>
                            setNewUserForm({ ...newUserForm, displayName: text, accountId: '', avatarUrl: '' })
                          }
                          onSelect={(u) =>
                            setNewUserForm({
                              ...newUserForm,
                              displayName: u.displayName,
                              emailAddress: u.emailAddress || '',
                              accountId: u.accountId,
                              avatarUrl: u.avatarUrl || '',
                            })
                          }
                          jiraConnection={{
                            domain: jiraDomain,
                            userEmail: jiraUserEmail,
                            apiToken: jiraApiToken,
                            projectKey: jiraProjectKey,
                            simulationMode,
                          }}
                          excludeAccountIds={jiraUsers.map((u) => u.accountId)}
                          placeholder="Escribe para buscar en Jira (ej: Javi...)"
                          className="w-full bg-[#141517] border border-[#3E4247] rounded-xl p-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-[11px] block mb-1">Correo Electrónico Jira</label>
                        <input
                          type="email"
                          required={!newUserForm.accountId}
                          placeholder="javier.dominguez@civicasoftware.com"
                          value={newUserForm.emailAddress}
                          onChange={(e) => setNewUserForm({ ...newUserForm, emailAddress: e.target.value })}
                          className="w-full bg-[#141517] border border-[#3E4247] rounded-xl p-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-[11px] block mb-1">Rol Técnico</label>
                        <input
                          type="text"
                          placeholder="QA & Automation Engineer"
                          value={newUserForm.role}
                          onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                          className="w-full bg-[#141517] border border-[#3E4247] rounded-xl p-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-[11px] block mb-1">Capacidad Máxima (pts)</label>
                        <input
                          type="number"
                          min="1"
                          max="40"
                          value={newUserForm.capacityLimit}
                          onChange={(e) => setNewUserForm({ ...newUserForm, capacityLimit: parseInt(e.target.value, 10) || 8 })}
                          className="w-full bg-[#141517] border border-[#3E4247] rounded-xl p-2 text-xs text-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddUserForm(false)}
                        className="px-3 py-1.5 text-slate-400 hover:text-white text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white rounded-xl text-xs font-bold"
                      >
                        Guardar Usuario Jira
                      </button>
                    </div>
                  </form>
                )}

                {/* Users List */}
                <div className="space-y-2">
                  {jiraUsers.map((user) => (
                    <div
                      key={user.accountId}
                      className="bg-[#1C1E20] border border-[#2A2C2F] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#3E4247] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF5038] to-[#EE880E] flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {user.displayName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{user.displayName}</span>
                            <span className="text-[10px] bg-[#61BFED]/15 text-[#61BFED] border border-[#61BFED]/30 px-1.5 py-0.2 rounded-md font-mono">
                              Jira User
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            <span>{user.emailAddress}</span>
                            <span>&bull;</span>
                            <span className="text-slate-300">{user.role || 'Ingeniero'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-[11px] text-slate-400 font-mono bg-[#141517] px-2 py-0.5 rounded-md border border-[#2A2C2F]">
                          Capacidad: {user.capacityLimit || 8} pts
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveJiraUser(user.accountId)}
                          disabled={jiraUsers.length <= 1}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-[#25282B] transition-colors disabled:opacity-30"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: JIRA CONNECTION & ATLASSIAN CONFIG */}
          {activeTab === 'jiraConnection' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Simulation Mode Toggle Card */}
              <div className="bg-[#141517] border border-[#2A2C2F] rounded-2xl p-4.5 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#EE880E]" />
                    <span className="font-bold text-white font-['Lato'] text-xs">
                      Modo Simulación Inteligente Atlassian
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        simulationMode
                          ? 'bg-[#61BFED]/20 text-[#61BFED] border-[#61BFED]/30'
                          : 'bg-[#29E78C]/20 text-[#29E78C] border-[#29E78C]/30'
                      }`}
                    >
                      {simulationMode ? 'Modo Simulado' : 'Jira Cloud en Vivo'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Si está activo, crea tickets simulados idénticos a Jira Cloud con enlaces directos, claves de ticket y trazabilidad completa. Desactívalo para conectar tu instancia real de Atlassian.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={simulationMode}
                    onChange={(e) => setSimulationMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#25282B] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#FF5038] peer-checked:to-[#EE880E]"></div>
                </label>
              </div>

              {/* Form Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-medium mb-1 text-[11px]">
                    Dominio Atlassian Jira Cloud
                  </label>
                  <input
                    type="text"
                    value={jiraDomain}
                    onChange={(e) => setJiraDomain(e.target.value)}
                    placeholder="civicasoftware.atlassian.net"
                    className="w-full bg-[#141517] border border-[#3E4247] rounded-xl p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1 text-[11px]">
                    Clave del Proyecto (Project Key)
                  </label>
                  <input
                    type="text"
                    value={jiraProjectKey}
                    onChange={(e) => setJiraProjectKey(e.target.value.toUpperCase())}
                    placeholder="PAY"
                    className="w-full bg-[#141517] border border-[#3E4247] rounded-xl p-2.5 text-xs text-white font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1 text-[11px]">
                    Nombre del Tablero / Tableros del Proyecto
                  </label>
                  <input
                    type="text"
                    value={jiraBoardName}
                    onChange={(e) => setJiraBoardName(e.target.value)}
                    placeholder="Sprint 42 Scrum Board"
                    className="w-full bg-[#141517] border border-[#3E4247] rounded-xl p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1 text-[11px]">
                    Espacio de Confluence (Opcional)
                  </label>
                  <input
                    type="text"
                    value={confluenceSpace}
                    onChange={(e) => setConfluenceSpace(e.target.value.toUpperCase())}
                    placeholder="Ej: PROJ (Opcional, dejar vacío si no se usa)"
                    className="w-full bg-[#141517] border border-[#3E4247] rounded-xl p-2.5 text-xs text-white font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1 text-[11px]">
                    Correo de Usuario Atlassian
                  </label>
                  <input
                    type="email"
                    value={jiraUserEmail}
                    onChange={(e) => setJiraUserEmail(e.target.value)}
                    placeholder="dev.lead@civicasoftware.com"
                    className="w-full bg-[#141517] border border-[#3E4247] rounded-xl p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1 text-[11px] flex items-center justify-between">
                    <span>Atlassian API Token</span>
                    <a
                      href="https://id.atlassian.com/manage-profile/security/api-tokens"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#FF5038] hover:underline flex items-center gap-1"
                    >
                      Generar Token <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </label>
                  <input
                    type="password"
                    value={jiraApiToken}
                    onChange={(e) => setJiraApiToken(e.target.value)}
                    placeholder={simulationMode ? 'No requerido en Modo Simulado' : '••••••••••••••••'}
                    className="w-full bg-[#141517] border border-[#3E4247] rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              {/* Sub-section: Board & Backlog Search Settings for Task Matching */}
              <div className="bg-[#141517] border border-[#2A2C2F] rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-[#2A2C2F] pb-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-white font-['Lato'] flex items-center gap-2">
                      <span>🔍 Detección de Tareas en Tablero & Backlog</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Permite a la IA revisar las tareas existentes en Jira para distinguir tareas en curso de tareas nuevas y sugerir comentarios.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Include Backlog toggle */}
                  <div className="flex items-start gap-2.5 bg-[#1C1E20] p-3 rounded-xl border border-[#2E3135]">
                    <input
                      type="checkbox"
                      id="includeBacklog"
                      checked={includeBacklog}
                      onChange={(e) => setIncludeBacklog(e.target.checked)}
                      className="mt-0.5 rounded text-[#FF5038] focus:ring-0 bg-[#141517] border-[#3E4247] cursor-pointer"
                    />
                    <label htmlFor="includeBacklog" className="cursor-pointer">
                      <span className="text-xs font-semibold text-white block">Incluir tickets del Backlog</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Si está marcado, busca tanto en el sprint activo como en el backlog abierto.
                      </span>
                    </label>
                  </div>

                  {/* Recent Closed Days */}
                  <div className="bg-[#1C1E20] p-3 rounded-xl border border-[#2E3135]">
                    <label className="text-xs font-semibold text-white block mb-1">
                      Días de cerrados recientes
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={recentClosedDays}
                      onChange={(e) => setRecentClosedDays(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-[#141517] border border-[#3E4247] rounded-lg p-2 text-xs text-white"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Detecta tareas completadas en los últimos N días para alertar de duplicados (0 = ignorar cerrados).
                    </span>
                  </div>

                  {/* Max Tickets to AI */}
                  <div className="bg-[#1C1E20] p-3 rounded-xl border border-[#2E3135]">
                    <label className="text-xs font-semibold text-white block mb-1">
                      Máximo de tickets enviados a la IA
                    </label>
                    <input
                      type="number"
                      min="20"
                      max="300"
                      value={maxBoardTicketsForAI}
                      onChange={(e) => setMaxBoardTicketsForAI(parseInt(e.target.value, 10) || 150)}
                      className="w-full bg-[#141517] border border-[#3E4247] rounded-lg p-2 text-xs text-white"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Límite superior de candidatos analizados tras el filtrado léxico de relevancia.
                    </span>
                  </div>

                  {/* Exclude Issue Types */}
                  <div className="bg-[#1C1E20] p-3 rounded-xl border border-[#2E3135]">
                    <label className="text-xs font-semibold text-white block mb-1">
                      Excluir tipos de issue
                    </label>
                    <input
                      type="text"
                      value={excludeIssueTypes}
                      onChange={(e) => setExcludeIssueTypes(e.target.value)}
                      placeholder="Epic, Sub-task"
                      className="w-full bg-[#141517] border border-[#3E4247] rounded-lg p-2 text-xs text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Separados por comas. Por defecto se excluye Epic.
                    </span>
                  </div>

                  {/* Labels or Components Filter */}
                  <div className="bg-[#1C1E20] p-3 rounded-xl border border-[#2E3135] sm:col-span-2">
                    <label className="text-xs font-semibold text-white block mb-1">
                      Filtrar por etiquetas o componentes (Opcional)
                    </label>
                    <input
                      type="text"
                      value={filterLabelsOrComponents}
                      onChange={(e) => setFilterLabelsOrComponents(e.target.value)}
                      placeholder="Ej: Data, Atribución, CRMV2"
                      className="w-full bg-[#141517] border border-[#3E4247] rounded-lg p-2 text-xs text-white"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Limita la búsqueda a issues que contengan cualquiera de estos componentes o etiquetas.
                    </span>
                  </div>

                  {/* Custom JQL */}
                  <div className="bg-[#1C1E20] p-3 rounded-xl border border-[#2E3135] sm:col-span-2">
                    <label className="text-xs font-semibold text-white block mb-1">
                      Filtro JQL avanzado libre (Opcional)
                    </label>
                    <input
                      type="text"
                      value={customJql}
                      onChange={(e) => setCustomJql(e.target.value)}
                      placeholder="Ej: component in ('Airflow', 'BigQuery') AND priority in (High, Highest)"
                      className="w-full bg-[#141517] border border-[#3E4247] rounded-lg p-2 text-xs text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Cláusula JQL personalizada que se agregará con AND a la consulta del tablero.
                    </span>
                  </div>
                </div>
              </div>

              {/* Test Connection Button & Result */}
              <div className="bg-[#141517] border border-[#2A2C2F] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs">
                  {testResult ? (
                    testResult.connected ? (
                      <span className="text-[#29E78C] font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{testResult.message}</span>
                      </span>
                    ) : (
                      <span className="text-rose-400 font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{testResult.error}</span>
                      </span>
                    )
                  ) : (
                    <span className="text-slate-400">Verifica la conexión antes de guardar</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-4 py-2 bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 shadow-md shadow-[#FF5038]/20"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Comprobando Jira...' : 'Probar Conexión Jira'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: AI PROVIDERS & MODEL SELECTION */}
          {activeTab === 'aiProviders' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Header Description */}
              <div className="bg-[#141517] border border-[#2A2C2F] rounded-2xl p-4.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#EE880E]" />
                    <h3 className="font-bold text-white font-['Lato'] text-sm">
                      Configuración de Motor de Inteligencia Artificial
                    </h3>
                  </div>
                  <span className="text-[10px] bg-[#FF5038]/15 border border-[#FF5038]/30 text-[#FF5038] px-2 py-0.5 rounded-full font-bold">
                    Multi-Provider
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Elige qué proveedor de IA procesará las transcripciones de Microsoft Teams y generará los tickets de Jira.
                  Puedes configurar tus API Keys directamente aquí o a través de variables de entorno (.env).
                </p>
              </div>

              {/* Provider Selection Tabs */}
              <div className="bg-[#141517] border border-[#2A2C2F] rounded-2xl p-4.5 space-y-3">
                <label className="font-bold text-white block font-['Lato'] text-xs">
                  Proveedor de IA Activo
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'claude', name: 'Anthropic Claude', badge: 'Recomendado', sub: 'Claude 3.7 / 3.5' },
                    { id: 'openai', name: 'OpenAI', badge: 'Popular', sub: 'GPT-4o / o3-mini' },
                    { id: 'copilot', name: 'MS Copilot', badge: 'Azure', sub: 'Empresarial' },
                    { id: 'gemini', name: 'Google Gemini', badge: 'AI Studio', sub: '2.5 Flash / Pro' },
                  ].map((prov) => {
                    const isSelected = activeAiProvider === prov.id;
                    return (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => {
                          setActiveAiProvider(prov.id as AIProvider);
                          setIsCustomModel(false);
                          setCustomModelName('');
                          const defaultForProv = factoryAiModels.find((m) => m.provider === prov.id) || AVAILABLE_AI_MODELS.find((m) => m.provider === prov.id);
                          if (defaultForProv) setSelectedAiModel(defaultForProv.id);
                          setAiTestResult(null);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-br from-[#FF5038]/20 to-[#EE880E]/10 border-[#FF5038] text-white shadow-xs'
                            : 'bg-[#1C1E20] border-[#2A2C2F] text-slate-400 hover:text-white hover:border-[#3E4247]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span>{prov.name}</span>
                          {prov.badge && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded-md ${
                                isSelected ? 'bg-[#FF5038]/30 text-[#FF5038]' : 'bg-[#25282B] text-slate-500'
                              }`}
                            >
                              {prov.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">{prov.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Model Selection for Active Provider */}
              <div className="bg-[#141517] border border-[#2A2C2F] rounded-2xl p-4.5 space-y-3">
                {(() => {
                  const providerFactoryModels = factoryAiModels.filter((m) => m.provider === activeAiProvider);
                  const providerCustomModels = customAiModels.filter((m) => m.provider === activeAiProvider);
                  const totalCount = providerFactoryModels.length + providerCustomModels.length;

                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-white block font-['Lato'] text-xs">
                          Modelo a Utilizar ({activeAiProvider.toUpperCase()})
                        </label>
                        <span className="text-[11px] text-slate-400">
                          {totalCount} modelos disponibles ({providerFactoryModels.length} oficiales, {providerCustomModels.length} personalizados)
                        </span>
                      </div>

                      <select
                        value={isCustomModel ? '__new_custom__' : selectedAiModel}
                        onChange={(e) => {
                          if (e.target.value === '__new_custom__') {
                            setIsCustomModel(true);
                            setCustomModelName('');
                          } else {
                            setIsCustomModel(false);
                            setSelectedAiModel(e.target.value);
                          }
                        }}
                        className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-xl p-2.5 text-xs text-white cursor-pointer focus:outline-hidden focus:border-[#FF5038]"
                      >
                        <optgroup label="Modelos Oficiales (.env / Fábrica)">
                          {providerFactoryModels.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name} — ({model.speed.toUpperCase()}) {model.badge ? `[${model.badge}]` : ''} ({model.id})
                            </option>
                          ))}
                        </optgroup>
                        {providerCustomModels.length > 0 && (
                          <optgroup label="Modelos Personalizados Guardados">
                            {providerCustomModels.map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.id} [Personalizado]
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <option value="__new_custom__">+ Configurar nuevo modelo personalizado...</option>
                      </select>

                      {/* Input for adding new custom model */}
                      {isCustomModel && (
                        <div className="p-3 bg-[#1A1C1F] border border-[#2E3136] rounded-xl space-y-2.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-white block">
                              Nombre técnico del nuevo modelo ({activeAiProvider.toUpperCase()}):
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomModel(false);
                                setCustomModelName('');
                              }}
                              className="text-[10px] text-slate-400 hover:text-white"
                            >
                              Cancelar
                            </button>
                          </div>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <input
                              type="text"
                              autoFocus
                              placeholder={`Ej: ${
                                activeAiProvider === 'claude'
                                  ? 'claude-3-7-sonnet-latest'
                                  : activeAiProvider === 'openai'
                                  ? 'gpt-4.5-preview'
                                  : activeAiProvider === 'copilot'
                                  ? 'copilot-custom'
                                  : 'gemini-3.1-flash-lite'
                              }`}
                              value={customModelName}
                              onChange={(e) => setCustomModelName(e.target.value)}
                              className="flex-1 bg-[#121315] border border-[#3E4247] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-hidden focus:border-[#FF5038]"
                            />
                            <button
                              type="button"
                              onClick={handleSaveAndTestCustomModel}
                              disabled={isSavingCustomModel || !customModelName.trim()}
                              className="px-3.5 py-2 bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#FF5038]/20 cursor-pointer shrink-0"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isSavingCustomModel ? 'animate-spin' : ''}`} />
                              <span>{isSavingCustomModel ? 'Probando y Guardando...' : 'Probar y Guardar'}</span>
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Se verificará la conexión con la API de {activeAiProvider.toUpperCase()}. Si responde correctamente, se guardará y se incluirá en el desplegable. Si falla, se mostrará el error y no se guardará.
                          </p>
                        </div>
                      )}

                      {/* Info Card on Current Selected Model */}
                      {(() => {
                        const customObj = providerCustomModels.find((m) => m.id === selectedAiModel);
                        if (customObj) {
                          return (
                            <div className="bg-[#1C1E20] border border-[#FF5038]/30 rounded-xl p-3 flex items-start justify-between gap-2.5 text-[11px]">
                              <div className="flex items-start gap-2.5">
                                <Cpu className="w-4 h-4 text-[#FF5038] shrink-0 mt-0.5" />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white font-mono">{customObj.id}</span>
                                    <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-[#FF5038]/20 text-[#FF5038] font-bold">
                                      Personalizado Activo
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {customObj.description || `Modelo personalizado para ${activeAiProvider.toUpperCase()}`}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomModel(customObj.id)}
                                title="Eliminar este modelo personalizado"
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        }

                        const modelObj = providerFactoryModels.find((m) => m.id === selectedAiModel) || factoryAiModels.find((m) => m.id === selectedAiModel);
                        if (!modelObj) return null;
                        return (
                          <div className="bg-[#1C1E20] border border-[#2A2C2F] rounded-xl p-3 flex items-start gap-2.5 text-[11px]">
                            <Cpu className="w-4 h-4 text-[#EE880E] shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-white">{modelObj.name}: </span>
                              <span className="text-slate-300">{modelObj.description}</span>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 bg-[#141517] px-2 py-0.5 rounded-md border border-[#2A2C2F]">
                                  Velocidad: {modelObj.speed}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 bg-[#141517] px-2 py-0.5 rounded-md border border-[#2A2C2F]">
                                  ID: {modelObj.id}
                                </span>
                                {modelObj.badge && (
                                  <span className="text-[10px] text-[#FF5038] bg-[#FF5038]/10 px-2 py-0.5 rounded-md font-semibold">
                                    {modelObj.badge}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Saved Custom Models Management List */}
                      {providerCustomModels.length > 0 && (
                        <div className="pt-2 border-t border-[#2A2C2F] space-y-2">
                          <span className="text-[11px] font-semibold text-slate-300 block">
                            Modelos Personalizados Guardados ({activeAiProvider.toUpperCase()}):
                          </span>
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {providerCustomModels.map((m) => (
                              <div
                                key={m.id}
                                className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-colors ${
                                  selectedAiModel === m.id
                                    ? 'bg-[#1C1E20] border-[#FF5038]/40'
                                    : 'bg-[#18191B] border-[#2A2C2F] hover:border-[#3E4247]'
                                }`}
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <Cpu className="w-3.5 h-3.5 text-[#EE880E] shrink-0" />
                                  <span className="font-mono text-white font-medium truncate">{m.id}</span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-[#FF5038]/20 border border-[#FF5038]/30 text-[#FF5038] font-bold shrink-0">
                                    Personalizado
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {selectedAiModel === m.id ? (
                                    <span className="text-[10px] text-[#29E78C] font-semibold flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Seleccionado
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedAiModel(m.id)}
                                      className="text-[10px] text-[#61BFED] hover:underline cursor-pointer"
                                    >
                                      Seleccionar
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCustomModel(m.id)}
                                    title="Eliminar este modelo personalizado"
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Provider Specific Configuration & Keys */}
              <div className="bg-[#141517] border border-[#2A2C2F] rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-xs font-['Lato'] flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-[#FF5038]" />
                    <span>Credenciales & Conectividad ({activeAiProvider.toUpperCase()})</span>
                  </h4>

                  <button
                    type="button"
                    onClick={() => setShowKeyPassword(!showKeyPassword)}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {showKeyPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showKeyPassword ? 'Ocultar' : 'Mostrar'}</span>
                  </button>
                </div>

                {/* Claude Key */}
                {activeAiProvider === 'claude' && (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 flex items-center justify-between">
                      <span>Anthropic API Key (sk-ant-...)</span>
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#FF5038] hover:underline flex items-center gap-0.5"
                      >
                        Obtener en Anthropic Console <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </label>
                    <input
                      type={showKeyPassword ? 'text' : 'password'}
                      placeholder="sk-ant-api03-..."
                      value={anthropicApiKey}
                      onChange={(e) => setAnthropicApiKey(e.target.value)}
                      className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-xl p-2.5 text-xs text-white font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      O puedes definirla en tu archivo <code>.env</code> como <code>ANTHROPIC_API_KEY</code>.
                    </p>
                  </div>
                )}

                {/* OpenAI Key */}
                {activeAiProvider === 'openai' && (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 flex items-center justify-between">
                      <span>OpenAI API Key (sk-...)</span>
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#FF5038] hover:underline flex items-center gap-0.5"
                      >
                        Obtener en OpenAI Platform <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </label>
                    <input
                      type={showKeyPassword ? 'text' : 'password'}
                      placeholder="sk-proj-..."
                      value={openAiApiKey}
                      onChange={(e) => setOpenAiApiKey(e.target.value)}
                      className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-xl p-2.5 text-xs text-white font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      O puedes definirla en tu archivo <code>.env</code> como <code>OPENAI_API_KEY</code>.
                    </p>
                  </div>
                )}

                {/* Microsoft Copilot / Azure OpenAI */}
                {activeAiProvider === 'copilot' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Azure OpenAI Endpoint (URL del Recurso Copilot)
                      </label>
                      <input
                        type="text"
                        placeholder="https://tu-recurso-copilot.openai.azure.com"
                        value={azureEndpoint}
                        onChange={(e) => setAzureEndpoint(e.target.value)}
                        className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-xl p-2.5 text-xs text-white font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          Azure API Key
                        </label>
                        <input
                          type={showKeyPassword ? 'text' : 'password'}
                          placeholder="••••••••••••••••••••••••••••••••"
                          value={azureApiKey}
                          onChange={(e) => setAzureApiKey(e.target.value)}
                          className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-xl p-2.5 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          Deployment Name
                        </label>
                        <input
                          type="text"
                          placeholder="gpt-4o"
                          value={azureDeploymentName}
                          onChange={(e) => setAzureDeploymentName(e.target.value)}
                          className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-xl p-2.5 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      O configúralos en <code>.env</code> con <code>AZURE_OPENAI_ENDPOINT</code>, <code>AZURE_OPENAI_KEY</code> y <code>AZURE_OPENAI_DEPLOYMENT</code>.
                    </p>
                  </div>
                )}

                {/* Gemini Key */}
                {activeAiProvider === 'gemini' && (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 flex items-center justify-between">
                      <span>Google AI Studio Gemini API Key</span>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#FF5038] hover:underline flex items-center gap-0.5"
                      >
                        Obtener en Google AI Studio <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </label>
                    <input
                      type={showKeyPassword ? 'text' : 'password'}
                      placeholder="AIzaSy..."
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-xl p-2.5 text-xs text-white font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      O puedes definirla en tu archivo <code>.env</code> como <code>GEMINI_API_KEY</code>.
                    </p>
                  </div>
                )}

                {/* Test Connection Button & Status */}
                <div className="pt-2 border-t border-[#2A2C2F] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs">
                    {aiTestResult ? (
                      aiTestResult.success ? (
                        <span className="text-[#29E78C] font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{aiTestResult.message}</span>
                        </span>
                      ) : (
                        <span className="text-rose-400 font-semibold flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span className="truncate max-w-md">{aiTestResult.error}</span>
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400">Verifica que tu API Key y modelo respondan correctamente</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleTestAiConnection}
                    disabled={isTestingAi}
                    className="px-3.5 py-1.5 bg-[#25282B] hover:bg-[#2E3236] text-slate-200 border border-[#3E4247] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#FF5038] ${isTestingAi ? 'animate-spin' : ''}`} />
                    <span>{isTestingAi ? 'Probando modelo...' : `Probar ${activeAiProvider.toUpperCase()}`}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#2E3135] bg-[#161719] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <CivicaIsotype size={18} />
            <span>Configuración activa en ProyectHandler</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition-colors"
            >
              Cancelar
            </button>

            <button
              onClick={handleSaveAll}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white text-xs font-bold font-['Lato'] shadow-md shadow-[#FF5038]/25 transition-all flex items-center gap-1.5"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>¡Guardado!</span>
                </>
              ) : (
                <span>Guardar Configuración</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* AI Error Modal Popup */}
      <AiErrorModal
        isOpen={Boolean(aiErrorDialog)}
        onClose={() => setAiErrorDialog(null)}
        error={aiErrorDialog}
      />
    </div>
  );
};
