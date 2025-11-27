'use client';

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import AuthSection from "../components/AuthSection";
import RecipeForm from "../components/RecipeForm";
import RecipeFeed from "../components/RecipeFeed";
import MealPlanner from "../components/MealPlanner";
import ShoppingList from "../components/ShoppingList";
import { supabase } from "../lib/supabaseClient";

type PlannerRecipe = { recipe_id: string; title: string };
type PlanChoice = { id: string; title: string };

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [recipesForPlanner, setRecipesForPlanner] = useState<PlannerRecipe[]>([]);
  const [plansForShopping, setPlansForShopping] = useState<PlanChoice[]>([]);
  const [refreshFeedKey, setRefreshFeedKey] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) ensureProfile(data.session.user.id, data.session.user.email);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) ensureProfile(newSession.user.id, newSession.user.email);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const ensureProfile = async (userId: string, email?: string) => {
    const username = email ? email.split("@")[0] : userId.slice(0, 8);
    await supabase.from("profiles").upsert({ id: userId, username });
  };

  return (
    <>
      <header className="page-heading">
        <div>
          <h1 className="title">Recipe sharing & meal planning</h1>
          <p className="subtitle">Supabase REST backend + a slim Next.js tester UI.</p>
        </div>
      </header>
      <AuthSection session={session} />
      {session && (
        <div className="grid" style={{ gap: 18 }}>
          <RecipeForm
            session={session}
            onCreated={() => {
              setRefreshFeedKey((k) => k + 1);
            }}
          />
          <RecipeFeed
            session={session}
            refreshToken={refreshFeedKey}
            onRecipesLoaded={(recipes) =>
              setRecipesForPlanner(
                recipes.map((r) => ({
                  recipe_id: r.recipe_id,
                  title: r.title
                }))
              )
            }
          />
          <MealPlanner
            session={session}
            availableRecipes={recipesForPlanner}
            onPlansChange={(plans) =>
              setPlansForShopping(plans.map((p) => ({ id: p.id, title: p.title })))
            }
          />
          <ShoppingList session={session} mealPlans={plansForShopping} />
        </div>
      )}
    </>
  );
}
