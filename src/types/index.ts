export type Priority = 'Highest' | 'High' | 'Medium' | 'Low';
export type IssueType = 'Task' | 'Story' | 'Bug' | 'Spike';
export type TopicStatus = 'En Progreso' | 'Completado' | 'Bloqueado' | 'Pendiente';
export type PromptMode = 'standard' | 'executive' | 'technical' | 'custom';

export interface OrphanCommitment {
  id: string;
  title: string;
  context: string;
  topicName: string;
  suggestedAssignee?: string;
  priority?: Priority;
}

export interface TaskDependency {
  id: string;
  blockerTaskId: string;
  blockerTitle: string;
  blockerAssignee: string;
  blockedTaskId: string;
  blockedTitle: string;
  blockedAssignee: string;
  description: string;
}

export interface UserMapping {
  teamsName: string;
  jiraEmail: string;
  jiraAccountId?: string;
}

export interface Participant {
  name: string;
  role: string;
  totalTasks: number;
  sentimentOrFocus: string;
  email?: string;
  allocatedPoints?: number;
  capacityLimit?: number;
}

export type JiraLinkRelationType = 'none' | 'relates' | 'is_blocked_by' | 'blocks' | 'cloners';

export interface JiraEpic {
  key: string;
  summary: string;
  status?: string;
}

export interface CloneTaskOptions {
  newTopicCategory?: string;
  linkType?: JiraLinkRelationType;
  sourceTicketKey?: string;
  sourceItemId?: string;
  splitCriteria?: {
    movedCriteria: string[];
    remainingCriteria: string[];
    updateOriginalInJira: boolean;
  };
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  assignee: string;
  coAssignees?: string[];
  topicId?: string;
  topicName: string;
  priority: Priority;
  issueType: IssueType;
  storyPoints: number;
  deadline?: string | null;
  acceptanceCriteria: string[];
  definitionOfDone?: string[];
  jiraLabels: string[];
  technicalContext?: string;
  // Epic / Parent & Traceability
  epicKey?: string;
  epicSummary?: string;
  derivedFromKey?: string;
  jiraLinkType?: JiraLinkRelationType;
  // Jira Sync Status
  jiraTicketKey?: string;
  jiraTicketUrl?: string;
  jiraStatus?: 'synced' | 'pending' | 'failed';
  jiraSyncedAt?: string;
  // Bidirectional sync & dependencies
  jiraIssueStatus?: string; // real status name from the Jira workflow
  jiraStatusCategory?: 'To Do' | 'In Progress' | 'Done';
  jiraRemoteUpdatedAt?: string; // Jira 'updated' timestamp of the last pulled state
  jiraLastSyncedFromJiraAt?: string; // when the app last pulled this ticket from Jira
  jiraAssigneeAccountId?: string | null;
  dependsOn?: string[]; // IDs of tasks this item depends on
  assignedJiraEmail?: string;
  // Existing vs New task detection
  taskKind?: 'new' | 'existing';
  matchedJiraKey?: string;
  matchConfidence?: 'Alta' | 'Media' | 'Baja';
  matchReason?: string;
  proposedComment?: string;
  isClosedMatch?: boolean;
  commentStatus?: 'pending' | 'added' | 'failed';
  commentAddedAt?: string;
  lastCommentId?: string;
}

export interface TopicItem {
  id: string;
  topicName: string;
  category: string;
  discussionSummary: string;
  status: TopicStatus;
  riskLevel: 'Bajo' | 'Medio' | 'Alto';
  leadAssignee?: string;
  matchedJiraKey?: string | null;
  existingTopicId?: string | null;
  proposedProgressNote?: string | null;
  isExistingTicketTopic?: boolean;
}

export interface RACIRow {
  id: string;
  topicOrDeliverable: string;
  responsible: string;
  accountable: string;
  consulted: string[];
  informed: string[];
  category?: string;
  status?: string;
}

export interface MeetingAnalysis {
  id: string;
  meetingTitle: string;
  meetingDate: string;
  executiveSummary: string;
  keyDecisions: string[];
  mainTopics: TopicItem[];
  participants: Participant[];
  actionItems: ActionItem[];
  orphanCommitments?: OrphanCommitment[];
  dependencies?: TaskDependency[];
  raciMatrix?: RACIRow[];
  promptUsed: string;
  rawTranscriptSnippet?: string;
  createdAt: string;
}

export interface TopicHistoryRecord {
  id: string;
  topicName: string;
  category: string;
  firstDiscussedDate: string;
  lastDiscussedDate: string;
  meetings: Array<{
    meetingId: string;
    meetingTitle: string;
    date: string;
    summary: string;
  }>;
  status: TopicStatus;
  leadParticipant: string;
  allParticipants: string[];
  associatedJiraKeys: string[];
  progressPercent: number;
  notes: string[];
  updatedAt: string;
}

export interface MonthlyReport {
  id: string;
  monthYear: string; // "2026-10"
  monthName: string; // "Octubre 2026"
  createdAt: string;
  meetingsCount: number;
  totalTasksIdentified: number;
  totalJiraSynced: number;
  monthlySynthesis: string;
  keyAchievements: string[];
  pendingTopics: Array<{
    topicName: string;
    assignee: string;
    status: string;
    blockerRisk: string;
  }>;
  participantWorkloads: Array<{
    name: string;
    tasksCount: number;
    completionRate: number;
    primaryFocus: string;
  }>;
  teamVelocityInsights: string;
  nextMonthRecommendations: string[];
}

export interface JiraConfig {
  domain: string; // e.g. "empresa.atlassian.net"
  projectKey: string; // e.g. "PROJ"
  boardName: string;
  userEmail: string;
  apiToken: string;
  simulationMode: boolean;
  defaultIssueType: IssueType;
  confluenceSpace?: string;
  userMappings?: UserMapping[];
  // Board & Backlog search settings for duplicate / existing task matching
  includeBacklog?: boolean;
  recentClosedDays?: number;
  maxBoardTicketsForAI?: number;
  filterLabelsOrComponents?: string;
  excludeIssueTypes?: string[];
  customJql?: string;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrl?: string;
  active?: boolean;
  role?: string;
  capacityLimit?: number;
}

export type AIProvider = 'claude' | 'openai' | 'copilot' | 'gemini';

export interface AIModelOption {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
  speed: 'rápido' | 'equilibrado' | 'máximo';
  badge?: string;
  isCustom?: boolean;
}

export interface AIProviderConfig {
  activeProvider: AIProvider;
  selectedModel: string;
  anthropicApiKey?: string;
  openAiApiKey?: string;
  openAiCustomModel?: string;
  azureApiKey?: string;
  azureEndpoint?: string;
  azureDeploymentName?: string;
  azureApiVersion?: string;
  geminiApiKey?: string;
}

export interface SavedCustomPrompt {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
}

export type DatabaseType = 'none' | 'sqlite' | 'postgres' | 'mysql' | 'mongodb' | 'snowflake' | 'rest';

export interface DatabaseConfig {
  enabled: boolean;
  type: DatabaseType;
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  authToken?: string; // Token Bearer o API Key (REST / Snowflake SQL API)
  // Snowflake specific
  snowflakeAccount?: string; // e.g. "xy12345.eu-west-1" o "myorg-myaccount"
  snowflakeWarehouse?: string; // e.g. "COMPUTE_WH"
  snowflakeSchema?: string; // e.g. "PUBLIC" o "PROJECTHANDLER"
  snowflakeRole?: string; // e.g. "ACCOUNTADMIN" o "SYSADMIN"
  tableName?: string; // Nombre de tabla / colección (default: "projecthandler_store")
  autoSync?: boolean; // Sincronización continua
  lastSyncedAt?: string;
}

export interface ProjectSettings {
  storyPointsScale: number[];
  defaultStoryPoints: number;
  sprintCapacityPerMember: number;
  enableCapacityAlerts: boolean;
  topicCategories: string[];
  jiraUsers: JiraUser[];
  jira: JiraConfig;
  ai: AIProviderConfig;
  database?: DatabaseConfig;
  savedCustomPrompts?: SavedCustomPrompt[];
}


