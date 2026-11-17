/* ===== Bloch 準拠モード =====
   通常の計算（組織ごとの信号 → 画素ずらし・k 空間の重み付けで近似）の代わりに、
   1) 画素ごとの磁化：その画素の B1・磁場ずれで、組織の磁化を EPG（Bloch 方程式と等価）で求める。
      FSE はエコーごとの振幅（刺激エコーを含む）を画素ごとに持つ。
   2) 信号の符号化：k 空間の各サンプルを、Σ 画素 M(画素, そのラインのエコー) × e^{-i2π(df·t)} × 減衰 × e^{-i2π k·r}
      で直接足し合わせる（t＝読出し中の時刻）。化学シフト・磁場ずれによる歪み・T2* によるぼけ・
      スライス内の磁場勾配による信号低下（sinc）が、ずらしの近似ではなく信号式からそのまま出る。
   対応：SE・FSE・IR（FLAIR・STIR）・シングルショット FSE・2D スポイルド GRE・bSSFP。
   未対応（通常計算）：EPI・3D・動き・流れの位相・並列画像の再構成（雑音・折り返しは finish で通常どおり）。 */
(function(){
var MS=window.MS, PI=Math.PI, E=Math.exp, cos=Math.cos, sin=Math.sin, GAMMA=42.577;
function sinc(x){ return Math.abs(x)<1e-6?1:Math.sin(x)/x; }

MS.Bloch={ maxN:128, budget:8e8,
form:function(ctx,acq){ var t0=Date.now();
  var st=ctx.st, info=ctx.info, p=info.p, G=ctx.geo, S=G.S, ph=ctx.ph, tps=ctx.tps, B=acq.bloch, EP=MS.EPG;
  var B0=st.B0, hzppm=GAMMA*B0, fatHz=MS.FAT_PPM*hzppm, bw=p.bw||200;
  var type=B.type, gre=(type==='gre'||type==='bssfp');
  /* エコーの種類（k 空間ラインごとにどのエコーを使うか） */
  var nE=1, etl=1, esp=B.esp||0;
  if(type==='fse'){ etl=Math.max(1,B.etl|0); nE=etl; }
  else if(type==='ss'){ etl=Math.max(2,Math.round(B.te/esp)+Math.round((p.ny||128)/2)+2); nE=Math.min(16,etl); }
  /* 計算格子 */
  var nxA=Math.max(8,Math.round(p.nx||128)), nyA=Math.max(8,Math.round(p.ny||128));
  var Nb=Math.min(S,MS.Bloch.maxN); if(Math.max(nxA,nyA)>128 && S>=256 && Math.pow(256,3)*2*nE<=MS.Bloch.budget) Nb=256;
  var f=S/Nb, nx=Math.min(Nb,nxA)&~1, ny=Math.min(Nb,nyA)&~1;
  if(Math.max(nxA,nyA)>Nb) info.W.push({lv:'info',t:'Bloch準拠モードはマトリクス '+Nb+' までで計算しています（設定 '+nxA+'×'+nyA+'）'});
  /* 画素ごとの成分：水・脂肪 × エコー振幅、平均の磁場ずれ、スライス内の磁場勾配、減衰 */
  var NP=Nb*Nb, A=[new Float64Array(NP*nE),new Float64Array(NP*nE)], DF=[new Float64Array(NP),new Float64Array(NP)], WT=[new Float64Array(NP),new Float64Array(NP)], GS=new Float64Array(NP), R2=[new Float64Array(NP),new Float64Array(NP)], R2p=[new Float64Array(NP),new Float64Array(NP)];
  var fsMode=acq.fs||'none', semac=st.semac||0, excBW=1200*(1+semac*0.6), wsc=1/G.ns, dz=(info.dz||5);
  var texs=tps.map(function(t){ return t?MS.texOf(t.key):null; });
  var ne=(type==='fse')? Math.max(0,Math.min(etl-1,Math.round(B.te/esp)-1)) : (type==='ss'? Math.max(0,Math.round(B.te/esp)-1) : 0);
  var shapeCache={};
  function shape(tp,T2,T1,b1,df){ /* エコー列の形（実効 TE のエコーで規格化） */
    if(nE===1) return null; var key=T1+'|'+T2+'|'+Math.round(b1*50)+'|'+Math.round(df/10); var v=shapeCache[key]; if(v) return v;
    var o={etl:etl,esp:esp,tr:B.tr,b1:b1,refoc:B.refoc||150,restore:!!B.restore,ti:B.ti||0,refs:B.refs||null,df:Math.round(df/10)*10};
    var r=EP.fse(T1,T2,o).echo, c=r[Math.min(ne,etl-1)]||1e-12, out=new Float64Array(nE);
    if(type==='fse'){ for(var e=0;e<nE;e++) out[e]=r[e]/c; }
    else { var first=Math.max(0,ne-Math.round(ny/2)); for(var g=0;g<nE;g++){ var a0=first+Math.floor(g*(etl-first)/nE), a1=first+Math.floor((g+1)*(etl-first)/nE); var s=0, n=0; for(var e2=a0;e2<Math.max(a1,a0+1)&&e2<etl;e2++){ s+=r[e2]; n++; } out[g]=(n?s/n:0)/c; } }
    shapeCache[key]=out; return out; }
  for(var r=0;r<S;r++) for(var c=0;c<S;c++){ var base=(r*S+c)*G.ns, pr=Math.floor(r/f), pc=Math.floor(c/f), P=pr*Nb+pc;
    for(var s=0;s<G.ns;s++) for(var kk=0;kk<G.K;kk++){ var o=(base+s)*G.K+kk, li=G.lab[o]; if(li<0) continue; if(li===0&&kk>0) continue;
      var tp=tps[li]; if(!tp||!tp.PD) continue; var x=G.xs[o], y=G.ys[o];
      var df=G.fld[o]*hzppm, g=G.grd[o]*hzppm*(st.shim?0.6:1); if(st.shim) df*=0.7;
      var b1=MS.b1At(st,ph,x,y);
      var sg=acq.sig(tp,df,b1); var w=sg.w||0, fz=sg.f||0; if(sg.wph&&Math.abs(Math.abs(sg.wph)-PI)<1e-6) w=-w; if(sg.fph&&Math.abs(Math.abs(sg.fph)-PI)<1e-6) fz=-fz;
      if(Math.abs(df)>excBW){ var q=excBW/Math.abs(df); w*=q*q; fz*=q*q; }
      if(fsMode==='chess'||fsMode==='spair'){ var sgm=Math.abs(fatHz)*0.42; var effF=fsMode==='chess'?(1-Math.abs(cos(PI/2*b1))):0.97; fz*=1-effF*E(-Math.pow(df/sgm,4)); w*=1-effF*E(-Math.pow((df-fatHz)/sgm,4)); }
      else if(fsMode==='we'){ var sg2=Math.abs(fatHz)*0.4; w*=E(-Math.pow(df/(sg2*1.3),4)); fz=fz*0.05+fz*0.95*E(-Math.pow((df+fatHz)/sg2,4)); }
      var amp=wsc, TX=texs[li]; if(TX){ var tf=1+(TX.f||0)*G.ta[o]+(TX.c||0)*G.tb[o]+(TX.d||0)*G.tc[o]; if(tf<0.2) tf=0.2; amp*=tf; if(TX.ffv&&fz){ var vv=TX.ffv*G.ta[o]; w*=Math.max(0,1-vv); fz*=1+vv; } }
      var comps=[[w,df,tp.T2,tp.T1,tp.T2s],[fz,df+fatHz,B.fT2?B.fT2(tp):tp.fT2,tp.fT1,tp.fT2s]];
      for(var ci=0;ci<2;ci++){ var a=comps[ci][0]*amp; if(!a) continue; var aw=Math.abs(a); var sh=shape(tp,comps[ci][2],comps[ci][3],b1,comps[ci][1]);
        var Ab=A[ci], off=P*nE; if(sh){ for(var e=0;e<nE;e++) Ab[off+e]+=a*sh[e]; } else Ab[off]+=a;
        DF[ci][P]+=aw*comps[ci][1]; WT[ci][P]+=aw; R2[ci][P]+=aw/Math.max(1,gre?comps[ci][4]:comps[ci][2]);
        var t2p=gre?0:Math.max(0,1/Math.max(1,comps[ci][4])-1/Math.max(1,comps[ci][2])); R2p[ci][P]+=aw*t2p; }
      GS[P]+=(Math.abs(w)+Math.abs(fz))*amp*g; } }
  for(var P2=0;P2<NP;P2++){ var wt=WT[0][P2]+WT[1][P2]; GS[P2]=wt>0?GS[P2]/wt:0; for(var c2=0;c2<2;c2++){ var ww=WT[c2][P2]; if(ww>0){ DF[c2][P2]/=ww; R2[c2][P2]/=ww; R2p[c2][P2]/=ww; } } }
  /* ky ラインごとのエコー番号（通常計算と同じ並べ方） */
  var lineE=new Int32Array(ny), pf=p.pf||1, kyStart=-ny/2+Math.round((1-pf)*ny);
  for(var j=0;j<ny;j++){ var li2=j; if(type==='fse'){ var grp=Math.max(1,Math.round(ny/etl)); var g0=Math.floor(li2/grp), gc=Math.floor((ny/2)/grp); lineE[j]=((g0-gc+ne)%etl+etl)%etl; }
    else if(type==='ss'){ lineE[j]=Math.max(0,Math.min(nE-1,Math.floor((j-(kyStart+ny/2))/Math.max(1,(ny-(kyStart+ny/2)))*nE))); } else lineE[j]=0; }
  /* 読出し：各 kx の時刻（エコー中心からの ms） */
  var dwell=1000/(bw*nx), TE=B.te||p.te||0, half=Nb/2, ofs=(f-1)/(2*f);
  var Rre=new Float64Array(Nb*nE*nx), Rim=new Float64Array(Nb*nE*nx); /* 行ごとの和 R[y][e][kx] */
  var zr=new Float64Array(nx), zi=new Float64Array(nx);
  for(var yb=0;yb<Nb;yb++) for(var xb=0;xb<Nb;xb++){ var P3=yb*Nb+xb; var xpos=(xb-half+ofs)/Nb;
    for(var c3=0;c3<2;c3++){ if(!WT[c3][P3]) continue; var dfc=DF[c3][P3], r2=R2[c3][P3], r2p=R2p[c3][P3], gsp=GS[P3]*dz; /* スライス内の磁場の広がり（Hz） */
      for(var kx=0;kx<nx;kx++){ var kxv=kx-nx/2, t=kxv*dwell; var tau=gre? TE+t : t;
        var env=E(-t*r2)*E(-Math.abs(t)*r2p)*Math.abs(sinc(PI*gsp*Math.abs(tau)/1000));
        var phs=-2*PI*(dfc*tau/1000 + kxv*xpos); zr[kx]=env*cos(phs); zi[kx]=env*sin(phs); }
      var Ab=A[c3], off=P3*nE, ro=yb*nE*nx;
      for(var e=0;e<nE;e++){ var a=Ab[off+e]; if(!a) continue; var ro2=ro+e*nx; for(var k2=0;k2<nx;k2++){ Rre[ro2+k2]+=a*zr[k2]; Rim[ro2+k2]+=a*zi[k2]; } } } }
  /* 位相方向の和 → k 空間（S 格子の中央に置く） */
  var KR=new Float64Array(S*S), KI=new Float64Array(S*S), sc=1;
  var filt=st.filter||'weak';
  for(var j2=0;j2<ny;j2++){ var kyv=j2-ny/2; if(kyv<kyStart) continue; var e3=lineE[j2];
    var cr=new Float64Array(Nb), ci_=new Float64Array(Nb); for(var y2=0;y2<Nb;y2++){ var ph_=-2*PI*kyv*(y2-half+ofs)/Nb; cr[y2]=cos(ph_); ci_[y2]=sin(ph_); }
    var wky=1; if(filt==='hamming') wky=0.54+0.46*cos(PI*kyv/(ny/2)); else if(filt!=='none'){ var u=Math.abs(kyv)/(ny/2); if(u>0.8) wky=0.5+0.5*cos(PI*(u-0.8)/0.2); }
    var row=(kyv+S/2)*S;
    for(var k3=0;k3<nx;k3++){ var kxv2=k3-nx/2; var sr=0, si=0; for(var y3=0;y3<Nb;y3++){ var q=(y3*nE+e3)*nx+k3; var a1=Rre[q], b1=Rim[q]; sr+=a1*cr[y3]-b1*ci_[y3]; si+=a1*ci_[y3]+b1*cr[y3]; }
      var wkx=1; if(filt==='hamming') wkx=0.54+0.46*cos(PI*kxv2/(nx/2)); else if(filt!=='none'){ var u2=Math.abs(kxv2)/(nx/2); if(u2>0.8) wkx=0.5+0.5*cos(PI*(u2-0.8)/0.2); }
      var q2=row+kxv2+S/2; KR[q2]=sr*sc*wky*wkx; KI[q2]=si*sc*wky*wkx; } }
  var kmag=null; if(ctx.wantK){ kmag=new Float32Array(S*S); for(var q4=0;q4<S*S;q4++) kmag[q4]=Math.log(1e-6+Math.hypot(KR[q4],KI[q4])); }
  /* chk と逆 FFT（通常計算と同じ流儀） */
  for(var yy=0;yy<S;yy++) for(var xx=0;xx<S;xx++) if((xx+yy)&1){ var o2=yy*S+xx; KR[o2]=-KR[o2]; KI[o2]=-KI[o2]; }
  MS.fft2(KR,KI,S,true);
  for(var y4=0;y4<S;y4++) for(var x4=0;x4<S;x4++) if((x4+y4)&1){ var o3=y4*S+x4; KR[o3]=-KR[o3]; KI[o3]=-KI[o3]; }
  var re=new Float32Array(S*S), im=new Float32Array(S*S); var pfc=pf<1? Math.min(2,1/pf) : 1; for(var q5=0;q5<S*S;q5++){ re[q5]=KR[q5]*pfc; im[q5]=KI[q5]*pfc; }
  info.bloch={ms:Date.now()-t0, N:Nb, nE:nE};
  return {re:re, im:im, kmag:kmag}; }
};
})();
