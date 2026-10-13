import React from 'react';
import { ActionItem, JiraConfig } from '../types';
import { Check, Send, ExternalLink, Edit3, User, ArrowUpRight } from 'lucide-react';

interface CompactTableViewProps {
  items: ActionItem[];
  jiraConfig: JiraConfig;
  onSyncSingleItem: (item: ActionItem) => Promise<void> | void;
  onOpenTicketDetails: (item: ActionItem) => void;
  syncingItemId: string | null;
  getPriorityBadge: (p: string) => string;
  getIssueTypeBadge: (t: string) => string;
}

export const CompactTableView: React.FC<CompactTableViewProps> = ({
  items,
  jiraConfig,
  onSyncSingleItem,
  onOpenTicketDetails,
  syncingItemId,
  getPriorityBadge,
  getIssueTypeBadge,
}) => {
  if (items.length === 0) {
    return (
      <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-8 text-center text-xs text-slate-400">
        No hay tareas que coincidan con los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl overflow-hidden shadow-sm font-['Montserrat']">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#161719] text-slate-400 uppercase text-[10px] tracking-wider border-b border-[#2A2C2F] font-['Lato']">
            <tr>
              <th className="py-3 px-4 font-bold">Tipo & Prioridad</th>
              <th className="py-3 px-4 font-bold">Título de la Tarea / Ticket</th>
              <th className="py-3 px-4 font-bold">Responsable</th>
              <th className="py-3 px-4 font-bold text-center">Pts</th>
              <th className="py-3 px-4 font-bold">Estado Jira</th>
              <th className="py-3 px-4 font-bold text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A2C2F]">
            {items.map((item) => {
              const isSyncing = syncingItemId === item.id;
              const isSynced = item.jiraStatus === 'synced';

              return (
                <tr key={item.id} className="hover:bg-[#222428] transition-colors">
                  {/* Tipo & Prioridad */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold border ${getIssueTypeBadge(item.issueType)}`}>
                        {item.issueType}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold border ${getPriorityBadge(item.priority)}`}>
                        {item.priority}
                      </span>
                    </div>
                  </td>

                  {/* Título & Tema */}
                  <td className="py-3 px-4 font-medium text-white max-w-xs">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.taskKind === 'existing' || Boolean(item.matchedJiraKey) ? (
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${item.isClosedMatch ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-[#61BFED]/15 text-[#61BFED] border-[#61BFED]/30'}`}>
                            {item.isClosedMatch ? 'Resuelta' : 'En Curso'}: {item.matchedJiraKey}
                          </span>
                        ) : (
                          <span className="text-[9px] text-[#29E78C] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-950/40 border border-[#29E78C]/30">
                            Nueva
                          </span>
                        )}
                        <button
                          onClick={() => onOpenTicketDetails(item)}
                          className="text-left font-semibold hover:text-[#EE880E] transition-colors line-clamp-1 cursor-pointer"
                          title={item.title}
                        >
                          {item.title}
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 truncate">
                        {item.topicName}
                      </span>
                    </div>
                  </td>

                  {/* Responsable */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#FF5038] to-[#EE880E] flex items-center justify-center text-white text-[10px] font-bold">
                        {item.assignee.charAt(0)}
                      </div>
                      <span className="text-slate-200">{item.assignee}</span>
                    </div>
                  </td>

                  {/* Story Points */}
                  <td className="py-3 px-4 text-center font-mono font-bold text-[#EE880E]">
                    {item.storyPoints}
                  </td>

                  {/* Estado Jira */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {isSynced ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[#29E78C] font-mono font-bold flex items-center gap-1 bg-emerald-950/40 border border-[#29E78C]/40 px-2 py-0.5 rounded-md">
                          <Check className="w-2.5 h-2.5" />
                          {item.jiraTicketKey}
                        </span>
                        {item.jiraIssueStatus && (
                          <span className="text-[9px] bg-[#61BFED]/15 text-[#61BFED] border border-[#61BFED]/30 px-1.5 py-0.5 rounded-md font-bold">
                            {item.jiraIssueStatus}
                          </span>
                        )}
                      </div>
                    ) : item.taskKind === 'existing' || Boolean(item.matchedJiraKey) ? (
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono font-bold flex items-center gap-1 px-2 py-0.5 rounded-md border ${
                          item.isClosedMatch
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-[#61BFED]/15 text-[#61BFED] border-[#61BFED]/30'
                        }`}>
                          {item.matchedJiraKey}
                        </span>
                        <span className="text-[9px] bg-[#141517] text-slate-300 border border-[#2A2C2F] px-1.5 py-0.5 rounded-md font-medium">
                          {item.isClosedMatch ? 'Resuelta' : 'En Curso'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-mono">
                        Pendiente
                      </span>
                    )}
                  </td>

                  {/* Acción */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onOpenTicketDetails(item)}
                        className="p-1.5 rounded-lg bg-[#25282B] hover:bg-[#2E3236] text-slate-300 border border-[#3E4247] transition-colors"
                        title="Ver detalles completos del ticket"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>

                      {isSynced ? (
                        <a
                          href={item.jiraTicketUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-[#29E78C] border border-[#29E78C]/40 text-[11px] font-semibold flex items-center gap-1"
                        >
                          <span>Jira</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : item.taskKind === 'existing' || Boolean(item.matchedJiraKey) ? (
                        <a
                          href={item.jiraTicketUrl || `https://${(jiraConfig.domain || 'atlassian.net').replace(/^https?:\/\//, '')}/browse/${item.matchedJiraKey}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-[#61BFED]/15 hover:bg-[#61BFED]/25 text-[#61BFED] border border-[#61BFED]/30 text-[11px] font-semibold flex items-center gap-1"
                          title={`Abrir ticket ${item.matchedJiraKey} en Jira`}
                        >
                          <span>{item.matchedJiraKey}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <button
                          onClick={() => onSyncSingleItem(item)}
                          disabled={isSyncing}
                          className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#FF5038] to-[#EE880E] hover:from-[#E6422C] hover:to-[#DE7B0A] text-white text-[11px] font-bold shadow-xs flex items-center gap-1 disabled:opacity-50"
                        >
                          <Send className={`w-2.5 h-2.5 ${isSyncing ? 'animate-pulse' : ''}`} />
                          <span>{isSyncing ? '...' : 'Crear en Jira'}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
