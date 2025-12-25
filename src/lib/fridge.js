// src/lib/fridge.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ---------- helpers ----------
const tsToDate = (v) => {
  if (!v) return new Date(0);
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  return new Date(v);
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
};

export const calcRemainDays = (expireAt) => {
  const end = expireAt instanceof Date ? expireAt : new Date(expireAt);
  const today = new Date();
  // 日付だけに揃える（時刻差のブレを減らす）
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = b.getTime() - a.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export const getExpireLevel = (remainDays) => {
  if (remainDays <= 0) return "DANGER"; // 期限切れ
  if (remainDays <= 2) return "WARN"; // 1-2日
  if (remainDays <= 5) return "CAUTION"; // 3-5日
  return "SAFE";
};

// ---------- app config ----------
export async function getAppConfigs() {
  const ref = doc(db, "appConfigs", "main");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    coldStorageDisclaimer: String(data.coldStorageDisclaimer || ""),
  };
}

// ---------- category expire rules ----------
/**
 * categoryExpireRules (docId = categoryId) の例:
 * { label: "葉物野菜", defaultExpireDays: 4, basis: "USDA_FDA_4C", order: 100 }
 */
export async function getCategoryExpireRules() {
  const snap = await getDocs(collection(db, "categoryExpireRules"));
  const rules = snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      label: String(v.label || d.id),
      defaultExpireDays: Number(v.defaultExpireDays || 0),
      basis: String(v.basis || "USDA_FDA_4C"),
      order: Number(v.order || 9999),
    };
  });

  rules.sort((a, b) => a.order - b.order);
  return rules;
}

export async function getCategoryExpireRule(categoryId) {
  const ref = doc(db, "categoryExpireRules", categoryId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const v = snap.data();
  return {
    id: snap.id,
    label: String(v.label || snap.id),
    defaultExpireDays: Number(v.defaultExpireDays || 0),
    basis: String(v.basis || "USDA_FDA_4C"),
    order: Number(v.order || 9999),
  };
}

// ---------- fridge lots ----------
export async function getFridgeLotsByUser(userId) {
  const q = query(
    collection(db, "fridgeLots"),
    where("userId", "==", userId),
    orderBy("expireAt", "asc")
  );
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      userId: String(v.userId),

      // 食材（スナップショット）
      foodNameSnapshot: String(v.foodNameSnapshot || ""),

      // カテゴリ（スナップショット）
      categoryId: String(v.categoryId || ""),
      categoryLabelSnapshot: String(v.categoryLabelSnapshot || ""),

      // 状態
      state: v.state || "HAVE",

      // 日付
      boughtAt: tsToDate(v.boughtAt),
      expireAt: tsToDate(v.expireAt),

      // 期限の由来：カテゴリ or ユーザー上書き（将来課金）
      expireSource: v.expireSource || "CATEGORY",

      // メモ（無料で使える）
      memo: String(v.memo || ""),

      // UI用
      isNew: Boolean(v.isNew || false),

      createdAt: tsToDate(v.createdAt),
      updatedAt: tsToDate(v.updatedAt),
    };
  });
}

/**
 * カテゴリ期限100%で追加
 * - foodName: ユーザー入力（例: "白菜"）
 * - categoryId: "veg_leafy" など（選択）
 * - boughtAt: 追加日
 */
export async function addFridgeLot({
  userId,
  foodName,
  categoryId,
  state = "HAVE",
  boughtAt = new Date(),
  memo = "",
}) {
  const rule = await getCategoryExpireRule(categoryId);
  if (!rule) {
    throw new Error(`categoryExpireRules not found: ${categoryId}`);
  }

  const expireAt = addDays(boughtAt, rule.defaultExpireDays);

  const ref = await addDoc(collection(db, "fridgeLots"), {
    userId,

    foodNameSnapshot: String(foodName || ""),
    categoryId: rule.id,
    categoryLabelSnapshot: rule.label,

    state,
    boughtAt,
    expireAt,
    expireSource: "CATEGORY",

    memo: String(memo || ""),

    isNew: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateFridgeLotState(lotId, nextState) {
  const ref = doc(db, "fridgeLots", lotId);
  await updateDoc(ref, {
    state: nextState,
    updatedAt: serverTimestamp(),
  });
}

export async function markLotAsSeen(lotId) {
  const ref = doc(db, "fridgeLots", lotId);
  await updateDoc(ref, {
    isNew: false,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFridgeLot(lotId) {
  const ref = doc(db, "fridgeLots", lotId);
  await deleteDoc(ref);
}

// メモ更新（無料でも使う）
export async function updateFridgeLotMemo(lotId, memo) {
  const ref = doc(db, "fridgeLots", lotId);
  await updateDoc(ref, {
    memo: String(memo || ""),
    updatedAt: serverTimestamp(),
  });
}
