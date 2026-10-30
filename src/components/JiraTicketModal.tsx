import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Check,
  Copy,
  Tag,
  Layers,
  Send,
  Sparkles,
  Plus,
  Trash2,
  CopyPlus,
  ListChecks,
  Link2,
} from 'lucide-react';
import {
  ActionItem,
  JiraConfig,
  JiraUser,
  JiraEpic,
  CloneTaskOptions,
  JiraLinkRelationType,
} from '../types';
import { DEFAULT_JIRA_USERS, DEFAULT_TOPIC_CATEGORIES } from '../utils/storage';
import { JiraConfirmModal } from './JiraConfirmModal';
import { AutoResizeTextarea } from './AutoResizeTextarea';

interface JiraTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ActionItem | null;
  jiraConfig: JiraConfig;
  jiraUsers?: JiraUser[];
  availableTopics?: string[];
  topicCategories?: string[];
  availableEpics?: JiraEpic[];
  onSyncSingleItem: (item: ActionItem, options?: CloneTaskOptions) => Promise<void>;
  onUpdateItem: (updated: ActionItem, newTopicCategory?: string) => void;
  onUpdateItemInJira?: (item: ActionItem, newTopicCategory?: string) => Promise<void>;
  onCreateFromExisting?: (item: ActionItem, options?: CloneTaskOptions) => Promise<void>;
}

const CREATE_NEW_TOPIC_VALUE = '__CREATE_NEW_TOPIC__';

export const JiraTicketModal: React.FC<JiraTicketModalProps> = ({
  isOpen,
  onClose,
  item,
  jiraConfig,
  jiraUsers = DEFAULT_JIRA_USERS,
  availableTopics = [],
  topicCategories = DEFAULT_TOPIC_CATEGORIES,
  availableEpics: propEpics,
  onSyncSingleItem,
  onUpdateItem,
  onUpdateItemInJira,
  onCreateFromExisting,
}) => {
  const [formData, setFormData] = useState<ActionItem | null>(item);
  const [copied, setCopied] = useState(false);
  const [newLabelInput, setNewLabelInput] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'create' | 'update' | 'clone'>('create');

  // Topic creation state (Section A)
  const [isCreatingNewTopic, setIsCreatingNewTopic] = useState(false);
  const [newTopicInput, setNewTopicInput] = useState('');
  const [newTopicCategory, setNewTopicCategory] = useState(
    topicCategories[0] || 'Arquitectura & Datos'
  );

  // Epics state (Funcionalidad 4)
  const [epicsList, setEpicsList] = useState<JiraEpic[]>(propEpics || []);
  const [isLoadingEpics, setIsLoadingEpics] = useState(false);

  // Split Acceptance Criteria state (Funcionalidad 2)
  const [isSplittingCriteria, setIsSplittingCriteria] = useState(false);
  const [selectedCriteriaIndices, setSelectedCriteriaIndices] = useState<number[]>([]);
  const [updateOriginalInJiraOnSplit, setUpdateOriginalInJiraOnSplit] = useState(true);

  // Jira Link Type state when cloning (Funcionalidad 1)
  const [cloneLinkType, setCloneLinkType] = useState<JiraLinkRelationType>('relates');

  useEffect(() => {
    if (item) {
      setFormData({ ...item });
      setIsCreatingNewTopic(false);
      setNewTopicInput('');
      setIsSplittingCriteria(false);
      setSelectedCriteriaIndices([]);
      setUpdateOriginalInJiraOnSplit(true);
      setCloneLinkType('relates');
    }
  }, [item, isOpen]);

  // Fetch active Epics from Jira project when modal opens (Funcionalidad 4)
  useEffect(() => {
    if (!isOpen) return;
    if (propEpics && propEpics.length > 0) {
      setEpicsList(propEpics);
      return;
    }

    let cancelled = false;
    setIsLoadingEpics(true);
    fetch('/api/jira/epics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jiraConfig }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.epics)) {
          setEpicsList(data.epics);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingEpics(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, jiraConfig, propEpics]);

  if (!isOpen || !item || !formData) return null;

  const uniqueTopics = Array.from(
    new Set(
      [
        item.topicName,
        formData.topicName,
        ...availableTopics,
      ]
        .map((t) => (t || '').trim())
        .filter(Boolean)
    )
  );

  const getEffectiveFormData = (): ActionItem => {
    const resolvedTopic = isCreatingNewTopic
      ? newTopicInput.trim() || formData.topicName || 'General'
      : formData.topicName || 'General';
    const matchedEpic = epicsList.find((e) => e.key === formData.epicKey);
    return {
      ...formData,
      topicName: resolvedTopic,
      epicSummary: matchedEpic?.summary || formData.epicSummary,
    };
  };

  const handleCopySummary = () => {
    const current = getEffectiveFormData();
    navigator.clipboard.writeText(
      `${current.title}\n\n${current.description}\n\nTema: ${current.topicName}\nResponsable: ${current.assignee}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Acceptance Criteria handlers
  const handleAddCriteria = () => {
    setFormData({
      ...formData,
      acceptanceCriteria: [...(formData.acceptanceCriteria || []), ''],
    });
  };

  const handleUpdateCriteria = (idx: number, val: string) => {
    const updated = [...(formData.acceptanceCriteria || [])];
    updated[idx] = val;
    setFormData({ ...formData, acceptanceCriteria: updated });
  };

  const handleRemoveCriteria = (idx: number) => {
    const updated = (formData.acceptanceCriteria || []).filter((_, i) => i !== idx);
    setFormData({ ...formData, acceptanceCriteria: updated });
    setSelectedCriteriaIndices((prev) =>
      prev.filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i))
    );
  };

  const handleToggleSplitCriterion = (idx: number) => {
    setSelectedCriteriaIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  // Label handlers
  const handleAddLabel = () => {
    const clean = newLabelInput.trim().toLowerCase().replace(/^#/, '');
    if (clean && !formData.jiraLabels.includes(clean)) {
      setFormData({
        ...formData,
        jiraLabels: [...formData.jiraLabels, clean],
      });
      setNewLabelInput('');
    }
  };

  const handleRemoveLabel = (labelToRemove: string) => {
    setFormData({
      ...formData,
      jiraLabels: formData.jiraLabels.filter((l) => l !== labelToRemove),
    });
  };

  const handleOpenUpdate = () => {
    const current = getEffectiveFormData();
    setFormData(current);
    onUpdateItem(current, isCreatingNewTopic ? newTopicCategory : undefined);
    setConfirmMode('update');
    setShowConfirmModal(true);
  };

  // IMPORTANT: When clicking "Crear a partir de" (clone), we do NOT overwrite the original item!
  const handleOpenClone = () => {
    const current = getEffectiveFormData();
    setFormData(current);
    setConfirmMode('clone');
    setShowConfirmModal(true);
  };

  const handleOpenCreate = () => {
    const current = getEffectiveFormData();
    setFormData(current);
    onUpdateItem(current, isCreatingNewTopic ? newTopicCategory : undefined);
    setConfirmMode('create');
    setShowConfirmModal(true);
  };

  const buildCloneOptions = (): CloneTaskOptions => {
    const allCriteria = (formData.acceptanceCriteria || []).map((c) => String(c).trim());
    const validSelected = selectedCriteriaIndices.filter(
      (idx) => idx >= 0 && idx < allCriteria.length && Boolean(allCriteria[idx])
    );

    const hasSplit = isSplittingCriteria && validSelected.length > 0;
    const movedCriteria = hasSplit ? validSelected.map((idx) => allCriteria[idx]) : [];
    const remainingCriteria = hasSplit
      ? allCriteria.filter((_, idx) => !validSelected.includes(idx) && Boolean(allCriteria[idx]))
      : allCriteria.filter(Boolean);

    return {
      newTopicCategory: isCreatingNewTopic ? newTopicCategory : undefined,
      linkType: cloneLinkType,
      sourceTicketKey: item.jiraTicketKey || item.matchedJiraKey,
      sourceItemId: item.id,
      splitCriteria: hasSplit
        ? {
            movedCriteria,
            remainingCriteria,
            updateOriginalInJira: updateOriginalInJiraOnSplit,
          }
        : undefined,
    };
  };

  const handleConfirmedSync = async (
    updatedItem?: ActionItem,
    confirmedCloneOptions?: CloneTaskOptions
  ) => {
    const itemToSync = updatedItem || getEffectiveFormData();

    if (confirmMode === 'update' && onUpdateItemInJira) {
      onUpdateItem(itemToSync, confirmedCloneOptions?.newTopicCategory);
      await onUpdateItemInJira(itemToSync, confirmedCloneOptions?.newTopicCategory);
    } else if (confirmMode === 'clone' && onCreateFromExisting) {
      await onCreateFromExisting(itemToSync, confirmedCloneOptions || buildCloneOptions());
    } else {
      onUpdateItem(itemToSync, confirmedCloneOptions?.newTopicCategory);
      await onSyncSingleItem(itemToSync, confirmedCloneOptions);
    }
    onClose();
  };

  const handleSyncCriteriaToComment = () => {
    const criteria = (formData.acceptanceCriteria || []).map((c) => String(c).trim()).filter(Boolean);
    const count = criteria.length;
    const current = (formData.proposedComment || '').trim();

    const criteriaRegex = /\n*Criterios de Aceptaci[oó]n.*$/is;
    let baseComment = current.replace(criteriaRegex, '').trim();
    if (!baseComment) {
      const today = new Date().toISOString().split('T')[0];
      baseComment = `Avance ${today}: Se revisaron y actualizaron los compromisos técnicos sobre este ticket.`;
    }

    const criteriaBlock =
      count > 0 ? `\n\nCriterios de Aceptación (${count}):\n${criteria.join('\n')}` : '';

    setFormData({
      ...formData,
      proposedComment: `${baseComment}${criteriaBlock}`,
    });
  };

  const getIssueTypeBadge = (t: string) => {
    switch (t) {
      case 'Story':
        return 'bg-[#29E78C]/20 text-[#29E78C] border-[#29E78C]/30';
      case 'Bug':
        return 'bg-[#FF5038]/20 text-[#FF5038] border-[#FF5038]/30';
      case 'Spike':
        return 'bg-[#9B51E0]/20 text-[#9B51E0] border-[#9B51E0]/30';
      default:
        return 'bg-[#61BFED]/20 text-[#61BFED] border-[#61BFED]/30';
    }
  };

  const isExistingOrSynced =
    formData.jiraStatus === 'synced' || Boolean(formData.matchedJiraKey) || formData.taskKind === 'existing';
  const sourceKey = item.jiraTicketKey || item.matchedJiraKey;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto font-['Montserrat']">
        <div className="bg-[#1C1E20] border border-[#3E4247] rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2E3135] bg-[#141517]">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`text-xs px-2.5 py-1 rounded-md font-semibold border ${getIssueTypeBadge(
                  formData.issueType
                )}`}
              >
                {formData.issueType}
              </span>
              <span className="text-xs font-mono font-medium text-slate-400">
                {formData.jiraTicketKey || `${jiraConfig.projectKey}-DRAFT`}
              </span>
              {formData.derivedFromKey && (
                <span className="text-[11px] bg-[#61BFED]/15 text-[#61BFED] border border-[#61BFED]/30 px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
                  <Link2 className="w-3 h-3" /> Derivada de {formData.derivedFromKey}
                </span>
              )}
              {formData.epicKey && (
                <span className="text-[11px] bg-[#9B51E0]/15 text-[#9B51E0] border border-[#9B51E0]/30 px-2 py-0.5 rounded-md font-mono">
                  Épica: {formData.epicKey}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {formData.jiraTicketUrl && (
                <a
                  href={formData.jiraTicketUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#EE880E] hover:underline flex items-center gap-1 bg-[#25282B] px-2.5 py-1 rounded-lg border border-[#3E4247]"
                >
                  Abrir en Jira <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <button
                onClick={handleCopySummary}
                className="text-xs text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#25282B] transition-colors"
                title="Copiar detalles"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#25282B] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5 text-sm max-h-[75vh] overflow-y-auto">
            {/* Existing Task Context Banner */}
            {(formData.taskKind === 'existing' || Boolean(formData.matchedJiraKey)) && (
              <div className="bg-[#141517] border border-[#3E4247] p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                        formData.isClosedMatch
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-[#61BFED]/15 text-[#61BFED] border-[#61BFED]/30'
                      }`}
                    >
                      {formData.isClosedMatch ? 'Resuelta en Jira' : 'En Curso en Jira'}:{' '}
                      {formData.matchedJiraKey}
                    </span>
                    {formData.matchConfidence && (
                      <span className="text-[10px] text-slate-400">
                        Coincidencia: {formData.matchConfidence}
                      </span>
                    )}
                  </div>
                  {formData.matchedJiraKey && (
                    <a
                      href={`https://${(jiraConfig.domain || 'atlassian.net').replace(
                        /^https?:\/\//,
                        ''
                      )}/browse/${formData.matchedJiraKey}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#61BFED] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Ver en Jira</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                {formData.matchReason && (
                  <p className="text-xs text-slate-300 italic">💡 {formData.matchReason}</p>
                )}
                {formData.proposedComment !== undefined && (
                  <div className="pt-2 border-t border-[#2A2C2F] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white block font-['Lato']">
                        Comentario sugerido para Jira:
                      </span>
                      <button
                        type="button"
                        onClick={handleSyncCriteriaToComment}
                        className="text-[10px] text-[#EE880E] hover:text-[#FFA034] hover:underline flex items-center gap-1 font-semibold cursor-pointer transition-colors"
                        title="Inserta o actualiza los criterios de aceptación en el comentario sugerido"
                      >
                        <Sparkles className="w-3 h-3 text-[#EE880E]" />
                        <span>Sincronizar Criterios</span>
                      </button>
                    </div>
                    <AutoResizeTextarea
                      minRows={3}
                      value={formData.proposedComment}
                      onChange={(e) => setFormData({ ...formData, proposedComment: e.target.value })}
                      placeholder="Comentario para registrar avances en Jira..."
                      className="w-full bg-[#1C1E20] border border-[#2E3135] rounded-lg p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-[#FF5038] font-mono leading-relaxed"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-white mb-1.5 font-['Lato']">
                Resumen / Título de la tarea
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-[#141517] border border-[#3E4247] rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-hidden focus:border-[#FF5038] text-xs"
              />
            </div>

            {/* Topic Selector & Parent Epic Selector Row (Section A + Funcionalidad 4) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#141517] p-3.5 rounded-2xl border border-[#2A2C2F]">
              {/* Topic / Initiative Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[#61BFED] font-semibold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#61BFED]" />
                    <span>Tema / Iniciativa Asociada</span>
                  </span>
                  {isCreatingNewTopic && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewTopic(false)}
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Elegir tema existente
                    </button>
                  )}
                </div>

                {!isCreatingNewTopic ? (
                  <select
                    value={formData.topicName || ''}
                    onChange={(e) => {
                      if (e.target.value === CREATE_NEW_TOPIC_VALUE) {
                        setIsCreatingNewTopic(true);
                        setNewTopicInput('');
                      } else {
                        setFormData({ ...formData, topicName: e.target.value });
                      }
                    }}
                    className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-hidden focus:border-[#FF5038] cursor-pointer"
                  >
                    {uniqueTopics.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value={CREATE_NEW_TOPIC_VALUE} className="text-[#EE880E] font-bold">
                      + Crear nuevo tema...
                    </option>
                  </select>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newTopicInput}
                      onChange={(e) => setNewTopicInput(e.target.value)}
                      placeholder="Escribe el nombre del nuevo tema..."
                      autoFocus
                      className="flex-1 bg-[#1C1E20] border border-[#EE880E] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden"
                    />
                    <select
                      value={newTopicCategory}
                      onChange={(e) => setNewTopicCategory(e.target.value)}
                      className="bg-[#1C1E20] border border-[#3E4247] rounded-lg px-2 py-1.5 text-[11px] text-slate-300 focus:outline-hidden focus:border-[#FF5038]"
                    >
                      {topicCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Parent Epic Selector (Funcionalidad 4) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[#9B51E0] font-semibold flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#9B51E0]" />
                    <span>Épica Padre en Jira (Parent Epic)</span>
                  </span>
                  {isLoadingEpics && (
                    <span className="text-[10px] text-slate-500 animate-pulse">Cargando épicas...</span>
                  )}
                </div>
                <select
                  value={formData.epicKey || ''}
                  onChange={(e) => {
                    const selectedKey = e.target.value;
                    const found = epicsList.find((ep) => ep.key === selectedKey);
                    setFormData({
                      ...formData,
                      epicKey: selectedKey || undefined,
                      epicSummary: found?.summary || undefined,
                    });
                  }}
                  className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-hidden focus:border-[#FF5038] cursor-pointer"
                >
                  <option value="">Sin Épica Padre (Independiente)</option>
                  {formData.epicKey && !epicsList.some((ep) => ep.key === formData.epicKey) && (
                    <option value={formData.epicKey}>
                      [{formData.epicKey}] {formData.epicSummary || 'Épica Asociada'}
                    </option>
                  )}
                  {epicsList.map((ep) => (
                    <option key={ep.key} value={ep.key}>
                      [{ep.key}] {ep.summary}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Metadata Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#141517] p-3.5 rounded-2xl border border-[#2A2C2F]">
              <div>
                <span className="block text-[11px] text-slate-400 font-medium mb-1">Responsable</span>
                <select
                  value={formData.assignee || ''}
                  onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                  className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-lg px-2 py-1 text-xs text-white font-bold focus:outline-hidden focus:border-[#FF5038] cursor-pointer"
                >
                  <option value="">Sin Asignar</option>
                  {formData.assignee &&
                    !jiraUsers.some(
                      (u) => u.displayName.toLowerCase().trim() === formData.assignee.toLowerCase().trim()
                    ) && <option value={formData.assignee}>{formData.assignee} (Detectado)</option>}
                  <optgroup label="Usuarios de Jira configurados">
                    {jiraUsers.map((u) => (
                      <option key={u.accountId || u.displayName} value={u.displayName}>
                        {u.displayName} {u.role ? `• ${u.role}` : ''}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <span className="block text-[11px] text-slate-400 font-medium mb-1">Prioridad</span>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-hidden focus:border-[#FF5038]"
                >
                  <option value="Highest">Highest</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <span className="block text-[11px] text-slate-400 font-medium mb-1">Story Points</span>
                <input
                  type="number"
                  min="1"
                  max="21"
                  value={formData.storyPoints}
                  onChange={(e) =>
                    setFormData({ ...formData, storyPoints: parseInt(e.target.value, 10) || 1 })
                  }
                  className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-lg px-2 py-1 text-xs text-amber-300 font-mono font-bold focus:outline-hidden focus:border-[#FF5038]"
                />
              </div>

              <div>
                <span className="block text-[11px] text-slate-400 font-medium mb-1">
                  Tipo de Incidencia
                </span>
                <select
                  value={formData.issueType}
                  onChange={(e) => setFormData({ ...formData, issueType: e.target.value as any })}
                  className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-hidden focus:border-[#FF5038]"
                >
                  <option value="Task">Task (Tarea)</option>
                  <option value="Story">Story (Historia)</option>
                  <option value="Bug">Bug (Error)</option>
                  <option value="Spike">Spike (Investigación)</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-white mb-1.5 font-['Lato']">
                Descripción del Ticket & Alcance
              </label>
              <AutoResizeTextarea
                minRows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-[#141517] border border-[#3E4247] rounded-xl p-3 text-slate-200 text-xs focus:outline-hidden focus:border-[#FF5038] leading-relaxed"
              />
            </div>

            {/* Editable Acceptance Criteria + Funcionalidad 2: Split Criteria Mode */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-bold text-white font-['Lato']">
                  Criterios de Aceptación (Acceptance Criteria)
                </label>

                <div className="flex items-center gap-3">
                  {isExistingOrSynced && (formData.acceptanceCriteria || []).length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isSplittingCriteria) {
                          setIsSplittingCriteria(false);
                          setSelectedCriteriaIndices([]);
                        } else {
                          setIsSplittingCriteria(true);
                        }
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                        isSplittingCriteria
                          ? 'bg-[#29E78C]/15 text-[#29E78C] border-[#29E78C]/40'
                          : 'bg-[#25282B] hover:bg-[#2E3236] text-slate-200 border-[#3E4247]'
                      }`}
                      title="Selecciona con checkboxes qué criterios deseas mover a la nueva tarea y quitar del ticket original"
                    >
                      <ListChecks className="w-3.5 h-3.5 text-[#29E78C]" />
                      <span>
                        {isSplittingCriteria
                          ? 'Cancelar selección de criterios'
                          : 'Asignar criterios de aceptación a la nueva tarea'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleAddCriteria}
                    className="text-[11px] text-[#EE880E] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Criterio</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2 bg-[#141517] p-3.5 rounded-2xl border border-[#2A2C2F]">
                {isSplittingCriteria && (
                  <div className="bg-[#1C1E20] border border-[#29E78C]/30 rounded-xl p-3 mb-2 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-[#29E78C] font-bold flex items-center gap-1.5">
                        <ListChecks className="w-4 h-4" />
                        <span>
                          Marca los criterios que se moverán a la nueva tarea y se quitarán de{' '}
                          {sourceKey || 'este ticket'}
                        </span>
                      </span>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCriteriaIndices(
                              (formData.acceptanceCriteria || []).map((_, idx) => idx)
                            )
                          }
                          className="text-[#61BFED] hover:underline cursor-pointer"
                        >
                          Marcar todos
                        </button>
                        <span className="text-slate-600">•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCriteriaIndices([])}
                          className="text-slate-400 hover:text-white hover:underline cursor-pointer"
                        >
                          Desmarcar todos
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#2A2C2F] text-[11px]">
                      <span className="text-slate-300">
                        Seleccionados para nueva tarea:{' '}
                        <strong className="text-[#29E78C]">{selectedCriteriaIndices.length}</strong>{' '}
                        &bull; Permanecerán en {sourceKey || 'ticket original'}:{' '}
                        <strong className="text-white">
                          {Math.max(
                            0,
                            (formData.acceptanceCriteria || []).length - selectedCriteriaIndices.length
                          )}
                        </strong>
                      </span>

                      {sourceKey && (
                        <label className="flex items-center gap-1.5 text-slate-200 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={updateOriginalInJiraOnSplit}
                            onChange={(e) => setUpdateOriginalInJiraOnSplit(e.target.checked)}
                            className="rounded border-[#3E4247] bg-[#141517] text-[#FF5038] focus:ring-0 cursor-pointer"
                          />
                          <span>Actualizar {sourceKey} en Jira quitando los criterios movidos</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {(formData.acceptanceCriteria || []).map((criterion, idx) => {
                  const isCheckedForMove = selectedCriteriaIndices.includes(idx);
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2.5 text-xs rounded-xl p-1 transition-colors ${
                        isSplittingCriteria && isCheckedForMove
                          ? 'bg-[#29E78C]/10 border border-[#29E78C]/30'
                          : ''
                      }`}
                    >
                      {isSplittingCriteria ? (
                        <input
                          type="checkbox"
                          checked={isCheckedForMove}
                          onChange={() => handleToggleSplitCriterion(idx)}
                          className="w-4 h-4 rounded border-[#3E4247] bg-[#1C1E20] text-[#29E78C] focus:ring-0 cursor-pointer shrink-0 ml-1"
                          title="Marcar para mover este criterio a la nueva tarea"
                        />
                      ) : (
                        <span className="text-[#29E78C] font-bold shrink-0 ml-1">✓</span>
                      )}

                      <input
                        type="text"
                        value={criterion}
                        onChange={(e) => handleUpdateCriteria(idx, e.target.value)}
                        placeholder="Escribe el criterio de aceptación..."
                        className="flex-1 bg-[#1C1E20] border border-[#3E4247] rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#FF5038]"
                      />

                      {isSplittingCriteria && isCheckedForMove && (
                        <span className="text-[10px] bg-[#29E78C]/20 text-[#29E78C] border border-[#29E78C]/30 px-2 py-0.5 rounded-md font-semibold whitespace-nowrap shrink-0">
                          → Nueva tarea
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveCriteria(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-md transition-colors shrink-0 cursor-pointer"
                        title="Eliminar criterio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                {(formData.acceptanceCriteria || []).length === 0 && (
                  <div className="text-slate-500 text-xs text-center py-2">
                    No hay criterios de aceptación. Haz clic en "Añadir Criterio".
                  </div>
                )}
              </div>
            </div>

            {/* Editable Technical Context & Labels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-white mb-1.5 font-['Lato']">
                  Contexto de Discusión en Teams
                </label>
                <AutoResizeTextarea
                  minRows={3}
                  value={formData.technicalContext || ''}
                  onChange={(e) => setFormData({ ...formData, technicalContext: e.target.value })}
                  placeholder="Detalla lo hablado en Teams: antecedentes, decisiones o dependencias..."
                  className="w-full bg-[#141517] border border-[#3E4247] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-[#FF5038] leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1.5 font-['Lato']">
                  Etiquetas en Jira (Labels)
                </label>
                <div className="bg-[#141517] p-3 rounded-xl border border-[#3E4247] space-y-2.5">
                  <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                    {formData.jiraLabels.map((lbl, i) => (
                      <span
                        key={i}
                        className="bg-[#25282B] text-slate-200 text-[11px] px-2 py-0.5 rounded-md font-mono flex items-center gap-1.5 border border-[#3E4247]"
                      >
                        <Tag className="w-2.5 h-2.5 text-[#FF5038]" />
                        <span>#{lbl}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLabel(lbl)}
                          className="text-slate-400 hover:text-rose-400 font-bold ml-0.5"
                          title="Quitar etiqueta"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {formData.jiraLabels.length === 0 && (
                      <span className="text-[11px] text-slate-500">Sin etiquetas.</span>
                    )}
                  </div>

                  <div className="flex gap-1.5 pt-1 border-t border-[#2A2C2F]">
                    <input
                      type="text"
                      placeholder="Nueva etiqueta (ej: masorange)"
                      value={newLabelInput}
                      onChange={(e) => setNewLabelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddLabel();
                        }
                      }}
                      className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[#FF5038]"
                    />
                    <button
                      type="button"
                      onClick={handleAddLabel}
                      className="px-2.5 py-1 bg-[#25282B] hover:bg-[#2F3236] text-white text-xs font-semibold rounded-lg border border-[#3E4247] shrink-0 cursor-pointer"
                    >
                      + Añadir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-t border-[#2E3135] bg-[#141517] gap-3">
            <div className="text-xs text-slate-400">
              {formData.jiraStatus === 'synced' ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Sincronizado en Jira ({formData.jiraTicketKey})
                </span>
              ) : (
                <span>
                  Destino: Proyecto <strong className="text-white">{jiraConfig.projectKey}</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const current = getEffectiveFormData();
                  onUpdateItem(current, isCreatingNewTopic ? newTopicCategory : undefined);
                  onClose();
                }}
                className="h-10 px-4 rounded-xl text-slate-300 hover:text-white text-xs font-semibold hover:bg-[#25282B] transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center"
              >
                Guardar Cambios
              </button>

              {isExistingOrSynced ? (
                <>
                  <button
                    type="button"
                    onClick={handleOpenClone}
                    className="h-10 px-4 rounded-xl bg-[#25282B] hover:bg-[#2F3337] text-slate-200 hover:text-white border border-[#3E4247] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
                    title="Crear una nueva tarea en Jira a partir del contenido de este tema"
                  >
                    <CopyPlus className="w-3.5 h-3.5 text-[#EE880E] shrink-0" />
                    <span>
                      {isSplittingCriteria && selectedCriteriaIndices.length > 0
                        ? `Crear a partir de (${selectedCriteriaIndices.length} crit.)`
                        : 'Crear a partir de'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenUpdate}
                    className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white text-xs font-bold shadow-md shadow-[#FF5038]/25 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 font-['Lato']"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span>Actualizar en Jira</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white text-xs font-bold shadow-md shadow-[#FF5038]/25 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 font-['Lato']"
                >
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span>Crear en Tablero Jira</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <JiraConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmedSync}
        item={formData}
        jiraConfig={jiraConfig}
        jiraUsers={jiraUsers}
        mode={confirmMode}
        availableTopics={uniqueTopics}
        topicCategories={topicCategories}
        availableEpics={epicsList}
        sourceTicketKey={sourceKey}
        cloneOptions={confirmMode === 'clone' ? buildCloneOptions() : undefined}
      />
    </>
  );
};
