import React, { useState } from 'react';
import { X, ExternalLink, Check, Copy, Share2, AlertCircle } from 'lucide-react';
import { MeetingAnalysis, JiraConfig } from '../types';
import { CivicaIsotype } from './CivicaLogo';

interface ConfluencePublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: MeetingAnalysis;
  jiraConfig: JiraConfig;
}

export const ConfluencePublishModal: React.FC<ConfluencePublishModalProps> = ({
  isOpen,
  onClose,
  meeting,
  jiraConfig,
}) => {
  if (!isOpen) return null;

  const [spaceKey, setSpaceKey] = useState<string>(jiraConfig.confluenceSpace || 'PROJ');
  const [pageTitle, setPageTitle] = useState<string>(`Acta de Reunión: ${meeting.meetingTitle} (${meeting.meetingDate})`);
  const [parentPageId, setParentPageId] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishResult, setPublishResult] = useState<{
    success?: boolean;
    pageUrl?: string;
    pageId?: string;
    message?: string;
    error?: string;
  } | null>(null);
  const [copiedFormat, setCopiedFormat] = useState(false);

  const cleanDomain = (jiraConfig.domain || 'empresa.atlassian.net')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  const generateConfluenceStorageFormat = () => {
    let html = `<h2>📌 Acta de Sesión Técnica - Cívica Software</h2>
<p><strong>Reunión:</strong> ${meeting.meetingTitle}<br/>
<strong>Fecha:</strong> ${meeting.meetingDate}<br/>
<strong>Proyecto Jira:</strong> ${jiraConfig.projectKey}</p>

<h3>1. Resumen Ejecutivo</h3>
<p>${meeting.executiveSummary}</p>

<h3>2. Acuerdos y Decisiones Aprobadas</h3>
<ul>
${meeting.keyDecisions.map((d) => `  <li>${d}</li>`).join('\n')}
</ul>

<h3>3. Matriz de Tareas y Compromisos Jira</h3>
<table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr style="background-color: #f4f5f7;">
      <th>Responsable</th>
      <th>Tema</th>
      <th>Tarea</th>
      <th>Story Points</th>
      <th>Prioridad</th>
      <th>Clave Jira</th>
    </tr>
  </thead>
  <tbody>
${meeting.actionItems
        .map((a) => {
          const jiraLink = a.jiraTicketKey
            ? `<a href="https://${cleanDomain}/browse/${a.jiraTicketKey}"><strong>${a.jiraTicketKey}</strong></a>`
            : '<em>Pendiente</em>';
          return `    <tr>
      <td>${a.assignee}</td>
      <td>${a.topicName || '-'}</td>
      <td>${a.title}</td>
      <td style="text-align: center;">${a.storyPoints || 0}</td>
      <td>${a.priority}</td>
      <td>${jiraLink}</td>
    </tr>`;
        })
        .join('\n')}
  </tbody>
</table>`;

    if (meeting.raciMatrix && meeting.raciMatrix.length > 0) {
      html += `\n\n<h3>4. Matriz RACI de Responsabilidades</h3>
<table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr style="background-color: #f4f5f7;">
      <th>Actividad / Entregable</th>
      <th>Responsible (R)</th>
      <th>Accountable (A)</th>
      <th>Consulted (C)</th>
      <th>Informed (I)</th>
    </tr>
  </thead>
  <tbody>
${meeting.raciMatrix
          .map(
            (r) => `    <tr>
      <td><strong>${r.topicOrDeliverable}</strong></td>
      <td>${r.responsible}</td>
      <td>${r.accountable}</td>
      <td>${Array.isArray(r.consulted) ? r.consulted.join(', ') : r.consulted || '-'}</td>
      <td>${Array.isArray(r.informed) ? r.informed.join(', ') : r.informed || '-'}</td>
    </tr>`
          )
          .join('\n')}
  </tbody>
</table>`;
    }

    return html;
  };

  const handleCopyStorage = () => {
    navigator.clipboard.writeText(generateConfluenceStorageFormat());
    setCopiedFormat(true);
    setTimeout(() => setCopiedFormat(false), 2000);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishResult(null);
    try {
      const res = await fetch('/api/confluence/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jiraConfig,
          meetingTitle: meeting.meetingTitle,
          meetingDate: meeting.meetingDate,
          spaceKey,
          pageTitle,
          parentPageId: parentPageId.trim() || undefined,
          contentHtml: generateConfluenceStorageFormat(),
        }),
      });
      const data = await res.json();
      setPublishResult(data);
    } catch (err: any) {
      console.error('Error publishing to Confluence:', err);
      setPublishResult({
        success: false,
        error: err.message || 'Error de conexión con el servidor al publicar.',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2E3135] bg-[#141517]">
          <div className="flex items-center gap-2.5">
            <CivicaIsotype size={26} />
            <div>
              <h3 className="text-sm font-bold text-white font-['Lato'] flex items-center gap-1.5">
                Publicar Acta en Confluence &bull; SharePoint
              </h3>
              <p className="text-[11px] text-slate-400 font-['Montserrat']">
                Estandariza minutas ejecutivas con la plantilla oficial de Cívica
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#25282B] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs font-['Montserrat']">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Título de la Página en Confluence
              </label>
              <input
                type="text"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                className="w-full bg-[#141517] border border-[#2A2C2F] rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-[#FF5038]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Espacio (Space Key)
              </label>
              <input
                type="text"
                value={spaceKey}
                onChange={(e) => setSpaceKey(e.target.value.toUpperCase())}
                placeholder="PROJ o DEV"
                className="w-full bg-[#141517] border border-[#2A2C2F] rounded-lg px-3 py-2 text-white uppercase font-mono focus:outline-hidden focus:border-[#FF5038]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              ID Página Padre (Opcional)
            </label>
            <input
              type="text"
              value={parentPageId}
              onChange={(e) => setParentPageId(e.target.value)}
              placeholder="Ej: 12345678 (dejar vacío si no cuelga de otra página)"
              className="w-full bg-[#141517] border border-[#2A2C2F] rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-[#FF5038]"
            />
          </div>

          {/* Preview snippet */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-300">
                Vista Previa del Formato Confluence Cívica:
              </span>
              <button
                onClick={handleCopyStorage}
                className="text-[11px] text-[#EE880E] hover:text-[#FF5038] flex items-center gap-1 font-semibold"
              >
                {copiedFormat ? <Check className="w-3 h-3 text-[#29E78C]" /> : <Copy className="w-3 h-3" />}
                <span>{copiedFormat ? '¡Copiado!' : 'Copiar Código HTML/Confluence'}</span>
              </button>
            </div>
            <div className="bg-[#141517] p-3 rounded-xl border border-[#2A2C2F] text-slate-300 space-y-2 max-h-40 overflow-y-auto font-mono text-[11px] leading-relaxed">
              <p className="text-white font-bold font-sans">📌 Acta de Sesión Técnica - Cívica Software</p>
              <p className="text-slate-400 font-sans text-[11px]">
                {meeting.executiveSummary.slice(0, 180)}...
              </p>
              <div className="pt-1 text-slate-400 font-sans text-[11px]">
                <strong>Compromisos incluidos:</strong> {meeting.actionItems.length} tareas asignadas &bull; {meeting.participants.length} participantes.
              </div>
            </div>
          </div>

          {/* Success or Error result */}
          {publishResult && (
            publishResult.success ? (
              <div className="bg-emerald-950/40 border border-[#29E78C]/40 p-3 rounded-xl flex items-start gap-2 text-emerald-200">
                <Check className="w-4 h-4 text-[#29E78C] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold">{publishResult.message}</span>
                  {publishResult.pageUrl && (
                    <a
                      href={publishResult.pageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#29E78C] underline flex items-center gap-1 mt-1 font-medium"
                    >
                      Ver página publicada en Confluence <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-rose-950/40 border border-[#FF5038]/40 p-3 rounded-xl flex items-start gap-2 text-rose-200">
                <AlertCircle className="w-4 h-4 text-[#FF5038] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold">Error al publicar en Confluence:</span>
                  <p className="text-xs text-rose-300 mt-0.5">{publishResult.error || publishResult.message || 'Error desconocido'}</p>
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2E3135] bg-[#141517]">
          <span className="text-[11px] text-slate-400">
            Plantilla oficial &bull; C&iacute;vica Software Space
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-300 hover:text-white text-xs"
            >
              Cerrar
            </button>
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white text-xs font-bold transition-all shadow-md shadow-[#FF5038]/25 flex items-center gap-1.5 disabled:opacity-50 font-['Lato']"
            >
              <Share2 className={`w-3.5 h-3.5 ${isPublishing ? 'animate-spin' : ''}`} />
              <span>{isPublishing ? 'Publicando...' : 'Publicar en Confluence'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
