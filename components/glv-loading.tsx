type GlvLoadingProps = {
  compact?: boolean;
  label?: string;
};

export function GlvLoading({
  compact = false,
  label = "Loading…",
}: GlvLoadingProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div
          className="glv-loading-ring"
          style={{
            width: "1.25rem",
            height: "1.25rem",
            borderWidth: "2px",
          }}
        />
        <span className="text-xs text-muted-foreground font-medium">
          {label}
        </span>
      </div>
    );
  }

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
          className="absolute rounded-full"
          style={{
            width: "3.25rem",
            height: "3.25rem",
            border: "2px solid rgba(184,237,78,0.08)",
            borderBottomColor: "rgba(184,237,78,0.35)",
            animation: "glv-loading-spin 0.8s linear infinite reverse",
          }}
        />

        <div
          className="glv-brand-mark relative z-10"
          style={{
            width: "2.25rem",
            height: "2.25rem",
            fontSize: "0.6875rem",
          }}
        >
          GLV
        </div>
      </div>

      <div
        className="glv-loading-line"
        style={{
          width: "5rem",
          marginTop: "0.5rem",
        }}
      >
        <span />
      </div>

      <p className="glv-loading-text">{label}</p>
    </div>
  );
}