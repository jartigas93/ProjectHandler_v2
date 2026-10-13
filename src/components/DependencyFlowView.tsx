import React from 'react';
import { TaskDependency, ActionItem } from '../types';
import { ArrowRight, CheckCircle2, Clock, GitCommit, User } from 'lucide-react';

interface DependencyFlowViewProps {
  dependencies: TaskDependency[];
  actionItems: ActionItem[];
  onOpenTicketDetails: (item: ActionItem) => void;
}

export const DependencyFlowView: React.FC<DependencyFlowViewProps> = ({
  dependencies,
  actionItems,
  onOpenTicketDetails,
}) => {
  if (!dependencies || dependencies.length === 0) {
    return (
      <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-8 text-center text-xs text-slate-400">
        <GitCommit className="w-8 h-8 text-[#FF5038] mx-auto mb-2 opacity-80" />
        <p className="font-semibold text-white">No se detectaron dependencias bloqueantes críticas en esta sesión.</p>
        <p className="text-slate-400 mt-1">Todas las tareas asignadas pueden ejecutarse en paralelo de forma autónoma.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#1C1E20] border border-[#2E3135] rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-white font-['Lato'] flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-[#FF5038]" />
              Flujo de Dependencias entre Entregables & Miembros
            </h3>
            <p className="text-xs text-slate-400 font-['Montserrat'] mt-0.5">
              Identifica qué entregable desbloquea el trabajo de otros miembros para optimizar el camino crítico del sprint.
            </p>
          </div>
          <span className="text-[11px] bg-[#FF5038]/15 text-[#FF5038] border border-[#FF5038]/30 px-2 py-0.5 rounded-full font-bold">
            {dependencies.length} dependencias activas
          </span>
        </div>

        <div className="space-y-3 pt-2">
          {dependencies.map((dep, idx) => {
            const blockerItem = actionItems.find((a) => a.id === dep.blockerTaskId);
            const blockedItem = actionItems.find((a) => a.id === dep.blockedTaskId);

            return (
              <div
                key={dep.id || idx}
                className="bg-[#141517] border border-[#2A2C2F] rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 hover:border-[#FF5038]/40 transition-colors"
              >
                {/* Blocker Node (Must complete first) */}
                <div
                  onClick={() => blockerItem && onOpenTicketDetails(blockerItem)}
                  className="flex-1 bg-[#1C1E20] p-3 rounded-lg border border-[#3E4247] cursor-pointer hover:border-[#FF5038] transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold text-[#FF5038] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Debe culminar primero
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {blockerItem?.jiraTicketKey || 'En Progreso'}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white truncate max-w-[280px]">
                    {dep.blockerTitle}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-300">
                    <User className="w-3 h-3 text-[#EE880E]" />
                    <span className="font-semibold">{dep.blockerAssignee}</span>
                  </div>
                </div>

                {/* Arrow & Relation Description */}
                <div className="flex flex-col items-center justify-center px-2 py-1 text-center shrink-0">
                  <div className="hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-[#FF5038]/10 text-[#FF5038] border border-[#FF5038]/30">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium max-w-[200px] mt-1 leading-tight">
                    {dep.description}
                  </span>
                </div>

                {/* Blocked Node (Can only proceed after) */}
                <div
                  onClick={() => blockedItem && onOpenTicketDetails(blockedItem)}
                  className="flex-1 bg-[#1C1E20] p-3 rounded-lg border border-[#3E4247] cursor-pointer hover:border-[#61BFED] transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold text-[#61BFED] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Espera este entregable
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {blockedItem?.jiraTicketKey || 'Bloqueado / Pendiente'}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white truncate max-w-[280px]">
                    {dep.blockedTitle}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-300">
                    <User className="w-3 h-3 text-[#61BFED]" />
                    <span className="font-semibold">{dep.blockedAssignee}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
