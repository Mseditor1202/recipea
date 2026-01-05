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
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = b.getTime() - a.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export const getExpireLevel = (remainDays) => {
  if (remainDays <= 0) return "DANGER";
  if (remainDays <= 2) return "WARN";
  if (remainDays <= 5) return "CAUTION";
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

      foodNameSnapshot: String(v.foodNameSnapshot || ""),

      categoryId: String(v.categoryId || ""),
      categoryLabelSnapshot: String(v.categoryLabelSnapshot || ""),

      state: v.state || "HAVE",

      boughtAt: tsToDate(v.boughtAt),
      expireAt: tsToDate(v.expireAt),

      // CATEGORY or USER
      expireSource: v.expireSource || "CATEGORY",

      memo: String(v.memo || ""),

      isNew: Boolean(v.isNew || false),

      createdAt: tsToDate(v.createdAt),
      updatedAt: tsToDate(v.updatedAt),
    };
  });
}

/**
 * 追加（カテゴリ期限100% + custom例外）
 *
 * - 通常カテゴリ: rule.defaultExpireDays で expireAt 計算、expireSource="CATEGORY"
 * - custom: customExpireDays（残り日数）で expireAt 計算、expireSource="USER"
 */
export async function addFridgeLot({
  userId,
  foodName,
  categoryId,
  state = "HAVE",
  boughtAt = new Date(),
  memo = "",
  customExpireDays, // ← custom のときだけ使う（残り日数）
}) {
  const rule = await getCategoryExpireRule(categoryId);
  if (!rule) throw new Error(`categoryExpireRules not found: ${categoryId}`);

  const isCustom = rule.id === "custom";

  let expireAt;
  let expireSource;

  if (isCustom) {
    const days = Number(customExpireDays);
    if (!Number.isFinite(days) || days <= 0) {
      throw new Error(
        "customExpireDays must be a positive number for custom category."
      );
    }
    expireAt = addDays(boughtAt, days);
    expireSource = "USER";
  } else {
    expireAt = addDays(boughtAt, rule.defaultExpireDays);
    expireSource = "CATEGORY";
  }

  const ref = await addDoc(collection(db, "fridgeLots"), {
    userId,

    foodNameSnapshot: String(foodName || ""),
    categoryId: rule.id,
    categoryLabelSnapshot: rule.label,

    state,
    boughtAt,
    expireAt,
    expireSource,

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

export async function updateFridgeLotMemo(lotId, memo) {
  const ref = doc(db, "fridgeLots", lotId);
  await updateDoc(ref, {
    memo: String(memo || ""),
    updatedAt: serverTimestamp(),
  });
}
