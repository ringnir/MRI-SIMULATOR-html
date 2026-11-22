# コントリビュートのしかた

MRIパラメータシミュレーター Pro への不具合報告・修正・追加を歓迎します。English follows below.

## 範囲

これは**教育用の近似モデル**です。診療・装置の設定に使うための機能（実機の表示値の再現、診断の補助、患者データの読み込みなど）は対象外です。issue・PR に、臨床で使えるという主張や、実際の患者の画像・情報を含めないでください。

## 不具合を報告する

[Issues](https://github.com/ringnir/MRI-SIMULATOR-html/issues) の「不具合の報告 / Bug report」から送ってください。次があると直しやすくなります。

- 使った版（日本語・English・中文、URL かファイルか）、ブラウザと OS
- 部位・病変・静磁場・シーケンス、変えたパラメータ（画面の URL やスクリーンショット）
- 期待した結果と実際の結果。物理的に誤っていると考える場合は、根拠となる文献

## メーカー名称の修正を提案する

「メーカー名称の修正 / Vendor name correction」のテンプレートを使ってください。**出典（URL・文献）と確認度**を必ず書いてください。

| 確認度 | 意味 |
|---|---|
| `o` | メーカーの公開資料（製品ページ・取扱説明書・技術資料など）で確認した |
| `c` | 第三者の比較表（学会・論文・教科書の対応表など）で確認した |
| `x` | 未確認（公開版では「—」と表示される） |

名称はソフトウェアのバージョン・地域で異なることがあります。分かれば、そのバージョン・地域も書いてください。PR で直す場合、Siemens・Canon の名称は `src/seqs.js`、GE・Philips・Fujifilm・United Imaging の名称は `src/vendors.js` にあります。社外秘の資料を出典にはしないでください。

## シーケンス・ファントムを追加する

`src/seq/<id>.js`（シーケンス）と `src/ph/ph_<name>.js`（ファントム）は、ファイルを1つ足すだけでビルドに取り込まれます。書き方は [docs/EXTENDING.md](docs/EXTENDING.md)、ファントムの座標・図形・組織値・品質の目安は [docs/PHANTOM_SPEC.md](docs/PHANTOM_SPEC.md) を見てください。新しい組織値には出典を付けてください（推定値の場合はそう明記してください）。

## 翻訳

日本語の文字列を足したら英語版・中国語版をビルドし、`i18n/missing_en.json`・`i18n/missing_zh.json` に出た文字列の訳を `i18n/extra_en.json`・`i18n/extra_zh.json` に足してください（キーは日本語の文字列）。ビルドで「未訳の文字列」が出なくなれば完了です。訳の改善だけの PR も歓迎します。

## PR の前に

```
python3 build.py index.html --public
python3 build.py en.html --public --lang=en
python3 build.py zh.html --public --lang=zh
node tests/all.js            # 最後の行の数（失敗の数）が 0
node tests/learn_chk.js      # "learn ok N" だけが出る
node tests/epg_validate.js   # 最大相対誤差が 3% 以下
node tests/modes.js epg      # bad 0
node tests/modes.js bloch    # bad 0（数分かかる）
```

ビルドした `index.html`・`en.html`・`zh.html` も PR に含めてください。CI（GitHub Actions）が、ビルドが最新か・未訳がないか・試験が通るかを確かめます。必要なのは Node 18 以上と Python 3 だけです（npm のパッケージは使いません）。

## コードの書き方

- `src/` は **ES5**（`var`・`function`。アロー関数・`let`/`const`・テンプレート文字列・クラスは使わない）。`tests/` の Node スクリプトはこの限りではありません。
- 出力は **HTML ファイル1つ**。外部のライブラリ・フォント・画像・CDN を使わず、**オフラインで動く**こと。通信（解析・外部への送信）を加えないこと。
- 既存のコードの書き方（短い名前、1行にまとめる書き方）に合わせてください。
- 第三者のコード・画像を入れる場合は、MIT License と両立するライセンスであることを確かめ、PR に書いてください。

---

## Contributing (English)

Bug reports, fixes and additions are welcome.

- **Scope.** This is an educational approximation. Clinical use (reproducing scanner values, diagnostic support, loading patient data) is out of scope. Do not include clinical-use claims or real patient images or data in issues or PRs.
- **Bugs.** Use the "Bug report" issue form. Include the language version, browser/OS, anatomy, lesion, field strength, sequence and parameters (URL or screenshot), expected vs actual behaviour, and a reference if you think the physics is wrong.
- **Vendor names.** Use the "Vendor name correction" form and always give a **source** (URL or publication) and a **confidence** flag: `o` = vendor's public documentation, `c` = third-party comparison table, `x` = unverified (shown as "—" in the public build). Names live in `src/seqs.js` (Siemens, Canon) and `src/vendors.js` (GE, Philips, Fujifilm, United Imaging). Do not cite confidential documents.
- **Sequences and phantoms.** Add a file to `src/seq/` or `src/ph/`; see [docs/EXTENDING.md](docs/EXTENDING.md) and [docs/PHANTOM_SPEC.md](docs/PHANTOM_SPEC.md) (in Japanese). Give sources for new tissue values.
- **Translations.** After a build, untranslated strings are listed in `i18n/missing_en.json` / `i18n/missing_zh.json`; add translations to `i18n/extra_en.json` / `i18n/extra_zh.json` (keys are the Japanese source strings) until the build no longer prints "未訳の文字列" (untranslated strings).
- **Before a PR.** Run the three builds and the tests listed above, and commit the rebuilt `index.html`, `en.html` and `zh.html`. CI checks that the builds are current, fully translated and that the tests pass. Only Node 18+ and Python 3 are needed.
- **Code style.** ES5 in `src/`; a single self-contained HTML file; no external libraries, fonts, images or CDNs; works offline; no network calls.
