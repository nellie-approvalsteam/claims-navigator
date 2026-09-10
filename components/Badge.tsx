const COLORS: Record<string, string> = {
  teal: "bg-teal-100 text-teal-800",
  brass: "bg-brass-400/20 text-brass-600",
  rust: "bg-rust-500/10 text-rust-600",
  gray: "bg-ink/5 text-ink/60",
};

export default function Badge({
  children,
  color = "teal",
}: {
  children: React.ReactNode;
  color?: keyof typeof COLORS;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${COLORS[color]}`}
    >
      {children}
    </span>
  );
}
