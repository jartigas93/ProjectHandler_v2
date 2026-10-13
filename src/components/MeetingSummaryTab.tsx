import React, { useState } from 'react';
import {
  Sparkles,
  User,
  Users,
  CheckCircle2,
  Calendar,
  Layers,
  Send,
  ExternalLink,
  Copy,
  Check,
  Tag,
  ArrowRight,
  BookmarkCheck,
  AlertCircle,
  FileSpreadsheet,
  Edit3,
  Clock,
  Briefcase,
  Share2,
  GitCommit,
  RefreshCw,
  AlertTriangle,
  UserPlus,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  TableProperties,
  X,
  Mail,
  BookmarkPlus,
  FolderArchive,
  MessageSquare,
  Unlink,
} from 'lucide-react';
import { MeetingAnalysis, ActionItem, JiraConfig, OrphanCommitment, Priority, JiraUser } from '../types';
import { DEFAULT_JIRA_USERS } from '../utils/storage';
import { formatTeamsMessageSummary } from '../utils/exportUtils';
import { DependencyFlowView } from './DependencyFlowView';
import { ConfluencePublishModal } from './ConfluencePublishModal';
import { RACIMatrixView } from './RACIMatrixView';
import { CompactTableView } from './CompactTableView';
import { JiraConfirmModal } from './JiraConfirmModal';
import { EmailShareModal } from './EmailShareModal';

interface MeetingSummaryTabProps {
  meeting: MeetingAnalysis | null;
  jiraConfig: JiraConfig;
  jiraUsers?: JiraUser[];
  onSyncSingleItem: (item: ActionItem) => Promise<void>;
  onBatchSyncAll: () => Promise<void>;
  isBatchSyncing: boolean;
  onOpenTicketDetails: (item: ActionItem) => void;
  onSaveToTopicHistory: () => void;
  savedToHistory: boolean;
  onSaveMeetingSummary: (meeting: MeetingAnalysis) => void;
  savedMeeting: boolean;
  onGoToSavedMeetings?: () => void;
  onBackToInput: () => void;
  onBidirectionalSync?: () => Promise<void>;
  isSyncingStatuses?: boolean;
  onAssignOrphan?: (orphan: OrphanCommitment, assigneeName: string) => void;
  onAddComment?: (item: ActionItem, customComment?: string) => Promise<void>;
  onToggleTaskKind?: (itemId: string) => void;
}

type ViewMode = 'cards' | 'compact' | 'dependencies' | 'raci';

export const MeetingSummaryTab: React.FC<MeetingSummaryTabProps> = ({
  meeting,
  jiraConfig,
  jiraUsers = DEFAULT_JIRA_USERS,
  onSyncSingleItem,
  onBatchSyncAll,
  isBatchSyncing,
  onOpenTicketDetails,
  onSaveToTopicHistory,
  savedToHistory,
  onSaveMeetingSummary,
  savedMeeting,
  onGoToSavedMeetings,
  onBackToInput,
  onBidirectionalSync,
  isSyncingStatuses = false,
  onAssignOrphan,
  onAddComment,
  onToggleTaskKind,
}) => {
  const [selectedParticipant, setSelectedParticipant] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'synced' | 'pending'>('all');
  const [selectedKind, setSelectedKind] = useState<'all' | 'new' | 'existing'>('all');

  const [copiedTeamsMsg, setCopiedTeamsMsg] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);
  const [sendingCommentItemId, setSendingCommentItemId] = useState<string | null>(null);
  const [editingComments, setEditingComments] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [isConfluenceOpen, setIsConfluenceOpen] = useState(false);
  const [showOrphanDetails, setShowOrphanDetails] = useState(false);
  const [showCapacityDetails, setShowCapacityDetails] = useState(false);
  const [itemToConfirm, setItemToConfirm] = useState<ActionItem | null>(null);

  if (!meeting) {
    return (
      <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-12 text-center max-w-lg mx-auto my-12 space-y-4 font-['Montserrat']">
        <div className="w-14 h-14 bg-[#FF5038]/10 border border-[#FF5038]/20 rounded-2xl flex items-center justify-center mx-auto text-[#FF5038]">
          <Calendar className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-white font-['Lato']">No hay ninguna reunión analizada todavía</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Ingresa o pega la transcripción o notas de la reunión en la pestaña
          &ldquo;Procesar Transcripción&rdquo; para generar el resumen inteligente y los tickets de Jira.
        </p>
        <button
          onClick={onBackToInput}
          className="px-5 py-2.5 bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white rounded-xl text-xs font-bold shadow-md shadow-[#FF5038]/25 transition-all inline-flex items-center gap-2 font-['Lato']"
        >
          <span>Ir a Procesar Transcripción</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const handleCopyTeamsSummary = () => {
    const text = formatTeamsMessageSummary(meeting);
    navigator.clipboard.writeText(text);
    setCopiedTeamsMsg(true);
    setTimeout(() => setCopiedTeamsMsg(false), 2500);
  };

  const handleSyncItem = (item: ActionItem) => {
    setItemToConfirm(item);
  };

  const handleConfirmedSync = async (updatedItem?: ActionItem) => {
    const targetItem = updatedItem || itemToConfirm;
    if (!targetItem) return;
    setSyncingItemId(targetItem.id);
    try {
      await onSyncSingleItem(targetItem);
    } finally {
      setSyncingItemId(null);
    }
  };

  // Filter items
  const filteredActionItems = meeting.actionItems.filter((item) => {
    if (selectedParticipant !== 'all' && item.assignee.toLowerCase() !== selectedParticipant.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.topicName.toLowerCase().includes(q) ||
        item.assignee.toLowerCase().includes(q) ||
        (item.jiraTicketKey && item.jiraTicketKey.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (selectedPriority !== 'all' && item.priority !== selectedPriority) {
      return false;
    }
    if (selectedStatus === 'synced' && item.jiraStatus !== 'synced') {
      return false;
    }
    if (selectedStatus === 'pending' && item.jiraStatus === 'synced') {
      return false;
    }
    if (selectedKind === 'new' && (item.taskKind === 'existing' || Boolean(item.matchedJiraKey))) {
      return false;
    }
    if (selectedKind === 'existing' && item.taskKind !== 'existing' && !item.matchedJiraKey) {
      return false;
    }
    return true;
  });

  const handleSendComment = async (item: ActionItem) => {
    if (!onAddComment) return;
    setSendingCommentItemId(item.id);
    try {
      const text = editingComments[item.id] !== undefined ? editingComments[item.id] : item.proposedComment;
      await onAddComment(item, text);
    } finally {
      setSendingCommentItemId(null);
    }
  };

  const totalPoints = meeting.actionItems.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0);
  const syncedCount = meeting.actionItems.filter((i) => i.jiraStatus === 'synced').length;
  const newTasksCount = meeting.actionItems.filter((i) => i.taskKind !== 'existing' && !i.matchedJiraKey).length;
  const existingTasksCount = meeting.actionItems.filter((i) => i.taskKind === 'existing' || Boolean(i.matchedJiraKey)).length;
  const unsyncedNewCount = meeting.actionItems.filter((i) => (i.taskKind !== 'existing' && !i.matchedJiraKey) && i.jiraStatus !== 'synced').length;

  // Participant capacities (Default recommended limit: 8 story points per sprint)
  const participantCapacities = meeting.participants.map((p) => {
    const assignedTasks = meeting.actionItems.filter(
      (a) => a.assignee.toLowerCase() === p.name.toLowerCase()
    );
    const points = assignedTasks.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    const limit = p.capacityLimit || 8;
    const isOverloaded = points > limit;
    const percent = Math.min(100, Math.round((points / limit) * 100));
    return {
      ...p,
      tasksCount: assignedTasks.length,
      points,
      limit,
      percent,
      isOverloaded,
    };
  });

  const overloadedParticipants = participantCapacities.filter((p) => p.isOverloaded);

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'Highest': return 'bg-[#FF5038]/20 text-[#FF5038] border-[#FF5038]/40';
      case 'High': return 'bg-[#EE880E]/20 text-[#EE880E] border-[#EE880E]/40';
      case 'Medium': return 'bg-[#FFAD32]/20 text-[#FFAD32] border-[#FFAD32]/40';
      case 'Low': return 'bg-[#61BFED]/20 text-[#61BFED] border-[#61BFED]/40';
      default: return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const getIssueTypeBadge = (t: string) => {
    switch (t) {
      case 'Story': return 'bg-[#29E78C]/20 text-[#29E78C] border-[#29E78C]/30';
      case 'Bug': return 'bg-[#FF5038]/20 text-[#FF5038] border-[#FF5038]/30';
      case 'Spike': return 'bg-[#9B51E0]/20 text-[#9B51E0] border-[#9B51E0]/30';
      default: return 'bg-[#61BFED]/20 text-[#61BFED] border-[#61BFED]/30';
    }
  };

  const clearFilters = () => {
    setSelectedParticipant('all');
    setSearchQuery('');
    setSelectedPriority('all');
    setSelectedStatus('all');
    setSelectedKind('all');
  };

  const hasActiveFilters =
    selectedParticipant !== 'all' ||
    searchQuery.trim().length > 0 ||
    selectedPriority !== 'all' ||
    selectedStatus !== 'all' ||
    selectedKind !== 'all';

  return (
    <div className="space-y-6 font-['Montserrat'] animate-in fade-in duration-150">
      {/* Meeting Header Top Card */}
      <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-6 shadow-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-[#FF5038]/15 text-[#FF5038] border border-[#FF5038]/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                Reunión Procesada &bull; ProyectHandler
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {meeting.meetingDate}
              </span>
              <span className="text-xs text-slate-400">
                Destino Jira: <strong className="text-white font-mono">[{jiraConfig.projectKey}]</strong>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-['Lato']">
              {meeting.meetingTitle}
            </h1>
          </div>

          {/* Top Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              onClick={() => setIsConfluenceOpen(true)}
              className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-[#25282B] hover:bg-[#2E3236] text-slate-200 border border-[#3E4247] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              title="Publicar acta en Confluence o SharePoint"
            >
              <Share2 className="w-3.5 h-3.5 text-[#EE880E]" />
              <span>Confluence / SharePoint</span>
            </button>

            <button
              onClick={() => setIsEmailModalOpen(true)}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-[#25282B] hover:bg-[#2E3236] text-slate-200 border border-[#3E4247] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              title="Compartir resumen profesional por correo electrónico al cliente (sin emoticones y con asunto)"
            >
              <Mail className="w-3.5 h-3.5 text-[#EE880E]" />
              <span>Compartir por mail</span>
            </button>

            <button
              onClick={() => onSaveMeetingSummary(meeting)}
              className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                savedMeeting
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                  : 'bg-[#25282B] hover:bg-[#2E3236] text-slate-200 border-[#3E4247]'
              }`}
              title="Guardar el resumen de esta reunión para buscarlo por mes y fecha en el Histórico de Reuniones"
            >
              <BookmarkCheck className={`w-4 h-4 ${savedMeeting ? 'text-[#29E78C]' : 'text-slate-400'}`} />
              <span>{savedMeeting ? '✓ Resumen Guardado' : 'Guardar Resumen'}</span>
            </button>

            {onGoToSavedMeetings && (
              <button
                onClick={onGoToSavedMeetings}
                className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-[#25282B] hover:bg-[#2E3236] text-slate-200 border border-[#3E4247] text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                title="Ir al Histórico de Reuniones para buscar por mes y fecha"
              >
                <FolderArchive className="w-3.5 h-3.5 text-[#61BFED]" />
                <span>Histórico de Reuniones</span>
              </button>
            )}

            {onBidirectionalSync && (
              <button
                onClick={onBidirectionalSync}
                disabled={isSyncingStatuses || syncedCount === 0}
                className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-[#25282B] hover:bg-[#2E3236] text-slate-200 border border-[#3E4247] text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                title="Sincronizar estados bidireccionales desde Jira Cloud"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#61BFED] ${isSyncingStatuses ? 'animate-spin' : ''}`} />
                <span>{isSyncingStatuses ? 'Consultando Jira...' : 'Sincronizar Estados'}</span>
              </button>
            )}

            <button
              onClick={onSaveToTopicHistory}
              disabled={savedToHistory}
              className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                savedToHistory
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                  : 'bg-[#25282B] hover:bg-[#2E3236] text-slate-200 border-[#3E4247]'
              }`}
            >
              <BookmarkCheck className={`w-4 h-4 ${savedToHistory ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{savedToHistory ? 'En Temas' : 'Guardar en Temas'}</span>
            </button>

            <button
              onClick={onBatchSyncAll}
              disabled={isBatchSyncing || unsyncedNewCount === 0}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white text-xs font-bold shadow-md shadow-[#FF5038]/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 font-['Lato']"
              title="Crea en Jira las tareas nuevas acordadas en la reunión"
            >
              <Send className={`w-3.5 h-3.5 ${isBatchSyncing ? 'animate-pulse' : ''}`} />
              <span>
                {isBatchSyncing
                  ? 'Sincronizando...'
                  : unsyncedNewCount === 0
                  ? 'Nuevas Sincronizadas'
                  : `Crear Nuevas en Jira (${unsyncedNewCount})`}
              </span>
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[#2E3135]">
          <div className="bg-[#141517] p-3 rounded-xl border border-[#2A2C2F]">
            <span className="text-[11px] text-slate-400 block font-medium">Tareas Nuevas</span>
            <span className="text-lg font-bold text-white mt-0.5 block flex items-center gap-1.5">
              <span>{newTasksCount}</span>
              {unsyncedNewCount > 0 && (
                <span className="text-[10px] text-[#EE880E] font-normal font-mono">({unsyncedNewCount} pendientes)</span>
              )}
            </span>
          </div>
          <div className="bg-[#141517] p-3 rounded-xl border border-[#2A2C2F]">
            <span className="text-[11px] text-slate-400 block font-medium">En Curso en Jira</span>
            <span className="text-lg font-bold text-[#61BFED] mt-0.5 block flex items-center gap-1.5">
              <span>{existingTasksCount}</span>
              <span className="text-[10px] text-slate-400 font-normal">vinculadas</span>
            </span>
          </div>
          <div className="bg-[#141517] p-3 rounded-xl border border-[#2A2C2F]">
            <span className="text-[11px] text-slate-400 block font-medium">Story Points Totales</span>
            <span className="text-lg font-bold text-[#EE880E] mt-0.5 block">{totalPoints} pts</span>
          </div>
          <div className="bg-[#141517] p-3 rounded-xl border border-[#2A2C2F]">
            <span className="text-[11px] text-slate-400 block font-medium">Sincronizados en Jira</span>
            <span className="text-lg font-bold text-[#29E78C] mt-0.5 block">
              {syncedCount} / {meeting.actionItems.length}
            </span>
          </div>
        </div>
      </div>

      {/* Friendly Workload & Capacity Drawer (Collapsed by default, clean & non-intrusive) */}
      <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => setShowCapacityDetails(!showCapacityDetails)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#222428] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-[#EE880E]" />
            <div>
              <span className="text-xs font-bold text-white font-['Lato'] block">
                Balance de Carga y Capacidad del Equipo (Sprint Velocity)
              </span>
              <span className="text-[11px] text-slate-400 font-['Montserrat'] block mt-0.5">
                {overloadedParticipants.length > 0 ? (
                  <span className="text-[#FF5038] font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {overloadedParticipants.length} miembro{overloadedParticipants.length > 1 ? 's' : ''} supera{overloadedParticipants.length > 1 ? 'n' : ''} el límite sugerido de 8 pts.
                  </span>
                ) : (
                  'Todos los participantes están dentro de la capacidad de sprint recomendada.'
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <span>{showCapacityDetails ? 'Ocultar balance' : 'Ver balance'}</span>
            {showCapacityDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showCapacityDetails && (
          <div className="p-4 pt-1 border-t border-[#2A2C2F] bg-[#141517] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-150">
            {participantCapacities.map((p) => (
              <div
                key={p.name}
                className={`p-3 rounded-xl border ${
                  p.isOverloaded
                    ? 'bg-[#261715] border-[#FF5038]/40'
                    : 'bg-[#1C1E20] border-[#2A2C2F]'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-white truncate">{p.name}</span>
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      p.isOverloaded ? 'text-[#FF5038]' : 'text-slate-300'
                    }`}
                  >
                    {p.points} / {p.limit} pts
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-[#121315] rounded-full h-1.5 overflow-hidden mb-1.5">
                  <div
                    className={`h-full rounded-full transition-all ${
                      p.isOverloaded
                        ? 'bg-[#FF5038]'
                        : p.points > 6
                        ? 'bg-[#EE880E]'
                        : 'bg-[#29E78C]'
                    }`}
                    style={{ width: `${Math.min(100, (p.points / p.limit) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{p.tasksCount} tarea{p.tasksCount !== 1 ? 's' : ''}</span>
                  <span>{p.isOverloaded ? '⚠️ Sobrecarga' : 'Óptimo'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Friendly Orphan Commitments Drawer (Clean collapsible) */}
      {meeting.orphanCommitments && meeting.orphanCommitments.length > 0 && (
        <div className="bg-[#241F18] border border-[#EE880E]/40 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#EE880E]" />
              <div>
                <span className="text-xs font-bold text-white font-['Lato'] block">
                  {meeting.orphanCommitments.length} Compromiso{meeting.orphanCommitments.length > 1 ? 's' : ''} sin asignar detectado{meeting.orphanCommitments.length > 1 ? 's' : ''}
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Se mencionaron en la reunión pero no tuvieron un responsable explícito.
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowOrphanDetails(!showOrphanDetails)}
              className="px-3 py-1 bg-[#2C241B] hover:bg-[#382D22] text-[#EE880E] border border-[#EE880E]/30 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <span>{showOrphanDetails ? 'Cerrar' : 'Asignar en 1 clic'}</span>
              {showOrphanDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showOrphanDetails && (
            <div className="p-4 pt-1 border-t border-[#3A2F22] space-y-2 bg-[#1B1713] animate-in fade-in duration-150">
              {meeting.orphanCommitments.map((orphan) => (
                <div
                  key={orphan.id}
                  className="bg-[#141517] p-3 rounded-xl border border-[#2A2C2F] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-white block">{orphan.title}</span>
                    <span className="text-[11px] text-slate-400 block">{orphan.context}</span>
                  </div>
                  {onAssignOrphan && (
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        id={`orphan-assignee-${orphan.id}`}
                        defaultValue={orphan.suggestedAssignee || meeting.participants[0]?.name || ''}
                        className="bg-[#1C1E20] border border-[#3E4247] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-hidden focus:border-[#FF5038]"
                      >
                        <optgroup label="Participantes de la reunión">
                          {meeting.participants.map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.name} ({p.role})
                            </option>
                          ))}
                        </optgroup>
                        {jiraUsers && jiraUsers.length > 0 && (
                          <optgroup label="Usuarios de Jira configurados">
                            {jiraUsers.map((u) => (
                              <option key={u.accountId || u.displayName} value={u.displayName}>
                                {u.displayName} {u.role ? `(${u.role})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <button
                        onClick={() => {
                          const sel = document.getElementById(`orphan-assignee-${orphan.id}`) as HTMLSelectElement;
                          const chosen = sel ? sel.value : (orphan.suggestedAssignee || meeting.participants[0]?.name);
                          onAssignOrphan(orphan, chosen);
                        }}
                        className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white text-xs font-bold flex items-center gap-1 shadow-xs"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Asignar</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2-Columns: Executive Summary & Key Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Executive Summary */}
        <div className="lg:col-span-2 bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2 font-['Lato']">
            <Sparkles className="w-4 h-4 text-[#EE880E]" />
            Resumen Ejecutivo de la Sesión
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line font-['Montserrat']">
            {meeting.executiveSummary}
          </p>
        </div>

        {/* Key Decisions */}
        <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2 font-['Lato']">
            <CheckCircle2 className="w-4 h-4 text-[#29E78C]" />
            Acuerdos y Decisiones Aprobadas
          </h2>
          <div className="space-y-2">
            {meeting.keyDecisions.map((decision, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 bg-[#141517] p-2.5 rounded-xl border border-[#2A2C2F]">
                <span className="text-[#29E78C] font-bold mt-0.5">•</span>
                <span className="leading-snug">{decision}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* View Mode Segmented Controls (Friendly User & Anti-Clutter) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#1C1E20] border border-[#2E3135] p-2.5 rounded-2xl">
        <div className="flex items-center gap-2 px-2">
          <Layers className="w-4 h-4 text-[#FF5038]" />
          <span className="text-xs font-bold text-white font-['Lato']">
            Visualización de Tareas & Compromisos:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-[#141517] p-1 rounded-xl border border-[#2A2C2F]">
          <button
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'cards'
                ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Tarjetas Jira</span>
          </button>

          <button
            onClick={() => setViewMode('compact')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'compact'
                ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Lista Compacta</span>
          </button>

          <button
            onClick={() => setViewMode('dependencies')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'dependencies'
                ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>Dependencias ({meeting.dependencies?.length || 0})</span>
          </button>

          <button
            onClick={() => setViewMode('raci')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'raci'
                ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5" />
            <span>Matriz RACI</span>
          </button>
        </div>
      </div>

      {/* Conditionally Render View Modes */}
      {viewMode === 'dependencies' ? (
        <DependencyFlowView
          dependencies={meeting.dependencies || []}
          actionItems={meeting.actionItems}
          onOpenTicketDetails={onOpenTicketDetails}
        />
      ) : viewMode === 'raci' ? (
        <RACIMatrixView
          raciData={meeting.raciMatrix}
          participants={meeting.participants}
          actionItems={meeting.actionItems}
        />
      ) : (
        /* Tasks List: Either Cards or Compact View, with Search & Filters */
        <div className="space-y-4">
          {/* Smart Filter Bar (Friendly User: Compact & Quick) */}
          <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-4 space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por título, contexto técnico o clave Jira..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#141517] border border-[#2A2C2F] rounded-xl pl-8 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[#FF5038]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Priority & Status Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="bg-[#141517] border border-[#2A2C2F] rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-[#FF5038]"
                >
                  <option value="all">Todas las Prioridades</option>
                  <option value="Highest">Prioridad Highest</option>
                  <option value="High">Prioridad High</option>
                  <option value="Medium">Prioridad Medium</option>
                  <option value="Low">Prioridad Low</option>
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as any)}
                  className="bg-[#141517] border border-[#2A2C2F] rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-[#FF5038]"
                >
                  <option value="all">Todos los Estados</option>
                  <option value="pending">Solo Pendientes Jira</option>
                  <option value="synced">Solo Sincronizados</option>
                </select>

                <select
                  value={selectedKind}
                  onChange={(e) => setSelectedKind(e.target.value as any)}
                  className="bg-[#141517] border border-[#2A2C2F] rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-[#FF5038]"
                >
                  <option value="all">Tipo de Tarea (Todas)</option>
                  <option value="new">Solo Nuevas ({newTasksCount})</option>
                  <option value="existing">Solo En Curso Jira ({existingTasksCount})</option>
                </select>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-slate-400 hover:text-[#FF5038] px-2 py-1 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Limpiar filtros</span>
                  </button>
                )}
              </div>
            </div>

            {/* Participant Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#2A2C2F]">
              <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
                <User className="w-3 h-3 text-[#FF5038]" />
                Responsable:
              </span>
              <button
                onClick={() => setSelectedParticipant('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedParticipant === 'all'
                    ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-xs'
                    : 'bg-[#25282B] text-slate-300 hover:bg-[#2F3236]'
                }`}
              >
                Todos ({meeting.actionItems.length})
              </button>
              {participantCapacities.map((p) => {
                const count = meeting.actionItems.filter(
                  (i) => i.assignee.toLowerCase() === p.name.toLowerCase()
                ).length;
                return (
                  <button
                    key={p.name}
                    onClick={() => setSelectedParticipant(p.name)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      selectedParticipant.toLowerCase() === p.name.toLowerCase()
                        ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-xs'
                        : 'bg-[#25282B] text-slate-300 hover:bg-[#2F3236]'
                    }`}
                  >
                    <span>{p.name.split(' ')[0]}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        p.isOverloaded
                          ? 'bg-rose-500 text-white'
                          : 'bg-black/40 text-slate-300'
                      }`}
                    >
                      {count} ({p.points}p)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Mostrando <strong className="text-white">{filteredActionItems.length}</strong> de {meeting.actionItems.length} tareas
            </span>
          </div>

          {/* Mode 1: Compact View */}
          {viewMode === 'compact' ? (
            <CompactTableView
              items={filteredActionItems}
              jiraConfig={jiraConfig}
              onSyncSingleItem={handleSyncItem}
              onOpenTicketDetails={onOpenTicketDetails}
              syncingItemId={syncingItemId}
              getPriorityBadge={getPriorityBadge}
              getIssueTypeBadge={getIssueTypeBadge}
            />
          ) : (
            /* Mode 2: Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredActionItems.map((item) => {
                const isSyncing = syncingItemId === item.id;
                const isSynced = item.jiraStatus === 'synced';

                return (
                  <div
                    key={item.id}
                    className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-5 shadow-sm hover:border-[#3E4247] transition-all flex flex-col justify-between space-y-4"
                  >
                    {/* Card Top: Badges & Jira Key */}
                    <div>
                      {/* Task Kind Banner: Existing vs New */}
                      {item.taskKind === 'existing' || Boolean(item.matchedJiraKey) ? (
                        <div className="mb-3 bg-[#25282B] p-2.5 rounded-xl border border-[#3E4247] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {item.isClosedMatch ? (
                              <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shrink-0">
                                <AlertTriangle className="w-3 h-3" />
                                Ya Resuelta en Jira: {item.matchedJiraKey}
                              </span>
                            ) : (
                              <span className="text-[10px] bg-[#61BFED]/20 text-[#61BFED] border border-[#61BFED]/30 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shrink-0">
                                <RefreshCw className="w-3 h-3" />
                                En Curso en Jira: {item.matchedJiraKey}
                              </span>
                            )}
                            {item.matchConfidence && (
                              <span className="text-[9px] text-slate-400 hidden sm:inline">
                                Confianza {item.matchConfidence}
                              </span>
                            )}
                          </div>
                          {onToggleTaskKind && (
                            <button
                              onClick={() => onToggleTaskKind(item.id)}
                              title="Desvincular y convertir en una tarea nueva independiente"
                              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 shrink-0 hover:underline cursor-pointer"
                            >
                              <Unlink className="w-3 h-3" />
                              <span>Tratar como nueva</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="mb-2.5 flex items-center justify-between gap-2">
                          <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Tarea Nueva para Jira
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${getIssueTypeBadge(item.issueType)}`}>
                            {item.issueType}
                          </span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${getPriorityBadge(item.priority)}`}>
                            {item.priority}
                          </span>
                          <span className="text-[11px] bg-[#141517] text-slate-300 px-2 py-0.5 rounded-md font-mono border border-[#2A2C2F]">
                            {item.storyPoints} pts
                          </span>
                          {item.jiraIssueStatus && (
                            <span
                              title={item.jiraLastSyncedFromJiraAt ? `Última sincronización con Jira: ${new Date(item.jiraLastSyncedFromJiraAt).toLocaleString('es-ES')}` : 'Estado en Jira'}
                              className="text-[10px] bg-[#61BFED]/15 text-[#61BFED] border border-[#61BFED]/30 px-2 py-0.5 rounded-md font-bold"
                            >
                              {item.jiraIssueStatus}
                            </span>
                          )}
                        </div>

                        {isSynced ? (
                          <span className="text-[11px] text-[#29E78C] font-mono font-bold flex items-center gap-1 bg-emerald-950/40 border border-[#29E78C]/40 px-2 py-0.5 rounded-md">
                            <Check className="w-3 h-3" />
                            {item.jiraTicketKey}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">
                            {jiraConfig.projectKey}-Pendiente
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-white leading-snug font-['Lato']">
                        {item.title}
                      </h3>

                      <p className="text-xs text-slate-300 mt-2 line-clamp-3 leading-relaxed font-['Montserrat']">
                        {item.description}
                      </p>

                      {/* Match explanation note */}
                      {item.matchReason && (
                        <p className="text-[11px] text-slate-400 italic bg-[#141517] p-2 rounded-lg border border-[#2A2C2F] mt-2.5">
                          💡 <strong>Continuidad en Jira:</strong> {item.matchReason}
                        </p>
                      )}

                      {/* Proposed Comment for Existing Task */}
                      {item.proposedComment && (
                        <div className="bg-[#141517] p-3 rounded-xl border border-[#3E4247] space-y-2 mt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-white flex items-center gap-1.5 font-['Lato']">
                              <MessageSquare className="w-3.5 h-3.5 text-[#EE880E]" />
                              Comentario sugerido para Jira
                            </span>
                            {item.commentStatus === 'added' ? (
                              <span className="text-[10px] text-[#29E78C] font-semibold flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded border border-[#29E78C]/30">
                                <Check className="w-3 h-3" /> Publicado
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {item.matchedJiraKey}
                              </span>
                            )}
                          </div>
                          <textarea
                            rows={2}
                            value={editingComments[item.id] !== undefined ? editingComments[item.id] : item.proposedComment}
                            onChange={(e) => setEditingComments({ ...editingComments, [item.id]: e.target.value })}
                            placeholder="Comentario para registrar avances en Jira..."
                            className="w-full bg-[#1C1E20] border border-[#2E3135] rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-[#FF5038]"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleSendComment(item)}
                              disabled={sendingCommentItemId === item.id}
                              className="px-2.5 py-1 bg-[#EE880E]/20 hover:bg-[#EE880E]/30 text-[#EE880E] border border-[#EE880E]/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Send className={`w-3 h-3 ${sendingCommentItemId === item.id ? 'animate-pulse' : ''}`} />
                              <span>
                                {sendingCommentItemId === item.id
                                  ? 'Publicando...'
                                  : item.commentStatus === 'added'
                                  ? 'Actualizar Comentario'
                                  : 'Agregar a Jira'}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Assignee & Topic info */}
                    <div className="space-y-3 pt-3 border-t border-[#2E3135]">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#FF5038] to-[#EE880E] flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
                            {item.assignee.charAt(0)}
                          </div>
                          <div>
                            <span className="text-white font-semibold block">{item.assignee}</span>
                            <span className="text-[11px] text-[#EE880E] block">{item.topicName}</span>
                          </div>
                        </div>

                        {item.deadline && (
                          <div className="text-right text-[11px] text-slate-400">
                            <span className="block text-slate-500">Plazo comprometido:</span>
                            <span className="font-medium text-slate-300">{item.deadline}</span>
                          </div>
                        )}
                      </div>

                      {/* Acceptance Criteria preview (first 2 items) */}
                      {item.acceptanceCriteria && item.acceptanceCriteria.length > 0 && (
                        <div className="bg-[#141517] p-2.5 rounded-xl border border-[#2A2C2F] space-y-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                            Criterios de Aceptación ({item.acceptanceCriteria.length}):
                          </span>
                          {item.acceptanceCriteria.slice(0, 2).map((crit, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                              <span className="text-[#29E78C] font-bold shrink-0">✓</span>
                              <span className="truncate">{crit}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Labels */}
                      {item.jiraLabels && item.jiraLabels.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.jiraLabels.map((lbl, idx) => (
                            <span key={idx} className="text-[10px] bg-[#25282B] text-slate-400 px-2 py-0.5 rounded-sm font-mono border border-[#3E4247]">
                              #{lbl}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Card Bottom: Actions */}
                      <div className="flex items-center justify-between pt-1 gap-2">
                        <button
                          onClick={() => onOpenTicketDetails(item)}
                          className="px-3 py-1.5 rounded-lg bg-[#25282B] hover:bg-[#2E3236] text-slate-200 text-xs font-medium border border-[#3E4247] transition-colors flex items-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Detalles / Editar</span>
                        </button>

                        {isSynced ? (
                          <a
                            href={item.jiraTicketUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-[#29E78C] border border-[#29E78C]/40 text-xs font-semibold transition-colors flex items-center gap-1.5"
                          >
                            <span>Ver en Jira</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : item.taskKind === 'existing' || Boolean(item.matchedJiraKey) ? (
                          <a
                            href={item.jiraTicketUrl || `https://${(jiraConfig.domain || 'atlassian.net').replace(/^https?:\/\//, '')}/browse/${item.matchedJiraKey}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-[#61BFED]/15 hover:bg-[#61BFED]/25 text-[#61BFED] border border-[#61BFED]/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
                          >
                            <span>Abrir {item.matchedJiraKey}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <button
                            onClick={() => handleSyncItem(item)}
                            disabled={isSyncing}
                            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white text-xs font-bold shadow-xs shadow-[#FF5038]/25 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Send className={`w-3.5 h-3.5 ${isSyncing ? 'animate-pulse' : ''}`} />
                            <span>{isSyncing ? 'Creando...' : 'Crear en Jira'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confluence Publish Modal */}
      <ConfluencePublishModal
        isOpen={isConfluenceOpen}
        onClose={() => setIsConfluenceOpen(false)}
        meeting={meeting}
        jiraConfig={jiraConfig}
      />

      {/* Confirmation Modal before creating in Jira */}
      <JiraConfirmModal
        isOpen={Boolean(itemToConfirm)}
        onClose={() => setItemToConfirm(null)}
        onConfirm={handleConfirmedSync}
        item={itemToConfirm}
        jiraConfig={jiraConfig}
        jiraUsers={jiraUsers}
      />

      {/* Email Share Modal (Clean, professional, without emojis, with subject) */}
      <EmailShareModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        meeting={meeting}
      />
    </div>
  );
};
