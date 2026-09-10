export default function SafetyNote({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`text-ink/55 ${compact ? "text-xs" : "text-sm"}`}>
      This tool suggests possible strategies and internal workflow guidance based on what you enter
      — it does not provide legal advice and nothing here guarantees a claim outcome. Use judgment,
      confirm anything claim-critical, and escalate when in doubt.
    </p>
  );
}
