import { prisma } from "@/lib/prisma";
import { SuppliersPageClient } from "@/components/tables/SuppliersPageClient";
import { getPageContent } from "@/server/admin/content";
import { getRegions } from "@/server/admin/regions";

export const revalidate = 60; // страница кэшируется на 60 сек

const PAGE_SIZE = 20;

// Один общий SQL для компаний и участников: фильтры, сортировка и пагинация
// выполняются в БД, а не на клиенте. Рейтинг считается агрегатом (CTE), а не
// загрузкой всех отзывов каждой компании.
function buildCombinedQuery(params: {
  q: string[];
  region: string[];
  classifier: string[];
  type: "all" | "company" | "participant";
  sort: "name" | "rating";
  dir: "asc" | "desc";
  limit: number;
  offset: number;
  countOnly?: boolean;
}) {
  const { q, region, classifier, type, sort, dir, limit, offset, countOnly } = params;
  const values: (string | number)[] = [];
  const push = (v: string | number) => {
    values.push(v);
    return `?`;
  };

  const companySelect = `
    SELECT c.id, 'company' AS kind, c.inn, c.name, c.phone, c.email, c.website, c.region,
      COALESCE(pr.nick, NULL) AS "ownerNick",
      COALESCE(c."ownerUserId", '') AS "roleUserId",
      COALESCE(c."classifierIds", '') AS "classifierIds",
      cr.rating AS rating, COALESCE(cr.cnt, 0) AS "reviewCount"
    FROM companies c
    LEFT JOIN users ou ON ou.id = c."ownerUserId"
    LEFT JOIN user_profiles pr ON pr."userId" = ou.id
    LEFT JOIN company_rating cr ON cr."companyId" = c.id`;

  const participantSelect = `
    SELECT u.id, 'participant' AS kind, NULL AS inn,
      CASE WHEN TRIM(COALESCE(pr2."firstName", '') || ' ' || COALESCE(pr2."lastName", '')) = ''
        THEN u.username
        ELSE TRIM(COALESCE(pr2."firstName", '') || ' ' || COALESCE(pr2."lastName", ''))
      END AS name,
      u.phone, u.email, NULL AS website, pr2.region,
      COALESCE(pr2.nick, u.username) AS "ownerNick",
      u.id AS "roleUserId",
      COALESCE(pr2."classifierIds", '') AS "classifierIds",
      ur.rating AS rating, COALESCE(ur.cnt, 0) AS "reviewCount"
    FROM users u
    LEFT JOIN user_profiles pr2 ON pr2."userId" = u.id
    LEFT JOIN user_rating ur ON ur."targetId" = u.id
    WHERE u.status = 'ACTIVE' AND u.type = 'COMMON'`;

  const union =
    type === "company"
      ? companySelect
      : type === "participant"
        ? participantSelect
        : `${companySelect} UNION ALL ${participantSelect}`;

  const where: string[] = [];
  for (const token of q) {
    const like = `%${token.toLowerCase()}%`;
    const cols = [
      "name",
      `COALESCE(inn, '')`,
      `COALESCE("ownerNick", '')`,
      `COALESCE(phone, '')`,
      `COALESCE(email, '')`,
      `COALESCE(website, '')`,
      `COALESCE(region, '')`,
    ];
    const parts = cols.map((col) => `lower(${col}) LIKE ${push(like)}`);
    where.push(`(${parts.join(" OR ")})`);
  }
  if (region.length > 0) {
    where.push(`region IN (${region.map(() => "?").join(", ")})`);
    region.forEach((r) => values.push(r));
  }
  for (const id of classifier) {
    const like = push(`%,${id},%`);
    where.push(`(',' || COALESCE("classifierIds", '') || ',') LIKE ${like}`);
  }

  const combined = `SELECT * FROM (${union}) AS src`;
  const whereSql = where.length > 0 ? ` WHERE ${where.join(" AND ")}` : "";

  const orderSql =
    sort === "name"
      ? ` ORDER BY name ${dir === "desc" ? "DESC" : "ASC"}`
      : ` ORDER BY COALESCE(rating, 0) ${dir === "desc" ? "DESC" : "ASC"}, name ASC`;

  // Рейтинги считаются агрегатом один раз, а не загрузкой всех отзывов
  const ratingCtes = `
    WITH company_rating AS (
      SELECT "companyId", AVG("weightedAverage") AS rating, COUNT(*) AS cnt
      FROM reviews WHERE "companyId" IS NOT NULL GROUP BY "companyId"
    ), user_rating AS (
      SELECT "targetId", AVG("weightedAverage") AS rating, COUNT(*) AS cnt
      FROM reviews WHERE "companyId" IS NULL GROUP BY "targetId"
    )`;

  if (countOnly) {
    return { sql: `${ratingCtes} SELECT COUNT(*) AS cnt FROM (${union}) AS src${whereSql}`, values };
  }

  const sql = `${ratingCtes} ${combined}${whereSql}${orderSql} LIMIT ${push(limit)} OFFSET ${push(offset)}`;
  return { sql, values };
}

export default async function SuppliersPage({
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
  const typeRaw = get("type");
  const type: "all" | "company" | "participant" =
    typeRaw === "company" || typeRaw === "participant" ? typeRaw : "all";
  const region = (get("region") || "").split(",").filter(Boolean);
  const classifier = (get("classifier") || "").split(",").filter(Boolean);
  const sort = get("sort") === "rating" ? "rating" : "name";
  const dir = get("dir") === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);

  const pageContent = await getPageContent("suppliers");
  const regions = await getRegions();

  const treeItems = await prisma.productTreeItem.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, fullNumberPath: true },
    orderBy: { fullNumberPath: "asc" },
  });

  const { sql: countSql, values: countValues } = buildCombinedQuery({
    q, region, classifier, type, sort, dir, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE,
    countOnly: true,
  });
  const { sql, values } = buildCombinedQuery({
    q, region, classifier, type, sort, dir, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE,
  });

  const [countRows, rawRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ cnt: number | bigint }[]>(countSql, ...countValues),
    prisma.$queryRawUnsafe(sql, ...values),
  ]);

  const total = Number(countRows[0]?.cnt ?? 0);

  type RawRow = {
    id: string;
    kind: "company" | "participant";
    inn: string | null;
    name: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    region: string | null;
    ownerNick: string | null;
    roleUserId: string;
    classifierIds: string;
    rating: number | null;
    reviewCount: number;
  };
  const rows = rawRows as RawRow[];

  // Роли владельцев/участников — одним запросом только для текущей страницы
  const roleUserIds = rows.map((r) => r.roleUserId).filter(Boolean);
  const roleRows = roleUserIds.length
    ? await prisma.userProfileRole.findMany({
        where: { profileId: { in: roleUserIds } },
        select: { profileId: true, role: true },
      })
    : [];
  const rolesByUserId = new Map<string, string[]>();
  for (const r of roleRows) {
    const list = rolesByUserId.get(r.profileId) || [];
    list.push(r.role);
    rolesByUserId.set(r.profileId, list);
  }

  // Счётчики просмотров (видны только админам) — для компаний текущей страницы
  const companyIds = rows.filter((r) => r.kind === "company").map((r) => r.id);
  const metrics = companyIds.length
    ? await prisma.companyMetrics.findMany({ where: { companyId: { in: companyIds } } })
    : [];
  const metricsById = new Map(metrics.map((m) => [m.companyId, m]));

  const companyRows = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    inn: r.inn,
    name: r.name,
    phone: r.phone,
    email: r.email,
    website: r.website,
    region: r.region,
    classifierIds: r.classifierIds ? r.classifierIds.split(",").filter(Boolean) : [],
    // Рейтинг — одна цифра после запятой (как раньше делал computeRating)
    rating: r.rating !== null ? Math.round(r.rating * 10) / 10 : null,
    reviewCount: r.reviewCount,
    ownerNick: r.ownerNick,
    ownerRoles: rolesByUserId.get(r.roleUserId) || [],
    metrics: {
      phoneViews: metricsById.get(r.id)?.phoneViews || 0,
      emailViews: metricsById.get(r.id)?.emailViews || 0,
      websiteViews: metricsById.get(r.id)?.websiteViews || 0,
    },
  }));

  return (
    <SuppliersPageClient
      rows={companyRows}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      treeItems={treeItems}
      regions={regions.map((r) => r.name)}
      pageTitle={pageContent?.title || null}
      moderatorText={pageContent?.content || null}
      bannerUrl={pageContent?.bannerUrl || null}
      initialQuery={{
        q: get("q") || "",
        type,
        region: region.join(","),
        classifier: classifier.join(","),
        sort,
        dir,
      }}
    />
  );
}
