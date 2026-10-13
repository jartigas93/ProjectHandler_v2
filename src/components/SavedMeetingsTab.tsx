import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  Users,
  CheckSquare,
  Mail,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  FolderArchive
} from 'lucide-react';
import { MeetingAnalysis } from '../types';
import { EmailShareModal } from './EmailShareModal';

interface SavedMeetingsTabProps {
  meetings: MeetingAnalysis[];
  onSelectMeeting: (meeting: MeetingAnalysis) => void;
  onDeleteMeeting: (meetingId: string) => void;
  onGoToTranscript: () => void;
}

export const SavedMeetingsTab: React.FC<SavedMeetingsTabProps> = ({
  meetings,
  onSelectMeeting,
  onDeleteMeeting,
  onGoToTranscript,
}) => {
  // Extract all distinct months available in saved meetings
  const monthOptions = useMemo(() => {
    const monthsSet = new Set<string>();
    meetings.forEach((m) => {
      if (m.meetingDate && m.meetingDate.length >= 7) {
        monthsSet.add(m.meetingDate.substring(0, 7));
      }
    });

    // Also include current month if none
    const currentMonth = new Date().toISOString().substring(0, 7);
    monthsSet.add(currentMonth);

    const sortedMonths = Array.from(monthsSet).sort().reverse();

    return sortedMonths.map((ym) => {
      const [year, month] = ym.split('-');
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
      return { value: ym, label: capitalized };
    });
  }, [meetings]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return monthOptions.length > 0 ? monthOptions[0].value : new Date().toISOString().substring(0, 7);
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [meetingForEmail, setMeetingForEmail] = useState<MeetingAnalysis | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // Filter meetings by month and query
  const filteredMeetings = useMemo(() => {
    return meetings
      .filter((m) => {
        // Month filter
        if (selectedMonth !== 'all' && (!m.meetingDate || !m.meetingDate.startsWith(selectedMonth))) {
          return false;
        }

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = m.meetingTitle.toLowerCase().includes(q);
          const matchSummary = m.executiveSummary?.toLowerCase().includes(q);
          const matchDate = m.meetingDate?.toLowerCase().includes(q);
          const matchParticipants = (m.participants || []).some((p) => p.name.toLowerCase().includes(q));
          const matchTopics = (m.mainTopics || []).some((t) => t.topicName.toLowerCase().includes(q));

          if (!matchTitle && !matchSummary && !matchDate && !matchParticipants && !matchTopics) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Sort descending by date
        const dateA = a.meetingDate || a.createdAt || '';
        const dateB = b.meetingDate || b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
  }, [meetings, selectedMonth, searchQuery]);

  const handleOpenEmailModal = (meeting: MeetingAnalysis) => {
    setMeetingForEmail(meeting);
    setIsEmailModalOpen(true);
  };

  const getMonthLabel = (monthVal: string) => {
    if (monthVal === 'all') return 'Todos los meses';
    const opt = monthOptions.find((o) => o.value === monthVal);
    return opt ? opt.label : monthVal;
  };

  return (
    <div className="space-y-6 font-['Montserrat']">
      {/* Top Banner and Search Bar */}
      <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-6 shadow-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FolderArchive className="w-5 h-5 text-[#FF5038]" />
              <h1 className="text-xl font-bold text-white tracking-tight font-['Lato']">
                Histórico de Resúmenes de Reuniones
              </h1>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Consulta y recupera los resúmenes de reuniones guardadas organizados por mes y fecha.
              Comparte rápidamente minutas formales por correo o retoma la sincronización de tickets Jira.
            </p>
          </div>

          {/* Month Selector */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-[#141517] p-1.5 rounded-xl border border-[#2A2C2F]">
              <Calendar className="w-4 h-4 text-[#EE880E] ml-2" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent border-none text-xs text-white focus:outline-hidden font-medium py-1 pr-3 cursor-pointer"
              >
                <option value="all" className="bg-[#1C1E20] text-white">
                  Todos los meses ({meetings.length})
                </option>
                {monthOptions.map((opt) => {
                  const countInMonth = meetings.filter((m) => m.meetingDate && m.meetingDate.startsWith(opt.value)).length;
                  return (
                    <option key={opt.value} value={opt.value} className="bg-[#1C1E20] text-white">
                      {opt.label} ({countInMonth})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-5 border-t border-[#2E3135]">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por título, participante o tema..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#141517] border border-[#2A2C2F] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[#FF5038]"
            />
          </div>

          <div className="text-xs text-slate-400 self-start sm:self-center">
            Mostrando <strong className="text-white">{filteredMeetings.length}</strong>{' '}
            {filteredMeetings.length === 1 ? 'reunión' : 'reuniones'} en {getMonthLabel(selectedMonth)}
          </div>
        </div>
      </div>

      {/* Meetings List */}
      {filteredMeetings.length > 0 ? (
        <div className="space-y-4">
          {filteredMeetings.map((meeting) => {
            const isExpanded = expandedMeetingId === meeting.id;
            const points = (meeting.actionItems || []).reduce((acc, curr) => acc + (curr.storyPoints || 0), 0);
            const syncedCount = (meeting.actionItems || []).filter((a) => a.jiraStatus === 'synced').length;

            return (
              <div
                key={meeting.id}
                className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl shadow-sm hover:border-[#3E4247] transition-all overflow-hidden"
              >
                {/* Main Card Header */}
                <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-[#FF5038]/15 text-[#FF5038] border border-[#FF5038]/30 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" />
                        {meeting.meetingDate || 'Fecha no registrada'}
                      </span>
                      <span className="text-[11px] bg-[#141517] text-slate-300 border border-[#2A2C2F] px-2 py-0.5 rounded-md font-medium">
                        {meeting.participants?.length || 0} Participantes
                      </span>
                      <span className="text-[11px] bg-[#141517] text-[#EE880E] border border-[#EE880E]/30 px-2 py-0.5 rounded-md font-medium">
                        {meeting.actionItems?.length || 0} Tareas ({points} pts)
                      </span>
                      {syncedCount > 0 && (
                        <span className="text-[11px] bg-emerald-950/40 text-[#29E78C] border border-[#29E78C]/40 px-2 py-0.5 rounded-md font-medium">
                          {syncedCount} en Jira
                        </span>
                      )}
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-white font-['Lato'] leading-snug">
                      {meeting.meetingTitle}
                    </h2>

                    {/* Short excerpt of Executive Summary */}
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {meeting.executiveSummary}
                    </p>
                  </div>

                  {/* Actions Right Side */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    <button
                      onClick={() => handleOpenEmailModal(meeting)}
                      className="px-3 py-2 rounded-xl bg-[#25282B] hover:bg-[#2E3236] text-slate-200 border border-[#3E4247] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Compartir por correo en formato formal para cliente"
                    >
                      <Mail className="w-3.5 h-3.5 text-[#EE880E]" />
                      <span>Compartir por mail</span>
                    </button>

                    <button
                      onClick={() => onSelectMeeting(meeting)}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#FF5038]/20 font-['Lato']"
                      title="Abrir en pestaña de Resumen & Tickets para gestionar y crear Jira tickets"
                    >
                      <span>Abrir Resumen & Tickets</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setExpandedMeetingId(isExpanded ? null : meeting.id)}
                      className="p-2 rounded-xl bg-[#25282B] hover:bg-[#2E3236] text-slate-300 border border-[#3E4247] text-xs transition-colors cursor-pointer"
                      title={isExpanded ? 'Ocultar detalles' : 'Ver resumen completo y acuerdos'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`¿Estás seguro de eliminar el resumen de "${meeting.meetingTitle}"?`)) {
                          onDeleteMeeting(meeting.id);
                        }
                      }}
                      className="p-2 rounded-xl hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-900/40 transition-colors cursor-pointer"
                      title="Eliminar este resumen guardado"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="p-5 pt-0 border-t border-[#2E3135] bg-[#161719] space-y-4 animate-in fade-in duration-150">
                    {/* Full Executive Summary */}
                    <div className="pt-4 space-y-1.5">
                      <span className="text-[11px] uppercase font-bold text-[#EE880E] tracking-wider block font-['Lato']">
                        Resumen Ejecutivo Completo
                      </span>
                      <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed bg-[#141517] p-3.5 rounded-xl border border-[#2A2C2F]">
                        {meeting.executiveSummary}
                      </p>
                    </div>

                    {/* Key Decisions */}
                    {meeting.keyDecisions && meeting.keyDecisions.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] uppercase font-bold text-[#29E78C] tracking-wider block font-['Lato']">
                          Decisiones Clave Acordadas ({meeting.keyDecisions.length})
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {meeting.keyDecisions.map((dec, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-slate-300 bg-[#141517] p-2.5 rounded-xl border border-[#2A2C2F] flex items-start gap-2"
                            >
                              <span className="text-[#29E78C] font-bold">✓</span>
                              <span>{dec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Items List */}
                    {meeting.actionItems && meeting.actionItems.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] uppercase font-bold text-[#61BFED] tracking-wider block font-['Lato']">
                          Compromisos y Tareas ({meeting.actionItems.length})
                        </span>
                        <div className="space-y-1.5">
                          {meeting.actionItems.map((act) => (
                            <div
                              key={act.id}
                              className="text-xs bg-[#141517] p-2.5 rounded-xl border border-[#2A2C2F] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">{act.title}</span>
                                {act.jiraTicketKey && (
                                  <span className="text-[10px] bg-emerald-950/60 text-[#29E78C] border border-[#29E78C]/40 px-1.5 py-0.2 rounded-md font-mono">
                                    {act.jiraTicketKey}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                <span>Responsable: <strong className="text-slate-200">{act.assignee}</strong></span>
                                <span className="font-mono text-[#EE880E] font-bold">{act.storyPoints} pts</span>
                                <span className="text-slate-500">{act.priority}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-12 text-center max-w-lg mx-auto my-12 space-y-4">
          <div className="w-14 h-14 bg-[#FF5038]/10 border border-[#FF5038]/20 rounded-2xl flex items-center justify-center mx-auto text-[#FF5038]">
            <FolderArchive className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white font-['Lato']">
            No hay resúmenes guardados para {getMonthLabel(selectedMonth)}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {searchQuery
              ? 'No se encontraron reuniones que coincidan con los criterios de búsqueda.'
              : 'Cuando proceses una transcripción de Teams, presiona el botón "Guardar Resumen" para almacenarla y consultarla aquí por mes y fecha.'}
          </p>
          <button
            onClick={onGoToTranscript}
            className="px-5 py-2.5 bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white rounded-xl text-xs font-bold shadow-md shadow-[#FF5038]/25 transition-all inline-flex items-center gap-2 font-['Lato'] cursor-pointer"
          >
            <span>Procesar Nueva Reunión</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Email Share Modal for selected meeting */}
      <EmailShareModal
        isOpen={isEmailModalOpen}
        onClose={() => {
          setIsEmailModalOpen(false);
          setMeetingForEmail(null);
        }}
        meeting={meetingForEmail}
      />
    </div>
  );
};
