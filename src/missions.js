/* ===== 課題モード =====
   各課題は「開始時の条件（わざと不十分な設定）」と「達成条件」を持つ。画像が計算されるたびに自動で判定する。
   達成条件の関数は E（評価用の値）を受け取る：
     E.sig(k)      … 主画像での組織 k の信号（中央値）
     E.cnr(a,b)    … 組織 a と b の CNR（|Sa−Sb| ÷ 雑音）
     E.snr         … SNR（このシーケンスの既定条件を 100 とする %）
     E.T           … 撮像時間（秒）   E.sar … SAR（上限比 %）
     E.wrap        … 折り返して重なった組織の割合（0〜1）
     E.csPix       … 化学シフト（読出し方向、画素）
     E.readEPI     … EPI の読出し時間（ms）
     E.p / E.st    … 補正後のパラメータ／状態
   追加するときは MS.addMission({...}) を src/seq/*.js などから呼ぶ。 */
(function(){
var MS=window.MS;
function rng(v,a,b){ return v>=a&&v<=b; }
MS.MISSIONS=[
 { id:'t2w', lv:'基礎', title:'T2強調像をつくる', ph:'head', seq:'fse_t2', B0:1.5,
   init:{p:{tr:600,te:15}},
   goal:'いまは T1 強調に近い条件です。脳脊髄液が白質の2倍以上明るい T2 強調像にしてください。',
   crit:[ {label:'脳脊髄液 ÷ 白質 ≥ 2', f:function(E){ var r=E.sig('csf')/Math.max(1e-9,E.sig('wm')); return {v:r.toFixed(2), ok:r>=2}; }},
          {label:'白質 ＜ 灰白質（T2 強調らしい順）', f:function(E){ return {v:'', ok:E.sig('wm')<E.sig('gm')}; }} ],
   hints:['T2 強調は「長い TR」と「長い TE」です。','TR は T1 の影響を消すため 2500 ms 以上、TE は 80〜120 ms 前後が目安です。'],
   expl:'長い TR で縦磁化がほぼ回復し（T1 の差が消え）、長い TE で T2 の長い組織（脳脊髄液）が残るため T2 強調になります。' },
 { id:'flair', lv:'基礎', title:'FLAIR で脳脊髄液を消す', ph:'head', seq:'flair', B0:1.5,
   init:{p:{ti:900}},
   goal:'反転時間（TI）が短すぎて脳脊髄液が残っています。脳脊髄液の信号を白質の 2 割未満にしてください。',
   crit:[ {label:'脳脊髄液 ÷ 白質 ＜ 0.2', f:function(E){ var r=E.sig('csf')/Math.max(1e-9,E.sig('wm')); return {v:r.toFixed(2), ok:r<0.2}; }} ],
   hints:['反転後に縦磁化が 0 を通る時刻（ヌルポイント）に励起すると、その組織の信号が消えます。','ヌルポイントは TI ≈ T1 × ln2（TR が十分長いとき）。脳脊髄液の T1 は 1.5T で約 4000 ms です。','TR が短いと完全に回復しないので、最適な TI は短めにずれます。グラフの横軸を TI にして探してみましょう。'],
   expl:'TI ≈ T1 × ln2（≈ 0.69 × T1）で縦磁化が 0 になり、その組織の信号が消えます。TR が有限のときは、TI ≈ T1 × ln[2 / (1 + e^(−TR/T1))] になります。' },
 { id:'stir', lv:'基礎', title:'STIR で脂肪を抑える', ph:'knee', seq:'stir', B0:1.5,
   init:{p:{ti:350}},
   goal:'脂肪がまだ明るく残っています。脂肪の信号を筋肉の 3 割未満にしてください。',
   crit:[ {label:'脂肪 ÷ 筋肉 ＜ 0.3', f:function(E){ var r=E.sig('fat')/Math.max(1e-9,E.sig('muscle')); return {v:r.toFixed(2), ok:r<0.3}; }} ],
   hints:['STIR は脂肪の T1 に合わせて TI を決めます。','1.5T の脂肪の T1 は約 250〜300 ms、ヌルポイントは TI ≈ 150〜170 ms です。'],
   expl:'脂肪の T1 は短いので、TI ≈ 0.69 × T1(脂肪) ≈ 150 ms（1.5T）で脂肪の縦磁化が 0 になります。磁場の不均一に強いのが利点ですが、同じ T1 の組織（造影後の病変など）も抑えてしまいます。' },
 { id:'cnr_time', lv:'応用', title:'白質と灰白質の CNR を時間内に上げる', ph:'head', seq:'se_t1', B0:1.5,
   init:{p:{tr:1500,te:30,nex:1}},
   goal:'SE T1 強調で、白質と灰白質の CNR を 12 以上にしてください。ただし撮像時間は 4 分以内です。',
   crit:[ {label:'CNR（白質 対 灰白質）≥ 12', f:function(E){ var c=E.cnr('wm','gm'); return {v:c.toFixed(1), ok:c>=12}; }},
          {label:'撮像時間 ≤ 4 分', f:function(E){ return {v:mmss(E.T), ok:E.T<=240}; }} ],
   hints:['T1 強調では TR を短く、TE を短くするとコントラストが出ます。','SNR を上げるには、スライス厚・FOV を大きく、マトリクスを小さく、加算を増やす、バンド幅を狭くする方法があります。','時間は TR × 位相マトリクス × 加算回数です。TR を下げて浮いた時間を加算に回すのも手です。'],
   expl:'CNR は信号差 × SNR で決まります。TR を T1 の間に置くと差が大きくなり、空いた時間を加算に回すと SNR が √NEX 倍になります。分解能（ボクセル体積）とのトレードオフも意識しましょう。' },
 { id:'alias', lv:'基礎', title:'折り返しを消す', ph:'abdomen', seq:'vibe', B0:1.5,
   init:{p:{pfov:50}},
   goal:'位相方向の FOV が体より小さく、反対側に体が折り返しています。折り返しをなくしてください（息止め 20 秒以内のまま）。',
   crit:[ {label:'折り返し ＜ 1%', f:function(E){ return {v:(E.wrap*100).toFixed(1)+'%', ok:E.wrap<0.01}; }},
          {label:'撮像時間 ≤ 20 秒', f:function(E){ return {v:E.T.toFixed(1)+' 秒', ok:E.T<=20}; }} ],
   hints:['位相方向の FOV（%）を広げるか、位相オーバーサンプリングを使います。','FOV を広げると時間が延びます。並列画像（加速）や部分フーリエで取り戻しましょう。'],
   expl:'位相方向は周波数で区別できないため、FOV の外の組織が反対側に重なります。FOV を広げる、位相オーバーサンプリング、位相方向の入れ替え、飽和パルスで対処します。' },
 { id:'breathhold', lv:'応用', title:'息止め 15 秒に収める', ph:'abdomen', seq:'vibe', B0:1.5,
   init:{p:{r:1,pf:1,npart:72}},
   goal:'このままでは息止めが長すぎます。撮像時間を 15 秒以内にし、SNR は既定の 60% 以上を保ってください。',
   crit:[ {label:'撮像時間 ≤ 15 秒', f:function(E){ return {v:E.T.toFixed(1)+' 秒', ok:E.T<=15}; }},
          {label:'SNR ≥ 60%', f:function(E){ return {v:Math.round(E.snr)+'%', ok:E.snr>=60}; }} ],
   hints:['並列画像（加速）・部分フーリエ・パーティション数の削減が効きます。','加速するほど SNR は下がります（√R と g 因子）。スライス厚を少し厚くして SNR を補う方法もあります。'],
   expl:'3D の撮像時間は TR × 位相数 × パーティション数 ÷ 加速。並列画像は SNR を √R × g だけ下げるので、時間・SNR・分解能のバランスを取ります。' },
 { id:'inopp', lv:'基礎', title:'in-phase と opposed-phase の TE を合わせる', ph:'abdomen', seq:'inopp', B0:1.5,
   init:{p:{te:3.0,te2:5.5}},
   goal:'2 つの TE がずれています。1.5T で第1エコーを opposed-phase、第2エコーを in-phase にしてください。',
   crit:[ {label:'TE1 が opposed-phase（±0.3 ms）', f:function(E){ var t=E.st.B0>=2.5?1.15:2.3; return {v:E.p.te+' ms', ok:Math.abs(E.p.te-t)<=0.3*(E.st.B0>=2.5?0.5:1)}; }},
          {label:'TE2 が in-phase（±0.3 ms）', f:function(E){ var t=E.st.B0>=2.5?2.3:4.6; return {v:E.p.te2+' ms', ok:Math.abs(E.p.te2-t)<=0.3*(E.st.B0>=2.5?0.5:1)}; }} ],
   hints:['水と脂肪の周波数差は約 3.4 ppm。1.5T では約 220 Hz なので、位相が一周するのに約 4.6 ms かかります。','半周（逆位相）は 2.3 ms、一周（同位相）は 4.6 ms です。3T ではその半分です。'],
   expl:'水と脂肪は 3.4 ppm 離れており、1.5T で 1 周 ≈ 4.6 ms。opposed-phase では同じボクセル内の水と脂肪が打ち消し合い、脂肪を含む病変（腺腫・脂肪肝）の信号が落ちます。' },
 { id:'chemshift', lv:'基礎', title:'化学シフトを 1 画素以下にする', ph:'knee', seq:'fse_pd', B0:3,
   init:{p:{bw:80}},
   goal:'3T で受信バンド幅が狭く、脂肪と水の境界がずれています。化学シフトを 1 画素以下にしてください。',
   crit:[ {label:'化学シフト ≤ 1 画素', f:function(E){ return {v:E.csPix.toFixed(2)+' 画素', ok:E.csPix<=1}; }} ],
   hints:['化学シフト（画素）＝ 水脂肪の周波数差（Hz）÷ 1 画素あたりのバンド幅（Hz/画素）。','3T の水脂肪差は約 440 Hz。バンド幅を 440 Hz/画素以上にします（SNR は下がります）。'],
   expl:'バンド幅を広げると 1 画素あたりの周波数幅が増え、ずれ（画素数）が減ります。代わりに雑音が増え、SNR は √(BW) に反比例して下がります。' },
 { id:'metal', lv:'応用', title:'金属アーチファクトを減らす', ph:'knee', seq:'fse_pd', B0:1.5, les:{metal:true},
   init:{p:{bw:130}, st:{fs:'chess'}},
   goal:'金属の周りで信号が抜け、脂肪抑制もむらになっています。金属アーチファクトを減らす設定にしてください。',
   crit:[ {label:'受信バンド幅 ≥ 400 Hz/画素', f:function(E){ return {v:E.p.bw+' Hz/画素', ok:E.p.bw>=400}; }},
          {label:'VAT または SEMAC を使う', f:function(E){ return {v:'', ok:!!(E.st.vat||E.st.semac)}; }},
          {label:'周波数選択の脂肪抑制（CHESS／SPAIR）を使わない', f:function(E){ return {v:E.st.fs||'なし', ok:E.st.fs!=='chess'&&E.st.fs!=='spair'}; }} ],
   hints:['金属の近くは磁場が大きくずれるため、周波数で選ぶ方法（脂肪抑制・スライス選択・読出し）が乱れます。','バンド幅を広げる、ビュー角傾斜（VAT）、スライス方向の補正（SEMAC）が有効です。','脂肪抑制は STIR（反転回復）か Dixon が金属に強いです。'],
   expl:'金属では局所の周波数ずれが大きく、読出し方向のずれ・スライス面の歪み・脂肪抑制の失敗が起こります。高バンド幅・VAT・SEMAC・STIR/Dixon の組み合わせが基本です。' },
 { id:'epi', lv:'応用', title:'拡散強調像の歪みを減らす', ph:'head', seq:'dwi', B0:3,
   init:{p:{r:1,pf:1,ny:192,nx:192}},
   goal:'3T の EPI で読出しが長く、歪みが目立ちます。EPI の読出し時間を 30 ms 以下にしてください。',
   crit:[ {label:'EPI 読出し時間 ≤ 30 ms', f:function(E){ var r=E.readEPI||0; return {v:r?r.toFixed(1)+' ms':'—', ok:r>0&&r<=30}; }} ],
   hints:['歪みはエコー列の長さ（読出し時間）に比例します。','並列画像（R）でエコー列を短くする、位相マトリクスを減らす、部分フーリエ、読出し分割（RESOLVE／EPIX など）が使えます。'],
   expl:'EPI では位相方向の 1 画素あたりの帯域が狭く（1 ÷ 読出し時間）、磁場のずれがそのまま位相方向の位置ずれになります。読出し時間を短くするほど歪みは小さくなります。' },
 { id:'fast_t2', lv:'応用', title:'SNR を保って T2 を速く撮る', ph:'head', seq:'fse_t2', B0:1.5,
   init:{p:{etl:8,nex:2}},
   goal:'撮像時間を 1 分 30 秒以内にし、SNR は既定の 80% 以上を保ってください。',
   crit:[ {label:'撮像時間 ≤ 1:30', f:function(E){ return {v:mmss(E.T), ok:E.T<=90}; }},
          {label:'SNR ≥ 80%', f:function(E){ return {v:Math.round(E.snr)+'%', ok:E.snr>=80}; }} ],
   hints:['ETL（エコートレイン長）を増やすと、1 回の TR で取るライン数が増えて速くなります。','加算を減らすと時間は半分、SNR は 1/√2 になります。ETL を増やすとぼけが増えるので、ほどほどに。'],
   expl:'FSE の時間は TR × 位相数 × 加算 ÷ ETL。ETL を伸ばすと速くなりますが、エコー間の T2 減衰でぼけが増え、SAR も上がります。' }
];
function mmss(s){ s=Math.round(s); return Math.floor(s/60)+':'+('0'+(s%60)).slice(-2); }
MS.MISSION_MAP={}; MS.MISSIONS.forEach(function(M){ MS.MISSION_MAP[M.id]=M; });
MS.addMission=function(M){ MS.MISSIONS=MS.MISSIONS.filter(function(x){ return x.id!==M.id; }); MS.MISSIONS.push(M); MS.MISSION_MAP[M.id]=M; return M; };
})();
