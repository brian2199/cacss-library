import type { Item } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

export function ItemProtectionBadges({ item }: { item: Pick<Item, "referenceOnly" | "fragile" | "archival" | "doNotRemoveFromLibrary" | "signedEdition" | "outOfPrint" | "rareProtected"> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {item.referenceOnly ? (
        <Badge variant="warn">Reference only</Badge>
      ) : null}
      {item.rareProtected ? <Badge variant="bloom">Rare</Badge> : null}
      {item.fragile ? <Badge variant="warn">Fragile</Badge> : null}
      {item.archival ? <Badge variant="secondary">Archival</Badge> : null}
      {item.doNotRemoveFromLibrary ? (
        <Badge variant="destructive">Do not remove</Badge>
      ) : null}
      {item.signedEdition ? <Badge variant="sage">Signed edition</Badge> : null}
      {item.outOfPrint ? <Badge variant="outline">Out of print</Badge> : null}
    </div>
  );
}
