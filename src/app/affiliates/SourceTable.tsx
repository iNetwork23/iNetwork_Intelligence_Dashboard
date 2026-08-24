import type { ReactNode } from "react";

/**
 * Immer sichtbare Quellen-Gruppe im gemeinsamen Verdikt-Vokabular
 * (verdient / verbrennt / neutral) aller Quellen-Ansichten.
 */
export default function SourceGroupPanel({
  id,
  head,
  verdict = "neutral",
  children,
}: {
  id: string;
  head: ReactNode;
  verdict?: "verdient" | "verbrennt" | "neutral";
  children: ReactNode;
}) {
  return (
    <section id={id} className={`sourceGroupPanel ${verdict}`}>
      <header className="sourceGroupHead">{head}</header>
      <div className="sourceGroupBody">{children}</div>
    </section>
  );
}
