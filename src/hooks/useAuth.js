import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * @typedef {import("firebase/auth").User} FirebaseUser
 */

/**
 * @typedef {Object} AuthContextValue
 * @property {boolean} isAuth
 * @property {(value: boolean) => void} setIsAuth
 * @property {FirebaseUser | null} user
 * @property {boolean} loading
 */

/** @type {import("react").Context<AuthContextValue>} */

const Ctx = createContext({
  isAuth: false,
  setIsAuth: (_value) => {},
  user: null,
  loading: true,
});

export function AuthProvider({ children }) {
  const [isAuth, setIsAuth] = useState(false);
  const [user, setUser] = useState(/** @type {FirebaseUser | null} */ (null));
  const [loading, setLoading] = useState(true);

  //Firebaseの認証状態を監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsAuth(true);
        localStorage.setItem("isAuth", "true");
      } else {
        setUser(null);
        setIsAuth(false);
        localStorage.setItem("isAuth", "false");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{ isAuth, setIsAuth, user, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
