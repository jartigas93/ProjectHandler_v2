import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { TranscriptInputTab } from './components/TranscriptInputTab';
import { MeetingSummaryTab } from './components/MeetingSummaryTab';
import { TopicHistoryTab } from './components/TopicHistoryTab';
import { MonthlyReportTab } from './components/MonthlyReportTab';
import { SavedMeetingsTab } from './components/SavedMeetingsTab';
import { ProjectConfigModal } from './components/ProjectConfigModal';
import { JiraTicketModal } from './components/JiraTicketModal';
import { AiErrorModal } from './components/AiErrorModal';
import {
  MeetingAnalysis,
  ActionItem,
  TopicHistoryRecord,
  MonthlyReport,
  JiraConfig,
  ProjectSettings,
  PromptMode,
  TopicStatus
} from './types';
import {
  loadSavedMeetings,
  saveMeeting,
  deleteSavedMeeting,
  loadTopicHistory,
  saveTopicHistory,
  deleteTopic,
  clearTopicHistory,
  updateOrAddTopic,
  filterTopicsForMonth,
  loadProjectSettings,
  saveProjectSettings,
  loadMonthlyReports,
  saveMonthlyReport,
  deleteMonthlyReport
} from './utils/storage';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary' | 'meetings' | 'history' | 'monthly'>('transcript');

  // Input states (clean start, no sample data)
  const [transcript, setTranscript] = useState<string>('');
  const [meetingTitle, setMeetingTitle] = useState<string>('');
  const [meetingDate, setMeetingDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [promptMode, setPromptMode] = useState<PromptMode>('standard');
  const [customPrompt, setCustomPrompt] = useState<string>('');

  // Domain data & Project configuration
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(loadProjectSettings());
  const jiraConfig = projectSettings.jira;

  const [activeMeeting, setActiveMeeting] = useState<MeetingAnalysis | null>(null);
  const [savedMeetingsList, setSavedMeetingsList] = useState<MeetingAnalysis[]>([]);
  const [savedMeetingStatus, setSavedMeetingStatus] = useState(false);
  const [topicsHistory, setTopicsHistory] = useState<TopicHistoryRecord[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [currentMonthlyReport, setCurrentMonthlyReport] = useState<MonthlyReport | null>(null);
  const [savedToHistory, setSavedToHistory] = useState(false);

  // Loading & status
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSyncingStatuses, setIsSyncingStatuses] = useState(false);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [selectedActionItem, setSelectedActionItem] = useState<ActionItem | null>(null);

  // Banner notification toast
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Popup dialog for errors returned by the selected AI model (e.g. 503 high demand)
  const [aiErrorDialog, setAiErrorDialog] = useState<{
    provider: string;
    model: string;
    status: number | null;
    message: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Initial load
  useEffect(() => {
    const loadedTopics = loadTopicHistory();
    setTopicsHistory(loadedTopics);

    const loadedMeetings = loadSavedMeetings();
    setSavedMeetingsList(loadedMeetings);

    const loadedReports = loadMonthlyReports();
    setMonthlyReports(loadedReports);
    if (loadedReports.length > 0) {
      setCurrentMonthlyReport(loadedReports[0]);
    }
    // Clean initial state: no sample/test meetings loaded by default
  }, []);

  // Handler: Analyze Transcript with Server-Side Gemini API
  const handleAnalyzeTranscript = async () => {
    if (!transcript.trim()) {
      showToast('error', 'Por favor ingresa o pega una transcripción de Teams.');
      return;
    }

    setIsLoadingAnalysis(true);
    try {
      const response = await fetch('/api/analyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          promptMode,
          customPrompt,
          meetingTitle,
          meetingDate,
          jiraProjectKey: jiraConfig.projectKey,
          aiProvider: projectSettings.ai?.activeProvider || 'claude',
          aiModel: projectSettings.ai?.selectedModel || 'claude-3-7-sonnet-20250219',
          aiKeys: {
            anthropicApiKey: projectSettings.ai?.anthropicApiKey,
            openAiApiKey: projectSettings.ai?.openAiApiKey,
            azureApiKey: projectSettings.ai?.azureApiKey,
            azureEndpoint: projectSettings.ai?.azureEndpoint,
            azureDeploymentName: projectSettings.ai?.azureDeploymentName,
            azureApiVersion: projectSettings.ai?.azureApiVersion,
            geminiApiKey: projectSettings.ai?.geminiApiKey,
          },
          jiraConfig,
          jiraUsers: projectSettings.jiraUsers,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        if (errBody?.aiError) {
          setAiErrorDialog(errBody.aiError);
          return;
        }
        throw new Error(errBody?.error || 'El servidor devolvió un error al analizar la transcripción.');
      }

      const meetingData: MeetingAnalysis = await response.json();
      setActiveMeeting(meetingData);
      saveMeeting(meetingData);
      setSavedMeetingsList(loadSavedMeetings());
      setSavedMeetingStatus(true);
      setSavedToHistory(false);

      // Automatically register / update topic history from this meeting
      syncMeetingToTopicHistory(meetingData);

      setActiveTab('summary');
      if ((meetingData as any).warning) {
        showToast(
          'info',
          `Reunión procesada: ${meetingData.actionItems.length} tareas asignadas. ${(meetingData as any).warning}`
        );
      } else {
        showToast(
          'success',
          `Reunión analizada con IA: ${meetingData.actionItems.length} tareas asignadas y ${meetingData.participants.length} participantes detectados.`
        );
      }
    } catch (err: any) {
      console.error('Error analyzing transcript:', err);
      showToast('error', err.message || 'Error al analizar la transcripción de Teams.');
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  // Helper: Sync meeting topics into Topic History database
  const syncMeetingToTopicHistory = (meeting: MeetingAnalysis) => {
    const existing = loadTopicHistory();
    const updated = [...existing];

    (meeting.mainTopics || []).forEach((top) => {
      const matchIdx = updated.findIndex(
        (t) => t.topicName.toLowerCase().trim() === top.topicName.toLowerCase().trim()
      );

      if (matchIdx >= 0) {
        // Topic exists: append meeting discussion
        const t = updated[matchIdx];
        const meetingExists = t.meetings.some((m) => m.meetingId === meeting.id);
        const newMeetings = meetingExists
          ? t.meetings
          : [
              ...t.meetings,
              {
                meetingId: meeting.id,
                meetingTitle: meeting.meetingTitle,
                date: meeting.meetingDate,
                summary: top.discussionSummary,
              },
            ];

        updated[matchIdx] = {
          ...t,
          lastDiscussedDate: meeting.meetingDate,
          status: top.status as TopicStatus,
          meetings: newMeetings,
          updatedAt: new Date().toISOString(),
        };
      } else {
        // New topic
        updated.unshift({
          id: 'topic-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          topicName: top.topicName,
          category: top.category || 'General',
          firstDiscussedDate: meeting.meetingDate,
          lastDiscussedDate: meeting.meetingDate,
          meetings: [
            {
              meetingId: meeting.id,
              meetingTitle: meeting.meetingTitle,
              date: meeting.meetingDate,
              summary: top.discussionSummary,
            },
          ],
          status: top.status as TopicStatus,
          leadParticipant: top.leadAssignee || meeting.participants[0]?.name || 'Equipo',
          allParticipants: meeting.participants.map((p) => p.name),
          associatedJiraKeys: [],
          progressPercent: top.status === 'Completado' ? 100 : top.status === 'En Progreso' ? 50 : 20,
          notes: [`${new Date().toLocaleDateString('es-ES')}: Identificado en reunión '${meeting.meetingTitle}'.`],
          updatedAt: new Date().toISOString(),
        });
      }
    });

    saveTopicHistory(updated);
    setTopicsHistory(updated);
    setSavedToHistory(true);
  };

  // Handler: Manual save to topic history
  const handleSaveToTopicHistory = () => {
    if (!activeMeeting) return;
    syncMeetingToTopicHistory(activeMeeting);
    showToast('success', 'Todos los temas y compromisos se guardaron en el histórico.');
  };

  // Handler: Sync Single Action Item to Jira
  const handleSyncSingleItem = async (item: ActionItem) => {
    if (!activeMeeting) return;

    try {
      const res = await fetch('/api/jira/create-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionItem: item,
          jiraConfig,
          jiraUsers: projectSettings.jiraUsers,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al crear el issue en Jira.');
      }

      // Update item in activeMeeting
      const updatedActionItems = activeMeeting.actionItems.map((act) => {
        if (act.id === item.id) {
          return {
            ...act,
            jiraTicketKey: data.issueKey,
            jiraTicketUrl: data.issueUrl,
            jiraStatus: 'synced' as const,
            jiraSyncedAt: data.syncedAt,
          };
        }
        return act;
      });

      const updatedMeeting = { ...activeMeeting, actionItems: updatedActionItems };
      setActiveMeeting(updatedMeeting);
      saveMeeting(updatedMeeting);

      // Also record ticket key in topics history if topic matches
      if (item.topicName) {
        const currentTopics = loadTopicHistory();
        const tIndex = currentTopics.findIndex(
          (t) => t.topicName.toLowerCase().trim() === item.topicName.toLowerCase().trim()
        );
        if (tIndex >= 0 && !currentTopics[tIndex].associatedJiraKeys.includes(data.issueKey)) {
          currentTopics[tIndex].associatedJiraKeys.push(data.issueKey);
          saveTopicHistory(currentTopics);
          setTopicsHistory(currentTopics);
        }
      }

      showToast(
        'success',
        `Ticket creado en Jira: ${data.issueKey} (${item.assignee} - ${jiraConfig.simulationMode ? 'Modo Simulado' : 'Jira Cloud'})`
      );
    } catch (err: any) {
      console.error('Error syncing to Jira:', err);
      showToast('error', err.message || 'Error al conectar con Jira.');
    }
  };

  // Handler: Batch sync all unsynced items
  const handleBatchSyncAll = async () => {
    if (!activeMeeting) return;
    const unsynced = activeMeeting.actionItems.filter((i) => i.jiraStatus !== 'synced');
    if (unsynced.length === 0) {
      showToast('info', 'Todos los tickets ya se encuentran sincronizados con Jira.');
      return;
    }

    setIsBatchSyncing(true);
    let successCount = 0;
    try {
      for (const item of unsynced) {
        await handleSyncSingleItem(item);
        successCount++;
      }
      showToast('success', `¡Sincronización completa! Se crearon ${successCount} tickets en Jira.`);
    } catch (err: any) {
      showToast('error', `Sincronización parcial: ${err.message}`);
    } finally {
      setIsBatchSyncing(false);
    }
  };

  // Handler: Update action item from modal
  const handleUpdateItem = (updated: ActionItem) => {
    if (!activeMeeting) return;
    const items = activeMeeting.actionItems.map((i) => (i.id === updated.id ? updated : i));
    const meeting = { ...activeMeeting, actionItems: items };
    setActiveMeeting(meeting);
    saveMeeting(meeting);
  };

  // Latest active meeting, readable from async callbacks without stale closures
  const activeMeetingRef = useRef<MeetingAnalysis | null>(null);
  activeMeetingRef.current = activeMeeting;

  // Core: pull the current state of the meeting's Jira tickets and merge it into the app
  const syncStatusesFromJira = async (meeting: MeetingAnalysis, silent = false) => {
    const syncedKeys = meeting.actionItems
      .map((a) => a.jiraTicketKey)
      .filter(Boolean) as string[];

    if (syncedKeys.length === 0) {
      if (!silent) showToast('info', 'No hay tickets creados en Jira para sincronizar su estado aún.');
      return;
    }

    if (!silent) setIsSyncingStatuses(true);
    try {
      const res = await fetch('/api/jira/sync-statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueKeys: syncedKeys, jiraConfig }),
      });
      const data = await res.json();
      if (!res.ok || !data.statuses) {
        throw new Error(data.error || 'Error al sincronizar estados con Jira.');
      }

      // The user may have switched meetings or edited items while waiting: merge onto the latest state
      const latest = activeMeetingRef.current;
      if (!latest || latest.id !== meeting.id) return;

      const isLive = data.mode === 'live-jira';
      const nowIso = new Date().toISOString();
      const changedKeys: string[] = [];

      const updatedItems = latest.actionItems.map((item) => {
        const remote = item.jiraTicketKey ? data.statuses[item.jiraTicketKey] : undefined;
        if (!item.jiraTicketKey || !remote) return item;

        const next: ActionItem = {
          ...item,
          jiraIssueStatus: remote.status,
          jiraStatusCategory: remote.statusCategory,
          jiraRemoteUpdatedAt: remote.updated,
          jiraLastSyncedFromJiraAt: nowIso,
        };
        let changed = item.jiraIssueStatus !== remote.status;

        // Field-level sync only against a real Jira (simulation returns no fields)
        if (isLive) {
          if (remote.summary && remote.summary !== item.title) {
            next.title = remote.summary;
            changed = true;
          }
          if (remote.priority) {
            const mapped = (remote.priority === 'Lowest' ? 'Low' : remote.priority === 'Critical' ? 'Highest' : remote.priority) as ActionItem['priority'];
            if (['Highest', 'High', 'Medium', 'Low'].includes(mapped) && mapped !== item.priority) {
              next.priority = mapped;
              changed = true;
            }
          }
          if (Array.isArray(remote.labels) && remote.labels.length > 0) {
            const merged = Array.from(new Set([...(item.jiraLabels || []), ...remote.labels]));
            if (merged.length !== (item.jiraLabels || []).length) {
              next.jiraLabels = merged;
              changed = true;
            }
          }
          // Assignee: remember the first accountId silently; flag later reassignments
          const remoteAccount: string | null = remote.assigneeAccountId ?? null;
          if (item.jiraAssigneeAccountId === undefined) {
            next.jiraAssigneeAccountId = remoteAccount;
          } else if (item.jiraAssigneeAccountId !== remoteAccount) {
            next.jiraAssigneeAccountId = remoteAccount;
            next.assignee = remote.assignee || 'Sin asignar';
            changed = true;
          }
        }

        if (changed) changedKeys.push(item.jiraTicketKey);
        return next;
      });

      const updatedMeeting = { ...latest, actionItems: updatedItems };
      setActiveMeeting(updatedMeeting);
      // Silent auto-syncs must not push a never-saved meeting into the archive
      if (!silent || loadSavedMeetings().some((m) => m.id === updatedMeeting.id)) {
        saveMeeting(updatedMeeting);
      }

      // Topic progress derived from its tickets: Done = 100%, review = 80%, in progress = 50%, to do = 0%
      const categoryByKey: Record<string, { category: string; progress: number }> = {};
      loadSavedMeetings().forEach((m) =>
        m.actionItems.forEach((a) => {
          if (a.jiraTicketKey && a.jiraStatusCategory) {
            categoryByKey[a.jiraTicketKey] = {
              category: a.jiraStatusCategory,
              progress: a.jiraStatusCategory === 'Done' ? 100 : a.jiraStatusCategory === 'In Progress' ? 50 : 0,
            };
          }
        })
      );
      Object.entries(data.statuses as Record<string, any>).forEach(([key, s]) => {
        categoryByKey[key] = {
          category: s.statusCategory,
          progress: s.statusCategory === 'Done' ? 100 : s.progress >= 80 ? 80 : s.statusCategory === 'In Progress' ? 50 : 0,
        };
      });

      const topics = loadTopicHistory();
      let topicsChanged = false;
      const updatedTopics = topics.map((t) => {
        const known = t.associatedJiraKeys.map((k) => categoryByKey[k]).filter(Boolean);
        if (known.length === 0) return t;
        const percent = Math.round(known.reduce((sum, k) => sum + k.progress, 0) / known.length);
        if (percent === t.progressPercent) return t;
        topicsChanged = true;
        return { ...t, progressPercent: percent, updatedAt: nowIso };
      });
      if (topicsChanged) {
        saveTopicHistory(updatedTopics);
        setTopicsHistory(updatedTopics);
      }

      const errorKeys = Object.keys(data.errors || {});
      if (!silent) {
        if (errorKeys.length > 0) {
          showToast('error', `No se pudo leer ${errorKeys.join(', ')}: ${data.errors[errorKeys[0]]}`);
        } else if (changedKeys.length > 0) {
          showToast('success', `Sincronizado con Jira: ${changedKeys.length} ticket(s) con cambios (${changedKeys.join(', ')}).`);
        } else {
          showToast('info', 'Sincronizado con Jira: no hay cambios en los tickets.');
        }
      } else if (changedKeys.length > 0) {
        showToast('info', `Jira actualizó ${changedKeys.length} ticket(s): ${changedKeys.join(', ')}.`);
      }
    } catch (err: any) {
      console.error('Error syncing statuses from Jira:', err);
      if (!silent) showToast('error', err.message || 'Error al sincronizar estados con Jira.');
    } finally {
      if (!silent) setIsSyncingStatuses(false);
    }
  };

  // Handler: Bidirectional status sync from Jira Cloud (manual button)
  const handleBidirectionalSync = async () => {
    if (!activeMeeting) return;
    await syncStatusesFromJira(activeMeeting, false);
  };

  // Auto-sync from Jira whenever a different meeting is opened (real Jira mode only)
  useEffect(() => {
    if (!activeMeeting || jiraConfig.simulationMode) return;
    if (!activeMeeting.actionItems.some((a) => a.jiraTicketKey)) return;
    syncStatusesFromJira(activeMeeting, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMeeting?.id, jiraConfig.simulationMode]);

  // Handler: Assign orphan commitment
  const handleAssignOrphan = (orphan: any, assigneeName: string) => {
    if (!activeMeeting) return;

    const newActionItem: ActionItem = {
      id: 'act-' + Date.now(),
      title: orphan.title,
      description: orphan.context,
      assignee: assigneeName,
      topicName: orphan.topicName || 'General',
      priority: orphan.priority || 'High',
      issueType: 'Task',
      storyPoints: 3,
      deadline: 'Próxima iteración',
      acceptanceCriteria: ['Verificar ejecución y entrega con el equipo.'],
      jiraLabels: ['orphan-resolved', 'teams-ai'],
      jiraStatus: 'pending',
      jiraIssueStatus: 'To Do',
    };

    const updatedOrphans = (activeMeeting.orphanCommitments || []).filter((o) => o.id !== orphan.id);
    const updatedMeeting: MeetingAnalysis = {
      ...activeMeeting,
      actionItems: [newActionItem, ...activeMeeting.actionItems],
      orphanCommitments: updatedOrphans,
    };

    setActiveMeeting(updatedMeeting);
    saveMeeting(updatedMeeting);
    showToast('success', `Compromiso asignado a ${assigneeName} y convertido en tarea Jira.`);
  };

  // Handler: Add Proposed Comment to existing Jira Ticket
  const handleAddCommentToJira = async (item: ActionItem, customComment?: string) => {
    if (!activeMeeting) return;
    const targetKey = item.matchedJiraKey || item.jiraTicketKey;
    if (!targetKey) {
      showToast('error', 'La tarea no tiene una clave de Jira vinculada.');
      return;
    }

    const commentToSend = (customComment ?? item.proposedComment ?? '').trim();
    if (!commentToSend) {
      showToast('error', 'El comentario no puede estar vacío.');
      return;
    }

    try {
      const res = await fetch('/api/jira/add-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueKey: targetKey,
          comment: commentToSend,
          jiraConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al agregar el comentario en Jira.');
      }

      // Update item in meeting state
      const updatedActionItems = activeMeeting.actionItems.map((act) => {
        if (act.id === item.id) {
          return {
            ...act,
            commentStatus: 'added' as const,
            commentAddedAt: data.addedAt,
            proposedComment: commentToSend,
          };
        }
        return act;
      });

      const updatedMeeting = { ...activeMeeting, actionItems: updatedActionItems };
      setActiveMeeting(updatedMeeting);
      saveMeeting(updatedMeeting);

      showToast(
        'success',
        `Comentario publicado en Jira para el ticket ${targetKey} (${jiraConfig.simulationMode ? 'Modo Simulado' : 'Jira Cloud'}).`
      );
    } catch (err: any) {
      console.error('Error adding comment to Jira:', err);
      showToast('error', err.message || 'Error al conectar con Jira para publicar el comentario.');
    }
  };

  // Handler: Switch between Existing (matched) and New task
  const handleToggleTaskKind = (itemId: string) => {
    if (!activeMeeting) return;
    const updatedItems = activeMeeting.actionItems.map((it) => {
      if (it.id === itemId) {
        if (it.taskKind === 'existing') {
          return {
            ...it,
            taskKind: 'new' as const,
            matchedJiraKey: undefined,
            jiraTicketKey: undefined,
            jiraStatus: 'pending' as const,
            proposedComment: undefined,
            isClosedMatch: false,
          };
        } else {
          return {
            ...it,
            taskKind: 'existing' as const,
          };
        }
      }
      return it;
    });
    const updatedMeeting = { ...activeMeeting, actionItems: updatedItems };
    setActiveMeeting(updatedMeeting);
    saveMeeting(updatedMeeting);
    showToast('info', 'Clasificación de tarea actualizada.');
  };

  // Handler: Manual save meeting summary
  const handleSaveMeetingSummary = (meetingToSave: MeetingAnalysis) => {
    saveMeeting(meetingToSave);
    const updated = loadSavedMeetings();
    setSavedMeetingsList(updated);
    setSavedMeetingStatus(true);
    showToast('success', `Resumen de "${meetingToSave.meetingTitle}" guardado en el histórico.`);
  };

  // Handler: Delete saved meeting from archive
  const handleDeleteSavedMeeting = (meetingId: string) => {
    deleteSavedMeeting(meetingId);
    const updated = loadSavedMeetings();
    setSavedMeetingsList(updated);
    if (activeMeeting?.id === meetingId) {
      setSavedMeetingStatus(false);
    }
    showToast('info', 'Reunión eliminada del histórico.');
  };

  // Handler: Select meeting from archive
  const handleSelectMeetingFromArchive = (selected: MeetingAnalysis) => {
    setActiveMeeting(selected);
    setSavedMeetingStatus(true);
    setActiveTab('summary');
    showToast('info', `Cargada reunión: "${selected.meetingTitle}" (${selected.meetingDate})`);
  };

  // Handler: Delete monthly report
  const handleDeleteMonthlyReport = (monthYear: string) => {
    deleteMonthlyReport(monthYear);
    const updated = loadMonthlyReports();
    setMonthlyReports(updated);
    if (currentMonthlyReport?.monthYear === monthYear) {
      setCurrentMonthlyReport(updated.length > 0 ? updated[0] : null);
    }
    showToast('info', `Reporte de ${monthYear} eliminado.`);
  };

  // Handler: Generate Monthly Progress Report with AI (scoped to month topics and meetings)
  const handleGenerateMonthlyReport = async (monthYear: string, monthName: string) => {
    setIsGeneratingReport(true);
    try {
      const allMeetings = loadSavedMeetings();
      const currentTopics = loadTopicHistory();

      // Scoped strictly to the selected month
      const monthMeetings = allMeetings.filter((m) => m.meetingDate && m.meetingDate.startsWith(monthYear));
      const monthTopics = filterTopicsForMonth(currentTopics, monthYear);
      const monthItems = monthMeetings.flatMap((m) => m.actionItems || []);

      const response = await fetch('/api/generate-monthly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthYear,
          monthName,
          topics: monthTopics,
          actionItems: monthItems,
          meetingsCount: monthMeetings.length,
          aiProvider: projectSettings.ai?.activeProvider || 'claude',
          aiModel: projectSettings.ai?.selectedModel || 'claude-3-7-sonnet-20250219',
          aiKeys: {
            anthropicApiKey: projectSettings.ai?.anthropicApiKey,
            openAiApiKey: projectSettings.ai?.openAiApiKey,
            azureApiKey: projectSettings.ai?.azureApiKey,
            azureEndpoint: projectSettings.ai?.azureEndpoint,
            azureDeploymentName: projectSettings.ai?.azureDeploymentName,
            azureApiVersion: projectSettings.ai?.azureApiVersion,
            geminiApiKey: projectSettings.ai?.geminiApiKey,
          },
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        if (errBody?.aiError) {
          setAiErrorDialog(errBody.aiError);
          return;
        }
        throw new Error(errBody?.error || 'Error al generar el reporte mensual con IA.');
      }

      const report: MonthlyReport = await response.json();
      setCurrentMonthlyReport(report);
      saveMonthlyReport(report);
      setMonthlyReports(loadMonthlyReports());
      showToast('success', `Reporte de progreso mensual para ${monthName} generado con éxito.`);
    } catch (err: any) {
      console.error('Error generating monthly report:', err);
      showToast('error', err.message || 'Error al generar reporte mensual.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Handler: Update topic in history
  const handleUpdateTopic = (updated: TopicHistoryRecord) => {
    updateOrAddTopic(updated);
    setTopicsHistory(loadTopicHistory());
    showToast('info', `Tema "${updated.topicName}" actualizado.`);
  };

  // Handler: Add new topic manually
  const handleAddNewTopic = (newTopic: TopicHistoryRecord) => {
    updateOrAddTopic(newTopic);
    setTopicsHistory(loadTopicHistory());
    showToast('success', `Nuevo tema "${newTopic.topicName}" añadido al seguimiento.`);
  };

  // Handler: Delete topic from history
  const handleDeleteTopic = (topicId: string) => {
    deleteTopic(topicId);
    setTopicsHistory(loadTopicHistory());
    showToast('info', 'Tema eliminado del histórico.');
  };

  // Handler: Clear all topics
  const handleClearAllTopics = () => {
    clearTopicHistory();
    setTopicsHistory([]);
    showToast('info', 'Histórico de temas vaciado por completo.');
  };

  // Handler: Save Project Settings (Story Points, Categories, Jira Users, Connection)
  const handleSaveProjectSettings = (newSettings: ProjectSettings) => {
    setProjectSettings(newSettings);
    saveProjectSettings(newSettings);
    showToast(
      'success',
      `Configuración guardada: Proyecto ${newSettings.jira.projectKey}, ${newSettings.topicCategories.length} categorías y ${newSettings.jiraUsers.length} usuarios Jira.`
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        jiraConfig={jiraConfig}
        onOpenJiraSettings={() => setIsSettingsOpen(true)}
        hasActiveMeeting={Boolean(activeMeeting)}
        topicsCount={topicsHistory.length}
        meetingsCount={savedMeetingsList.length}
      />

      {/* AI Model Error Popup */}
      {aiErrorDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="ai-error-title"
          onClick={() => setAiErrorDialog(null)}
        >
          <div
            className="bg-[#1C1E20] border border-[#FF5038]/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in duration-200 font-['Montserrat']"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2E3135] bg-[#291717]">
              <AlertTriangle className="w-5 h-5 text-[#FF5038] shrink-0" />
              <h2 id="ai-error-title" className="text-sm font-bold text-white font-['Lato'] flex-1">
                El modelo de IA devolvió un error
              </h2>
              <button
                id="ai-error-close-x"
                onClick={() => setAiErrorDialog(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#25282B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#141517] border border-[#3E4247] text-slate-300 font-mono uppercase">
                  {aiErrorDialog.provider}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#141517] border border-[#3E4247] text-slate-300 font-mono">
                  {aiErrorDialog.model}
                </span>
                {aiErrorDialog.status !== null && (
                  <span className="px-2 py-0.5 rounded-md bg-[#FF5038]/15 border border-[#FF5038]/40 text-[#FF5038] font-mono font-bold">
                    Error {aiErrorDialog.status}
                  </span>
                )}
              </div>
              <p className="text-slate-200 leading-relaxed bg-[#141517] border border-[#2A2C2F] rounded-xl p-3 break-words">
                {aiErrorDialog.message}
              </p>
              <p className="text-[11px] text-slate-400">
                No se ha generado ningún análisis. Inténtalo de nuevo más tarde o cambia de modelo en la pestaña de carga.
              </p>
            </div>
            <div className="flex justify-end px-5 py-3 border-t border-[#2E3135] bg-[#141517]">
              <button
                id="ai-error-close"
                onClick={() => setAiErrorDialog(null)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF5038] to-[#EE880E] text-white text-xs font-bold cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-xs font-medium ${
              notification.type === 'success'
                ? 'bg-[#18231C] border-[#29E78C]/50 text-[#29E78C]'
                : notification.type === 'error'
                ? 'bg-[#291717] border-[#FF5038]/50 text-[#FF5038]'
                : 'bg-[#211F24] border-[#EE880E]/50 text-[#EE880E]'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#29E78C] shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-[#FF5038] shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-[#EE880E] shrink-0" />
            )}
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'transcript' && (
          <TranscriptInputTab
            transcript={transcript}
            setTranscript={setTranscript}
            meetingTitle={meetingTitle}
            setMeetingTitle={setMeetingTitle}
            meetingDate={meetingDate}
            setMeetingDate={setMeetingDate}
            promptMode={promptMode}
            setPromptMode={setPromptMode}
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
            jiraConfig={jiraConfig}
            aiConfig={projectSettings.ai}
            onUpdateAiConfig={(newAi) => handleSaveProjectSettings({ ...projectSettings, ai: newAi })}
            onOpenAiSettings={() => setIsSettingsOpen(true)}
            onAnalyze={handleAnalyzeTranscript}
            isLoading={isLoadingAnalysis}
          />
        )}

        {activeTab === 'summary' && (
          <MeetingSummaryTab
            meeting={activeMeeting}
            jiraConfig={jiraConfig}
            jiraUsers={projectSettings.jiraUsers}
            onSyncSingleItem={handleSyncSingleItem}
            onBatchSyncAll={handleBatchSyncAll}
            isBatchSyncing={isBatchSyncing}
            onOpenTicketDetails={(item) => {
              setSelectedActionItem(item);
              setIsTicketModalOpen(true);
            }}
            onSaveToTopicHistory={handleSaveToTopicHistory}
            savedToHistory={savedToHistory}
            onSaveMeetingSummary={handleSaveMeetingSummary}
            savedMeeting={savedMeetingStatus}
            onGoToSavedMeetings={() => setActiveTab('meetings')}
            onBackToInput={() => setActiveTab('transcript')}
            onBidirectionalSync={handleBidirectionalSync}
            isSyncingStatuses={isSyncingStatuses}
            onAssignOrphan={handleAssignOrphan}
            onAddComment={handleAddCommentToJira}
            onToggleTaskKind={handleToggleTaskKind}
          />
        )}

        {activeTab === 'meetings' && (
          <SavedMeetingsTab
            meetings={savedMeetingsList}
            onSelectMeeting={handleSelectMeetingFromArchive}
            onDeleteMeeting={handleDeleteSavedMeeting}
            onGoToTranscript={() => setActiveTab('transcript')}
          />
        )}

        {activeTab === 'history' && (
          <TopicHistoryTab
            topics={topicsHistory}
            onUpdateTopic={handleUpdateTopic}
            onAddNewTopic={handleAddNewTopic}
            onDeleteTopic={handleDeleteTopic}
            onClearAllTopics={handleClearAllTopics}
            onGoToMonthlyReport={() => setActiveTab('monthly')}
            topicCategories={projectSettings.topicCategories}
            jiraUsers={projectSettings.jiraUsers}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {activeTab === 'monthly' && (
          <MonthlyReportTab
            topics={topicsHistory}
            allActionItems={activeMeeting?.actionItems || []}
            allMeetings={savedMeetingsList}
            reports={monthlyReports}
            currentReport={currentMonthlyReport}
            onGenerateReport={handleGenerateMonthlyReport}
            onDeleteReport={handleDeleteMonthlyReport}
            isGenerating={isGeneratingReport}
          />
        )}
      </main>

      {/* Project Configuration Modal (Story Points, Categories, Jira Users, Atlassian) */}
      <ProjectConfigModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={projectSettings}
        onSave={handleSaveProjectSettings}
      />

      {/* Jira Ticket Details Modal */}
      <JiraTicketModal
        isOpen={isTicketModalOpen}
        onClose={() => {
          setIsTicketModalOpen(false);
          setSelectedActionItem(null);
        }}
        item={selectedActionItem}
        jiraConfig={jiraConfig}
        jiraUsers={projectSettings.jiraUsers}
        onSyncSingleItem={handleSyncSingleItem}
        onUpdateItem={handleUpdateItem}
      />

      {/* AI Error Popup Modal */}
      <AiErrorModal
        isOpen={Boolean(aiErrorDialog)}
        onClose={() => setAiErrorDialog(null)}
        error={aiErrorDialog}
        onRetry={activeTab === 'transcript' ? handleAnalyzeTranscript : activeTab === 'monthly' && currentMonthlyReport ? () => handleGenerateMonthlyReport(currentMonthlyReport.monthYear, currentMonthlyReport.monthName) : undefined}
      />

      {/* Footer */}
      <footer className="border-t border-[#26282B] bg-[#161719] py-6 text-center text-xs text-slate-400 print:hidden font-['Montserrat']">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            <strong className="text-white font-['Lato']">ProyectHandler</strong> &bull; Solución creada para C&iacute;vica Software &copy; 2026.
          </p>
          <div className="flex items-center gap-4 text-slate-400 text-[11px]">
            <span>Microsoft Teams Transcript AI</span>
            <span>&bull;</span>
            <span>Atlassian Jira Cloud Sync</span>
            <span>&bull;</span>
            <span className="text-[#FF5038] font-bold">C&Iacute;VICA SOFTWARE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
