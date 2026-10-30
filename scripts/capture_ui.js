import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUTPUT_DIR = path.resolve('docs/screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const mockMeeting = {
  id: "meeting-cdp-business-dims-2026-10-28",
  meetingTitle: "Daily & Refinamiento de Arquitectura CDP / Business Dims",
  meetingDate: "2026-10-28",
  executiveSummary: "Se revisó la arquitectura de sharding para tablas externas en capa 21 y la integración centralizada en capa 40 con macros LastFuncTable. Se acordaron los criterios de aceptación para el DAG centralizado y se detectó un compromiso de auditoría pendiente.",
  keyDecisions: [
    "Adoptar particionamiento sharded por versión de fichero en capa 21.",
    "Centralizar el consumo downstream en capa 40 mediante macro LastFuncTable.",
    "Mantener compatibilidad hacia atrás en los esquemas de BigQuery."
  ],
  mainTopics: [
    {
      id: "topic-business-dims",
      topicName: "Business Dims & Tablas Externas",
      category: "Arquitectura & Datos",
      discussionSummary: "Discusión técnica sobre parametrización de tareas genéricas para tablas externas y consumo unificado.",
      status: "En Progreso",
      riskLevel: "Bajo",
      leadAssignee: "Juan Carlos Artigas Castillo",
      matchedJiraKey: "ORPDATA-104",
      isExistingTicketTopic: true
    },
    {
      id: "topic-alertas-latencia",
      topicName: "Monitoreo y Alertas de Ingesta",
      category: "DevOps & Cloud",
      discussionSummary: "Definición de umbrales de latencia y notificaciones en Slack/Teams para pipelines CDP.",
      status: "Pendiente",
      riskLevel: "Medio",
      leadAssignee: "Ana Sofía Rivas",
      matchedJiraKey: null,
      isExistingTicketTopic: false
    }
  ],
  participants: [
    {
      name: "Juan Carlos Artigas Castillo",
      role: "Data Engineer / Tech Lead",
      totalTasks: 1,
      sentimentOrFocus: "Enfocado en parametrización y sharding de tablas externas",
      allocatedPoints: 5,
      capacityLimit: 8
    },
    {
      name: "Ana Sofía Rivas",
      role: "Senior Backend & Data Engineer",
      totalTasks: 1,
      sentimentOrFocus: "A cargo de pipelines de ingesta y monitoreo de latencia",
      allocatedPoints: 3,
      capacityLimit: 8
    },
    {
      name: "Carlos Mendoza",
      role: "Tech Lead / Arquitecto",
      totalTasks: 0,
      sentimentOrFocus: "Validación de arquitectura y revisión de dependencias",
      allocatedPoints: 0,
      capacityLimit: 8
    }
  ],
  actionItems: [
    {
      id: "item-orpdata-104",
      title: "Implementar el DAG centralizado de Business Dims",
      description: "Finalizar la integración de las tareas de materialización de tablas externas CDP respetando la arquitectura de sharding y consumo modular downstream.",
      assignee: "Juan Carlos Artigas Castillo",
      topicName: "Business Dims & Tablas Externas",
      priority: "Highest",
      issueType: "Task",
      storyPoints: 5,
      deadline: "2026-11-05",
      acceptanceCriteria: [
        "Configurar tareas de ejecución de Materialize External Table por cada origen externo CDP.",
        "Asegurar que los modelos en capa 40 consuman dinámicamente la última tabla sharded mediante macro LastFuncTable.",
        "Verificar que las transformaciones downstream no requieran cambios de esquema."
      ],
      definitionOfDone: [
        "Pruebas unitarias y de integración superadas en entorno DEV.",
        "Pull Request aprobado por el Tech Lead de Datos."
      ],
      jiraLabels: ["BigQuery", "CDP", "ExternalTables", "airflow", "dag"],
      technicalContext: "Juan Carlos presentó los avances y el código SQL/parámetros en el repositorio para la materialización y versionado de tablas externas de Business Dims / CDP.",
      jiraTicketKey: "ORPDATA-104",
      jiraTicketUrl: "https://civicasoftware.atlassian.net/browse/ORPDATA-104",
      jiraStatus: "synced",
      jiraIssueStatus: "En curso",
      jiraStatusCategory: "In Progress",
      taskKind: "existing",
      matchedJiraKey: "ORPDATA-104",
      matchConfidence: "Alta",
      matchReason: "Coincidencia exacta con la iniciativa en curso en el tablero de Datos.",
      proposedComment: "Avance 2026-10-28: Se diseñó e implementó la parametrización de tareas genéricas para tablas externas (Materialize External Table en capa 21) permitiendo generar particiones sharded por versión de fichero, y la consulta centralizada a LastFunchTable en capa 40.\n\nCriterios de Aceptación (3):\nConfigurar tareas de ejecución de Materialize External Table por cada origen externo CDP.\nAsegurar que los modelos en capa 40 consuman dinámicamente la última tabla sharded mediante macro LastFuncTable.\nVerificar que las transformaciones downstream no requieran cambios de esquema.",
      commentStatus: "added",
      lastCommentId: "comment-10928"
    },
    {
      id: "item-nueva-alertas",
      title: "Configurar alertas de latencia en pipelines de ingesta CDP",
      description: "Implementar sondas de salud y alertas automáticas de latencia cuando la ingesta diaria de ficheros CDP supere los 45 minutos de procesamiento.",
      assignee: "Ana Sofía Rivas",
      topicName: "Monitoreo y Alertas de Ingesta",
      priority: "High",
      issueType: "Task",
      storyPoints: 3,
      deadline: "2026-11-08",
      acceptanceCriteria: [
        "Definir métrica de duración en el DAG de Airflow por origen de datos.",
        "Integrar webhook de notificación en canal #data-alerts ante retrasos.",
        "Documentar el runbook operativo de respuesta ante incidentes."
      ],
      jiraLabels: ["Monitoring", "CDP", "Alerts", "Airflow"],
      technicalContext: "Se identificó riesgo de degradación durante picos de fin de mes.",
      jiraStatus: "pending",
      taskKind: "new",
      dependsOn: ["item-orpdata-104"]
    }
  ],
  orphanCommitments: [
    {
      id: "orphan-1",
      title: "Revisar particiones de tablas de auditoría en BigQuery",
      context: "En el minuto 24 se comentó que las tablas de auditoría de capa 21 crecen rápidamente y requieren política de expiración a 90 días.",
      topicName: "Business Dims & Tablas Externas",
      suggestedAssignee: "Carlos Mendoza",
      priority: "Medium"
    }
  ],
  dependencies: [
    {
      id: "dep-1",
      blockerTaskId: "item-orpdata-104",
      blockerTitle: "Implementar el DAG centralizado de Business Dims",
      blockerAssignee: "Juan Carlos Artigas Castillo",
      blockedTaskId: "item-nueva-alertas",
      blockedTitle: "Configurar alertas de latencia en pipelines de ingesta CDP",
      blockedAssignee: "Ana Sofía Rivas",
      description: "Las sondas de latencia requieren que los nombres y esquemas sharded estén normalizados en capa 21."
    }
  ],
  raciMatrix: [
    {
      id: "raci-1",
      topicOrDeliverable: "Materialización de Tablas Sharded Capa 21",
      responsible: "Juan Carlos Artigas Castillo",
      accountable: "Carlos Mendoza",
      consulted: ["Ana Sofía Rivas"],
      informed: ["Rodrigo Alarcón"],
      category: "Arquitectura & Datos",
      status: "En curso"
    },
    {
      id: "raci-2",
      topicOrDeliverable: "Macro LastFuncTable Capa 40",
      responsible: "Juan Carlos Artigas Castillo",
      accountable: "Carlos Mendoza",
      consulted: ["Equipo Analytics"],
      informed: ["Product Owner"],
      category: "Arquitectura & Datos",
      status: "En curso"
    },
    {
      id: "raci-3",
      topicOrDeliverable: "Alertas y Notificaciones de Latencia",
      responsible: "Ana Sofía Rivas",
      accountable: "Carlos Mendoza",
      consulted: ["Rodrigo Alarcón"],
      informed: ["Juan Carlos Artigas Castillo"],
      category: "DevOps & Cloud",
      status: "Pendiente"
    }
  ],
  promptUsed: "standard",
  createdAt: "2026-10-28T10:30:00Z"
};

const mockTopics = [
  {
    id: "topic-business-dims-hist",
    topicName: "Business Dims & Tablas Externas CDP",
    category: "Arquitectura & Datos",
    firstDiscussedDate: "2026-10-15",
    lastDiscussedDate: "2026-10-28",
    meetings: [
      {
        meetingId: "meeting-1",
        meetingTitle: "Diseño Conceptual Capa 21 y 40",
        date: "2026-10-15",
        summary: "Definición inicial del modelo sharded y tablas externas."
      },
      {
        meetingId: "meeting-cdp-business-dims-2026-10-28",
        meetingTitle: "Daily & Refinamiento de Arquitectura CDP / Business Dims",
        date: "2026-10-28",
        summary: "Parametrización de tareas genéricas y consumo mediante LastFuncTable."
      }
    ],
    status: "En Progreso",
    leadParticipant: "Juan Carlos Artigas Castillo",
    allParticipants: ["Juan Carlos Artigas Castillo", "Carlos Mendoza", "Ana Sofía Rivas"],
    associatedJiraKeys: ["ORPDATA-104", "ORPDATA-98"],
    progressPercent: 75,
    notes: [
      "2026-10-15: Acordada la estructura sharded por versión.",
      "2026-10-28: Validación satisfactoria de parámetros SQL y macro."
    ],
    updatedAt: "2026-10-28T11:00:00Z"
  },
  {
    id: "topic-alertas-cdp-hist",
    topicName: "Monitoreo y Alertas de Ingesta CDP",
    category: "DevOps & Cloud",
    firstDiscussedDate: "2026-10-20",
    lastDiscussedDate: "2026-10-28",
    meetings: [
      {
        meetingId: "meeting-cdp-business-dims-2026-10-28",
        meetingTitle: "Daily & Refinamiento de Arquitectura CDP / Business Dims",
        date: "2026-10-28",
        summary: "Revisión de dependencias de monitoreo."
      }
    ],
    status: "Pendiente",
    leadParticipant: "Ana Sofía Rivas",
    allParticipants: ["Ana Sofía Rivas", "Rodrigo Alarcón"],
    associatedJiraKeys: [],
    progressPercent: 20,
    notes: [
      "2026-10-28: Especificación de umbral de 45 minutos."
    ],
    updatedAt: "2026-10-28T11:00:00Z"
  }
];

const mockMonthlyReport = {
  id: "report-2026-10",
  monthYear: "2026-10",
  monthName: "Octubre 2026",
  createdAt: "2026-10-28T12:00:00Z",
  meetingsCount: 8,
  totalTasksIdentified: 14,
  totalJiraSynced: 12,
  monthlySynthesis: "Durante octubre se consolidó la transición a la arquitectura sharded en BigQuery para CDP y Business Dims, reduciendo la fricción en transformaciones downstream y fortaleciendo la trazabilidad en Jira Cloud.",
  keyAchievements: [
    "Diseño e implementación de parametrización para tablas externas (Capa 21).",
    "Consumo centralizado downstream mediante macro LastFuncTable en Capa 40.",
    "Sincronización automatizada de criterios de aceptación y avance en Jira Cloud."
  ],
  pendingTopics: [
    {
      topicName: "Monitoreo y Alertas de Ingesta CDP",
      assignee: "Ana Sofía Rivas",
      status: "Pendiente",
      blockerRisk: "Medio"
    },
    {
      topicName: "Política de Expiración en Tablas de Auditoría",
      assignee: "Carlos Mendoza",
      status: "Por Asignar",
      blockerRisk: "Bajo"
    }
  ],
  participantWorkloads: [
    {
      name: "Juan Carlos Artigas Castillo",
      tasksCount: 6,
      completionRate: 85,
      primaryFocus: "Arquitectura & Sharding de Datos"
    },
    {
      name: "Ana Sofía Rivas",
      tasksCount: 4,
      completionRate: 70,
      primaryFocus: "Pipelines & Monitoreo Cloud"
    },
    {
      name: "Carlos Mendoza",
      tasksCount: 4,
      completionRate: 90,
      primaryFocus: "Tech Lead & Gobierno de Datos"
    }
  ],
  teamVelocityInsights: "El equipo mantiene una velocidad consistente de 34 Story Points por sprint con un cumplimiento del 92% en compromisos de sprint.",
  nextMonthRecommendations: [
    "Priorizar la automatización de alertas en pipelines antes del cierre contable de noviembre.",
    "Continuar utilizando comentarios estructurados en Jira para eliminar reuniones redundantes de sincronización."
  ]
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureAll() {
  console.log('Iniciando captura de vistas completas...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Cargar la página inicial e inyectar mock data
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await page.evaluate((meeting, topics, report) => {
    localStorage.setItem('teams2jira_meetings', JSON.stringify([meeting]));
    localStorage.setItem('teams2jira_topic_history', JSON.stringify(topics));
    localStorage.setItem('teams2jira_monthly_reports', JSON.stringify([report]));
  }, mockMeeting, mockTopics, mockMonthlyReport);

  // Recargamos para que React monte con la lista de reuniones en localStorage
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await sleep(800);

  // 2. Pantalla 1: Entrada de Transcripción (Pestaña Procesar Reunión)
  console.log('Capturando 01_entrada_transcripcion.png...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01_entrada_transcripcion.png') });

  // 3. Pestaña Histórico de Reuniones para abrir el resumen
  console.log('Navegando a Histórico de Reuniones...');
  const navButtons = await page.$$('header nav button');
  for (const btn of navButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Reuniones')) {
      await btn.click();
      break;
    }
  }
  await sleep(1000);
  console.log('Capturando 10_historico_reuniones.png...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '10_historico_reuniones.png') });

  // 4. Hacer clic en "Abrir Resumen & Tickets" de la reunión guardada
  console.log('Abriendo reunión activa desde el archivo...');
  const openButtons = await page.$$('button');
  for (const btn of openButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Abrir Resumen & Tickets')) {
      await btn.click();
      break;
    }
  }
  await sleep(1500);

  // 5. Pantalla: Resumen & Tickets
  console.log('Capturando 03_resumen_y_tickets.png...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '03_resumen_y_tickets.png') });

  // 6. Pantalla: Tarjeta en curso (scroll hacia la tarjeta ORPDATA-104)
  console.log('Capturando 04_tarjeta_en_curso.png...');
  await page.evaluate(() => {
    const card = document.querySelector('button[title*="ORPDATA-104"]') || document.querySelector('.bg-\\[\\#1C1E20\\]');
    window.scrollTo({ top: 320, behavior: 'instant' });
  });
  await sleep(600);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '04_tarjeta_en_curso.png') });

  // 7. Abrir el modal de edición de ticket (JiraTicketModal)
  console.log('Abriendo modal de edición de ticket...');
  const editButtons = await page.$$('button');
  for (const btn of editButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Detalles / Editar')) {
      await btn.click();
      break;
    }
  }
  await sleep(1000);
  console.log('Capturando 05_modal_edicion_ticket.png...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '05_modal_edicion_ticket.png') });

  // 8. Abrir modal de confirmación contextual
  console.log('Abriendo modal de confirmación...');
  const updateButtons = await page.$$('button');
  for (const btn of updateButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Actualizar en Jira')) {
      await btn.click();
      break;
    }
  }
  await sleep(800);
  console.log('Capturando 06_modal_confirmacion_jira.png...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '06_modal_confirmacion_jira.png') });

  // Cancelar confirmación y cerrar modal
  const cancelButtons = await page.$$('button');
  for (const btn of cancelButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Cancelar')) {
      await btn.click();
      break;
    }
  }
  await sleep(500);
  await page.keyboard.press('Escape');
  await sleep(600);

  // 9. Vista Matriz RACI
  console.log('Navegando a Matriz RACI...');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(300);
  const raciBtn = await page.$$('button');
  for (const btn of raciBtn) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Matriz RACI')) {
      await btn.click();
      break;
    }
  }
  await sleep(800);
  console.log('Capturando 07_matriz_raci.png...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '07_matriz_raci.png') });

  // 10. Vista Dependencias
  console.log('Navegando a Dependencias...');
  const depBtn = await page.$$('button');
  for (const btn of depBtn) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Dependencias')) {
      await btn.click();
      break;
    }
  }
  await sleep(800);
  console.log('Capturando 08_mapa_dependencias.png...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '08_mapa_dependencias.png') });

  // 11. Vista Tabla Compacta
  console.log('Navegando a Tabla Compacta...');
  const tableBtn = await page.$$('button');
  for (const btn of tableBtn) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Tabla')) {
      await btn.click();
      break;
    }
  }
  await sleep(800);
  console.log('Capturando 09_tabla_compacta.png...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '09_tabla_compacta.png') });

  // 12. Pestaña Histórico de Temas
  console.log('Navegando a Histórico de Temas...');
  const histNavBtn = await page.$$('header nav button');
  for (const btn of histNavBtn) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Temas')) {
      await btn.click();
      break;
    }
  }
  await sleep(800);
  console.log('Capturando 11_historico_temas.png...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '11_historico_temas.png') });

  // 13. Pestaña Reporte Mensual
  console.log('Navegando a Reporte Mensual...');
  const repNavBtn = await page.$$('header nav button');
  for (const btn of repNavBtn) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Mensual')) {
      await btn.click();
      break;
    }
  }
  await sleep(800);
  console.log('Capturando 12_reporte_mensual.png...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '12_reporte_mensual.png') });

  // 14. Modal de Configuración
  console.log('Abriendo modal de Configuración...');
  const configBtn = await page.$('button[title*="Configuración"], button[aria-label*="Configuración"]');
  if (configBtn) {
    await configBtn.click();
  } else {
    const headerBtns = await page.$$('header button');
    for (const btn of headerBtns) {
      const title = await page.evaluate(el => el.getAttribute('title'), btn);
      if (title && title.includes('Configuración')) {
        await btn.click();
        break;
      }
    }
  }
  await sleep(1000);
  console.log('Capturando 13_modal_configuracion.png...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '13_modal_configuracion.png') });

  await browser.close();
  console.log('¡Capturas finalizadas con éxito!');
}

captureAll().catch(console.error);
