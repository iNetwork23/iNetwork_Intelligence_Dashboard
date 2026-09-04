import type { ReactNode } from "react";

/**
 * Immer sichtbare Quellen-Gruppe im gemeinsamen Verdikt-Vokabular
 * (verdient / verbrennt / neutral) aller Quellen-Ansichten.
 * `blocked` kennzeichnet eine Hauptquelle mit aktiver oder unklarer Sperre.
 */
export default function SourceGroupPanel({
  id,
  head,
  verdict = "neutral",
  blocked = false,
  children,
}: {
  id: string;
  head: ReactNode;
  verdict?: "verdient" | "verbrennt" | "neutral";
  blocked?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`sourceGroupPanel ${verdict}${blocked ? " blocked" : ""}`}>
      <header className="sourceGroupHead">{head}</header>
      <div className="sourceGroupBody">{children}</div>
    </section>
  );
}
