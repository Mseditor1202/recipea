// src/lib/shopping.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addFridgeLot, getFridgeLotsByUser } from "@/lib/fridge";

// ---------- helpers ----------
const tsToDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  return new Date(v);
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
};

const pad2 = (n) => String(n).padStart(2, "0");
const toDateKey = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const PLAN_RETENTION_DAYS = { FREE: 7, PRO: 90 };

// users/{uid}.plan を読む（なければFREE扱い）
export async function getUserPlan(userId) {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  if (!snap.exists())
    return { plan: "FREE", retentionDays: PLAN_RETENTION_DAYS.FREE };
  const v = snap.data();
  const plan = v?.plan === "PRO" ? "PRO" : "FREE";
  return { plan, retentionDays: PLAN_RETENTION_DAYS[plan] };
}

// =====================================================
// shoppingItems（skip=今回は買わない）
// - sources: 展開用（rawTextで数量表現）
// - memo: メモ
// =====================================================

export async function getShoppingItemsByUser(userId) {
  // インデックス回避のため orderBy しない（フロントでソート）
  const q = query(
    collection(db, "shoppingItems"),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);

  const items = snap.docs.map((d) => {
    const v = d.data();

    // ✅ 新フィールド skip を優先。無ければ互換で checked を使う
    const skip = v.skip != null ? Boolean(v.skip) : Boolean(v.checked || false);

    return {
      id: d.id,
      userId: String(v.userId),

      name: String(v.name || ""),
      categoryId: String(v.categoryId || "custom"),
      categoryLabelSnapshot: String(v.categoryLabelSnapshot || ""),
      customExpireDays:
        v.customExpireDays != null ? Number(v.customExpireDays) : null,

      // ✅ 仕様：skip = 今回は買わない
      skip,

      // status: TODO | SKIP | SYNCED（古いデータはTODO扱い）
      status: String(v.status || (skip ? "SKIP" : "TODO")),

      // 時刻
      skippedAt: tsToDate(v.skippedAt),
      syncedAt: tsToDate(v.syncedAt),
      purgeAt: tsToDate(v.purgeAt),

      syncedToFridge: Boolean(v.syncedToFridge || false),

      createdAt: tsToDate(v.createdAt),
      updatedAt: tsToDate(v.updatedAt),

      // ✅ 追加：展開（数量rawText）とメモ
      sources: Array.isArray(v.sources) ? v.sources : [],
      memo: String(v.memo || ""),
    };
  });

  // 新しい順（createdAtが無い古いデータは最後）
  items.sort((a, b) => {
    const at = a.createdAt ? a.createdAt.getTime() : 0;
    const bt = b.createdAt ? b.createdAt.getTime() : 0;
    return bt - at;
  });

  return items;
}

export async function addShoppingItem({
  userId,
  name,
  categoryId,
  categoryLabelSnapshot,
  customExpireDays,
}) {
  const ref = await addDoc(collection(db, "shoppingItems"), {
    userId,
    name: String(name || ""),
    categoryId: String(categoryId || "custom"),
    categoryLabelSnapshot: String(categoryLabelSnapshot || ""),
    customExpireDays:
      customExpireDays != null ? Number(customExpireDays) : null,

    // ✅ 新仕様
    skip: false,
    status: "TODO",
    syncedToFridge: false,

    // ✅ 追加：手動追加は sources 空、memo 空
    sources: [],
    memo: "",

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ✅ 「今回は買わない」を切り替える
export async function setShoppingItemSkip(itemId, skip) {
  const ref = doc(db, "shoppingItems", itemId);
  await updateDoc(ref, {
    skip: Boolean(skip),

    // 互換のため checked も同時更新（古いUI/データ対策）
    checked: Boolean(skip),

    status: skip ? "SKIP" : "TODO",
    skippedAt: skip ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

// ✅ メモ保存（買い物リスト側）
export async function setShoppingItemMemo(itemId, memo) {
  const ref = doc(db, "shoppingItems", itemId);
  await updateDoc(ref, {
    memo: String(memo || ""),
    updatedAt: serverTimestamp(),
  });
}

// ✅ 冷蔵庫に反映：skip==false のみ反映する
export async function syncActiveItemsToFridge({ userId, items }) {
  // items: 画面側で skip==false & syncedToFridge!=true のものだけ渡す想定
  const { retentionDays } = await getUserPlan(userId);

  for (const it of items) {
    await addFridgeLot({
      userId,
      foodName: it.name,
      categoryId: it.categoryId || "custom",
      state: "HAVE",
      customExpireDays:
        it.categoryId === "custom"
          ? Number(it.customExpireDays || 3)
          : undefined,
    });

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
// ここから：献立 → DRAFT 生成
// =====================================================

const COLLECTION_WEEKLY_DAY = "weeklyDaySets";
const COLLECTION_RECIPES = "recipes";
const MEAL_ORDER = ["breakfast", "lunch", "dinner"];
const SLOT_ORDER = ["staple", "main", "side", "soup"];

// 料理の材料を「name + rawText」に落とす（揺れ吸収）
function normalizeIngredientToRow(ing) {
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

function buildFridgeNameIndex(fridgeLots) {
  const map = new Map();
  const rank = { NONE: 0, FEW: 1, HAVE: 2 };

  for (const lot of fridgeLots) {
    const name = String(lot.foodNameSnapshot || "").trim();
    if (!name) continue;

    const key = name.toLowerCase();
    const state = lot.state || "HAVE";
    const prev = map.get(key);
    if (!prev) map.set(key, state);
    else if ((rank[state] ?? 2) > (rank[prev] ?? 2)) map.set(key, state);
  }
  return map;
}

function getFridgeStateForName(index, name) {
  if (!name) return "UNKNOWN";
  const key = String(name).trim().toLowerCase();
  return index.get(key) || "UNKNOWN";
}

// 古いDRAFTをARCHIVED（常に最新draftだけ）
async function archiveOldDrafts(userId) {
  const q = query(
    collection(db, "shoppingDraftSessions"),
    where("userId", "==", userId),
    where("status", "==", "DRAFT")
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { status: "ARCHIVED", archivedAt: serverTimestamp() });
  });
  await batch.commit();
}

// 献立からDRAFT生成（明日からrangeDaysぶん）
export async function generateShoppingDraftFromPlans({
  userId,
  rangeDays = 2,
}) {
  const days = rangeDays === 3 ? 3 : 2;

  await archiveOldDrafts(userId);

  const start = addDays(new Date(), 1);
  const startDayKey = toDateKey(start);
  const endDayKey = toDateKey(addDays(start, days - 1));

  const dayKeys = [];
  for (let i = 0; i < days; i++) dayKeys.push(toDateKey(addDays(start, i)));

  const daySnaps = await Promise.all(
    dayKeys.map((k) => getDoc(doc(db, COLLECTION_WEEKLY_DAY, k)))
  );

  const dayDocs = {};
  const recipeIdSet = new Set();

  daySnaps.forEach((snap, idx) => {
    const k = dayKeys[idx];
    if (!snap.exists()) return;
    const data = snap.data() || {};
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
  const recipesById = {};
  for (let i = 0; i < allIds.length; i += 10) {
    const chunk = allIds.slice(i, i + 10);
    const q = query(
      collection(db, COLLECTION_RECIPES),
      where("__name__", "in", chunk)
    );
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      recipesById[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
    });
  }

  const fridgeLots = await getFridgeLotsByUser(userId);
  const fridgeIndex = buildFridgeNameIndex(fridgeLots);

  const aggregated = new Map();

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
            recipeId,
            recipeName,
            rawText: row.rawText, // ✅ 数量テキストはここに残す（合計しない）
            mealKey,
            slotKey,
            dayKey,
          };

          if (!prev) {
            aggregated.set(mapKey, { name, sources: [sourceRow] });
          } else {
            prev.sources.push(sourceRow);
          }
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

  const itemsCol = collection(
    db,
    "shoppingDraftSessions",
    sessionRef.id,
    "items"
  );
  const batch = writeBatch(db);

  aggregated.forEach((v) => {
    const fridgeState = getFridgeStateForName(fridgeIndex, v.name);

    const docRef = doc(itemsCol);
    batch.set(docRef, {
      name: v.name,
      sources: v.sources,

      fridgeState,
      // ✅ DRAFTでは初期：HAVEは「今回は買わない」ON
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

export async function getDraftSession(sessionId) {
  const ref = doc(db, "shoppingDraftSessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const v = snap.data();
  return {
    id: snap.id,
    userId: String(v.userId),
    status: String(v.status || "DRAFT"),
    rangeDays: Number(v.rangeDays || 2),
    startDayKey: String(v.startDayKey || ""),
    endDayKey: String(v.endDayKey || ""),
    createdAt: tsToDate(v.createdAt),
    appliedAt: tsToDate(v.appliedAt),
    archivedAt: tsToDate(v.archivedAt),
  };
}

export async function getDraftItems(sessionId) {
  const snap = await getDocs(
    collection(db, "shoppingDraftSessions", sessionId, "items")
  );
  const items = snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      name: String(v.name || ""),
      sources: Array.isArray(v.sources) ? v.sources : [],
      fridgeState: String(v.fridgeState || "UNKNOWN"),
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

  const rank = { NONE: 0, FEW: 1, UNKNOWN: 2, HAVE: 3 };
  items.sort((a, b) => {
    const ra = rank[a.fridgeState] ?? 9;
    const rb = rank[b.fridgeState] ?? 9;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, "ja");
  });

  return items;
}

export async function setDraftItemSkip(sessionId, itemId, skip) {
  const ref = doc(db, "shoppingDraftSessions", sessionId, "items", itemId);
  await updateDoc(ref, { skip: !!skip, updatedAt: serverTimestamp() });
}

export async function setDraftItemMemo(sessionId, itemId, memo) {
  const ref = doc(db, "shoppingDraftSessions", sessionId, "items", itemId);
  await updateDoc(ref, {
    memo: String(memo || ""),
    updatedAt: serverTimestamp(),
  });
}

// ✅ DRAFTを確定：skip=false のものを shoppingItems に追加
// ✅ 履歴（draftSessionId等）は持たない
export async function applyDraftToShoppingItems({ userId, sessionId }) {
  const session = await getDraftSession(sessionId);
  if (!session) throw new Error("Draft session not found");
  if (session.userId !== userId) throw new Error("Forbidden");

  const items = await getDraftItems(sessionId);
  const targets = items.filter((x) => !x.skip);

  const batch = writeBatch(db);

  targets.forEach((t) => {
    const ref = doc(collection(db, "shoppingItems"));
    batch.set(ref, {
      userId,
      name: t.name,
      categoryId: t.categoryId || "custom",
      categoryLabelSnapshot: String(t.categoryLabelSnapshot || "カスタム"),
      customExpireDays:
        t.categoryId === "custom" ? Number(t.customExpireDays || 3) : null,

      skip: false,
      status: "TODO",
      syncedToFridge: false,

      // ✅ ここがポイント：買い物リスト側でも同じ仕様（数量rawText/sources, memo）
      sources: t.sources || [],
      memo: String(t.memo || ""),

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  // session自体は「確認済み」印として残してOK（消したいなら後で掃除）
  batch.update(doc(db, "shoppingDraftSessions", sessionId), {
    status: "APPLIED",
    appliedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return { created: targets.length };
}
