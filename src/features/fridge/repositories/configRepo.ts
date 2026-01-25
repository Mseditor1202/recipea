import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ----------- app config ------------
export async function getAppConfigs() {
  const ref = doc(db, "appConfigs", "main");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    cildStorageDisclaimer: String((data as any).coldstorageDisclaimer || ""),
  };
}

// ---------- category expire rules ----------
export async function getCategoryExpireRules() {
  const snap = await getDocs(collection(db, "categoryExpireRules"));
  const rules = snap.docs.map((d) => {
    const v = d.data() as any;
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

export async function getCategoryExpireRule(categoryId: string) {
  const ref = doc(db, "categoryExpireRules", categoryId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const v = snap.data() as any;
  return {
    id: snap.id,
    label: String(v.label || snap.id),
    defaultExpireDays: Number(v.defaultExpireDays || 0),
    basis: String(v.basis || "USDA_FDA_4C"),
    order: Number(v.order || 9999),
  };
}
