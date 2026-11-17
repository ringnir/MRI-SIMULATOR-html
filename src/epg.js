/* ===== 精密計算（EPG：拡張位相グラフ）=====
   組織ごとの信号を、RF パルス・緩和・傾斜磁場による位相分散を状態（F+・F−・Z）で追って計算する。
   FSE の刺激エコー（再収束角 < 180°）、IR の定常状態、RF スポイリングつきの GRE、FISP／PSIF を
   Bloch 方程式と同じ結果で求める（ボクセル内の位置による違い＝画像上のアーチファクトはエンジン側で扱う）。
   参考：Weigel M. J Magn Reson Imaging 2015;41:266-295（Extended phase graphs）。 */
(function(){
var MS=window.MS, E=Math.exp, D=Math.PI/180, cos=Math.cos, sin=Math.sin;
function St(n){ return {n:n, pr:new Float64Array(n), pi:new Float64Array(n), mr:new Float64Array(n), mi:new Float64Array(n), zr:new Float64Array(n), zi:new Float64Array(n)}; }
function init(s,z0){ s.pr.fill(0); s.pi.fill(0); s.mr.fill(0); s.mi.fill(0); s.zr.fill(0); s.zi.fill(0); s.zr[0]=z0; }
/* RF：フリップ角 a（rad）、位相 ph（rad） */
function rf(s,a,ph,kmax){ var c2=cos(a/2), s2=sin(a/2), C=c2*c2, Sn=s2*s2, sa=sin(a), ca=cos(a);
  var e1r=cos(ph), e1i=sin(ph), e2r=cos(2*ph), e2i=sin(2*ph);
  for(var k=0;k<=kmax;k++){ var pr=s.pr[k], pi=s.pi[k], mr=s.mr[k], mi=s.mi[k], zr=s.zr[k], zi=s.zi[k];
    /* F+' = C F+ + e^{2iφ} S F- − i e^{iφ} sinα Z */
    var a1r=e2r*mr-e2i*mi, a1i=e2r*mi+e2i*mr; var b1r=e1r*zr-e1i*zi, b1i=e1r*zi+e1i*zr;
    var npr=C*pr+Sn*a1r+sa*b1i, npi=C*pi+Sn*a1i-sa*b1r;
    /* F-' = e^{-2iφ} S F+ + C F- + i e^{-iφ} sinα Z */
    var a2r=e2r*pr+e2i*pi, a2i=e2r*pi-e2i*pr; var b2r=e1r*zr+e1i*zi, b2i=e1r*zi-e1i*zr;
    var nmr=Sn*a2r+C*mr-sa*b2i, nmi=Sn*a2i+C*mi+sa*b2r;
    /* Z' = −(i/2) e^{-iφ} sinα F+ + (i/2) e^{iφ} sinα F- + cosα Z */
    var c1r=e1r*pr+e1i*pi, c1i=e1r*pi-e1i*pr; var d1r=e1r*mr-e1i*mi, d1i=e1r*mi+e1i*mr;
    var nzr=0.5*sa*c1i-0.5*sa*d1i+ca*zr, nzi=-0.5*sa*c1r+0.5*sa*d1r+ca*zi;
    s.pr[k]=npr; s.pi[k]=npi; s.mr[k]=nmr; s.mi[k]=nmi; s.zr[k]=nzr; s.zi[k]=nzi; } }
/* 緩和（τ ms）と静的な周波数ずれ df（Hz） */
function relax(s,tau,T1,T2,kmax,df){ var e1=E(-tau/T1), e2=E(-tau/T2);
  if(df){ var p=2*Math.PI*df*tau/1000, cr=cos(p), ci=sin(p);
    for(var k=0;k<=kmax;k++){ var a=s.pr[k], b=s.pi[k]; s.pr[k]=e2*(a*cr-b*ci); s.pi[k]=e2*(a*ci+b*cr); var m=s.mr[k], n=s.mi[k]; s.mr[k]=e2*(m*cr+n*ci); s.mi[k]=e2*(n*cr-m*ci); s.zr[k]*=e1; s.zi[k]*=e1; } }
  else for(var k2=0;k2<=kmax;k2++){ s.pr[k2]*=e2; s.pi[k2]*=e2; s.mr[k2]*=e2; s.mi[k2]*=e2; s.zr[k2]*=e1; s.zi[k2]*=e1; }
  s.zr[0]+=1-e1; }
/* 傾斜磁場による位相分散（1 段） */
function shift(s,kmax){ var n=s.n, top=Math.min(kmax+1,n-1);
  for(var k=top;k>0;k--){ s.pr[k]=s.pr[k-1]; s.pi[k]=s.pi[k-1]; }
  for(var j=0;j<top;j++){ s.mr[j]=s.mr[j+1]; s.mi[j]=s.mi[j+1]; } s.mr[top]=0; s.mi[top]=0;
  s.pr[0]=s.mr[0]; s.pi[0]=-s.mi[0]; return top; }
function spoil(s){ s.pr.fill(0); s.pi.fill(0); s.mr.fill(0); s.mi.fill(0); for(var k=1;k<s.n;k++){ s.zr[k]=0; s.zi[k]=0; } s.zi[0]=0; }

/* ---------- FSE（CPMG）：1 回の励起の後のエコー列。opt.ti があれば反転回復つき ----------
   返り値：{echo:[各エコーの横磁化（定常状態）], mz0:励起直前の縦磁化} */
function fseTrain(T1,T2,o){ var etl=Math.max(1,o.etl|0), esp=o.esp, b1=o.b1||1, n=etl+3, s=St(n);
  var exc=(o.exc||90)*D*b1, refs=o.refs, ref=(o.refoc||180)*D*b1;
  function run(z0){ init(s,z0); var kmax=0, outR=new Float64Array(etl), outI=new Float64Array(etl), t=0;
    if(o.ti){ /* 反転（スポイル込み）→ TI */ s.zr[0]*=cos((o.inv||180)*D*b1); relax(s,o.ti,T1,T2,0,0); t+=o.ti; }
    var zx=s.zr[0]; rf(s,exc,0,0);
    for(var e=0;e<etl;e++){ relax(s,esp/2,T1,T2,kmax,o.df||0); kmax=shift(s,kmax); rf(s,refs?refs[e]*D*b1:ref,Math.PI/2,kmax); relax(s,esp/2,T1,T2,kmax,o.df||0); kmax=shift(s,kmax); outR[e]=s.pr[0]; outI[e]=s.pi[0]; }
    t+=etl*esp;
    if(o.restore){ relax(s,esp/2,T1,T2,kmax,0); kmax=shift(s,kmax); rf(s,exc,Math.PI,kmax); t+=esp/2; }
    spoil(s); var rest=Math.max(0,o.tr-t); var zend=s.zr[0]*E(-rest/T1)+(1-E(-rest/T1));
    return {outR:outR, outI:outI, zend:zend, zx:zx}; }
  var r1=run(1), r0=run(0); var a=r1.zend-r0.zend, b=r0.zend; var m=Math.abs(1-a)<1e-9? 1 : b/(1-a); /* 縦磁化の定常状態（アフィン写像の不動点） */
  var echo=new Float64Array(etl); for(var i=0;i<etl;i++){ var er=r0.outR[i]+(r1.outR[i]-r0.outR[i])*m, ei=r0.outI[i]+(r1.outI[i]-r0.outI[i])*m; echo[i]=Math.hypot(er,ei); }
  return {echo:echo, mz0:m, zexc:r0.zx+(r1.zx-r0.zx)*m}; }
/* エコー列から「見かけの T2」（k 空間のライン重み用）を求める */
function effT2(echo,esp,T2){ var n=echo.length; if(n<3) return T2; var a=echo[1], b=echo[n-1]; if(!(a>0&&b>0)||b>=a) return T2*3; var t=-((n-2)*esp)/Math.log(b/a); return isFinite(t)&&t>0? Math.min(t,T2*6) : T2; }

/* ---------- RF スポイリングつき GRE（定常状態）---------- */
function spgr(T1,T2,TR,a,o){ o=o||{}; var inc=(o.inc==null?117:o.inc)*D, n=Math.min(300,Math.max(60,Math.round(3*T2/TR)+20)), s=St(n); init(s,1); var kmax=0, ph=0, dph=0, sig=0, last=0;
  var nmax=Math.min(800,Math.ceil(6*T1/TR)+80);
  for(var i=0;i<nmax;i++){ dph+=inc; ph+=dph; rf(s,a,ph,kmax); var sr=s.pr[0]*cos(-ph)-s.pi[0]*sin(-ph), si=s.pr[0]*sin(-ph)+s.pi[0]*cos(-ph); sig=Math.hypot(sr,si);
    relax(s,TR,T1,T2,kmax,0); kmax=Math.min(n-2,shift(s,kmax));
    if(i>40 && Math.abs(sig-last)<1e-7) break; last=sig; }
  return sig; }
/* ---------- FISP（RF パルス直後）と PSIF（次の RF 直前のエコー）---------- */
function ssfp(T1,T2,TR,a){ var n=80, s=St(n); init(s,1); var kmax=0, f=0, p=0, lf=0;
  var nmax=Math.min(1200,Math.ceil(6*Math.max(T1,T2)/TR)+100);
  for(var i=0;i<nmax;i++){ rf(s,a,0,kmax); f=Math.hypot(s.pr[0],s.pi[0]); relax(s,TR,T1,T2,kmax,0); kmax=Math.min(n-2,shift(s,kmax)); p=Math.hypot(s.pr[0],s.pi[0]);
    if(i>40 && Math.abs(f-lf)<1e-8) break; lf=f; }
  return {fisp:f, psif:p}; }
/* 3D FSE（SPACE／CUBE／VISTA）の可変再収束角：最初は高く、目標角まで下げて保つ */
function vfaTrain(etl,target){ var r=[]; var t=Math.max(30,Math.min(180,target||120)); for(var i=0;i<etl;i++){ var a; if(i<4) a=180-(180-Math.max(t,100))*(i/4); else a=t+(i>etl*0.7? (180-t)*0.25*((i-etl*0.7)/(etl*0.3)) : 0); r.push(a); } return r; }

/* 結果は組織×条件ごとに使い回す */
var cache={}, ncache=0;
function memo(key,fn){ var v=cache[key]; if(v===undefined){ if(ncache>20000){ cache={}; ncache=0; } v=cache[key]=fn(); ncache++; } return v; }
function q(x){ return Math.round(x*1000)/1000; }
MS.EPG={ St:St, rf:rf, relax:relax, shift:shift, spoil:spoil, fseTrain:fseTrain, effT2:effT2, spgr:spgr, ssfp:ssfp, vfaTrain:vfaTrain,
  fse:function(T1,T2,o){ var k=['f',q(T1),q(T2),o.etl,q(o.esp),q(o.tr),q(o.b1||1),o.refoc||180,o.exc||90,o.restore?1:0,q(o.ti||0),o.inv||180,o.refs?o.refs.join('|'):''].join(','); return memo(k,function(){ return fseTrain(T1,T2,o); }); },
  spgrM:function(T1,T2,TR,a){ return memo(['g',q(T1),q(T2),q(TR),q(a)].join(','),function(){ return spgr(T1,T2,TR,a); }); },
  ssfpM:function(T1,T2,TR,a){ return memo(['s',q(T1),q(T2),q(TR),q(a)].join(','),function(){ return ssfp(T1,T2,TR,a); }); },
  clear:function(){ cache={}; ncache=0; } };
})();
