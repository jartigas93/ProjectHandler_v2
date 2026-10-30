import React from 'react';
import { Calendar, CheckSquare, History, BarChart3, Settings, Sparkles, Sliders, FolderArchive, HardDrive } from 'lucide-react';
import { JiraConfig, DatabaseConfig } from '../types';
import { ProyectHandlerBrand } from './CivicaLogo';

interface NavbarProps {
  activeTab: 'transcript' | 'summary' | 'meetings' | 'history' | 'monthly';
  setActiveTab: (tab: 'transcript' | 'summary' | 'meetings' | 'history' | 'monthly') => void;
  jiraConfig: JiraConfig;
  databaseConfig?: DatabaseConfig;
  onOpenJiraSettings: () => void;
  hasActiveMeeting: boolean;
  topicsCount: number;
  meetingsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  jiraConfig,
  databaseConfig,
  onOpenJiraSettings,
  hasActiveMeeting,
  topicsCount,
  meetingsCount = 0,
}) => {
  return (
    <header className="bg-[#1C1D1F] border-b border-[#2E3033] text-slate-100 sticky top-0 z-30 shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand ProyectHandler */}
          <div className="flex items-center gap-3">
            <ProyectHandlerBrand size="md" />
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={() => setActiveTab('transcript')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'transcript'
                  ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-md shadow-[#FF5038]/25'
                  : 'text-slate-300 hover:text-white hover:bg-[#2A2C2F]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden md:inline">Procesar Reunión</span>
              <span className="md:hidden">Procesar</span>
            </button>

            <button
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
                activeTab === 'summary'
                  ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-md shadow-[#FF5038]/25'
                  : 'text-slate-300 hover:text-white hover:bg-[#2A2C2F]'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span className="hidden md:inline">Resumen & Tickets</span>
              <span className="md:hidden">Resumen</span>
              {hasActiveMeeting && (
                <span className="w-2 h-2 rounded-full bg-[#29E78C] absolute top-1.5 right-1.5 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('meetings')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
                activeTab === 'meetings'
                  ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-md shadow-[#FF5038]/25'
                  : 'text-slate-300 hover:text-white hover:bg-[#2A2C2F]'
              }`}
              title="Histórico de resúmenes de reuniones guardadas por mes y fecha"
            >
              <FolderArchive className="w-4 h-4 text-[#EE880E]" />
              <span className="hidden lg:inline">Histórico de Reuniones</span>
              <span className="lg:hidden">Reuniones</span>
              {meetingsCount > 0 && (
                <span className="bg-[#2A2C2F] text-slate-200 text-xs px-1.5 py-0.2 rounded-full font-bold ml-0.5 border border-slate-700">
                  {meetingsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-md shadow-[#FF5038]/25'
                  : 'text-slate-300 hover:text-white hover:bg-[#2A2C2F]'
              }`}
            >
              <History className="w-4 h-4" />
              <span className="hidden md:inline">Histórico de Temas</span>
              <span className="md:hidden">Temas</span>
              {topicsCount > 0 && (
                <span className="bg-[#2A2C2F] text-slate-200 text-xs px-1.5 py-0.2 rounded-full font-bold ml-0.5 border border-slate-700">
                  {topicsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('monthly')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'monthly'
                  ? 'bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white shadow-md shadow-[#FF5038]/25'
                  : 'text-slate-300 hover:text-white hover:bg-[#2A2C2F]'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden md:inline">Reporte Mensual</span>
              <span className="md:hidden">Reporte</span>
            </button>
          </nav>

          {/* Project & Storage Configuration Actions */}
          <div className="flex items-center gap-2">
            {/* Storage Status Badge */}
            <button
              onClick={onOpenJiraSettings}
              className="flex items-center gap-1.5 bg-[#25272A] hover:bg-[#2F3236] text-slate-200 border border-[#3E4247] px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all group cursor-pointer"
              title={
                databaseConfig?.enabled && databaseConfig.type !== 'none'
                  ? `Persistencia activa en base de datos: ${databaseConfig.type.toUpperCase()}`
                  : 'Almacenamiento Local (localStorage) activo. Sin base de datos externa.'
              }
            >
              <HardDrive
                className={`w-3.5 h-3.5 ${
                  databaseConfig?.enabled && databaseConfig.type !== 'none'
                    ? 'text-[#29E78C]'
                    : 'text-slate-400 group-hover:text-[#EE880E]'
                } transition-colors`}
              />
              <span className="text-[11px] font-mono text-slate-300 group-hover:text-white">
                {databaseConfig?.enabled && databaseConfig.type !== 'none'
                  ? databaseConfig.type.toUpperCase()
                  : 'Local'}
              </span>
              {databaseConfig?.enabled && databaseConfig.type !== 'none' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#29E78C] animate-pulse" />
              )}
            </button>

            <button
              onClick={onOpenJiraSettings}
              className="flex items-center gap-2 bg-[#25272A] hover:bg-[#2F3236] text-slate-200 border border-[#3E4247] px-3 py-1.5 rounded-xl text-xs font-semibold transition-all group cursor-pointer"
              title="Configuración de Story Points, Categorías, Jira y Base de Datos"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    jiraConfig.simulationMode
                      ? 'bg-[#61BFED]'
                      : jiraConfig.apiToken
                      ? 'bg-[#29E78C]'
                      : 'bg-[#FFAD32]'
                  }`}
                />
                <span className="text-slate-300 group-hover:text-white font-mono">
                  Jira: [{jiraConfig.projectKey}]
                </span>
              </div>
              <Sliders className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#FF5038] transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
