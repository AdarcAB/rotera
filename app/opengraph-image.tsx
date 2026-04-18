import { ImageResponse } from "next/og";

export const alt = "Rotera — byten som faktiskt blir rättvisa";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #22c55e 0%, #15803d 60%, #14532d 100%)",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
          padding: "90px",
          position: "relative",
        }}
      >
        {/* Decorative rotation ring */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            border: "3px dashed rgba(255,255,255,0.18)",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -260,
            left: -260,
            width: 700,
            height: 700,
            border: "3px dashed rgba(255,255,255,0.12)",
            borderRadius: "50%",
            display: "flex",
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 20,
              background: "rgba(255,255,255,0.15)",
              border: "2px solid rgba(255,255,255,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 60,
              fontWeight: 800,
            }}
          >
            R
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, opacity: 0.95 }}>
            Rotera
          </div>
        </div>

        <div
          style={{
            fontSize: 92,
            fontWeight: 800,
            lineHeight: 1.05,
            maxWidth: 960,
            letterSpacing: "-0.02em",
          }}
        >
          Byten som faktiskt blir rättvisa.
        </div>

        <div
          style={{
            fontSize: 36,
            marginTop: 28,
            opacity: 0.9,
            maxWidth: 900,
            lineHeight: 1.35,
          }}
        >
          Speltidsgaranti, positionsrotation och live-läge för barn- och
          ungdomstränare.
        </div>
      </div>
    ),
    { ...size }
  );
}
