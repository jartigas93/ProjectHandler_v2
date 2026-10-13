import React from 'react';
import { X, AlertTriangle, Cpu, Globe, RefreshCw } from 'lucide-react';

export interface AiErrorInfo {
  provider?: string;
  model?: string;
  status?: number | null;
  message: string;
  title?: string;
}

interface AiErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: AiErrorInfo | null;
  onRetry?: () => void;
}

export const AiErrorModal: React.FC<AiErrorModalProps> = ({
  isOpen,
  onClose,
  error,
  onRetry,
}) => {
  if (!isOpen || !error) return null;

  const is503 = error.status === 503 || error.message.toLowerCase().includes('high demand') || error.message.toLowerCase().includes('overloaded');
  const is404 = error.status === 404 || error.message.toLowerCase().includes('not found');
  const isAuth = error.status === 401 || error.status === 403 || error.message.toLowerCase().includes('api key') || error.message.toLowerCase().includes('unauthorized');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-[#1C1E22] border border-rose-500/40 rounded-2xl w-full max-w-lg shadow-2xl shadow-rose-950/40 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-950/60 to-[#1C1E22] p-5 border-b border-rose-900/30 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base font-['Lato']">
                {error.title || 'Error en el Modelo de IA'}
              </h3>
              <p className="text-xs text-rose-300/80">
                {is503
                  ? 'Sobrecarga de demanda del proveedor'
                  : is404
                  ? 'Nombre técnico no encontrado o no disponible'
                  : isAuth
                  ? 'Error de autenticación o clave API'
                  : 'Fallo al ejecutar la llamada con el proveedor'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2">
            {error.provider && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#25282E] border border-slate-700 text-xs font-mono font-semibold text-slate-200">
                <Globe className="w-3.5 h-3.5 text-[#EE880E]" />
                {error.provider.toUpperCase()}
              </span>
            )}
            {error.model && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#25282E] border border-slate-700 text-xs font-mono font-semibold text-white">
                <Cpu className="w-3.5 h-3.5 text-[#61BFED]" />
                {error.model}
              </span>
            )}
            {error.status && (
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold font-mono ${
                  error.status === 503
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                Código {error.status}
              </span>
            )}
          </div>

          {/* Explanation Banner */}
          {is503 ? (
            <div className="p-3.5 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs text-amber-200/90 leading-relaxed">
              <strong>Alta demanda temporal:</strong> Los servidores del modelo seleccionado están saturados en este momento. Este tipo de picos suele durar unos segundos o minutos. Puedes intentar nuevamente o cambiar momentáneamente a otro modelo.
            </div>
          ) : is404 ? (
            <div className="p-3.5 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-200/90 leading-relaxed">
              <strong>Nombre técnico no válido:</strong> El proveedor de IA respondió que este identificador no existe en su catálogo o tu cuenta no tiene permisos para usarlo. Revisa la sintaxis exacta (ej. <code>gemini-3.1-flash-lite</code>, <code>gpt-4o</code>, <code>claude-3-7-sonnet-20250219</code>).
            </div>
          ) : null}

          {/* Detailed Message Box */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1.5 uppercase tracking-wider">
              Detalle devuelto por la API:
            </label>
            <div className="bg-[#121316] border border-[#2E3138] rounded-xl p-3.5 text-xs text-slate-300 font-mono leading-relaxed break-words max-h-48 overflow-y-auto">
              {error.message}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#16171A] border-t border-[#26282E] flex items-center justify-end gap-2.5">
          {onRetry && (
            <button
              onClick={() => {
                onClose();
                onRetry();
              }}
              className="px-4 py-2 bg-[#26292E] hover:bg-[#30343B] text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reintentar
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:opacity-90 text-white rounded-xl text-xs font-semibold transition-opacity cursor-pointer shadow-md shadow-rose-900/30"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
