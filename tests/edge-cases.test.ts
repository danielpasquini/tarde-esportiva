import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeScore,
  nextBaseRating,
  revertBaseRating,
  computeMedalsFromVotes,
  MIN_SCORE,
  MAX_SCORE,
} from "../src/lib/rating";
import { parseLocalDateTime, formatDateTimeInput } from "../src/lib/format";
import { cleanPlayerName, parseNumberedRoster } from "../src/lib/parse-roster";

describe("Edge Case Tests — Score Normalization & Rating Math", () => {
  it("rejects NaN, Infinity, negative numbers, and out-of-range scores", () => {
    assert.equal(normalizeScore(Number.NaN), null);
    assert.equal(normalizeScore(Number.POSITIVE_INFINITY), null);
    assert.equal(normalizeScore(Number.NEGATIVE_INFINITY), null);
    assert.equal(normalizeScore(-3), null);
    assert.equal(normalizeScore(0), null);
    assert.equal(normalizeScore(0.74), null); // rounds to 0.5 < MIN_SCORE
    assert.equal(normalizeScore(5.25), null); // rounds to 5.5 > MAX_SCORE
  });

  it("accepts exact boundary rounding values near 1.0 and 5.0", () => {
    assert.equal(normalizeScore(0.75), 1.0); // rounds to 1.0
    assert.equal(normalizeScore(5.24), 5.0); // rounds to 5.0
  });

  it("caps history weight at 10 when ratedMatches is very large", () => {
    const at9 = nextBaseRating(4.0, 9, 5.0); // weight = min(9+1, 10) = 10
    const at100 = nextBaseRating(4.0, 100, 5.0); // weight = min(101, 10) = 10
    assert.equal(at9, at100);
    assert.equal(at100, Math.round(((4.0 * 10 + 5.0) / 11) * 100) / 100);
  });

  it("clamps revertBaseRating within [MIN_SCORE, MAX_SCORE] and handles <= 1 ratedMatches", () => {
    assert.equal(revertBaseRating(4.8, 1, 4.8), null);
    assert.equal(revertBaseRating(4.8, 0, 4.8), null);
    assert.equal(revertBaseRating(4.8, -2, 4.8), null);

    // Extreme low revert clamped to MIN_SCORE (1.0)
    const low = revertBaseRating(1.0, 3, 5.0);
    assert.equal(low, MIN_SCORE);

    // Extreme high revert clamped to MAX_SCORE (5.0)
    const high = revertBaseRating(5.0, 3, 1.0);
    assert.equal(high, MAX_SCORE);
  });
});

describe("Edge Case Tests — Medal Ties & Competition Ranking", () => {
  it("handles empty votes array gracefully", () => {
    assert.deepEqual(computeMedalsFromVotes([]), {});
  });

  it("handles 2-way tie for 1st place (both get gold, next gets bronze, skipping silver)", () => {
    const votes = [
      { matchId: "m1", targetId: "p1", score: 4.5 },
      { matchId: "m1", targetId: "p2", score: 4.5 },
      { matchId: "m1", targetId: "p3", score: 4.0 },
    ];
    const medals = computeMedalsFromVotes(votes);
    assert.deepEqual(medals.p1, { gold: 1, silver: 0, bronze: 0 });
    assert.deepEqual(medals.p2, { gold: 1, silver: 0, bronze: 0 });
    assert.deepEqual(medals.p3, { gold: 0, silver: 0, bronze: 1 });
  });

  it("handles 3-way tie for 1st place (all 3 get gold, 4th gets no medal)", () => {
    const votes = [
      { matchId: "m1", targetId: "p1", score: 5.0 },
      { matchId: "m1", targetId: "p2", score: 5.0 },
      { matchId: "m1", targetId: "p3", score: 5.0 },
      { matchId: "m1", targetId: "p4", score: 4.5 },
    ];
    const medals = computeMedalsFromVotes(votes);
    assert.equal(medals.p1.gold, 1);
    assert.equal(medals.p2.gold, 1);
    assert.equal(medals.p3.gold, 1);
    assert.equal(medals.p4, undefined);
  });

  it("handles 2-way tie for 2nd place (1st gets gold, both 2nd get silver, next is 4th)", () => {
    const votes = [
      { matchId: "m1", targetId: "p1", score: 5.0 },
      { matchId: "m1", targetId: "p2", score: 4.0 },
      { matchId: "m1", targetId: "p3", score: 4.0 },
      { matchId: "m1", targetId: "p4", score: 3.5 },
    ];
    const medals = computeMedalsFromVotes(votes);
    assert.deepEqual(medals.p1, { gold: 1, silver: 0, bronze: 0 });
    assert.deepEqual(medals.p2, { gold: 0, silver: 1, bronze: 0 });
    assert.deepEqual(medals.p3, { gold: 0, silver: 1, bronze: 0 });
    assert.equal(medals.p4, undefined);
  });

  it("treats averages that round to the same 1-decimal value as tied", () => {
    // p1: (4.5 + 4.4) / 2 = 4.45 -> rounds to 4.5
    // p2: 4.5 -> 4.5
    const votes = [
      { matchId: "m1", targetId: "p1", score: 4.5 },
      { matchId: "m1", targetId: "p1", score: 4.4 },
      { matchId: "m1", targetId: "p2", score: 4.5 },
    ];
    const medals = computeMedalsFromVotes(votes);
    assert.equal(medals.p1.gold, 1);
    assert.equal(medals.p2.gold, 1);
  });
});

describe("Edge Case Tests — Roster Parsing & Name Cleaning", () => {
  it("handles glued numbers, mixed delimiters, and empty/numeric-only lines", () => {
    const messy = "1.  \n 2. 13. marcio14.  Godoy; 15) ANA, 16 - bia (G)";
    assert.deepEqual(parseNumberedRoster(messy), ["Marcio", "Godoy", "Ana", "Bia"]);
  });

  it("deduplicates case-insensitively and strips goalkeeper tags", () => {
    const dupes = "1. Marcos (goleiro)\n2. MARCOS\n3. marcos (GK)\n4. Marcos (g)";
    assert.deepEqual(parseNumberedRoster(dupes), ["Marcos"]);
  });

  it("capitalizes prepositions when they are the first word of a name", () => {
    assert.equal(cleanPlayerName("de paula"), "De Paula");
    assert.equal(cleanPlayerName("lucas de paula"), "Lucas de Paula");
  });

  it("returns empty array for blank or symbol-only input", () => {
    assert.deepEqual(parseNumberedRoster(""), []);
    assert.deepEqual(parseNumberedRoster("   \n  1.   \n 2 -  "), []);
  });
});

describe("Edge Case Tests — Date & Time Parsing", () => {
  it("rejects malformed datetime strings", () => {
    assert.equal(parseLocalDateTime(""), null);
    assert.equal(parseLocalDateTime("2026-04-18"), null);
    assert.equal(parseLocalDateTime("18/04/2026 15:00"), null);
    assert.equal(parseLocalDateTime("2026-13-45T99:99"), null);
  });

  it("preserves midnight and end-of-day boundaries in America/Sao_Paulo", () => {
    const startOfYear = parseLocalDateTime("2026-01-01T00:00");
    assert.ok(startOfYear);
    assert.equal(formatDateTimeInput(startOfYear), "2026-01-01T00:00");

    const endOfYear = parseLocalDateTime("2026-12-31T23:59");
    assert.ok(endOfYear);
    assert.equal(formatDateTimeInput(endOfYear), "2026-12-31T23:59");
  });
});
