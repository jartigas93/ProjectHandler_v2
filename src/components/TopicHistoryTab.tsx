import React, { useState } from 'react';
import {
  History,
  Search,
  Filter,
  Plus,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  User,
  ArrowUpRight,
  Download,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Tag,
  UserCheck,
  Settings,
  Users,
  Trash2,
  AlertCircle,
  X,
  GitMerge
} from 'lucide-react';
import { TopicHistoryRecord, TopicStatus, JiraUser } from '../types';
import { exportTopicsToCsv, downloadFile } from '../utils/exportUtils';
import { DEFAULT_TOPIC_CATEGORIES, DEFAULT_JIRA_USERS } from '../utils/storage';
import { AutoResizeTextarea } from './AutoResizeTextarea';

interface TopicHistoryTabProps {
  topics: TopicHistoryRecord[];
  onUpdateTopic: (topic: TopicHistoryRecord) => void;
  onAddNewTopic: (topic: TopicHistoryRecord) => void;
  onDeleteTopic: (topicId: string) => void;
  onClearAllTopics?: () => void;
  onMergeTopics?: (sourceTopicId: string, targetTopicId: string) => void;
  onGoToMonthlyReport: () => void;
  topicCategories?: string[];
  jiraUsers?: JiraUser[];
  onOpenSettings?: () => void;
}

export const TopicHistoryTab: React.FC<TopicHistoryTabProps> = ({
  topics,
  onUpdateTopic,
  onAddNewTopic,
  onDeleteTopic,
  onClearAllTopics,
  onMergeTopics,
  onGoToMonthlyReport,
  topicCategories = DEFAULT_TOPIC_CATEGORIES,
  jiraUsers = DEFAULT_JIRA_USERS,
  onOpenSettings,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState<{ [topicId: string]: string }>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [mergeSourceTopic, setMergeSourceTopic] = useState<TopicHistoryRecord | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');

  const effectiveCategories = topicCategories.length > 0 ? topicCategories : DEFAULT_TOPIC_CATEGORIES;
  const effectiveJiraUsers = jiraUsers.length > 0 ? jiraUsers : DEFAULT_JIRA_USERS;

  // New topic modal form
  const [newTopicForm, setNewTopicForm] = useState({
    topicName: '',
    category: effectiveCategories[0] || 'Backend & APIs',
    leadParticipant: effectiveJiraUsers[0]?.displayName || 'Carlos Mendoza',
    status: 'En Progreso' as TopicStatus,
    initialSummary: '',
  });

  const filteredTopics = topics.filter((t) => {
    const matchesSearch =
      t.topicName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.leadParticipant.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleStatusChange = (topic: TopicHistoryRecord, newStatus: TopicStatus) => {
    const progress = newStatus === 'Completado' ? 100 : newStatus === 'Pendiente' ? 10 : topic.progressPercent;
    onUpdateTopic({
      ...topic,
      status: newStatus,
      progressPercent: progress,
    });
  };

  const handleProgressChange = (topic: TopicHistoryRecord, newProgress: number) => {
    const status: TopicStatus = newProgress === 100 ? 'Completado' : topic.status === 'Completado' ? 'En Progreso' : topic.status;
    onUpdateTopic({
      ...topic,
      progressPercent: newProgress,
      status,
    });
  };

  const handleAddNote = (topic: TopicHistoryRecord) => {
    const note = newNoteText[topic.id]?.trim();
    if (!note) return;

    const updatedNotes = [...(topic.notes || []), `${new Date().toLocaleDateString('es-ES')}: ${note}`];
    onUpdateTopic({
      ...topic,
      notes: updatedNotes,
    });
    setNewNoteText({ ...newNoteText, [topic.id]: '' });
  };

  const handleCreateTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicForm.topicName.trim() || !newTopicForm.leadParticipant.trim()) return;

    const today = new Date().toISOString().split('T')[0];
    const newTopic: TopicHistoryRecord = {
      id: 'topic-' + Date.now(),
      topicName: newTopicForm.topicName.trim(),
      category: newTopicForm.category,
      firstDiscussedDate: today,
      lastDiscussedDate: today,
      meetings: [
        {
          meetingId: 'manual-' + Date.now(),
          meetingTitle: 'Alineación de Inicio',
          date: today,
          summary: newTopicForm.initialSummary || 'Iniciativa registrada para seguimiento de compromisos.',
        },
      ],
      status: newTopicForm.status,
      leadParticipant: newTopicForm.leadParticipant.trim(),
      allParticipants: [newTopicForm.leadParticipant.trim()],
      associatedJiraKeys: [],
      progressPercent: newTopicForm.status === 'Completado' ? 100 : 25,
      notes: [`${new Date().toLocaleDateString('es-ES')}: Tema creado para seguimiento continuo.`],
      updatedAt: new Date().toISOString(),
    };

    onAddNewTopic(newTopic);
    setShowAddModal(false);
    setNewTopicForm({
      topicName: '',
      category: 'Backend & APIs',
      leadParticipant: '',
      status: 'En Progreso',
      initialSummary: '',
    });
  };

  const handleExportCsv = () => {
    const csv = exportTopicsToCsv(topics);
    downloadFile(csv, `historico-temas-teams-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  };

  const getStatusBadge = (status: TopicStatus) => {
    switch (status) {
      case 'Completado':
        return 'bg-[#29E78C]/20 text-[#29E78C] border-[#29E78C]/40';
      case 'En Progreso':
        return 'bg-[#EE880E]/20 text-[#EE880E] border-[#EE880E]/40';
      case 'Bloqueado':
        return 'bg-[#FF5038]/20 text-[#FF5038] border-[#FF5038]/40';
      case 'Pendiente':
        return 'bg-[#FFAD32]/20 text-[#FFAD32] border-[#FFAD32]/40';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#FF5038]" />
            <h1 className="text-xl font-bold text-white tracking-tight font-['Lato']">
              Histórico & Trazabilidad de Temas Tratados
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl font-['Montserrat']">
            Guarda la evolución continua de cada iniciativa a través de las reuniones en Teams.
            Supervisa el estado, las personas responsables y los tickets de Jira asociados.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {topics.length > 0 && onClearAllTopics && (
            showClearConfirm ? (
              <div className="flex items-center gap-1.5 bg-rose-950/80 border border-rose-500/50 rounded-xl px-3 py-1.5 text-xs">
                <span className="text-[11px] text-rose-300">¿Vaciar histórico?</span>
                <button
                  onClick={() => {
                    onClearAllTopics();
                    setShowClearConfirm(false);
                  }}
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold"
                >
                  Sí, vaciar
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-[#25282B] hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-[#3E4247] hover:border-rose-500/40 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                title="Eliminar todos los temas del histórico"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vaciar Histórico</span>
              </button>
            )
          )}

          <button
            onClick={handleExportCsv}
            disabled={topics.length === 0}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-[#25282B] hover:bg-[#2E3236] text-slate-200 border border-[#3E4247] text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white text-xs font-bold shadow-md shadow-[#FF5038]/25 transition-all flex items-center justify-center gap-1.5 font-['Lato']"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Tema</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por tema, categoría o responsable..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[#FF5038]"
          />
        </div>

        {/* Category & Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#25282B] border border-[#3E4247] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-[#FF5038]"
          >
            <option value="all">Todas las Categorías</option>
            {effectiveCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-400 mr-1 hidden sm:inline">Estado:</span>
          {(['all', 'En Progreso', 'Completado', 'Bloqueado', 'Pendiente'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${statusFilter === st
                  ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-xs'
                  : 'bg-[#25282B] text-slate-300 hover:bg-[#2F3236]'
                }`}
            >
              {st === 'all' ? `Todos (${topics.length})` : st}
            </button>
          ))}
        </div>
      </div>

      {/* Topics List */}
      <div className="space-y-4">
        {topics.length === 0 ? (
          <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-12 text-center text-slate-400 text-xs space-y-3">
            <div className="w-12 h-12 bg-[#25282B] rounded-xl flex items-center justify-center mx-auto text-slate-400">
              <History className="w-6 h-6 text-[#FF5038]" />
            </div>
            <h3 className="text-sm font-bold text-white font-['Lato']">No hay temas registrados en el histórico</h3>
            <p className="max-w-md mx-auto text-slate-400 font-['Montserrat'] leading-relaxed">
              Analiza una reunión en la pestaña &ldquo;Procesar Transcripción&rdquo; o haz clic en &ldquo;Registrar Tema&rdquo; para agregar iniciativas a la trazabilidad continua.
            </p>
          </div>
        ) : filteredTopics.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
            No se encontraron temas coincidentes con el filtro de búsqueda.
          </div>
        ) : (
          filteredTopics.map((topic) => {
            const isExpanded = expandedTopicId === topic.id;

            return (
              <div
                key={topic.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm hover:border-slate-750 transition-all overflow-hidden"
              >
                {/* Topic Card Header */}
                <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-md font-medium border border-slate-700/80">
                        {topic.category}
                      </span>
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-semibold border ${getStatusBadge(topic.status)}`}>
                        {topic.status}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Tratado en {topic.meetings.length} {topic.meetings.length === 1 ? 'reunión' : 'reuniones'}
                      </span>
                      {topic.associatedJiraKeys && topic.associatedJiraKeys.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          {topic.associatedJiraKeys.map((k) => (
                            <span
                              key={k}
                              className="text-[10px] font-mono font-bold bg-[#1d2b4f] text-[#61BFED] border border-[#61BFED]/40 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs"
                            >
                              <Tag className="w-2.5 h-2.5 text-[#61BFED]" />
                              {k}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-white leading-snug">
                      {topic.topicName}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Responsable: <strong className="text-slate-200">{topic.leadParticipant}</strong></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Última discusión: {topic.lastDiscussedDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Progress Bar, Delete, Merge & Toggle */}
                  <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <div className="w-32 sm:w-36 space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                        <span>Avance</span>
                        <span className="text-white font-bold">{topic.progressPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${topic.progressPercent === 100
                              ? 'bg-emerald-500'
                              : topic.status === 'Bloqueado'
                                ? 'bg-rose-500'
                                : 'bg-indigo-500'
                            }`}
                          style={{ width: `${topic.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onMergeTopics && topics.length > 1 && (
                        <button
                          onClick={() => {
                            setMergeSourceTopic(topic);
                            const firstOther = topics.find((t) => t.id !== topic.id);
                            setMergeTargetId(firstOther ? firstOther.id : '');
                          }}
                          title="Fusionar este tema con otro tema abierto"
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <GitMerge className="w-3.5 h-3.5 text-[#EE880E]" />
                          <span className="hidden sm:inline">Fusionar</span>
                        </button>
                      )}

                      <button
                        onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors"
                      >
                        <span>{isExpanded ? 'Ocultar' : 'Historial & Notas'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {confirmDeleteId === topic.id ? (
                        <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-500/60 rounded-lg p-1 animate-in fade-in">
                          <span className="text-[10px] text-rose-300 font-semibold px-1">¿Borrar?</span>
                          <button
                            onClick={() => {
                              onDeleteTopic(topic.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold"
                          >
                            Sí
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(topic.id)}
                          title="Borrar tema del histórico"
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/50 hover:border-rose-500/50 text-slate-400 hover:text-rose-300 text-xs border border-slate-700/80 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Borrar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details: Timeline & Jira Tickets & Notes */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-3 border-t border-slate-800/80 bg-slate-950/40 space-y-5 animate-in fade-in duration-150">
                    {/* Status & Progress Quick Adjust */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">Actualizar Estado:</span>
                        {(['En Progreso', 'Completado', 'Bloqueado', 'Pendiente'] as TopicStatus[]).map((st) => (
                          <button
                            key={st}
                            onClick={() => handleStatusChange(topic, st)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${topic.status === st
                                ? getStatusBadge(st)
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">Ajustar Progreso:</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={topic.progressPercent}
                          onChange={(e) => handleProgressChange(topic, parseInt(e.target.value, 10))}
                          className="w-28 accent-indigo-500 cursor-pointer"
                        />
                        <span className="text-white font-mono text-xs w-8 text-right">{topic.progressPercent}%</span>
                      </div>
                    </div>

                    {/* Timeline of Meetings */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        Historial de Sesiones en Teams donde se trató este tema:
                      </h4>
                      <div className="space-y-2 border-l-2 border-slate-800 pl-3 ml-2">
                        {topic.meetings.map((m, idx) => (
                          <div key={idx} className="relative text-xs text-slate-300 space-y-0.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 absolute -left-[17px] top-1.5" />
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{m.meetingTitle}</span>
                              <span className="text-[11px] text-slate-500">({m.date})</span>
                            </div>
                            <p className="text-slate-400 text-[11px] leading-relaxed">{m.summary}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Associated Jira Tickets */}
                    {topic.associatedJiraKeys && topic.associatedJiraKeys.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-blue-400" />
                          Tickets de Jira Vinculados:
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {topic.associatedJiraKeys.map((key) => (
                            <span
                              key={key}
                              className="text-xs font-mono font-bold bg-blue-950/60 text-blue-300 border border-blue-500/40 px-2.5 py-1 rounded-lg flex items-center gap-1"
                            >
                              {key}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Progress Notes Log */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                        Notas de Seguimiento & Compromisos:
                      </h4>
                      <div className="space-y-1.5">
                        {topic.notes && topic.notes.length > 0 ? (
                          topic.notes.map((note, nIdx) => {
                            const isMeetingNote = note.includes('[') && note.includes(']:');
                            return (
                              <div
                                key={nIdx}
                                className={`text-xs p-2.5 rounded-lg border leading-relaxed flex items-start gap-2.5 ${isMeetingNote
                                    ? 'bg-slate-900/90 border-[#29E78C]/30 text-slate-200'
                                    : 'bg-slate-900 border-slate-800/80 text-slate-300'
                                  }`}
                              >
                                {isMeetingNote ? (
                                  <Calendar className="w-3.5 h-3.5 text-[#29E78C] shrink-0 mt-0.5" />
                                ) : (
                                  <MessageSquare className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <span>{note}</span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-xs text-slate-500 italic">No hay notas registradas todavía.</div>
                        )}
                      </div>

                      {/* Add Note Input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={newNoteText[topic.id] || ''}
                          onChange={(e) => setNewNoteText({ ...newNoteText, [topic.id]: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddNote(topic)}
                          placeholder="Añadir nota de progreso o actualización de bloqueo..."
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                        />
                        <button
                          onClick={() => handleAddNote(topic)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          Añadir Nota
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom CTA to Generate Monthly Report */}
      <div className="bg-gradient-to-r from-[#211F24] via-[#2A2321] to-[#211F24] border border-[#FF5038]/30 rounded-2xl p-6 text-center space-y-3">
        <Sparkles className="w-6 h-6 text-[#EE880E] mx-auto" />
        <h3 className="text-base font-bold text-white font-['Lato']">¿Listo para exportar el reporte mensual de progreso?</h3>
        <p className="text-xs text-slate-300 max-w-xl mx-auto font-['Montserrat']">
          La IA de ProyectHandler sintetizará automáticamente todos los temas tratados, las tasas de cumplimiento por participante
          y los tickets cerrados en un reporte formal corporativo de Cívica exportable a PDF, Markdown o CSV.
        </p>
        <button
          onClick={onGoToMonthlyReport}
          className="px-5 py-2.5 bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white rounded-xl text-xs font-bold shadow-md shadow-[#FF5038]/25 transition-all inline-flex items-center gap-2 font-['Lato']"
        >
          <span>Ir al Generador de Reporte Mensual</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* Manual Add Topic Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-white">Registrar Nuevo Tema para Seguimiento</h2>
            <form onSubmit={handleCreateTopic} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Nombre del Tema / Iniciativa</label>
                <input
                  type="text"
                  required
                  value={newTopicForm.topicName}
                  onChange={(e) => setNewTopicForm({ ...newTopicForm, topicName: e.target.value })}
                  placeholder="Ej: Migración a Base de Datos Distribuida"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Categoría</label>
                  <select
                    value={newTopicForm.category}
                    onChange={(e) => setNewTopicForm({ ...newTopicForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  >
                    {effectiveCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-400 font-medium">Responsable Principal (Usuario Jira Real)</label>
                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddModal(false);
                          onOpenSettings();
                        }}
                        className="text-[10px] text-[#EE880E] hover:underline flex items-center gap-0.5"
                      >
                        <Settings className="w-2.5 h-2.5" />
                        <span>Ajustes</span>
                      </button>
                    )}
                  </div>
                  <select
                    value={newTopicForm.leadParticipant}
                    onChange={(e) => setNewTopicForm({ ...newTopicForm, leadParticipant: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  >
                    {effectiveJiraUsers.map((u) => (
                      <option key={u.accountId || u.displayName} value={u.displayName}>
                        {u.displayName} ({u.emailAddress}) &bull; {u.role || 'Jira User'}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-[#61BFED] flex items-center gap-1 mt-1 font-['Montserrat']">
                    <UserCheck className="w-3 h-3 text-[#61BFED] shrink-0" />
                    <span>
                      Usuario verificado de Jira Cloud &bull; Capacidad:{' '}
                      {effectiveJiraUsers.find((u) => u.displayName === newTopicForm.leadParticipant)?.capacityLimit || 8} pts
                    </span>
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Resumen Inicial del Tema</label>
                <AutoResizeTextarea
                  minRows={3}
                  value={newTopicForm.initialSummary}
                  onChange={(e) => setNewTopicForm({ ...newTopicForm, initialSummary: e.target.value })}
                  placeholder="Descripción de objetivos o compromisos iniciales..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white font-bold"
                >
                  Guardar Tema
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Merge Duplicate Topics Modal */}
      {mergeSourceTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#2E3135]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EE880E]/15 border border-[#EE880E]/30 flex items-center justify-center text-[#EE880E]">
                  <GitMerge className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-['Lato']">Fusionar Temas Duplicados</h3>
                  <p className="text-[11px] text-slate-400">Consolida sesiones, notas y tickets en un solo tema</p>
                </div>
              </div>
              <button
                onClick={() => setMergeSourceTopic(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-[#141517] p-3 rounded-xl border border-[#2A2C2F] space-y-1">
                <span className="text-[11px] text-slate-400 block font-medium">Tema que se fusionará (origen):</span>
                <span className="text-white font-bold block">{mergeSourceTopic.topicName}</span>
                <span className="text-[11px] text-slate-500 font-mono block">
                  {mergeSourceTopic.meetings.length} reuniones tratadas · {mergeSourceTopic.notes?.length || 0} notas
                  {mergeSourceTopic.associatedJiraKeys && mergeSourceTopic.associatedJiraKeys.length > 0
                    ? ` · Tickets: ${mergeSourceTopic.associatedJiraKeys.join(', ')}`
                    : ''}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 block">
                  Seleccionar tema de destino principal:
                </label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full bg-[#141517] border border-[#3E4247] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#FF5038]"
                >
                  {topics
                    .filter((t) => t.id !== mergeSourceTopic.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.topicName} ({t.category} - {t.meetings.length} reuniones)
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  Las reuniones tratadas, las notas históricas y las claves de Jira de ambos temas se unificarán en el tema de destino seleccionado. El tema origen será eliminado.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#2E3135]">
              <button
                onClick={() => setMergeSourceTopic(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (mergeSourceTopic && mergeTargetId && onMergeTopics) {
                    onMergeTopics(mergeSourceTopic.id, mergeTargetId);
                    setMergeSourceTopic(null);
                  }
                }}
                disabled={!mergeTargetId}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white text-xs font-bold shadow-md shadow-[#FF5038]/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>Confirmar Fusión</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
