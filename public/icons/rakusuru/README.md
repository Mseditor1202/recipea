# ラクするごはん Icon Set v1.0

「ラクするごはん」で使用する正式アイコンセットです。

各SVGは、元デザインの見た目を維持することを優先し、
高品質PNGをSVGコンテナ内に埋め込んだ形式で管理しています。

そのため、現時点では完全なベクターパスSVGではありません。

## 基本ルール

- 基本サイズ：24px
- 必要に応じて 16px / 20px / 32px / 48px で使用
- 元デザインの形・色を変更しない
- 実装では原則SVGファイルを使用
- 命名形式：`lg_<category>_<meaning>.svg`
- Default / Active / Pressed / Disabled などの状態表現は、可能な限りUI側で管理する

---

## brand

- `lg_brand_mascot.svg` : ブランドマスコット

---

## navigation

- `lg_nav_home.svg` : ホーム
- `lg_nav_mealplan.svg` : 献立
- `lg_nav_create.svg` : つくる
- `lg_nav_recipe.svg` : レシピ
- `lg_nav_mypage.svg` : マイページ

---

## life

- `lg_life_shopping_list.svg` : 買い物リスト
- `lg_life_fridge.svg` : 冷蔵庫
- `lg_life_inventory_list.svg` : 在庫リスト
- `lg_life_template.svg` : テンプレート
- `lg_life_stock_management.svg` : ストック管理

---

## feature

- `lg_feature_omakase.svg` : おまかせ
- `lg_feature_zubora_set.svg` : ズボラセット
- `lg_feature_suggest_recipe.svg` : 提案レシピ
- `lg_feature_weekly_set.svg` : 1週間セット
- `lg_feature_daily_set.svg` : 1日セット

---

## content

- `lg_content_breakfast.svg` : 朝食
- `lg_content_lunch.svg` : 昼食
- `lg_content_dinner.svg` : 夕食
- `lg_content_staple_food.svg` : 主食
- `lg_content_main_dish.svg` : 主菜
- `lg_content_side_dish.svg` : 副菜
- `lg_content_soup.svg` : 汁物
- `lg_content_rice_noodles.svg` : ごはん・麺
- `lg_content_bread.svg` : パン
- `lg_content_snack.svg` : おやつ

---

## action

- `lg_action_search.svg` : 検索
- `lg_action_filter.svg` : 絞り込み
- `lg_action_sort.svg` : 並び替え
- `lg_action_favorite.svg` : お気に入り
- `lg_action_add.svg` : 追加
- `lg_action_edit.svg` : 編集
- `lg_action_delete.svg` : 削除
- `lg_action_copy.svg` : コピー
- `lg_action_confirm.svg` : 確定
- `lg_action_close.svg` : 閉じる
- `lg_action_back.svg` : 戻る
- `lg_action_next.svg` : 進む
- `lg_action_date_select.svg` : 日付選択
- `lg_action_period_select.svg` : 期間選択
- `lg_action_share.svg` : シェア
- `lg_action_save.svg` : 保存
- `lg_action_print.svg` : 印刷
- `lg_action_drag.svg` : ドラッグ

---

## status

- `lg_status_notice.svg` : お知らせ
- `lg_status_new.svg` : 新着
- `lg_status_recommend.svg` : おすすめ
- `lg_status_popular.svg` : 人気
- `lg_status_cooking_time.svg` : 調理時間
- `lg_status_people.svg` : 人数
- `lg_status_cook_later.svg` : あとで作る
- `lg_status_cooked.svg` : 作った
- `lg_status_learned.svg` : 覚えた
- `lg_status_help.svg` : ヘルプ

---

## external

- `lg_external_instagram.svg` : Instagram
- `lg_external_youtube.svg` : YouTube
- `lg_external_website.svg` : Webサイト
- `lg_external_external_link.svg` : 外部リンク
- `lg_external_url_copy.svg` : URLコピー

---

## other

- `lg_other_memo.svg` : メモ
- `lg_other_add_photo.svg` : 写真追加
- `lg_other_image.svg` : 画像
- `lg_other_tag.svg` : タグ
- `lg_other_settings.svg` : 設定

---

## state

- `lg_state_default.svg` : 通常（Default）
- `lg_state_active.svg` : 選択中（Active）
- `lg_state_pressed.svg` : タップ中（Pressed）
- `lg_state_disabled.svg` : 無効（Disabled）

---

## ディレクトリ構成

```text
public/
└─ icons/
   └─ rakusuru/
      ├─ brand/
      ├─ navigation/
      ├─ life/
      ├─ feature/
      ├─ content/
      ├─ action/
      ├─ status/
      ├─ external/
      ├─ other/
      ├─ state/
      └─ README.md
```
