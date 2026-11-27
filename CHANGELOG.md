# 更新履歴 / Changelog

[日本語](#日本語) · [English](#english)

---

## 日本語

### v1.1.0（2026-11-27）

最初の公開（v1.0.0）からの主な変更です。

#### 学ぶ・教える
- **課題モード（自動判定）**：学生・基礎・応用・エキスパートの 4 レベル × 7 題＝28 題。条件を満たすと自動でクリア判定。
  - 最初のヒントで「動かすパラメータ」を名前で示し、パラメータ欄に印をつける。
  - 「課題」ボタンは、まだクリアしていない課題から始まる。課題カードでレベルを切り替え、レベルごとのクリア数を表示。
  - 記録（所要時間・ヒント回数・変更回数・原因の解答回数・レベル）を CSV で書き出し。授業や教育研究の評価に使える。
- **アーチファクト対策の課題（⚠、8 題）**：わざと雑音・呼吸のゴースト・並列画像の雑音・折り返し・化学シフト・金属・EPI の歪み・重なったアーチファクトを入れた画像から始め、①原因を選択式で答え、②条件を変えて減らす（画像の背景信号で判定）。
- **目的を優先して最適化**：「撮像時間を短く」「SNRを高く」「分解能を細かく」「コントラスト（CNR）を高く」「SARを下げる」。制約（時間・SNR・SAR・分解能）を守って自動調整し、前後比較を見てから適用・元に戻すができる。
- **リンクで共有**：部位・シーケンス・パラメータ・グラフの設定を URL に入れて共有。

#### 計算
- **精密計算（EPG）**：FSE の刺激エコー（再収束角 <180°、B1 込み）、IR・FSE の定常状態、RF スポイリング、FISP／PSIF、3D FSE の可変再収束角。isochromat 720 個の Bloch 計算との最大誤差 1.53%。
- **Bloch準拠モード**：画素ごとの磁化から k 空間を直接計算。SE・FSE・IR・GRE・bSSFP（複素位相）・EPI（DWI・DTI・BOLD・DSC）・3D・面に垂直な流れ（拍動のゴースト）に対応。WebGPU があれば GPU で計算。
- **修正**：通常の計算で、EPI の磁場ずれによる位置ずれが部分フーリエで小さく出ていた（3.21 → 4.35 画素、理論値 4.50）。

#### 理解を助ける
- **パルスシーケンス図**：60 シーケンスすべて、いまのパラメータに連動。
- **2条件の比較**：「比較用に固定」した画像と、並べる／スライダー／差分で比較。違うパラメータと時間・SNR・SAR の表。
- **メーカー名称**：6 社の名称のうち 118 件を各社の公開資料で確認（シーケンス名 60 種のうち公開資料で確認：Siemens 55・Canon 46・GE 50・Philips 40・Fujifilm 43・United Imaging 40）。Canon の FSE Dixon を WFS DIXON、3D FSE を 3D mVox、Philips の 3D TSE を BrainVIEW などに訂正。

#### 画面
- **PC**：パラメータ・画像・グラフが 1 画面に収まる作業画面（列ごとにスクロール）。課題は作業画面のすぐ上に高さ固定の横長の帯。グラフの組織は選んだものだけ表示。
- **スマホ**：画像は固定サイズで左、要点は右、パラメータは 2 列。「グラフを横に」で画像の右に小さなグラフを出し、見ながら調整。
- サイドバー上部に「勉強用／課題／エキスパート」の切り替え。
- **アクセシビリティ**：グラフの線種、矢印キーでグラフの値を読み上げ、画像・グラフの説明文、フォーカス表示。

#### リポジトリ
- README（日・英・中）を全面的に書き直し、各言語の画面のスクリーンショットを掲載。引用の APA・BibTeX を README に掲載。
- GitHub Actions による試験（3 言語のビルド、全ファントム×全シーケンス、EPG・Bloch準拠モード、最適化、課題、パルスシーケンス図）。
- CITATION.cff・.zenodo.json・CONTRIBUTING.md・Issue／PR のテンプレート・JOSS 投稿用の原稿（草稿）。
- 画面のフッタと README に利益相反の開示。

### v1.0.0（2026-11-05）

最初の公開。
- 仮想ファントム 12 種・シーケンス 58 種（＋拡張例 2）・ほぼ全パラメータ、アーチファクト、コントラストのグラフ、k空間の充填、勉強用（15 シーケンス）。
- Siemens・Canon・GE・Philips・Fujifilm・United Imaging のシーケンス名の対応（確認度つき）。
- 日本語・英語・中国語（簡体字）、配色テーマ 4 種、スマートフォン用の画面、拡張 API。

---

## English

### v1.1.0 (2026-11-27)

Main changes since the first public release (v1.0.0).

#### Learning and teaching
- **Tasks with auto-grading:** 28 tasks in four levels (Student, Basic, Advanced, Expert; seven each), graded automatically.
  - The first hint names the parameters to change and marks them in the parameter panel.
  - The *Task* button starts with the first unsolved task; the task card switches levels and shows progress per level.
  - Records (time, hints, changes, answer attempts, level) can be exported as CSV for teaching or education research.
- **Artifact tasks (⚠, 8):** start from an image with deliberately introduced noise, respiratory ghosts, parallel-imaging noise, aliasing, chemical shift, metal, EPI distortion or several overlapping artifacts; first identify the cause (multiple choice), then change the settings to reduce it (graded from the image background).
- **Optimize for a goal:** shorter scan, higher SNR, finer resolution, higher CNR or lower SAR, respecting time, SNR, SAR and resolution constraints; review before/after, then apply or undo.
- **Share by link:** anatomy, sequence, parameters and chart settings encoded in the URL.

#### Calculation
- **Precise mode (EPG):** FSE stimulated echoes (refocusing < 180°, B1), IR/FSE steady state, RF spoiling, FISP/PSIF, variable-flip 3D FSE. Max. error 1.53% against a 720-isochromat Bloch simulation.
- **Bloch-equivalent mode:** k-space computed directly from per-pixel magnetization for SE, FSE, IR, GRE, bSSFP (complex phase), EPI (DWI, DTI, BOLD, DSC), 3D and through-plane flow (pulsation ghosts); uses WebGPU when available.
- **Fix:** in standard mode the EPI off-resonance shift was wrongly reduced by partial Fourier (3.21 → 4.35 px; theory 4.50).

#### Understanding
- **Pulse sequence diagrams** for all 60 sequences, linked to the current parameters.
- **Compare two conditions:** side by side, slider or difference image, with a table of differences.
- **Vendor names:** 118 names confirmed in vendors' public documents. Corrections include Canon WFS DIXON (FSE Dixon), 3D mVox (3D FSE) and Philips BrainVIEW (3D TSE).

#### Layout
- **Desktop:** parameters, image and chart fit one screen (each column scrolls); tasks appear as a fixed-height bar above the workspace; the chart shows only selected tissues.
- **Phone:** fixed-size image with key figures beside it, two-column parameters, and *Chart beside* to watch a small chart while adjusting.
- Learning / Task / Expert switch at the top of the sidebar.
- **Accessibility:** dashed chart lines, keyboard reading of chart values, text descriptions, visible focus.

#### Repository
- READMEs rewritten in three languages with per-language screenshots; APA and BibTeX citation in the README.
- GitHub Actions tests (three-language builds, all phantoms × sequences, EPG and Bloch-equivalent modes, optimizer, tasks, pulse sequence diagrams).
- CITATION.cff, .zenodo.json, CONTRIBUTING.md, issue/PR templates, JOSS paper draft.
- Conflict-of-interest disclosure in the app footer and README.

### v1.0.0 (2026-11-05)

First public release: 12 virtual phantoms, 58 sequences (+2 extension examples), nearly every parameter, artifacts, contrast charts, k-space filling, learning mode (15 sequences), vendor name mapping for six vendors with confidence levels, Japanese/English/Simplified Chinese, four colour themes, phone layout and an extension API.
