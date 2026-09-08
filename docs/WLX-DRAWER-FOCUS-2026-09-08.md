# Native drawer focus follow-up

The deployed frame retry passed isolated tests, but native browser acceptance still observed focus behind the open drawer. Keyboard containment and Escape worked after focus entered it. A single animation frame did not prove that the animated drawer was fully on screen.

When the sidebar's own opening transform transition finishes, it now retries focus only if the drawer is still mobile/open and focus remains outside. Existing internal focus, closing transitions and descendant transitions do not steal focus. The immediate and cancellable frame attempts remain for non-animated rendering. The actual browser acceptance remains required; this event-bound fallback alone is not evidence of success.
