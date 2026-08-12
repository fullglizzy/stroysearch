import { prisma } from "@/lib/prisma";
import { getPageContent } from "@/server/admin/content";
import { LibraryPageClient } from "@/components/tables/LibraryPageClient";

// Страница кэшируется; персональные данные (купленные документы)
// клиент догружает через /api/library/purchased
export const revalidate = 60;

const PAGE_SIZE = 20;

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const q = (get("q") || "").trim();
  const classifier = (get("classifier") || "").split(",").filter(Boolean);
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);

  const pageContent = await getPageContent("library");

  const treeItems = await prisma.productTreeItem.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, fullNumberPath: true },
  });

  // Параметры только для WHERE; LIMIT/OFFSET подставляются отдельно
  const whereValues: (string | number)[] = [];
  const push = (v: string | number) => {
    whereValues.push(v);
    return "?";
  };

  const where: string[] = [`d."isApproved" IS TRUE`, `d."deletedAt" IS NULL`];
  if (q) {
    where.push(`lower(d.title) LIKE ${push(`%${q.toLowerCase()}%`)}`);
  }
  if (classifier.length > 0) {
    where.push(`t."fullNumberPath" IN (${classifier.map(() => "?").join(", ")})`);
    classifier.forEach((c) => whereValues.push(c));
  }

  const base = `
    FROM library_documents d
    LEFT JOIN users u ON u.id = d."userId"
    LEFT JOIN user_profiles pr ON pr."userId" = d."userId"
    LEFT JOIN product_tree_items t ON t.id = d."treeItemId"
    WHERE ${where.join(" AND ")}`;

  const countSql = `SELECT COUNT(*) AS cnt ${base}`;
  const selectSql = `
    SELECT d.id, d.title, d."coinPrice", d."fileUrl", d."fileSize", d.views,
      d."purchasesCount", COALESCE(pr.nick, u.username) AS "uploaderName",
      t."fullNumberPath" AS "treeItemPath", t.name AS "treeItemName"
    ${base}
    ORDER BY d."createdAt" DESC
    LIMIT ? OFFSET ?`;

  const [countRows, rawRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ cnt: number | bigint }[]>(countSql, ...whereValues),
    prisma.$queryRawUnsafe(selectSql, ...whereValues, PAGE_SIZE, (page - 1) * PAGE_SIZE),
  ]);

  const total = Number(countRows[0]?.cnt ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  type RawDoc = {
    id: string;
    title: string;
    coinPrice: number;
    fileUrl: string;
    fileSize: number;
    views: number;
    purchasesCount: number;
    uploaderName: string | null;
    treeItemPath: string | null;
    treeItemName: string | null;
  };

  const docs = (rawRows as RawDoc[]).map((d) => ({
    id: d.id,
    title: d.title,
    treeItemPath: d.treeItemPath,
    treeItemName: d.treeItemName,
    coinPrice: d.coinPrice,
    uploaderName: d.uploaderName || "—",
    fileSize: d.fileSize,
    fileUrl: d.fileUrl,
    views: d.views,
    purchasesCount: d.purchasesCount,
  }));

  return (
    <LibraryPageClient
      documents={docs}
      total={total}
      page={page}
      totalPages={totalPages}
      treeItems={treeItems}
      moderatorText={pageContent?.content || null}
      pageTitle={pageContent?.title || null}
      bannerUrl={pageContent?.bannerUrl || null}
      initialQuery={{ q, classifier: classifier.join(",") }}
    />
  );
}
