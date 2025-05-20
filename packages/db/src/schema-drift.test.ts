// Why: fails CI when the Drizzle mirror and the migrated schema disagree on columns, types, nullability, defaults or unique constraints.
// Must not: check default values, foreign keys or constraint names; it only covers tables listed in mirroredTables.
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { afterAll, describe, expect, test } from "vitest";
import { consents, users } from "./schema.ts";
import { testDatabaseUrl } from "./testing.ts";

type ColumnShape = { type: string; notNull: boolean; hasDefault: boolean };
type TableShape = {
  columns: Record<string, ColumnShape>;
  uniqueConstraints: string[];
};

const mirroredTables: PgTable[] = [users, consents];
const pool = new Pool({ connectionString: testDatabaseUrl });
afterAll(() => pool.end());

const describeDrizzleTable = (table: PgTable): TableShape => {
  const tableConfig = getTableConfig(table);
  const columns: Record<string, ColumnShape> = {};
  const uniqueConstraints: string[] = [];
  for (const column of tableConfig.columns) {
    columns[column.name] = {
      type: column.getSQLType(),
      notNull: column.notNull,
      hasDefault: column.hasDefault,
    };
    if (column.isUnique) uniqueConstraints.push(column.name);
  }
  for (const constraint of tableConfig.uniqueConstraints) {
    uniqueConstraints.push(
      constraint.columns
        .map((column) => column.name)
        .sort()
        .join(","),
    );
  }
  return { columns, uniqueConstraints: uniqueConstraints.sort() };
};

const describeDatabaseTable = async (
  tableName: string,
): Promise<TableShape> => {
  const columnRows = await pool.query<{
    name: string;
    type: string;
    not_null: boolean;
    has_default: boolean;
  }>(
    `select a.attname as name, format_type(a.atttypid, a.atttypmod) as type,
            a.attnotnull as not_null, a.atthasdef as has_default
       from pg_attribute a
      where a.attrelid = to_regclass($1) and a.attnum > 0 and not a.attisdropped`,
    [tableName],
  );
  const uniqueRows = await pool.query<{ column_list: string }>(
    `select string_agg(a.attname, ',' order by a.attname) as column_list
       from pg_constraint c
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.conrelid = to_regclass($1) and c.contype = 'u'
      group by c.oid`,
    [tableName],
  );
  const columns: Record<string, ColumnShape> = {};
  for (const row of columnRows.rows) {
    columns[row.name] = {
      type: row.type,
      notNull: row.not_null,
      hasDefault: row.has_default,
    };
  }
  return {
    columns,
    uniqueConstraints: uniqueRows.rows.map((row) => row.column_list).sort(),
  };
};

describe("Drizzle mirror matches the migrated database", () => {
  for (const table of mirroredTables) {
    const tableName = getTableConfig(table).name;
    test(tableName, async () => {
      expect(
        await describeDatabaseTable(tableName),
        `table "${tableName}": Expected = Drizzle mirror, Received = migrated database`,
      ).toEqual(describeDrizzleTable(table));
    });
  }
});
