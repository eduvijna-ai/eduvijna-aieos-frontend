export function StatusBadge({
  label,
  kind,
}: {
  label: string;
  kind?: string;
}) {
  const modifier = (kind ?? label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return (
    <span className={`status-badge${modifier ? ` status-badge--${modifier}` : ""}`}>
      {label}
    </span>
  );
}
