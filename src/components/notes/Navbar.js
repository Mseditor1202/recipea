import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function Navbar() {
  const { isAuth } = useAuth();
  return (
    <nav>
      <Link href="/home">ホーム</Link>
      {" | "}
      <Link href="/recipes/weekly">献立をつくる</Link>
      {" | "}
      <Link href="/recipes/dailyset">献立レシピ</Link>
      {" | "}
      <Link href="/recipes">レシピ検索</Link>
      {" | "}
      <Link href="/fridge">冷蔵庫管理</Link>
      {" | "}
      <Link href="/shopping">買い物リスト</Link>
      {" | "}
      {isAuth ? (
        <Link href="/auth/logout">ログアウト</Link>
      ) : (
        <Link href="/auth/login">ログイン</Link>
      )}
    </nav>
  );
}
