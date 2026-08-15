import { prisma } from "@/lib/prisma";
import { getPageContent } from "@/server/admin/content";
import { getRegions } from "@/server/admin/regions";
import { ALL_REGIONS } from "@/lib/regions";
import { MatrixPageClient } from "@/components/tables/MatrixPageClient";

export const revalidate = 60; // страница кэшируется на 60 сек

// Лимит выдачи на страницу матрицы: фильтры уточняются в URL,
// при превышении показываем уведомление «уточните фильтры»
const MATRIX_CAP = 200;

const SORTS: Record<string, string> = {
  price_asc: `(p.price IS NULL), p.price ASC`,
  price_desc: `(p.price IS NULL), p.price DESC`,
  name: `lower(p.name) ASC`,
  rating: `COALESCE(cr.rating, 0) DESC`,
};

export default async function MatrixPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const q = (get("q") || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const productClass = get("class") || "";
  const region = (get("region") || "").split(",").filter(Boolean);
  const classifier = (get("classifier") || "").split(",").filter(Boolean);
  const sort = SORTS[get("sort") || ""] ? get("sort")! : "rating";

  const pageContent = await getPageContent("matrix");
  const regions = await getRegions();

  const treeItems = await prisma.productTreeItem.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, fullNumberPath: true },
    orderBy: { fullNumberPath: "asc" },
  });

  // Фильтры, поиск, сортировка и лимит — в БД (сырой SQL совместим
  // с SQLite и Postgres). Рейтинг компаний — агрегат, не все отзывы.
  const values: (string | number)[] = [];
  const push = (v: string | number) => {
    values.push(v);
    return "?";
  };

  const where: string[] = [`p."deletedAt" IS NULL`, `t."deletedAt" IS NULL`];
  for (const token of q) {
    const like = `%${token}%`;
    where.push(`(lower(p.name) LIKE ${push(like)} OR lower(c.name) LIKE ${push(like)})`);
  }
  if (productClass) {
    where.push(`p.classes LIKE ${push(`%"${productClass}"%`)}`);
  }
  // «Все регионы» в фильтре означает «без ограничения по региону»
  if (region.length > 0 && !region.includes(ALL_REGIONS)) {
    const conds: string[] = [];
    for (const r of region) {
      conds.push(`(',' || COALESCE(p."regions", '') || ',') LIKE ${push(`%,${r},%`)}`);
    }
    // Товар с «Все регионы» подходит под любой выбранный регион
    conds.push(`(',' || COALESCE(p."regions", '') || ',') LIKE ${push(`%,${ALL_REGIONS},%`)}`);
    // Товар без указанного региона показывается при любом фильтре
    conds.push(`COALESCE(p."regions", '') = ''`);
    where.push(`(${conds.join(" OR ")})`);
  }
  if (classifier.length > 0) {
    // classifier — id узлов дерева (надёжнее путей: переживает перенумерацию)
    where.push(`t.id IN (${classifier.map(() => "?").join(", ")})`);
    classifier.forEach((c) => values.push(c));
  }

  const base = `
    FROM products p
    JOIN companies c ON c.id = p."companyId"
    JOIN product_tree_items t ON t.id = p."treeItemId"
    LEFT JOIN (
      SELECT "companyId", AVG("weightedAverage") AS rating
      FROM reviews WHERE "companyId" IS NOT NULL GROUP BY "companyId"
    ) cr ON cr."companyId" = c.id
    WHERE ${where.join(" AND ")}`;

  const selectSql = `
    SELECT p.id, p.name, p.classes, p."regions", p."imageUrl", p.unit, p.characteristics,
      p.price, p.views, p."companyId",
      c.name AS "companyName", c.inn AS "companyInn", c.phone AS "companyPhone", c.email AS "companyEmail",
      t."fullNumberPath" AS "treeItemPath", t.name AS "treeItemName",
      cr.rating AS rating
    ${base}
    ORDER BY ${SORTS[sort]}
    LIMIT ${MATRIX_CAP}`;

  const [countRows, rawRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ cnt: number | bigint }[]>(`SELECT COUNT(*) AS cnt ${base}`, ...values),
    prisma.$queryRawUnsafe(selectSql, ...values),
  ]);

  const total = Number(countRows[0]?.cnt ?? 0);

  type RawProduct = {
    id: string;
    name: string;
    classes: string;
    regions: string;
    imageUrl: string | null;
    unit: string | null;
    characteristics: string;
    price: number | null;
    views: number;
    companyId: string;
    companyName: string;
    companyInn: string;
    companyPhone: string | null;
    companyEmail: string | null;
    treeItemPath: string;
    treeItemName: string;
    rating: number | null;
  };

  const products = (rawRows as RawProduct[]).map((p) => ({
    id: p.id,
    companyName: p.companyName,
    companyInn: p.companyInn,
    companyId: p.companyId,
    name: p.name,
    classes: parseJsonArray(p.classes),
    regions: p.regions ? p.regions.split(",").map((r) => r.trim()).filter(Boolean) : [],
    imageUrl: p.imageUrl,
    unit: p.unit,
    characteristics: parseJsonArray(p.characteristics),
    price: p.price,
    views: p.views,
    treeItemPath: p.treeItemPath,
    treeItemName: p.treeItemName,
    // Рейтинг — одна цифра после запятой (как раньше делал computeRating)
    companyRating: p.rating !== null ? Math.round(p.rating * 10) / 10 : null,
    companyPhone: p.companyPhone,
    companyEmail: p.companyEmail,
  }));

  return (
    <MatrixPageClient
      products={products}
      total={total}
      capped={products.length >= MATRIX_CAP}
      treeItems={treeItems}
      regions={regions.map((r) => r.name)}
      moderatorText={pageContent?.content || null}
      pageTitle={pageContent?.title || null}
      bannerUrl={pageContent?.bannerUrl || null}
      initialQuery={{
        q: get("q") || "",
        class: productClass,
        region: region.join(","),
        classifier: classifier.join(","),
        sort,
      }}
    />
  );
}

function parseJsonArray(val: string): string[] {
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
