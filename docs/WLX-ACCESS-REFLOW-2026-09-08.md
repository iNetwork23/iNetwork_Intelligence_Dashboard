# Access console toolbar reflow

At the live 768px viewport, the Activity log button extended beyond its horizontally scrolling tab container. Native Tab focus did not reveal the complete button; its center was obscured by the adjacent create-user area. The document itself did not overflow.

The toolbar and tab group now wrap at their available width. Tab labels remain intact, and the create-user action moves to another line when needed. Existing mobile control sizing and the vertical mobile toolbar are retained. No access, role, session or user mutations change.

The acceptance check is native browser geometry and keyboard focus at 1440, 768 and 390px, in DE and EN. CSS source matching or jsdom geometry would not establish this layout behavior. The repository suite and immutable release gates remain required before production deployment.
