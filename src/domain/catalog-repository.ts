import type { Product } from "./types/product";

/**
 * The Domain layer's view of the catalog — Infrastructure implements this
 * (see architecture diagram: RepositoryImpl -> implements -> this interface).
 * Both methods are async even though the static implementation resolves
 * instantly, so a future live-API implementation fits without changing
 * this interface or anything that calls it.
 */
export interface CatalogRepository {
  getAll(): Promise<Product[]>;
  getById(id: string): Promise<Product | undefined>;
}
