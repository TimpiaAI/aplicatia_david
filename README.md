# Recipe Sharing & Meal Planning

This repo contains:
- `backend/`: Supabase SQL schema, policies, and REST/RPC examples.
- `frontend/`: Minimal Next.js UI to exercise the flows (auth, recipes, social feed, meal planner, shopping lists).

## Quick start

1) Set up Supabase: run `backend/schema.sql` then `backend/policies.sql`, and create the `recipe-images` storage bucket.  
2) Frontend: see `frontend/README.md` for environment variables and `npm run dev`.

The app uses Supabase REST and storage only—no custom server code required. Use the service role key only for migrations/seed tasks; everything else runs with the anon/user keys via RLS.
