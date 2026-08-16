import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { JsonLd } from "@/components/shared/JsonLd";
import { parseCharacteristic } from "@/lib/utils";
import { Phone, Mail } from "lucide-react";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ id: string }>;
}

const CLASS_LABELS: Record<string, string> = {
  STANDARD: "Стандарт",
  COMFORT: "Комфорт",
  BUSINESS: "Бизнес",
  PREMIUM: "Премиум",
};

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true, inn: true, phone: true, email: true } },
      treeItem: { select: { fullNumberPath: true, name: true } },
    },
  });

  if (!product || product.deletedAt || product.status !== "PUBLISHED") notFound();

  const chars = parseJsonArray(product.characteristics).map(parseCharacteristic);
  const classes = parseJsonArray(product.classes);

  return (
    <div className="container-page py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description || undefined,
          image: product.imageUrl || undefined,
          offers: product.price !== null
            ? { "@type": "Offer", price: product.price, priceCurrency: "RUB" }
            : undefined,
          brand: { "@type": "Organization", name: product.company.name },
        }}
      />
      <Link href="/matrix" className="text-sm text-muted-foreground hover:text-menthol transition-colors">
        ← К матрице материалов
      </Link>

      <div className="flex flex-col md:flex-row gap-6 mt-4">
        {product.imageUrl && (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full md:w-80 h-64 object-cover rounded-lg border bg-secondary"
          />
        )}
        <div className="flex-1 space-y-4">
          <div>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {product.treeItem?.fullNumberPath} — {product.treeItem?.name}
            </Badge>
            <h1 className="text-3xl font-bold mt-2">{product.name}</h1>
            {product.description && (
              <p className="text-muted-foreground mt-2">{product.description}</p>
            )}
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-menthol">
              {product.price !== null ? `${product.price.toLocaleString("ru-RU")} ₽` : "Цена по запросу"}
            </span>
            {product.unit && <span className="text-sm text-muted-foreground">/ {product.unit}</span>}
          </div>

          <div className="flex flex-wrap gap-1">
            {classes.map((c) => (
              <Badge key={c} variant="outline" className="text-[10px]">{CLASS_LABELS[c] || c}</Badge>
            ))}
          </div>

          {product.regions && (
            <p className="text-sm text-muted-foreground">
              Регионы: {product.regions.split(",").filter(Boolean).join(", ") || "Все регионы"}
            </p>
          )}

          {chars.length > 0 && (
            <Card>
              <CardContent className="space-y-1 py-3">
                {chars.map((c, i) => (
                  <div key={i} className="flex justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{c.name}</span>
                    <span className="font-medium text-right">{c.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-2 py-3 text-sm">
              <Link href={`/suppliers/${product.company.id}`} className="font-medium text-menthol hover:underline">
                {product.company.name}
              </Link>
              <p className="text-xs text-muted-foreground">ИНН {product.company.inn}</p>
              {product.company.phone && (
                <p className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" /> {product.company.phone}</p>
              )}
              {product.company.email && (
                <p className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" /> {product.company.email}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
