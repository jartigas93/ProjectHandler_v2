import React, { useState } from 'react';
import { RACIRow, Participant, ActionItem } from '../types';
import { Users, CheckCircle2, Copy, Check, Search, ShieldCheck, HelpCircle } from 'lucide-react';

interface RACIMatrixViewProps {
  raciData?: RACIRow[];
  participants: Participant[];
  actionItems: ActionItem[];
}

export const RACIMatrixView: React.FC<RACIMatrixViewProps> = ({
  raciData,
  participants,
  actionItems,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [showHelper, setShowHelper] = useState(false);

  // Fallback generation if raciData was not explicitly in the payload
  const effectiveRaci: RACIRow[] = React.useMemo(() => {
    if (raciData && raciData.length > 0) return raciData;

    // Dynamically derive RACI rows from actionItems & participants
    const grouped = new Map<string, ActionItem[]>();
    actionItems.forEach((item) => {
      const key = item.topicName || item.title;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    });

    const leadParticipant = participants[0]?.name || 'Tech Lead';

    return Array.from(grouped.entries()).map(([topicName, items], idx) => {
      const responsibles = Array.from(new Set(items.map((i) => i.assignee)));
      const coAssignees = Array.from(
        new Set(items.flatMap((i) => i.coAssignees || []).filter((name) => !responsibles.includes(name)))
      );
      const informed = participants
        .map((p) => p.name)
        .filter((p) => !responsibles.includes(p) && !coAssignees.includes(p) && p !== leadParticipant);

      return {
        id: `raci-auto-${idx}`,
        topicOrDeliverable: topicName,
        responsible: responsibles[0] || 'Equipo Técnico',
        accountable: leadParticipant,
        consulted: coAssignees.length > 0 ? coAssignees : [participants[1]?.name || 'Especialista'],
        informed: informed.length > 0 ? informed : ['Todo el equipo de proyecto'],
        category: items[0]?.issueType || 'General',
        status: items.some((i) => i.jiraStatus === 'synced') ? 'En Progreso' : 'Planificado',
      };
    });
  }, [raciData, actionItems, participants]);

  const filteredRaci = effectiveRaci.filter((row) =>
    row.topicOrDeliverable.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.responsible.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.accountable.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopyMarkdown = () => {
    const mdHeader = `| Entregable / Tema | Responsable (R) | Aprobador (A) | Consultado (C) | Informado (I) |\n|---|---|---|---|---|`;
    const mdRows = effectiveRaci
      .map(
        (r) =>
          `| ${r.topicOrDeliverable} | **${r.responsible}** | ${r.accountable} | ${r.consulted.join(', ') || '-'} | ${r.informed.join(', ') || '-'} |`
      )
      .join('\n');
    navigator.clipboard.writeText(`${mdHeader}\n${mdRows}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 font-['Montserrat']">
      {/* Top Bar: Search, Quick Info Toggle & Export */}
      <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar tema o responsable..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#141517] border border-[#2A2C2F] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[#FF5038]"
            />
          </div>
          <button
            onClick={() => setShowHelper(!showHelper)}
            className={`p-2 rounded-xl border text-xs transition-colors ${
              showHelper
                ? 'bg-[#FF5038]/15 border-[#FF5038]/40 text-[#FF5038]'
                : 'bg-[#25282B] border-[#3E4247] text-slate-400 hover:text-white'
            }`}
            title="¿Qué es la Matriz RACI?"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">
            {filteredRaci.length} iniciativa{filteredRaci.length !== 1 ? 's' : ''} mapeada{filteredRaci.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleCopyMarkdown}
            className="px-3 py-1.5 rounded-xl bg-[#25282B] hover:bg-[#2E3236] text-slate-200 border border-[#3E4247] text-xs font-medium transition-colors flex items-center gap-1.5"
            title="Copiar tabla RACI en formato Markdown"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#29E78C]" />
                <span className="text-[#29E78C]">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copiar RACI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Explanatory Helper Drawer */}
      {showHelper && (
        <div className="bg-[#18191B] border border-[#2E3135] rounded-2xl p-4 text-xs text-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in fade-in duration-150">
          <div className="space-y-1">
            <span className="inline-block px-2 py-0.5 rounded-md bg-[#FF5038]/20 text-[#FF5038] font-bold text-[10px] border border-[#FF5038]/30">
              R &bull; Responsable
            </span>
            <p className="text-[11px] text-slate-400">
              Quien ejecuta directamente la tarea técnica y crea el código o solución.
            </p>
          </div>
          <div className="space-y-1">
            <span className="inline-block px-2 py-0.5 rounded-md bg-[#EE880E]/20 text-[#EE880E] font-bold text-[10px] border border-[#EE880E]/30">
              A &bull; Accountable
            </span>
            <p className="text-[11px] text-slate-400">
              Quien aprueba el entregable, toma la decisión final y responde por el éxito.
            </p>
          </div>
          <div className="space-y-1">
            <span className="inline-block px-2 py-0.5 rounded-md bg-[#61BFED]/20 text-[#61BFED] font-bold text-[10px] border border-[#61BFED]/30">
              C &bull; Consultado
            </span>
            <p className="text-[11px] text-slate-400">
              Especialistas con los que se colabora de forma bidireccional durante la ejecución.
            </p>
          </div>
          <div className="space-y-1">
            <span className="inline-block px-2 py-0.5 rounded-md bg-slate-700/50 text-slate-300 font-bold text-[10px] border border-slate-600">
              I &bull; Informado
            </span>
            <p className="text-[11px] text-slate-400">
              Partes interesadas a las que se notifica del avance sin requerir feedback continuo.
            </p>
          </div>
        </div>
      )}

      {/* RACI Responsive Table */}
      <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#161719] text-slate-400 uppercase text-[10px] tracking-wider border-b border-[#2A2C2F] font-['Lato']">
              <tr>
                <th className="py-3 px-4 font-bold">Iniciativa / Entregable</th>
                <th className="py-3 px-4 font-bold text-[#FF5038]">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF5038]"></span>
                    Responsable (R)
                  </span>
                </th>
                <th className="py-3 px-4 font-bold text-[#EE880E]">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EE880E]"></span>
                    Aprobador (A)
                  </span>
                </th>
                <th className="py-3 px-4 font-bold text-[#61BFED]">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#61BFED]"></span>
                    Consultado (C)
                  </span>
                </th>
                <th className="py-3 px-4 font-bold text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    Informado (I)
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2C2F]">
              {filteredRaci.map((row, idx) => (
                <tr key={row.id || idx} className="hover:bg-[#222428] transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-white">
                    <div className="flex flex-col">
                      <span className="leading-snug">{row.topicOrDeliverable}</span>
                      {row.category && (
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          {row.category}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FF5038]/15 text-[#FF5038] border border-[#FF5038]/30 font-bold text-xs">
                      {row.responsible}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EE880E]/15 text-[#EE880E] border border-[#EE880E]/30 font-semibold text-xs">
                      <ShieldCheck className="w-3 h-3 text-[#EE880E]" />
                      {row.accountable}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1">
                      {row.consulted.map((c, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-[#61BFED]/15 text-[#61BFED] border border-[#61BFED]/30 text-[11px]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1">
                      {row.informed.map((inf, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[11px]"
                        >
                          {inf}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
