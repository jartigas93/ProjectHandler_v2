/**
 * Pure ADF (Atlassian Document Format) builders for Jira descriptions and comments
 */

export interface AdfDoc {
  type: 'doc';
  version: 1;
  content: any[];
}

/**
 * Builds an ADF document for an Issue description, incorporating technical context
 * and a formatted acceptance criteria bullet list.
 */
export function buildIssueDescriptionAdf(
  description: string = '',
  technicalContext: string = '',
  acceptanceCriteria: string[] = [],
  fallbackTitle: string = 'Generado desde ProyectHandler'
): AdfDoc {
  const descContent: any[] = [];
  const mainDesc = (description || '').trim();
  if (mainDesc) {
    descContent.push({
      type: 'paragraph',
      content: [{ type: 'text', text: mainDesc }],
    });
  }

  const techContext = (technicalContext || '').trim();
  if (techContext) {
    descContent.push({
      type: 'paragraph',
      content: [{ type: 'text', text: `Contexto Reunión Teams:\n${techContext}` }],
    });
  }

  const criteria = Array.isArray(acceptanceCriteria)
    ? acceptanceCriteria.map((crit) => String(crit).trim()).filter(Boolean)
    : [];

  if (criteria.length > 0) {
    descContent.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Criterios de Aceptación' }],
    });
    descContent.push({
      type: 'bulletList',
      content: criteria.map((crit) => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: crit }] }],
      })),
    });
  }

  if (descContent.length === 0) {
    descContent.push({
      type: 'paragraph',
      content: [{ type: 'text', text: fallbackTitle }],
    });
  }

  return {
    type: 'doc',
    version: 1,
    content: descContent,
  };
}

/**
 * Builds an ADF document for Jira comments, parsing markdown-like paragraphs
 * and criteria lists into formatted nodes.
 */
export function buildCommentAdf(rawComment: string): { body: AdfDoc } {
  const lines = (rawComment || '').split(/\r?\n/);
  const contentNodes: any[] = [];
  let inCriteriaList = false;
  let criteriaItems: string[] = [];
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      contentNodes.push({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: currentParagraphLines.join('\n'),
          },
        ],
      });
      currentParagraphLines = [];
    }
  };

  const flushCriteriaList = () => {
    if (criteriaItems.length > 0) {
      contentNodes.push({
        type: 'bulletList',
        content: criteriaItems.map((itemText) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: itemText }],
            },
          ],
        })),
      });
      criteriaItems = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (/^criterios de aceptaci[oó]n/i.test(trimmed)) {
      flushParagraph();
      flushCriteriaList();
      contentNodes.push({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: trimmed,
            marks: [{ type: 'strong' }],
          },
        ],
      });
      inCriteriaList = true;
      continue;
    }

    if (inCriteriaList) {
      const cleanCriterion = trimmed.replace(/^[-*•\d+.\s]+/, '').trim() || trimmed;
      criteriaItems.push(cleanCriterion);
    } else {
      currentParagraphLines.push(trimmed);
    }
  }

  flushParagraph();
  flushCriteriaList();

  if (contentNodes.length === 0) {
    contentNodes.push({
      type: 'paragraph',
      content: [{ type: 'text', text: rawComment || '' }],
    });
  }

  return {
    body: {
      type: 'doc',
      version: 1,
      content: contentNodes,
    },
  };
}

