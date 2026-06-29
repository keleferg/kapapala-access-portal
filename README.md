# Kapāpala Access Portal — Version 1.0 UI Framework

This is a clean Next.js UI foundation for the Kapāpala Access Portal.

## Pages included

- Public landing page: `/`
- User dashboard: `/dashboard`
- Access account application: `/apply`
- Daily access request: `/request-access`
- Admin dashboard: `/admin`
- Gate combinations: `/admin/gates`

## Install and run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Recommended install into your existing project

1. Stop your dev server with `Ctrl + C`.
2. Back up your current project folder.
3. Copy the `app`, `components`, `lib`, `db`, `docs`, `public`, `package.json`, `tsconfig.json`, `next.config.js`, `.env.example`, and `README.md` files from this package into your project.
4. Run `npm install`.
5. Run `npm run dev`.

This version intentionally removes the old `Header.tsx` page dependency and uses `components/layout/AppShell.tsx` instead.
