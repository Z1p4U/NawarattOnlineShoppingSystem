import { env } from "cloudflare:workers";
import { getAppUser } from "../../../../lib/app-user";
import { recordAuditLog } from "../../../../lib/audit-log";

type SchemaRow = {
  name: string;
  sql: string | null;
};

const PAGE_SIZE = 1_000;

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function exportFileName(exportedAt: string) {
  const stamp = exportedAt.replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
  return `Nawaratt_Full_DB_Backup_${stamp}_UTC.json`;
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") {
    return Response.json({ error: "Admin သာ Full Database Backup ထုတ်နိုင်ပါသည်" }, { status: 403 });
  }
  if (!env.DB) return Response.json({ error: "Database binding is unavailable" }, { status: 503 });

  try {
    const exportedAt = new Date().toISOString();
    await recordAuditLog(user, {
      action: "full_database_export_requested",
      entityType: "system",
      summary: `Full Database Backup export requested by ${user.displayName}`,
    });

    const schemaResult = await env.DB.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).all<SchemaRow>();
    const schema = (schemaResult.results || []).filter((row) => row.name && !row.name.startsWith("sqlite_"));
    const tables: Record<string, { rowCount: number; rows: Record<string, unknown>[] }> = {};
    let totalRows = 0;

    for (const table of schema) {
      const rows: Record<string, unknown>[] = [];
      let offset = 0;
      while (true) {
        const page = await env.DB.prepare(
          `SELECT * FROM ${quoteIdentifier(table.name)} LIMIT ? OFFSET ?`,
        ).bind(PAGE_SIZE, offset).all<Record<string, unknown>>();
        const pageRows = page.results || [];
        rows.push(...pageRows);
        offset += pageRows.length;
        if (pageRows.length < PAGE_SIZE) break;
      }
      tables[table.name] = { rowCount: rows.length, rows };
      totalRows += rows.length;
    }

    const backup = {
      format: "nawaratt-full-db-backup",
      formatVersion: 1,
      exportedAt,
      timezone: "Asia/Yangon",
      exportedBy: { email: user.email, displayName: user.displayName, role: user.role },
      database: "Cloudflare D1 / SQLite",
      summary: { tableCount: schema.length, totalRows },
      schema: schema.map((table) => ({ table: table.name, createSql: table.sql || "" })),
      tables,
    };

    return new Response(JSON.stringify(backup), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${exportFileName(exportedAt)}"`,
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database export failed";
    return Response.json({ error: message }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
