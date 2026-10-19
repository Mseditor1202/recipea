import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import {
  getZuboraSet,
  updateZuboraSet,
  deleteZuboraSet,
  setZuboraSetRecipeSlot,
  clearZuboraSetRecipeSlot,
} from "@/features/zuboraSets/repositories/zuboraSetRepository";
import type { ZuboraSet } from "@/features/zuboraSets/types";
import MealRecipeGrid from "@/features/recipes/components/MealRecipeGrid";
import RecipeSelectionDrawer from "@/features/recipes/components/RecipeSelectionDrawer";
import { listRecipes } from "@/features/recipes/repositories/recipeRepo";

export default function ZuboraSetEditPage() {
  const router = useRouter();
  const { id } = router.query;

  const [zuboraSet, setZuboraSet] = useState<ZuboraSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<
    "standard" | "quick" | "saving" | "other"
  >("standard");
  const [saving, setSaving] = useState(false);
  const [mealEditTarget, setMealEditTarget] = useState<{
    meal: "breakfast" | "lunch" | "dinner";
    slot: "staple" | "main" | "side" | "soup";
  } | null>(null);

  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");
  const [recipeSaving, setRecipeSaving] = useState(false);
  const [recipes, setRecipes] = useState<
    Awaited<ReturnType<typeof listRecipes>>
  >([]);

  const recipesById = Object.fromEntries(
    recipes.map((recipe) => [recipe.id, recipe]),
  );
  const hasAtLeastOneRecipe = zuboraSet
    ? Object.values(zuboraSet.meals).some((meal) =>
        Object.values(meal).some((recipeId) => Boolean(recipeId)),
      )
    : false;

  const currentRecipeId = mealEditTarget
    ? zuboraSet?.meals[mealEditTarget.meal]?.[mealEditTarget.slot] || null
    : null;

  useEffect(() => {
    if (!router.isReady || typeof id !== "string") {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const [data, recipeList] = await Promise.all([
          getZuboraSet(id, user.uid),
          listRecipes(user.uid),
        ]);

        setZuboraSet(data);
        setRecipes(recipeList);
        if (data) {
          setName(data.name);
          setDescription(data.description ?? "");
          setCategory(data.category);
        }
      } catch (error) {
        console.error("ズボラセットの取得に失敗しました", error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [router.isReady, id]);
  const handleSave = async () => {
    if (typeof id !== "string") {
      return;
    }

    const user = auth.currentUser;

    if (!user || !name.trim() || !hasAtLeastOneRecipe) {
      return;
    }

    setSaving(true);

    try {
      await updateZuboraSet(id, user.uid, {
        name: name.trim(),
        description: description.trim(),
        category,
      });

      setZuboraSet((prev) =>
        prev
          ? {
              ...prev,
              name: name.trim(),
              description: description.trim(),
              category,
            }
          : prev,
      );
    } catch (error) {
      console.error("ズボラセットの更新に失敗しました", error);
    } finally {
      setSaving(false);
    }
  };
  const handleClearRecipeSlot = async (
    meal: "breakfast" | "lunch" | "dinner",
    slot: "staple" | "main" | "side" | "soup",
  ) => {
    if (typeof id !== "string") {
      return;
    }

    try {
      await clearZuboraSetRecipeSlot(id, meal, slot);

      setZuboraSet((prev) =>
        prev
          ? {
              ...prev,
              meals: {
                ...prev.meals,
                [meal]: {
                  ...prev.meals[meal],
                  [slot]: null,
                },
              },
            }
          : prev,
      );
    } catch (error) {
      console.error("レシピを外す処理に失敗しました", error);
    }
  };
  const handleSelectRecipe = async (recipeId: string) => {
    if (typeof id !== "string" || !mealEditTarget || !recipeId || !zuboraSet) {
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      return;
    }

    setRecipeSaving(true);

    try {
      await setZuboraSetRecipeSlot(
        id,
        mealEditTarget.meal,
        mealEditTarget.slot,
        recipeId,
      );

      setZuboraSet((prev) =>
        prev
          ? {
              ...prev,
              meals: {
                ...prev.meals,
                [mealEditTarget.meal]: {
                  ...prev.meals[mealEditTarget.meal],
                  [mealEditTarget.slot]: recipeId,
                },
              },
            }
          : prev,
      );
    } catch (error) {
      console.error("レシピの設定に失敗しました", error);
    } finally {
      setRecipeSaving(false);
    }
  };
  const handleDelete = async () => {
    if (typeof id !== "string") {
      return;
    }

    const confirmed = window.confirm(
      "このズボラセットを削除しますか？この操作は取り消せません。",
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteZuboraSet(id);
      await router.push("/recipes/zubora");
    } catch (error) {
      console.error("ズボラセットの削除に失敗しました", error);
    }
  };

  if (loading) {
    return <div>読み込み中...</div>;
  }

  if (!zuboraSet) {
    return <div>ズボラセットが見つかりません。</div>;
  }

  return (
    <main>
      <h1>ズボラセット編集</h1>

      <div>
        <label>
          セット名
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>

      <div>
        <label>
          説明
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </div>

      <div>
        <label>
          カテゴリ
          <select
            value={category}
            onChange={(e) =>
              setCategory(
                e.target.value as "standard" | "quick" | "saving" | "other",
              )
            }
          >
            <option value="standard">定番</option>
            <option value="quick">時短</option>
            <option value="saving">節約</option>
            <option value="other">その他</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !name.trim() || !hasAtLeastOneRecipe}
      >
        {saving ? "保存中..." : "保存する"}
      </button>

      {!hasAtLeastOneRecipe && <p>レシピを1件以上登録してください。</p>}

      <button type="button" onClick={handleDelete}>
        このズボラセットを削除する
      </button>

      <h2>朝食</h2>

      <MealRecipeGrid
        mealData={zuboraSet.meals.breakfast}
        recipesById={recipesById}
        onSelectSlot={(slotKey) => {
          setMealEditTarget({
            meal: "breakfast",
            slot: slotKey,
          });
        }}
        onEditSlot={(slotKey) => {
          setMealEditTarget({
            meal: "breakfast",
            slot: slotKey,
          });
        }}
        onRecipeClick={(recipeId) => {
          const back = router.asPath;

          router.push(`/recipes/${recipeId}?back=${encodeURIComponent(back)}`);
        }}
        onRemoveSlot={(slotKey) => {
          handleClearRecipeSlot("breakfast", slotKey);
        }}
      />

      <h2>昼食</h2>

      <MealRecipeGrid
        mealData={zuboraSet.meals.lunch}
        recipesById={recipesById}
        onSelectSlot={(slotKey) => {
          setMealEditTarget({
            meal: "lunch",
            slot: slotKey,
          });
        }}
        onEditSlot={(slotKey) => {
          setMealEditTarget({
            meal: "lunch",
            slot: slotKey,
          });
        }}
        onRecipeClick={(recipeId) => {
          const back = router.asPath;

          router.push(`/recipes/${recipeId}?back=${encodeURIComponent(back)}`);
        }}
        onRemoveSlot={(slotKey) => {
          handleClearRecipeSlot("lunch", slotKey);
        }}
      />

      <h2>夕食</h2>

      <MealRecipeGrid
        mealData={zuboraSet.meals.dinner}
        recipesById={recipesById}
        onSelectSlot={(slotKey) => {
          setMealEditTarget({
            meal: "dinner",
            slot: slotKey,
          });
        }}
        onEditSlot={(slotKey) => {
          setMealEditTarget({
            meal: "dinner",
            slot: slotKey,
          });
        }}
        onRecipeClick={(recipeId) => {
          const back = router.asPath;

          router.push(`/recipes/${recipeId}?back=${encodeURIComponent(back)}`);
        }}
        onRemoveSlot={(slotKey) => {
          handleClearRecipeSlot("dinner", slotKey);
        }}
      />
      <RecipeSelectionDrawer
        open={!!mealEditTarget}
        mealLabel={
          mealEditTarget
            ? mealEditTarget.meal === "breakfast"
              ? "朝"
              : mealEditTarget.meal === "lunch"
                ? "昼"
                : "夜"
            : ""
        }
        selectedSlot={mealEditTarget?.slot ?? "staple"}
        recipes={recipes}
        currentRecipeId={currentRecipeId}
        searchQuery={recipeSearchQuery}
        busy={recipeSaving}
        onClose={() => setMealEditTarget(null)}
        onChangeSlot={(slotKey) => {
          setMealEditTarget((prev) =>
            prev
              ? {
                  ...prev,
                  slot: slotKey,
                }
              : prev,
          );
        }}
        onChangeSearchQuery={setRecipeSearchQuery}
        onSelectRecipe={handleSelectRecipe}
        onRemoveRecipe={() => {
          if (!mealEditTarget) {
            return;
          }

          handleClearRecipeSlot(mealEditTarget.meal, mealEditTarget.slot);
        }}
      />
    </main>
  );
}
