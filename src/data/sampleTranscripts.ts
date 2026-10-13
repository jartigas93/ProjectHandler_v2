export interface SamplePreset {
  id: string;
  title: string;
  meetingDate: string;
  projectKey: string;
  description: string;
  transcript: string;
}

export const SAMPLE_TRANSCRIPTS: SamplePreset[] = [
  {
    id: 'sprint-payments',
    title: 'Sprint Planning 42: Pasarela de Pagos Stripe & Notificaciones Webhook',
    meetingDate: '2026-10-05',
    projectKey: 'PAY',
    description: 'Reunión técnica de planificación de sprint con 4 participantes debatiendo idempotencia, reintentos de pago y tests E2E.',
    transcript: `[09:00:15] Carlos Mendoza (Tech Lead): Buenos días equipo. Hoy tenemos que cerrar los compromisos para el Sprint 42. El foco crítico es la integración de Stripe y resolver los fallos de timeout en los webhooks.
[09:01:02] Ana Sofía Rivas (Backend Senior): Hola Carlos. Yo estuve revisando el log del cluster. Los fallos ocurren cuando Stripe reintenta el webhook y la base de datos bloquea la fila por falta de clave de idempotencia. Me comprometo a implementar la tabla de 'idempotency_keys' en PostgreSQL y añadir el middleware de validación HMAC antes del viernes.
[09:02:40] Carlos Mendoza: Excelente Ana. ¿Podrías estimarlo en 5 story points? Es crítico para no duplicar cobros a los clientes.
[09:02:55] Ana Sofía Rivas: De acuerdo, 5 puntos. Y necesitaré que Rodrigo me ayude con el script de migración en Flyway.
[09:03:15] Rodrigo Alarcón (DevOps Lead): Cuenta con eso Ana. Por mi parte, yo asumo configurar el Dead Letter Queue (DLQ) en AWS SQS para capturar cualquier webhook huérfano y configurar las alertas en Datadog cuando la tasa de error supere el 2%. Estimo esto en 3 puntos y lo tendré listo el jueves.
[09:04:10] Laura Cárdenas (Frontend Dev): En cuanto al checkout web, el modal actual no muestra el spinner de carga 3D Secure cuando el banco pide autenticación de doble factor. Yo me encargo de rediseñar el flujo del checkout con Stripe Elements v3 y los estados de error amigables para el usuario.
[09:05:00] Carlos Mendoza: Laura, asegúrate de contemplar los casos en móvil y Safari iOS. ¿Cuánto te tomaría?
[09:05:18] Laura Cárdenas: Serán 5 story points. Para el miércoles tendré la primera versión en staging para que QA la revise.
[09:05:45] Tomás Herrera (QA Automation): Perfecto Laura. Yo voy a preparar la suite de pruebas automatizadas en Playwright simulando tarjetas de prueba 3D Secure exitosas y rechazadas por fondos insuficientes. Estimo 3 puntos para el viernes.
[09:06:30] Carlos Mendoza: Resumiendo: Ana lidera la idempotencia en backend, Rodrigo el DLQ y alertas DevOps, Laura el rediseño del checkout en frontend, y Tomás la batería de tests E2E. ¡Vamos con todo al sprint!`
  },
  {
    id: 'infra-kubernetes',
    title: 'Comité de Arquitectura: Migración Multi-Región & Reducción de Latencia',
    meetingDate: '2026-10-02',
    projectKey: 'CLOUD',
    description: 'Sesión de arquitectura para migrar servicios a Kubernetes multi-región, optimización de caché con Redis y seguridad IAM.',
    transcript: `[14:30:10] Felipe Osorio (Head of Architecture): Buenas tardes. Con el crecimiento en Europa y Latam, la latencia promedio subió a 420ms en el endpoint de autenticación. Debemos definir el plan de acción inmediato.
[14:31:05] Elena Beltrán (Principal SRE): Analizamos la topología de red. El 70% del retardo viene del salto transatlántico hacia el clúster principal en us-east-1. Mi propuesta es desplegar réplicas de lectura de Cloud SQL en eu-west-1 y frankfurt. Yo tomo la tarea de escribir los manifiestos de Terraform para aprovisionar las réplicas y configurar el DNS inteligente con Route53 Latency Routing. Estimo 8 puntos.
[14:32:40] Felipe Osorio: De acuerdo Elena. Mateo, ¿cómo impacta esto al servicio de sesiones de usuario?
[14:33:12] Mateo Vargas (Senior Platform Eng): Las sesiones se guardan actualmente en una instancia única de Redis. Propongo migrar a Redis Enterprise Cluster con sincronización CRDT activo-activo. Me encargo de coordinar la PoC de benchmarking y presentar los resultados de throughput y latencia este lunes. Estimo 5 puntos.
[14:34:20] Elena Beltrán: Mateo, para la PoC recuerda validar que los tokens JWT caducados se invaliden en menos de 500ms entre regiones.
[14:34:45] Mateo Vargas: Anotado. Incluiré ese escenario de invalidación forzada.
[14:35:10] Felipe Osorio: Yo me encargaré de revisar el impacto en presupuesto cloud con FinOps y validar la compliance legal de GDPR para que ningún dato PII sensible quede sin cifrar en reposo con claves KMS rotativas. Compromiso mío para el viernes.`
  },
  {
    id: 'security-audit',
    title: 'Auditoría de Seguridad & Cumplimiento ISO-27001 / SOC2',
    meetingDate: '2026-09-28',
    projectKey: 'SEC',
    description: 'Plan de remediación tras pentest externo: parches de dependencias, rotación de secrets y logs auditables.',
    transcript: `[11:00:20] Sofía Morales (CISO): Iniciamos el comité de remediación de seguridad. La auditoría externa detectó 2 vulnerabilidades medias en librerías npm y la necesidad de implementar autenticación mTLS entre microservicios.
[11:01:15] Javier Domínguez (SecOps Lead): Yo tomo la remediación de dependencias. Ejecutaré el análisis de Snyk y actualizaré las librerías vulnerables en los repositorios core, además de configurar el bot de Dependabot con auto-merge para parches menores. Lo tengo listo en 3 días.
[11:02:10] Camila Rojas (Tech Lead Core): Sobre mTLS, Javier, ¿usamos Istio Service Mesh o certificados automáticos con Vault?
[11:02:35] Javier Domínguez: Vault con cert-manager es más liviano para nuestra infraestructura actual. Camila, ¿puedes tú liderar la integración del SDK en el servicio de autenticación?
[11:02:50] Camila Rojas: Sí, me encargo de actualizar la inyección de certificados en el servicio de Auth y verificar que la negociación TLS 1.3 funcione sin degradar el tiempo de respuesta. Estimo 5 puntos.
[11:03:30] Sofía Morales: Excelente. Yo prepararé el reporte de evidencias de auditoría con los diagramas de arquitectura para el auditor externo antes de fin de mes.`
  }
];

export const INITIAL_TOPIC_HISTORY = [
  {
    id: 'topic-stripe-integration',
    topicName: 'Integración Pasarela de Pagos Stripe & Webhooks',
    category: 'Backend & FinTech',
    firstDiscussedDate: '2026-09-15',
    lastDiscussedDate: '2026-10-05',
    meetings: [
      {
        meetingId: 'm-01',
        meetingTitle: 'Sprint 40 Planning: Requisitos de Pago',
        date: '2026-09-15',
        summary: 'Se definieron los requisitos para soportar cobros internacionales y tarjetas de crédito locales.'
      },
      {
        meetingId: 'm-02',
        meetingTitle: 'Revisión Técnica: Manejo de Webhooks',
        date: '2026-09-22',
        summary: 'Se detectaron caídas de eventos y necesidad de idempotencia robusta.'
      },
      {
        meetingId: 'sprint-payments',
        meetingTitle: 'Sprint Planning 42: Pasarela de Pagos Stripe & Notificaciones Webhook',
        date: '2026-10-05',
        summary: 'Ana Sofía implementa tabla de idempotencia y Rodrigo configura SQS Dead Letter Queue.'
      }
    ],
    status: 'En Progreso' as const,
    leadParticipant: 'Ana Sofía Rivas',
    allParticipants: ['Ana Sofía Rivas', 'Carlos Mendoza', 'Rodrigo Alarcón', 'Laura Cárdenas'],
    associatedJiraKeys: ['PAY-101', 'PAY-102', 'PAY-104'],
    progressPercent: 75,
    notes: [
      'Claves de prueba configuradas en sandbox.',
      'Bloqueo inicial resuelto con tabla de idempotencia en Postgres.'
    ],
    updatedAt: '2026-10-05T10:00:00Z'
  },
  {
    id: 'topic-k8s-multiregion',
    topicName: 'Arquitectura Multi-Región & Reducción de Latencia',
    category: 'Cloud & Infrastructure',
    firstDiscussedDate: '2026-09-10',
    lastDiscussedDate: '2026-10-02',
    meetings: [
      {
        meetingId: 'm-03',
        meetingTitle: 'Performance Review Q3',
        date: '2026-09-10',
        summary: 'Alerta por incremento de latencia en usuarios europeos (>400ms).'
      },
      {
        meetingId: 'infra-kubernetes',
        meetingTitle: 'Comité de Arquitectura: Migración Multi-Región',
        date: '2026-10-02',
        summary: 'Elena Beltrán aprueba réplicas de Cloud SQL en eu-west-1 y Mateo Vargas PoC con Redis CRDT.'
      }
    ],
    status: 'En Progreso' as const,
    leadParticipant: 'Elena Beltrán',
    allParticipants: ['Elena Beltrán', 'Mateo Vargas', 'Felipe Osorio'],
    associatedJiraKeys: ['CLOUD-88', 'CLOUD-89'],
    progressPercent: 60,
    notes: [
      'Terraform plan aprobado en staging.',
      'Pendiente validación de costos con FinOps.'
    ],
    updatedAt: '2026-10-02T16:00:00Z'
  },
  {
    id: 'topic-security-soc2',
    topicName: 'Remediación de Seguridad & Cumplimiento SOC2 / ISO-27001',
    category: 'Seguridad & Compliance',
    firstDiscussedDate: '2026-09-20',
    lastDiscussedDate: '2026-09-28',
    meetings: [
      {
        meetingId: 'security-audit',
        meetingTitle: 'Auditoría de Seguridad & Cumplimiento',
        date: '2026-09-28',
        summary: 'Javier Domínguez asume remediación Snyk y Camila Rojas integración mTLS con cert-manager.'
      }
    ],
    status: 'Completado' as const,
    leadParticipant: 'Javier Domínguez',
    allParticipants: ['Javier Domínguez', 'Camila Rojas', 'Sofía Morales'],
    associatedJiraKeys: ['SEC-45', 'SEC-46'],
    progressPercent: 100,
    notes: [
      'Todas las dependencias críticas parcheadas.',
      'Reporte firmado entregado al auditor.'
    ],
    updatedAt: '2026-09-28T12:00:00Z'
  },
  {
    id: 'topic-checkout-redesign',
    topicName: 'Rediseño de Checkout Web & Soporte 3D Secure v2',
    category: 'Frontend & UX',
    firstDiscussedDate: '2026-09-18',
    lastDiscussedDate: '2026-10-05',
    meetings: [
      {
        meetingId: 'sprint-payments',
        meetingTitle: 'Sprint Planning 42',
        date: '2026-10-05',
        summary: 'Laura Cárdenas asume migración a Stripe Elements v3 y modal de verificación bancaria.'
      }
    ],
    status: 'En Progreso' as const,
    leadParticipant: 'Laura Cárdenas',
    allParticipants: ['Laura Cárdenas', 'Tomás Herrera'],
    associatedJiraKeys: ['PAY-105', 'PAY-106'],
    progressPercent: 40,
    notes: [
      'Prototipos en Figma validados.',
      'Pruebas en Playwright asignadas a Tomás Herrera.'
    ],
    updatedAt: '2026-10-05T11:00:00Z'
  }
];
