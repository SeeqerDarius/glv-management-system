// app/loading.tsx  OR  app/(dashboard)/loading.tsx

export default function Loading() {
  return (
    <div className="glv-loading-screen">
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full"
          style={{
            width: "4.5rem",
            height: "4.5rem",
            border: "2px solid rgba(184,237,78,0.15)",
            borderTopColor: "rgba(184,237,78,0.6)",
            animation: "glv-loading-spin 1.2s linear infinite",
          }}
        />
        <div
          className="glv-brand-mark relative z-10"
          style={{ width: "2.25rem", height: "2.25rem", fontSize: "0.6875rem" }}
        >
          GLV
        </div>
      </div>
      <div className="glv-loading-line" style={{ width: "5rem", marginTop: "0.5rem" }}>
        <span />
      </div>
      <p className="glv-loading-text">Loading…</p>
    </div>
  );
}