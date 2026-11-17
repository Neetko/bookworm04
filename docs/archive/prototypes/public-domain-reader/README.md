# Public-domain reader prototype

This directory preserves the earlier animated page-turning reader experiment outside the application route tree. It is not imported or shipped as a reachable feature. The maintained implementation brief is `docs/roadmap/public-domain-reader.md`.

The intended future product direction is a reader launched from `/titles/[id]` only for titles whose full text is demonstrably in the public domain and available from an approved source.

Before implementation, the prototype needs:

- a title-level eligibility and source/licensing model;
- ingestion and storage for verified public-domain text;
- a server-authorized reader route under the canonical `titles` model;
- replacement of the remote CodePen font and sprite with committed, licensed assets;
- scoped styles that do not modify global `:root` behavior;
- persisted reading position, accessibility, responsive behavior, and reduced-motion support;
- unit, authorization, and browser journey tests.

The preserved files are design/interaction reference only and should not be re-enabled directly.
