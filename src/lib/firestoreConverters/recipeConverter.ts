import type { Recipe } from "@/features/recipes/types";
import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  WithFieldValue,
  DocumentData,
} from "firebase/firestore";

type RecipeFirestore = {
  userId: string;
  title: string;
  imageUrl?: string;
  tags?: string[];
  memo?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export const recipeConverter: FirestoreDataConverter<Recipe> = {
  // addDoc時に serverTimestamp() が入るので WithFieldValue を許容しておく
  toFirestore(recipe: WithFieldValue<Recipe>): DocumentData {
    const { id, ...rest } = recipe;

    // 🔁 互換のために旧フィールドも同時に書いておく（任意だけどおすすめ）
    // title -> recipeName, tags -> searchTags
    return {
      ...rest,
      recipeName: (rest as any).title,
      searchTags: (rest as any).tags,
    };
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot<DocumentData>,
    options: SnapshotOptions,
  ): Recipe {
    const data = snapshot.data(options) as RecipeFirestore;

    return {
      id: snapshot.id,
      userId: data.userId ?? "",
      title: data.title ?? "",
      imageUrl: data.imageUrl,
      tags: data.tags ?? [],
      memo: data.memo,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  },
};
