"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en-BZ">
      <body
        style={{
          margin: 0,
          background: "#070b14",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            textAlign: "center",
          }}
        >
          <div>
            <h1>YuhBusiness could not load</h1>
            <p style={{ color: "#94a3b8" }}>
              Please retry. No form or transaction was submitted by this error.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 16,
                border: 0,
                borderRadius: 12,
                background: "#7c3aed",
                color: "white",
                padding: "12px 20px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
