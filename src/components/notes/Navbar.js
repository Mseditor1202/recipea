import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function Navbar() {
  const { isAuth } = useAuth();
  return (
    <nav>
      <Link href="/home">ホーム</Link>
      {" | "}
      <Link href="/recipes/weekly">週間レシピ登録</Link>
      {" | "}
      <Link href="/recipes/dailyset">献立レシピ一覧</Link>
      {" | "}
      <Link href="/recipes/dailyset/create">献立レシピ登録</Link>
      {" | "}
      <Link href="/recipes">レシピ一覧</Link>
      {" | "}
      <Link href="/recipes/createpost">レシピ登録</Link>
      {" | "}
      <Link href="/createrecipe">買い物リスト</Link>
      {" | "}
      {isAuth ? (
        <Link href="/auth/logout">ログアウト</Link>
      ) : (
        <Link href="/auth/login">ログイン</Link>
      )}
    </nav>
  );
}
