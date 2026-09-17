// src/features/recipes/repositories/recipeRepo.ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import type { Recipe } from "../types";
import { recipeConverter } from "@/lib/firestoreConverters/recipeConverter";

const COLLECTION_RECIPES = "recipes";

type CreateRecipeInput = Omit<Recipe, "id" | "createdAt" | "updatedAt">;

export async function listRecipes(): Promise<Recipe[]> {
  const colRef = collection(db, COLLECTION_RECIPES).withConverter(
    recipeConverter,
  );

  const snap = await getDocs(colRef);

  const recipes = snap.docs.map((d) => d.data());

  return recipes;
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const ref = doc(db, COLLECTION_RECIPES, id).withConverter(recipeConverter);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

export async function createRecipe(
  payload: CreateRecipeInput,
): Promise<string> {
  const colRef = collection(db, COLLECTION_RECIPES);

  const ref = await addDoc(colRef, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),

    // 旧フィールドとの互換がまだ必要なら残す
    recipeName: payload.title,
    searchTags: payload.tags ?? [],
  });
  return ref.id;
}

/** updateDoc は converter を通らないので、patch は型だけ寄せる（必要十分） */
export async function updateRecipeMemo(recipeId: string, memo: string) {
  const ref = doc(db, COLLECTION_RECIPES, recipeId);
  await updateDoc(ref, {
    memo,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRecipe(id: string): Promise<void> {
  const ref = doc(db, COLLECTION_RECIPES, id);
  await deleteDoc(ref);
}
