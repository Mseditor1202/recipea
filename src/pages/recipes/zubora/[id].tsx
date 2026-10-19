import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { getZuboraSet } from "@/features/zuboraSets/repositories/zuboraSetRepository";
import type { ZuboraSet } from "@/features/zuboraSets/types";
import { listRecipes } from "@/features/recipes/repositories/recipeRepo";
import MealRecipeGrid from "@/features/recipes/components/MealRecipeGrid";

export default function ZuboraSetDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [zuboraSet, setZuboraSet] = useState<ZuboraSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<
    Awaited<ReturnType<typeof listRecipes>>
  >([]);
  const recipesById = Object.fromEntries(
    recipes.map((recipe) => [recipe.id, recipe]),
  );

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
      } catch (error) {
        console.error("ズボラセットの取得に失敗しました", error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [router.isReady, id]);

  if (loading) {
    return <div>読み込み中...</div>;
  }

  if (!zuboraSet) {
    return <div>ズボラセットが見つかりません。</div>;
  }

  return (
    <main>
      <h1>{zuboraSet.name}</h1>

      <p>{zuboraSet.description || "説明はありません。"}</p>

      <p>カテゴリ: {zuboraSet.category}</p>

      <button
        type="button"
        onClick={() => router.push(`/recipes/zubora/edit/${zuboraSet.id}`)}
      >
        編集する
      </button>

      <h2>朝食</h2>
      <MealRecipeGrid
        mealData={zuboraSet.meals.breakfast}
        recipesById={recipesById}
        onRecipeClick={(recipeId) => {
          const back = router.asPath;

          router.push(`/recipes/${recipeId}?back=${encodeURIComponent(back)}`);
        }}
      />

      <h2>昼食</h2>
      <MealRecipeGrid
        mealData={zuboraSet.meals.lunch}
        recipesById={recipesById}
        onRecipeClick={(recipeId) => {
          const back = router.asPath;

          router.push(`/recipes/${recipeId}?back=${encodeURIComponent(back)}`);
        }}
      />

      <h2>夕食</h2>
      <MealRecipeGrid
        mealData={zuboraSet.meals.dinner}
        recipesById={recipesById}
        onRecipeClick={(recipeId) => {
          const back = router.asPath;

          router.push(`/recipes/${recipeId}?back=${encodeURIComponent(back)}`);
        }}
      />
    </main>
  );
}
