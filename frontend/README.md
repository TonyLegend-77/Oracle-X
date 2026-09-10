# MHC frontend

Next.js app router. `/` is the public landing page: nav, hero, live stats
strip, the no-wallet demo, an "on OKX.AI" banner, feature cards, footer.
`/dashboard` is a bare-bones authenticated test page, not the production
account experience (that's the OKX AI Marketplace listing).

Copy `.env.example` to `.env.local` and set all four vars: `NEXT_PUBLIC_API_URL`
(your backend), `NEXT_PUBLIC_OKX_LISTING_URL`, `NEXT_PUBLIC_TWITTER_URL`,
`NEXT_PUBLIC_GITHUB_URL`. Nav and footer both read from
`components/SocialLinks.jsx`, so those four env vars are the only place you
need to update handles.

## Video background

The hero has a `<video>` tag wired up and styled at low opacity so it never
fights with the headline. Drop `hero-bg.mp4` and `hero-poster.jpg` into
`/public` and it picks them up automatically. If you decide against a video,
delete the `<video>` block in `app/page.jsx`, the hero still works fine
without it.
