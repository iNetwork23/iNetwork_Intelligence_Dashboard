# Account recovery and mobile keyboard navigation

Production evidence on 8 September 2026: the default 30-day page displayed a generic database failure when only 12 Berlin days had been rebuilt. It also removed the period selector. The already complete seven-day range loaded normally when opened directly. The retry link discarded the selected range and view.

The data guard still rejects every incomplete period before returning facts. Its missing-day error now has a distinct type; the page can explain incomplete coverage without printing arbitrary backend errors. Both unavailable-data states keep the shared period controls, and a normal reload link retains the current period, custom dates, view and company filter. Invalid custom dates cannot break the recovery UI. Authentication, capability and rejected-scope handling remain ahead of recovery.

The regression mounts the actual asynchronous page and real period controls, obtains its coverage error from the actual Berlin proof guard, and verifies navigation with preserved filters. It also covers custom-range retry, invalid dates, hidden backend details and both access-denial boundaries. The first three behavioral cases failed on the previous production code.

The authenticated browser session is available again. Separate unauthenticated read-only production checks confirmed login redirects for 12 protected paths plus one scoped URL, eight API denials with error-only 401 responses, and successful delivery of the login, manifest, worker and three icon assets. These checks do not replace allowed/denied role fixtures, real device delivery, complete imports or provider write/rollback acceptance.

Independent review also exercised a real 403-day reporting range. Its missing-day count previously matched the old generic "403" string check. A typed incomplete-coverage error now takes precedence; actual scope/capability denials retain the existing behavior.

At 390×844, pressing Tab from the closed navigation opener focused the off-screen Edit button at x=-89.7 to -30. The closed mobile drawer now has CSS visibility protection before hydration and is inert after hydration. Opening it focuses an explicit close control and exposes a labelled modal dialog. Tab/Shift+Tab remain inside the open drawer; Escape or the close button restores focus to the opener. Resizing to desktop releases the modal state and keeps desktop links available. The existing delayed English hydration check remains part of validation.

The exact reviewed release and subsequent browser results are recorded in the current Asana entries and the user-facing execution report. No SQL migration, provider mutation, user/role change or OneSignal operation is part of this change.
