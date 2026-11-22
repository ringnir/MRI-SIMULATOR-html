## 変更の内容 / Summary

<!-- 何を、なぜ変えたか / What changed and why. 関連する issue / Related issue: #... -->

## 確認 / Checklist

- [ ] 3つのビルドをやり直し、`index.html`・`en.html`・`zh.html` をコミットした / Rebuilt and committed `index.html`, `en.html` and `zh.html`
  (`python3 build.py index.html --public` · `python3 build.py en.html --public --lang=en` · `python3 build.py zh.html --public --lang=zh`)
- [ ] 試験が通る / Tests pass: `node tests/all.js` (0 failures) · `node tests/learn_chk.js` · `node tests/epg_validate.js` (max error ≤ 3%) · `node tests/modes.js epg` · `node tests/modes.js bloch` (bad 0)
- [ ] 新しい文字列の英語・中国語訳を `i18n/extra_en.json`・`i18n/extra_zh.json` に足した（「未訳の文字列」が出ない） / Added English and Chinese translations for new strings (no "未訳の文字列" in the build output)
- [ ] 新しい組織値・メーカー名称に出典（と確認度 o/c/x）を付けた / Gave sources (and o/c/x confidence) for new tissue values or vendor names
- [ ] `src/` は ES5、外部ライブラリ・通信なし、オフラインで動く / `src/` is ES5, no external dependencies or network calls, works offline
- [ ] 臨床で使えるという主張・患者の画像や情報を含まない / No clinical-use claims and no patient images or data
