import type { Product } from "../../domain/types/product";
import type { CatalogRepository } from "../../domain/catalog-repository";
import { CatalogDAO } from "./catalog-dao";

/**
 * Implements CatalogRepository (the "implements" arrow that points up into
 * Domain — see the architecture diagram). Today this just passes the DAO's
 * rows straight through, because catalog.json is already shaped like
 * Product[]. A future live-API implementation would map its own DAO's raw
 * rows into Product[] here instead.
 */
export class StaticCatalogRepository implements CatalogRepository {
  private readonly dao: CatalogDAO;

  constructor(dao: CatalogDAO = new CatalogDAO()) {
    this.dao = dao;
  }

  async getAll(): Promise<Product[]> {
    return this.dao.readAll();
  }

  async getById(id: string): Promise<Product | undefined> {
    return this.dao.readAll().find((p) => p.id === id);
  }
}
