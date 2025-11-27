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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    share: true,
    feed: true,
    planner: true,
    shopping: true
  });

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

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const sections = [
    {
      id: "share",
      label: "Adauga retete",
      render: (
        <RecipeForm
          session={session as Session}
          onCreated={() => {
            setRefreshFeedKey((k) => k + 1);
          }}
        />
      )
    },
    {
      id: "feed",
      label: "Descopera retete",
      render: (
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
      )
    },
    {
      id: "planner",
      label: "Meal planner",
      render: (
        <MealPlanner
          session={session as Session}
          availableRecipes={recipesForPlanner}
          onPlansChange={(plans) =>
            setPlansForShopping(plans.map((p) => ({ id: p.id, title: p.title })))
          }
        />
      )
    },
    {
      id: "shopping",
      label: "Liste de cumparaturi",
      render: <ShoppingList session={session as Session} mealPlans={plansForShopping} />
    }
  ];

  return (
    <>
      <header className="hero">
        <div className="hero-bg hero-bg-left" />
        <div className="hero-bg hero-bg-right" />
        <div className="hero-content">
          <p className="eyebrow">Supabase · Next.js · Neon UI</p>
          <h1 className="title neon-text">Futuristic Recipe OS</h1>
          <p className="subtitle hero-sub">
            Share, plan, and shop in a single interactive workspace with animated, glassy panels.
          </p>
          <div className="hero-actions">
            <span className="pill">{session ? "Conectat" : "Ai nevoie de autentificare"}</span>
            <span className="badge">Live sync</span>
          </div>
        </div>
      </header>
      <AuthSection session={session} />
      {session && (
        <div className="sections-shell">
          <aside className="panel section-sidebar">
            <div className="section-heading">
              <span>Sectiuni</span>
            </div>
            <div className="stack">
              {sections.map((sec) => (
                <button
                  key={sec.id}
                  className={`section-toggle ${openSections[sec.id] ? "open" : ""}`}
                  onClick={() => toggleSection(sec.id)}
                >
                  <span>{sec.label}</span>
                  <span>{openSections[sec.id] ? "−" : "+"}</span>
                </button>
              ))}
            </div>
          </aside>
          <div className="stack" style={{ gap: 16 }}>
            {sections.map(
              (sec) =>
                openSections[sec.id] && (
                  <div key={sec.id} className="section-wrapper">
                    {sec.render}
                  </div>
                )
            )}
          </div>
        </div>
      )}
    </>
  );
}
