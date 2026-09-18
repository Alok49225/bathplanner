// Build-time only: reads catalog/source.xlsx, validates every row against
// the Product shape (src/domain/types/product.ts), and writes
// src/infrastructure/catalog/generated/catalog.json. Never runs in the
// browser — a bad row fails this script loudly, before anything is committed.
import XLSX from "xlsx";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.join(__dirname, "source.xlsx");
const OUT_PATH = path.join(
  __dirname,
  "..",
  "src",
  "infrastructure",
  "catalog",
  "generated",
  "catalog.json"
);

const CATEGORIES = ["toilet", "vanity", "faucet", "shower", "lighting"];
const FINISHES = [
  "chrome", "brushed-nickel", "matte-black", "polished-brass",
  "brushed-gold", "oil-rubbed-bronze", "white", "stainless-steel",
];
const INSTALL_COMPLEXITIES = ["drop-in", "standard", "specialist"];

// Mirrors src/domain/types/product.ts. Kept separate on purpose: this schema
// validates untyped spreadsheet input, the TS type describes already-valid
// domain data — different jobs, so not worth sharing one definition.
const RowSchema = z.object({
  id: z.string().min(1),
  category: z.enum(CATEGORIES),
  name: z.string().min(1),
  brand: z.string().min(1),
  priceCents: z.coerce.number().int().positive(),
  finish: z.enum(FINISHES),
  width: z.coerce.number().positive(),
  depth: z.coerce.number().positive(),
  height: z.coerce.number().positive(),
  clearanceFront: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  clearanceSide: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  gpf: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  gpm: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  installComplexity: z.enum(INSTALL_COMPLEXITIES),
  styleTags: z.string().min(1),
  themeMinimalistModern: z.coerce.number().min(0).max(1),
  themeClassicLuxury: z.coerce.number().min(0).max(1),
  themeJapaneseZen: z.coerce.number().min(0).max(1),
  finishFamily: z.string().min(1),
  imageUrl: z.string().optional().or(z.literal("").transform(() => undefined)),
});

function toProduct(row, rowNumber) {
  const parsed = RowSchema.safeParse(row);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `catalog/source.xlsx row ${rowNumber} (id: ${row.id ?? "?"}) failed validation:\n${issues}`
    );
  }
  const r = parsed.data;

  const clearanceOverride =
    r.clearanceFront !== undefined || r.clearanceSide !== undefined
      ? { front: r.clearanceFront, side: r.clearanceSide }
      : undefined;
  const waterUsage =
    r.gpf !== undefined || r.gpm !== undefined
      ? { gpf: r.gpf, gpm: r.gpm }
      : undefined;

  return {
    id: r.id,
    category: r.category,
    name: r.name,
    brand: r.brand,
    priceCents: r.priceCents,
    finish: r.finish,
    dimensions: { width: r.width, depth: r.depth, height: r.height },
    ...(clearanceOverride ? { clearanceOverride } : {}),
    ...(waterUsage ? { waterUsage } : {}),
    installComplexity: r.installComplexity,
    styleTags: r.styleTags.split(";").map((t) => t.trim()).filter(Boolean),
    themeScores: {
      "minimalist-modern": r.themeMinimalistModern,
      "classic-luxury": r.themeClassicLuxury,
      "japanese-zen": r.themeJapaneseZen,
    },
    finishFamily: r.finishFamily,
    ...(r.imageUrl ? { imageUrl: r.imageUrl } : {}),
  };
}

function main() {
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`catalog/source.xlsx not found. Run "npm run catalog:seed-source" first.`);
  }
  const book = XLSX.readFile(SOURCE_PATH);
  const sheet = book.Sheets[book.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const products = rawRows.map((row, i) => toProduct(row, i + 2)); // +2: header row + 1-index

  const ids = new Set();
  for (const p of products) {
    if (ids.has(p.id)) throw new Error(`Duplicate product id in catalog: ${p.id}`);
    ids.add(p.id);
  }

  const counts = CATEGORIES.reduce((acc, c) => ({ ...acc, [c]: 0 }), {});
  for (const p of products) counts[p.category] += 1;
  const missing = CATEGORIES.filter((c) => counts[c] === 0);
  if (missing.length) {
    throw new Error(`Catalog has zero products in required categories: ${missing.join(", ")}`);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(products, null, 2) + "\n");

  console.log(`Wrote ${products.length} products to ${OUT_PATH}`);
  console.log("Per category:", counts);
}

main();
