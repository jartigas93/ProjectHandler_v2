import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  Sparkles,
  Download,
  Copy,
  Printer,
  CheckCircle2,
  AlertTriangle,
  User,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  FileText,
  Check,
  RefreshCw,
  Clock,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { MonthlyReport, TopicHistoryRecord, ActionItem, MeetingAnalysis } from '../types';
import {
  exportMonthlyReportToMarkdown,
  exportTopicsToCsv,
  downloadFile
} from '../utils/exportUtils';
import { isTopicActiveInMonth } from '../utils/storage';
import { CivicaIsotype } from './CivicaLogo';

interface MonthlyReportTabProps {
  topics: TopicHistoryRecord[];
  allActionItems: ActionItem[];
  allMeetings?: MeetingAnalysis[];
  reports: MonthlyReport[];
  currentReport: MonthlyReport | null;
  onGenerateReport: (monthYear: string, monthName: string) => Promise<void>;
  onDeleteReport?: (monthYear: string) => void;
  isGenerating: boolean;
}

export const MonthlyReportTab: React.FC<MonthlyReportTabProps> = ({
  topics,
  allActionItems,
  allMeetings = [],
  reports,
  currentReport: propCurrentReport,
  onGenerateReport,
  onDeleteReport,
  isGenerating,
}) => {
  // Dynamically extract all relevant months across reports, meetings and topic history
  const monthOptions = useMemo(() => {
    const monthsSet = new Set<string>();

    // 1. From existing reports
    reports.forEach((r) => {
      if (r.monthYear) monthsSet.add(r.monthYear);
    });

    // 2. From all meetings
    allMeetings.forEach((m) => {
      if (m.meetingDate && m.meetingDate.length >= 7) {
        monthsSet.add(m.meetingDate.substring(0, 7));
      }
    });

    // 3. From topics
    topics.forEach((t) => {
      if (t.firstDiscussedDate?.length >= 7) monthsSet.add(t.firstDiscussedDate.substring(0, 7));
      if (t.lastDiscussedDate?.length >= 7) monthsSet.add(t.lastDiscussedDate.substring(0, 7));
      (t.meetings || []).forEach((m) => {
        if (m.date?.length >= 7) monthsSet.add(m.date.substring(0, 7));
      });
    });

    // 4. Always include current month
    const currentYm = new Date().toISOString().substring(0, 7);
    monthsSet.add(currentYm);

    const sorted = Array.from(monthsSet).sort().reverse();

    return sorted.map((ym) => {
      const [year, month] = ym.split('-');
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const rawLabel = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      const capitalized = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
      const isCurrent = ym === currentYm;
      const isSaved = reports.some((r) => r.monthYear === ym);

      return {
        value: ym,
        label: `${capitalized}${isCurrent ? ' (Actual)' : ''}${isSaved ? ' ✓' : ''}`,
        cleanName: capitalized,
        isSaved,
      };
    });
  }, [reports, allMeetings, topics]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return monthOptions.length > 0 ? monthOptions[0].value : new Date().toISOString().substring(0, 7);
  });
  const [copiedMd, setCopiedMd] = useState(false);

  // Active report for the selected month: find directly in reports array
  const activeReport = useMemo(() => {
    const found = reports.find((r) => r.monthYear === selectedMonth);
    if (found) return found;
    if (propCurrentReport && propCurrentReport.monthYear === selectedMonth) {
      return propCurrentReport;
    }
    return null;
  }, [reports, selectedMonth, propCurrentReport]);

  // Topics and meetings strictly belonging to selected month
  const monthTopics = useMemo(() => {
    return topics.filter((t) => isTopicActiveInMonth(t, selectedMonth));
  }, [topics, selectedMonth]);

  const monthMeetings = useMemo(() => {
    return allMeetings.filter((m) => m.meetingDate && m.meetingDate.startsWith(selectedMonth));
  }, [allMeetings, selectedMonth]);

  const monthActionItems = useMemo(() => {
    const items = monthMeetings.flatMap((m) => m.actionItems || []);
    return items.length > 0 ? items : allActionItems;
  }, [monthMeetings, allActionItems]);

  const currentOption = monthOptions.find((m) => m.value === selectedMonth);
  const selectedLabel = currentOption ? currentOption.cleanName : selectedMonth;

  const handleGenerate = () => {
    onGenerateReport(selectedMonth, selectedLabel);
  };

  const handleDownloadMarkdown = () => {
    if (!activeReport) return;
    const md = exportMonthlyReportToMarkdown(activeReport);
    downloadFile(md, `reporte-mensual-${activeReport.monthYear}.md`, 'text/markdown');
  };

  const handleCopyMarkdown = () => {
    if (!activeReport) return;
    const md = exportMonthlyReportToMarkdown(activeReport);
    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6 font-['Montserrat']">
      {/* Top Banner & Generation Controller */}
      <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-6 shadow-md print:hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#FF5038]" />
              <h1 className="text-xl font-bold text-white tracking-tight font-['Lato']">
                Generador de Reportes Mensuales de Progreso
              </h1>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Consolida automáticamente el progreso de las reuniones de Teams del mes,
              las tareas ejecutadas en Jira y el histórico de temas bajo el estándar Cívica Software.
            </p>
          </div>

          {/* Month Selector & Trigger Action */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-[#141517] p-1.5 rounded-xl border border-[#2A2C2F]">
              <Calendar className="w-4 h-4 text-[#EE880E] ml-2" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent border-none text-xs text-white focus:outline-hidden font-medium py-1 pr-3 cursor-pointer"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#1C1E20] text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-4 py-2 bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white rounded-xl text-xs font-bold shadow-md shadow-[#FF5038]/25 transition-all flex items-center gap-2 disabled:opacity-50 font-['Lato'] cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>
                {isGenerating
                  ? 'Generando Síntesis...'
                  : activeReport
                  ? '🔄 Actualizar Reporte con IA'
                  : '⚡ Generar Reporte con IA'}
              </span>
            </button>
          </div>
        </div>

        {/* Export Bar (Available when a report is loaded) */}
        {activeReport && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-5 border-t border-[#2E3135]">
            <div className="text-xs text-slate-400">
              Reporte consolidado activo:{' '}
              <strong className="text-white font-['Lato']">{activeReport.monthName}</strong>{' '}
              <span className="text-slate-500">
                (generado el {new Date(activeReport.createdAt).toLocaleDateString('es-ES')})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintPdf}
                className="px-3 py-1.5 rounded-lg bg-[#25282B] hover:bg-[#2E3236] text-slate-200 border border-[#3E4247] text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Imprimir o guardar como PDF"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span>Imprimir / PDF</span>
              </button>

              <button
                onClick={handleCopyMarkdown}
                className="px-3 py-1.5 rounded-lg bg-[#25282B] hover:bg-[#2E3236] text-slate-200 border border-[#3E4247] text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Copiar informe en Markdown"
              >
                {copiedMd ? <Check className="w-3.5 h-3.5 text-[#29E78C]" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedMd ? '¡Copiado!' : 'Copiar Markdown'}</span>
              </button>

              <button
                onClick={handleDownloadMarkdown}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar .md</span>
              </button>

              {onDeleteReport && (
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar el reporte mensual de ${activeReport.monthName}? Podrás volver a generarlo cuando lo desees.`)) {
                      onDeleteReport(activeReport.monthYear);
                    }
                  }}
                  className="p-1.5 rounded-lg hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer border border-transparent hover:border-rose-900/40"
                  title="Eliminar reporte consolidado"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Render Generated Monthly Report */}
      {activeReport ? (
        <div id="printable-report" className="space-y-6">
          {/* Executive Overview Header Card */}
          <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2E3135] pb-4">
              <div className="flex items-center gap-3">
                <CivicaIsotype size={36} />
                <div>
                  <span className="text-xs font-bold text-[#FF5038] uppercase tracking-wider block font-['Lato']">
                    CÍVICA SOFTWARE &bull; PROYECTHANDLER REPORT
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5 font-['Lato']">
                    Balance Técnico y Entrega de Proyectos &mdash; {activeReport.monthName}
                  </h2>
                </div>
              </div>
              <div className="text-xs text-slate-400 text-right">
                <span className="block font-medium text-slate-300">Auditoría Teams ➜ Jira Sync</span>
                <span className="font-mono text-slate-400">{new Date(activeReport.createdAt).toLocaleDateString('es-ES')}</span>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
              <div className="bg-[#141517] p-3.5 rounded-xl border border-[#2A2C2F]">
                <span className="text-[11px] text-slate-400 font-medium block">Reuniones Teams Analizadas</span>
                <span className="text-xl font-bold text-white mt-0.5 block">{activeReport.meetingsCount}</span>
              </div>
              <div className="bg-[#141517] p-3.5 rounded-xl border border-[#2A2C2F]">
                <span className="text-[11px] text-slate-400 font-medium block">Compromisos Técnicos</span>
                <span className="text-xl font-bold text-[#EE880E] mt-0.5 block">{activeReport.totalTasksIdentified}</span>
              </div>
              <div className="bg-[#141517] p-3.5 rounded-xl border border-[#2A2C2F]">
                <span className="text-[11px] text-slate-400 font-medium block">Tickets Sincronizados Jira</span>
                <span className="text-xl font-bold text-[#29E78C] mt-0.5 block">{activeReport.totalJiraSynced}</span>
              </div>
              <div className="bg-[#141517] p-3.5 rounded-xl border border-[#2A2C2F]">
                <span className="text-[11px] text-slate-400 font-medium block">Iniciativas del Mes</span>
                <span className="text-xl font-bold text-[#61BFED] mt-0.5 block">
                  {monthTopics.length > 0 ? monthTopics.length : (activeReport.pendingTopics?.length || 0)}
                </span>
              </div>
            </div>

            {/* Executive Synthesis */}
            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 font-['Lato']">
                <Sparkles className="w-4 h-4 text-[#EE880E]" />
                1. Síntesis Ejecutiva Mensual
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line bg-[#141517] p-4 rounded-xl border border-[#2A2C2F]">
                {activeReport.monthlySynthesis}
              </p>
            </div>
          </div>

          {/* Key Achievements & Pending Topics Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Achievements */}
            <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 font-['Lato']">
                <CheckCircle2 className="w-4 h-4 text-[#29E78C]" />
                2. Hitos Clave Culminados con Éxito
              </h3>
              <div className="space-y-2.5">
                {activeReport.keyAchievements && activeReport.keyAchievements.length > 0 ? (
                  activeReport.keyAchievements.map((ach, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 text-xs text-slate-300 bg-[#141517] p-3 rounded-xl border border-[#2A2C2F]"
                    >
                      <span className="w-4 h-4 rounded-full bg-[#29E78C]/20 text-[#29E78C] font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                        ✓
                      </span>
                      <span className="leading-snug">{ach}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 italic bg-[#141517] p-3 rounded-xl border border-[#2A2C2F]">
                    No se registraron hitos adicionales en este ciclo.
                  </div>
                )}
              </div>
            </div>

            {/* Pending Topics & Blockers */}
            <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 font-['Lato']">
                <AlertTriangle className="w-4 h-4 text-[#FFAD32]" />
                3. Iniciativas en Curso & Gestión de Riesgos
              </h3>
              <div className="space-y-2.5">
                {activeReport.pendingTopics && activeReport.pendingTopics.length > 0 ? (
                  activeReport.pendingTopics.map((pt, idx) => {
                    // Clean up any non-person suffix
                    const cleanAssignee = pt.assignee ? pt.assignee.replace(/\s*\([^)]*\)$/, '').trim() : 'Sin Asignar';

                    return (
                      <div
                        key={idx}
                        className="text-xs text-slate-300 bg-[#141517] p-3 rounded-xl border border-[#2A2C2F] space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white">{pt.topicName}</span>
                          <span className="text-[10px] bg-[#25282B] text-slate-300 px-2 py-0.5 rounded-sm font-semibold border border-[#3E4247] shrink-0">
                            {pt.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Responsable: <strong className="text-slate-200">{cleanAssignee}</strong></span>
                          <span className="text-[#FFAD32] font-medium">{pt.blockerRisk}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-slate-400 italic bg-[#141517] p-3 rounded-xl border border-[#2A2C2F]">
                    No hay iniciativas pendientes ni riesgos críticos reportados en este ciclo.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Participant Workload & Velocity Table */}
          <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 font-['Lato']">
              <User className="w-4 h-4 text-[#FF5038]" />
              4. Carga de Trabajo y Contribución por Participante
            </h3>

            {activeReport.participantWorkloads && activeReport.participantWorkloads.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#2E3135] text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="pb-3 font-semibold">Participante</th>
                      <th className="pb-3 font-semibold text-center">Tareas Asignadas</th>
                      <th className="pb-3 font-semibold">Tasa Cumplimiento</th>
                      <th className="pb-3 font-semibold">Foco Principal en Teams</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2E3135]">
                    {activeReport.participantWorkloads.map((pw, idx) => (
                      <tr key={idx} className="hover:bg-[#141517]">
                        <td className="py-3 font-bold text-white flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#FF5038] to-[#EE880E] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {pw.name.charAt(0)}
                          </div>
                          <span>{pw.name}</span>
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-slate-200">
                          {pw.tasksCount}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-black/40 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-[#FF5038] to-[#EE880E] h-full rounded-full"
                                style={{ width: `${pw.completionRate}%` }}
                              />
                            </div>
                            <span className="text-slate-300 font-mono text-[11px]">{pw.completionRate}%</span>
                          </div>
                        </td>
                        <td className="py-3 text-slate-300">{pw.primaryFocus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic bg-[#141517] p-4 rounded-xl border border-[#2A2C2F]">
                No se registraron tareas con participantes en este ciclo mensual.
              </div>
            )}
          </div>

          {/* Velocity Insights & Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 font-['Lato']">
                <TrendingUp className="w-4 h-4 text-[#61BFED]" />
                5. Análisis de Velocidad & Sincronización Técnica
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed bg-[#141517] p-4 rounded-xl border border-[#2A2C2F]">
                {activeReport.teamVelocityInsights}
              </p>
            </div>

            <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 font-['Lato']">
                <ShieldCheck className="w-4 h-4 text-[#29E78C]" />
                6. Recomendaciones Tácticas para el Próximo Mes
              </h3>
              <div className="space-y-2">
                {activeReport.nextMonthRecommendations && activeReport.nextMonthRecommendations.length > 0 ? (
                  activeReport.nextMonthRecommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-xs text-slate-300 bg-[#141517] p-2.5 rounded-xl border border-[#2A2C2F]"
                    >
                      <span className="text-[#EE880E] font-bold">{idx + 1}.</span>
                      <span className="leading-snug">{rec}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 italic bg-[#141517] p-3 rounded-xl border border-[#2A2C2F]">
                    Continuar con las buenas prácticas de seguimiento y actualización de tableros.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State for Selected Month */
        <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-10 text-center max-w-lg mx-auto my-12 space-y-4">
          <div className="w-14 h-14 bg-[#FF5038]/10 border border-[#FF5038]/20 rounded-2xl flex items-center justify-center mx-auto text-[#FF5038]">
            <BarChart3 className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white font-['Lato']">
            Reporte Mensual no generado para {selectedLabel}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Consolida las reuniones analizadas y el histórico de temas correspondientes a este mes.
            El motor de IA construirá la síntesis ejecutiva, hitos y carga de trabajo del período.
          </p>

          {/* Month Data Preview */}
          <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto py-2 text-xs">
            <div className="bg-[#141517] p-2.5 rounded-xl border border-[#2A2C2F]">
              <span className="text-[10px] text-slate-500 block">Reuniones de este mes</span>
              <span className="font-bold text-white text-sm">{monthMeetings.length}</span>
            </div>
            <div className="bg-[#141517] p-2.5 rounded-xl border border-[#2A2C2F]">
              <span className="text-[10px] text-slate-500 block">Iniciativas activas</span>
              <span className="font-bold text-[#61BFED] text-sm">{monthTopics.length}</span>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-5 py-2.5 bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white rounded-xl text-xs font-bold shadow-md shadow-[#FF5038]/25 transition-all inline-flex items-center gap-2 disabled:opacity-50 font-['Lato'] cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generar Reporte de {selectedLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
};
