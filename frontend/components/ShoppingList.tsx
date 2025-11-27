'use client';

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type MealPlanChoice = { id: string; title: string };

type ShoppingListItem = {
  id: string;
  shopping_list_id: string;
  ingredient: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
};

type ShoppingList = {
  id: string;
  title: string;
  status: string | null;
  generated_from_meal_plan: string | null;
  shopping_list_items?: ShoppingListItem[];
  created_at?: string;
};

type Props = {
  session: Session;
  mealPlans: MealPlanChoice[];
};

export default function ShoppingList({ session, mealPlans }: Props) {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [status, setStatus] = useState("");

  const loadLists = async () => {
    const { data, error } = await supabase
      .from("shopping_lists")
      .select("*, shopping_list_items(*)")
      .order("created_at", { ascending: false });
    if (error) {
      setStatus(error.message);
      return;
    }
    setLists((data as ShoppingList[]) ?? []);
  };

  useEffect(() => {
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateFromPlan = async () => {
    if (!selectedPlan) {
      setStatus("Pick a meal plan");
      return;
    }
    const { error } = await supabase.rpc("generate_shopping_list_from_meal_plan", {
      p_meal_plan_id: selectedPlan
    });
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Shopping list generated");
    loadLists();
  };

  const toggleItem = async (item: ShoppingListItem) => {
    const { error } = await supabase
      .from("shopping_list_items")
      .update({ checked: !item.checked })
      .eq("id", item.id)
      .select();
    if (error) {
      setStatus(error.message);
      return;
    }
    loadLists();
  };

  return (
    <div className="panel">
      <div className="section-heading">
        <span>Shopping lists</span>
        {status && <span className="status">{status}</span>}
      </div>
      <div className="action-row">
        <select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}>
          <option value="">Select meal plan</option>
          {mealPlans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.title}
            </option>
          ))}
        </select>
        <button onClick={generateFromPlan}>Generate from plan</button>
      </div>
      <div className="grid" style={{ marginTop: 12 }}>
        {lists.map((list) => (
          <div key={list.id} className="card stack">
            <div className="section-heading">
              <span>{list.title}</span>
              <span className="muted">{list.status ?? "draft"}</span>
            </div>
            <div className="stack">
              {(list.shopping_list_items ?? []).map((item) => (
                <label
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: item.checked ? "#dcfce7" : "#f8fafc",
                    padding: 8,
                    borderRadius: 10
                  }}
                >
                  <input type="checkbox" checked={item.checked} onChange={() => toggleItem(item)} />
                  <span>
                    {item.ingredient} {item.quantity ?? ""} {item.unit ?? ""}
                  </span>
                </label>
              ))}
              {(!list.shopping_list_items || list.shopping_list_items.length === 0) && (
                <div className="muted">No items yet.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
