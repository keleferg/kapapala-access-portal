type StatusTone = "green" | "yellow" | "red" | "gray";

export default function StatusBadge({
  label,
  tone = "green",
}: {
  label: string;
  tone?: StatusTone;
}) {
  return <span className={`status-badge ${tone}`}>{label}</span>;
}
