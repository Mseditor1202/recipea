import type { Recipe } from "@/features/recipes/types";
import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  WithFieldValue,
  Timestamp,
  DocumentData,
} from "firebase/firestore";

type RecipeFirestore = {
  userId?: string;
  authorId?: string;
  title?: string;
  recipeName?: string;
  name?: string;
  imageUrl?: string;
  tags?: unknown;
  searchTags?: unknown;
  memo?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const toStringArray = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x));
};

export const recipeConverter: FirestoreDataConverter<Recipe> = {
  // Firestoreに保存する際の変換処理
  toFirestore(recipe: WithFieldValue<Recipe>): DocumentData {
    const { id: _id, ...rest } = recipe as Recipe;
    return rest;
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions,
  ): Recipe {
    const data = snapshot.data(options) as RecipeFirestore;

    return {
      id: snapshot.id,
      userId: data.userId
        ? String(data.userId)
        : data.authorId
          ? String(data.authorId)
          : "",
      title: String(data.title ?? data.recipeName ?? data.name ?? ""),
      imageUrl: data.imageUrl ? String(data.imageUrl) : undefined,
      tags: toStringArray(data.tags ?? data.searchTags),
      memo: data.memo ? String(data.memo) : undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  },
};
