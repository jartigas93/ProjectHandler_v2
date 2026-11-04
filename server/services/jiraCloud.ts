/**
 * Jira Cloud REST API integrations:
 * - Story Points field discovery and caching
 * - Assignee accountId resolution
 * - Native issue linking (/rest/api/3/issueLink)
 * - Board context retrieval (/rest/api/3/search/jql)
 * - Confluence Cloud real publication (/wiki/rest/api/content)
 */

export interface BoardIssueContext {
  key: string;
  summary: string;
  status: string;
  issueType: string;
  assignee: string;
  statusCategory?: string;
  isClosed?: boolean;
  epicKey?: string;
  priority?: string;
  labels?: string[];
  score?: number;
}

// Memory caches per domain
const jiraStoryPointsFieldCache = new Map<string, string | null>();
const jiraIssueLinkTypesCache = new Map<string, any[]>();

/**
 * Autodetects Jira Cloud custom field for Story Points / Story Point Estimate / Puntos de Historia.
 * Caches the detected fieldId per domain.
 */
export async function discoverStoryPointsFieldId(domain: string, authHeader: string): Promise<string | null> {
  const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (jiraStoryPointsFieldCache.has(cleanDomain)) {
    return jiraStoryPointsFieldCache.get(cleanDomain) || null;
  }

  try {
    const res = await fetch(`https://${cleanDomain}/rest/api/3/field`, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const fields = (await res.json()) as any[];
      if (Array.isArray(fields)) {
        const spField = fields.find((f: any) => {
          const name = (f.name || '').trim();
          const isNumeric =
            f.schema?.type === 'number' ||
            f.schema?.custom === 'com.atlassian.jira.plugin.system.customfieldtypes:float';
          const nameMatches =
            /^story points?$|^story point estimate$|^puntos de historia$|^estimaci[oó]n de puntos/i.test(name);
          return isNumeric && nameMatches;
        });

        if (spField?.id) {
          console.log(`[Jira Cloud] Discovered Story Points field: ${spField.id} ("${spField.name}")`);
          jiraStoryPointsFieldCache.set(cleanDomain, spField.id);
          return spField.id;
        }
      }
    }
  } catch (err) {
    console.warn('[Jira Cloud] Error discovering story points field:', err);
  }

  jiraStoryPointsFieldCache.set(cleanDomain, null);
  return null;
}

/**
 * Resolves a human assignee name into an Atlassian accountId
 */
export async function resolveJiraAssigneeAccountId(
  domain: string,
  authHeader: string,
  projectKey: string,
  assigneeName: string,
  knownUsers: any[] = []
): Promise<{ accountId: string; displayName: string } | null> {
  const cleanAssigneeName = (assigneeName || '').replace(/\s*\([^)]*\)/g, '').trim();
  if (!cleanAssigneeName || cleanAssigneeName.toLowerCase() === 'sin asignar') {
    return null;
  }

  // 1. Check known local users list
  const foundLocal = (knownUsers || []).find((u: any) => {
    const dn = (u.displayName || '').toLowerCase();
    const em = (u.emailAddress || '').toLowerCase();
    const query = cleanAssigneeName.toLowerCase();
    return dn === query || dn.includes(query) || query.includes(dn) || em.startsWith(query);
  });

  if (foundLocal?.accountId && !foundLocal.accountId.startsWith('jira-usr-')) {
    return { accountId: foundLocal.accountId, displayName: foundLocal.displayName || cleanAssigneeName };
  }

  // 2. Query Jira Cloud for assignable users in this project
  const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  try {
    const userSearchRes = await fetch(
      `https://${cleanDomain}/rest/api/3/user/assignable/search?project=${encodeURIComponent(projectKey)}&query=${encodeURIComponent(cleanAssigneeName)}`,
      {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      }
    );
    if (userSearchRes.ok) {
      const searchResults = (await userSearchRes.json()) as any[];
      if (Array.isArray(searchResults) && searchResults.length > 0) {
        const exact = searchResults.find(
          (u: any) =>
            u.displayName?.toLowerCase().includes(cleanAssigneeName.toLowerCase()) ||
            cleanAssigneeName.toLowerCase().includes(u.displayName?.toLowerCase())
        );
        const selectedUser = exact || searchResults[0];
        if (selectedUser?.accountId) {
          return { accountId: selectedUser.accountId, displayName: selectedUser.displayName };
        }
      }
    }
  } catch (userErr) {
    console.warn('[Jira Cloud] Error querying assignable users:', userErr);
  }

  return null;
}

/**
 * Creates a native Jira Issue Link between two issues
 */
export async function linkJiraIssuesInCloud(
  domain: string,
  authHeader: string,
  newIssueKey: string,
  sourceIssueKey: string,
  relationType: 'relates' | 'is_blocked_by' | 'blocks' | 'cloners'
): Promise<{ linked: boolean; linkTypeName?: string; warning?: string }> {
  const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  try {
    let linkTypes = jiraIssueLinkTypesCache.get(cleanDomain);
    if (!linkTypes) {
      const typesRes = await fetch(`https://${cleanDomain}/rest/api/3/issueLinkType`, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });
      if (typesRes.ok) {
        const typesData = (await typesRes.json()) as any;
        const fetchedTypes: any[] = Array.isArray(typesData.issueLinkTypes) ? typesData.issueLinkTypes : [];
        linkTypes = fetchedTypes;
        jiraIssueLinkTypesCache.set(cleanDomain, fetchedTypes);
      } else {
        linkTypes = [];
      }
    }

    let chosenTypeName = 'Relates';
    if (linkTypes && linkTypes.length > 0) {
      const findType = (patterns: RegExp[]) =>
        linkTypes!.find((lt: any) =>
          patterns.some(
            (rx) =>
              rx.test(String(lt.name || '')) ||
              rx.test(String(lt.inward || '')) ||
              rx.test(String(lt.outward || ''))
          )
        );

      if (relationType === 'blocks' || relationType === 'is_blocked_by') {
        const found = findType([/block/i, /bloque/i]);
        if (found?.name) chosenTypeName = found.name;
      } else if (relationType === 'cloners') {
        const found = findType([/clon/i]);
        if (found?.name) chosenTypeName = found.name;
      } else {
        const found = findType([/relat/i, /relacion/i]);
        if (found?.name) chosenTypeName = found.name;
      }
    } else {
      chosenTypeName =
        relationType === 'blocks' || relationType === 'is_blocked_by'
          ? 'Blocks'
          : relationType === 'cloners'
          ? 'Cloners'
          : 'Relates';
    }

    let inwardKey = sourceIssueKey;
    let outwardKey = newIssueKey;

    if (relationType === 'is_blocked_by') {
      inwardKey = sourceIssueKey;
      outwardKey = newIssueKey;
    } else if (relationType === 'blocks') {
      inwardKey = newIssueKey;
      outwardKey = sourceIssueKey;
    } else {
      inwardKey = newIssueKey;
      outwardKey = sourceIssueKey;
    }

    const payload = {
      type: { name: chosenTypeName },
      inwardIssue: { key: inwardKey },
      outwardIssue: { key: outwardKey },
    };

    const linkRes = await fetch(`https://${cleanDomain}/rest/api/3/issueLink`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (linkRes.ok || linkRes.status === 201) {
      return { linked: true, linkTypeName: chosenTypeName };
    }

    const errText = await linkRes.text();
    console.warn(`[Jira Issue Link] HTTP ${linkRes.status}:`, errText);
    return {
      linked: false,
      warning: `No se pudo crear el enlace nativo (${chosenTypeName}) con ${sourceIssueKey}: ${errText.slice(0, 150)}`,
    };
  } catch (err: any) {
    console.warn('[Jira Issue Link] Exception:', err);
    return {
      linked: false,
      warning: `Excepción al vincular con ${sourceIssueKey}: ${err.message}`,
    };
  }
}

/**
 * Fetches real or simulated Jira Board issues and scores them by lexical relevance to transcript
 */
export async function fetchBoardContext(
  jiraConfig: any,
  transcriptSnippet: string
): Promise<BoardIssueContext[]> {
  const isSimulation = jiraConfig?.simulationMode !== false;
  const projectKey = (jiraConfig?.projectKey || 'PAY').trim().toUpperCase();

  let candidateIssues: BoardIssueContext[] = [];

  if (!isSimulation && jiraConfig?.domain && jiraConfig?.userEmail && jiraConfig?.apiToken) {
    try {
      const cleanDomain = jiraConfig.domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const authHeader =
        'Basic ' + Buffer.from(`${jiraConfig.userEmail.trim()}:${jiraConfig.apiToken.trim()}`).toString('base64');

      const jqlParts: string[] = [`project = "${projectKey}"`];

      const excludeTypes: string[] =
        Array.isArray(jiraConfig.excludeIssueTypes) && jiraConfig.excludeIssueTypes.length > 0
          ? jiraConfig.excludeIssueTypes
          : ['Epic'];
      if (excludeTypes.length > 0) {
        jqlParts.push(`issuetype NOT IN (${excludeTypes.map((t) => `"${t}"`).join(', ')})`);
      }

      const recentDays = typeof jiraConfig.recentClosedDays === 'number' ? jiraConfig.recentClosedDays : 14;
      if (recentDays > 0) {
        jqlParts.push(`(statusCategory != Done OR (statusCategory = Done AND resolved >= -${recentDays}d))`);
      } else {
        jqlParts.push('statusCategory != Done');
      }

      if (jiraConfig.includeBacklog === false) {
        jqlParts.push('(sprint in openSprints() OR sprint is not EMPTY)');
      }

      if (
        jiraConfig.filterLabelsOrComponents &&
        typeof jiraConfig.filterLabelsOrComponents === 'string' &&
        jiraConfig.filterLabelsOrComponents.trim()
      ) {
        const terms = jiraConfig.filterLabelsOrComponents
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean);
        if (terms.length > 0) {
          jqlParts.push(
            `(labels IN (${terms.map((t: string) => `"${t}"`).join(', ')}) OR component IN (${terms
              .map((t: string) => `"${t}"`)
              .join(', ')}))`
          );
        }
      }

      if (jiraConfig.customJql && typeof jiraConfig.customJql === 'string' && jiraConfig.customJql.trim()) {
        jqlParts.push(`(${jiraConfig.customJql.trim()})`);
      }

      const finalJql = jqlParts.join(' AND ') + ' ORDER BY updated DESC';
      const maxToFetch = Math.min(100, Math.max(20, jiraConfig.maxBoardTicketsForAI || 150));

      let jiraRes = await fetch(`https://${cleanDomain}/rest/api/3/search/jql`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jql: finalJql,
          maxResults: maxToFetch,
          fields: ['summary', 'status', 'issuetype', 'assignee', 'parent', 'priority', 'labels'],
        }),
      });

      if (!jiraRes.ok && jiraRes.status === 405) {
        const getUrl = `https://${cleanDomain}/rest/api/3/search/jql?jql=${encodeURIComponent(
          finalJql
        )}&maxResults=${maxToFetch}&fields=summary,status,issuetype,assignee,parent,priority,labels`;
        jiraRes = await fetch(getUrl, {
          method: 'GET',
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        });
      }

      if (jiraRes.ok) {
        const jiraData = (await jiraRes.json()) as any;
        const issues = Array.isArray(jiraData.issues) ? jiraData.issues : [];

        candidateIssues = issues.map((iss: any) => ({
          key: iss.key,
          summary: iss.fields?.summary || '',
          status: iss.fields?.status?.name || 'In Progress',
          issueType: iss.fields?.issuetype?.name || 'Task',
          assignee: iss.fields?.assignee?.displayName || 'Sin asignar',
          epicKey: iss.fields?.parent?.key,
          priority: iss.fields?.priority?.name,
          labels: Array.isArray(iss.fields?.labels) ? iss.fields.labels : [],
        }));
      } else {
        console.warn(`[Jira Board Context] Search API error ${jiraRes.status}:`, await jiraRes.text());
      }
    } catch (apiErr) {
      console.warn('[Jira Board Context] Failed to query Jira Cloud for board context:', apiErr);
    }
  }

  // Fallback to simulated tickets if empty
  if (candidateIssues.length === 0) {
    candidateIssues = [
      {
        key: `${projectKey}-101`,
        summary: 'Materializar FNC matriz manual en BigQuery',
        status: 'In Progress',
        issueType: 'Story',
        assignee: 'Juan Carlos',
        labels: ['bigquery', 'data'],
      },
      {
        key: `${projectKey}-102`,
        summary: 'DAG CDP_MO integración tablas externas con histórico',
        status: 'Code Review',
        issueType: 'Task',
        assignee: 'Juan Carlos',
        labels: ['airflow', 'dag'],
      },
      {
        key: `${projectKey}-105`,
        summary: 'Translator dataset 20 validación región y snake_case',
        status: 'To Do',
        issueType: 'Task',
        assignee: 'Gabriel',
        labels: ['bigquery', 'translator'],
      },
      {
        key: `${projectKey}-110`,
        summary: 'Diseño de arquitectura de persistencia unificada',
        status: 'In Progress',
        issueType: 'Spike',
        assignee: 'Raúl Morales',
        labels: ['architecture'],
      },
      {
        key: `${projectKey}-115`,
        summary: 'Optimización de latencia en consultas GraphQL',
        status: 'In Progress',
        issueType: 'Story',
        assignee: 'Elena Gómez',
        labels: ['performance'],
      },
    ];
  }

  // Lexical score against transcript snippet
  const snippet = (transcriptSnippet || '').toLowerCase();
  const tokenize = (text: string) =>
    (text.toLowerCase().match(/\b[a-záéíóúüñ0-9_]{3,}\b/g) || []).filter(
      (w) => !['para', 'como', 'este', 'esta', 'todo', 'pero', 'mas', 'más', 'con', 'las', 'los', 'por', 'del', 'que'].includes(w)
    );

  const snippetWords = new Set(tokenize(snippet));

  for (const issue of candidateIssues) {
    let score = 0;
    const keyLower = issue.key.toLowerCase();
    if (snippet.includes(keyLower)) score += 50;

    const summaryWords = tokenize(issue.summary);
    for (const w of summaryWords) {
      if (snippetWords.has(w)) score += 5;
    }

    if (issue.assignee && issue.assignee !== 'Sin asignar') {
      const assigneeWords = tokenize(issue.assignee);
      for (const aw of assigneeWords) {
        if (snippetWords.has(aw)) score += 8;
      }
    }

    issue.score = score;
  }

  return candidateIssues.sort((a, b) => (b.score || 0) - (a.score || 0));
}

export interface ConfluencePublishParams {
  domain: string;
  userEmail: string;
  apiToken: string;
  spaceKey: string;
  pageTitle: string;
  contentHtml: string;
  parentPageId?: string;
}

/**
 * Publishes or updates a meeting minute page in Confluence Cloud (/wiki/rest/api/content)
 */
export async function publishToConfluenceCloud(params: ConfluencePublishParams) {
  const cleanDomain = params.domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const authHeader =
    'Basic ' + Buffer.from(`${params.userEmail.trim()}:${params.apiToken.trim()}`).toString('base64');
  const space = params.spaceKey.trim().toUpperCase();
  const title = params.pageTitle.trim();

  // 1. Check if page already exists with this title in space
  let existingPage: any = null;
  try {
    const searchRes = await fetch(
      `https://${cleanDomain}/wiki/rest/api/content?title=${encodeURIComponent(title)}&spaceKey=${encodeURIComponent(
        space
      )}&expand=version`,
      {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      }
    );
    if (searchRes.ok) {
      const searchData = (await searchRes.json()) as any;
      if (Array.isArray(searchData.results) && searchData.results.length > 0) {
        existingPage = searchData.results[0];
      }
    }
  } catch (searchErr) {
    console.warn('[Confluence Cloud] Error checking existing page:', searchErr);
  }

  if (existingPage?.id) {
    // 2. Update existing page
    const nextVersion = (existingPage.version?.number || 1) + 1;
    const updateRes = await fetch(`https://${cleanDomain}/wiki/rest/api/content/${existingPage.id}`, {
      method: 'PUT',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        id: existingPage.id,
        type: 'page',
        title,
        space: { key: space },
        body: {
          storage: {
            value: params.contentHtml,
            representation: 'storage',
          },
        },
        version: {
          number: nextVersion,
          message: 'Actualizada automáticamente desde ProyectHandler',
        },
      }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`Confluence rechazó la actualización (HTTP ${updateRes.status}): ${errText.slice(0, 250)}`);
    }

    const updatedData = (await updateRes.json()) as any;
    const pageUrl = `https://${cleanDomain}/wiki${
      updatedData._links?.webui || `/spaces/${space}/pages/${updatedData.id}`
    }`;
    return {
      success: true,
      pageId: updatedData.id,
      pageTitle: title,
      spaceKey: space,
      pageUrl,
      publishedAt: new Date().toISOString(),
      message: `Acta actualizada (v${nextVersion}) en Confluence Cloud [${space}].`,
    };
  } else {
    // 3. Create new page
    const payload: any = {
      type: 'page',
      title,
      space: { key: space },
      body: {
        storage: {
          value: params.contentHtml,
          representation: 'storage',
        },
      },
    };

    if (params.parentPageId && String(params.parentPageId).trim()) {
      payload.ancestors = [{ id: String(params.parentPageId).trim() }];
    }

    const createRes = await fetch(`https://${cleanDomain}/wiki/rest/api/content`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Confluence rechazó la creación (HTTP ${createRes.status}): ${errText.slice(0, 250)}`);
    }

    const createdData = (await createRes.json()) as any;
    const pageUrl = `https://${cleanDomain}/wiki${
      createdData._links?.webui || `/spaces/${space}/pages/${createdData.id}`
    }`;
    return {
      success: true,
      pageId: createdData.id,
      pageTitle: title,
      spaceKey: space,
      pageUrl,
      publishedAt: new Date().toISOString(),
      message: `Acta creada exitosamente en Confluence Cloud [${space}].`,
    };
  }
}
