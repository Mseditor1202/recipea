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
import { Recipe } from "../types";
import type { DocumentData } from "firebase/firestore";

const COLLECTION_RECIPES = "recipes";

const snapToRecipe = (id: string, v: DocumentData): Recipe => ({
  id,
  userId: v?.userId ? String(v.userId) : v?.authorId ? String(v.authorId) : "",
  title: String(v?.title ?? v?.recipeName ?? v?.name ?? ""),
  imageUrl: v?.imageUrl ? String(v.imageUrl) : undefined,
  tags: Array.isArray(v?.tags)
    ? v.tags.map(String)
    : Array.isArray(v?.searchTags)
      ? v.searchTags.map(String)
      : [],
  memo: v?.memo ? String(v.memo) : undefined,
  createdAt: v?.createdAt,
  updatedAt: v?.updatedAt,
});

export async function listRecipes(): Promise<Recipe[]> {
  const snap = await getDocs(collection(db, COLLECTION_RECIPES));
  return snap.docs.map((d) => snapToRecipe(d.id, d.data()));
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const ref = doc(db, COLLECTION_RECIPES, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snapToRecipe(snap.id, snap.data());
}

export async function createRecipe(
  payload: Record<string, unknown>,
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION_RECIPES), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRecipe(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const ref = doc(db, COLLECTION_RECIPES, id);
  await updateDoc(ref, {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRecipe(id: string): Promise<void> {
  const ref = doc(db, COLLECTION_RECIPES, id);
  await deleteDoc(ref);
}
