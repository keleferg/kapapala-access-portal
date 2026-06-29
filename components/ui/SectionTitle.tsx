export default function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="section-title">
      {eyebrow && <p>{eyebrow}</p>}
      <h2>{title}</h2>
      {description && <span>{description}</span>}
    </div>
  );
}
