# Backend (Supabase)

This folder contains everything needed to stand up the backend using Supabase (Postgres + PostgREST + Storage).

## Setup

1. Create a Supabase project and grab `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_ANON_KEY`.
2. Run the SQL in `schema.sql` then `policies.sql` in the Supabase SQL editor (or `supabase db push` if you wire these into migrations).
3. Create a storage bucket for photos:
   ```sql
   select storage.create_bucket('recipe-images', public => true);
   ```
   The bucket policies in `policies.sql` assume this bucket id.
4. Optional seed data: insert a few `ingredients` rows so recipe ingredient entries can reference them.

## Data model (high level)

- `profiles` (mirrors `auth.users`), `ingredients` catalog.
- `recipes`, `recipe_ingredients`, `recipe_steps`, plus `recipe_nutrition` view for quick macro totals.
- Social: `follows`, `likes`, `saves`, `comments`.
- Planning: `meal_plans`, `meal_plan_items`, `shopping_lists`, `shopping_list_items`.
- Storage bucket `recipe-images` for photos (public read, auth upload/edit).
- RPC helpers:
  - `search_recipes(search, diet_filters, cuisine_filters, max_total_time)`
  - `toggle_like(recipe_id)`
  - `toggle_save(recipe_id)`
  - `generate_shopping_list_from_meal_plan(meal_plan_id)`
  - `recommend_recipes(limit_count)`

## Auth patterns

- Use Supabase email/password or magic links.
- When a user signs in, upsert `profiles` with `id = auth.uid()` and optional `username`.
  ```bash
  curl -X POST "$SUPABASE_URL/rest/v1/profiles" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Prefer: resolution=merge-duplicates" \
    -H "Content-Type: application/json" \
    -d '{"id":"<auth uid>","username":"demo","full_name":"Demo User"}'
  ```

## Example REST flows (PostgREST)

Replace `TOKEN` with a user access token from `supabase.auth.signIn...`.

- Create recipe
  ```bash
  curl -X POST "$SUPABASE_URL/rest/v1/recipes" \
    -H "Authorization: Bearer TOKEN" -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Prefer: return=representation" -H "Content-Type: application/json" \
    -d '{"title":"Pasta","description":"Fast dinner","author_id":"<uid>","cuisine":"italian","tags":["weeknight"],"prep_time_minutes":10,"cook_time_minutes":12,"servings":2}'
  ```
- Add ingredients/steps
  ```bash
  curl -X POST "$SUPABASE_URL/rest/v1/recipe_ingredients" \
    -H "Authorization: Bearer TOKEN" -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" -d '[{"recipe_id":"<recipe>","name":"Spaghetti","quantity":200,"unit":"g"},{"recipe_id":"<recipe>","name":"Tomato sauce","quantity":1,"unit":"cup"}]'

  curl -X POST "$SUPABASE_URL/rest/v1/recipe_steps" \
    -H "Authorization: Bearer TOKEN" -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" -d '[{"recipe_id":"<recipe>","step_number":1,"instruction":"Boil pasta"},{"recipe_id":"<recipe>","step_number":2,"instruction":"Heat sauce"}]'
  ```
- Feed/search (with engagement info)
  ```bash
  curl -X POST "$SUPABASE_URL/rest/v1/rpc/search_recipes" \
    -H "Authorization: Bearer TOKEN" -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"search":"pasta","cuisine_filters":["italian"],"max_total_time":30}'
  ```
- Toggle like / save
  ```bash
  curl -X POST "$SUPABASE_URL/rest/v1/rpc/toggle_like" \
    -H "Authorization: Bearer TOKEN" -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" -d '{"p_recipe_id":"<recipe>"}'
  ```
- Comments
  ```bash
  curl -X POST "$SUPABASE_URL/rest/v1/comments" \
    -H "Authorization: Bearer TOKEN" -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"recipe_id":"<recipe>","user_id":"<uid>","content":"Looks great!"}'
  ```
- Meal planning + shopping list
  ```bash
  curl -X POST "$SUPABASE_URL/rest/v1/meal_plans" \
    -H "Authorization: Bearer TOKEN" -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Prefer: return=representation" -H "Content-Type: application/json" \
    -d '{"title":"This week","user_id":"<uid>","start_date":"2024-01-01","end_date":"2024-01-07"}'

  curl -X POST "$SUPABASE_URL/rest/v1/meal_plan_items" \
    -H "Authorization: Bearer TOKEN" -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"meal_plan_id":"<plan>","recipe_id":"<recipe>","scheduled_for":"2024-01-02","meal":"dinner"}'

  curl -X POST "$SUPABASE_URL/rest/v1/rpc/generate_shopping_list_from_meal_plan" \
    -H "Authorization: Bearer TOKEN" -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"p_meal_plan_id":"<plan>"}'
  ```
- Recommendations
  ```bash
  curl -X POST "$SUPABASE_URL/rest/v1/rpc/recommend_recipes" \
    -H "Authorization: Bearer TOKEN" -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"limit_count":12}'
  ```

## Buckets / image uploads

- Upload via storage API with user token; object key format `user-id/recipe-id/<filename>`.
- Images are public-read; deletes/updates require ownership (policy uses `owner` column).

## Notes

- All tables have RLS enabled. Public read is limited to public recipes; plans/shopping lists are private to owners.
- Use the service role key only from backend/CI to manage `ingredients` catalog or to bypass RLS.

