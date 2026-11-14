# AskReady visual foundation

## Direction
Calm, professional preparation at a desk before a career conversation. Preserve the light scaffold’s plain language and task-first flow; introduce a warm paper surface, dark green action color, editorial serif headlines, and precise sans-serif controls. The product mechanism—practice, specific coaching, same-objection retry—leads the page.

## Tokens
- Page: `#f6f5ef`; elevated surface: `#fffefa`.
- Foreground: `#202b25`; secondary copy: `#58635b`.
- Primary action: `#245740`; hover: `#193f2e`; soft accent: `#e8eddf`.
- Borders: `#d9ddd3`; control borders: `#aeb8aa`.
- Error copy: `#8d352a` on `#fff1e9`.
- Display: self-hosted Newsreader Variable, weight 450, line height 1.04–1.12, tracking -0.025 to -0.035em.
- Body and controls: self-hosted DM Sans Variable, body line height 1.5–1.65.
- Main width: 1184px including 32px side gutters; 20px gutters on small screens.
- Panel radius: 16px; controls: 8px; minimum button height: 48px.

## Surface behavior
Landing is persuasive: a large editorial promise beside one explicitly labeled example objection, followed by the three-step practice mechanism and config-driven scenario cards. Coming-soon scenarios have no disabled fake links. Pricing separates an available free practice from planned Pro features and a real email waitlist. No paid entitlement or purchase confirmation is implied.

Practice and results are operational: the shared `page-shell`, `panel`, `field`, `btn-primary`, `btn-secondary`, `muted`, `status-note`, and `error-notice` classes provide a consistent foundation. Keep feedback estimates separate from delivery observations. Comparison can show lower scores as honestly as higher scores.

## Interaction and accessibility
Visible focus rings; native labeled inputs; explicit loading/error/success text; reduced-motion support; no decorative continuous animation; mobile single-column layout. Full content is rendered without JavaScript where possible. Fonts are bundled rather than loaded from a third-party font service at runtime.

## Evidence and limits
Example objection is labeled as illustrative, not a saved user transcript or generated session. No testimonials, outcome metrics, or guaranteed career results. Desktop and 390px mobile layouts were inspected during the passing production Chrome acceptance run on November 14, 2026; physical Safari/iPhone audio remains a manual check.
