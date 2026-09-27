# assets/fonts/

The two faces the page's canvas text is drawn in — the Companion Core's screen texture uses them — vendored so
every capture is the same picture offline:

| File | Face | Licence |
|---|---|---|
| `manrope-latin-var.woff2` | Manrope, variable `wght` 200–800, Latin subset | OFL-1.1 — `LICENSE-Manrope.txt` |
| `jetbrains-mono-latin-var.woff2` | JetBrains Mono, variable `wght` 100–800, Latin subset | OFL-1.1 — `LICENSE-JetBrains-Mono.txt` |

Byte-identical copies of CI-Common's `styles/fonts/files/` (themselves copied out of
`@fontsource-variable/*` 5.3.0). The pages still link Google Fonts; `scripts/test-goldens.mts` and
`scripts/test-frame-hash.mts` intercept that stylesheet and serve these files instead, so a golden never
depends on the network. Replace them only together with a deliberate re-bless of the goldens.
