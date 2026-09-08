# Access console toolbar reflow

At the live 768px viewport, the Activity log button extended beyond its horizontally scrolling tab container. Native Tab focus did not reveal the complete button; its center was obscured by the adjacent create-user area. The document itself did not overflow.

The toolbar and tab group now wrap at their available width. Tab labels remain intact, and the create-user action moves to another line when needed. Existing mobile control sizing and the vertical mobile toolbar are retained. No access, role, session or user mutations change.

The acceptance check is native browser geometry and keyboard focus at 1440, 768 and 390px, in DE and EN. CSS source matching or jsdom geometry would not establish this layout behavior. The repository suite and immutable release gates remain required before production deployment.

Native acceptance of the preceding sidebar release also found that initial focus could fail while the browser revealed the formerly inert subtree. Tab containment and Escape worked once focus entered the drawer. A cancellable animation-frame retry now moves focus into the visible drawer if the immediate focus attempt failed. It preserves focus if the user already entered the drawer, and closing or resizing cancels the pending retry.

The same period acceptance found that rolling ranges crossing a month or year omitted the start month/year (for example, 90 days appeared as `11.–08.09.2026`, although the start was 11 June). Both calendar dates are now displayed in full. Inclusive range boundaries and Berlin timezone calculations are unchanged; focused tests cover month/year boundaries and Berlin midnight.
