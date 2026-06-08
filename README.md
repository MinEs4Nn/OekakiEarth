# Oekaki Earth

32x32pxで描いた動物をLLM(OpenAI API)で解析し、能力値を生成してオンライン共有できるドット絵生態系Webアプリです。

## セットアップ

1. 依存をインストール

```bash
npm install
```

2. 環境変数を設定

```bash
copy .env.example .env
```

`OPENAI_API_KEY` と `JWT_SECRET` を設定してください。

3. 起動

```bash
npm start
```

起動後: http://localhost:3000

## 主な機能

- 32x32キャンバスで動物を描画（ペン/消しゴム/塗りつぶし/色選択）
- OpenAI APIによる動物能力推定とナラティブ生成
- OpenAI APIによる生態系イベント・環境変化の自動生成
- ユーザー認証（登録/ログイン/JWT）
- SQLiteへの作品保存
- 生態系スナップショットの公開投稿
- 他ユーザーの公開生態系の閲覧
- 描いた32x32スプライトをそのまま個体表示

## 構成

- `server.js`: 認証/API/配信
- `db.js`: SQLiteテーブル初期化
- `ai.js`: OpenAI連携（失敗時はフォールバック）
- `public/index.html`: UI
- `public/styles.css`: デザイン
- `public/app.js`: 描画・投稿・閲覧・シミュレーション

## 注意

- `OPENAI_API_KEY` 未設定時はローカルフォールバック推論で動作します。
- 開発用としてSQLiteファイル `oekaki-earth.db` がルートに作成されます。

## 公開方法

このアプリは Express + SQLite を使うため、GitHub Pages ではなく Node.js サーバーを動かせるサービスで公開してください。

### Render で公開

このリポジトリには [render.yaml](render.yaml) を含めてあるので、そのまま Blueprint デプロイできます。

1. Render にログイン
2. New から Blueprint を選択
3. GitHub リポジトリ `MinEs4Nn/OekakiEarth` を接続
4. `OPENAI_API_KEY` を設定
5. デプロイを実行

設定済み項目:

- `npm install` でビルド
- `npm start` で起動
- `/api/health` でヘルスチェック
- SQLite 保存先を `/var/data/oekaki-earth.db` に設定
- 永続ディスク `/var/data` を使用

### 公開後に確認すること

1. `/api/health` で `ok: true` を確認
2. ユーザー登録とログインができるか確認
3. 動物追加と公開生態系の保存ができるか確認
