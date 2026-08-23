import type { ReactNode } from "react";

/**
 * Immer sichtbare Quellen-Gruppe. Ersetzt das frühere LazyDetails-Accordion:
 * jede Source und jede Sub-Source steht ohne Klick im Markup.
 */
export default function SourceGroupPanel({
  id,
  head,
  children,
}: {
  id: string;
  head: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="sourceGroupPanel">
      <header className="sourceGroupHead">{head}</header>
      <div className="sourceGroupBody">{children}</div>
    </section>
  );
}
