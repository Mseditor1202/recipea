import type { Timestamp } from "firebase/firestore";

export type RecipeCategory = "staple" | "main" | "side" | "soup";

export type Recipe = {
  id: string;
  userId: string;
  title: string;
  imageUrl?: string;
  category?: RecipeCategory;
  tags?: string[];
  memo?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};
