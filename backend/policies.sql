-- Row Level Security policies for Supabase

alter table public.profiles enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.comments enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;

-- Profiles
create policy "profiles are public" on public.profiles
  for select using (true);
create policy "user can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "user can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Ingredients (service role manages catalog)
create policy "ingredients readable" on public.ingredients
  for select using (true);
create policy "ingredients managed by service role" on public.ingredients
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Recipes
create policy "public recipes visible" on public.recipes
  for select using (is_public = true or auth.uid() = author_id);
create policy "user can insert recipe" on public.recipes
  for insert with check (auth.uid() = author_id);
create policy "user can modify own recipe" on public.recipes
  for update using (auth.uid() = author_id);
create policy "user can delete own recipe" on public.recipes
  for delete using (auth.uid() = author_id);

-- Recipe ingredients
create policy "ingredients visible via accessible recipes" on public.recipe_ingredients
  for select using (
    exists(select 1 from public.recipes r where r.id = recipe_id and (r.is_public or r.author_id = auth.uid()))
  );
create policy "author manages recipe ingredients" on public.recipe_ingredients
  for all using (
    exists(select 1 from public.recipes r where r.id = recipe_id and r.author_id = auth.uid())
  ) with check (
    exists(select 1 from public.recipes r where r.id = recipe_id and r.author_id = auth.uid())
  );

-- Recipe steps
create policy "steps visible via accessible recipes" on public.recipe_steps
  for select using (
    exists(select 1 from public.recipes r where r.id = recipe_id and (r.is_public or r.author_id = auth.uid()))
  );
create policy "author manages recipe steps" on public.recipe_steps
  for all using (
    exists(select 1 from public.recipes r where r.id = recipe_id and r.author_id = auth.uid())
  ) with check (
    exists(select 1 from public.recipes r where r.id = recipe_id and r.author_id = auth.uid())
  );

-- Follows
create policy "follows are public" on public.follows
  for select using (true);
create policy "user can follow/unfollow" on public.follows
  for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- Likes
create policy "likes are public" on public.likes
  for select using (true);
create policy "user can like/unlike" on public.likes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Saves
create policy "saves are private to user" on public.saves
  for select using (auth.uid() = user_id);
create policy "user can save/unsave" on public.saves
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Comments
create policy "comments readable if recipe accessible" on public.comments
  for select using (
    exists(
      select 1 from public.recipes r where r.id = recipe_id and (r.is_public or r.author_id = auth.uid())
    )
  );
create policy "user can comment" on public.comments
  for insert with check (auth.uid() = user_id);
create policy "user can edit own comment" on public.comments
  for update using (auth.uid() = user_id);
create policy "user can delete own comment" on public.comments
  for delete using (auth.uid() = user_id);

-- Meal plans
create policy "owner can read plan" on public.meal_plans
  for select using (auth.uid() = user_id);
create policy "owner can manage plan" on public.meal_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Meal plan items
create policy "owner can read plan items" on public.meal_plan_items
  for select using (
    exists(select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid())
  );
create policy "owner can manage plan items" on public.meal_plan_items
  for all using (
    exists(select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid())
  ) with check (
    exists(select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid())
  );

-- Shopping lists
create policy "owner can read lists" on public.shopping_lists
  for select using (auth.uid() = user_id);
create policy "owner can manage lists" on public.shopping_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Shopping list items
create policy "owner can read list items" on public.shopping_list_items
  for select using (
    exists(select 1 from public.shopping_lists sl where sl.id = shopping_list_id and sl.user_id = auth.uid())
  );
create policy "owner can manage list items" on public.shopping_list_items
  for all using (
    exists(select 1 from public.shopping_lists sl where sl.id = shopping_list_id and sl.user_id = auth.uid())
  ) with check (
    exists(select 1 from public.shopping_lists sl where sl.id = shopping_list_id and sl.user_id = auth.uid())
  );

-- Storage bucket policies (recipe-images)
-- Run after creating the bucket: select storage.create_bucket('recipe-images', public => true);
create policy "public read recipe images" on storage.objects
  for select using (bucket_id = 'recipe-images');
create policy "authenticated upload recipe images" on storage.objects
  for insert with check (bucket_id = 'recipe-images' and auth.role() = 'authenticated');
create policy "owner can update recipe images" on storage.objects
  for update using (bucket_id = 'recipe-images' and auth.uid() = owner) with check (bucket_id = 'recipe-images' and auth.uid() = owner);
create policy "owner can delete recipe images" on storage.objects
  for delete using (bucket_id = 'recipe-images' and auth.uid() = owner);

