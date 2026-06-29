import Link from "next/link";

type ButtonTone = "primary" | "secondary" | "danger";

export function ButtonLink({
  href,
  children,
  tone = "primary",
}: {
  href: string;
  children: React.ReactNode;
  tone?: ButtonTone;
}) {
  return (
    <Link href={href} className={`button ${tone}`}>
      {children}
    </Link>
  );
}

export function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return <ButtonLink href={href}>{children}</ButtonLink>;
}

export function SecondaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return <ButtonLink href={href} tone="secondary">{children}</ButtonLink>;
}
