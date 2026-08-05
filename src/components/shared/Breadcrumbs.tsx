import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4" aria-label="Хлебные крошки">
      <Link href="/" className="hover:text-menthol transition-colors flex items-center gap-1">
        <Home className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Главная</span>
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5" />
          {item.href ? (
            <Link href={item.href} className="hover:text-menthol transition-colors truncate max-w-[200px]">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground truncate max-w-[200px]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
