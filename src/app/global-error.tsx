"use client";

/** Last-resort boundary; renders its own document without global styles. */
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#14151c",
          color: "#f1f2f6",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <title>Error · English Mode</title>
        <main style={{ maxWidth: "22rem", padding: "1.5rem" }}>
          <h1 style={{ fontSize: "1.35rem" }}>Something went wrong</h1>
          <p lang="tr" style={{ color: "#a9adbd" }}>
            Uygulama yüklenemedi. Verilerin güvende; tekrar dene.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 48,
              padding: "0 1.5rem",
              border: 0,
              borderRadius: 10,
              background: "#f2b34a",
              color: "#2a1d08",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
