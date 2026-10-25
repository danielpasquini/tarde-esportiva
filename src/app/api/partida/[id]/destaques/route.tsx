import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { formatMatchDate } from "@/lib/format";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const match = await db.match.findUnique({
    where: { id },
    include: {
      attendances: { where: { team: { not: null } }, include: { player: true } },
    },
  });

  if (!match) {
    return new Response("Partida não encontrada", { status: 404 });
  }

  // Obter médias dos votos desta partida
  const averages = await db.vote.groupBy({
    by: ["targetId"],
    where: { matchId: id },
    _avg: { score: true },
    _count: { score: true },
  });

  const avgMap = new Map(averages.map((a) => [a.targetId, a._avg.score ?? 0]));
  const countMap = new Map(averages.map((a) => [a.targetId, a._count.score ?? 0]));

  const ratedPlayers = match.attendances
    .map((att) => ({
      name: att.player.name,
      isGoalkeeper: att.asGoalkeeper || att.player.isGoalkeeper,
      avg: avgMap.get(att.playerId) ?? 0,
      votesCount: countMap.get(att.playerId) ?? 0,
    }))
    .filter((p) => p.avg > 0)
    .sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));

  const mvp = ratedPlayers[0] ?? null;
  const top4 = ratedPlayers.slice(1, 5);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#F4F1EA",
          backgroundImage: "radial-gradient(#1A2E22 0.75px, transparent 0.75px)",
          backgroundSize: "20px 20px",
          color: "#1A2E22",
          padding: "48px 56px",
          fontFamily: "sans-serif",
          justifyContent: "space-between",
          border: "16px solid #1A2E22",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "#9E2A2B",
              }}
            >
              Tarde Esportiva • Destaques da Rodada
            </span>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#1A2E22", marginTop: 4 }}>
              {formatMatchDate(match.date)}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              backgroundColor: "#1A2E22",
              color: "#F4F1EA",
              padding: "8px 18px",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            TOP 5 DA PARTIDA
          </div>
        </div>

        {/* Corpo principal */}
        <div style={{ display: "flex", gap: 32, alignItems: "stretch", marginTop: 20 }}>
          {/* Jogador do Dia (MVP) */}
          <div
            style={{
              flex: 1.2,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              backgroundColor: "#1A2E22",
              color: "#F4F1EA",
              padding: "36px 32px",
              boxShadow: "8px 8px 0 #9E2A2B",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  color: "#E5A93C",
                  marginBottom: 8,
                }}
              >
                ★ Craque da Partida
              </span>
              <span
                style={{
                  fontSize: 44,
                  fontWeight: 900,
                  lineHeight: 1.1,
                  textTransform: "uppercase",
                  letterSpacing: "-0.02em",
                }}
              >
                {mvp ? mvp.name : "Sem votos"}
              </span>
              {mvp?.isGoalkeeper && (
                <span
                  style={{
                    alignSelf: "flex-start",
                    backgroundColor: "#E5A93C",
                    color: "#1A2E22",
                    fontSize: 12,
                    fontWeight: 800,
                    padding: "2px 8px",
                    marginTop: 8,
                  }}
                >
                  GOLEIRO
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 24 }}>
              <span
                style={{
                  fontSize: 84,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: "#E5A93C",
                }}
              >
                {mvp ? mvp.avg.toFixed(1).replace(".", ",") : "0,0"}
              </span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 14, textTransform: "uppercase", fontWeight: 800, color: "#E5A93C" }}>
                  Nota da Partida
                </span>
                <span style={{ fontSize: 12, opacity: 0.75, textTransform: "uppercase", fontWeight: 700 }}>
                  {mvp?.votesCount ?? 0} {mvp?.votesCount === 1 ? "voto" : "votos"}
                </span>
              </div>
            </div>
          </div>

          {/* Outros 4 Melhores */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              justifyContent: "space-between",
            }}
          >
            {top4.length > 0 ? (
              top4.map((p, idx) => (
                <div
                  key={p.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#FFFFFF",
                    border: "3px solid #1A2E22",
                    padding: "16px 20px",
                    boxShadow: "4px 4px 0 #1A2E22",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 900,
                        color: "#9E2A2B",
                        width: 24,
                      }}
                    >
                      #{idx + 2}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: "#1A2E22" }}>
                        {p.name}
                      </span>
                      {p.isGoalkeeper && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#9E2A2B" }}>
                          GOLEIRO
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#1A2E22", opacity: 0.6, textTransform: "uppercase" }}>
                      Nota
                    </span>
                    <span
                      style={{
                        fontSize: 32,
                        fontWeight: 900,
                        color: "#1A2E22",
                        minWidth: 52,
                        textAlign: "right",
                      }}
                    >
                      {p.avg.toFixed(1).replace(".", ",")}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  border: "3px dashed #1A2E22",
                  padding: 24,
                  fontSize: 16,
                  color: "#1A2E22",
                  fontWeight: 700,
                }}
              >
                Aguardando mais avaliações registradas.
              </div>
            )}
          </div>
        </div>

        {/* Rodapé da Imagem */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            borderTop: "2px solid rgba(26, 46, 34, 0.25)",
            paddingTop: 16,
            marginTop: 16,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#1A2E22",
              opacity: 0.8,
            }}
          >
            tarde esportiva
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
