import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/router";

export default function Logout() {
  const router = useRouter();
  const { setIsAuth } = useAuth();

  const Logout = () => {
    signOut(auth).then(() => {
      localStorage.setItem("isAuth", "false");
      setIsAuth(false);
      router.push("/home");
    });
  };

  return (
    <div>
      <p>ログアウトする</p>
      <button onClick={Logout}>Googleでログアウトする</button>
    </div>
  );
}
