// src/features/recipes/repositories/recipeRepo.ts
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

import type { Recipe } from "../types";
import { recipeConverter } from "@/lib/firestoreConverters/recipeConverter";
import type { WithFieldValue } from "firebase/firestore";

const COLLECTION_RECIPES = "recipes";

/** 作成時に受け取る型（serverTimestamp() を許容するため WithFieldValue を使う） */
type CreateRecipeInput = WithFieldValue<
  Omit<Recipe, "id" | "createdAt" | "updatedAt">
>;

export async function listRecipes(): Promise<Recipe[]> {
  const colRef = collection(db, COLLECTION_RECIPES).withConverter(
    recipeConverter,
  );
  const snap = await getDocs(colRef);
  return snap.docs.map((d) => d.data());
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
  const colRef = collection(db, COLLECTION_RECIPES).withConverter(
    recipeConverter,
  );
  const ref = await addDoc(colRef, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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
