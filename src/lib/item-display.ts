import type { Item, ItemFormat } from "@prisma/client";

/** True when the title needs special handling badges (rare, reference, etc.). */
export function isSpecialItem(
  item: Pick<
    Item,
    | "referenceOnly"
    | "fragile"
    | "archival"
    | "doNotRemoveFromLibrary"
    | "signedEdition"
    | "outOfPrint"
    | "rareProtected"
    | "requiresRareApproval"
  >,
): boolean {
  return (
    item.referenceOnly ||
    item.fragile ||
    item.archival ||
    item.doNotRemoveFromLibrary ||
    item.signedEdition ||
    item.outOfPrint ||
    item.rareProtected ||
    item.requiresRareApproval
  );
}

const FORMAT_LABELS: Record<ItemFormat, string> = {
  BOOK: "Book",
  JOURNAL: "Journal",
  MAGAZINE: "Magazine",
  DVD: "DVD",
  CONVENTION_GUIDE: "Convention guide",
  REFERENCE_MATERIAL: "Reference",
  YOUTH_BOOK: "Youth book",
  MAP: "Map",
  BOOKLET: "Booklet",
  PHOTOCOPY: "Photocopy",
  ARCHIVAL_COLLECTION: "Archival",
};

export function formatLabel(format: ItemFormat): string {
  return FORMAT_LABELS[format] ?? format.replaceAll("_", " ");
}
