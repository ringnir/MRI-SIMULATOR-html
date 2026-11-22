/* ===== Bloch 準拠モード =====
   通常の計算（組織ごとの信号 → 画素ずらし・k 空間の重み付けで近似）の代わりに、
   1) 画素ごとの磁化：その画素の B1・磁場ずれで、組織の磁化を EPG（Bloch 方程式と等価）で求める。
      複素数で持つ（bSSFP の位相・IR の符号・GRE の TE までの位相 e^{-i2π df TE} を小画素ごとに足すので、
      ボクセル内の位相の打ち消し＝バンディングの暗線・面内の磁場勾配による T2* の信号低下が出る）。
      FSE・3D FSE（可変再収束角）はエコーごとの振幅（刺激エコーを含む）を画素ごとに持つ。
   2) 信号の符号化：k 空間の各サンプルを、Σ 画素 M(画素, そのラインの状態) × e^{-i2π df t} × 減衰 × sinc(スライス内の位相分散) × e^{-i2π k·r}
      で直接足し合わせる（t＝そのサンプルを収集した時刻）。
      ・通常（SE・FSE・GRE・bSSFP・3D）：読出し方向の和を行ごと・エコーごとに作り、位相方向に足す（分離して計算）。
      ・EPI（DWI・DTI・BOLD・DSC）：各 ky ラインの収集時刻を EPI の軌跡（エコー間隔／R、部分フーリエ、読出しの往復）から決め、
        画素ごとに e^{-(i2π df + R2)(t_line + t_x)} をそのまま足す（O(N⁴)）。位相方向の歪み・脂肪のずれ・T2* によるぼけが信号式から出る。
      ・流れ：面直交方向の流速 v（tp.v）に、スライス選択の 1 次モーメント M1 ≈ −Gs·Trf²/4 による位相 φ = 2π·γ̄·M1·v を与える
        （FSE 系は偶数エコーで打ち消し＝even-echo rephasing、流れ補正 ON で 0）。拍動する血管（動脈・心腔）は、通常計算と同じ
        波形 MS.pulsWave で流速をラインごとに変え、その流速での信号（流入・flow void）と位相を ky ラインごとに与える → 位相方向のゴースト。
   3D は中央パーティション（3D 収集の 1 断面）として、3D の TR・TE・フリップ角・エコートレインで計算する（kz は SNR のみ）。
   未対応（通常計算）：上記以外のシーケンス・体動・面内方向の流れ・並列画像の再構成（雑音・折り返しは finish で通常どおり）。
   WebGPU：ワーカー内で navigator.gpu が使えるとき、和の計算を GPU で行う（下の MS.BlochGPU。使えなければ自動で JS）。 */
(function(){
var MS=window.MS, PI=Math.PI, E=Math.exp, cos=Math.cos, sin=Math.sin, GAMMA=42.577;
function sinc(x){ return Math.abs(x)<1e-6?1:Math.sin(x)/x; }
var TRF=2.5; /* 励起パルスの長さ（ms）：スライス選択傾斜の 1 次モーメントの目安 */
function pulsW(t,rr){ return MS.pulsWave? MS.pulsWave(t,rr) : 1+0.6*Math.sin(2*PI*t/rr); }

MS.Bloch={ maxN:128, budget:8e8, dbudget:2.5e8, nV:12,
/* ---------- 1) 磁化と収集の表（job）を作る ---------- */
prep:function(ctx,acq){
  var st=ctx.st, info=ctx.info, p=info.p, G=ctx.geo, S=G.S, ph=ctx.ph, tps=ctx.tps, B=acq.bloch, EP=MS.EPG, mot=ctx.motion||{};
  var B0=st.B0, hzppm=GAMMA*B0, fatHz=MS.FAT_PPM*hzppm, bw=p.bw||200;
  var type=B.type, epi=(type==='epi'), gre=(type==='gre'||type==='gre3d'||type==='bssfp'||(epi&&!!B.gre));
  var TE=B.te||p.te||0, pf=p.pf||1, esp=B.esp||0;
  /* エコーの種類（k 空間ラインごとにどのエコーを使うか） */
  var nE=1, etl=1, ne=0;
  if(type==='fse'){ etl=Math.max(1,B.etl|0); nE=etl; ne=Math.max(0,Math.min(etl-1,Math.round(TE/esp)-1)); }
  else if(type==='ss'){ etl=Math.max(2,Math.round(TE/esp)+Math.round((p.ny||128)/2)+2); nE=Math.min(16,etl); ne=Math.max(0,Math.round(TE/esp)-1); }
  else if(type==='fse3d'){ etl=Math.max(2,B.etl|0); ne=Math.max(0,Math.min(etl-1,Math.round(TE/esp)-1)); nE=16; }
  /* 計算格子 */
  var nxA=Math.max(8,Math.round(p.nx||128)), nyA=Math.max(8,Math.round(p.ny||128));
  var gpu=!!(MS.BlochGPU&&MS.BlochGPU.active), gmul=gpu?MS.BlochGPU.budgetMul:1;
  var Nb=Math.min(S,MS.Bloch.maxN);
  if(Math.max(nxA,nyA)>128 && S>=256 && Math.pow(256,3)*2*nE<=MS.Bloch.budget*gmul){ Nb=256;
    if(epi){ var occ=0; for(var q0=0;q0<S*S;q0++) if(G.lab[q0*G.ns*G.K]>0) occ++; occ/=S*S;
      var dcost=occ*1.3*65536*Math.min(256,nxA)*Math.min(256,nyA)*pf; if(dcost>MS.Bloch.dbudget*gmul) Nb=Math.min(S,MS.Bloch.maxN); } }
  var f=S/Nb, nx=Math.min(Nb,nxA)&~1, ny=Math.min(Nb,nyA)&~1;
  if(Math.max(nxA,nyA)>Nb) info.W.push({lv:'info',t:'Bloch準拠モードはマトリクス '+Nb+' までで計算しています（設定 '+nxA+'×'+nyA+'）'});
  var kyStart=-ny/2+Math.round((1-pf)*ny), j0=kyStart+ny/2; /* 収集する最初のライン */
  /* ky ラインごとのエコー（通常計算と同じ並べ方） */
  var lineE=new Int32Array(ny), gA=null, gB=null;
  if(type==='fse3d'){ var eL=new Int32Array(ny), eMin=etl, eMax=0;
    for(var j=0;j<ny;j++){ var e0=Math.max(0,Math.min(etl-1,ne+Math.round((j-ny/2)/(ny/2)*0.25*etl))); eL[j]=e0; if(j>=j0){ eMin=Math.min(eMin,e0); eMax=Math.max(eMax,e0); } }
    var nU=eMax-eMin+1; nE=Math.max(1,Math.min(16,nU)); gA=[]; gB=[];
    for(var g0=0;g0<nE;g0++){ gA.push(eMin+Math.floor(g0*nU/nE)); gB.push(Math.max(eMin+Math.floor((g0+1)*nU/nE),eMin+Math.floor(g0*nU/nE)+1)); }
    for(var j1=0;j1<ny;j1++) lineE[j1]=Math.max(0,Math.min(nE-1,Math.floor((eL[j1]-eMin)*nE/nU))); }
  else if(type==='ss'){ var first=Math.max(0,ne-Math.round(ny/2)); gA=[]; gB=[];
    for(var g1=0;g1<nE;g1++){ var a0=first+Math.floor(g1*(etl-first)/nE), a1=first+Math.floor((g1+1)*(etl-first)/nE); gA.push(a0); gB.push(Math.min(etl,Math.max(a1,a0+1))); }
    for(var j2=0;j2<ny;j2++) lineE[j2]=Math.max(0,Math.min(nE-1,Math.floor((j2-j0)/Math.max(1,(ny-j0))*nE))); }
  else if(type==='fse'){ for(var j3=0;j3<ny;j3++){ var grp=Math.max(1,Math.round(ny/etl)); var gg=Math.floor(j3/grp), gc=Math.floor((ny/2)/grp); lineE[j3]=((gg-gc+ne)%etl+etl)%etl; } }
  var shapeCache={};
  function shape(T2,T1,b1){ /* エコー列の形（実効 TE のエコーで規格化）。一様な磁場ずれは EPG の結果を変えない（クラッシャーで位相が分散しているため） */
    if(nE===1) return null; var key=T1+'|'+T2+'|'+Math.round(b1*50); var v=shapeCache[key]; if(v) return v;
    var o={etl:etl,esp:esp,tr:B.trEPG||B.tr,b1:b1,restore:!!B.restore,ti:B.ti||0}; if(B.refs) o.refs=B.refs; else o.refoc=B.refoc||150;
    var r=EP.fse(T1,T2,o).echo, c=r[Math.min(ne,etl-1)]||1e-12, out=new Float64Array(nE);
    if(type==='fse'){ for(var e=0;e<nE;e++) out[e]=r[e]/c; }
    else { for(var g=0;g<nE;g++){ var s=0, n=0; for(var e2=gA[g];e2<gB[g]&&e2<etl;e2++){ s+=r[e2]; n++; } out[g]=(n?s/n:0)/c; } }
    shapeCache[key]=out; return out; }
  /* 流れ：スライス選択の 1 次モーメント（ms/mm）。φ = 2π κ v（v: mm/ms） */
  var semac=st.semac||0, excBW=1200*(1+semac*0.6), dzSel=B.slab||(info.dz||5);
  var kap=(st.flowcomp||epi)? 0 : (excBW/1000/dzSel)*TRF*TRF/4;
  var fseT=(type==='fse'||type==='ss'||type==='fse3d');
  function flowPh(e,v){ /* エコー（群）e の流れの位相因子 [re,im]。FSE 系は奇数番目のエコーだけ位相が残る */
    var phi=2*PI*kap*v*0.01; if(!phi) return [1,0];
    if(!fseT) return [cos(phi),sin(phi)];
    var a0,a1; if(type==='fse'){ a0=e; a1=e+1; } else { a0=gA[e]; a1=gB[e]; } var no=0, nn=0; for(var k=a0;k<a1;k++){ if(k%2===0) no++; nn++; }
    return [(no*cos(phi)+(nn-no))/nn, no*sin(phi)/nn]; }
  /* 拍動：ラインごとの時刻（秒）→ 流速の段階 */
  var puls=!!mot.puls && !epi, rr=mot.rr||1, nav=Math.max(1,Math.round(p.nex||1)), nV=puls?MS.Bloch.nV:1, wv=[1], lineV=null;
  if(puls){ var wmin=1e9, wmax=-1e9; for(var i0=0;i0<64;i0++){ var w0=pulsW(i0/64*rr,rr); wmin=Math.min(wmin,w0); wmax=Math.max(wmax,w0); } if(wmax-wmin<1e-6){ wmax=wmin+1e-6; }
    wv=[]; for(var b0=0;b0<nV;b0++) wv.push(wmin+(b0+0.5)*(wmax-wmin)/nV);
    lineV=new Int32Array(ny*nav); var trl=acq.tr||5;
    for(var j4=0;j4<ny;j4++){ var tt;
      if(type==='fse'){ var grp2=Math.max(1,Math.round(ny/etl)); tt=(j4%grp2)*trl/1000; } else if(type==='ss') tt=(j4-j0)*esp/1000; else if(type==='fse3d') tt=j4*trl/1000; else tt=j4*trl/1000*(acq.tmul||1);
      for(var a=0;a<nav;a++){ var t1=tt+a*(info.T/nav)+a*0.37; lineV[j4*nav+a]=Math.max(0,Math.min(nV-1,Math.floor((pulsW(t1,rr)-wmin)/(wmax-wmin)*nV))); } } }
  /* 画素ごとの成分：水・脂肪 × エコー振幅（複素）、平均の磁場ずれ、スライス内の磁場勾配、減衰 */
  var NP=Nb*Nb, Ar=[new Float64Array(NP*nE),new Float64Array(NP*nE)], Ai=[new Float64Array(NP*nE),new Float64Array(NP*nE)], DF=[new Float64Array(NP),new Float64Array(NP)], WT=[new Float64Array(NP),new Float64Array(NP)], GS=new Float64Array(NP), GW=new Float64Array(NP), R2=[new Float64Array(NP),new Float64Array(NP)], R2p=[new Float64Array(NP),new Float64Array(NP)];
  var FI=[new Int32Array(NP).fill(-1),new Int32Array(NP).fill(-1)], FL=[]; /* 拍動する画素（成分ごと） */
  var fsMode=acq.fs||'none', wsc=1/G.ns, dz=(info.dz||5);
  var texs=tps.map(function(t){ return t?MS.texOf(t.key):null; });
  var tpV={}; function tpAt(li,b){ var k=li*64+b, o=tpV[k]; if(!o){ o=Object.create(tps[li]); o.v=tps[li].v*wv[b]; tpV[k]=o; } return o; }
  var sigC={}; function sigAt(li,b,isP,df,b1){ /* 磁場ずれに依らない信号式（perPixel でない）は組織・B1・流速の段階ごとに使い回す（通常計算の look と同じ扱い） */
    var t=isP?tpAt(li,b):tps[li]; if(acq.perPixel) return acq.sig(t,df,b1); var k=(li*64+b)*1000+Math.round(b1*50), r=sigC[k]; if(!r) r=sigC[k]=acq.sig(t,0,b1); return r; }
  var cw=[0,0,0,0];
  function amps(sg,df,b1,TX,o){ /* 水・脂肪の複素振幅 → cw=[wr,wi,fr,fi] */
    var w=sg.w||0, fz=sg.f||0;
    if(Math.abs(df)>excBW){ var q=excBW/Math.abs(df); w*=q*q; fz*=q*q; }
    if(fsMode==='chess'||fsMode==='spair'){ var sgm=Math.abs(fatHz)*0.42; var effF=fsMode==='chess'?(1-Math.abs(cos(PI/2*b1))):0.97; fz*=1-effF*E(-Math.pow(df/sgm,4)); w*=1-effF*E(-Math.pow((df-fatHz)/sgm,4)); }
    else if(fsMode==='we'){ var sg2=Math.abs(fatHz)*0.4; w*=E(-Math.pow(df/(sg2*1.3),4)); fz=fz*0.05+fz*0.95*E(-Math.pow((df+fatHz)/sg2,4)); }
    var amp=wsc; if(TX){ var tf=1+(TX.f||0)*G.ta[o]+(TX.c||0)*G.tb[o]+(TX.d||0)*G.tc[o]; if(tf<0.2) tf=0.2; amp*=tf; if(TX.ffv&&fz){ var vv=TX.ffv*G.ta[o]; w*=Math.max(0,1-vv); fz*=1+vv; } }
    var pw=sg.wph||0, pfz=sg.fph||0; if(gre){ pw-=2*PI*df*TE/1000; pfz-=2*PI*(df+fatHz)*TE/1000; }
    w*=amp; fz*=amp; cw[0]=w*cos(pw); cw[1]=w*sin(pw); cw[2]=fz*cos(pfz); cw[3]=fz*sin(pfz); }
  for(var r=0;r<S;r++) for(var c=0;c<S;c++){ var base=(r*S+c)*G.ns, pr=Math.floor(r/f), pc=Math.floor(c/f), P=pr*Nb+pc;
    for(var s=0;s<G.ns;s++) for(var kk=0;kk<G.K;kk++){ var o=(base+s)*G.K+kk, li=G.lab[o]; if(li<0) continue; if(li===0&&kk>0) continue;
      var tp=tps[li]; if(!tp||!tp.PD) continue; var x=G.xs[o], y=G.ys[o];
      var df=G.fld[o]*hzppm, g=G.grd[o]*hzppm*(st.shim?0.6:1); if(st.shim) df*=0.7;
      var b1=Math.round(MS.b1At(st,ph,x,y)*50)/50, TX=texs[li], v=tp.v||0, isP=puls&&v>0&&(tp.vt==='a'||tp.vt==='c');
      var dfs=[df,df+fatHz], T2s_=[tp.T2,B.fT2?B.fT2(tp):tp.fT2], T1s_=[tp.T1,tp.fT1], T2x=[tp.T2s,tp.fT2s];
      var nb=isP?nV:1, wsum=0;
      for(var b=0;b<nb;b++){ var sg=sigAt(li,b,isP,df,b1); amps(sg,df,b1,TX,o); var vb=isP?v*wv[b]:v;
        for(var ci=0;ci<2;ci++){ var ar=cw[2*ci], ai=cw[2*ci+1]; if(!ar&&!ai) continue; var aw=Math.hypot(ar,ai); var sh=shape(T2s_[ci],T1s_[ci],b1);
          var tgtR, tgtI, off;
          if(isP){ var fi=FI[ci][P]; if(fi<0){ fi=FI[ci][P]=FL.length; FL.push({P:P,ci:ci,ar:new Float64Array(nV*nE),ai:new Float64Array(nV*nE),df:0,wt:0,r2:0,r2p:0,gs:0}); } var F=FL[fi]; tgtR=F.ar; tgtI=F.ai; off=b*nE; }
          else { tgtR=Ar[ci]; tgtI=Ai[ci]; off=P*nE; }
          for(var e=0;e<nE;e++){ var m=sh?sh[e]:1; var fp=(ci===0&&vb)?flowPh(e,vb):null; var xr=ar*m, xi=ai*m; if(fp){ var t_=xr*fp[0]-xi*fp[1]; xi=xr*fp[1]+xi*fp[0]; xr=t_; } tgtR[off+e]+=xr; tgtI[off+e]+=xi; }
          var aw2=aw/nb, R2v=aw2/Math.max(1,gre?T2x[ci]:T2s_[ci]), t2p=gre?0:Math.max(0,1/Math.max(1,T2x[ci])-1/Math.max(1,T2s_[ci]));
          if(isP){ var F2=FL[FI[ci][P]]; F2.df+=aw2*dfs[ci]; F2.wt+=aw2; F2.r2+=R2v; F2.r2p+=aw2*t2p; F2.gs+=aw2*g; }
          else { DF[ci][P]+=aw2*dfs[ci]; WT[ci][P]+=aw2; R2[ci][P]+=R2v; R2p[ci][P]+=aw2*t2p; GS[P]+=aw2*g; GW[P]+=aw2; } } } } }
  for(var P2=0;P2<NP;P2++){ GS[P2]=GW[P2]>0?GS[P2]/GW[P2]:0; for(var c2=0;c2<2;c2++){ var ww=WT[c2][P2]; if(ww>0){ DF[c2][P2]/=ww; R2[c2][P2]/=ww; R2p[c2][P2]/=ww; } } }
  /* 読出し：各 kx の時刻（エコー中心からの ms） */
  var dwell=1000/(bw*nx), half=Nb/2, ofs=(f-1)/(2*f);
  var job={Nb:Nb,nx:nx,ny:ny,nE:nE,j0:j0,lineE:lineE,dwell:dwell,TE:TE,gre:gre,epi:epi,half:half,ofs:ofs,dz:dz,f:f,pf:pf,S:S,par:null};
  /* 分離して計算する成分（静止・拍動なし）：行の順に並べる */
  var nS=0; for(var P3=0;P3<NP;P3++) for(var c3=0;c3<2;c3++) if(WT[c3][P3]>0) nS++;
  var dirList=[]; /* 直接計算：[row,col,dfc,r2,r2p,gsp, Hr, Hi] */
  if(!epi){ var sRow=new Int32Array(nS), sCol=new Int32Array(nS), sPar=new Float64Array(nS*4), sA=new Float64Array(nS*nE*2), n=0;
    for(var P4=0;P4<NP;P4++) for(var c4=0;c4<2;c4++){ if(!(WT[c4][P4]>0)) continue; sRow[n]=(P4/Nb)|0; sCol[n]=P4%Nb; sPar[4*n]=DF[c4][P4]; sPar[4*n+1]=R2[c4][P4]; sPar[4*n+2]=R2p[c4][P4]; sPar[4*n+3]=GS[P4]*dz;
      for(var e3=0;e3<nE;e3++){ sA[(n*nE+e3)*2]=Ar[c4][P4*nE+e3]; sA[(n*nE+e3)*2+1]=Ai[c4][P4*nE+e3]; } n++; }
    job.sN=nS; job.sRow=sRow; job.sCol=sCol; job.sPar=sPar; job.sA=sA;
    /* 拍動する画素：ラインごとの振幅 H(j) = e^{-i2π ky y} × 平均_a A(流速段階, そのラインのエコー) */
    FL.forEach(function(F){ if(!(F.wt>0)) return; var yb=(F.P/Nb)|0, xb=F.P%Nb, yp=(yb-half+ofs)/Nb, H=new Float64Array(ny*2);
      for(var j=j0;j<ny;j++){ var kyv=j-ny/2, e=lineE[j], sr=0, si=0; for(var a=0;a<nav;a++){ var q=lineV[j*nav+a]*nE+e; sr+=F.ar[q]; si+=F.ai[q]; } sr/=nav; si/=nav;
        var phs=-2*PI*kyv*yp, cr=cos(phs), cs=sin(phs); H[2*j]=sr*cr-si*cs; H[2*j+1]=sr*cs+si*cr; }
      dirList.push([yb,xb,F.df/F.wt,F.r2/F.wt,F.r2p/F.wt,F.gs/F.wt*dz,H]); }); }
  else { /* EPI：ラインの時刻 t_j = ky × (エコー間隔 / R)（ky=0 が TE）。読出しは 1 ラインごとに往復 */
    var Dl=esp/Math.max(1,B.R||1), par=new Float64Array(ny); for(var j5=0;j5<ny;j5++) par[j5]=(Math.floor((j5-j0)/Math.max(1,B.R||1))%2===0)?1:-1; job.par=par; job.Dl=Dl;
    for(var P5=0;P5<NP;P5++) for(var c5=0;c5<2;c5++){ if(!(WT[c5][P5]>0)) continue; var yb2=(P5/Nb)|0, xb2=P5%Nb, yp2=(yb2-half+ofs)/Nb, dfc=DF[c5][P5], r2=R2[c5][P5], r2p=R2p[c5][P5], gsp=GS[P5]*dz, A_r=Ar[c5][P5], A_i=Ai[c5][P5];
      var H2=new Float64Array(ny*2);
      for(var j6=j0;j6<ny;j6++){ var kyv2=j6-ny/2, tj=kyv2*Dl, tau=gre?TE+tj:tj; var am=E(-tj*r2)*E(-Math.abs(tj)*r2p)*Math.abs(sinc(PI*gsp*Math.abs(tau)/1000));
        var phs2=-2*PI*(dfc*tj/1000+kyv2*yp2), cr2=am*cos(phs2), cs2=am*sin(phs2); H2[2*j6]=A_r*cr2-A_i*cs2; H2[2*j6+1]=A_r*cs2+A_i*cr2; }
      dirList.push([yb2,xb2,dfc,r2,r2p,gsp,H2]); }
    job.sN=0; }
  var nD=dirList.length, dRow=new Int32Array(nD), dCol=new Int32Array(nD), dPar=new Float64Array(nD*4), dH=new Float64Array(nD*ny*2);
  for(var d=0;d<nD;d++){ var L=dirList[d]; dRow[d]=L[0]; dCol[d]=L[1]; dPar[4*d]=L[2]; dPar[4*d+1]=L[3]; dPar[4*d+2]=L[4]; dPar[4*d+3]=L[5]; dH.set(L[6],d*ny*2); }
  job.dN=nD; job.dRow=dRow; job.dCol=dCol; job.dPar=dPar; job.dH=dH;
  return job; },

/* ---------- 読出し方向の因子 z(kx)：env × e^{-i2π(df·t + kx·x)}（s=±1 は読出しの向き） ---------- */
rofac:function(job,dfc,r2,r2p,gsp,col,s,zr,zi){ var nx=job.nx, dwell=job.dwell, TE=job.TE, gre=job.gre, epi=job.epi, Nb=job.Nb, xb=col-job.half, xo=job.ofs/Nb;
  for(var kx=0;kx<nx;kx++){ var kxv=kx-nx/2, t=s*kxv*dwell, env;
    if(epi) env=E(-t*r2); else { var tau=gre?TE+t:t; env=E(-t*r2)*E(-Math.abs(t)*r2p)*Math.abs(sinc(PI*gsp*Math.abs(tau)/1000)); }
    var m=(kxv*xb)%Nb; var cyc=dfc*t/1000+m/Nb+kxv*xo; var phs=-2*PI*cyc; zr[kx]=env*cos(phs); zi[kx]=env*sin(phs); } },

/* ---------- 2) 和（JS）：返り値 K[ny][nx]（複素） ---------- */
sums:function(job){ var Nb=job.Nb, nx=job.nx, ny=job.ny, nE=job.nE, j0=job.j0, lineE=job.lineE, half=job.half, ofs=job.ofs;
  var Kr=new Float64Array(ny*nx), Ki=new Float64Array(ny*nx), zr=new Float64Array(nx), zi=new Float64Array(nx), zr2=new Float64Array(nx), zi2=new Float64Array(nx);
  if(job.sN){ var Rre=new Float64Array(Nb*nE*nx), Rim=new Float64Array(Nb*nE*nx), sPar=job.sPar, sA=job.sA; /* 行ごとの和 R[y][e][kx] */
    for(var n=0;n<job.sN;n++){ MS.Bloch.rofac(job,sPar[4*n],sPar[4*n+1],sPar[4*n+2],sPar[4*n+3],job.sCol[n],1,zr,zi); var ro=job.sRow[n]*nE*nx;
      for(var e=0;e<nE;e++){ var a=sA[(n*nE+e)*2], b=sA[(n*nE+e)*2+1]; if(!a&&!b) continue; var ro2=ro+e*nx; for(var k=0;k<nx;k++){ Rre[ro2+k]+=a*zr[k]-b*zi[k]; Rim[ro2+k]+=a*zi[k]+b*zr[k]; } } }
    var cr=new Float64Array(Nb), ci=new Float64Array(Nb); /* 位相方向の和 */
    for(var j=j0;j<ny;j++){ var kyv=j-ny/2, e3=lineE[j]; for(var y=0;y<Nb;y++){ var ph_=-2*PI*kyv*(y-half+ofs)/Nb; cr[y]=cos(ph_); ci[y]=sin(ph_); }
      var row=j*nx; for(var k3=0;k3<nx;k3++){ var sr=0, si=0; for(var y3=0;y3<Nb;y3++){ var q=(y3*nE+e3)*nx+k3; var a1=Rre[q], b1=Rim[q]; sr+=a1*cr[y3]-b1*ci[y3]; si+=a1*ci[y3]+b1*cr[y3]; } Kr[row+k3]=sr; Ki[row+k3]=si; } } }
  if(job.dN){ var dPar=job.dPar, dH=job.dH, par=job.par, BK=4; /* 直接の和：K(j,kx) += G(kx)·H(j)（4 成分ずつ） */
    var Gp=[], Gm=[]; for(var u=0;u<BK;u++){ Gp.push([new Float64Array(nx),new Float64Array(nx)]); Gm.push([new Float64Array(nx),new Float64Array(nx)]); }
    for(var d0=0;d0<job.dN;d0+=BK){ var nb=Math.min(BK,job.dN-d0);
      for(var u2=0;u2<BK;u2++){ var d=d0+Math.min(u2,nb-1); MS.Bloch.rofac(job,dPar[4*d],dPar[4*d+1],dPar[4*d+2],dPar[4*d+3],job.dCol[d],1,Gp[u2][0],Gp[u2][1]); if(par) MS.Bloch.rofac(job,dPar[4*d],dPar[4*d+1],dPar[4*d+2],dPar[4*d+3],job.dCol[d],-1,Gm[u2][0],Gm[u2][1]); }
      for(var j2=j0;j2<ny;j2++){ var h=[0,0,0,0,0,0,0,0]; for(var u3=0;u3<nb;u3++){ var hb=(d0+u3)*ny*2+2*j2; h[2*u3]=dH[hb]; h[2*u3+1]=dH[hb+1]; }
        var GG=(par&&par[j2]<0)?Gm:Gp, a0=GG[0][0], b0=GG[0][1], a1=GG[1][0], b1=GG[1][1], a2=GG[2][0], b2=GG[2][1], a3=GG[3][0], b3=GG[3][1];
        var h0=h[0],i0=h[1],h1=h[2],i1=h[3],h2=h[4],i2=h[5],h3=h[6],i3=h[7], o=j2*nx;
        for(var k2=0;k2<nx;k2++){ var x0=a0[k2], w0=b0[k2], x1=a1[k2], w1=b1[k2], x2=a2[k2], w2=b2[k2], x3=a3[k2], w3=b3[k2];
          Kr[o+k2]+=x0*h0-w0*i0+x1*h1-w1*i1+x2*h2-w2*i2+x3*h3-w3*i3; Ki[o+k2]+=x0*i0+w0*h0+x1*i1+w1*h1+x2*i2+w2*h2+x3*i3+w3*h3; } } } }
  return {Kr:Kr, Ki:Ki}; },

/* ---------- 3) フィルタ・S 格子の中央に置く・逆 FFT ---------- */
post:function(ctx,job,K){ var st=ctx.st, S=job.S, nx=job.nx, ny=job.ny, j0=job.j0, filt=st.filter||'weak';
  var KR=new Float64Array(S*S), KI=new Float64Array(S*S);
  for(var j=j0;j<ny;j++){ var kyv=j-ny/2; var wky=1; if(filt==='hamming') wky=0.54+0.46*cos(PI*kyv/(ny/2)); else if(filt!=='none'){ var u=Math.abs(kyv)/(ny/2); if(u>0.8) wky=0.5+0.5*cos(PI*(u-0.8)/0.2); }
    var row=(kyv+S/2)*S;
    for(var k=0;k<nx;k++){ var kxv=k-nx/2; var wkx=1; if(filt==='hamming') wkx=0.54+0.46*cos(PI*kxv/(nx/2)); else if(filt!=='none'){ var u2=Math.abs(kxv)/(nx/2); if(u2>0.8) wkx=0.5+0.5*cos(PI*(u2-0.8)/0.2); }
      var q2=row+kxv+S/2; KR[q2]=K.Kr[j*nx+k]*wky*wkx; KI[q2]=K.Ki[j*nx+k]*wky*wkx; } }
  var kmag=null; if(ctx.wantK){ kmag=new Float32Array(S*S); for(var q4=0;q4<S*S;q4++) kmag[q4]=Math.log(1e-6+Math.hypot(KR[q4],KI[q4])); }
  for(var yy=0;yy<S;yy++) for(var xx=0;xx<S;xx++) if((xx+yy)&1){ var o2=yy*S+xx; KR[o2]=-KR[o2]; KI[o2]=-KI[o2]; }
  MS.fft2(KR,KI,S,true);
  for(var y4=0;y4<S;y4++) for(var x4=0;x4<S;x4++) if((x4+y4)&1){ var o3=y4*S+x4; KR[o3]=-KR[o3]; KI[o3]=-KI[o3]; }
  var re=new Float32Array(S*S), im=new Float32Array(S*S), pf=job.pf; var pfc=pf<1? Math.min(2,1/pf) : 1; for(var q5=0;q5<S*S;q5++){ re[q5]=KR[q5]*pfc; im[q5]=KI[q5]*pfc; }
  return {re:re, im:im, kmag:kmag}; },

form:function(ctx,acq){ var t0=Date.now(), BG=MS.BlochGPU;
  var job=MS.Bloch.prep(ctx,acq), K=null, via='js';
  if(BG&&BG.mode){ K=BG.take(job); if(K) via='gpu'; }
  if(!K) K=MS.Bloch.sums(job);
  var out=MS.Bloch.post(ctx,job,K);
  ctx.info.bloch={ms:Date.now()-t0, N:job.Nb, nE:job.nE, epi:job.epi, direct:job.dN, via:via};
  return out; }
};

/* ===== WebGPU（任意）=====
   ワーカーの中で navigator.gpu が使えるときだけ有効。計算の流れは同期（MS.run）なので、
   1 回目の MS.run で和の入力（job）を集めて GPU に送り（その回の画像は捨てる）、結果がそろったら 2 回目の MS.run で
   同じ順番の job に GPU の結果を使う。job の入力が 1 回目と一致しないときや GPU が失敗したときは JS で計算する。
   ワーカーの onmessage を包むのは、UI 側のコードを変えずに非同期の前処理を挟むため。 */
MS.BlochGPU={ active:false, mode:null, budgetMul:8, queue:[], results:[], idx:0, dev:null,
  sig:function(job){ /* job の要約（1 回目と 2 回目で同じ入力かを確かめる） */
    function h(a){ var s=0, n=a.length, st=Math.max(1,Math.floor(n/997)); for(var i=0;i<n;i+=st) s=(s*31+(a[i]*1e6|0))|0; return s+'/'+n; }
    return [job.Nb,job.nx,job.ny,job.nE,job.j0,job.sN,job.dN,job.epi?1:0,job.sA?h(job.sA):0,job.sPar?h(job.sPar):0,job.dH?h(job.dH):0,job.dPar?h(job.dPar):0].join(','); },
  take:function(job){ var B=MS.BlochGPU;
    if(B.mode==='collect'){ B.queue.push({job:job,sig:B.sig(job)}); return {Kr:new Float64Array(job.ny*job.nx), Ki:new Float64Array(job.ny*job.nx)}; }
    if(B.mode==='replay'){ var r=B.results[B.idx++]; if(r&&r.K&&r.sig===B.sig(job)) return r.K; return null; }
    return null; }
};
(function(){
  var SG=typeof self!=='undefined'?self:null; if(!SG||typeof SG.importScripts!=='function'||!SG.navigator||!SG.navigator.gpu) return; /* ワーカー内で WebGPU があるときだけ */
  var BG=MS.BlochGPU, WG=64;
  /* WGSL：(1) 行ごとの和 (2) 位相方向の和 (3) 直接の和。位相は周回数の小数部で持ち（整数部を落とす）、f32 の丸め誤差だけにする */
  var COMMON='struct P { Nb:u32, nx:u32, ny:u32, nE:u32, j0:u32, n:u32, epi:u32, gre:u32, dwell:f32, TE:f32, half:f32, xo:f32, base:u32, pad0:u32, pad1:u32, pad2:u32 };\n'+
   '@group(0) @binding(0) var<uniform> pr:P;\n'+
   'const TP:f32=6.283185307179586;\n'+
   /* sin・cos は WGSL の組込み（誤差の許容が大きい）を使わず、周回数 c から自前の多項式で求める（|誤差| < 1e-6） */
   'fn sc(c0:f32)->vec2<f32>{ let r=c0-round(c0); let q=round(r*4.0); let x=TP*(r-q*0.25); let x2=x*x;\n'+
   '  let s=x*(1.0-x2/6.0*(1.0-x2/20.0*(1.0-x2/42.0*(1.0-x2/72.0)))); let c=1.0-x2/2.0*(1.0-x2/12.0*(1.0-x2/30.0*(1.0-x2/56.0)));\n'+
   '  let qi=(i32(q)+4)%4; if(qi==0){return vec2<f32>(c,s);} if(qi==1){return vec2<f32>(-s,c);} if(qi==2){return vec2<f32>(-c,-s);} return vec2<f32>(s,-c); }\n'+
   'fn sincf(x:f32)->f32{ if(abs(x)<1e-6){return 1.0;} return sc(x/TP).y/x; }\n'+
   'fn rof(dfc:f32,r2:f32,r2p:f32,gsp:f32,col:i32,kx:u32,s:f32)->vec2<f32>{ let kxv=i32(kx)-i32(pr.nx/2u); let t=s*f32(kxv)*pr.dwell; var env:f32;\n'+
   '  if(pr.epi==1u){ env=exp(-t*r2); } else { var tau=t; if(pr.gre==1u){ tau=pr.TE+t; } env=exp(-t*r2)*exp(-abs(t)*r2p)*abs(sincf(3.141592653589793*gsp*abs(tau)/1000.0)); }\n'+
   '  let m=(kxv*(col-i32(pr.half)))%i32(pr.Nb); let cyc=dfc*t/1000.0+f32(m)/f32(pr.Nb)+f32(kxv)*pr.xo; return env*sc(-cyc); }\n';
  var K1=COMMON+ /* 行ごとの和：スレッド = (kx, y)。その行の成分を順に足す */
   '@group(0) @binding(1) var<storage,read> rs:array<u32>;\n@group(0) @binding(2) var<storage,read> col:array<i32>;\n@group(0) @binding(3) var<storage,read> par:array<vec4<f32>>;\n@group(0) @binding(4) var<storage,read> amp:array<vec2<f32>>;\n@group(0) @binding(5) var<storage,read_write> R:array<vec2<f32>>;\n'+
   '@compute @workgroup_size('+WG+') fn main(@builtin(global_invocation_id) gid:vec3<u32>){ let kx=gid.x; let y=gid.y; if(kx>=pr.nx||y>=pr.Nb){return;}\n'+
   '  var acc:array<vec2<f32>,16>; for(var e=0u;e<16u;e++){ acc[e]=vec2<f32>(0.0,0.0); }\n'+
   '  for(var n=rs[y]; n<rs[y+1u]; n++){ let q=par[n]; let z=rof(q.x,q.y,q.z,q.w,col[n],kx,1.0);\n'+
   '    for(var e=0u;e<pr.nE;e++){ let a=amp[n*pr.nE+e]; acc[e]+=vec2<f32>(a.x*z.x-a.y*z.y, a.x*z.y+a.y*z.x); } }\n'+
   '  for(var e=0u;e<pr.nE;e++){ R[(y*pr.nE+e)*pr.nx+kx]=acc[e]; } }\n';
  var K2=COMMON+ /* 位相方向の和：スレッド = (kx, j) */
   '@group(0) @binding(1) var<storage,read> R:array<vec2<f32>>;\n@group(0) @binding(2) var<storage,read> cy:array<vec2<f32>>;\n@group(0) @binding(3) var<storage,read> le:array<u32>;\n@group(0) @binding(4) var<storage,read_write> K:array<vec2<f32>>;\n'+
   '@compute @workgroup_size('+WG+') fn main(@builtin(global_invocation_id) gid:vec3<u32>){ let kx=gid.x; let j=gid.y; if(kx>=pr.nx||j>=pr.ny||j<pr.j0){return;} let e=le[j];\n'+
   '  var s=vec2<f32>(0.0,0.0); for(var y=0u;y<pr.Nb;y++){ let a=R[(y*pr.nE+e)*pr.nx+kx]; let c=cy[j*pr.Nb+y]; s+=vec2<f32>(a.x*c.x-a.y*c.y, a.x*c.y+a.y*c.x); }\n'+
   '  K[j*pr.nx+kx]=s; }\n';
  var K3=COMMON+ /* 直接の和：スレッド = (kx, 8 ライン)。成分ごとに z(kx) を 1 回求めて 8 ラインに足す。pr.base からの pr.n 個 */
   '@group(0) @binding(1) var<storage,read> col:array<i32>;\n@group(0) @binding(2) var<storage,read> par:array<vec4<f32>>;\n@group(0) @binding(3) var<storage,read> H:array<vec2<f32>>;\n@group(0) @binding(4) var<storage,read> sgn:array<f32>;\n@group(0) @binding(5) var<storage,read_write> K:array<vec2<f32>>;\n'+
   '@compute @workgroup_size('+WG+') fn main(@builtin(global_invocation_id) gid:vec3<u32>){ let kx=gid.x; let jb=gid.y*8u; if(kx>=pr.nx||jb>=pr.ny){return;}\n'+
   '  var acc:array<vec2<f32>,8>; for(var i=0u;i<8u;i++){ acc[i]=vec2<f32>(0.0,0.0); }\n'+
   '  for(var n=0u;n<pr.n;n++){ let q=par[n]; let zp=rof(q.x,q.y,q.z,q.w,col[n],kx,1.0); var zm=zp; if(pr.epi==1u){ zm=rof(q.x,q.y,q.z,q.w,col[n],kx,-1.0); }\n'+
   '    for(var i=0u;i<8u;i++){ let j=jb+i; if(j>=pr.ny){break;} let h=H[n*pr.ny+j]; var z=zp; if(sgn[j]<0.0){ z=zm; } acc[i]+=vec2<f32>(z.x*h.x-z.y*h.y, z.x*h.y+z.y*h.x); } }\n'+
   '  for(var i=0u;i<8u;i++){ let j=jb+i; if(j>=pr.ny){break;} K[j*pr.nx+kx]+=acc[i]; } }\n';
  var pipes=null;
  function init(){ return SG.navigator.gpu.requestAdapter().then(function(ad){ if(!ad) throw new Error('no adapter'); if((ad.isFallbackAdapter||(ad.info&&ad.info.isFallbackAdapter))&&!SG.BLOCH_GPU_ALLOW_FALLBACK) throw new Error('fallback adapter (software) — JS を使う');
      var lim=Math.min(ad.limits.maxStorageBufferBindingSize, 1<<30), lb=Math.min(ad.limits.maxBufferSize, 1<<30);
      return ad.requestDevice({requiredLimits:{maxStorageBufferBindingSize:lim, maxBufferSize:lb}}); })
    .then(function(dev){ BG.dev=dev; BG.maxBind=dev.limits.maxStorageBufferBindingSize; dev.lost.then(function(){ BG.active=false; });
      function mk(code){ var m=dev.createShaderModule({code:code}); return dev.createComputePipeline({layout:'auto',compute:{module:m,entryPoint:'main'}}); }
      pipes={k1:mk(K1),k2:mk(K2),k3:mk(K3)}; BG.active=true; }); }
  function buf(dev,data,usage){ var b=dev.createBuffer({size:Math.max(16,(data.byteLength+3)&~3),usage:usage|GPUBufferUsage.COPY_DST}); dev.queue.writeBuffer(b,0,data.buffer,data.byteOffset,data.byteLength); return b; }
  function ub(dev,job,n,base){ var a=new ArrayBuffer(64), u=new Uint32Array(a), f=new Float32Array(a); u[0]=job.Nb; u[1]=job.nx; u[2]=job.ny; u[3]=job.nE; u[4]=job.j0; u[5]=n; u[6]=job.epi?1:0; u[7]=job.gre?1:0; f[8]=job.dwell; f[9]=job.TE; f[10]=job.half; f[11]=job.ofs/job.Nb; u[12]=base||0;
    var b=dev.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}); dev.queue.writeBuffer(b,0,a); return b; }
  function bind(dev,pipe,bufs){ return dev.createBindGroup({layout:pipe.getBindGroupLayout(0),entries:bufs.map(function(b,i){ return {binding:i,resource:{buffer:b}}; })}); }
  function f32(a){ return new Float32Array(a); }
  BG.run=function(job){ var dev=BG.dev, U=GPUBufferUsage, ST=U.STORAGE, tmp=[], nx=job.nx, ny=job.ny, Nb=job.Nb, nE=job.nE;
    var Kbuf=dev.createBuffer({size:ny*nx*8,usage:ST|U.COPY_SRC|U.COPY_DST}); tmp.push(Kbuf);
    var enc=dev.createCommandEncoder();
    if(job.sN){ if(nE>16) throw new Error('nE>16');
      var rs=new Uint32Array(Nb+1); for(var n=0;n<job.sN;n++) rs[job.sRow[n]+1]++; for(var y=0;y<Nb;y++) rs[y+1]+=rs[y];
      var bR=dev.createBuffer({size:Nb*nE*nx*8,usage:ST}); tmp.push(bR);
      var b1=[ub(dev,job,job.sN),buf(dev,rs,ST),buf(dev,job.sCol,ST),buf(dev,f32(job.sPar),ST),buf(dev,f32(job.sA),ST),bR]; tmp=tmp.concat(b1);
      var cy=new Float32Array(ny*Nb*2); for(var j=0;j<ny;j++){ var kyv=j-ny/2; for(var y2=0;y2<Nb;y2++){ var ph=-2*Math.PI*kyv*(y2-job.half+job.ofs)/Nb; cy[(j*Nb+y2)*2]=Math.cos(ph); cy[(j*Nb+y2)*2+1]=Math.sin(ph); } }
      var b2=[b1[0],bR,buf(dev,cy,ST),buf(dev,new Uint32Array(job.lineE),ST),Kbuf]; tmp.push(b2[2],b2[3]);
      var p1=enc.beginComputePass(); p1.setPipeline(pipes.k1); p1.setBindGroup(0,bind(dev,pipes.k1,b1)); p1.dispatchWorkgroups(Math.ceil(nx/WG),Nb); p1.end();
      var p2=enc.beginComputePass(); p2.setPipeline(pipes.k2); p2.setBindGroup(0,bind(dev,pipes.k2,b2)); p2.dispatchWorkgroups(Math.ceil(nx/WG),ny); p2.end(); }
    if(job.dN){ var sg=new Float32Array(ny); for(var j3=0;j3<ny;j3++) sg[j3]=job.par?job.par[j3]:1;
      var bs=buf(dev,sg,ST); tmp.push(bs); var per=Math.max(1,Math.floor(Math.min(BG.maxBind,64<<20)/(ny*8))); /* H を分けて送る */
      for(var a=0;a<job.dN;a+=per){ var m=Math.min(per,job.dN-a);
        var b3=[ub(dev,job,m,a),buf(dev,job.dCol.subarray(a,a+m),ST),buf(dev,f32(job.dPar.subarray(4*a,4*(a+m))),ST),buf(dev,f32(job.dH.subarray(a*ny*2,(a+m)*ny*2)),ST),bs,Kbuf]; tmp=tmp.concat(b3.slice(0,4));
        var p3=enc.beginComputePass(); p3.setPipeline(pipes.k3); p3.setBindGroup(0,bind(dev,pipes.k3,b3)); p3.dispatchWorkgroups(Math.ceil(nx/WG),Math.ceil(ny/8)); p3.end(); } }
    var rb=dev.createBuffer({size:ny*nx*8,usage:U.MAP_READ|U.COPY_DST}); enc.copyBufferToBuffer(Kbuf,0,rb,0,ny*nx*8); dev.queue.submit([enc.finish()]);
    return rb.mapAsync(GPUMapMode.READ).then(function(){ var o=new Float32Array(rb.getMappedRange().slice(0)); rb.unmap(); rb.destroy(); tmp.forEach(function(b){ b.destroy(); });
      var Kr=new Float64Array(ny*nx), Ki=new Float64Array(ny*nx); for(var i=0;i<ny*nx;i++){ Kr[i]=o[2*i]; Ki[i]=o[2*i+1]; } return {Kr:Kr,Ki:Ki}; }); };
  /* 1 回目（集める）→ GPU → 2 回目（使う）。st.bloch でないときやエラー時はそのまま */
  BG.prepare=function(st){ if(!BG.active||!st||!st.bloch||st.blochGPU===false) return Promise.resolve(false);
    BG.mode='collect'; BG.queue=[]; var stc=JSON.parse(JSON.stringify(st));
    try{ MS.run(stc); }catch(e){ BG.mode=null; return Promise.resolve(false); }
    BG.mode=null; var Q=BG.queue; BG.queue=[]; if(!Q.length) return Promise.resolve(false);
    var t0=Date.now(); return Q.reduce(function(pm,q){ return pm.then(function(arr){ return BG.run(q.job).then(function(K){ arr.push({sig:q.sig,K:K}); return arr; }); }); },Promise.resolve([]))
      .then(function(arr){ BG.results=arr; BG.idx=0; BG.mode='replay'; BG.lastMs=Date.now()-t0; return true; }, function(e){ BG.mode=null; BG.err=String(e); return false; }); };
  BG.done=function(){ BG.mode=null; BG.results=[]; BG.idx=0; };
  /* ワーカーの onmessage を包む（UI のコードはそのまま） */
  var user=null, hooked=false;
  try{ Object.defineProperty(SG,'onmessage',{configurable:true, get:function(){ return user; }, set:function(fn){ user=fn; if(!hooked){ hooked=true; SG.addEventListener('message',function(e){
      var d=e.data, st=d&&d.st; if(!user) return;
      if(!BG.active||!st||!st.bloch||d.type==='probe'){ user.call(SG,e); return; }
      BG.prepare(st).then(function(){ try{ user.call(SG,e); } finally{ BG.done(); } }); }); } }}); }catch(e){}
  BG.ready=init().catch(function(e){ BG.active=false; BG.err=String(e); });
})();
})();
