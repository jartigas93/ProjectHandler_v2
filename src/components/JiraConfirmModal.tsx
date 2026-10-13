import React, { useState, useEffect } from 'react';
import { X, Send, CheckCircle2, User, Tag, Layers, Clock, AlertCircle, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { ActionItem, JiraConfig, JiraUser } from '../types';
import { DEFAULT_JIRA_USERS } from '../utils/storage';

interface JiraConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (itemToSync?: ActionItem) => Promise<void>;
  item: ActionItem | null;
  jiraConfig: JiraConfig;
  jiraUsers?: JiraUser[];
}

export const JiraConfirmModal: React.FC<JiraConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  item,
  jiraConfig,
  jiraUsers = DEFAULT_JIRA_USERS,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState(item?.assignee || '');

  useEffect(() => {
    if (item) {
      setSelectedAssignee(item.assignee || '');
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const updatedItem: ActionItem = {
        ...item,
        assignee: selectedAssignee,
      };
      await onConfirm(updatedItem);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLive = jiraConfig.simulationMode === false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200 font-['Montserrat']">
      <div className="bg-[#1C1E20] border border-[#3E4247] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#2E3135] bg-gradient-to-r from-[#1E2023] via-[#2A2321] to-[#1E2023] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF5038] to-[#EE880E] flex items-center justify-center text-white shadow-md shadow-[#FF5038]/20 shrink-0">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm font-['Lato'] flex items-center gap-2">
                <span>Confirmar Creación de Tarjeta en Jira</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Revisa los datos del ticket antes de sincronizarlo con Atlassian.
              </p>
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
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto text-xs">
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
                      <option value={selectedAssignee}>
                        {selectedAssignee} (Detectado)
                      </option>
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
          {item.acceptanceCriteria && item.acceptanceCriteria.length > 0 && (
            <div className="bg-[#141517] p-3.5 rounded-2xl border border-[#2A2C2F] space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                Criterios de Aceptación ({item.acceptanceCriteria.length})
              </span>
              <div className="space-y-1.5">
                {item.acceptanceCriteria.map((crit, idx) => (
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
                  <span key={idx} className="bg-[#25282B] text-slate-300 text-[10px] px-2 py-0.5 rounded-md font-mono border border-[#3E4247]">
                    #{lbl}
                  </span>
                ))}
              </div>
            )}

            {(item.technicalContext || item.description) && (
              <div className="bg-[#141517] p-3 rounded-xl border border-[#2A2C2F] text-[11px] text-slate-400 space-y-1">
                <span className="text-[10px] text-slate-500 block font-semibold">Contexto de la Reunión en Teams:</span>
                <p className="line-clamp-3 leading-relaxed text-slate-300">
                  {item.technicalContext || item.description}
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
            <span>{isSubmitting ? 'Creando en Jira...' : 'Confirmar y Crear en Jira'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
