import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { listZuboraSets } from "@/features/zuboraSets/repositories/zuboraSetRepository";
import type { ZuboraSet } from "@/features/zuboraSets/types";

export default function ZuboraSetListPage() {
  const router = useRouter();
  const [zuboraSets, setZuboraSets] = useState<ZuboraSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setZuboraSets([]);
        setLoading(false);
        return;
      }

      try {
        const sets = await listZuboraSets(user.uid);
        setZuboraSets(sets);
      } catch (error) {
        console.error("ズボラセット一覧の取得に失敗しました", error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return <div>読み込み中...</div>;
  }

  return (
    <main>
      <h1>ズボラセット</h1>
      <button
        type="button"
        onClick={() => router.push("/recipes/zubora/create")}
      >
        新しいズボラセットを作る
      </button>

      {zuboraSets.length === 0 ? (
        <p>ズボラセットはまだありません。</p>
      ) : (
        zuboraSets.map((set) => (
          <div
            key={set.id}
            onClick={() => router.push(`/recipes/zubora/${set.id}`)}
            style={{ cursor: "pointer" }}
          >
            {set.name}
          </div>
        ))
      )}
    </main>
  );
}
