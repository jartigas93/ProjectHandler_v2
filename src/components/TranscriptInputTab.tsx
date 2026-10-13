import React, { useState, useEffect } from 'react';
import {
  Upload, Sparkles, Wand2, FileText, CheckCircle2, ChevronRight, HelpCircle,
  Code, RefreshCw, Layers, Radio, Bot, Key, Cpu, Bookmark, Plus, Save, Trash2, Edit2, Check
} from 'lucide-react';
import { PromptMode, JiraConfig, AIProviderConfig, SavedCustomPrompt, AIModelOption } from '../types';
import {
  AVAILABLE_AI_MODELS,
  loadSavedCustomPrompts,
  saveCustomPrompts,
  loadCustomAiModels,
  saveCustomAiModel,
  deleteCustomAiModel,
  fetchFactoryAiModels
} from '../utils/storage';
import { TeamsWebhookCard } from './TeamsWebhookCard';
import { AiErrorModal, AiErrorInfo } from './AiErrorModal';

interface TranscriptInputTabProps {
  transcript: string;
  setTranscript: (text: string) => void;
  meetingTitle: string;
  setMeetingTitle: (title: string) => void;
  meetingDate: string;
  setMeetingDate: (date: string) => void;
  promptMode: PromptMode;
  setPromptMode: (mode: PromptMode) => void;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  jiraConfig: JiraConfig;
  aiConfig: AIProviderConfig;
  onUpdateAiConfig: (cfg: AIProviderConfig) => void;
  onOpenAiSettings: () => void;
  onAnalyze: () => void;
  isLoading: boolean;
}

export const TranscriptInputTab: React.FC<TranscriptInputTabProps> = ({
  transcript,
  setTranscript,
  meetingTitle,
  setMeetingTitle,
  meetingDate,
  setMeetingDate,
  promptMode,
  setPromptMode,
  customPrompt,
  setCustomPrompt,
  jiraConfig,
  aiConfig,
  onUpdateAiConfig,
  onOpenAiSettings,
  onAnalyze,
  isLoading,
}) => {
  const [showWebhookHelper, setShowWebhookHelper] = useState<boolean>(false);

  // Factory and Custom AI Models
  const activeAiProvider = aiConfig?.activeProvider || 'claude';
  const [factoryAiModels, setFactoryAiModels] = useState<AIModelOption[]>(AVAILABLE_AI_MODELS);
  const [customAiModels, setCustomAiModels] = useState<AIModelOption[]>(() => loadCustomAiModels());

  // Error Popup Dialog
  const [aiErrorDialog, setAiErrorDialog] = useState<AiErrorInfo | null>(null);

  // Sync factory models from .env endpoint and listen for custom models updates
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

  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);
  const [customModelName, setCustomModelName] = useState<string>('');
  const [isSavingCustomModel, setIsSavingCustomModel] = useState<boolean>(false);

  // Saved Custom Prompts (up to 3)
  const [savedPrompts, setSavedPrompts] = useState<SavedCustomPrompt[]>(() => loadSavedCustomPrompts());
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(() => {
    const list = loadSavedCustomPrompts();
    return list.length > 0 ? list[0].id : null;
  });
  const [customTitle, setCustomTitle] = useState<string>(() => {
    const list = loadSavedCustomPrompts();
    return list.length > 0 ? list[0].title : '';
  });
  const [statusMsg, setStatusMsg] = useState<string>('');

  // Save and Test Custom AI Model directly from Meeting Processing tab
  const handleSaveAndTestCustomModel = async () => {
    const modelTechnicalName = customModelName.trim();
    if (!modelTechnicalName) {
      setAiErrorDialog({
        title: 'Nombre Técnico Requerido',
        provider: activeAiProvider,
        message: 'Por favor introduce el identificador técnico del modelo antes de probar y guardarlo.',
      });
      return;
    }

    setIsSavingCustomModel(true);

    try {
      const activeKey =
        activeAiProvider === 'claude'
          ? aiConfig?.anthropicApiKey?.trim()
          : activeAiProvider === 'openai'
          ? aiConfig?.openAiApiKey?.trim()
          : activeAiProvider === 'copilot'
          ? aiConfig?.azureApiKey?.trim()
          : aiConfig?.geminiApiKey?.trim();

      const response = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeAiProvider,
          model: modelTechnicalName,
          apiKey: activeKey,
          azureEndpoint: aiConfig?.azureEndpoint?.trim(),
          azureDeploymentName: aiConfig?.azureDeploymentName?.trim() || 'gpt-4o',
          azureApiVersion: aiConfig?.azureApiVersion?.trim() || '2024-08-01-preview',
        }),
      });

      const data = await response.json();

      if (!data.success) {
        const statusMatch = data.error?.match(/\((\d{3})\)/);
        const parsedStatus = statusMatch ? parseInt(statusMatch[1], 10) : (data.status || null);
        setAiErrorDialog({
          title: `Fallo de Conexión: ${modelTechnicalName}`,
          provider: activeAiProvider,
          model: modelTechnicalName,
          status: parsedStatus,
          message: data.error || 'El proveedor de IA rechazó la conexión con este modelo. Revisa el identificador técnico y credenciales.',
        });
        return;
      }

      // Save custom model
      const updatedList = saveCustomAiModel({
        id: modelTechnicalName,
        name: modelTechnicalName,
        provider: activeAiProvider,
        description: `Modelo personalizado validado (${data.latencyMs}ms)`,
        speed: 'equilibrado',
      });
      setCustomAiModels(updatedList);
      onUpdateAiConfig({
        ...aiConfig,
        selectedModel: modelTechnicalName,
      });
      setIsCustomModel(false);
      setCustomModelName('');
      setStatusMsg(`¡Modelo '${modelTechnicalName}' verificado y guardado!`);
      window.dispatchEvent(new Event('teams2jira_custom_models_updated'));
    } catch (err: any) {
      setAiErrorDialog({
        title: 'Error de Red al Validar Modelo',
        provider: activeAiProvider,
        model: modelTechnicalName,
        message: err.message || 'No se pudo contactar con el backend local para probar el modelo.',
      });
    } finally {
      setIsSavingCustomModel(false);
    }
  };

  // Auto-clear status message after 3.5 seconds
  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => setStatusMsg(''), 3500);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  // If custom mode is active and customPrompt is empty, populate with first saved prompt if available
  useEffect(() => {
    if (promptMode === 'custom' && !customPrompt && savedPrompts.length > 0) {
      const first = savedPrompts[0];
      setSelectedPromptId(first.id);
      setCustomTitle(first.title);
      setCustomPrompt(first.content);
    }
  }, [promptMode]);

  const handleWebhookLoaded = (receivedTranscript: string, title: string) => {
    setTranscript(receivedTranscript);
    setMeetingTitle(title);
    setMeetingDate(new Date().toISOString().split('T')[0]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setTranscript(content);
        // Default meeting title = file name without extension (user can still edit it afterwards)
        setMeetingTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsText(file);
    // Reset so selecting the same file again triggers onChange
    input.value = '';
  };

  const insertVariableTag = (tag: string) => {
    setCustomPrompt(`${customPrompt} ${tag}`.trim());
  };

  // Handler: Select a saved custom prompt
  const handleSelectSavedPrompt = (prompt: SavedCustomPrompt) => {
    setPromptMode('custom');
    setSelectedPromptId(prompt.id);
    setCustomTitle(prompt.title);
    setCustomPrompt(prompt.content);
  };

  // Handler: Start composing a new custom prompt (Slot X/3)
  const handleCreateNewCustomPrompt = () => {
    if (savedPrompts.length >= 3) {
      setStatusMsg('Has alcanzado el límite de 3 prompts personalizados.');
      return;
    }
    setPromptMode('custom');
    setSelectedPromptId('new');
    setCustomTitle(`Prompt Personalizado ${savedPrompts.length + 1}`);
    setCustomPrompt('');
  };

  // Handler: Save or update current prompt
  const handleSaveCurrentPrompt = () => {
    if (!customPrompt.trim()) {
      setStatusMsg('Ingresa las instrucciones del prompt antes de guardar.');
      return;
    }

    const trimmedTitle = customTitle.trim() || `Prompt Personalizado ${selectedPromptId === 'new' ? savedPrompts.length + 1 : 1}`;

    if (selectedPromptId === 'new') {
      if (savedPrompts.length >= 3) {
        setStatusMsg('Límite de 3 prompts alcanzado. Elimina uno para crear un nuevo slot.');
        return;
      }
      const newPrompt: SavedCustomPrompt = {
        id: `prompt-${Date.now()}`,
        title: trimmedTitle,
        content: customPrompt.trim(),
        createdAt: new Date().toISOString(),
      };
      const updated = [...savedPrompts, newPrompt].slice(0, 3);
      setSavedPrompts(updated);
      saveCustomPrompts(updated);
      setSelectedPromptId(newPrompt.id);
      setCustomTitle(newPrompt.title);
      setStatusMsg(`✓ Prompt "${trimmedTitle}" guardado (Slot ${updated.length}/3).`);
    } else {
      // Update existing
      const updated = savedPrompts.map((p) =>
        p.id === selectedPromptId
          ? { ...p, title: trimmedTitle, content: customPrompt.trim() }
          : p
      );
      setSavedPrompts(updated);
      saveCustomPrompts(updated);
      setCustomTitle(trimmedTitle);
      setStatusMsg(`✓ Prompt "${trimmedTitle}" actualizado.`);
    }
  };

  // Handler: Save as a new copy if slots are available
  const handleSaveAsNewPrompt = () => {
    if (savedPrompts.length >= 3) {
      setStatusMsg('Límite de 3 prompts alcanzado. Elimina uno para crear un nuevo slot.');
      return;
    }
    const newTitle = `${customTitle.trim() || 'Prompt'} (Copia)`;
    const newPrompt: SavedCustomPrompt = {
      id: `prompt-${Date.now()}`,
      title: newTitle,
      content: customPrompt.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...savedPrompts, newPrompt].slice(0, 3);
    setSavedPrompts(updated);
    saveCustomPrompts(updated);
    setSelectedPromptId(newPrompt.id);
    setCustomTitle(newPrompt.title);
    setStatusMsg(`✓ Guardado como nuevo prompt (Slot ${updated.length}/3).`);
  };

  // Handler: Delete prompt
  const handleDeletePrompt = (id: string) => {
    const updated = savedPrompts.filter((p) => p.id !== id);
    setSavedPrompts(updated);
    saveCustomPrompts(updated);
    if (updated.length > 0) {
      setSelectedPromptId(updated[0].id);
      setCustomTitle(updated[0].title);
      setCustomPrompt(updated[0].content);
      setStatusMsg('Prompt eliminado. Se cargó el siguiente prompt guardado.');
    } else {
      setSelectedPromptId('new');
      setCustomTitle('');
      setCustomPrompt('');
      setStatusMsg('Prompt eliminado.');
    }
  };

  const selectedPromptIndex = savedPrompts.findIndex((p) => p.id === selectedPromptId);

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero intro */}
      <div className="bg-gradient-to-r from-[#1E2023] via-[#29221F] to-[#1E2023] border border-[#FF5038]/30 rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/20">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-[#FF5038]/15 border border-[#FF5038]/30 text-[#FF5038] text-xs px-3 py-1 rounded-full font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-[#EE880E]" />
              ProyectHandler &bull; Solución Cívica Software
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-['Lato']">
              Convierte Transcripciones de Teams en Compromisos & Tickets de Jira
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed font-['Montserrat']">
              Pega la transcripción o notas de la reunión en texto libre. La IA de ProyectHandler identificará a cada
              participante, extraerá los compromisos y tareas acordadas, estructurará las minutas y
              habilitará la sincronización directa con tus proyectos de Jira Cloud.
            </p>
          </div>
        </div>
      </div>

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Transcript Input */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold text-slate-200 flex items-center gap-2 font-['Lato']">
                <FileText className="w-4 h-4 text-[#FF5038]" />
                Transcripción de Microsoft Teams
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowWebhookHelper(!showWebhookHelper)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${showWebhookHelper
                    ? 'bg-[#FF5038]/20 border-[#FF5038] text-white'
                    : 'bg-[#25282B] hover:bg-[#2E3236] text-slate-300 border-[#3E4247]'
                    }`}
                >
                  <Radio className={`w-3.5 h-3.5 ${showWebhookHelper ? 'text-[#FF5038]' : 'text-slate-400'}`} />
                  <span>{showWebhookHelper ? 'Ocultar Webhook' : 'Webhook Teams en Vivo'}</span>
                </button>

                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25282B] hover:bg-[#2E3236] text-slate-200 rounded-lg text-xs font-medium border border-[#3E4247] transition-colors">
                  <Upload className="w-3.5 h-3.5 text-slate-400" />
                  <span>Subir .txt / .vtt</span>
                  <input
                    type="file"
                    accept=".txt,.vtt,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {transcript && (
                  <button
                    onClick={() => {
                      setTranscript('');
                    }}
                    className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible Teams Webhook Card */}
            {showWebhookHelper && (
              <TeamsWebhookCard onLoadTranscript={handleWebhookLoaded} />
            )}

            {/* Transcript Textarea */}
            <div className="relative">
              <textarea
                rows={14}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={`Pega aquí la transcripción de la llamada en Microsoft Teams.

Formatos soportados automáticamente:
• [09:15:30] Carlos Gómez: Yo me encargo de revisar la base de datos...
• 10:04 AM Ana Martínez: De acuerdo, yo implementaré el endpoint...
• Nombre (Rol): Compromiso expresado durante la llamada...`}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 text-xs sm:text-sm font-mono leading-relaxed placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-y"
              />
              <div className="absolute bottom-3 right-3 text-[11px] text-slate-500 bg-slate-900/80 px-2 py-1 rounded-md border border-slate-800">
                {transcript.length} caracteres ({transcript.split(/\s+/).filter(Boolean).length} palabras)
              </div>
            </div>

            {/* Format tips */}
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
              <span>
                <strong>Tip Teams:</strong> No necesitas limpiar las marcas de tiempo ni los encabezados; la IA reconoce a cada orador y filtra la charla informal para extraer compromisos genuinos.
              </span>
            </div>
          </div>
        </div>

        {/* Right Col: Prompt Configuration & Settings */}
        <div className="space-y-4">
          {/* Metadata Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Datos de la Sesión
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Título o Asunto de la Reunión
              </label>
              <input
                type="text"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="Ej: Sprint 42 Planning - Pasarela de Pagos"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Proyecto Jira
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-indigo-400 flex items-center justify-between">
                  <span>{jiraConfig.projectKey}</span>
                  <span className="text-[10px] text-slate-500 font-normal">Destino</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Provider & Model Selector Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 font-['Lato']">
                <Bot className="w-4 h-4 text-[#FF5038]" />
                Motor & Modelo de IA
              </h3>
              <button
                type="button"
                onClick={onOpenAiSettings}
                className="text-[11px] text-[#EE880E] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                title="Configurar API Keys y endpoints de IA"
              >
                <Key className="w-3 h-3" />
                <span>Configurar Keys</span>
              </button>
            </div>

            {/* Provider Selector Pills */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'claude', name: 'Claude', sub: 'Anthropic' },
                { id: 'openai', name: 'OpenAI', sub: 'GPT-4o / o3' },
                { id: 'copilot', name: 'Copilot', sub: 'Azure MS' },
                { id: 'gemini', name: 'Gemini', sub: 'Google' },
              ].map((p) => {
                const isSelected = (aiConfig?.activeProvider || 'claude') === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      const firstModel = AVAILABLE_AI_MODELS.find((m) => m.provider === p.id)?.id || '';
                      setIsCustomModel(false);
                      setCustomModelName('');
                      onUpdateAiConfig({
                        ...aiConfig,
                        activeProvider: p.id as any,
                        selectedModel: firstModel || aiConfig.selectedModel,
                      });
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-left transition-all cursor-pointer ${isSelected
                      ? 'bg-[#FF5038]/20 border-[#FF5038] text-white shadow-xs'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                  >
                    <div className="text-xs font-bold leading-tight">{p.name}</div>
                    <div className="text-[10px] text-slate-500 leading-tight">{p.sub}</div>
                  </button>
                );
              })}
            </div>

            {/* Model Selector Dropdown */}
            <div>
              {(() => {
                const providerFactoryModels = factoryAiModels.filter((m) => m.provider === activeAiProvider);
                const providerCustomModels = customAiModels.filter((m) => m.provider === activeAiProvider);

                return (
                  <>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Modelo Seleccionado ({activeAiProvider.toUpperCase()})
                    </label>
                    <select
                      value={isCustomModel ? '__new_custom__' : (aiConfig?.selectedModel || 'claude-3-7-sonnet-20250219')}
                      onChange={(e) => {
                        if (e.target.value === '__new_custom__') {
                          setIsCustomModel(true);
                          setCustomModelName('');
                        } else {
                          setIsCustomModel(false);
                          onUpdateAiConfig({
                            ...aiConfig,
                            selectedModel: e.target.value,
                          });
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-hidden focus:border-[#FF5038] cursor-pointer"
                    >
                      <optgroup label="Modelos Oficiales (.env / Fábrica)">
                        {providerFactoryModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.badge ? `[${m.badge}]` : ''} ({m.id})
                          </option>
                        ))}
                      </optgroup>
                      {providerCustomModels.length > 0 && (
                        <optgroup label="Modelos Personalizados Guardados">
                          {providerCustomModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.id} [Personalizado]
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <option value="__new_custom__">+ Añadir modelo personalizado...</option>
                    </select>

                    {isCustomModel && (
                      <div className="mt-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold text-slate-300 block">
                            Nombre técnico del modelo ({activeAiProvider.toUpperCase()}):
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
                            value={customModelName}
                            onChange={(e) => setCustomModelName(e.target.value)}
                            placeholder={`Ej: ${
                              activeAiProvider === 'claude'
                                ? 'claude-3-7-sonnet-latest'
                                : activeAiProvider === 'openai'
                                ? 'gpt-4.5-preview'
                                : activeAiProvider === 'copilot'
                                ? 'copilot-custom'
                                : 'gemini-3.1-flash-lite'
                            }`}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-hidden focus:border-[#FF5038]"
                          />
                          <button
                            type="button"
                            onClick={handleSaveAndTestCustomModel}
                            disabled={isSavingCustomModel || !customModelName.trim()}
                            className="px-3 py-1.5 bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:opacity-90 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSavingCustomModel ? 'animate-spin' : ''}`} />
                            <span>{isSavingCustomModel ? 'Probando...' : 'Probar y Guardar'}</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Se probará la conexión con {activeAiProvider.toUpperCase()} y, si responde correctamente, se guardará y seleccionará automáticamente.
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Prompt Mode Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 font-['Lato']">
              <Wand2 className="w-4 h-4 text-[#EE880E]" />
              Instrucción / Formato del Prompt
            </h3>

            {/* Standard Preset Prompts */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setPromptMode('standard')}
                className={`w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${promptMode === 'standard'
                  ? 'bg-[#FF5038]/15 border-[#FF5038] text-white shadow-xs'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>Estándar Ágil (Jira-Ready)</span>
                  <span className="text-[10px] bg-[#FF5038]/20 text-[#FF5038] px-2 py-0.5 rounded-full font-bold">
                    Recomendado Cívica
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Diferencia responsable unívoco, criterios de aceptación, estimación Story Points y etiquetas.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPromptMode('executive')}
                className={`w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${promptMode === 'executive'
                  ? 'bg-[#FF5038]/15 border-[#FF5038] text-white shadow-xs'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
              >
                <div className="font-semibold">Ejecutivo & Compromisos de Negocio</div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enfocado en fechas críticas, acuerdos comerciales, presupuesto y mitigar riesgos.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPromptMode('technical')}
                className={`w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${promptMode === 'technical'
                  ? 'bg-[#FF5038]/15 border-[#FF5038] text-white shadow-xs'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
              >
                <div className="font-semibold">Técnico & Arquitectura Data/Cloud</div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Prioriza deudas de código, spikes de arquitectura, bases de datos y pipelines CI/CD.
                </p>
              </button>
            </div>

            {/* Custom Saved Prompts Section (Up to 3) */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-[#EE880E]" />
                  Prompts Personalizados
                </span>
                <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800 font-mono">
                  {savedPrompts.length}/3 guardados
                </span>
              </div>

              {/* Saved Prompt Cards */}
              <div className="space-y-2">
                {savedPrompts.map((p, idx) => {
                  const isSelected = promptMode === 'custom' && selectedPromptId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectSavedPrompt(p)}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${isSelected
                        ? 'bg-[#FF5038]/15 border-[#FF5038] text-white shadow-xs'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                    >
                      <div className="font-semibold flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={isSelected ? 'text-[#FF5038]' : 'text-amber-400'}>★</span>
                          <span className="truncate">{p.title || `Prompt ${idx + 1}`}</span>
                        </div>
                        <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold shrink-0">
                          Slot {idx + 1}/3
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {p.content ? p.content.slice(0, 110) + '...' : 'Sin contenido guardado'}
                      </p>
                    </button>
                  );
                })}

                {/* Button to add a new custom prompt if < 3 */}
                {savedPrompts.length < 3 && (
                  <button
                    type="button"
                    onClick={handleCreateNewCustomPrompt}
                    className={`w-full text-left p-2.5 rounded-xl border border-dashed text-xs transition-all flex items-center justify-between cursor-pointer ${promptMode === 'custom' && selectedPromptId === 'new'
                      ? 'bg-[#FF5038]/10 border-[#FF5038] text-white'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="w-3.5 h-3.5 text-[#EE880E]" />
                      <span className="font-medium text-[11px]">Incorporar nuevo prompt personalizado</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Slot {savedPrompts.length + 1}/3
                    </span>
                  </button>
                )}

                {savedPrompts.length >= 3 && (
                  <div className="text-[10px] text-slate-500 text-center py-0.5">
                    Máximo de 3 prompts alcanzado. Puedes editar o eliminar cualquiera de los slots.
                  </div>
                )}
              </div>
            </div>

            {/* Custom Prompt Editor (visible when promptMode === 'custom') */}
            {promptMode === 'custom' && (
              <div className="space-y-3 pt-3 border-t border-slate-800 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Edit2 className="w-3.5 h-3.5 text-[#FF5038]" />
                      <span>{selectedPromptId === 'new' ? 'Nuevo Prompt' : 'Editar Prompt'}</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({selectedPromptIndex !== -1 ? `Slot ${selectedPromptIndex + 1} de 3` : `Nuevo Slot ${savedPrompts.length + 1}/3`})
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => insertVariableTag('{participantes}')}
                      className="bg-slate-800 hover:bg-slate-700 text-[10px] px-1.5 py-0.5 rounded text-[#EE880E] font-mono cursor-pointer"
                      title="Insertar etiqueta de participantes"
                    >
                      +participantes
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariableTag('{riesgos}')}
                      className="bg-slate-800 hover:bg-slate-700 text-[10px] px-1.5 py-0.5 rounded text-[#EE880E] font-mono cursor-pointer"
                      title="Insertar etiqueta de riesgos"
                    >
                      +riesgos
                    </button>
                  </div>
                </div>

                {/* Title input */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Título o Nombre del Prompt:
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Ej: MASORANGE Data Stack / Revisión de Sprints / Control QA"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-[#FF5038]"
                  />
                </div>

                {/* Content textarea */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                    <span>Directivas personalizadas para la IA:</span>
                    <span className="text-[10px] text-slate-500 font-mono">{customPrompt.length} caracteres</span>
                  </label>
                  <textarea
                    rows={6}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Escribe aquí las directivas específicas para que la IA extraiga los compromisos y tickets..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-[#FF5038] font-mono leading-relaxed"
                  />
                </div>

                {/* Actions row: Save / Save as New / Delete */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveCurrentPrompt}
                      disabled={!customPrompt.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF5038]/20 hover:bg-[#FF5038]/30 border border-[#FF5038]/50 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5 text-[#FF5038]" />
                      <span>{selectedPromptId === 'new' ? 'Guardar como nueva opción' : 'Guardar Cambios'}</span>
                    </button>

                    {selectedPromptId !== 'new' && savedPrompts.length < 3 && (
                      <button
                        type="button"
                        onClick={handleSaveAsNewPrompt}
                        disabled={!customPrompt.trim()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                        title="Guardar como otro prompt adicional"
                      >
                        <Plus className="w-3 h-3 text-[#EE880E]" />
                        <span>Guardar copia ({savedPrompts.length + 1}/3)</span>
                      </button>
                    )}
                  </div>

                  {selectedPromptId && selectedPromptId !== 'new' && (
                    <button
                      type="button"
                      onClick={() => handleDeletePrompt(selectedPromptId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40 rounded-lg text-xs transition-colors cursor-pointer"
                      title="Eliminar este prompt de los guardados"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  )}
                </div>

                {statusMsg && (
                  <div className="text-[11px] text-[#29E78C] bg-[#29E78C]/10 border border-[#29E78C]/30 px-2.5 py-1.5 rounded-md animate-in fade-in duration-150 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>{statusMsg}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Run Action Button */}
          <button
            onClick={onAnalyze}
            disabled={isLoading || !transcript.trim()}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#FF5038] via-[#F66B24] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white font-bold text-sm shadow-lg shadow-[#FF5038]/30 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99] font-['Lato']"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-white" />
                <span>Analizando Transcripción con IA...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-amber-200" />
                <span>Procesar reunión</span>
              </>
            )}
          </button>
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
