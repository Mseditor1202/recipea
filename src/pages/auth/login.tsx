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

function getSafeNext(next: string | string[] | undefind) {
  const candidate = Array.isArray(next) ? next[0] : next;

  // 必ず同一オリジンの相対パスに限定（open redirect対策）
  if (typeof candidate !== "string" || !candidate.startsWith("/")) return "/home";

  // auth配下へ戻すとループする可能性があるので弾く
  if (candidate.startsWith("/auth")) return "/home";

  return candidate;
}

export default function Login() {
  const router = useRouter();
  const { setIsAuth, loading } = useAuth();

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);

      // currentUserが確実に入るまで待つ
      await waitForFirebaseUser();

      // AuthProviderの反映待ちで戻らないように即trueへ
      setIsAuth(true);

      // next を優先して戻す
      const nextPath = getSafeNext(router.query.next);
      router.replace(nextPath);
    } catch (e) {
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
