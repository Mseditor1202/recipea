# ラクするごはん LP Hero Assets

`public/images/lp/hero/` に配置するためのヒーロー用画像素材です。

## folders

- `foods/` : 料理写真
- `device/` : スマホモックアップ
- `mascot/` : ヒーロー用マスコット
- `decorations/` : 葉っぱ・にんじん・キラキラ等の装飾シート

## files

### foods

- `hero-food-salad.png`
- `hero-food-pasta.png`
- `hero-food-bento.png`
- `hero-food-simmered-dish.png`
- `hero-food-nikujaga.png`
- `hero-food-cream-stew.png`
- `hero-food-kobachi.png`
- `hero-food-dashimaki.png`
- `hero-food-chicken-plate.png`

### device

- `hero-phone.png`

### mascot

- `hero-mascot.png`

### decorations

- `hero-decorations-sheet.png`

## 実装方針

- 文字・ボタン・ナビゲーション・カード枠・背景は HTML / CSS / MUI で実装する
- 写真・マスコット・装飾・スマホモックアップのみ画像として利用する
- 料理写真はユーザー提供の実写真を使用し、新規のAI生成料理画像は使用しない
- ヒーロー画像全体を1枚画像として配置せず、各パーツを個別に配置する
- レスポンシブ対応はCSS側で行う
