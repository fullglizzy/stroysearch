import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const body = await request.json();
  const { field } = body;

  const update: Record<string, { increment: number }> = {};

  if (field === "phone") update.phoneViews = { increment: 1 };
  else if (field === "email") update.emailViews = { increment: 1 };
  else if (field === "website") update.websiteViews = { increment: 1 };
  else if (field === "rating") update.ratingViews = { increment: 1 };
  else if (field === "reviews") update.reviewsViews = { increment: 1 };

  if (Object.keys(update).length > 0) {
    await prisma.companyMetrics.upsert({
      where: { companyId },
      update,
      create: { companyId, ...Object.fromEntries(
        Object.entries(update).map(([k, v]) => [k, v.increment])
      ) },
    });
  }

  return NextResponse.json({ success: true });
}
