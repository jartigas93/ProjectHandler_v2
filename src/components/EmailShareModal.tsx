import React, { useState, useEffect } from 'react';
import { X, Mail, Copy, Check, ExternalLink, Send, FileText } from 'lucide-react';
import { MeetingAnalysis } from '../types';
import { formatEmailSummary } from '../utils/exportUtils';

interface EmailShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: MeetingAnalysis | null;
}

export const EmailShareModal: React.FC<EmailShareModalProps> = ({
  isOpen,
  onClose,
  meeting,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);

  useEffect(() => {
    if (meeting) {
      const email = formatEmailSummary(meeting);
      setSubject(email.subject);
      setBody(email.body);
      setCopiedSubject(false);
      setCopiedFull(false);
    }
  }, [meeting, isOpen]);

  if (!isOpen || !meeting) return null;

  const handleCopySubject = () => {
    navigator.clipboard.writeText(subject);
    setCopiedSubject(true);
    setTimeout(() => setCopiedSubject(false), 2000);
  };

  const handleCopyFull = () => {
    const fullMessage = `Asunto: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(fullMessage);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 2000);
  };

  const handleOpenMailClient = () => {
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200 font-['Montserrat']">
      <div className="bg-[#1C1E20] border border-[#3E4247] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#2E3135] bg-gradient-to-r from-[#1E2023] via-[#241F1D] to-[#1E2023] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF5038] to-[#EE880E] flex items-center justify-center text-white shadow-md shadow-[#FF5038]/20 shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base font-['Lato'] flex items-center gap-2">
                <span>Compartir por Correo &bull; Formato Profesional para Cliente</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Resumen ejecutivo y compromisos formateados formalmente, sin emoticones ni duplicados.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#25282B] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
          {/* Subject Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-['Lato']">
                Asunto del Correo:
              </label>
              <button
                type="button"
                onClick={handleCopySubject}
                className="text-[11px] text-slate-400 hover:text-[#EE880E] flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copiedSubject ? (
                  <>
                    <Check className="w-3 h-3 text-[#29E78C]" />
                    <span className="text-[#29E78C] font-semibold">¡Asunto copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copiar solo asunto</span>
                  </>
                )}
              </button>
            </div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-[#141517] border border-[#2A2C2F] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-[#FF5038] font-medium"
            />
          </div>

          {/* Email Body Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-['Lato']">
                Cuerpo del Mensaje (Editable):
              </label>
              <span className="text-[10px] text-slate-500">
                Redacción profesional limpia
              </span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full bg-[#141517] border border-[#2A2C2F] rounded-xl p-3.5 text-xs text-slate-200 focus:outline-hidden focus:border-[#FF5038] font-['Montserrat'] leading-relaxed resize-y"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#2E3135] bg-[#141517] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleOpenMailClient}
            className="px-3.5 py-2 rounded-xl bg-[#25282B] hover:bg-[#2E3236] text-slate-200 border border-[#3E4247] text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Abrir directamente en tu cliente de correo (Outlook, Mail, etc.)"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#EE880E]" />
            <span>Abrir en Outlook / Mail</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleCopyFull}
              className="px-5 py-2.5 bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-[#FF5038]/25 font-['Lato']"
            >
              {copiedFull ? (
                <>
                  <Check className="w-4 h-4 text-[#29E78C]" />
                  <span>¡Copiado para Enviar!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Correo Completo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
