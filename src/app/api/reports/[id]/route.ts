import { NextResponse } from "next/server";
import { getReport } from "../../../../lib/report/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const report = getReport(id);
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  return NextResponse.json(report);
}
