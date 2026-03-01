'use client';

import React from 'react';
import DOMPurify from 'dompurify';

export type ReadingFormat = 'plain' | 'markdown' | 'html';

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'mark', 'span'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'aria-hidden', 'style'],
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Obsidian/Notion-style markdown: headings, bold, italic, strikethrough, highlight,
 * links, lists, task lists (- [ ] / - [x]), blockquotes, tables, code, horizontal rules.
 */
function simpleMarkdownToHtml(text: string): string {
  // Extract fenced code blocks first (before escaping)
  const codeBlocks: string[] = [];
  let rest = text.replace(/^```[\s\S]*?^```/gm, (block) => {
    const code = block.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
    codeBlocks.push('<pre><code>' + escapeHtml(code) + '</code></pre>');
    return '\x00CODE' + (codeBlocks.length - 1) + '\x00';
  });
  rest = escapeHtml(rest);
  rest = rest.replace(/\x00CODE(\d+)\x00/g, (_, n) => codeBlocks[parseInt(n, 10)] || '');

  let html = rest;
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Headings (at line start) — explicit sizes so # count clearly changes appearance
  html = html.replace(/^###### (.+)$/gm, '<h6 class="text-sm font-bold mt-3 mb-1">$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5 class="text-base font-bold mt-3 mb-1">$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-lg font-bold mt-4 mb-2">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-5 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mt-6 mb-3">$1</h1>');
  // Strikethrough ~~text~~ (Obsidian/Notion)
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
  // Highlight ==text== (Obsidian)
  html = html.replace(/==(.+?)==/g, '<mark>$1</mark>');
  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  const lines = html.split('\n');
  const blocks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Horizontal rule --- or ***
    if (/^(\s*[-*_]){3,}\s*$/.test(line) || line.trim() === '---' || line.trim() === '***') {
      blocks.push('<hr/>');
      i += 1;
      continue;
    }
    if (/^<[h1-6]/.test(line) || line.startsWith('<pre>')) {
      blocks.push(line);
      i += 1;
      continue;
    }
    // Blockquote > or >> (escaped as &gt;)
    if (line.startsWith('&gt;') || line.startsWith('>')) {
      const bqLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith('&gt;') || lines[i].startsWith('>'))) {
        bqLines.push(lines[i].replace(/^(&gt;|>)+\s?/, ''));
        i += 1;
      }
      blocks.push('<blockquote>' + bqLines.join('<br/>') + '</blockquote>');
      continue;
    }
    // Table | a | b |
    if (line.includes('|') && /^\|.+\|$/.test(line.trim())) {
      const tableRows: string[] = [];
      while (i < lines.length && lines[i].includes('|') && /^\|.+\|$/.test(lines[i].trim())) {
        tableRows.push(lines[i].trim());
        i += 1;
      }
      const sepIndex = tableRows.findIndex((r) => /^\|[\s\-:|]+\|$/.test(r));
      const headerRow = tableRows[0];
      const bodyRows = sepIndex >= 0 ? tableRows.slice(sepIndex + 1) : tableRows.slice(1);
      const cells = (row: string) => row.split('|').slice(1, -1).map((c) => c.trim());
      const toCell = (cell: string, tag: string) => '<' + tag + '>' + cell + '</' + tag + '>';
      let tableHtml = '<table><thead><tr>';
      cells(headerRow).forEach((c) => { tableHtml += toCell(c, 'th'); });
      tableHtml += '</tr></thead><tbody>';
      bodyRows.forEach((row) => {
        tableHtml += '<tr>';
        cells(row).forEach((c) => { tableHtml += toCell(c, 'td'); });
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody></table>';
      blocks.push(tableHtml);
      continue;
    }
    // Task list - [ ] / - [x] and normal lists
    if (/^[-*] \[( |x)\]\s/.test(line) || /^[-*] /.test(line) || /^\d+\. /.test(line)) {
      const tag = /^\d+\. /.test(line) ? 'ol' : 'ul';
      const taskClass = /^[-*] \[( |x)\]\s/.test(line) ? ' class="task-list"' : '';
      const list: string[] = [];
      while (i < lines.length && (/^[-*] \[( |x)\]\s/.test(lines[i]) || /^[-*] /.test(lines[i]) || /^\d+\. /.test(lines[i]))) {
        const raw = lines[i];
        let content: string;
        let prefix = '';
        if (/^[-*] \[x\]\s/.test(raw)) {
          content = raw.replace(/^[-*] \[x\]\s/, '');
          prefix = '<span class="task-checkbox" aria-hidden="true">☑</span> ';
        } else if (/^[-*] \[ \]\s/.test(raw)) {
          content = raw.replace(/^[-*] \[ \]\s/, '');
          prefix = '<span class="task-checkbox" aria-hidden="true">☐</span> ';
        } else {
          content = raw.replace(/^[-*] /, '').replace(/^\d+\. /, '');
        }
        list.push('<li>' + prefix + content + '</li>');
        i += 1;
      }
      blocks.push('<' + tag + taskClass + '>' + list.join('') + '</' + tag + '>');
      continue;
    }
    if (line.trim() === '') {
      blocks.push('<br/>');
      i += 1;
    } else {
      blocks.push('<p>' + line + '</p>');
      i += 1;
    }
  }
  return blocks.join('\n');
}

interface ReadingContentRendererProps {
  body: string;
  format?: ReadingFormat | null;
  className?: string;
}

/**
 * Renders reading material body as plain text, Markdown, or sanitized HTML.
 */
export function ReadingContentRenderer({ body, format = 'plain', className = '' }: ReadingContentRendererProps) {
  const effectiveFormat = format ?? 'plain';

  if (effectiveFormat === 'markdown') {
    if (typeof window === 'undefined') {
      return <div className={`whitespace-pre-wrap ${className}`}>{body}</div>;
    }
    const rawHtml = simpleMarkdownToHtml(body);
    const sanitized = DOMPurify.sanitize(rawHtml, SANITIZE_OPTIONS);
    return (
      <div
        className={`prose prose-sm max-w-none dark:prose-invert ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  if (effectiveFormat === 'html') {
    if (typeof window === 'undefined') {
      return <div className={`whitespace-pre-wrap ${className}`}>{body}</div>;
    }
    const sanitized = DOMPurify.sanitize(body, SANITIZE_OPTIONS);
    return (
      <div
        className={`prose prose-sm max-w-none dark:prose-invert ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  return (
    <div className={`whitespace-pre-wrap ${className}`}>
      {body}
    </div>
  );
}
