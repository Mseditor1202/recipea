import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, provider } from "../../lib/firebase";
import { useRouter } from "next/router";

export default function Login() {
  const router = useRouter();
  const { setIsAuth } = useAuth();

  const Login = () => {
    signInWithPopup(auth, provider).then(() => {
      localStorage.setItem("isAuth", true);
      setIsAuth(true);
      router.push("/home");
    });
  };

  return (
    <div>
      <p>ログインして始める</p>
      <button onClick={Login}>Googleでログイン</button>
    </div>
  );
}
