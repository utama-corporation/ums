/**
 * Minimal, purpose-built parser for `mysqldump`/phpMyAdmin-style dump files: it only
 * understands `INSERT INTO \`table\` (\`col\`, ...) VALUES (...), (...), ...;` statements,
 * with MySQL's default backslash-escaped single-quoted string literals. It deliberately does
 * not attempt to parse general SQL (DDL, expressions, functions) — the legacy UMS dump has
 * a fixed, known shape, and a full SQL grammar is unnecessary risk/weight for a one-off
 * migration script.
 */

export type SqlValue = string | number | null;

export interface ParsedInsert {
  columns: string[];
  rows: SqlValue[][];
}

function parseQuotedString(sql: string, start: number): { value: string; nextIndex: number } {
  // `start` points at the opening quote.
  let i = start + 1;
  let out = "";
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "\\") {
      const next = sql[i + 1];
      switch (next) {
        case "'":
          out += "'";
          break;
        case '"':
          out += '"';
          break;
        case "\\":
          out += "\\";
          break;
        case "n":
          out += "\n";
          break;
        case "r":
          out += "\r";
          break;
        case "t":
          out += "\t";
          break;
        case "0":
          out += "\0";
          break;
        case "Z":
          out += "\x1a";
          break;
        default:
          out += next ?? "";
      }
      i += 2;
      continue;
    }
    if (ch === "'") {
      // Could be the closing quote, or an escaped '' (doubled-quote) — mysqldump's default
      // NO_BACKSLASH_ESCAPES-off mode uses backslash escaping, not doubling, but doubled
      // quotes are handled defensively here too in case the dump was produced differently.
      if (sql[i + 1] === "'") {
        out += "'";
        i += 2;
        continue;
      }
      return { value: out, nextIndex: i + 1 };
    }
    out += ch;
    i++;
  }
  throw new Error(`Unterminated string literal starting at index ${start}`);
}

function parseValue(sql: string, start: number): { value: SqlValue; nextIndex: number } {
  let i = start;
  while (i < sql.length && /\s/.test(sql[i]!)) i++;

  if (sql[i] === "'") {
    const { value, nextIndex } = parseQuotedString(sql, i);
    return { value, nextIndex };
  }

  if (sql.startsWith("NULL", i)) {
    return { value: null, nextIndex: i + 4 };
  }

  // Bare literal: number or unquoted token. Read until a delimiter.
  let j = i;
  while (j < sql.length && sql[j] !== "," && sql[j] !== ")") j++;
  const raw = sql.slice(i, j).trim();
  if (raw === "") {
    throw new Error(`Empty bare value at index ${i}`);
  }
  const asNumber = Number(raw);
  return { value: Number.isNaN(asNumber) ? raw : asNumber, nextIndex: j };
}

function parseTuple(sql: string, start: number): { values: SqlValue[]; nextIndex: number } {
  let i = start;
  while (i < sql.length && /\s/.test(sql[i]!)) i++;
  if (sql[i] !== "(") {
    throw new Error(`Expected '(' at index ${i}, got '${sql[i]}'`);
  }
  i++;

  const values: SqlValue[] = [];
  for (;;) {
    const { value, nextIndex } = parseValue(sql, i);
    values.push(value);
    i = nextIndex;
    while (i < sql.length && /\s/.test(sql[i]!)) i++;
    if (sql[i] === ",") {
      i++;
      continue;
    }
    if (sql[i] === ")") {
      i++;
      break;
    }
    throw new Error(`Expected ',' or ')' at index ${i}, got '${sql[i]}'`);
  }

  return { values, nextIndex: i };
}

/**
 * Extracts every row from every `INSERT INTO \`tableName\` (...) VALUES (...), (...), ...;`
 * statement found in the dump (a table's data is normally a single INSERT, but this handles
 * multiple statements for the same table defensively).
 */
export function parseInsertRows(sql: string, tableName: string): ParsedInsert {
  const stmtRe = new RegExp(`INSERT INTO \`${tableName}\`\\s*\\(([^)]+)\\)\\s*VALUES`, "g");
  let columns: string[] | null = null;
  const rows: SqlValue[][] = [];

  let match: RegExpExecArray | null;
  while ((match = stmtRe.exec(sql)) !== null) {
    const cols = match[1]!.split(",").map((c) => c.trim().replace(/^`|`$/g, ""));
    if (columns && JSON.stringify(columns) !== JSON.stringify(cols)) {
      throw new Error(`Column list mismatch across INSERT statements for table \`${tableName}\``);
    }
    columns = cols;

    let i = stmtRe.lastIndex;
    for (;;) {
      while (i < sql.length && /\s/.test(sql[i]!)) i++;
      if (sql[i] !== "(") break;
      const { values, nextIndex } = parseTuple(sql, i);
      if (values.length !== cols.length) {
        throw new Error(
          `Row has ${values.length} values but table \`${tableName}\` expects ${cols.length} columns (near index ${i})`
        );
      }
      rows.push(values);
      i = nextIndex;
      while (i < sql.length && /\s/.test(sql[i]!)) i++;
      if (sql[i] === ",") {
        i++;
        continue;
      }
      if (sql[i] === ";") break;
      throw new Error(`Expected ',' or ';' after row at index ${i}, got '${sql[i]}'`);
    }
    stmtRe.lastIndex = i;
  }

  if (!columns) {
    return { columns: [], rows: [] };
  }
  return { columns, rows };
}

/** Zips a ParsedInsert's rows into keyed record objects for readability at call sites. */
export function rowsToObjects(parsed: ParsedInsert): Record<string, SqlValue>[] {
  return parsed.rows.map((row) => {
    const obj: Record<string, SqlValue> = {};
    parsed.columns.forEach((col, idx) => {
      obj[col] = row[idx] ?? null;
    });
    return obj;
  });
}
