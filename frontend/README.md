# Frontend (Next.js)

A minimal Next.js App Router UI to exercise the Supabase backend: sign in, create recipes, browse the feed with social actions, build a meal plan, and generate shopping lists.

## Setup

1. Copy `.env.example` to `.env.local` and fill in your Supabase values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
2. Install dependencies:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. The UI is intentionally small:
   - **AuthSection**: email/password sign-in/out.
   - **RecipeForm**: create recipes + ingredients + steps, optional public/private.
   - **RecipeFeed**: search/filter public recipes, like/save, comment.
   - **MealPlanner**: create plans and schedule recipes.
   - **ShoppingList**: generate a list from a plan via `generate_shopping_list_from_meal_plan` RPC and check items off.

## Notes

- Upload images to the `recipe-images` bucket and paste the object URL in the form.
- The app uses client-side Supabase calls only (no API routes), so it requires the anon key and relies on RLS for safety.
