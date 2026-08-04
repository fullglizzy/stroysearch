import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: { include: { roles: true } },
    },
  });

  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const body = await request.json();

  const {
    firstName,
    lastName,
    middleName,
    phone,
    region,
    isContactsHidden,
    roles,
    classifierIds,
  } = body;

  await prisma.user.update({
    where: { id: userId },
    data: {
      phone,
    },
  });

  await prisma.userProfile.upsert({
    where: { userId },
    update: {
      firstName,
      lastName,
      middleName,
      region,
      isContactsHidden,
      classifierIds: Array.isArray(classifierIds) ? classifierIds.join(",") : (classifierIds || ""),
    },
    create: {
      userId,
      firstName,
      lastName,
      middleName,
      region,
      isContactsHidden,
      classifierIds: Array.isArray(classifierIds) ? classifierIds.join(",") : (classifierIds || ""),
    },
  });

  // Update roles
  if (roles && Array.isArray(roles)) {
    await prisma.userProfileRole.deleteMany({
      where: { profileId: userId },
    });

    if (roles.length > 0) {
      await prisma.userProfileRole.createMany({
        data: roles.map((role: string) => ({
          profileId: userId,
          role: role as any,
        })),
      });
    }
  }

  return NextResponse.json({ success: true });
}
