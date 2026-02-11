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

const COLLECTION_RECIPES = "recipes";

const snapToRecipe = (id: string, v: any): Recipe => {
  return {
    id,
    recipeName: String(v?.recipeName ?? v?.name ?? ""),
    imageUrl: v?.imageUrl ? String(v.imageUrl) : undefined,
    userId: v?.userId ? String(v.userId) : undefined,
    createdAt: v?.createdAt?.toDate ? v.createdAt.toDate() : undefined,
    updatedAt: v?.updatedAt?.toDate ? v.updatedAt.toDate() : undefined,
    ...v,
  };
};

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
  payload: Record<string, any>,
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
  patch: Record<string, any>,
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
