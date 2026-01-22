import type { Timestamp } from "firebase/firestore";

export type Plan = "FREE" | "PRO";

export type ShoppingItemStatus = "TODO" | "SKIP" | "SYNCED";

export type FridgeState = "NONE" | "FEW" | "HAVE" | "UNKNOWN";

export type MealKey = "breakfast" | "lunch" | "dinner";
export type SlotKey = "staple" | "main" | "side" | "soup";

export type ShoppingItem = {
  id: string;
  userId: string;
  name: string;
  memo: string;
  sources: any[]; // まずは既存互換（後で型化できる）
  categoryId: string;
  categoryLabelSnapshot: string;
  customExpireDays: number | null;

  skip: boolean;
  purchased: boolean;
  purchasedAt: Date | null;

  status: ShoppingItemStatus;
  skippedAt: Date | null;

  syncedAt: Date | null;
  purgeAt: Date | null;
  syncedToFridge: boolean;

  createdAt: Date | null;
  updatedAt: Date | null;
};

export type DraftSession = {
  id: string;
  userId: string;
  status: "DRAFT" | "APPLIED" | "ARCHIVED";
  rangeDays: number;
  startDayKey: string;
  endDayKey: string;
  createdAt: Date | null;
  appliedAt: Date | null;
  archivedAt: Date | null;
};

export type DraftItemSourceRow = {
  dayKey: string;
  mealKey: MealKey;
  slotKey: SlotKey;
  recipeId: string;
  recipeName: string;
  rawText: string;
};

export type DraftItem = {
  id: string;
  name: string;
  sources: DraftItemSourceRow[] | any[]; // 互換優先
  fridgeState: FridgeState;
  skip: boolean;

  categoryId: string;
  categoryLabelSnapshot: string;
  customExpireDays: number;

  memo: string;

  createdAt: Date | null;
  updatedAt: Date | null;
};

export type GetUserPlanResult = { plan: Plan; retentionDays: number };

export type AddShoppingItemArgs = {
  userId: string;
  name: string;
  categoryId?: string;
  categoryLabelSnapshot?: string;
  customExpireDays?: number | null;
  memo?: string;
  sources?: any[];
};

export type GenerateDraftArgs = {
  userId: string;
  rangeDays?: 2 | 3 | number;
};

export type ApplyDraftArgs = {
  userId: string;
  sessionId: string;
};

export type SyncToFridgeArgs = {
  userId: string;
  items: Array<
    Pick<ShoppingItem, "id" | "name" | "categoryId" | "customExpireDays">
  >;
};
