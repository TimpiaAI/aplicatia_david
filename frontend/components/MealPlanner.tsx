'use client';

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { format } from "date-fns";
import { supabase } from "../lib/supabaseClient";

type RecipeChoice = { recipe_id: string; title: string };

type MealPlan = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
};

type MealPlanItem = {
  id: string;
  meal_plan_id: string;
  recipe_id: string;
  scheduled_for: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  recipes?: { title?: string | null } | null;
};

type Props = {
  session: Session;
  availableRecipes: RecipeChoice[];
  onPlansChange?: (plans: MealPlan[]) => void;
};

export default function MealPlanner({ session, availableRecipes, onPlansChange }: Props) {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [items, setItems] = useState<Record<string, MealPlanItem[]>>({});
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [meal, setMeal] = useState<"breakfast" | "lunch" | "dinner" | "snack">("dinner");
  const [status, setStatus] = useState("");

  const loadPlans = async () => {
    const { data, error } = await supabase
      .from("meal_plans")
      .select("*")
      .order("start_date", { ascending: false });
    if (error) {
      setStatus(error.message);
      return;
    }
    const planData = (data ?? []) as MealPlan[];
    setPlans(planData);
    onPlansChange?.(planData);
    loadItems(planData.map((p) => p.id));
  };

  const loadItems = async (planIds: string[]) => {
    if (!planIds.length) {
      setItems({});
      return;
    }
    const { data, error } = await supabase
      .from("meal_plan_items")
      .select("*, recipes(title)")
      .in("meal_plan_id", planIds)
      .order("scheduled_for", { ascending: true });
    if (error) {
      setStatus(error.message);
      return;
    }
    const grouped: Record<string, MealPlanItem[]> = {};
    (data ?? []).forEach((item) => {
      grouped[item.meal_plan_id] = [...(grouped[item.meal_plan_id] ?? []), item as MealPlanItem];
    });
    setItems(grouped);
  };

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPlan = async () => {
    if (!title || !startDate || !endDate) {
      setStatus("Fill title and dates");
      return;
    }
    const { error } = await supabase
      .from("meal_plans")
      .insert({
        title,
        user_id: session.user.id,
        start_date: startDate,
        end_date: endDate
      })
      .select()
      .single();
    if (error) {
      setStatus(error.message);
      return;
    }
    setTitle("");
    setStartDate("");
    setEndDate("");
    setStatus("Plan created");
    loadPlans();
  };

  const addItem = async () => {
    if (!selectedPlan || !selectedRecipe || !scheduledFor) {
      setStatus("Choose plan, recipe, and date");
      return;
    }
    const { error } = await supabase.from("meal_plan_items").insert({
      meal_plan_id: selectedPlan,
      recipe_id: selectedRecipe,
      scheduled_for: scheduledFor,
      meal
    });
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Meal added");
    loadItems([selectedPlan]);
  };

  const groupedByDate = (planId: string) => {
    const planItems = items[planId] ?? [];
    return planItems.reduce<Record<string, MealPlanItem[]>>((acc, item) => {
      acc[item.scheduled_for] = [...(acc[item.scheduled_for] ?? []), item];
      return acc;
    }, {});
  };

  const planChoices = useMemo(
    () => plans.map((p) => ({ label: `${p.title} (${p.start_date} → ${p.end_date})`, value: p.id })),
    [plans]
  );

  return (
    <div className="panel">
      <div className="section-heading">
        <span>Meal planner</span>
        {status && <span className="status">{status}</span>}
      </div>
      <div className="grid">
        <div className="card">
          <div className="section-heading">Create a plan</div>
          <div className="input-row">
            <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <button style={{ marginTop: 10 }} onClick={createPlan}>
            Save plan
          </button>
        </div>
        <div className="card">
          <div className="section-heading">Add meal to plan</div>
          <div className="input-row">
            <select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}>
              <option value="">Select plan</option>
              {planChoices.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <select value={selectedRecipe} onChange={(e) => setSelectedRecipe(e.target.value)}>
              <option value="">Select recipe</option>
              {availableRecipes.map((r) => (
                <option key={r.recipe_id} value={r.recipe_id}>
                  {r.title}
                </option>
              ))}
            </select>
            <input type="date" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
            <select value={meal} onChange={(e) => setMeal(e.target.value as typeof meal)}>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>
          <button style={{ marginTop: 10 }} onClick={addItem}>
            Add to plan
          </button>
        </div>
      </div>
      <hr className="divider" />
      <div className="grid">
        {plans.map((plan) => {
          const grouped = groupedByDate(plan.id);
          return (
            <div key={plan.id} className="card stack">
              <div className="section-heading">
                <span>{plan.title}</span>
                <span className="muted">
                  {format(new Date(plan.start_date), "MMM d")} → {format(new Date(plan.end_date), "MMM d")}
                </span>
              </div>
              {Object.keys(grouped).length === 0 && <div className="muted">No meals scheduled yet.</div>}
              {Object.entries(grouped).map(([date, meals]) => (
                <div key={date} className="stack" style={{ background: "#f8fafc", padding: 10, borderRadius: 12 }}>
                  <div style={{ fontWeight: 700 }}>{format(new Date(date), "EEE, MMM d")}</div>
                  {meals.map((m) => (
                    <div key={m.id} className="action-row">
                      <span className="badge">{m.meal}</span>
                      <span>{m.recipes?.title ?? "Recipe"}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
