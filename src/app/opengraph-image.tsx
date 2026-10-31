import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
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
          {/* 3 Stars */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              marginBottom: 20,
              color: "#d9a520",
              fontSize: 36,
            }}
          >
            <span>★</span>
            <span style={{ fontSize: 50 }}>★</span>
            <span>★</span>
          </div>

          {/* Main Title */}
          <div
            style={{
              fontSize: 78,
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

          {/* Tag / Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "rgba(217, 165, 32, 0.15)",
              border: "2px solid #d9a520",
              borderRadius: 14,
              padding: "10px 32px",
              marginBottom: 28,
            }}
          >
            <span
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#d9a520",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              CÉDULA DE VOTAÇÃO • PÓS-JOGO
            </span>
          </div>

          {/* Footer note */}
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#a9bcae",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            Futebol • Estatísticas • Avaliação dos Jogadores
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
