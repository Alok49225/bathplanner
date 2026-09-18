import type { Product } from "../../domain/types/product";
import catalogData from "./generated/catalog.json";

/**
 * Raw data access only — no domain shaping, no validation (that already
 * happened in catalog/build-catalog.mjs). Reads whatever generated/catalog.json
 * holds. RepositoryImpl is the only caller.
 */
export class CatalogDAO {
  readAll(): Product[] {
    return catalogData as Product[];
  }
}
