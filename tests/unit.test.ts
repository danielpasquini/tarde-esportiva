import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  normalizeScore,
  nextBaseRating,
  revertBaseRating,
  formatRating,
  computeMedalsFromVotes,
  computeMatchRobustAverages,
} from "../src/lib/rating";
import {
  formatMatchDate,
  formatShortDate,
  parseLocalDateTime,
  formatDateTimeInput,
} from "../src/lib/format";
import { cleanPlayerName, parseNumberedRoster } from "../src/lib/parse-roster";

describe("Unit Tests — Rating & Medals (src/lib/rating.ts)", () => {
  it("normalizes valid scores in 0.5 steps", () => {
    assert.equal(normalizeScore(1), 1.0);
    assert.equal(normalizeScore(3.5), 3.5);
    assert.equal(normalizeScore(5), 5.0);
    assert.equal(normalizeScore(3.24), 3.0);
    assert.equal(normalizeScore(3.26), 3.5);
  });

  it("calculates weighted nextBaseRating accurately", () => {
    // Player without initial rating: first match defines 100% of rating
    assert.equal(nextBaseRating(null, 0, 4.2), 4.2);
    // First match with manual initial rating: ratedMatches = 0 -> weight = 1 -> (3.0 * 1 + 4.0) / 2 = 3.5
    assert.equal(nextBaseRating(3.0, 0, 4.0), 3.5);
    // Second match: ratedMatches = 1 -> weight = 2 -> (3.5 * 2 + 5.0) / 3 = 4.0
    assert.equal(nextBaseRating(3.5, 1, 5.0), 4.0);
  });

  it("reverts baseRating back to previous rating", () => {
    // If ratedMatches was 1, reverting clears baseRating to null (no rating yet)
    assert.equal(revertBaseRating(4.4, 1, 4.4), null);

    const initial = 3.0;
    const after1 = nextBaseRating(initial, 0, 4.4);
    const after2 = nextBaseRating(after1, 1, 3.8);
    assert.equal(revertBaseRating(after2, 2, 3.8), after1);
  });

  it("formats ratings using Brazilian comma decimal separator", () => {
    assert.equal(formatRating(4.5), "4,5");
    assert.equal(formatRating(3), "3,0");
    assert.equal(formatRating(null), "–");
    assert.equal(formatRating(undefined), "–");
  });

  it("computes gold, silver, and bronze medals across finished matches", () => {
    const votes = [
      { matchId: "m1", targetId: "p1", score: 5.0 },
      { matchId: "m1", targetId: "p2", score: 4.0 },
      { matchId: "m1", targetId: "p3", score: 3.5 },
      { matchId: "m1", targetId: "p4", score: 2.5 },
    ];
    const medals = computeMedalsFromVotes(votes);
    assert.deepEqual(medals.p1, { gold: 1, silver: 0, bronze: 0 });
    assert.deepEqual(medals.p2, { gold: 0, silver: 1, bronze: 0 });
    assert.deepEqual(medals.p3, { gold: 0, silver: 0, bronze: 1 });
    assert.equal(medals.p4, undefined);
  });

  it("computes robust match averages attenuating zero-variance voters and outliers", () => {
    // Voter 1 gives identical 5.0 to 4 targets (variance = 0 -> weight 0.5)
    // Voter 2 gives differentiated scores 3.0, 4.0, 2.0, 3.5 (variance > 0.08 -> weight 1.0)
    // Target 1 receives 5 votes: [1.0, 3.0, 3.0, 3.0, 5.0] from voters with normal variance.
    // In trimmed mean (>=4 votes), extreme min (1.0) and extreme max (5.0) get 50% discount.
    const votes = [
      // Zero variance voter:
      { voterId: "v_flat", targetId: "pA", score: 5.0 },
      { voterId: "v_flat", targetId: "pB", score: 5.0 },
      { voterId: "v_flat", targetId: "pC", score: 5.0 },
      // Normal voter:
      { voterId: "v_normal", targetId: "pA", score: 3.0 },
      { voterId: "v_normal", targetId: "pB", score: 1.0 },
      { voterId: "v_normal", targetId: "pC", score: 4.0 },
    ];
    const robust = computeMatchRobustAverages(votes);
    // Simple averages:
    // pA: (5.0 + 3.0) / 2 = 4.0
    // pB: (5.0 + 1.0) / 2 = 3.0 (none < 2.0 -> lowest target is 1.65 -> rounds to 1.7)
    // pC: (5.0 + 4.0) / 2 = 4.5 (> 4.0 -> highest target is 4.85 -> rounds to 4.9)
    // Unscaled preliminary weighted averages:
    // pA: (5.0*0.5 + 3.0*1.0) / 1.5 = 3.6667
    // pB: (5.0*0.5 + 1.0*1.0) / 1.5 = 2.3333 (min) -> scales to 1.7
    // pC: (5.0*0.5 + 4.0*1.0) / 1.5 = 4.3333 (max) -> scales to 4.9
    // pA: intermediate -> 1.65 + ((3.6667 - 2.3333)/(4.3333 - 2.3333)) * (4.85 - 1.65) = 1.65 + 0.6667 * 3.2 = 3.78 -> 3.8
    assert.equal(robust.get("pC")?.avg, 4.9);
    assert.equal(robust.get("pB")?.avg, 1.7);
    assert.equal(robust.get("pA")?.avg, 3.8);

    // Test outlier downweighting when >= 4 votes:
    const targetWithOutliers = [
      { voterId: "v1", targetId: "pTarget", score: 1.0 }, // min outlier
      { voterId: "v2", targetId: "pTarget", score: 3.0 },
      { voterId: "v3", targetId: "pTarget", score: 3.0 },
      { voterId: "v4", targetId: "pTarget", score: 3.0 },
      { voterId: "v5", targetId: "pTarget", score: 5.0 }, // max outlier
    ];
    // Each voter has only 1 vote here so voterWeight is 1.0
    // Min (1.0) weight = 0.5, Max (5.0) weight = 0.5
    // Middle items weight = 1.0 each
    // Sum = (1*0.5) + (3*1) + (3*1) + (3*1) + (5*0.5) = 0.5 + 3 + 3 + 3 + 2.5 = 12.0
    // Total weight = 0.5 + 1 + 1 + 1 + 0.5 = 4.0
    // Avg = 12.0 / 4.0 = 3.0
    const robustOutliers = computeMatchRobustAverages(targetWithOutliers);
    assert.equal(robustOutliers.get("pTarget")?.avg, 3.0);
  });

  it("scales match score amplitude conditionally based on simple averages", () => {
    // Case 1: Highest simple average is <= 4.0 and lowest simple average is >= 2.0
    // Stretch must reach [4.3, 4.4] on top and [1.6, 1.7] on bottom
    const votesModerate = [
      { voterId: "v1", targetId: "pLow", score: 2.5 },
      { voterId: "v1", targetId: "pMid", score: 3.2 },
      { voterId: "v1", targetId: "pHigh", score: 3.8 },
      { voterId: "v2", targetId: "pLow", score: 2.5 },
      { voterId: "v2", targetId: "pMid", score: 3.2 },
      { voterId: "v2", targetId: "pHigh", score: 3.8 },
    ];
    const resMod = computeMatchRobustAverages(votesModerate);
    const modHigh = resMod.get("pHigh")?.avg ?? 0;
    const modLow = resMod.get("pLow")?.avg ?? 0;
    assert.ok(modHigh >= 4.3 && modHigh <= 4.4, `expected modHigh in [4.3, 4.4], got ${modHigh}`);
    assert.ok(modLow >= 1.6 && modLow <= 1.7, `expected modLow in [1.6, 1.7], got ${modLow}`);

    // Case 2: Someone has simple average > 4.0 and someone has simple average < 2.0
    // Stretch must reach [4.8, 4.9] on top and [1.1, 1.2] on bottom
    const votesExtreme = [
      { voterId: "v1", targetId: "pLow", score: 1.5 },
      { voterId: "v1", targetId: "pMid", score: 3.2 },
      { voterId: "v1", targetId: "pHigh", score: 4.5 },
      { voterId: "v2", targetId: "pLow", score: 1.5 },
      { voterId: "v2", targetId: "pMid", score: 3.2 },
      { voterId: "v2", targetId: "pHigh", score: 4.5 },
    ];
    const resExt = computeMatchRobustAverages(votesExtreme);
    const extHigh = resExt.get("pHigh")?.avg ?? 0;
    const extLow = resExt.get("pLow")?.avg ?? 0;
    assert.ok(extHigh >= 4.8 && extHigh <= 4.9, `expected extHigh in [4.8, 4.9], got ${extHigh}`);
    assert.ok(extLow >= 1.1 && extLow <= 1.2, `expected extLow in [1.1, 1.2], got ${extLow}`);
  });
});

describe("Unit Tests — Date Formatting (src/lib/format.ts)", () => {
  it("parses and formats datetime-local in America/Sao_Paulo timezone", () => {
    const input = "2026-04-18T15:30";
    const parsed = parseLocalDateTime(input);
    assert.ok(parsed instanceof Date);
    assert.equal(formatDateTimeInput(parsed), input);
    assert.equal(formatShortDate(parsed), "18/04/2026");
    assert.match(formatMatchDate(parsed), /18\/04\/2026 às 15:30/);
  });
});

describe("Unit Tests — Roster Parser (src/lib/parse-roster.ts)", () => {
  it("cleans numbered player names and applies Portuguese Title Case", () => {
    assert.equal(cleanPlayerName("1. paulo ricardo"), "Paulo Ricardo");
    assert.equal(cleanPlayerName("02 - joão da silva (goleiro)"), "João da Silva");
    assert.equal(cleanPlayerName("3) pedro de lara (gk)"), "Pedro de Lara");
  });

  it("parses multi-line numbered rosters", () => {
    const raw = `
      1. Paulo Ricardo
      2. Tuguinho
      3. João de Deus
    `;
    assert.deepEqual(parseNumberedRoster(raw), ["Paulo Ricardo", "Tuguinho", "João de Deus"]);
  });
});

describe("Unit Tests — UI Layout & Rectangular Design Rules", () => {
  const rootDir = path.resolve(__dirname, "..");

  it("renders the 4 team color bars in order: azul, vermelho, preto, amarelo", () => {
    const layoutContent = fs.readFileSync(path.join(rootDir, "src/app/layout.tsx"), "utf8");
    const idxAzul = layoutContent.indexOf("bg-team-azul");
    const idxVermelho = layoutContent.indexOf("bg-team-vermelho");
    const idxPreto = layoutContent.indexOf("bg-team-preto");
    const idxAmarelo = layoutContent.indexOf("bg-team-amarelo");

    assert.ok(idxAzul > -1, "bg-team-azul should be present in header");
    assert.ok(idxVermelho > idxAzul, "bg-team-vermelho should follow bg-team-azul");
    assert.ok(idxPreto > idxVermelho, "bg-team-preto should follow bg-team-vermelho");
    assert.ok(idxAmarelo > idxPreto, "bg-team-amarelo should follow bg-team-preto");
  });

  it("removes BroadcastTicker and MATCH DAY HUB from the main header while keeping 3 stars", () => {
    const layoutContent = fs.readFileSync(path.join(rootDir, "src/app/layout.tsx"), "utf8");
    assert.ok(!layoutContent.includes("MATCH DAY HUB"), "MATCH DAY HUB should be removed");
    assert.ok(!layoutContent.includes("BroadcastTicker"), "BroadcastTicker should be removed from header");
    const starMatches = layoutContent.match(/<Star\b/g) ?? [];
    assert.equal(starMatches.length, 3, "Header should contain exactly 3 centered stars");
  });

  it("has zero parallelogram skew classes (-skew-x or skew-x) across all pages and UI components", () => {
    const checkDirs = [path.join(rootDir, "src/app"), path.join(rootDir, "src/components")];
    const offendingFiles: string[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (/\.(tsx|ts|css)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, "utf8");
          if (/(?:-skew-x-|skew-x-|skewX\()/.test(content) && !entry.name.includes("SplitText") && !entry.name.includes("ScrollVelocity")) {
            offendingFiles.push(path.relative(rootDir, fullPath));
          }
        }
      }
    }

    for (const d of checkDirs) walk(d);
    assert.deepEqual(offendingFiles, [], `Found unexpected skew classes in: ${offendingFiles.join(", ")}`);
  });

  it("uses 2-column grid for player profile stat cards so Classificação Geral never clips into borders", () => {
    const profileContent = fs.readFileSync(path.join(rootDir, "src/app/perfil/[id]/page.tsx"), "utf8");
    assert.ok(!profileContent.includes("sm:grid-cols-4"), "Profile stat cards must not use sm:grid-cols-4 inside max-w-md");
    assert.ok(!profileContent.includes("JOGADOR DE LINHA"), "Profile header must show only PLAYER CARD");
    assert.ok(profileContent.includes('text="PLAYER CARD"'), "Profile header should display PLAYER CARD");
  });
});
