import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  Tag,
  Layers,
  GitCommit,
  Plus,
  Link2,
  ListChecks,
} from 'lucide-react';
import {
  ActionItem,
  JiraConfig,
  JiraUser,
  JiraEpic,
  JiraLinkRelationType,
  CloneTaskOptions,
} from '../types';
import { DEFAULT_JIRA_USERS, DEFAULT_TOPIC_CATEGORIES } from '../utils/storage';

interface JiraConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (itemToSync?: ActionItem, cloneOptions?: CloneTaskOptions) => Promise<void>;
  item: ActionItem | null;
  jiraConfig: JiraConfig;
  jiraUsers?: JiraUser[];
  mode?: 'create' | 'update' | 'clone';
  availableTopics?: string[];
  topicCategories?: string[];
  availableEpics?: JiraEpic[];
  sourceTicketKey?: string;
  cloneOptions?: CloneTaskOptions;
}

const CREATE_NEW_TOPIC_VALUE = '__CREATE_NEW_TOPIC__';

export const JiraConfirmModal: React.FC<JiraConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  item,
  jiraConfig,
  jiraUsers = DEFAULT_JIRA_USERS,
  mode = 'create',
  availableTopics = [],
  topicCategories = DEFAULT_TOPIC_CATEGORIES,
  availableEpics = [],
  sourceTicketKey,
  cloneOptions,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState(item?.assignee || '');
  const [selectedTopic, setSelectedTopic] = useState(item?.topicName || '');
  const [isCreatingNewTopic, setIsCreatingNewTopic] = useState(false);
  const [newTopicInput, setNewTopicInput] = useState('');
  const [newTopicCategory, setNewTopicCategory] = useState(
    cloneOptions?.newTopicCategory || topicCategories[0] || 'Arquitectura & Datos'
  );
  const [selectedEpicKey, setSelectedEpicKey] = useState(item?.epicKey || '');
  const [selectedLinkType, setSelectedLinkType] = useState<JiraLinkRelationType>(
    cloneOptions?.linkType || 'relates'
  );
  const [updateOriginalInJira, setUpdateOriginalInJira] = useState<boolean>(
    cloneOptions?.splitCriteria?.updateOriginalInJira ?? true
  );

  useEffect(() => {
    if (item) {
      setSelectedAssignee(item.assignee || '');
      setSelectedTopic(item.topicName || '');
      setIsCreatingNewTopic(false);
      setNewTopicInput('');
      setSelectedEpicKey(item.epicKey || '');
      setSelectedLinkType(cloneOptions?.linkType || item.jiraLinkType || 'relates');
      setUpdateOriginalInJira(cloneOptions?.splitCriteria?.updateOriginalInJira ?? true);
      if (cloneOptions?.newTopicCategory) {
        setNewTopicCategory(cloneOptions.newTopicCategory);
      }
    }
  }, [item, cloneOptions, isOpen]);

  if (!isOpen || !item) return null;

  const effectiveSourceKey = sourceTicketKey || cloneOptions?.sourceTicketKey || item.jiraTicketKey || item.matchedJiraKey;

  const uniqueTopics = Array.from(
    new Set(
      [
        item.topicName,
        ...availableTopics,
      ]
        .map((t) => (t || '').trim())
        .filter(Boolean)
    )
  );

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const resolvedTopicName = isCreatingNewTopic
        ? newTopicInput.trim() || item.topicName || 'General'
        : selectedTopic.trim() || item.topicName || 'General';

      const matchedEpic = availableEpics.find((e) => e.key === selectedEpicKey);
      const criteriaForSync =
        mode === 'clone' &&
        cloneOptions?.splitCriteria &&
        cloneOptions.splitCriteria.movedCriteria.length > 0
          ? cloneOptions.splitCriteria.movedCriteria
          : item.acceptanceCriteria;

      const updatedItem: ActionItem = {
        ...item,
        assignee: selectedAssignee,
        topicName: resolvedTopicName,
        epicKey: selectedEpicKey || undefined,
        epicSummary: matchedEpic?.summary || (selectedEpicKey ? item.epicSummary : undefined),
        acceptanceCriteria: criteriaForSync,
        derivedFromKey: mode === 'clone' ? effectiveSourceKey : item.derivedFromKey,
        jiraLinkType: mode === 'clone' ? selectedLinkType : item.jiraLinkType,
      };

      const finalCloneOptions: CloneTaskOptions | undefined =
        mode === 'clone'
          ? {
              ...cloneOptions,
              newTopicCategory,
              linkType: selectedLinkType,
              sourceTicketKey: effectiveSourceKey,
              splitCriteria: cloneOptions?.splitCriteria
                ? {
                    ...cloneOptions.splitCriteria,
                    updateOriginalInJira,
                  }
                : undefined,
            }
          : {
              newTopicCategory,
            };

      await onConfirm(updatedItem, finalCloneOptions);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLive = jiraConfig.simulationMode === false;
  const targetKey = effectiveSourceKey;

  const modalTitle =
    mode === 'update'
      ? `Confirmar Actualización en Jira (${targetKey})`
      : mode === 'clone'
      ? `Crear Nueva Tarea a partir de ${targetKey || 'este tema'}`
      : 'Confirmar Creación de Tarjeta en Jira';

  const modalSubtitle =
    mode === 'update'
      ? `Se reflejarán las modificaciones de título, descripción, tema, épica, criterios de aceptación, prioridad y responsable en Jira Cloud.`
      : mode === 'clone'
      ? `Se originará una nueva tarea en Jira conservando el ticket original ${targetKey || ''}.`
      : 'Revisa los datos del ticket antes de sincronizarlo con Atlassian.';

  const displayedCriteria =
    mode === 'clone' &&
    cloneOptions?.splitCriteria &&
    cloneOptions.splitCriteria.movedCriteria.length > 0
      ? cloneOptions.splitCriteria.movedCriteria
      : item.acceptanceCriteria || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200 font-['Montserrat']">
      <div className="bg-[#1C1E20] border border-[#3E4247] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#2E3135] bg-gradient-to-r from-[#1E2023] via-[#2A2321] to-[#1E2023] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF5038] to-[#EE880E] flex items-center justify-center text-white shadow-md shadow-[#FF5038]/20 shrink-0">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm font-['Lato'] flex items-center gap-2">
                <span>{modalTitle}</span>
              </h3>
              <p className="text-[11px] text-slate-400">{modalSubtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#25282B] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Destination Info Pill */}
        <div className="px-5 py-2.5 bg-[#141517] border-b border-[#2A2C2F] flex flex-wrap items-center justify-between text-[11px] gap-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Proyecto Destino:</span>
            <span className="font-mono font-bold text-[#EE880E] bg-[#EE880E]/15 border border-[#EE880E]/30 px-2 py-0.5 rounded-md">
              {jiraConfig.projectKey}
            </span>
            <span className="text-slate-400 font-mono text-[10px]">({jiraConfig.domain})</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              isLive
                ? 'bg-emerald-950/60 text-[#29E78C] border-[#29E78C]/40'
                : 'bg-amber-950/60 text-amber-300 border-amber-500/40'
            }`}
          >
            {isLive ? '● Jira Cloud en Vivo' : '○ Modo Simulado'}
          </span>
        </div>

        {/* Card Summary Body */}
        <div className="p-5 space-y-4 max-h-[68vh] overflow-y-auto text-xs">
          {/* Title */}
          <div className="bg-[#141517] p-3.5 rounded-2xl border border-[#2A2C2F] space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Título / Resumen del Ticket
            </span>
            <div className="font-bold text-white text-sm font-['Lato'] leading-snug">
              {item.title}
            </div>
          </div>

          {/* Assigned Person Highlight */}
          <div className="bg-gradient-to-r from-[#241F18] to-[#1C1E20] border border-[#EE880E]/40 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#FF5038] to-[#EE880E] flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
                {selectedAssignee ? selectedAssignee.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="min-w-0 flex-1">
                <label className="text-[10px] uppercase font-bold text-[#EE880E] tracking-wider block mb-1">
                  Responsable Asignado en Jira
                </label>
                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="w-full bg-[#141517] border border-[#EE880E]/50 rounded-lg px-2.5 py-1 text-xs text-white font-bold focus:outline-hidden focus:border-[#FF5038] cursor-pointer"
                >
                  <option value="">Sin Asignar</option>
                  {selectedAssignee &&
                    !jiraUsers.some(
                      (u) => u.displayName.toLowerCase().trim() === selectedAssignee.toLowerCase().trim()
                    ) && (
                      <option value={selectedAssignee}>{selectedAssignee} (Detectado)</option>
                    )}
                  <optgroup label="Usuarios de Jira configurados">
                    {jiraUsers.map((u) => (
                      <option key={u.accountId || u.displayName} value={u.displayName}>
                        {u.displayName} {u.role ? `(${u.role})` : ''}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
            <span className="text-[10px] bg-[#EE880E]/15 text-[#EE880E] border border-[#EE880E]/30 px-2 py-1 rounded-md font-mono shrink-0 self-start sm:self-center">
              Assignee Jira
            </span>
          </div>

          {/* Topic & Parent Epic Row (A + Funcionalidad 4) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Topic Selector */}
            <div className="bg-[#141517] p-3.5 rounded-2xl border border-[#2A2C2F] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-bold text-[#61BFED] tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3 text-[#61BFED]" />
                  <span>Tema / Iniciativa Asociada</span>
                </label>
                {isCreatingNewTopic && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewTopic(false)}
                    className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Usar existente
                  </button>
                )}
              </div>

              {!isCreatingNewTopic ? (
                <select
                  value={selectedTopic}
                  onChange={(e) => {
                    if (e.target.value === CREATE_NEW_TOPIC_VALUE) {
                      setIsCreatingNewTopic(true);
                      setNewTopicInput('');
                    } else {
                      setSelectedTopic(e.target.value);
                    }
                  }}
                  className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-hidden focus:border-[#FF5038] cursor-pointer"
                >
                  {uniqueTopics.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                  <option value={CREATE_NEW_TOPIC_VALUE} className="text-[#EE880E] font-bold">
                    + Crear nuevo tema...
                  </option>
                </select>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newTopicInput}
                    onChange={(e) => setNewTopicInput(e.target.value)}
                    placeholder="Nombre del nuevo tema..."
                    autoFocus
                    className="w-full bg-[#1C1E20] border border-[#EE880E] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden"
                  />
                  <select
                    value={newTopicCategory}
                    onChange={(e) => setNewTopicCategory(e.target.value)}
                    className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-hidden focus:border-[#FF5038]"
                  >
                    {topicCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        Categoría: {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Parent Epic Selector (Funcionalidad 4) */}
            <div className="bg-[#141517] p-3.5 rounded-2xl border border-[#2A2C2F] space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#9B51E0] tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3 text-[#9B51E0]" />
                <span>Épica Padre en Jira (Parent)</span>
              </label>
              <select
                value={selectedEpicKey}
                onChange={(e) => setSelectedEpicKey(e.target.value)}
                className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-hidden focus:border-[#FF5038] cursor-pointer"
              >
                <option value="">Sin Épica Padre (Independiente)</option>
                {selectedEpicKey &&
                  !availableEpics.some((ep) => ep.key === selectedEpicKey) && (
                    <option value={selectedEpicKey}>
                      {selectedEpicKey} {item.epicSummary ? `• ${item.epicSummary}` : ''}
                    </option>
                  )}
                {availableEpics.map((ep) => (
                  <option key={ep.key} value={ep.key}>
                    [{ep.key}] {ep.summary}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Funcionalidad 1: Native Jira Issue Link Selector (shown in clone mode) */}
          {mode === 'clone' && effectiveSourceKey && (
            <div className="bg-[#141517] p-3.5 rounded-2xl border border-[#61BFED]/30 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-bold text-[#61BFED] tracking-wider flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-[#61BFED]" />
                  <span>Vinculación Nativa en Jira Cloud con {effectiveSourceKey}</span>
                </label>
                {(selectedLinkType === 'is_blocked_by' || selectedLinkType === 'blocks') && (
                  <span className="text-[10px] bg-[#FF5038]/15 text-[#FF5038] border border-[#FF5038]/30 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                    <GitCommit className="w-3 h-3" /> Se añadirá al Grafo de Dependencias
                  </span>
                )}
              </div>
              <select
                value={selectedLinkType}
                onChange={(e) => setSelectedLinkType(e.target.value as JiraLinkRelationType)}
                className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-hidden focus:border-[#61BFED] cursor-pointer"
              >
                <option value="relates">Relacionado con {effectiveSourceKey} (Relates to)</option>
                <option value="is_blocked_by">
                  Es bloqueada por {effectiveSourceKey} (Is blocked by {effectiveSourceKey})
                </option>
                <option value="blocks">
                  Bloquea a {effectiveSourceKey} (Blocks {effectiveSourceKey})
                </option>
                <option value="cloners">Clonada de {effectiveSourceKey} (Cloners)</option>
                <option value="none">Sin vínculo en Jira Cloud</option>
              </select>
            </div>
          )}

          {/* Funcionalidad 2: Split Criteria Summary (when moving specific criteria to the new task) */}
          {mode === 'clone' &&
            cloneOptions?.splitCriteria &&
            cloneOptions.splitCriteria.movedCriteria.length > 0 && (
              <div className="bg-emerald-950/25 border border-[#29E78C]/40 p-3.5 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#29E78C] flex items-center gap-1.5 font-['Lato']">
                    <ListChecks className="w-4 h-4" />
                    <span>
                      División de Criterios de Aceptación con {effectiveSourceKey || 'Ticket Original'}
                    </span>
                  </span>
                  <span className="text-[10px] font-mono bg-[#141517] text-slate-300 px-2 py-0.5 rounded-md border border-[#2A2C2F]">
                    {cloneOptions.splitCriteria.movedCriteria.length} movidos /{' '}
                    {cloneOptions.splitCriteria.remainingCriteria.length} permanecen
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Se asignarán{' '}
                  <strong className="text-white">
                    {cloneOptions.splitCriteria.movedCriteria.length} criterio(s)
                  </strong>{' '}
                  a esta nueva tarea y se quitarán del ticket original{' '}
                  <strong className="text-white">{effectiveSourceKey}</strong> (donde quedarán{' '}
                  {cloneOptions.splitCriteria.remainingCriteria.length} criterio(s)).
                </p>
                {effectiveSourceKey && (
                  <label className="flex items-center gap-2 pt-1 text-[11px] text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={updateOriginalInJira}
                      onChange={(e) => setUpdateOriginalInJira(e.target.checked)}
                      className="rounded border-[#3E4247] bg-[#141517] text-[#FF5038] focus:ring-0 cursor-pointer"
                    />
                    <span>
                      Actualizar también <strong>{effectiveSourceKey}</strong> en Jira Cloud quitando
                      los criterios movidos
                    </span>
                  </label>
                )}
              </div>
            )}

          {/* Meta Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-[#141517] p-2.5 rounded-xl border border-[#2A2C2F]">
              <span className="text-[10px] text-slate-500 block">Tipo de Incidencia</span>
              <span className="font-bold text-white text-xs">{item.issueType || 'Task'}</span>
            </div>
            <div className="bg-[#141517] p-2.5 rounded-xl border border-[#2A2C2F]">
              <span className="text-[10px] text-slate-500 block">Prioridad</span>
              <span className="font-bold text-white text-xs">{item.priority || 'Medium'}</span>
            </div>
            <div className="bg-[#141517] p-2.5 rounded-xl border border-[#2A2C2F]">
              <span className="text-[10px] text-slate-500 block">Story Points</span>
              <span className="font-mono font-bold text-amber-300 text-xs">{item.storyPoints || 3} pts</span>
            </div>
          </div>

          {/* Acceptance Criteria */}
          {displayedCriteria.length > 0 && (
            <div className="bg-[#141517] p-3.5 rounded-2xl border border-[#2A2C2F] space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                Criterios de Aceptación de esta Tarea ({displayedCriteria.length})
              </span>
              <div className="space-y-1.5">
                {displayedCriteria.map((crit, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-300 text-[11px]">
                    <span className="text-[#29E78C] font-bold shrink-0">✓</span>
                    <span>{crit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Labels & Context */}
          <div className="space-y-2">
            {item.jiraLabels && item.jiraLabels.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-slate-500 mr-1">Etiquetas:</span>
                {item.jiraLabels.map((lbl, idx) => (
                  <span
                    key={idx}
                    className="bg-[#25282B] text-slate-300 text-[10px] px-2 py-0.5 rounded-md font-mono border border-[#3E4247]"
                  >
                    #{lbl}
                  </span>
                ))}
              </div>
            )}

            {(item.technicalContext || item.description) && (
              <div className="bg-[#141517] p-3 rounded-xl border border-[#2A2C2F] text-[11px] text-slate-400 space-y-1">
                <span className="text-[10px] text-slate-500 block font-semibold">
                  Descripción / Alcance:
                </span>
                <p className="leading-relaxed text-slate-300 whitespace-pre-wrap">
                  {item.description || item.technicalContext}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2E3135] bg-[#141517] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-gradient-to-r from-[#FF5038] via-[#F66B24] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-[#FF5038]/25"
          >
            <Send className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-pulse' : ''}`} />
            <span>
              {isSubmitting
                ? mode === 'update'
                  ? 'Actualizando en Jira...'
                  : 'Creando en Jira...'
                : mode === 'update'
                ? 'Confirmar y Actualizar en Jira'
                : mode === 'clone'
                ? 'Confirmar y Crear Nueva Tarea'
                : 'Confirmar y Crear en Jira'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
