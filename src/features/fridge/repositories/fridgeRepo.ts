import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCategoryExpireRule } from "./configRepo";

// ---------- helpers ----------
const tsToDate = (v: any): Date => {
  if (!v) return new Date(0);
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  return new Date(v);
};

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
};

// ---------- fridge lots ----------
export async function getFridgeLotsByUser(userId: string) {
  const q = query(
    collection(db, "fridgeLots"),
    where("userId", "==", userId),
    orderBy("expireAt", "asc"),
  );
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const v = d.data() as any;
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
  customExpireDays,
}: {
  userId: string;
  foodName: string;
  categoryId: string;
  state?: string;
  boughtAt?: Date;
  memo?: string;
  customExpireDays?: number;
}) {
  const rule = await getCategoryExpireRule(categoryId);
  if (!rule) throw new Error(`categoryExpireRules not found: ${categoryId}`);

  const isCustom = rule.id === "custom";

  let expireAt: Date;
  let expireSource: "CATEGORY" | "USER";

  if (isCustom) {
    const days = Number(customExpireDays);
    if (!Number.isFinite(days) || days <= 0) {
      throw new Error(
        "customExpireDays must be a positive number for custom category.",
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

export async function updateFridgeLotState(lotId: string, nextState: string) {
  const ref = doc(db, "fridgeLots", lotId);
  await updateDoc(ref, {
    state: nextState,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFridgeLot(lotId: string) {
  const ref = doc(db, "fridgeLots", lotId);
  await deleteDoc(ref);
}

export async function updateFridgeLotMemo(lotId: string, memo: string) {
  const ref = doc(db, "fridgeLots", lotId);
  await updateDoc(ref, {
    memo: String(memo || ""),
    updatedAt: serverTimestamp(),
  });
}

export async function markLotAsSeen(lotId: string) {
  const ref = doc(db, "fridgeLots", lotId);
  await updateDoc(ref, {
    isNew: false,
    updatedAt: serverTimestamp(),
  });
}
