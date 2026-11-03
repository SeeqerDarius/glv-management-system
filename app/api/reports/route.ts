import { NextRequest } from "next/server";
import { GET as handleReportExport } from "./weekly-export/route";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleReportExport(request);
}
