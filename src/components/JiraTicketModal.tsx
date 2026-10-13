import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Check, Copy, Tag, User, Layers, AlertCircle, FileText, Send, Sparkles, Plus, Trash2 } from 'lucide-react';
import { ActionItem, JiraConfig, JiraUser } from '../types';
import { DEFAULT_JIRA_USERS } from '../utils/storage';
import { JiraConfirmModal } from './JiraConfirmModal';

interface JiraTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ActionItem | null;
  jiraConfig: JiraConfig;
  jiraUsers?: JiraUser[];
  onSyncSingleItem: (item: ActionItem) => Promise<void>;
  onUpdateItem: (updated: ActionItem) => void;
}

export const JiraTicketModal: React.FC<JiraTicketModalProps> = ({
  isOpen,
  onClose,
  item,
  jiraConfig,
  jiraUsers = DEFAULT_JIRA_USERS,
  onSyncSingleItem,
  onUpdateItem,
}) => {
  const [formData, setFormData] = useState<ActionItem | null>(item);
  const [copied, setCopied] = useState(false);
  const [newLabelInput, setNewLabelInput] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({ ...item });
    }
  }, [item]);

  if (!isOpen || !item || !formData) return null;

  const handleCopySummary = () => {
    navigator.clipboard.writeText(`${formData.title}\n\n${formData.description}\n\nResponsable: ${formData.assignee}`);
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

  const handleOpenConfirm = () => {
    onUpdateItem(formData);
    setShowConfirmModal(true);
  };

  const handleConfirmedSync = async (updatedItem?: ActionItem) => {
    const itemToSync = updatedItem || formData;
    onUpdateItem(itemToSync);
    await onSyncSingleItem(itemToSync);
    onClose();
  };

  const getIssueTypeBadge = (t: string) => {
    switch (t) {
      case 'Story': return 'bg-[#29E78C]/20 text-[#29E78C] border-[#29E78C]/30';
      case 'Bug': return 'bg-[#FF5038]/20 text-[#FF5038] border-[#FF5038]/30';
      case 'Spike': return 'bg-[#9B51E0]/20 text-[#9B51E0] border-[#9B51E0]/30';
      default: return 'bg-[#61BFED]/20 text-[#61BFED] border-[#61BFED]/30';
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto font-['Montserrat']">
        <div className="bg-[#1C1E20] border border-[#3E4247] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2E3135] bg-[#141517]">
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-md font-semibold border ${getIssueTypeBadge(formData.issueType)}`}>
                {formData.issueType}
              </span>
              <span className="text-xs font-mono font-medium text-slate-400">
                {formData.jiraTicketKey || `${jiraConfig.projectKey}-DRAFT`}
              </span>
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
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                      formData.isClosedMatch
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-[#61BFED]/15 text-[#61BFED] border-[#61BFED]/30'
                    }`}>
                      {formData.isClosedMatch ? 'Resuelta en Jira' : 'En Curso en Jira'}: {formData.matchedJiraKey}
                    </span>
                    {formData.matchConfidence && (
                      <span className="text-[10px] text-slate-400">
                        Coincidencia: {formData.matchConfidence}
                      </span>
                    )}
                  </div>
                  {formData.matchedJiraKey && (
                    <a
                      href={`https://${(jiraConfig.domain || 'atlassian.net').replace(/^https?:\/\//, '')}/browse/${formData.matchedJiraKey}`}
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
                  <p className="text-xs text-slate-300 italic">
                    💡 {formData.matchReason}
                  </p>
                )}
                {formData.proposedComment && (
                  <div className="pt-2 border-t border-[#2A2C2F] space-y-1">
                    <span className="text-[11px] font-bold text-white block">Comentario sugerido para Jira:</span>
                    <textarea
                      rows={2}
                      value={formData.proposedComment}
                      onChange={(e) => setFormData({ ...formData, proposedComment: e.target.value })}
                      className="w-full bg-[#1C1E20] border border-[#2E3135] rounded-lg p-2 text-xs text-slate-200 focus:outline-hidden focus:border-[#FF5038]"
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
                    ) && (
                      <option value={formData.assignee}>
                        {formData.assignee} (Detectado)
                      </option>
                    )}
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
                  onChange={(e) => setFormData({ ...formData, storyPoints: parseInt(e.target.value, 10) || 1 })}
                  className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-lg px-2 py-1 text-xs text-amber-300 font-mono font-bold focus:outline-hidden focus:border-[#FF5038]"
                />
              </div>

              <div>
                <span className="block text-[11px] text-slate-400 font-medium mb-1">Tipo de Incidencia</span>
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
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-[#141517] border border-[#3E4247] rounded-xl p-3 text-slate-200 text-xs focus:outline-hidden focus:border-[#FF5038] leading-relaxed"
              />
            </div>

            {/* Editable Acceptance Criteria */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-white font-['Lato']">
                  Criterios de Aceptación (Acceptance Criteria)
                </label>
                <button
                  type="button"
                  onClick={handleAddCriteria}
                  className="text-[11px] text-[#EE880E] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Criterio</span>
                </button>
              </div>
              <div className="space-y-2 bg-[#141517] p-3.5 rounded-2xl border border-[#2A2C2F]">
                {(formData.acceptanceCriteria || []).map((criterion, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className="text-[#29E78C] font-bold shrink-0">✓</span>
                    <input
                      type="text"
                      value={criterion}
                      onChange={(e) => handleUpdateCriteria(idx, e.target.value)}
                      placeholder="Escribe el criterio de aceptación..."
                      className="w-full bg-[#1C1E20] border border-[#3E4247] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-hidden focus:border-[#FF5038]"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCriteria(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded-md transition-colors shrink-0"
                      title="Eliminar criterio"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
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
                <textarea
                  rows={4}
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
                      <span key={i} className="bg-[#25282B] text-slate-200 text-[11px] px-2 py-0.5 rounded-md font-mono flex items-center gap-1.5 border border-[#3E4247]">
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
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#2E3135] bg-[#141517]">
            <div className="text-xs text-slate-400">
              {formData.jiraStatus === 'synced' ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Sincronizado en Jira ({formData.jiraTicketKey})
                </span>
              ) : (
                <span>Destino: Proyecto <strong className="text-white">{jiraConfig.projectKey}</strong></span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onUpdateItem(formData);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl text-slate-300 hover:text-white text-xs font-medium hover:bg-[#25282B] transition-colors cursor-pointer"
              >
                Guardar Cambios
              </button>

              <button
                type="button"
                onClick={handleOpenConfirm}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white text-xs font-bold shadow-md shadow-[#FF5038]/25 transition-colors cursor-pointer font-['Lato']"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{formData.jiraStatus === 'synced' ? 'Actualizar en Jira' : 'Crear en Tablero Jira'}</span>
              </button>
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
      />
    </>
  );
};

