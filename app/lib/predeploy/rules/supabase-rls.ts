/**
 * FAIL: tables without RLS; anon write policies that are open.
 * INFO: `.from('x')` with no matching migration (RLS unverifiable from files).
 */

import { isClientPath, isSqlPath, linesOf, makeFinding } from '~/lib/predeploy/helpers';
import type { Finding, PredeployRule } from '~/lib/predeploy/types';

const CREATE_TABLE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?["']?([a-zA-Z_][\w]*)["']?/gi;

const ENABLE_RLS =
  /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?["']?([a-zA-Z_][\w]*)["']?\s+enable\s+row\s+level\s+security/gi;

const FROM_TABLE = /\.from\(\s*['"]([a-zA-Z_][\w]*)['"]\s*\)/g;

function tableNames(content: string, regex: RegExp): { name: string; line: number }[] {
  const found: { name: string; line: number }[] = [];
  const lines = linesOf(content);

  for (let index = 0; index < lines.length; index += 1) {
    const clone = new RegExp(regex.source, regex.flags);

    let match: RegExpExecArray | null;

    while ((match = clone.exec(lines[index] ?? ''))) {
      found.push({ name: match[1], line: index + 1 });
    }
  }

  return found;
}

export const supabaseRlsMissingRule: PredeployRule = {
  id: 'supabase-rls-missing',
  severity: 'FAIL',
  heuristic: false,
  run(files) {
    const enabled = new Set<string>();
    const created: { file: string; name: string; line: number }[] = [];

    for (const [file, content] of Object.entries(files)) {
      if (!isSqlPath(file)) {
        continue;
      }

      for (const row of tableNames(content, ENABLE_RLS)) {
        enabled.add(row.name.toLowerCase());
      }

      for (const row of tableNames(content, CREATE_TABLE)) {
        created.push({ file, name: row.name, line: row.line });
      }
    }

    return created
      .filter((row) => !enabled.has(row.name.toLowerCase()))
      .map((row) =>
        makeFinding(supabaseRlsMissingRule, {
          file: row.file,
          line: row.line,
          maskedSnippet: `CREATE TABLE ${row.name}`,
          why: `Table ${row.name} is created without ENABLE ROW LEVEL SECURITY.`,
          fix: `Add ALTER TABLE ${row.name} ENABLE ROW LEVEL SECURITY; plus policies that restrict anon writes.`,
        }),
      );
  },
};

export const supabaseRlsOpenRule: PredeployRule = {
  id: 'supabase-rls-open',
  severity: 'FAIL',
  heuristic: false,
  run(files) {
    const findings: Finding[] = [];

    for (const [file, content] of Object.entries(files)) {
      if (!isSqlPath(file) && !/\.sql$/i.test(file)) {
        continue;
      }

      const lines = linesOf(content);

      for (let index = 0; index < lines.length; index += 1) {
        const text = lines[index] ?? '';

        const openWrite =
          /create\s+policy/i.test(text) &&
          /\b(anon|public)\b/i.test(text) &&
          /(?:for\s+(?:all|insert|update|delete)|with\s+check)/i.test(text) &&
          /(?:using|with\s+check)\s*\(\s*true\s*\)/i.test(text);

        if (!openWrite) {
          continue;
        }

        findings.push(
          makeFinding(supabaseRlsOpenRule, {
            file,
            line: index + 1,
            maskedSnippet: text.trim().slice(0, 160),
            why: 'An RLS policy lets anonymous clients write with USING/WITH CHECK (true).',
            fix: 'Restrict the policy to authenticated users and a real row check, not `true`.',
          }),
        );
      }
    }

    return findings;
  },
};

export const supabaseRlsUnverifiedRule: PredeployRule = {
  id: 'supabase-rls-unverified',
  severity: 'INFO',
  heuristic: true,
  run(files) {
    const migrated = new Set<string>();

    for (const [file, content] of Object.entries(files)) {
      if (!isSqlPath(file)) {
        continue;
      }

      for (const row of tableNames(content, CREATE_TABLE)) {
        migrated.add(row.name.toLowerCase());
      }
    }

    const seen = new Set<string>();
    const findings: Finding[] = [];

    for (const [file, content] of Object.entries(files)) {
      if (!isClientPath(file, content) && !/\.(ts|tsx|js|jsx)$/i.test(file)) {
        continue;
      }

      const clone = new RegExp(FROM_TABLE.source, FROM_TABLE.flags);

      let match: RegExpExecArray | null;

      while ((match = clone.exec(content))) {
        const table = match[1].toLowerCase();
        const key = `${file}:${table}`;

        if (migrated.has(table) || seen.has(key)) {
          continue;
        }

        seen.add(key);

        const line = content.slice(0, match.index).split('\n').length;
        findings.push(
          makeFinding(supabaseRlsUnverifiedRule, {
            file,
            line,
            maskedSnippet: match[0],
            why: "Couldn't verify RLS from the files. Check Authentication > Policies in your Supabase dashboard (30 seconds)",
            fix: 'Open Authentication > Policies in the Supabase dashboard, or add a migration that creates the table and enables RLS.',
          }),
        );
      }
    }

    return findings;
  },
};
