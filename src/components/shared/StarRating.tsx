import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number; // 0-5
  size?: "sm" | "md" | "lg";
}

export function StarRating({ rating, size = "md" }: StarRatingProps) {
  const stars = Math.round(rating); // 0-5 звёзд
  const sizeClass = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${sizeClass} ${
            i <= stars ? "fill-orange-accent text-orange-accent" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </span>
  );
}
