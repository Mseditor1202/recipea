import { useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { createZuboraSet } from "@/features/zuboraSets/repositories/zuboraSetRepository";

import { auth } from "@/lib/firebase";

export default function CreateZuboraSetPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<
    "standard" | "quick" | "saving" | "other"
  >("standard");
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();

      if (!user) {
        setSaving(false);
        return;
      }

      try {
        const newId = await createZuboraSet({
          userId: user.uid,
          name: name.trim(),
          description: description.trim(),
          category,
          meals: {
            breakfast: {},
            lunch: {},
            dinner: {},
          },
        });

        await router.push(`/recipes/zubora/edit/${newId}`);
      } catch (error) {
        console.error("ズボラセットの作成に失敗しました", error);
        setSaving(false);
      }
    });
  };

  return (
    <main>
      <h1>ズボラセットを作る</h1>
      <p>セット情報を入力したあと、レシピを1件以上登録してください。</p>

      <div>
        <label>
          セット名
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>

      <div>
        <label>
          説明
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </div>

      <div>
        <label>
          カテゴリ
          <select
            value={category}
            onChange={(e) =>
              setCategory(
                e.target.value as "standard" | "quick" | "saving" | "other",
              )
            }
          >
            <option value="standard">定番</option>
            <option value="quick">時短</option>
            <option value="saving">節約</option>
            <option value="other">その他</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !name.trim()}
      >
        {saving ? "作成中..." : "レシピを設定する"}
      </button>
    </main>
  );
}
