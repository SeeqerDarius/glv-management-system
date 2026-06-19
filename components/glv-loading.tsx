export function GlvLoading({ compact = false, label = "Loading" }: { compact?: boolean; label?: string }) {
  if (compact) {
    return <span className="inline-flex items-center gap-2"><span className="glv-loading-mark glv-loading-mark-compact">GLV</span><span>{label}</span></span>;
  }

  return (
    <div className="glv-loading-screen" role="status" aria-live="polite">
      <div className="glv-loading-mark">GLV</div>
      <div className="glv-loading-line"><span /></div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
