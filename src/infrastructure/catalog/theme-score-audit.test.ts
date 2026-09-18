import { describe, it, expect } from "vitest";
import catalogData from "./generated/catalog.json";
import type { Product } from "../../domain/types/product";
import { auditThemeScores } from "../../domain/engine/theme-scorer";

const products = catalogData as Product[];

describe("Demo catalog theme-score audit", () => {
  it("has no product whose authored score wildly contradicts its own tags/finish (delta >= 0.6)", () => {
    const audits = auditThemeScores(products);
    const severe = audits.filter((a) => a.delta >= 0.6);

    if (severe.length) {
      console.error(
        "Severe theme-score discrepancies (likely data-entry mistakes):\n" +
          severe
            .map(
              (a) =>
                `  ${a.productId} / ${a.theme}: authored ${a.authoredScore}, derived ${a.derivedScore.toFixed(2)} (delta ${a.delta.toFixed(2)})`
            )
            .join("\n")
      );
    }
    expect(severe).toEqual([]);
  });

  it("reports moderate discrepancies (0.25-0.6) for human review, without failing", () => {
    const audits = auditThemeScores(products);
    const moderate = audits.filter((a) => a.delta >= 0.25 && a.delta < 0.6);

    if (moderate.length) {
      console.log(
        `${moderate.length} moderate theme-score discrepancies worth a glance:\n` +
          moderate
            .map(
              (a) =>
                `  ${a.productId} / ${a.theme}: authored ${a.authoredScore}, derived ${a.derivedScore.toFixed(2)} (delta ${a.delta.toFixed(2)})`
            )
            .join("\n")
      );
    }
    // Informational only — never fails the build.
    expect(true).toBe(true);
  });
});
