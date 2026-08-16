import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StarRating } from "@/components/shared/StarRating";
import { JsonLd } from "@/components/shared/JsonLd";
import { computeRating } from "@/lib/rating";
import { Phone, Mail, Globe, MapPin, Building2 } from "lucide-react";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SupplierPage({ params }: PageProps) {
  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      metrics: true,
      reviews: {
        where: { status: "ACTIVE" },
        include: {
          author: { select: { username: true, profile: { select: { nick: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
      products: {
        where: { deletedAt: null, status: "PUBLISHED" },
        include: { treeItem: { select: { fullNumberPath: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!company) notFound();

  const rating = computeRating(company.reviews);

  return (
    <div className="container-page py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: company.name,
          taxID: company.inn,
          telephone: company.phone || undefined,
          email: company.email || undefined,
          url: company.website || undefined,
          aggregateRating: rating !== null ? { "@type": "AggregateRating", ratingValue: rating, reviewCount: company.reviews.length } : undefined,
        }}
      />
      <Link href="/suppliers" className="text-sm text-muted-foreground hover:text-menthol transition-colors">
        ← К базе поставщиков
      </Link>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mt-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 flex-wrap">
            <Building2 className="h-8 w-8 text-menthol" />
            {company.name}
          </h1>
          <p className="text-muted-foreground mt-1">ИНН {company.inn}{company.kpp ? ` · КПП ${company.kpp}` : ""}</p>
        </div>
        {rating !== null && (
          <Card>
            <CardContent className="flex items-center gap-2 py-3">
              <StarRating rating={rating} size="md" />
              <span className="text-xl font-bold">{rating.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({company.reviews.length} отзывов)</span>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Контакты</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {company.phone && (
                <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {company.phone}</p>
              )}
              {company.email && (
                <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {company.email}</p>
              )}
              {company.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-menthol hover:underline">
                  <Globe className="h-4 w-4 text-muted-foreground" /> {company.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {company.legalAddress && (
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {company.legalAddress}</p>
              )}
              {company.regions && (
                <p className="text-xs text-muted-foreground pt-1">Регионы: {company.regions.split(",").filter(Boolean).join(", ")}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">Товары ({company.products.length})</h2>
            {company.products.length === 0 ? (
              <p className="text-sm text-muted-foreground">Компания пока не добавила товары</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {company.products.map((p) => (
                  <Link key={p.id} href={`/products/${p.id}`}>
                    <Card className="h-full hover:border-menthol/50 transition-colors cursor-pointer">
                      <CardContent className="py-3">
                        <p className="font-medium text-sm">{p.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {p.treeItem?.fullNumberPath} — {p.treeItem?.name}
                          </Badge>
                          {p.price !== null && <span className="text-sm font-bold text-menthol">{p.price.toLocaleString("ru-RU")} ₽</span>}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Отзывы ({company.reviews.length})</h2>
            {company.reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">Отзывов пока нет</p>
            ) : (
              <div className="space-y-3">
                {company.reviews.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium">{r.author.profile?.nick || r.author.username}</span>
                        <div className="flex items-center gap-1">
                          <StarRating rating={r.weightedAverage} size="sm" />
                          <span className="text-xs text-muted-foreground">{r.weightedAverage.toFixed(1)}</span>
                        </div>
                      </div>
                      <p className="text-sm wrap-anywhere whitespace-pre-wrap">{r.comment}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(r.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
