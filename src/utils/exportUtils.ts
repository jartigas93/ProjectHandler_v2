import { MonthlyReport, MeetingAnalysis, TopicHistoryRecord } from '../types';

export function downloadFile(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportMonthlyReportToMarkdown(report: MonthlyReport): string {
  let md = `# Reporte Mensual de Progreso Técnico - ${report.monthName}\n\n`;
  md += `**Generado el:** ${new Date(report.createdAt).toLocaleDateString('es-ES')}\n`;
  md += `**Reuniones Analizadas:** ${report.meetingsCount} | **Tareas Identificadas:** ${report.totalTasksIdentified} | **Tickets Jira Sincronizados:** ${report.totalJiraSynced}\n\n`;
  md += `---\n\n`;

  md += `## 1. Síntesis Ejecutiva\n${report.monthlySynthesis}\n\n`;

  md += `## 2. Hitos y Logros Clave\n`;
  report.keyAchievements.forEach((ach) => {
    md += `- [x] ${ach}\n`;
  });
  md += `\n`;

  md += `## 3. Carga y Contribución por Participante\n\n`;
  md += `| Participante | Tareas Asignadas | Tasa de Cumplimiento | Área / Foco Principal |\n`;
  md += `| :--- | :---: | :---: | :--- |\n`;
  report.participantWorkloads.forEach((p) => {
    md += `| **${p.name}** | ${p.tasksCount} | ${p.completionRate}% | ${p.primaryFocus} |\n`;
  });
  md += `\n`;

  md += `## 4. Estado de Temas e Iniciativas Pendientes\n\n`;
  md += `| Tema / Iniciativa | Responsable | Estado | Nivel de Riesgo / Bloqueo |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  report.pendingTopics.forEach((t) => {
    md += `| **${t.topicName}** | ${t.assignee} | \`${t.status}\` | ${t.blockerRisk} |\n`;
  });
  md += `\n`;

  md += `## 5. Insights de Velocidad y Sincronización Técnica\n`;
  md += `${report.teamVelocityInsights}\n\n`;

  md += `## 6. Recomendaciones Tácticas para el Próximo Mes\n`;
  report.nextMonthRecommendations.forEach((rec, i) => {
    md += `${i + 1}. ${rec}\n`;
  });

  return md;
}

export function exportTopicsToCsv(topics: TopicHistoryRecord[]): string {
  const headers = ['ID', 'Tema', 'Categoría', 'Responsable Principal', 'Estado', 'Progreso %', 'Primera Discusión', 'Última Discusión', 'Tickets Jira', 'Reuniones'];
  const rows = topics.map((t) => [
    `"${t.id}"`,
    `"${t.topicName.replace(/"/g, '""')}"`,
    `"${t.category.replace(/"/g, '""')}"`,
    `"${t.leadParticipant.replace(/"/g, '""')}"`,
    `"${t.status}"`,
    `"${t.progressPercent}%"`,
    `"${t.firstDiscussedDate}"`,
    `"${t.lastDiscussedDate}"`,
    `"${t.associatedJiraKeys.join(', ')}"`,
    `"${t.meetings.length}"`
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function stripTrailingClosing(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();
  // Strip trailing farewells from the end of the text like:
  // "Muchas gracias.\nUn saludo."
  // "Muchas gracias.\nUn saludo cordial."
  // "Atentamente,"
  // "Saludos cordiales,"
  cleaned = cleaned.replace(
    /(?:[\r\n]+\s*(?:muchas\s+gracias|gracias|un\s+saludo(?:\s+cordial)?|saludos(?:\s+cordiales)?|atentamente|cordialmente|quedamos\s+a\s+(?:su\s+)?disposici[oó]n)[\.\,\s]*)+$/i,
    ''
  ).trim();

  // Also clean if followed by "Equipo..."
  cleaned = cleaned.replace(
    /(?:[\r\n]+\s*(?:equipo(?:\s+de\s+proyecto)?|el\s+equipo))[\.\,\s]*$/i,
    ''
  ).trim();

  // One more pass for any remaining trailing farewell
  cleaned = cleaned.replace(
    /(?:[\r\n]+\s*(?:muchas\s+gracias|gracias|un\s+saludo(?:\s+cordial)?|saludos(?:\s+cordiales)?|atentamente|cordialmente)[\.\,\s]*)+$/i,
    ''
  ).trim();

  return cleaned;
}

export function cleanExecutiveSummary(summary: string): string {
  if (!summary) return '';
  let cleaned = summary.trim();
  // Remove duplicate Asunto: / Subject: lines from the beginning of executiveSummary
  cleaned = cleaned.replace(/^(?:asunto|reunión|sesión|tema)\s*:\s*[^\r\n]+(?:\r?\n)+/i, '');
  // Remove markdown headers like # or ## from the beginning if any
  cleaned = cleaned.replace(/^(?:#+\s*[^\r\n]+(?:\r?\n)+)+/i, '');
  // Strip trailing farewell from the end of the executive summary so it does not appear in the middle of the email
  cleaned = stripTrailingClosing(cleaned);
  return cleaned.trim();
}

export function formatEmailSummary(meeting: MeetingAnalysis): {
  subject: string;
  body: string;
  fullText: string;
} {
  const dateStr = meeting.meetingDate || new Date().toISOString().split('T')[0];
  let cleanTitle = (meeting.meetingTitle || '').trim();
  while (/^(?:resumen\s+(?:de\s+)?(?:la\s+)?reuni[oó]n|reuni[oó]n|daily|sync)\s*[-—–:]\s*/i.test(cleanTitle)) {
    cleanTitle = cleanTitle.replace(/^(?:resumen\s+(?:de\s+)?(?:la\s+)?reuni[oó]n|reuni[oó]n|daily|sync)\s*[-—–:]\s*/i, '').trim();
  }
  cleanTitle = cleanTitle
    .replace(/^resumen\s+(?:de\s+)?(?:la\s+)?(?:reuni[oó]n)?\s*/i, '')
    .replace(/\s*\(\d{4}-\d{2}-\d{2}\)$/, '')
    .trim();
  const subject = `Resumen de reunión — ${cleanTitle || 'Sincronización'} (${dateStr})`;

  const cleanedSummary = cleanExecutiveSummary(meeting.executiveSummary);

  let body = '';

  // Check if summary already starts with a greeting
  const hasGreeting = /^(?:buenos\s+d[ií]as|estimad[oa]s?|hola|buenas\s+tardes)/i.test(cleanedSummary);
  if (!hasGreeting) {
    body += `Buenos días,\n\nCompartimos el resumen de la reunión mantenida hoy:\n\n`;
  }

  body += `${cleanedSummary}\n\n`;

  // Action items / commitments (NO emojis)
  if (meeting.actionItems && meeting.actionItems.length > 0) {
    body += `Compromisos acordados por participante:\n`;
    meeting.actionItems.forEach((item, idx) => {
      const cleanAssignee = item.assignee ? item.assignee.replace(/\s*\([^)]*\)$/, '').trim() : 'Equipo';
      const metaParts: string[] = [];
      if (item.storyPoints) metaParts.push(`${item.storyPoints} pts`);
      if (item.priority) metaParts.push(`Prioridad: ${item.priority}`);
      const metaStr = metaParts.length > 0 ? ` (${metaParts.join(', ')})` : '';

      body += `${idx + 1}. ${cleanAssignee}: ${item.title}${metaStr}\n`;
      if (item.deadline) {
        body += `   Plazo comprometido: ${item.deadline}\n`;
      }
    });
    body += `\n`;
  }

  // Key decisions (NO emojis)
  if (meeting.keyDecisions && meeting.keyDecisions.length > 0) {
    body += `Decisiones clave:\n`;
    meeting.keyDecisions.forEach((dec) => {
      const cleanDec = dec.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s*•\-\*✓]+/u, '').trim();
      body += `- ${cleanDec}\n`;
    });
    body += `\n`;
  }

  // Professional closing is ALWAYS placed at the very end of the email
  body += `Muchas gracias.\nUn saludo cordial,\nEquipo de Proyecto\n`;

  const fullText = `Asunto: ${subject}\n\n${body.trim()}`;

  return { subject, body: body.trim(), fullText };
}

export function formatTeamsMessageSummary(meeting: MeetingAnalysis): string {
  const cleanedSummary = cleanExecutiveSummary(meeting.executiveSummary);
  let text = `📢 *RESUMEN DE REUNIÓN TEAMS & TICKETS JIRA*\n`;
  text += `*Reunión:* ${meeting.meetingTitle} (${meeting.meetingDate})\n\n`;
  text += `📋 *Resumen Ejecutivo:*\n${cleanedSummary}\n\n`;
  text += `🎯 *Compromisos Asignados por Participante:*\n`;

  meeting.actionItems.forEach((item, idx) => {
    const jiraTag = item.jiraTicketKey ? `[${item.jiraTicketKey}]` : `[Jira ${item.issueType}]`;
    text += `${idx + 1}. *${item.assignee}* ➜ ${jiraTag} *${item.title}* (${item.storyPoints} pts, Prioridad: ${item.priority})\n`;
    if (item.deadline) {
      text += `   Plazo: ${item.deadline}\n`;
    }
  });

  text += `\n✅ *Decisiones Clave:*\n`;
  meeting.keyDecisions.forEach((dec) => {
    text += `• ${dec}\n`;
  });

  return text;
}

