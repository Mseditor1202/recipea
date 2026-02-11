import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { auth, provider } from "@/lib/firebase";
import { useRouter } from "next/router";

function waitForFirebaseUser() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsub();
          resolve(user);
        }
      },
      (err) => {
        unsub();
        reject(err);
      },
    );
  });
}

export default function Login() {
  const router = useRouter();
  const { setIsAuth, loading } = useAuth();

  const handleLogin = async () => {
    console.log("[LOGIN] clicked");
    try {
      await signInWithPopup(auth, provider);
      console.log("[LOGIN] after popup uid:", auth.currentUser?.uid);

      await waitForFirebaseUser();
      console.log("[LOGIN] after wait uid:", auth.currentUser?.uid);

      // AuthProviderの反映待ちで戻らないように即trueへ
      setIsAuth(true);

      // next を優先して戻す
      const next = router.query.next;
      const nextPath =
        typeof next === "string" && next.startsWith("/") ? next : "/home";

      router.replace(nextPath);
    } catch (e) {
      console.error(e);
      console.error("[LOGIN] popup error:", e);
      alert("ログインに失敗しました。");
    }
  };

  return (
    <div>
      <p>ログインして始める</p>
      {/* 認証状態の監視中はボタン無効化（連打事故防止） */}
      <button onClick={handleLogin} disabled={loading}>
        Googleでログイン
      </button>
    </div>
  );
}
