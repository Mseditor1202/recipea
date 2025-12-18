import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "./useAuth";

export const useRequireAuth = () => {
  const router = useRouter();
  const { isAuth, user } = useAuth();

  useEffect(() => {
    if (!isAuth) {
      router.push("/auth/login");
    }
  }, [isAuth, router]);

  return { isAuth, user };
};
