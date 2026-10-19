import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { ZuboraSet } from "../types";

const COLLECTION_ZUBORA_SETS = "zuboraSets";

export type CreateZuboraSetInput = Omit<
  ZuboraSet,
  "id" | "createdAt" | "updatedAt"
>;

export async function listZuboraSets(userId: string): Promise<ZuboraSet[]> {
  const q = query(
    collection(db, COLLECTION_ZUBORA_SETS),
    where("userId", "==", userId),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<ZuboraSet, "id">),
  }));
}

export async function createZuboraSet(
  input: CreateZuboraSetInput,
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION_ZUBORA_SETS), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function getZuboraSet(
  id: string,
  userId: string,
): Promise<ZuboraSet | null> {
  const docRef = doc(db, COLLECTION_ZUBORA_SETS, id);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as Omit<ZuboraSet, "id">;

  if (data.userId !== userId) {
    return null;
  }

  return {
    id: snapshot.id,
    ...data,
  };
}

export type UpdateZuboraSetInput = Partial<
  Omit<ZuboraSet, "id" | "userId" | "createdAt" | "updatedAt">
>;

export async function updateZuboraSet(
  id: string,
  userId: string,
  input: UpdateZuboraSetInput,
): Promise<void> {
  const docRef = doc(db, COLLECTION_ZUBORA_SETS, id);

  await updateDoc(docRef, {
    ...input,
    userId,
    updatedAt: serverTimestamp(),
  });
}
export async function setZuboraSetRecipeSlot(
  id: string,
  meal: "breakfast" | "lunch" | "dinner",
  slot: "staple" | "main" | "side" | "soup",
  recipeId: string,
): Promise<void> {
  const docRef = doc(db, COLLECTION_ZUBORA_SETS, id);

  await updateDoc(docRef, {
    [`meals.${meal}.${slot}`]: recipeId,
    updatedAt: serverTimestamp(),
  });
}

export async function clearZuboraSetRecipeSlot(
  id: string,
  meal: "breakfast" | "lunch" | "dinner",
  slot: "staple" | "main" | "side" | "soup",
): Promise<void> {
  const docRef = doc(db, COLLECTION_ZUBORA_SETS, id);

  await updateDoc(docRef, {
    [`meals.${meal}.${slot}`]: null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteZuboraSet(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_ZUBORA_SETS, id);
  await deleteDoc(docRef);
}
