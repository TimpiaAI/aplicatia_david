'use client';

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type IngredientInput = {
  name: string;
  quantity: string;
  unit: string;
};

type Props = {
  session: Session;
  onCreated?: () => void;
};

export default function RecipeForm({ session, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [tags, setTags] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ingredients, setIngredients] = useState<IngredientInput[]>([
    { name: "", quantity: "", unit: "" }
  ]);
  const [stepsText, setStepsText] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleIngredientChange = (index: number, field: keyof IngredientInput, value: string) => {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)));
  };

  const addIngredientRow = () => {
    setIngredients((prev) => [...prev, { name: "", quantity: "", unit: "" }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setStatus("");

    const parsedTags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const { data: recipe, error } = await supabase
      .from("recipes")
      .insert({
        author_id: session.user.id,
        title: title.trim(),
        description: description.trim(),
        cuisine: cuisine.trim() || null,
        tags: parsedTags.length ? parsedTags : null,
        prep_time_minutes: prepTime ? Number(prepTime) : null,
        cook_time_minutes: cookTime ? Number(cookTime) : null,
        servings: servings ? Number(servings) : null,
        is_public: isPublic,
        image_url: imageUrl || null
      })
      .select()
      .single();

    if (error || !recipe) {
      setStatus(error?.message ?? "Could not create recipe");
      setLoading(false);
      return;
    }

    const recipeId = recipe.id as string;
    const cleanedIngredients = ingredients.filter((i) => i.name.trim());
    if (cleanedIngredients.length) {
      const ingredientPayload = cleanedIngredients.map((i) => ({
        recipe_id: recipeId,
        name: i.name.trim(),
        quantity: i.quantity ? Number(i.quantity) : null,
        unit: i.unit || null
      }));
      const { error: ingError } = await supabase.from("recipe_ingredients").insert(ingredientPayload);
      if (ingError) {
        setStatus(`Recipe saved, but ingredients failed: ${ingError.message}`);
      }
    }

    const steps = stepsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (steps.length) {
      const stepRows = steps.map((instruction, idx) => ({
        recipe_id: recipeId,
        step_number: idx + 1,
        instruction
      }));
      const { error: stepErr } = await supabase.from("recipe_steps").insert(stepRows);
      if (stepErr) {
        setStatus(`Recipe saved, but steps failed: ${stepErr.message}`);
      }
    }

    setStatus("Recipe created");
    setTitle("");
    setDescription("");
    setCuisine("");
    setTags("");
    setPrepTime("");
    setCookTime("");
    setServings("");
    setImageUrl("");
    setStepsText("");
    setIngredients([{ name: "", quantity: "", unit: "" }]);
    setIsPublic(true);
    setLoading(false);
    onCreated?.();
  };

  return (
    <div className="panel">
      <div className="section-heading">Share a recipe</div>
      <form className="stack" onSubmit={handleSubmit}>
        <div className="input-row">
          <div>
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <label>Cuisine</label>
            <input value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="Italian, Thai..." />
          </div>
          <div>
            <label>Tags (comma separated)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vegan, quick, gluten-free" />
          </div>
        </div>
        <div className="input-row">
          <div>
            <label>Prep (mins)</label>
            <input type="number" min={0} value={prepTime} onChange={(e) => setPrepTime(e.target.value)} />
          </div>
          <div>
            <label>Cook (mins)</label>
            <input type="number" min={0} value={cookTime} onChange={(e) => setCookTime(e.target.value)} />
          </div>
          <div>
            <label>Servings</label>
            <input type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} />
          </div>
        </div>
        <div>
          <label>Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What makes this great?"
          />
        </div>
        <div>
          <label>Image URL (from Supabase storage)</label>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="recipe-images/uid/photo.jpg" />
        </div>
        <div className="grid">
          <label>Ingredients</label>
          {ingredients.map((ing, idx) => (
            <div className="input-row" key={idx}>
              <input
                placeholder="Name"
                value={ing.name}
                onChange={(e) => handleIngredientChange(idx, "name", e.target.value)}
              />
              <input
                placeholder="Qty"
                value={ing.quantity}
                onChange={(e) => handleIngredientChange(idx, "quantity", e.target.value)}
              />
              <input
                placeholder="Unit"
                value={ing.unit}
                onChange={(e) => handleIngredientChange(idx, "unit", e.target.value)}
              />
            </div>
          ))}
          <button type="button" className="secondary" onClick={addIngredientRow}>
            Add ingredient row
          </button>
        </div>
        <div>
          <label>Steps (one per line)</label>
          <textarea
            rows={4}
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            placeholder="1. Prep...\n2. Cook..."
          />
        </div>
        <div className="action-row">
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Public recipe
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Publish recipe"}
          </button>
          {status && <span className="status">{status}</span>}
        </div>
      </form>
    </div>
  );
}
