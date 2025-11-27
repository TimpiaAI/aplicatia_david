-- Supabase schema for Recipe Sharing & Meal Planning
-- Run in the Supabase SQL editor or via `supabase db push`.

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Profiles mirror auth.users; keep lightweight and user-managed
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  bio text,
  dietary_preferences text[],          -- e.g. {vegan, gluten-free}
  cuisine_preferences text[],          -- e.g. {mediterranean, mexican}
  created_at timestamptz default now()
);

-- Ingredient catalog with optional nutrition metadata
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_unit text,
  calories_per_unit numeric,
  protein_per_unit numeric,
  carbs_per_unit numeric,
  fat_per_unit numeric,
  created_at timestamptz default now()
);

-- Recipes
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  cuisine text,
  difficulty text,
  tags text[],
  prep_time_minutes int,
  cook_time_minutes int,
  servings int,
  is_public boolean default true,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  search_vector tsvector generated always as (
    to_tsvector('english',
      coalesce(title,'') || ' ' ||
      coalesce(description,'') || ' ' ||
      array_to_string(coalesce(tags,'{}'), ' ')
    )
  ) stored
);

-- Recipe ingredients (per recipe)
create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id),
  name text not null,      -- denormalized for quick display
  quantity numeric,
  unit text,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric
);

-- Recipe steps / directions
create table if not exists public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  step_number int not null,
  instruction text not null
);

-- Social features
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, recipe_id)
);

create table if not exists public.saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, recipe_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- Meal planning
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create type public.meal_type as enum ('breakfast','lunch','dinner','snack');

create table if not exists public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  scheduled_for date not null,
  meal meal_type not null default 'dinner',
  position int default 0
);

-- Shopping lists
create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  generated_from_meal_plan uuid references public.meal_plans(id) on delete set null,
  status text default 'draft',
  created_at timestamptz default now()
);

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists(id) on delete cascade,
  ingredient text not null,
  quantity numeric,
  unit text,
  recipe_id uuid references public.recipes(id) on delete set null,
  checked boolean default false
);

-- Simple nutrition snapshot by recipe for lightweight queries
create view public.recipe_nutrition as
select
  r.id as recipe_id,
  coalesce(sum(ri.calories), 0) as calories,
  coalesce(sum(ri.protein), 0) as protein,
  coalesce(sum(ri.carbs), 0) as carbs,
  coalesce(sum(ri.fat), 0) as fat
from public.recipes r
left join public.recipe_ingredients ri on ri.recipe_id = r.id
group by r.id;

-- Updated-at trigger helper
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recipes_touch_updated_at on public.recipes;
create trigger recipes_touch_updated_at
before update on public.recipes
for each row
execute function public.touch_updated_at();

drop trigger if exists meal_plans_touch_updated_at on public.meal_plans;
create trigger meal_plans_touch_updated_at
before update on public.meal_plans
for each row
execute function public.touch_updated_at();

-- Indexes
create index if not exists recipes_search_idx on public.recipes using gin (search_vector);
create index if not exists recipes_author_idx on public.recipes (author_id);
create index if not exists recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);
create index if not exists recipe_steps_recipe_idx on public.recipe_steps (recipe_id);
create index if not exists comments_recipe_idx on public.comments (recipe_id);
create index if not exists meal_plan_items_plan_idx on public.meal_plan_items (meal_plan_id);
create index if not exists shopping_lists_user_idx on public.shopping_lists (user_id);
create index if not exists shopping_list_items_list_idx on public.shopping_list_items (shopping_list_id);

-- RPC: recipe search with filters and engagement info
create or replace function public.search_recipes(
  search text default '',
  diet_filters text[] default null,
  cuisine_filters text[] default null,
  max_total_time int default null
) returns table (
  recipe_id uuid,
  title text,
  description text,
  image_url text,
  cuisine text,
  tags text[],
  total_time int,
  author_id uuid,
  author_username text,
  like_count bigint,
  comment_count bigint,
  is_liked boolean,
  is_saved boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    r.id,
    r.title,
    r.description,
    r.image_url,
    r.cuisine,
    r.tags,
    coalesce(r.prep_time_minutes,0) + coalesce(r.cook_time_minutes,0) as total_time,
    r.author_id,
    p.username,
    (select count(*) from public.likes l where l.recipe_id = r.id),
    (select count(*) from public.comments c where c.recipe_id = r.id),
    exists(select 1 from public.likes l2 where l2.recipe_id = r.id and l2.user_id = auth.uid()),
    exists(select 1 from public.saves s where s.recipe_id = r.id and s.user_id = auth.uid()),
    r.created_at
  from public.recipes r
  join public.profiles p on p.id = r.author_id
  where
    (search = '' or r.search_vector @@ plainto_tsquery('english', search))
    and (diet_filters is null or diet_filters && coalesce(p.dietary_preferences,'{}'))
    and (cuisine_filters is null or r.cuisine = any(cuisine_filters))
    and (max_total_time is null or (coalesce(r.prep_time_minutes,0) + coalesce(r.cook_time_minutes,0)) <= max_total_time)
    and (r.is_public = true or r.author_id = auth.uid());
end;
$$;

-- RPC: toggle like
create or replace function public.toggle_like(p_recipe_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  liked boolean;
begin
  if exists(select 1 from public.likes where recipe_id = p_recipe_id and user_id = auth.uid()) then
    delete from public.likes where recipe_id = p_recipe_id and user_id = auth.uid();
    liked := false;
  else
    insert into public.likes (recipe_id, user_id) values (p_recipe_id, auth.uid());
    liked := true;
  end if;
  return liked;
end;
$$;

-- RPC: toggle save
create or replace function public.toggle_save(p_recipe_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  saved boolean;
begin
  if exists(select 1 from public.saves where recipe_id = p_recipe_id and user_id = auth.uid()) then
    delete from public.saves where recipe_id = p_recipe_id and user_id = auth.uid();
    saved := false;
  else
    insert into public.saves (recipe_id, user_id) values (p_recipe_id, auth.uid());
    saved := true;
  end if;
  return saved;
end;
$$;

-- RPC: generate a shopping list from a meal plan (returns the new list id)
create or replace function public.generate_shopping_list_from_meal_plan(p_meal_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
  owner uuid;
begin
  select user_id into owner from public.meal_plans where id = p_meal_plan_id;
  if owner is null then
    raise exception 'meal plan not found';
  end if;
  if owner <> auth.uid() then
    raise exception 'not allowed';
  end if;

  insert into public.shopping_lists (id, user_id, title, generated_from_meal_plan)
  values (new_id, owner, 'List for ' || p_meal_plan_id, p_meal_plan_id);

  insert into public.shopping_list_items (shopping_list_id, ingredient, quantity, unit, recipe_id)
  select
    new_id,
    ri.name,
    sum(coalesce(ri.quantity, 1)),
    ri.unit,
    ri.recipe_id
  from public.meal_plan_items mpi
  join public.recipe_ingredients ri on ri.recipe_id = mpi.recipe_id
  where mpi.meal_plan_id = p_meal_plan_id
  group by ri.name, ri.unit, ri.recipe_id;

  return new_id;
end;
$$;

-- RPC: basic recommendations (popular public recipes not by current user)
create or replace function public.recommend_recipes(limit_count int default 10)
returns table (
  recipe_id uuid,
  title text,
  image_url text,
  like_count bigint,
  author_username text
)
language sql
security definer
set search_path = public
as $$
  select
    r.id,
    r.title,
    r.image_url,
    coalesce(like_counts.count, 0) as like_count,
    p.username
  from public.recipes r
  join public.profiles p on p.id = r.author_id
  left join (
    select recipe_id, count(*) from public.likes group by recipe_id
  ) as like_counts on like_counts.recipe_id = r.id
  where r.is_public = true and r.author_id <> auth.uid()
  order by like_count desc nulls last, r.created_at desc
  limit limit_count;
$$;

