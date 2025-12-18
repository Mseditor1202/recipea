import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Weeklyrecipe() {
  const { isAuth, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuth) router.push("/auth/login");
  }, [isAuth, router]);
}
