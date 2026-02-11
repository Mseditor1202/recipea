// src/pages/index.js
export default function IndexPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>ラクするごはん</h1>
      <p>献立・買い物・冷蔵庫をまとめてラクにするアプリ</p>

      <a href="/auth/login">ログインして使う</a>
      <div style={{ marginTop: 12 }}>
        <a href="/home">ホーム</a> / <a href="/recipes">レシピ</a> /{" "}
        <a href="/shopping">買い物</a>
      </div>
    </main>
  );
}
