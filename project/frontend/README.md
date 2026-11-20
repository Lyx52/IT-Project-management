# FindIT frontend

The Angular 22 single-page app for FindIT, with Bootstrap 5 and Leaflet. Unit tests use Vitest.

Setup, the full feature list and production are covered in the [main README](../../README.md). The API it talks to is documented in [`../backend/API.md`](../backend/API.md).

## Running

The app runs in the `frontend` Docker container (see the main README) and is served at http://localhost:4200 with live reload. Run commands inside the container:

```bash
docker compose exec frontend npx ng test --watch=false     # unit tests
docker compose exec frontend npx prettier --write src      # format (CI checks this)
docker compose exec frontend npx ng build                  # production build into dist/
docker compose exec frontend npx ng generate component <name>
```

## API address

| Build | File | `apiBaseUrl` |
|-------|------|--------------|
| Development (`ng serve`) | `src/environments/environment.development.ts` | `http://localhost:8001/api/v1` |
| Production | `src/environments/environment.ts` | `/api/v1` (same origin; Caddy forwards it to the backend) |

## Layout

```
src/app/
  pages/        One folder per route (see app.routes.ts): home, items, map, post, my-posts,
                saved-searches, messages, login, register, terms, privacy, admin
  components/   Shared pieces: header, notification bell, messenger, item card and form,
                report dialog, and the admin panel tabs (admin-pending-posts, admin-reports,
                admin-users, admin-categories, admin-statistics)
  services/     HTTP clients for the API (auth, posts, messages, notifications,
                saved searches, admin) and the bearer-token interceptor
  guards/       authGuard (signed in) and adminGuard (role admin)
  captcha/      Sign-up CAPTCHA, including the Web Worker that solves the hash puzzle
  models/       TypeScript types for API responses
  utils/        Small helpers
```

The admin page (`/admin`) is lazy-loaded and guarded by `adminGuard`, so ordinary users never download it. The header shows the **Moderation** link only to admins.
