'use client';

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "../lib/supabaseClient";

type Recipe = {
  recipe_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cuisine: string | null;
  tags: string[] | null;
  total_time: number | null;
  author_username: string | null;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  is_saved: boolean;
  created_at: string;
};

type Comment = {
  id: string;
  recipe_id: string;
  content: string;
  created_at: string;
  profiles?: { username?: string | null } | null;
};

type Props = {
  session: Session | null;
  onRecipesLoaded?: (recipes: Recipe[]) => void;
  refreshToken?: number;
};

export default function RecipeFeed({ session, onRecipesLoaded, refreshToken }: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [maxTime, setMaxTime] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchComments = async (recipeIds: string[]) => {
    if (!recipeIds.length) return;
    const { data, error } = await supabase
      .from("comments")
      .select("id, recipe_id, content, created_at, profiles(username)")
      .in("recipe_id", recipeIds)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error.message);
      return;
    }
    const grouped: Record<string, Comment[]> = {};
    data?.forEach((c) => {
      grouped[c.recipe_id] = [...(grouped[c.recipe_id] ?? []), c as Comment];
    });
    setComments((prev) => ({ ...prev, ...grouped }));
  };

  const fetchRecipes = async () => {
    setLoading(true);
    setStatus("");
    const { data, error } = await supabase.rpc("search_recipes", {
      search,
      cuisine_filters: cuisine ? [cuisine] : null,
      max_total_time: maxTime ? Number(maxTime) : null
    });
    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }
    const next = (data ?? []) as Recipe[];
    setRecipes(next);
    onRecipesLoaded?.(next);
    fetchComments(next.map((r) => r.recipe_id));
    setLoading(false);
  };

  useEffect(() => {
    fetchRecipes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (refreshToken !== undefined) {
      fetchRecipes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const toggleLike = async (recipeId: string) => {
    if (!session) {
      setStatus("Sign in to like recipes");
      return;
    }
    await supabase.rpc("toggle_like", { p_recipe_id: recipeId });
    fetchRecipes();
  };

  const toggleSave = async (recipeId: string) => {
    if (!session) {
      setStatus("Sign in to save recipes");
      return;
    }
    await supabase.rpc("toggle_save", { p_recipe_id: recipeId });
    fetchRecipes();
  };

  const postComment = async (recipeId: string) => {
    if (!session) {
      setStatus("Sign in to comment");
      return;
    }
    const content = commentDrafts[recipeId]?.trim();
    if (!content) return;
    const { error } = await supabase.from("comments").insert({
      recipe_id: recipeId,
      user_id: session.user.id,
      content
    });
    if (error) {
      setStatus(error.message);
      return;
    }
    setCommentDrafts((prev) => ({ ...prev, [recipeId]: "" }));
    fetchComments([recipeId]);
    fetchRecipes();
  };

  const recipesByFreshness = useMemo(() => {
    return [...recipes].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [recipes]);

  return (
    <div className="panel">
      <div className="section-heading">
        <span>Discover recipes</span>
        {status && <span className="status">{status}</span>}
      </div>
      <div className="input-row" style={{ marginBottom: 12 }}>
        <input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <input placeholder="Cuisine" value={cuisine} onChange={(e) => setCuisine(e.target.value)} />
        <input
          type="number"
          min={0}
          placeholder="Max total minutes"
          value={maxTime}
          onChange={(e) => setMaxTime(e.target.value)}
        />
        <button onClick={fetchRecipes} disabled={loading}>
          {loading ? "Loading..." : "Apply filters"}
        </button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {recipesByFreshness.map((recipe) => (
          <article key={recipe.recipe_id} className="card stack">
            <div className="action-row" style={{ justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{recipe.title}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {recipe.author_username ?? "Unknown"} · {formatDistanceToNow(new Date(recipe.created_at))} ago
                </div>
              </div>
              {recipe.cuisine && <span className="badge">{recipe.cuisine}</span>}
            </div>
            {recipe.tags && (
              <div className="flex flex-wrap">
                {recipe.tags.map((t) => (
                  <span className="tag" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            )}
            {recipe.description && <p className="muted">{recipe.description}</p>}
            <div className="action-row">
              <span className="pill">Time {recipe.total_time ?? 0} mins</span>
              <span className="pill">Likes {recipe.like_count}</span>
              <span className="pill">Comments {recipe.comment_count}</span>
            </div>
            <div className="action-row">
              <button className="secondary" onClick={() => toggleLike(recipe.recipe_id)}>
                {recipe.is_liked ? "Unlike" : "Like"}
              </button>
              <button className="secondary" onClick={() => toggleSave(recipe.recipe_id)}>
                {recipe.is_saved ? "Unsave" : "Save"}
              </button>
            </div>
            <div>
              <div className="section-heading" style={{ marginBottom: 8 }}>
                <span>Comments</span>
              </div>
              <div className="stack">
                {(comments[recipe.recipe_id] ?? []).slice(0, 3).map((c) => (
                  <div key={c.id} className="card" style={{ background: "rgba(255, 255, 255, 0.04)" }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {c.profiles?.username ?? "Someone"} ·{" "}
                      <span className="muted">{formatDistanceToNow(new Date(c.created_at))} ago</span>
                    </div>
                    <div>{c.content}</div>
                  </div>
                ))}
                <div className="input-row">
                  <input
                    placeholder="Add a comment"
                    value={commentDrafts[recipe.recipe_id] ?? ""}
                    onChange={(e) =>
                      setCommentDrafts((prev) => ({ ...prev, [recipe.recipe_id]: e.target.value }))
                    }
                  />
                  <button className="secondary" onClick={() => postComment(recipe.recipe_id)}>
                    Post
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
