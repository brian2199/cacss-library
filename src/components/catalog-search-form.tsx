import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogSearchParams } from "@/lib/catalog-where";

export function CatalogSearchForm({
  sp,
  showAdvanced,
}: {
  sp: CatalogSearchParams;
  showAdvanced: boolean;
}) {
  const hasAdvancedFilters = Boolean(
    sp.referenceOnly === "1" ||
      sp.signed === "1" ||
      sp.fragile === "1" ||
      sp.rare === "1" ||
      sp.missing === "1" ||
      sp.youth === "1" ||
      (sp.decade && sp.decade.length > 0) ||
      (sp.format && sp.format !== "all" && sp.format !== "BOOK"),
  );

  return (
    <form className="space-y-4" method="get" action="/catalog">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label className="sr-only" htmlFor="q">
            Search
          </label>
          <Input
            id="q"
            name="q"
            placeholder="Search by title or author…"
            defaultValue={sp.q ?? ""}
            className="h-11"
          />
        </div>
        <div className="sm:w-40">
          <label className="sr-only" htmlFor="format">
            Type
          </label>
          <select
            id="format"
            name="format"
            defaultValue={sp.format ?? "BOOK"}
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="BOOK">Books</option>
            <option value="all">All types</option>
            <option value="JOURNAL">Journals</option>
            <option value="MAGAZINE">Magazines</option>
            <option value="DVD">DVDs</option>
            <option value="YOUTH_BOOK">Youth books</option>
            <option value="CONVENTION_GUIDE">Convention guides</option>
            <option value="REFERENCE_MATERIAL">Reference</option>
            <option value="ARCHIVAL_COLLECTION">Archival</option>
          </select>
        </div>
        <Button type="submit" className="h-11 px-8">
          Search
        </Button>
      </div>

      {sp.barcode ? (
        <input type="hidden" name="barcode" value={sp.barcode} />
      ) : null}

      {showAdvanced ? (
        <details className="rounded-lg border bg-muted/30 p-4" open={hasAdvancedFilters}>
          <summary className="cursor-pointer text-sm font-medium">
            Advanced filters (rare, reference, decade…)
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div>
              <label className="sr-only" htmlFor="decade">
                Decade
              </label>
              <Input
                id="decade"
                name="decade"
                placeholder="e.g. 1950s"
                defaultValue={sp.decade ?? ""}
              />
            </div>
            <div className="flex flex-wrap gap-4 md:col-span-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="referenceOnly"
                  value="1"
                  defaultChecked={sp.referenceOnly === "1"}
                />
                Reference only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="signed" value="1" defaultChecked={sp.signed === "1"} />
                Signed
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="fragile" value="1" defaultChecked={sp.fragile === "1"} />
                Fragile
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="rare" value="1" defaultChecked={sp.rare === "1"} />
                Rare
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="missing" value="1" defaultChecked={sp.missing === "1"} />
                Missing copies
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="youth" value="1" defaultChecked={sp.youth === "1"} />
                Youth shelf
              </label>
            </div>
          </div>
        </details>
      ) : null}

      <div className="flex gap-2">
        <Button type="reset" variant="outline" size="sm" asChild>
          <Link href="/catalog">Clear</Link>
        </Button>
      </div>
    </form>
  );
}
