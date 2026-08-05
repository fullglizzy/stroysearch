import Link from "next/link";
import { Home, Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="text-7xl font-bold text-menthol mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">Страница не найдена</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        Запрашиваемая страница не существует или была перемещена. Проверьте адрес или перейдите в один из разделов платформы.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/">
          <Button className="bg-menthol hover:bg-menthol-dark gap-2">
            <Home className="h-4 w-4" />
            На главную
          </Button>
        </Link>
        <Link href="/products">
          <Button variant="outline" className="gap-2">
            <Search className="h-4 w-4" />
            Продуктовые решения
          </Button>
        </Link>
        <Link href="/suppliers">
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            База поставщиков
          </Button>
        </Link>
      </div>
    </div>
  );
}
