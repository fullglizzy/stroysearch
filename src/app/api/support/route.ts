import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supportTicketSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = supportTicketSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        email: parsed.data.email,
        subject: parsed.data.subject,
        message: parsed.data.message,
      },
    });

    return NextResponse.json({ success: true, id: ticket.id });
  } catch (error) {
    console.error("Support ticket error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 },
    );
  }
}
