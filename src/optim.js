/* ============================================================
   「〜を優先して最適化」：いまの条件から出発して、目的を良くする方向へ
   パラメータを1つずつ動かす（座標降下法）。制約（撮像時間・SNR・SAR・分解能など）を
   破る候補は捨てる。計算は MS.derive（時間・SNR・SAR・画素）と MS.probe（組織の信号）だけ。
   ============================================================ */
(function(){
var MS=window.MS;
/* 目的ごとの「動かしてよいパラメータ」と制約。比は「いまの値」に対する倍率 */
MS.OPT_GOALS=[
  {id:'time', n:'撮像時間を短く', d:'SNRを7割以上・分解能とコントラスト（TE・TR・TI・フリップ角）を保ったまま、加速・加算・ETL・バンド幅で時間を縮めます。',
   keys:['nex','r','rz','sms','cs','pf','pfz','etl','bw','seg','vps','bavg'], c:{snr:0.7}},
  {id:'snr', n:'SNRを高く', d:'撮像時間を5%以内の増加・分解能とコントラストを保ったまま、SNRを上げます。',
   keys:['nex','r','rz','sms','cs','pf','pfz','etl','bw','seg','vps','bavg'], c:{T:1.05}},
  {id:'res', n:'分解能を細かく', d:'SNRを6割以上・撮像時間を3割増以内に保って、画素（ボクセル）を小さくします。FOVは変えません。',
   keys:['nx','ny','thk','npart','nex','r','rz','pf','pfz','etl','bw'], c:{snr:0.6,T:1.3}},
  {id:'cnr', n:'コントラスト（CNR）を高く', d:'グラフで選んだ2組織のCNRを上げます。撮像時間は2割増まで、分解能は変えません。',
   keys:['te','tr','ti','fa','refoc','etl','esp','bw','nex'], c:{T:1.2}, needSig:true},
  {id:'sar', n:'SARを下げる', d:'撮像時間を3割増以内・SNRとCNRを8割以上に保ったまま、リフォーカス角・フリップ角・TR・ETLなどでSARを下げます。',
   keys:['refoc','fa','tr','etl','esp','sms','bw'], c:{T:1.3,snr:0.8,cnr:0.8}, needSig:true}
];
MS.OPT_MAP={}; MS.OPT_GOALS.forEach(function(g){ MS.OPT_MAP[g.id]=g; });
MS.addOptGoal=function(g){ MS.OPT_GOALS.push(g); MS.OPT_MAP[g.id]=g; };

var FAT=3.4, DIM3=false;
/* コントラストを決める値は「いまの値」の近くだけ動かす（T2強調がPD強調に変わる、などを防ぐ） */
var BOX={te:[0.65,1.5],tr:[0.65,1.6],ti:[0.8,1.25],fa:[0.6,1.6],esp:[0.7,1.4]};
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function snap(k,v){ var d=MS.PDEF[k]; if(!d) return v; var s=d.step||1; v=Math.round(v/s)*s; v=Math.min(d.max,Math.max(d.min,v)); return +v.toFixed(4); }
/* 候補値：いまの値を中心に、倍率と隣の目盛りで作る */
function cands(k,c,c0){ var d=MS.PDEF[k], out={}, s=d.step||1;
  var lo=d.min, hi=d.max; if(k==='nex'||k==='bavg') lo=Math.max(lo,Math.min(1,c0)); if(k==='refoc') lo=Math.max(lo,Math.min(100,c0));
  if(BOX[k]){ lo=Math.max(lo,c0*BOX[k][0]); hi=Math.min(hi,c0*BOX[k][1]); }
  var lim={r:4,rz:3,sms:4,cs:DIM3?8:3}; var mx=Math.max(c,lim[k]||d.max);
  var f=[0.5,0.67,0.8,0.9,1.12,1.25,1.5,2];
  if(k==='pf'||k==='pfz') [0.5,0.5625,0.625,0.6875,0.75,0.875,1].forEach(function(v){ out[v]=1; });
  else if(k==='r'||k==='rz'||k==='sms'||k==='nex'||k==='bavg'||k==='seg') [-2,-1,1,2].forEach(function(dd){ out[snap(k,c+dd*(k==='nex'?0.5:1))]=1; out[snap(k,c+dd*(k==='nex'?1:2))]=1; });
  else { f.forEach(function(m){ out[snap(k,c*m)]=1; }); out[snap(k,c+s)]=1; out[snap(k,c-s)]=1; }
  return Object.keys(out).map(Number).filter(function(v){ return isFinite(v)&&v!==c&&v>=lo&&v<=Math.min(hi,mx); }); }

function prep(st){ var sq=MS.SEQ[st.seq], ph=MS.PHANTOMS[st.phantom]; if(st.coil==null) st.coil=ph.coil; if(st.coilG==null) st.coilG=ph.coilG; st.p.dim3=sq.dim==='3D'; return sq; }
function measure(st,goal,A,B,oi){ var sq=prep(st), i;
  try{ i=MS.derive(st,sq); }catch(e){ return null; }
  var m={T:i.T, snr:i.snr0, sar:i.sar||0, vox:(i.dx||1)*(i.dy||1)*(i.dz||1), cs:Math.abs(FAT*42.577*st.B0/((i.p&&i.p.bw)||st.p.bw)), W:(i.W||[]).length, p:i.p};
  if(goal.needSig&&A&&B){ var r; try{ r=MS.probe(st,{xk:'te',xs:[],out:oi||0}); }catch(e){ r=null; }
    if(r){ var a=r.keys.indexOf(A), b=r.keys.indexOf(B); m.cnr=(a>=0&&b>=0)?Math.abs(r.cur.v[a]-r.cur.v[b])*i.snr0:0; } }
  return m; }
function score(goal,m,m0){ if(!m||!isFinite(m.T)||!isFinite(m.snr)||m.snr<=0) return -Infinity; var c=goal.c;
  if(c.snr&&m.snr<c.snr*m0.snr) return -Infinity;
  if(c.T&&m.T>c.T*m0.T+0.5) return -Infinity;
  if(c.cnr&&m0.cnr>0&&(m.cnr||0)<c.cnr*m0.cnr) return -Infinity;
  if(m.sar>Math.max(100,m0.sar)+1e-6) return -Infinity;              /* SAR上限を超えない */
  if(goal.id!=='res'&&Math.abs(m.vox-m0.vox)>0.02*m0.vox) return -Infinity; /* 分解能は保つ */
  if(m.cs>Math.max(2,m0.cs*1.5)) return -Infinity;                   /* 化学シフトが目立ちすぎない */
  if(m.W>m0.W) return -Infinity;                                    /* 新しい警告を出さない */
  var v; switch(goal.id){
    case 'time': v=m0.T/Math.max(m.T,1e-3); break;
    case 'snr': v=m.snr/m0.snr; break;
    case 'res': v=m0.vox/m.vox; break;
    case 'cnr': v=(m.cnr||0)/Math.max(m0.cnr||1e-9,1e-9); break;
    case 'sar': v=Math.max(m0.sar,1e-3)/Math.max(m.sar,1e-3); break;
    default: v=goal.f?goal.f(m,m0):0; }
  /* 同点なら時間が短くSNRが高い方を少しだけ優先 */
  return v+0.002*(m.snr/m0.snr)+0.002*(m0.T/Math.max(m.T,1e-3)); }

/* st0：いまの状態、goalId、opt={keys:表示中パラメータ, A,B:組織キー, out:出力番号, passes} */
MS.optimize=function(st0,goalId,opt){ opt=opt||{}; var goal=MS.OPT_MAP[goalId]; if(!goal) throw new Error('unknown goal '+goalId);
  DIM3=(MS.SEQ[st0.seq].dim==='3D');
  var st=clone(st0), A=opt.A, B=opt.B, oi=opt.out||0;
  var m0=measure(clone(st),goal,A,B,oi); if(!m0) return {ok:false,msg:'計算できませんでした'};
  if(goal.needSig&&!(m0.cnr>0)&&goal.id==='cnr') return {ok:false,msg:'選んだ2組織の信号差が0です。グラフで比べる組織を選び直してください。'};
  var vis=opt.keys||Object.keys(st.p), keys=goal.keys.filter(function(k){ return vis.indexOf(k)>=0&&st.p[k]!==undefined&&MS.PDEF[k]; });
  if(!keys.length) return {ok:false,msg:'このシーケンスでは動かせるパラメータがありません'};
  var best=score(goal,m0,m0), bm=m0; if(!isFinite(best)) return {ok:false,msg:'この条件では最適化できません'}; var n=0, passes=opt.passes||6;
  for(var it=0;it<passes;it++){ var moved=false;
    keys.forEach(function(k){ var c=st.p[k], bv=c, bs=best, bmm=null;
      cands(k,c,st0.p[k]).forEach(function(v){ var s2=clone(st); s2.p[k]=v; var m=measure(s2,goal,A,B,oi); n++; var sc=score(goal,m,m0); if(sc>bs+1e-4){ bs=sc; bv=v; bmm=m; } });
      if(bv!==c){ st.p[k]=bv; best=bs; bm=bmm; moved=true; } });
    if(!moved) break; }
  var ch=[]; keys.forEach(function(k){ if(st.p[k]!==st0.p[k]) ch.push({k:k,from:st0.p[k],to:st.p[k]}); });
  return {ok:true, goal:goal.id, p:st.p, changes:ch, before:{T:m0.T,snr:m0.snr,sar:m0.sar,vox:m0.vox,cnr:m0.cnr}, after:{T:bm.T,snr:bm.snr,sar:bm.sar,vox:bm.vox,cnr:bm.cnr}, gain:best-0.004, evals:n}; };
})();
