import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addFridgeLot, getFridgeLotsByUser } from "@/lib/fridge";

import type {
  AddShoppingItemArgs,
  ApplyDraftArgs,
  DraftItem,
  DraftSession,
  GenerateDraftArgs,
  GetUserPlanResult,
  SyncToFridgeArgs,
  FridgeState,
  MealKey,
  SlotKey,
  ShoppingItem,
} from "../types";

// =====================================================
// helpers
// =====================================================
const tsToDate = (v: unknown): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  try {
    const d = new Date(v as any);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const PLAN_RETENTION_DAYS: Record<"FREE" | "PRO", number> = {
  FREE: 7,
  PRO: 90,
};

// users/{uid}.plan を読む（なければFREE扱い）
export async function getUserPlan(userId: string): Promise<GetUserPlanResult> {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return { plan: "FREE", retentionDays: PLAN_RETENTION_DAYS.FREE };
  }

  const v = (snap.data() || {}) as any;
  const plan = v?.plan === "PRO" ? "PRO" : "FREE";
  return { plan, retentionDays: PLAN_RETENTION_DAYS[plan] };
}

// =====================================================
// ✅ 日用品/調味料メモ（users/{uid}.shoppingNote）
// =====================================================
export async function getShoppingNotesByUser(userId: string): Promise<string> {
  if (!userId) return "";
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return "";
  const v = (snap.data() || {}) as any;
  return String(v.shoppingNote || "");
}

export async function setShoppingNotesByUser(userId: string, note: string) {
  if (!userId) throw new Error("userId is required");
  const ref = doc(db, "users", userId);

  try {
    await updateDoc(ref, {
      shoppingNote: String(note || ""),
      shoppingNoteUpdatedAt: serverTimestamp(),
    });
  } catch {
    const { setDoc } = await import("firebase/firestore");
    await setDoc(
      ref,
      {
        shoppingNote: String(note || ""),
        shoppingNoteUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

// =====================================================
// shoppingItems（確定後の買い物リスト）
// =====================================================
export async function getShoppingItemsByUser(
  userId: string
): Promise<ShoppingItem[]> {
  const qy = query(
    collection(db, "shoppingItems"),
    where("userId", "==", userId)
  );
  const snap = await getDocs(qy);

  const items: ShoppingItem[] = snap.docs.map((d) => {
    const v = (d.data() || {}) as any;
    const skip = v.skip != null ? Boolean(v.skip) : Boolean(v.checked || false);

    return {
      id: d.id,
      userId: String(v.userId || ""),
      name: String(v.name || ""),
      memo: String(v.memo || ""),
      sources: Array.isArray(v.sources) ? v.sources : [],
      categoryId: String(v.categoryId || "custom"),
      categoryLabelSnapshot: String(v.categoryLabelSnapshot || ""),
      customExpireDays:
        v.customExpireDays != null ? Number(v.customExpireDays) : null,

      skip,
      purchased: Boolean(v.purchased || false),
      purchasedAt: tsToDate(v.purchasedAt),

      status: String(v.status || (skip ? "SKIP" : "TODO")) as any,
      skippedAt: tsToDate(v.skippedAt),

      syncedAt: tsToDate(v.syncedAt),
      purgeAt: tsToDate(v.purgeAt),
      syncedToFridge: Boolean(v.syncedToFridge || false),

      createdAt: tsToDate(v.createdAt),
      updatedAt: tsToDate(v.updatedAt),
    };
  });

  items.sort((a, b) => {
    const at = a.createdAt ? a.createdAt.getTime() : 0;
    const bt = b.createdAt ? b.createdAt.getTime() : 0;
    return bt - at;
  });

  return items;
}

export async function addShoppingItem(args: AddShoppingItemArgs) {
  const {
    userId,
    name,
    categoryId,
    categoryLabelSnapshot,
    customExpireDays,
    memo = "",
    sources = [],
  } = args;

  const ref = await addDoc(collection(db, "shoppingItems"), {
    userId,
    name: String(name || ""),
    memo: String(memo || ""),
    sources: Array.isArray(sources) ? sources : [],
    categoryId: String(categoryId || "custom"),
    categoryLabelSnapshot: String(categoryLabelSnapshot || "カスタム"),
    customExpireDays:
      customExpireDays != null ? Number(customExpireDays) : null,

    skip: false,
    purchased: false,
    purchasedAt: null,

    status: "TODO",
    syncedToFridge: false,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function setShoppingItemPurchased(
  itemId: string,
  purchased: boolean
) {
  const ref = doc(db, "shoppingItems", itemId);
  await updateDoc(ref, {
    purchased: Boolean(purchased),
    purchasedAt: purchased ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

export async function setShoppingItemSkip(itemId: string, skip: boolean) {
  const ref = doc(db, "shoppingItems", itemId);
  await updateDoc(ref, {
    skip: Boolean(skip),
    checked: Boolean(skip),
    ...(skip ? { purchased: false, purchasedAt: null } : {}),
    status: skip ? "SKIP" : "TODO",
    skippedAt: skip ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

export async function setShoppingItemMemo(itemId: string, memo: string) {
  const ref = doc(db, "shoppingItems", itemId);
  await updateDoc(ref, {
    memo: String(memo || ""),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteShoppingItem(itemId: string) {
  const ref = doc(db, "shoppingItems", itemId);
  await deleteDoc(ref);
}

export async function markAllPurchased({ userId }: { userId: string }) {
  if (!userId) throw new Error("userId is required");

  const snap = await getDocs(
    query(collection(db, "shoppingItems"), where("userId", "==", userId))
  );

  const targets = snap.docs.filter((d) => {
    const v = (d.data() || {}) as any;
    const skip = v.skip != null ? Boolean(v.skip) : Boolean(v.checked || false);
    const purchased = Boolean(v.purchased || false);
    return !skip && !purchased;
  });

  if (targets.length === 0) return { updated: 0 };

  let updated = 0;
  for (let i = 0; i < targets.length; i += 450) {
    const chunk = targets.slice(i, i + 450);
    const batch = writeBatch(db);
    chunk.forEach((d) => {
      batch.update(d.ref, {
        purchased: true,
        purchasedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      updated += 1;
    });
    await batch.commit();
  }

  return { updated };
}

export async function deleteAllShoppingItems({ userId }: { userId: string }) {
  if (!userId) throw new Error("userId is required");

  const snap = await getDocs(
    query(collection(db, "shoppingItems"), where("userId", "==", userId))
  );
  if (snap.empty) return { deleted: 0 };

  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += 450) {
    const chunk = snap.docs.slice(i, i + 450);
    const batch = writeBatch(db);
    chunk.forEach((d) => {
      batch.delete(d.ref);
      deleted += 1;
    });
    await batch.commit();
  }

  return { deleted };
}

export async function syncActiveItemsToFridge({
  userId,
  items,
}: SyncToFridgeArgs) {
  const { retentionDays } = await getUserPlan(userId);

  for (const it of items || []) {
    await addFridgeLot({
      userId,
      foodName: it.name,
      categoryId: it.categoryId || "custom",
      state: "HAVE",
      customExpireDays:
        it.categoryId === "custom"
          ? Number(it.customExpireDays || 3)
          : undefined,
    } as any);

    const ref = doc(db, "shoppingItems", it.id);
    const now = new Date();
    const purgeAt = addDays(now, retentionDays);

    await updateDoc(ref, {
      status: "SYNCED",
      syncedToFridge: true,
      syncedAt: serverTimestamp(),
      purgeAt,
      updatedAt: serverTimestamp(),
    });
  }
}

// =====================================================
// ここから：献立 → DRAFT 生成（既存）
// =====================================================
const COLLECTION_WEEKLY_DAY = "weeklyDaySets";
const COLLECTION_RECIPES = "recipes";
const MEAL_ORDER: MealKey[] = ["breakfast", "lunch", "dinner"];
const SLOT_ORDER: SlotKey[] = ["staple", "main", "side", "soup"];

function normalizeIngredientToRow(ing: any) {
  if (!ing) return null;

  if (typeof ing === "string") {
    const raw = ing.trim();
    if (!raw) return null;
    return { name: raw, rawText: raw };
  }

  const name = String(ing.name || ing.ingredient || ing.title || "").trim();
  if (!name) return null;

  const quantity = ing.quantity ?? ing.qty ?? ing.amount ?? "";
  const unit = ing.unit ?? "";
  const rawText = String(
    ing.rawText ||
      ing.text ||
      (quantity || unit ? `${name} ${quantity}${unit}`.trim() : name)
  ).trim();

  return { name, rawText: rawText || name };
}

function buildFridgeNameIndex(fridgeLots: any[]) {
  const map = new Map<string, FridgeState>();
  const rank: Record<string, number> = { NONE: 0, FEW: 1, HAVE: 2 };

  for (const lot of fridgeLots || []) {
    const name = String(lot.foodNameSnapshot || "").trim();
    if (!name) continue;

    const key = name.toLowerCase();
    const state = (lot.state || "HAVE") as FridgeState;
    const prev = map.get(key);

    if (!prev) map.set(key, state);
    else if ((rank[state] ?? 2) > (rank[prev] ?? 2)) map.set(key, state);
  }
  return map;
}

function getFridgeStateForName(index: Map<string, FridgeState>, name: string) {
  if (!name) return "UNKNOWN";
  const key = String(name).trim().toLowerCase();
  return index.get(key) || "UNKNOWN";
}

async function archiveOldDrafts(userId: string) {
  const qy = query(
    collection(db, "shoppingDraftSessions"),
    where("userId", "==", userId)
  );
  const snap = await getDocs(qy);
  if (snap.empty) return;

  const batch = writeBatch(db);
  let updates = 0;

  snap.docs.forEach((d) => {
    const v = (d.data() || {}) as any;
    if (v.status === "DRAFT") {
      batch.update(d.ref, {
        status: "ARCHIVED",
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      updates += 1;
    }
  });

  if (updates > 0) await batch.commit();
}

export async function generateShoppingDraftFromPlans({
  userId,
  rangeDays = 2,
}: GenerateDraftArgs) {
  const days = Number(rangeDays) === 3 ? 3 : 2;

  await archiveOldDrafts(userId);

  const start = addDays(new Date(), 1);
  const startDayKey = toDateKey(start);
  const endDayKey = toDateKey(addDays(start, days - 1));

  const dayKeys: string[] = [];
  for (let i = 0; i < days; i++) dayKeys.push(toDateKey(addDays(start, i)));

  const daySnaps = await Promise.all(
    dayKeys.map((k) => getDoc(doc(db, COLLECTION_WEEKLY_DAY, k)))
  );

  const dayDocs: Record<string, any> = {};
  const recipeIdSet = new Set<string>();

  daySnaps.forEach((snap, idx) => {
    const k = dayKeys[idx];
    if (!snap.exists()) return;

    const data = (snap.data() || {}) as any;
    dayDocs[k] = data;

    MEAL_ORDER.forEach((mealKey) => {
      const meal = data?.[mealKey] || {};
      SLOT_ORDER.forEach((slotKey) => {
        const id = meal?.[slotKey];
        if (id) recipeIdSet.add(id);
      });
    });
  });

  const allIds = Array.from(recipeIdSet);
  const recipesById: Record<string, any> = {};

  for (let i = 0; i < allIds.length; i += 10) {
    const chunk = allIds.slice(i, i + 10);
    if (chunk.length === 0) continue;

    const qy = query(
      collection(db, COLLECTION_RECIPES),
      where("__name__", "in", chunk)
    );
    const snap = await getDocs(qy);
    snap.forEach((docSnap) => {
      recipesById[docSnap.id] = { id: docSnap.id, ...(docSnap.data() || {}) };
    });
  }

  const fridgeLots = await getFridgeLotsByUser(userId);
  const fridgeIndex = buildFridgeNameIndex(fridgeLots as any);

  const aggregated = new Map<string, { name: string; sources: any[] }>();

  for (const dayKey of Object.keys(dayDocs)) {
    const dayData = dayDocs[dayKey];

    for (const mealKey of MEAL_ORDER) {
      const meal = dayData?.[mealKey] || {};
      for (const slotKey of SLOT_ORDER) {
        const recipeId = meal?.[slotKey];
        if (!recipeId) continue;

        const recipe = recipesById[recipeId];
        if (!recipe) continue;

        const recipeName = String(recipe.recipeName || "（無題）");
        const ings = Array.isArray(recipe.ingredients)
          ? recipe.ingredients
          : [];

        for (const ing of ings) {
          const row = normalizeIngredientToRow(ing);
          if (!row) continue;

          const name = String(row.name || "").trim();
          if (!name) continue;

          const mapKey = name.toLowerCase();
          const prev = aggregated.get(mapKey);

          const sourceRow = {
            dayKey,
            mealKey,
            slotKey,
            recipeId,
            recipeName,
            rawText: row.rawText,
          };

          if (!prev) aggregated.set(mapKey, { name, sources: [sourceRow] });
          else prev.sources.push(sourceRow);
        }
      }
    }
  }

  const sessionRef = await addDoc(collection(db, "shoppingDraftSessions"), {
    userId,
    status: "DRAFT",
    rangeDays: days,
    startDayKey,
    endDayKey,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (aggregated.size === 0) {
    return { sessionId: sessionRef.id };
  }

  const itemsCol = collection(
    db,
    "shoppingDraftSessions",
    sessionRef.id,
    "items"
  );
  const batch = writeBatch(db);

  aggregated.forEach((v) => {
    const fridgeState = getFridgeStateForName(fridgeIndex, v.name);

    batch.set(doc(itemsCol), {
      name: v.name,
      sources: v.sources,

      fridgeState,
      skip: fridgeState === "HAVE",

      categoryId: "custom",
      categoryLabelSnapshot: "カスタム",
      customExpireDays: 3,

      memo: "",

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
  return { sessionId: sessionRef.id };
}

// =====================================================
// draft session / items
// =====================================================
export async function getDraftSession(
  sessionId: string
): Promise<DraftSession | null> {
  const ref = doc(db, "shoppingDraftSessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const v = (snap.data() || {}) as any;
  return {
    id: snap.id,
    userId: String(v.userId || ""),
    status: String(v.status || "DRAFT") as any,
    rangeDays: Number(v.rangeDays || 2),
    startDayKey: String(v.startDayKey || ""),
    endDayKey: String(v.endDayKey || ""),
    createdAt: tsToDate(v.createdAt),
    appliedAt: tsToDate(v.appliedAt),
    archivedAt: tsToDate(v.archivedAt),
  };
}

export async function getDraftItems(sessionId: string): Promise<DraftItem[]> {
  const snap = await getDocs(
    collection(db, "shoppingDraftSessions", sessionId, "items")
  );

  const items: DraftItem[] = snap.docs.map((d) => {
    const v = (d.data() || {}) as any;
    return {
      id: d.id,
      name: String(v.name || ""),
      sources: Array.isArray(v.sources) ? v.sources : [],
      fridgeState: String(v.fridgeState || "UNKNOWN") as any,
      skip: Boolean(v.skip || false),

      categoryId: String(v.categoryId || "custom"),
      categoryLabelSnapshot: String(v.categoryLabelSnapshot || "カスタム"),
      customExpireDays:
        v.customExpireDays != null ? Number(v.customExpireDays) : 3,

      memo: String(v.memo || ""),

      createdAt: tsToDate(v.createdAt),
      updatedAt: tsToDate(v.updatedAt),
    };
  });

  const rank: Record<string, number> = { NONE: 0, FEW: 1, UNKNOWN: 2, HAVE: 3 };
  items.sort((a, b) => {
    const ra = rank[a.fridgeState] ?? 9;
    const rb = rank[b.fridgeState] ?? 9;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, "ja");
  });

  return items;
}

export async function setDraftItemSkip(
  sessionId: string,
  itemId: string,
  skip: boolean
) {
  const ref = doc(db, "shoppingDraftSessions", sessionId, "items", itemId);
  await updateDoc(ref, { skip: !!skip, updatedAt: serverTimestamp() });
}

export async function setDraftItemMemo(
  sessionId: string,
  itemId: string,
  memo: string
) {
  const ref = doc(db, "shoppingDraftSessions", sessionId, "items", itemId);
  await updateDoc(ref, {
    memo: String(memo || ""),
    updatedAt: serverTimestamp(),
  });
}

export async function applyDraftToShoppingItems({
  userId,
  sessionId,
}: ApplyDraftArgs) {
  const session = await getDraftSession(sessionId);
  if (!session) throw new Error("Draft session not found");
  if (session.userId !== userId) throw new Error("Forbidden");

  const items = await getDraftItems(sessionId);
  const targets = items.filter((x) => !x.skip);

  const batch = writeBatch(db);

  targets.forEach((t) => {
    batch.set(doc(collection(db, "shoppingItems")), {
      userId,
      name: t.name,
      sources: Array.isArray(t.sources) ? t.sources : [],
      memo: String(t.memo || ""),

      categoryId: t.categoryId || "custom",
      categoryLabelSnapshot: String(t.categoryLabelSnapshot || "カスタム"),
      customExpireDays:
        t.categoryId === "custom" ? Number(t.customExpireDays || 3) : null,

      skip: false,
      purchased: false,
      purchasedAt: null,

      status: "TODO",
      syncedToFridge: false,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  batch.update(doc(db, "shoppingDraftSessions", sessionId), {
    status: "APPLIED",
    appliedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return { created: targets.length };
}
