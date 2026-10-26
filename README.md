# ProjectHandler 🚀

> **Plataforma Integral de Gestión Inteligente y Automatizada de Reuniones Ágiles**  
> Desarrollado por **Cívica Software** para transformar transcripciones de reuniones (Microsoft Teams) en tareas ejecutables en **Jira Cloud**, actas oficiales en **Confluence**, matrices RACI, mapas de dependencias y reportes ejecutivos consolidados mediante Inteligencia Artificial Multi-Proveedor.

---

## 📋 Tabla de Contenidos

1. [Visión General del Framework](#-visión-general-del-framework)
2. [Arquitectura y Tecnologías](#-arquitectura-y-tecnologías)
3. [Guía Funcional (Para Analistas, Scrum Masters y Product Managers)](#-guía-funcional-para-analistas-scrum-masters-y-product-managers)
   - [Flujo de Trabajo Operativo](#flujo-de-trabajo-operativo)
   - [Modos de Análisis y Estructuración de Prompts](#modos-de-análisis-y-estructuración-de-prompts)
   - [Detección de Compromisos Huérfanos y Matriz RACI](#detección-de-compromisos-huérfanos-y-matriz-raci)
   - [Gestión de Tareas en Curso vs. Tareas Nuevas](#gestión-de-tareas-en-curso-vs-tareas-nuevas)
   - [Histórico de Reuniones y Seguimiento de Temas](#histórico-de-reuniones-y-seguimiento-de-temas)
   - [Generación de Informes Mensuales Consolidados](#generación-de-informes-mensuales-consolidados)
4. [Guía Técnica (Para Desarrolladores, Arquitectos y DevOps)](#-guía-técnica-para-desarrolladores-arquitectos-y-devops)
   - [Motor de Inteligencia Artificial Multi-Proveedor](#motor-de-inteligencia-artificial-multi-proveedor)
   - [Configuración de Modelos de Fábrica desde `.env`](#configuración-de-modelos-de-fábrica-desde-env)
   - [Modelos Personalizados y Validación en Tiempo Real](#modelos-personalizados-y-validación-en-tiempo-real)
   - [Manejo de Errores de API y Modal Informativo](#manejo-de-errores-de-api-y-modal-informativo)
   - [Integración con Jira Cloud y Confluence](#integración-con-jira-cloud-y-confluence)
   - [Recepción Automática vía Webhook (Teams / Power Automate)](#recepción-automática-vía-webhook-teams--power-automate)
   - [Referencia de Endpoints del Backend REST](#referencia-de-endpoints-del-backend-rest)
5. [Instalación y Puesta en Marcha](#-instalación-y-puesta-en-marcha)
6. [Configuración de Variables de Entorno (`.env`)](#-configuración-de-variables-de-entorno-env)
7. [Estructura del Proyecto](#-estructura-del-proyecto)
8. [Seguridad y Privacidad](#-seguridad-y-privacidad)

---

## 💡 Visión General del Framework

En el día a día de los equipos técnicos y de negocio (reuniones diarias, refinamientos de backlog, comités de arquitectura, sesiones de seguimiento con clientes), se adoptan decenas de compromisos verbales, estimaciones y acuerdos de entrega. Con frecuencia ocurren tres problemas comunes:

1. **Compromisos Huérfanos:** Compromisos verbales ("yo reviso la query", "después subimos el fix") que se desvanecen al no contar con un responsable explícito o una estimación asignada.
2. **Duplicidad y Ruido en Jira:** Crear tickets para tareas que ya existían previamente en el tablero y que solo recibieron una actualización verbal en la reunión.
3. **Pérdida de Trazabilidad Histórica:** Las minutas quedan archivadas en correos o notas locales, impidiendo ver la evolución de un tema a lo largo de semanas o meses.

**ProjectHandler** resuelve este ciclo conectando la transcripción de la sesión directamente con el ecosistema de entrega:
- Ingiere transcripciones por texto, subida de ficheros (`.vtt`, `.txt`, `.docx`) o recepción automática mediante **Microsoft Power Automate**.
- Analiza la sesión utilizando modelos avanzados de IA (**Claude, OpenAI, Azure Copilot, Google Gemini**).
- Detecta si un tema corresponde a una **tarea en curso existente** en Jira (redactando comentarios ejecutivos) o a una **tarea nueva** (estructurando título, responsable, Story Points, Criterios de Aceptación y Definition of Done).
- Provee sincronización en un clic con **Jira Cloud**, publicación de actas oficiales en **Confluence**, consulta bidireccional del estado real de las incidencias y agregación de **Informes Mensuales**.

---

## 🛠️ Arquitectura y Tecnologías

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (SPA)                                 │
│  React 19 • TypeScript • Tailwind CSS v4 • Vite • Lucide Icons              │
│  - Persistencia segura y sin servidores externos en localStorage            │
│  - Sistema reactivo de eventos internos para modelos y configuraciones      │
│  - Modales enriquecidos de edición Jira, Confluence, diagnósticos de IA     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Peticiones HTTP / Proxy Vite
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                           BACKEND EXPRESS (server.ts)                       │
│  Node.js • Express • TypeScript (tsx) • dotenv                              │
│  - /api/ai/models & /api/ai/test-connection (Catálogo configurable de IA)   │
│  - /api/analyze-transcript (Motor de análisis con esquema JSON garantizado) │
│  - /api/jira/* (Búsqueda JQL, autocompletado de usuarios, creación y ADF)  │
│  - /api/confluence/* (Generación y publicación de actas jerárquicas)        │
│  - /api/teams/webhook (Recepción de eventos Microsoft Graph / OneDrive)     │
└──────────────────┬───────────────────────────────┬──────────────────────────┘
                   │                               │
┌──────────────────▼───────────────┐ ┌─────────────▼──────────────────────────┐
                   │               │               │
┌──────────────────▼───────────────┐ ┌─────────────▼──────────────────────────┐
│        PROVEEDORES DE IA         │ │          ECOSISTEMA ATLASSIAN          │
│ • Anthropic Claude (3.7 / 3.5)   │ │ • Jira Cloud REST API v2/v3            │
│ • OpenAI (GPT-4o, o3-mini)       │ │   (Incidencias, Tableros, Comentarios) │
│ • Azure OpenAI / MS Copilot      │ │ • Confluence Cloud REST API            │
│ • Google Gemini (3.8, 3.1, 2.5)  │ │   (Páginas de espacio corporativo)     │
└──────────────────────────────────┘ └────────────────────────────────────────┘
```

---

## 👥 Guía Funcional (Para Analistas, Scrum Masters y Product Managers)

### Flujo de Trabajo Operativo

```mermaid
flowchart TD
    A["1. Carga de Transcripción<br/>(Archivo .txt/.vtt, texto o Webhook de Teams)"] --> B["2. Selección de Enfoque y Modelo<br/>(Estándar, Ejecutivo, Técnico o Personalizado)"]
    B --> C["3. Procesar Reunión<br/>(Extracción estructurada con IA)"]
    C --> D["4. Panel de Revisión<br/>(Métricas, RACI, Huérfanos, Dependencias)"]
    D --> E1["Sincronizar Tareas Nuevas con Jira Cloud"]
    D --> E2["Publicar Comentarios en Tareas ya Existentes"]
    D --> E3["Publicar Acta Oficial en Confluence"]
    D --> E4["Consolidar en Historial de Temas y Reporte Mensual"]
```

#### Paso 1: Cargar la Transcripción
1. Dirígete a la pestaña **Procesar Reunión**.
2. Tienes tres alternativas para introducir la información:
   - **Subir Archivo:** Haz clic en la zona de carga y selecciona un archivo `.vtt`, `.txt` o `.docx`. El título de la reunión se completará automáticamente con el nombre del archivo.
   - **Pegar Texto:** Copia la transcripción directamente desde Teams y pégala en el editor.
   - **Teams en Vivo (Webhook):** Si tu organización tiene activo el flujo de Power Automate, las reuniones grabadas aparecerán automáticamente listas para procesar.
3. Ajusta el título y la fecha de la sesión según corresponda.

#### Paso 2: Elegir Enfoque Analítico y Modelo
- **Motor de IA:** Selecciona el proveedor (**Claude, OpenAI, Copilot o Gemini**) y el modelo a utilizar. El desplegable incluye tanto los modelos oficiales como los modelos personalizados guardados.
- **Formato del Prompt:** Selecciona el tipo de análisis deseado:
  - **Estándar Ágil (Jira-Ready):** Centrado en tareas operativas, impedimentos diarios y compromisos del sprint.
  - **Ejecutivo (Comités y Dirección):** Foco en decisiones estratégicas, riesgos comerciales y acuerdos clave.
  - **Técnico (Arquitectura e Ingeniería):** Foco en deuda técnica, endpoints, esquemas de datos, despliegues y calidad.
  - **Personalizado (Custom):** Permite ingresar directrices a medida y guardarlas en hasta 3 slots accesibles rápidamente.

#### Paso 3: Revisión y Enriquecimiento
Una vez finalizado el análisis, la pestaña **Resumen & Tickets** despliega los resultados organizados:
- **Resumen Ejecutivo:** Puntos esenciales acordados y decisiones registradas.
- **Métricas de Capacidad:** Comparativa entre la suma de Story Points asignados y el límite por miembro.
- **Compromisos Huérfanos:** Diálogos donde se prometió una entrega sin un dueño claro. Permite asignar un participante con un solo clic.
- **Matriz RACI:** Tabla de asignación de roles (Responsable, Aprobador, Consultado, Informado).
- **Mapa de Dependencias:** Identifica visualmente qué participante o tarea bloquea el avance de otro compañero.

#### Paso 4: Publicación y Sincronización
- **Sincronizar todos:** Envía a Jira únicamente las **tareas nuevas**.
- **Agregar a Jira (Comentario):** Para temas que ya estaban en curso en Jira, publica la actualización discutida en la incidencia original sin duplicar el ticket.
- **Sincronizar estados:** Consulta Jira en tiempo real para refrescar el estado de los tickets (*To Do*, *In Progress*, *Done*).
- **Publicar en Confluence:** Genera el documento oficial de la reunión en el espacio configurado.
- **Compartir por Email / Exportar:** Permite copiar un correo ejecutivo o descargar el reporte en Markdown o CSV.

---

### Modos de Análisis y Estructuración de Prompts

ProjectHandler incluye plantillas optimizadas para evitar alucinaciones y garantizar que los resultados cumplan con las directivas de entrega:

| Modo de Prompt | Audiencia Objetivo | Salida Principal |
| :--- | :--- | :--- |
| **Estándar Ágil** | Equipos de Desarrollo, Scrum Masters, Dailies | Tareas concretas, definición de hecho (DoD), Story Points en escala Fibonacci y criterios de aceptación. |
| **Ejecutivo** | Gerencia, Product Owners, Comités de Dirección | Acuerdos de alto impacto, decisiones de alcance, asignación de responsabilidades y riesgos. |
| **Técnico** | Arquitectos de Software, Tech Leads, DevOps | Diagramas de flujo, endpoints, pipelines CI/CD, dependencias de infraestructura y runbooks. |
| **Personalizado** | Proyectos con reglas específicas (ej. MASORANGE) | Directrices personalizadas con variables dinámicas como `{meetingTitle}`, `{meetingDate}` y `{jiraProjectKey}`. |

---

### Detección de Compromisos Huérfanos y Matriz RACI

- **Compromisos Huérfanos (*Orphan Commitments*):**  
  Durante una conversación técnica surgen frases como *"después revisamos los índices de la base de datos"* o *"yo le paso la documentación al cliente"*. La IA aísla estas oraciones, identifica la ambigüedad y las presenta en una tarjeta interactiva para que el gestor asigne a la persona adecuada antes de convertirlas en tickets formales.
- **Matriz RACI Automatizada:**  
  Genera una matriz cruzando cada entregable con las personas involucradas:
  - **R (Responsible):** Quién realiza la actividad operativa.
  - **A (Accountable):** Quién responde por el resultado final ante el negocio.
  - **C (Consulted):** Expertos o colaboradores a los que se pide opinión o soporte técnico.
  - **I (Informed):** Interesados que deben mantenerse al tanto del avance.

---

### Gestión de Tareas en Curso vs. Tareas Nuevas

Para proteger el backlog de Jira de duplicados innecesarios, ProjectHandler aplica una regla clara:

1. **Consulta Previa del Tablero (`/api/jira/board-context`):**  
   Antes de generar las tareas, el sistema consulta las incidencias activas en el proyecto de Jira configurado.
2. **Clasificación Inteligente:**
   - **`taskKind: 'existing'` (Tarea en Curso):** Si el compromiso discutido en la sesión corresponde a un ticket ya abierto en Jira (ej. `PAY-104`), el sistema vincula la clave existente, muestra un distintivo azul con enlace directo a Jira y genera un **comentario de avance propuesto**.
   - **`taskKind: 'new'` (Tarea Nueva):** Si representa un trabajo no registrado, genera la propuesta de ticket completa para su posterior creación.
3. **Acciones Diferenciadas:**
   - El botón **"Sincronizar todos"** omite deliberadamente los tickets en curso para no duplicarlos.
   - El botón **"Agregar a Jira (Comentario)"** publica el comentario directamente sobre la incidencia original mediante la API de Jira Cloud.

---

### Histórico de Reuniones y Seguimiento de Temas

- **Histórico de Reuniones (`SavedMeetingsTab`):**  
  Catálogo ordenado cronológicamente con todas las sesiones analizadas. Permite reabrir cualquier reunión anterior, revisar los acuerdos, consultar los tickets generados o exportar nuevamente la información.
- **Histórico de Temas (`TopicHistoryTab`):**  
  Agrupa los temas tratados a lo largo de múltiples sesiones (ej. *"Migración de Base de Datos"*, *"Pasarela de Pagos"*). Permite observar la evolución cronológica, qué personas han participado en cada sesión, qué tickets de Jira están vinculados a la iniciativa y cuál es el porcentaje de avance calculado.

---

### Generación de Informes Mensuales Consolidados

En la pestaña **Reporte Mensual**:
1. Se selecciona el mes a analizar (ej. `2026-10`).
2. El sistema recopila todas las reuniones procesadas, los temas discutidos y las tareas vinculadas a ese período.
3. El motor de IA consolida la información y genera:
   - Resumen ejecutivo mensual para stakeholders y dirección.
   - Principales logros alcanzados en el mes.
   - Temas pendientes y riesgos de bloqueo identificados.
   - Balance de carga de trabajo por participante.
   - Recomendaciones estratégicas para el siguiente ciclo.
4. Los informes generados quedan archivados y pueden consultarse o descargarse en cualquier momento.

---

## 💻 Guía Técnica (Para Desarrolladores, Arquitectos y DevOps)

### Motor de Inteligencia Artificial Multi-Proveedor

ProjectHandler cuenta con un motor unificado en [[server.ts]] capaz de interoperar con cuatro proveedores de Inteligencia Artificial:

1. **Anthropic Claude:** Llamadas directas al endpoint `/v1/messages` con `x-api-key`.
2. **OpenAI:** Llamadas a `/v1/chat/completions` con `response_format: { type: 'json_object' }`.
3. **Microsoft Copilot / Azure OpenAI:** Conexión empresarial mediante endpoint dedicado, nombre de despliegue (`deployment`) y versión de API (`api-version`).
4. **Google Gemini:** Utilización del SDK oficial `@google/genai` con respuesta forzada a `application/json`.

---

### Configuración de Modelos de Fábrica desde `.env`

El framework permite configurar los modelos disponibles por defecto para toda la organización directamente en las variables de entorno, sin necesidad de recompilar el código:

```env
# Lista de identificadores técnicos separados por coma
FACTORY_MODELS_GEMINI="gemini-3.8-flash,gemini-2.5-flash,gemini-2.5-pro,gemini-1.5-flash"
FACTORY_MODELS_CLAUDE="claude-3-7-sonnet-20250219,claude-3-5-sonnet-20241022,claude-3-5-haiku-20241022"
FACTORY_MODELS_OPENAI="gpt-4o,gpt-4o-mini,o3-mini"
FACTORY_MODELS_COPILOT="copilot-gpt-4o,copilot-gpt-4o-mini"
```

- El endpoint `GET /api/ai/models` parsea estas listas en el arranque.
- Si una variable no está definida, el backend utiliza su catálogo de respaldo predeterminado.
- El frontend consulta este endpoint dinámicamente y expone los modelos en los desplegables con sus nombres legibles, niveles de velocidad y etiquetas de recomendación.

---

### Modelos Personalizados y Validación en Tiempo Real

Tanto en la ventana modal de **Configuración del Proyecto** como en la pestaña de **Procesar Reunión**, los usuarios pueden agregar modelos personalizados mediante su nombre técnico oficial (por ejemplo: `gemini-3.1-flash-lite`, `gpt-4.5-preview` o `claude-3-opus-20240229`).

El proceso opera con validación estricta:
1. **Petición de Verificación:** Al pulsar **"Probar y Guardar"**, el cliente envía una llamada a `/api/ai/test-connection` con el proveedor, las credenciales activas y el nombre técnico indicado.
2. **Respuesta Negativa (Fallo):** Si la API del proveedor rechaza el identificador (ejemplo: HTTP 404 por modelo inexistente o 401 por falta de permisos):
   - El modelo **no se almacena**.
   - Se muestra una ventana emergente [[AiErrorModal]] con el código de error y el detalle técnico devuelto por el proveedor.
3. **Respuesta Positiva (Éxito):** Si el modelo responde correctamente:
   - Se guarda en el almacenamiento local del navegador (`teams2jira_custom_ai_models`).
   - Se selecciona automáticamente como el modelo activo.
   - Se emite el evento global `teams2jira_custom_models_updated` para que todos los selectores de la aplicación se sincronicen en tiempo real.
4. **Eliminación:** Los modelos personalizados cuentan con un botón de papelera para ser eliminados en cualquier momento.

---

### Manejo de Errores de API y Modal Informativo

Ante contingencias externas del proveedor de IA:
- **Errores de Demanda Elevada (HTTP 503):** Si el servidor del proveedor devuelve un estado de saturación temporal (*"This model is currently experiencing high demand"*), el componente [[AiErrorModal]] explica con claridad la situación y ofrece la opción de reintentar.
- **Interrupción Segura:** Si la llamada al modelo falla durante el análisis de una reunión o reporte mensual, el sistema interrumpe el flujo de forma limpia sin generar registros corruptos ni llamadas a Jira o Confluence.

---

### Integración con Jira Cloud y Confluence

#### Jira Cloud REST API
- **Autocompletado de Usuarios (`GET /api/jira/search-users?query=...`):** Busca cuentas reales en Jira Cloud y vincula el `accountId` correspondiente.
- **Inspección de Tablero (`GET /api/jira/board-context`):** Obtiene las incidencias activas en el tablero del proyecto para alimentar el contexto de la IA y evitar duplicados.
- **Creación de Tickets (`POST /api/jira/create-ticket`):** Crea incidencias respetando los campos estándar de Jira (resumen, descripción, prioridad, tipo de issue, Story Points y etiquetas).
- **Publicación de Comentarios (`POST /api/jira/add-comment`):** Redacta y publica comentarios en formato estructurado Atlassian Document Format (ADF) sobre tickets existentes.
- **Sincronización de Estados (`POST /api/jira/sync-statuses`):** Consulta por lotes el estado actual de las incidencias vinculadas y actualiza el progreso en el frontend.

#### Confluence Cloud REST API
- **Publicación de Actas (`POST /api/confluence/publish-page`):** Genera una página estructurada en formato XHTML/Storage Format de Confluence, conteniendo la tabla de metadatos, participantes, acuerdos, matriz RACI y tabla de tareas con enlaces a Jira.

---

### Recepción Automática vía Webhook (Teams / Power Automate)

- **Endpoint Receptor:** `POST /api/teams/webhook`
- **Validación de Token (*Handshake*):** Soporta el parámetro `validationToken` de Microsoft Graph, respondiendo con texto plano `text/plain` y código 200 para validar la suscripción.
- **Carga de Datos:** Acepta cargas JSON conteniendo la transcripción, el asunto de la reunión y la marca de tiempo.
- **Consulta desde el Frontend:** `GET /api/teams/latest-webhook` permite comprobar periódicamente si hay una nueva transcripción recibida para cargarla automáticamente en pantalla.

---

### Referencia de Endpoints del Backend REST

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Estado del servidor y presencia de claves de IA configuradas en `.env`. |
| `GET` | `/api/ai/status` | Disponibilidad booleana de cada proveedor de Inteligencia Artificial. |
| `GET` | `/api/ai/models` | Lista de modelos de fábrica configurados desde variables de entorno. |
| `POST` | `/api/ai/test-connection` | Valida la conexión y tiempo de respuesta con un modelo y proveedor específico. |
| `POST` | `/api/analyze-transcript` | Ejecuta el análisis inteligente de la transcripción y devuelve el esquema estructurado. |
| `POST` | `/api/generate-monthly-report` | Consolida reuniones y temas de un mes en un informe ejecutivo para dirección. |
| `POST` | `/api/jira/test-connection` | Comprueba credenciales contra Jira Cloud y recupera el usuario autenticado. |
| `GET` | `/api/jira/search-users` | Búsqueda por coincidencia parcial de usuarios en la instancia de Jira Cloud. |
| `GET` | `/api/jira/board-context` | Obtiene las incidencias abiertas en el tablero para contextualizar el análisis. |
| `POST` | `/api/jira/create-ticket` | Crea una nueva incidencia en Jira Cloud. |
| `POST` | `/api/jira/add-comment` | Agrega un comentario en formato ADF a una incidencia existente en Jira. |
| `POST` | `/api/jira/sync-statuses` | Recupera el estado actualizado de un listado de claves de Jira. |
| `POST` | `/api/confluence/publish-page` | Publica un acta de reunión en el espacio de Confluence indicado. |
| `POST` | `/api/teams/webhook` | Recepción de transcripciones emitidas por Microsoft Power Automate. |
| `GET` | `/api/teams/latest-webhook` | Consulta de la última transcripción recibida vía Webhook. |

---

## 🚀 Instalación y Puesta en Marcha

### Requisitos Previos
- **Node.js:** Versión 18.0.0 o superior.
- **npm:** Incluido habitualmente con Node.js.
- Al menos una clave de API válida para el proveedor de IA deseado (Google Gemini, Anthropic, OpenAI o Azure).

### 1. Clonar el Repositorio e Instalar Dependencias
```bash
# Acceder al directorio del proyecto
cd ProjectHandler

# Instalar dependencias de producción y desarrollo
npm install
```

### 2. Configurar el Entorno
Crea tu archivo `.env` a partir del archivo de ejemplo:
```bash
cp .env.example .env
```
Edita `.env` con tus claves de API y parámetros de entorno.

### 3. Iniciar en Modo Desarrollo
```bash
npm run dev
```
La aplicación iniciará Vite y el backend Express en:  
👉 **`http://localhost:3000`**

### 4. Compilar para Producción
```bash
# Construir el bundle estático optimizado
npm run build

# Iniciar el servidor de producción
npm start
```

---

## ⚙️ Configuración de Variables de Entorno (`.env`)

```env
# ============================================================================
# CLAVES DE PROVEEDORES DE INTELIGENCIA ARTIFICIAL
# ============================================================================
# Google Gemini (Google AI Studio)
GEMINI_API_KEY="AIzaSy..."

# Anthropic Claude
ANTHROPIC_API_KEY="sk-ant-..."

# OpenAI
OPENAI_API_KEY="sk-proj-..."

# Microsoft Copilot / Azure OpenAI
AZURE_OPENAI_KEY=""
AZURE_OPENAI_ENDPOINT=""
AZURE_OPENAI_DEPLOYMENT="gpt-4o"
AZURE_OPENAI_API_VERSION="2024-08-01-preview"

# ============================================================================
# MODELOS DE FÁBRICA / DEFAULT POR PROVEEDOR (Configurables)
# Lista de identificadores técnicos separados por coma
# ============================================================================
FACTORY_MODELS_GEMINI="gemini-3.8-flash,gemini-2.5-flash,gemini-2.5-pro,gemini-1.5-flash"
FACTORY_MODELS_CLAUDE="claude-3-7-sonnet-20250219,claude-3-5-sonnet-20241022,claude-3-5-haiku-20241022"
FACTORY_MODELS_OPENAI="gpt-4o,gpt-4o-mini,o3-mini"
FACTORY_MODELS_COPILOT="copilot-gpt-4o,copilot-gpt-4o-mini"

# ============================================================================
# CONFIGURACIÓN DEL SERVIDOR
# ============================================================================
PORT=3000
APP_URL="http://localhost:3000"
```

> **Nota:** Las claves de API también pueden introducirse o sobrescribirse directamente en la interfaz gráfica dentro de **Configuración > Proveedores de IA**, almacenándose en la sesión local sin requerir reinicios del servicio.

---

## 📁 Estructura del Proyecto

```
ProjectHandler/
├── .env                        # Variables de entorno y configuración de modelos
├── .env.example                # Plantilla de variables de entorno
├── index.html                  # Plantilla HTML base
├── package.json                # Dependencias, scripts y metadatos del proyecto
├── server.ts                   # Backend Express: orquestación de LLMs, APIs Jira/Confluence y Webhooks
├── tsconfig.json               # Configuración del compilador TypeScript
├── vite.config.ts              # Configuración de Vite y plugins
└── src/
    ├── App.tsx                 # Componente raíz, orquestador de estado global y vistas
    ├── main.tsx                # Punto de entrada de la aplicación React
    ├── index.css               # Estilos globales y sistema de diseño
    ├── components/             # Componentes modulares de interfaz de usuario
    │   ├── AiErrorModal.tsx        # Modal emergente para errores de API y pruebas de conexión
    │   ├── CivicaLogo.tsx          # Logotipo e isotipo institucional
    │   ├── CompactTableView.tsx    # Vista en tabla compacta de tareas y enlaces a Jira
    │   ├── ConfluencePublishModal.tsx # Publicación de actas en Confluence Cloud
    │   ├── DependencyFlowView.tsx  # Grafo interactivo de dependencias entre participantes
    │   ├── EmailShareModal.tsx     # Generación de correos ejecutivos limpios
    │   ├── JiraConfirmModal.tsx    # Modal de confirmación previa a la creación masiva
    │   ├── JiraTicketModal.tsx     # Editor integral de ticket (criterios, DoD, Story Points)
    │   ├── JiraUserAutocomplete.tsx# Búsqueda predictiva de usuarios contra Jira Cloud
    │   ├── MeetingSummaryTab.tsx   # Panel de análisis completo de la reunión
    │   ├── MonthlyReportTab.tsx    # Generación y gestión de informes mensuales consolidados
    │   ├── Navbar.tsx              # Barra de navegación principal y estado de conexiones
    │   ├── ProjectConfigModal.tsx  # Configuración global (Jira, Story Points, RACI, Modelos IA)
    │   ├── RACIMatrixView.tsx      # Matriz interactiva de asignación RACI
    │   ├── SavedMeetingsTab.tsx    # Histórico de reuniones almacenadas localmente
    │   ├── TeamsWebhookCard.tsx    # Monitor en tiempo real de recepciones vía Webhook
    │   ├── TopicHistoryTab.tsx     # Seguimiento evolutivo de temas a través del tiempo
    │   └── TranscriptInputTab.tsx  # Carga de transcripción, selector de modelos y prompts
    ├── types/
    │   └── index.ts            # Definiciones de tipos TypeScript del modelo de dominio
    └── utils/
        ├── exportUtils.ts      # Utilidades de exportación (Markdown, CSV, Email corporativo)
        └── storage.ts          # Persistencia en localStorage (reuniones, temas, modelos personalizados)
```

---

## 🔐 Seguridad y Privacidad

- **Almacenamiento Local Seguro:** El contenido de las transcripciones, resúmenes, matrices y configuraciones operativas reside en el almacenamiento local del navegador (`localStorage`) de cada usuario. No existen bases de datos intermedias almacenando grabaciones de forma externa.
- **Protección de Credenciales Atlassian:** Los tokens de Jira y Confluence viajan en cabeceras de autorización HTTPS directamente al backend para ejecutar las peticiones oficiales a la API de Atlassian.
- **Modo Simulación:** Incluye un conmutador de simulación que permite explorar y capacitar a los equipos sin emitir mutaciones reales ni crear tickets en los tableros productivos de Jira.

---

<p align="center">
  <b>ProjectHandler</b> • Diseñado para la excelencia operativa y la agilidad continua.<br/>
  <i>Cívica Software © 2026</i>
</p>
