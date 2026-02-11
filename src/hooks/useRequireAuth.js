import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "./useAuth";
import { auth } from "@/lib/firebase";

export const useRequireAuth = () => {
  const router = useRouter();
  const { isAuth, user, loading } = useAuth();

  useEffect(() => {
    console.log("guard check:", {
      path: router.asPath,
      pathname: router.pathname,
      isReady: router.isReady,
      loading,
      isAuth,
      currentUser: !!auth.currentUser,
      uid: auth.currentUser?.uid,
    });
    // /auth配下はガードしない
    if (router.pathname.startsWith("/auth")) return;

    //router の準備ができるまで待つ
    if (!router.isReady) return;

    // 認証状態が確定するまで待つ
    if (loading) return;

    // stateが追いついてなくても currentUser がいればOK
    if (isAuth || auth.currentUser) return;

    // 未ログイン状態ならログインページへリダイレクト
    const next = router.asPath;
    router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
  }, [loading, isAuth, router]);

  return { isAuth, user, loading };
};
