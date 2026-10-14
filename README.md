# CoNectar

CoNectar helps people who spend time in men's and women's circles find one another through the resources they offer. Members can publish profiles and resources, browse members, and use People Search to find help through chat.

The app uses Next.js, Supabase, and Vercel. [CONTEXT.md](./CONTEXT.md) defines the audience, domain language, and current affiliated-community catalog. Invite mechanics are unchanged.

## Run locally

Use `pnpm install`, start the local Supabase stack with `supabase start`, and pull the development environment with `vercel env pull`. Then run `pnpm dev` and open http://localhost:3000.

## Brand and appearance

The source of truth is [CoNectar Brandbook.pdf](./CoNectar%20Brandbook.pdf). The app uses the device's light or dark appearance by default. The appearance icon switches directly to the other mode and saves that choice. The desktop navigation contains Chat, Membri, Profil, Admin when applicable, sign out, and appearance; mobile keeps the menu drawer.

The honey pot mark is [Twemoji](https://github.com/twitter/twemoji) artwork, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It is used unchanged as `public/honey-pot.svg` so the mark renders consistently across devices.

## Checks

Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`. Tests that use the database require the local Supabase stack.
