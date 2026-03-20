import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SaaS Starter - Ship your SaaS faster";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          backgroundImage:
            "radial-gradient(circle at 25px 25px, #333 2%, transparent 0%), radial-gradient(circle at 75px 75px, #333 2%, transparent 0%)",
          backgroundSize: "100px 100px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              backgroundColor: "#3b82f6",
              marginRight: 20,
            }}
          >
            <span style={{ fontSize: 40, fontWeight: "bold", color: "white" }}>
              S
            </span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 60,
            fontWeight: "bold",
            color: "white",
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          Ship your SaaS faster
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "#a1a1aa",
            marginTop: 20,
            textAlign: "center",
          }}
        >
          Auth, Payments, Teams, Email — all pre-configured
        </div>
      </div>
    ),
    { ...size }
  );
}
