import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Official CACSS mark (bundled from centralarizonacactus.org). */
export const CACSS_LOGO_PATH = "/logo-cacss.webp";

const sizeClasses = {
  sm: "h-8",
  md: "h-10",
  lg: "h-14",
} as const;

export function CacssLogo({
  href = "/",
  size = "md",
  showLibraryLabel = true,
  tagline,
  className,
  priority = false,
}: {
  href?: string | null;
  size?: keyof typeof sizeClasses;
  showLibraryLabel?: boolean;
  tagline?: string;
  className?: string;
  priority?: boolean;
}) {
  const inner = (
    <div className={cn("flex items-center gap-3", className)}>
      <Image
        src={CACSS_LOGO_PATH}
        alt="Central Arizona Cactus & Succulent Society"
        width={220}
        height={56}
        priority={priority}
        className={cn(
          "w-auto object-contain",
          sizeClasses[size],
        )}
      />
      {showLibraryLabel || tagline ? (
        <div className="min-w-0 leading-tight">
          {showLibraryLabel ? (
            <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-primary">
              Library
            </p>
          ) : null}
          {tagline ? (
            <p className="text-xs text-muted-foreground">{tagline}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
        {inner}
      </Link>
    );
  }

  return inner;
}
