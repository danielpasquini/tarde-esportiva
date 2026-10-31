import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  const starPath =
    "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#16281e",
          position: "relative",
          padding: "48px",
        }}
      >
        {/* Accent Bar at top: Azul - Vermelho - Preto - Amarelo */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 16,
            display: "flex",
          }}
        >
          <div style={{ flex: 1, backgroundColor: "#2c4a6e" }} />
          <div style={{ flex: 1, backgroundColor: "#9e2a2b" }} />
          <div style={{ flex: 1, backgroundColor: "#1f1f1f" }} />
          <div style={{ flex: 1, backgroundColor: "#d9a520" }} />
        </div>

        {/* Card Frame */}
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid rgba(217, 165, 32, 0.35)",
            borderRadius: 24,
            backgroundColor: "#14241b",
            padding: "40px",
            position: "relative",
          }}
        >
          {/* 3 SVG Stars */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#d9a520">
              <path d={starPath} />
            </svg>
            <svg width="54" height="54" viewBox="0 0 24 24" fill="#d9a520">
              <path d={starPath} />
            </svg>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#d9a520">
              <path d={starPath} />
            </svg>
          </div>

          {/* Main Title */}
          <div
            style={{
              fontSize: 84,
              fontWeight: 900,
              color: "#f6f4ef",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textAlign: "center",
              lineHeight: 1.05,
              marginBottom: 20,
            }}
          >
            TARDE ESPORTIVA
          </div>

          {/* Subtitle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#d9a520",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Futebol, histórico de partidas, notas
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
