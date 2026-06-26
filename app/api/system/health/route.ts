import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let databaseHost = "unknown";

  try {
    const databaseUrl = process.env.DATABASE_URL;
    databaseHost = databaseUrl ? new URL(databaseUrl).host : "missing";
  } catch {
    databaseHost = "invalid";
  }

  try {
    const userCount = await prisma.user.count();
    const staffCount = await prisma.staff.count();
    const columns = await prisma.$queryRaw<
      Array<{ table_name: string; column_name: string }>
    >`
      select table_name, column_name
      from information_schema.columns
      where
        (table_name = 'Staff' and column_name in ('expectedSalary', 'monthlySalary'))
        or
        (table_name = 'Setting' and column_name in ('defaultMonthlySalary', 'receiptPrefix'))
      order by table_name, column_name
    `;
    const migrations = await prisma.$queryRaw<
      Array<{ migration_name: string; finished_at: Date | null }>
    >`
      select migration_name, finished_at
      from _prisma_migrations
      order by finished_at desc nulls last
      limit 8
    `;

    return NextResponse.json({
      ok: true,
      databaseHost,
      counts: {
        users: userCount,
        staff: staffCount,
      },
      columns,
      recentMigrations: migrations.map((migration) => ({
        migrationName: migration.migration_name,
        finishedAt: migration.finished_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        databaseHost,
        error: error instanceof Error ? error.message : "Unknown database error",
      },
      { status: 500 }
    );
  }
}
