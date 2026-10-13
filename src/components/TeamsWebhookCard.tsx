import React, { useState, useEffect } from 'react';
import { Radio, Copy, Check, Sparkles, RefreshCw, Bot, BellRing, HelpCircle, ChevronDown, ChevronUp, Code, Zap } from 'lucide-react';

interface TeamsWebhookCardProps {
  onLoadTranscript: (transcript: string, title: string) => void;
}

export const TeamsWebhookCard: React.FC<TeamsWebhookCardProps> = ({ onLoadTranscript }) => {
  const [copied, setCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [showConfigGuide, setShowConfigGuide] = useState(false);
  const [lastProcessedId, setLastProcessedId] = useState<string | null>(null);

  const webhookUrl = `${window.location.origin}/api/teams/webhook`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Live polling for incoming webhooks while card is displayed
  useEffect(() => {
    let isSubscribed = true;

    const checkLatestWebhook = async () => {
      try {
        const res = await fetch('/api/teams/latest-webhook');
        if (!res.ok) return;
        const data = await res.json();
        if (data?.latest && isSubscribed) {
          const event = data.latest;
          if (event.id !== lastProcessedId) {
            setLastProcessedId(event.id);
            setLastEvent(`✓ Recibido en vivo: "${event.meetingTitle}" (${event.receivedAt})`);
            onLoadTranscript(event.transcript, event.meetingTitle);
          }
        }
      } catch (e) {
        // Silent polling error
      }
    };

    const interval = setInterval(checkLatestWebhook, 3500);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [lastProcessedId, onLoadTranscript]);

  const handleSimulateWebhook = async () => {
    setSimulating(true);
    try {
      const res = await fetch('/api/teams/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'CallEnded',
          meetingId: 'call-' + Date.now(),
          meetingTitle: 'Daily Sync & Arquitectura Cívica',
          organizer: 'Carlos Mendoza (Cívica Software)',
          transcriptText: `[09:30:10] Carlos Mendoza (Tech Lead): Buenos días equipo Cívica. Hoy cerramos la validación de la arquitectura de datos y la pasarela de pagos.
[09:31:00] Ana Sofía Rivas: Me encargo de publicar los contratos OpenAPI y la tabla de idempotencia para la API antes de mañana.
[09:32:15] Rodrigo Alarcón: Yo configuro el pipeline de Terraform y el DLQ en AWS para la mensajería asíncrona.
[09:33:05] Laura Cárdenas: De acuerdo, yo integro el checkout v3 y los estados de carga con el equipo de UX de Cívica.
[09:34:00] Carlos Mendoza: Queda pendiente auditar los certificados SSL de los balanceadores antes de fin de mes.`,
        }),
      });
      const data = await res.json();
      setLastProcessedId(data.id);
      setLastEvent(`✓ Simulación completada: "${data.meetingTitle}"`);
      onLoadTranscript(data.transcript, data.meetingTitle);
    } catch (err) {
      console.error('Error simulating Teams webhook:', err);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="bg-[#1C1E20] border border-[#2E3135] rounded-xl p-4 space-y-3 font-['Montserrat']">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#FF5038] animate-pulse" />
          <span className="text-xs font-bold text-white font-['Lato']">
            Recepción Automática Teams &bull; Webhook en Vivo
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-[#29E78C]/15 text-[#29E78C] border border-[#29E78C]/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#29E78C] animate-ping" />
            Escuchando en vivo
          </span>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        Configura este webhook en <strong>Microsoft Power Automate</strong>, <strong>Azure Logic Apps</strong> o <strong>Microsoft Graph</strong> para cargar las transcripciones automáticamente sin copiar y pegar.
      </p>

      {/* Webhook URL bar */}
      <div className="flex items-center gap-2 bg-[#141517] p-2 rounded-lg border border-[#2A2C2F]">
        <code className="text-[11px] text-slate-300 font-mono truncate flex-1 px-1">
          {webhookUrl}
        </code>
        <button
          onClick={handleCopyWebhook}
          className="px-2.5 py-1 rounded bg-[#25282B] hover:bg-[#2E3236] text-slate-200 text-[11px] font-semibold flex items-center gap-1 border border-slate-700 shrink-0 cursor-pointer"
        >
          {copied ? <Check className="w-3 h-3 text-[#29E78C]" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copiado' : 'Copiar URL'}</span>
        </button>
      </div>

      {/* Actions and Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          {lastEvent ? (
            <span className="text-[#29E78C] font-semibold">{lastEvent}</span>
          ) : (
            <span className="text-slate-500 italic">Esperando evento de llamada o simulación...</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfigGuide(!showConfigGuide)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] flex items-center gap-1 border border-slate-700 cursor-pointer"
          >
            <HelpCircle className="w-3 h-3 text-[#EE880E]" />
            <span>Guía de Configuración</span>
            {showConfigGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <button
            onClick={handleSimulateWebhook}
            disabled={simulating}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white text-[11px] font-bold shadow-xs flex items-center gap-1.5 disabled:opacity-50 font-['Lato'] cursor-pointer"
          >
            <BellRing className={`w-3 h-3 ${simulating ? 'animate-bounce' : ''}`} />
            <span>{simulating ? 'Enviando...' : 'Simular llamada finalizada'}</span>
          </button>
        </div>
      </div>

      {/* Expandable Configuration Guide */}
      {showConfigGuide && (
        <div className="mt-3 p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3 text-xs text-slate-300 animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 text-[#EE880E] font-bold">
            <Zap className="w-3.5 h-3.5" />
            <span>Pasos para enviar la transcripción desde Microsoft 365 / Teams</span>
          </div>

          <div className="space-y-2 text-[11px] text-slate-300">
            <p>
              <strong>Opción A: Microsoft Power Automate (Recomendada No-Code)</strong>
            </p>
            <ol className="list-decimal pl-4 space-y-1 text-slate-400">
              <li>
                Entra a <strong>make.powerautomate.com</strong> y crea un <em>Flujo de nube automatizado</em>.
              </li>
              <li>
                <strong>Desencadenador (Trigger):</strong> Selecciona <em>&ldquo;Cuando finaliza una reunión de Teams&rdquo;</em> (o <em>&ldquo;Cuando se crea un archivo en SharePoint/OneDrive&rdquo;</em> en la carpeta de transcripciones).
              </li>
              <li>
                <strong>Acción HTTP:</strong> Añade un paso <strong>HTTP</strong> con método <code>POST</code> a la URL de este webhook.
              </li>
              <li>
                <strong>Cuerpo JSON (Body):</strong> Envía el siguiente formato:
              </li>
            </ol>

            <pre className="p-2.5 bg-slate-900 rounded-lg text-[10px] text-emerald-400 font-mono overflow-x-auto border border-slate-800">
{`{
  "meetingTitle": "@{triggerOutputs()?['body/subject']}",
  "organizer": "@{triggerOutputs()?['body/organizer/emailAddress/name']}",
  "meetingId": "@{triggerOutputs()?['body/id']}",
  "transcriptText": "@{body('Obtener_contenido_del_archivo_de_transcripcion')}"
}`}
            </pre>

            <p className="pt-1">
              <strong>Nota sobre Localhost:</strong> Si estás ejecutando ProjectHandler en tu máquina local (<code>localhost:3000</code>), Microsoft Teams requiere una URL accesible por Internet. Puedes exponerlo temporalmente con una herramienta como <code>ngrok http 3000</code> o desplegar ProjectHandler en un servidor o contenedor con HTTPS.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
