import type { Timestamp } from "firebase/firestore";

export type MealSlots = {
  staple?: string | null;
  main?: string | null;
  side?: string | null;
  soup?: string | null;
};

export type ZuboraSet = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  tags?: string[];
  category: "standard" | "quick" | "saving" | "other";

  meals: {
    breakfast: MealSlots;
    lunch: MealSlots;
    dinner: MealSlots;
  };

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};
