import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  authToken?: string;
  snowflakeAccount?: string;
  snowflakeWarehouse?: string;
  snowflakeSchema?: string;
  snowflakeRole?: string;
  tableName?: string;
  autoSync?: boolean;
  lastSyncedAt?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  message: string;
  engine: DatabaseType;
  details?: Record<string, any>;
  error?: string;
}

// Local persistent file store path for SQLite / server-side persistence
const DATA_DIR = path.resolve(__dirname, '../../data');
const STORE_FILE = path.join(DATA_DIR, 'projecthandler_store.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

interface LocalStoreStructure {
  settings?: any;
  meetings?: any[];
  topics?: any[];
  monthly_reports?: any[];
  custom_models?: any[];
  _metadata?: {
    lastUpdated: string;
    version: number;
  };
}

function readLocalStore(): LocalStoreStructure {
  ensureDataDir();
  if (!fs.existsSync(STORE_FILE)) {
    const initial: LocalStoreStructure = {
      _metadata: { lastUpdated: new Date().toISOString(), version: 1 },
      meetings: [],
      topics: [],
      monthly_reports: [],
      custom_models: [],
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading local database store file:', err);
    return {};
  }
}

function writeLocalStore(data: LocalStoreStructure): void {
  ensureDataDir();
  data._metadata = {
    lastUpdated: new Date().toISOString(),
    version: (data._metadata?.version || 1) + 1,
  };
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Parses connection string into components (host, port, user, password, database)
 */
export function parseConnectionString(connStr: string): Partial<DatabaseConfig> {
  if (!connStr || !connStr.trim()) return {};
  try {
    const trimmed = connStr.trim();
    if (trimmed.startsWith('sqlite:')) {
      const dbPath = trimmed.replace(/^sqlite:\/\//, '').replace(/^sqlite:/, '');
      return { type: 'sqlite', database: dbPath || './data/projecthandler.db' };
    }
    if (trimmed.startsWith('snowflake:')) {
      // snowflake://<user>:<password>@<account>.snowflakecomputing.com/?warehouse=<wh>&db=<db>&schema=<schema>
      const cleanUrl = trimmed.replace(/^snowflake:\/\//, 'https://');
      const parsed = new URL(cleanUrl);
      const account = parsed.hostname.replace(/\.snowflakecomputing\.com$/, '');
      return {
        type: 'snowflake',
        snowflakeAccount: account,
        host: parsed.hostname,
        username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        database: parsed.searchParams.get('db') || parsed.pathname.replace(/^\//, '') || undefined,
        snowflakeWarehouse: parsed.searchParams.get('warehouse') || undefined,
        snowflakeSchema: parsed.searchParams.get('schema') || undefined,
        snowflakeRole: parsed.searchParams.get('role') || undefined,
      };
    }
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.replace(':', '').toLowerCase();

    let type: DatabaseType = 'postgres';
    if (protocol.includes('mysql')) type = 'mysql';
    else if (protocol.includes('mongo')) type = 'mongodb';
    else if (protocol.includes('snowflake')) type = 'snowflake';
    else if (protocol.includes('http')) type = 'rest';
    else if (protocol.includes('sqlite')) type = 'sqlite';

    return {
      type,
      host: parsed.hostname || undefined,
      port: parsed.port ? parseInt(parsed.port, 10) : undefined,
      database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : undefined,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      ssl: parsed.searchParams.get('ssl') === 'true' || parsed.searchParams.get('sslmode') === 'require',
    };
  } catch {
    return {};
  }
}

/**
 * Tests raw TCP connectivity with timeout and latency measurement
 */
function testTcpConnection(host: string, port: number, timeoutMs = 4000): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = new net.Socket();
    let handled = false;

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (handled) return;
      handled = true;
      const latencyMs = Math.round(performance.now() - start);
      cleanup();
      resolve({ ok: true, latencyMs });
    });

    socket.on('timeout', () => {
      if (handled) return;
      handled = true;
      cleanup();
      resolve({ ok: false, latencyMs: timeoutMs, error: `Tiempo de espera agotado (${timeoutMs}ms) conectando a ${host}:${port}` });
    });

    socket.on('error', (err) => {
      if (handled) return;
      handled = true;
      const latencyMs = Math.round(performance.now() - start);
      cleanup();
      resolve({ ok: false, latencyMs, error: `Error de socket: ${err.message}` });
    });

    try {
      socket.connect(port, host);
    } catch (err: any) {
      if (handled) return;
      handled = true;
      cleanup();
      resolve({ ok: false, latencyMs: 0, error: err.message });
    }
  });
}

/**
 * Normalizes Snowflake account string to official organization-account subdomain format:
 * - Strips https:// and .snowflakecomputing.com
 * - Converts dot (org.account) to hyphen (org-account) for valid wildcard SSL certificates
 */
export function normalizeSnowflakeAccount(rawAccount: string): string {
  if (!rawAccount) return '';
  let acc = rawAccount
    .replace(/^https?:\/\//i, '')
    .replace(/\.snowflakecomputing\.com.*$/i, '')
    .trim()
    .toLowerCase();

  // If user entered org.account with a dot (e.g. "hhfxicv.civicapartner"),
  // convert dot to hyphen so wildcard SSL certificate *.snowflakecomputing.com validates correctly.
  if (acc.includes('.')) {
    const parts = acc.split('.');
    if (parts.length === 2 && !/^(us|eu|ap|ca|sa|me|af)-/i.test(parts[1])) {
      acc = `${parts[0]}-${parts[1]}`;
    }
  }
  return acc;
}

/**
 * Helper to execute arbitrary SQL statements on Snowflake via SQL REST API v2
 */
export async function executeSnowflakeSql(
  config: DatabaseConfig,
  statement: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  let rawAccount = (config.snowflakeAccount || '').trim();
  if (!rawAccount && config.host && config.host !== 'localhost') {
    rawAccount = config.host;
  }
  const account = normalizeSnowflakeAccount(rawAccount);

  if (!account) return { success: false, error: 'Falta el identificador de cuenta de Snowflake.' };

  const rawToken = (config.authToken || config.password || '').trim();
  const token = rawToken.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return { success: false, error: 'Falta el Token de acceso programático (PAT) de Snowflake. Ingrésalo en la configuración de Base de Datos.' };
  }

  const cleanHost = `${account}.snowflakecomputing.com`;
  const sqlEndpoint = `https://${cleanHost}/api/v2/statements`;
  const warehouse = config.snowflakeWarehouse?.trim() || 'WH_CURSO_DATA_ENGINEERING';
  const database = config.database?.trim() || 'PROJECT_HANDLER_DEMO';
  const schema = config.snowflakeSchema?.trim() || 'PUBLIC';
  const role = config.snowflakeRole?.trim() || undefined;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'ProyectHandler-Snowflake/1.0',
  };
  if (role) {
    headers['X-Snowflake-Role'] = role;
  }
  if (warehouse) {
    headers['X-Snowflake-Warehouse'] = warehouse;
  }
  if (database) {
    headers['X-Snowflake-Database'] = database;
  }
  if (schema) {
    headers['X-Snowflake-Schema'] = schema;
  }
  // If token is a PAT (not a JWT with dots), declare the token type
  if (!token.includes('.')) {
    headers['X-Snowflake-Authorization-Token-Type'] = 'PROGRAMMATIC_ACCESS_TOKEN';
  }

  const body: any = {
    statement,
    warehouse,
    database,
    schema,
  };
  if (role) {
    body.role = role;
  }

  console.log(`[Snowflake] Executing query on ${cleanHost} (WH: ${warehouse}, DB: ${database}, Schema: ${schema}):`, statement.slice(0, 120) + (statement.length > 120 ? '...' : ''));

  try {
    const res = await fetch(sqlEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    const json: any = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log(`[Snowflake] Query succeeded (HTTP ${res.status}): statementHandle=${json?.statementHandle || 'ok'}`);
      return { success: true, data: json };
    } else {
      const errMsg = json?.message || json?.error || res.statusText || 'Error ejecutando SQL en Snowflake';
      console.error(`[Snowflake] SQL Error (HTTP ${res.status}):`, errMsg, json);
      return { success: false, error: `Snowflake (HTTP ${res.status}): ${errMsg}` };
    }
  } catch (err: any) {
    console.error(`[Snowflake] Network error:`, err.message);
    return { success: false, error: `Error de red al conectar con Snowflake: ${err.message}` };
  }
}

/**
 * Agnostic Database Service
 */
export class AgnosticDatabaseService {
  /**
   * Tests connection according to database configuration
   */
  async testConnection(config: DatabaseConfig): Promise<ConnectionTestResult> {
    const startTime = performance.now();

    // If disabled or 'none'
    if (!config.enabled || config.type === 'none') {
      return {
        success: true,
        latencyMs: 0,
        engine: 'none',
        message: 'Modo Almacenamiento Local (localStorage) activo. Sin base de datos remota configurada.',
      };
    }

    const type = config.type;

    // 1. SQLite / Archivo local
    if (type === 'sqlite') {
      try {
        ensureDataDir();
        const testFile = path.join(DATA_DIR, '.db_test');
        fs.writeFileSync(testFile, 'test', 'utf-8');
        fs.unlinkSync(testFile);
        const latencyMs = Math.round(performance.now() - startTime);

        return {
          success: true,
          latencyMs,
          engine: 'sqlite',
          message: 'Base de datos SQLite / Almacén persistente local verificado y con permisos de lectura/escritura.',
          details: {
            storageDir: DATA_DIR,
            dataFile: STORE_FILE,
          },
        };
      } catch (err: any) {
        return {
          success: false,
          latencyMs: Math.round(performance.now() - startTime),
          engine: 'sqlite',
          message: 'No se pudo acceder al directorio local de la base de datos.',
          error: err.message,
        };
      }
    }

    // 2. Snowflake Cloud Data Warehouse
    if (type === 'snowflake') {
      let account = config.snowflakeAccount?.trim() || '';

      if (!account && config.connectionString) {
        const parsed = parseConnectionString(config.connectionString);
        account = parsed.snowflakeAccount || parsed.host?.replace(/\.snowflakecomputing\.com$/i, '') || '';
      }

      if (!account && config.host && config.host !== 'localhost') {
        account = config.host.replace(/\.snowflakecomputing\.com$/i, '');
      }

      if (!account) {
        return {
          success: false,
          latencyMs: 0,
          engine: 'snowflake',
          message: 'Falta el identificador de cuenta de Snowflake (ej. xy12345.eu-central-1 o mi-organizacion-cuenta).',
        };
      }

      // Format hostname: Snowflake accounts use lowercase in URLs: <org>-<account>.snowflakecomputing.com
      const cleanAcc = normalizeSnowflakeAccount(account);
      const cleanHost = `${cleanAcc}.snowflakecomputing.com`;
      const port = 443;
      const warehouse = config.snowflakeWarehouse?.trim() || 'WH_CURSO_DATA_ENGINEERING';
      const database = config.database?.trim() || 'PROJECT_HANDLER_DEMO';
      const schema = config.snowflakeSchema?.trim() || 'PUBLIC';
      const role = config.snowflakeRole?.trim() || undefined;

      const token = (config.authToken || config.password || '').trim();

      // If token provided, test Snowflake SQL API v2 endpoint
      if (token) {
        try {
          const sqlRes = await executeSnowflakeSql(
            config,
            'SELECT CURRENT_VERSION(), CURRENT_WAREHOUSE(), CURRENT_DATABASE(), CURRENT_SCHEMA()'
          );
          const latencyMs = Math.round(performance.now() - startTime);

          if (sqlRes.success) {
            return {
              success: true,
              latencyMs,
              engine: 'snowflake',
              message: `¡Conexión verificada exitosamente con Snowflake! Token PAT autenticado y permisos validados.`,
              details: {
                account: cleanAcc,
                host: cleanHost,
                warehouse,
                database,
                schema,
                role: role || 'Default',
                statementStatus: sqlRes.data?.message || 'Ejecutado con éxito',
              },
            };
          } else {
            return {
              success: false,
              latencyMs,
              engine: 'snowflake',
              message: sqlRes.error || 'Fallo de autenticación con Snowflake.',
              details: { account: cleanAcc, host: cleanHost },
            };
          }
        } catch (fetchErr: any) {
          console.warn('[AgnosticDB] Fetch to Snowflake SQL API failed, checking TCP port 443:', fetchErr.message);
        }
      }

      // Check HTTPS TCP connectivity to Snowflake host
      const tcpResult = await testTcpConnection(cleanHost, port, 5000);
      const latencyMs = tcpResult.latencyMs || Math.round(performance.now() - startTime);

      if (!tcpResult.ok) {
        return {
          success: false,
          latencyMs,
          engine: 'snowflake',
          message: `No se pudo conectar con el endpoint de Snowflake en ${cleanHost}:${port}. Revisa el identificador de cuenta.`,
          error: tcpResult.error,
          details: { account: cleanAcc, host: cleanHost, port },
        };
      }

      return {
        success: true,
        latencyMs,
        engine: 'snowflake',
        message: `Endpoint alcanzado (${cleanHost}:443). Ingresa tu Token (PAT) para validar permisos y migrar datos.`,
        details: {
          account: cleanAcc,
          host: cleanHost,
          warehouse,
          database,
          schema,
          role: config.snowflakeRole || 'SYSADMIN',
          tableName: config.tableName || 'PROJECTHANDLER_STORE',
        },
      };
    }

    // 3. REST API / Webhook agnóstico
    if (type === 'rest') {
      const endpoint = config.connectionString || (config.host ? `http://${config.host}${config.port ? `:${config.port}` : ''}` : '');
      if (!endpoint) {
        return {
          success: false,
          latencyMs: 0,
          engine: 'rest',
          message: 'Falta la URL o Endpoint de la API REST de persistencia.',
        };
      }

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'ProyectHandler-Agnostic-DB/1.0',
        };
        if (config.authToken) {
          headers['Authorization'] = `Bearer ${config.authToken.trim()}`;
        }

        const res = await fetch(endpoint, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(5000),
        });

        const latencyMs = Math.round(performance.now() - startTime);

        if (res.ok || res.status === 404 || res.status === 401 || res.status === 405) {
          return {
            success: true,
            latencyMs,
            engine: 'rest',
            message: `Endpoint REST alcanzado exitosamente (HTTP ${res.status}).`,
            details: {
              endpoint,
              status: res.status,
              statusText: res.statusText,
            },
          };
        } else {
          return {
            success: false,
            latencyMs,
            engine: 'rest',
            message: `El endpoint REST respondió con estado HTTP ${res.status} (${res.statusText}).`,
          };
        }
      } catch (err: any) {
        return {
          success: false,
          latencyMs: Math.round(performance.now() - startTime),
          engine: 'rest',
          message: `Error al conectar con la API REST: ${err.message}`,
          error: err.message,
        };
      }
    }

    // 4. PostgreSQL / MySQL / MongoDB (TCP Connectivity + Parameter Validation)
    const host = config.host || (config.connectionString ? parseConnectionString(config.connectionString).host : '') || 'localhost';
    const defaultPorts: Record<string, number> = {
      postgres: 5432,
      mysql: 3306,
      mongodb: 27017,
    };
    const port = config.port || (config.connectionString ? parseConnectionString(config.connectionString).port : undefined) || defaultPorts[type] || 5432;
    const dbName = config.database || (config.connectionString ? parseConnectionString(config.connectionString).database : undefined) || 'projecthandler';

    const tcpResult = await testTcpConnection(host, port, 4000);
    const latencyMs = tcpResult.latencyMs || Math.round(performance.now() - startTime);

    if (!tcpResult.ok) {
      return {
        success: false,
        latencyMs,
        engine: type,
        message: `No se pudo establecer conexión con el servidor de ${type.toUpperCase()} en ${host}:${port}.`,
        error: tcpResult.error,
        details: { host, port, database: dbName },
      };
    }

    return {
      success: true,
      latencyMs,
      engine: type,
      message: `Conexión con el servidor de ${type.toUpperCase()} verificada con éxito (${host}:${port}).`,
      details: {
        host,
        port,
        database: dbName,
        tableName: config.tableName || 'projecthandler_store',
      },
    };
  }

  /**
   * Reads data from the agnostic store
   */
  async getData(config: DatabaseConfig, collection: string): Promise<any> {
    if (!config.enabled || config.type === 'none') {
      return null;
    }

    if (config.type === 'sqlite') {
      const store = readLocalStore();
      return (store as any)[collection] || null;
    }

    // Snowflake Cloud Data Warehouse query
    if (config.type === 'snowflake') {
      const tableName = (config.tableName?.trim() || 'PROJECTHANDLER_STORE').toUpperCase();
      const safeCol = collection.replace(/'/g, "''");
      const sql = `SELECT "KEY", "DATA" FROM ${tableName} WHERE "COLLECTION" = '${safeCol}' ORDER BY "UPDATED_AT" DESC;`;
      const queryRes = await executeSnowflakeSql(config, sql);
      if (queryRes.success && queryRes.data?.data) {
        const rows = queryRes.data.data;
        if (collection === 'settings') {
          if (rows.length > 0 && rows[0][1]) {
            try { return JSON.parse(rows[0][1]); } catch { return rows[0][1]; }
          }
          return null;
        }
        return rows.map((row: any[]) => {
          try {
            return typeof row[1] === 'string' ? JSON.parse(row[1]) : row[1];
          } catch {
            return row[1];
          }
        });
      }
      // Fallback to local store if remote query failed or not initialized
      const store = readLocalStore();
      return (store as any)[collection] || null;
    }

    if (config.type === 'rest') {
      const baseUrl = config.connectionString || (config.host ? `http://${config.host}${config.port ? `:${config.port}` : ''}` : '');
      if (!baseUrl) return null;
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (config.authToken) headers['Authorization'] = `Bearer ${config.authToken}`;
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/${collection}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn(`[AgnosticDB] Error fetching from REST endpoint for ${collection}:`, err);
      }
      return null;
    }

    const store = readLocalStore();
    return (store as any)[collection] || null;
  }

  /**
   * Saves an item to the agnostic store
   */
  async saveItem(config: DatabaseConfig, collection: string, key: string, data: any): Promise<boolean> {
    if (!config.enabled || config.type === 'none') {
      return true;
    }

    // Always update local server store cache for resilience
    const store = readLocalStore();
    if (collection === 'settings') {
      store.settings = data;
    } else {
      const list = Array.isArray((store as any)[collection]) ? (store as any)[collection] : [];
      const index = list.findIndex((item: any) => item && (item.id === key || item.monthYear === key || item.key === key));
      if (index >= 0) {
        list[index] = data;
      } else {
        list.unshift(data);
      }
      (store as any)[collection] = list;
    }
    writeLocalStore(store);

    // If Snowflake, execute MERGE in background
    if (config.type === 'snowflake' && (config.authToken || config.password)) {
      const tableName = (config.tableName?.trim() || 'PROJECTHANDLER_STORE').toUpperCase();
      const safeKey = String(key).replace(/'/g, "''");
      const safeCol = String(collection).replace(/'/g, "''");
      const jsonStr = JSON.stringify(data).replace(/\$\$/g, '$ $');
      const sql = `MERGE INTO ${tableName} AS t
USING (SELECT '${safeKey}' AS K, '${safeCol}' AS C, PARSE_JSON($$${jsonStr}$$) AS D) AS s
ON t."KEY" = s.K AND t."COLLECTION" = s.C
WHEN MATCHED THEN UPDATE SET t."DATA" = s.D, t."UPDATED_AT" = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT ("KEY", "COLLECTION", "DATA", "UPDATED_AT") VALUES (s.K, s.C, s.D, CURRENT_TIMESTAMP());`;
      executeSnowflakeSql(config, sql).catch((err) => {
        console.warn('[AgnosticDB] Background save to Snowflake failed:', err);
      });
    }

    if (config.type === 'rest') {
      const baseUrl = config.connectionString || (config.host ? `http://${config.host}${config.port ? `:${config.port}` : ''}` : '');
      if (baseUrl) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (config.authToken) headers['Authorization'] = `Bearer ${config.authToken}`;
          await fetch(`${baseUrl.replace(/\/$/, '')}/${collection}/${key}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(5000),
          });
          return true;
        } catch (err) {
          console.warn('[AgnosticDB] Failed to save to REST endpoint:', err);
        }
      }
    }

    return true;
  }

  /**
   * Deletes an item from the agnostic store
   */
  async deleteItem(config: DatabaseConfig, collection: string, key: string): Promise<boolean> {
    if (!config.enabled || config.type === 'none') {
      return true;
    }

    const store = readLocalStore();
    const list = Array.isArray((store as any)[collection]) ? (store as any)[collection] : [];
    (store as any)[collection] = list.filter((item: any) => item && item.id !== key && item.monthYear !== key);
    writeLocalStore(store);

    if (config.type === 'snowflake' && (config.authToken || config.password)) {
      const tableName = (config.tableName?.trim() || 'PROJECTHANDLER_STORE').toUpperCase();
      const safeKey = String(key).replace(/'/g, "''");
      const safeCol = String(collection).replace(/'/g, "''");
      const sql = `DELETE FROM ${tableName} WHERE "KEY" = '${safeKey}' AND "COLLECTION" = '${safeCol}';`;
      executeSnowflakeSql(config, sql).catch((err) => {
        console.warn('[AgnosticDB] Background delete in Snowflake failed:', err);
      });
    }

    if (config.type === 'rest') {
      const baseUrl = config.connectionString || (config.host ? `http://${config.host}${config.port ? `:${config.port}` : ''}` : '');
      if (baseUrl) {
        try {
          const headers: Record<string, string> = {};
          if (config.authToken) headers['Authorization'] = `Bearer ${config.authToken}`;
          await fetch(`${baseUrl.replace(/\/$/, '')}/${collection}/${key}`, {
            method: 'DELETE',
            headers,
            signal: AbortSignal.timeout(5000),
          });
        } catch (err) {
          console.warn('[AgnosticDB] Failed to delete from REST endpoint:', err);
        }
      }
    }

    return true;
  }

  /**
   * Bulk migration from client (localStorage payload) into database
   */
  async bulkMigrate(config: DatabaseConfig, payload: { settings?: any; meetings?: any[]; topics?: any[]; reports?: any[]; customModels?: any[] }): Promise<{ success: boolean; migrated: Record<string, number>; error?: string }> {
    const counts = {
      settings: payload.settings ? 1 : 0,
      meetings: Array.isArray(payload.meetings) ? payload.meetings.length : 0,
      topics: Array.isArray(payload.topics) ? payload.topics.length : 0,
      reports: Array.isArray(payload.reports) ? payload.reports.length : 0,
      customModels: Array.isArray(payload.customModels) ? payload.customModels.length : 0,
    };

    // 1. Always update server-side local cache
    const store = readLocalStore();
    if (payload.settings) store.settings = payload.settings;
    if (Array.isArray(payload.meetings)) store.meetings = payload.meetings;
    if (Array.isArray(payload.topics)) store.topics = payload.topics;
    if (Array.isArray(payload.reports)) store.monthly_reports = payload.reports;
    if (Array.isArray(payload.customModels)) store.custom_models = payload.customModels;
    writeLocalStore(store);

    // 2. Real Snowflake Cloud Data Warehouse Migration
    if (config.type === 'snowflake') {
      const tableName = (config.tableName?.trim() || 'PROJECTHANDLER_STORE').toUpperCase();

      // Ensure table exists in Snowflake
      const createTableSql = `CREATE TABLE IF NOT EXISTS ${tableName} (
  "KEY" VARCHAR(255) NOT NULL,
  "COLLECTION" VARCHAR(100) NOT NULL,
  "DATA" VARIANT NOT NULL,
  "UPDATED_AT" TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY ("KEY", "COLLECTION")
);`;
      const tableRes = await executeSnowflakeSql(config, createTableSql);
      if (!tableRes.success) {
        return {
          success: false,
          migrated: counts,
          error: `Error al crear tabla en Snowflake: ${tableRes.error}`,
        };
      }

      const mergeDoc = async (key: string, collection: string, doc: any) => {
        const safeKey = String(key).replace(/'/g, "''");
        const safeCol = String(collection).replace(/'/g, "''");
        const jsonStr = JSON.stringify(doc).replace(/\$\$/g, '$ $');
        const sql = `MERGE INTO ${tableName} AS t
USING (SELECT '${safeKey}' AS K, '${safeCol}' AS C, PARSE_JSON($$${jsonStr}$$) AS D) AS s
ON t."KEY" = s.K AND t."COLLECTION" = s.C
WHEN MATCHED THEN UPDATE SET t."DATA" = s.D, t."UPDATED_AT" = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT ("KEY", "COLLECTION", "DATA", "UPDATED_AT") VALUES (s.K, s.C, s.D, CURRENT_TIMESTAMP());`;
        return executeSnowflakeSql(config, sql);
      };

      // Migrate settings
      if (payload.settings) {
        const r = await mergeDoc('main', 'settings', payload.settings);
        if (!r.success) {
          return { success: false, migrated: counts, error: `Error migrando settings a Snowflake: ${r.error}` };
        }
      }

      // Migrate meetings
      if (Array.isArray(payload.meetings)) {
        for (const m of payload.meetings) {
          if (m && m.id) {
            const r = await mergeDoc(m.id, 'meetings', m);
            if (!r.success) {
              return { success: false, migrated: counts, error: `Error migrando reunión (${m.id}) a Snowflake: ${r.error}` };
            }
          }
        }
      }

      // Migrate topics
      if (Array.isArray(payload.topics)) {
        for (const t of payload.topics) {
          if (t && t.id) {
            const r = await mergeDoc(t.id, 'topics', t);
            if (!r.success) {
              return { success: false, migrated: counts, error: `Error migrando tema (${t.id}) a Snowflake: ${r.error}` };
            }
          }
        }
      }

      // Migrate monthly reports
      if (Array.isArray(payload.reports)) {
        for (const rep of payload.reports) {
          if (rep) {
            const r = await mergeDoc(rep.id || rep.monthYear, 'monthly_reports', rep);
            if (!r.success) {
              return { success: false, migrated: counts, error: `Error migrando reporte (${rep.monthYear}) a Snowflake: ${r.error}` };
            }
          }
        }
      }

      // Migrate custom AI models
      if (Array.isArray(payload.customModels)) {
        for (const mod of payload.customModels) {
          if (mod && mod.id) {
            await mergeDoc(mod.id, 'custom_models', mod);
          }
        }
      }
    }

    // 3. REST API Migration
    if (config.type === 'rest') {
      const baseUrl = config.connectionString || (config.host ? `http://${config.host}${config.port ? `:${config.port}` : ''}` : '');
      if (baseUrl) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (config.authToken) headers['Authorization'] = `Bearer ${config.authToken}`;
          await fetch(`${baseUrl.replace(/\/$/, '')}/bulk-sync`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(8000),
          });
        } catch (err: any) {
          console.warn('[AgnosticDB] Failed to send bulk-sync to REST endpoint:', err);
        }
      }
    }

    return {
      success: true,
      migrated: counts,
    };
  }
}

export const agnosticDb = new AgnosticDatabaseService();

