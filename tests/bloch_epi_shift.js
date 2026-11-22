/* EPI の位相方向のずれの検証：磁場に一様なずれ（+0.5 ppm）を足したとき、画像全体が PE 方向に df × (esp/R) × FOV だけずれるか */
require('./load.js');
function base(){ const st=MS.defaultState('head','dwi'); st.B0=3; st.fast=true; st.fs='none'; return st; }
const r0=MS.run(base()), ph=r0.ph; const S=256;
function img(md,off){ const st=base(); st.offX=off; if(md==='bloch') st.bloch=true; MS._probe=true; const r=MS.run(st); MS._probe=false; return {d:r.outs[0].data,info:r.info,peV:r.geo.peV}; }
function shiftPE(a,b,peV){ /* 位相方向の 1 次元プロファイルの相互相関（0.1 画素刻み） */ const pa=new Float64Array(S), pb=new Float64Array(S);
  for(let r=0;r<S;r++) for(let c=0;c<S;c++){ const q=r*S+c; const k=r; /* 画像の行＝位相方向 */ pa[k]+=a[q]; pb[k]+=b[q]; }
  const cc=s=>{ let v=0; for(let k=20;k<S-20;k++) v+=pa[k]*pb[k+s]; return v; }; let bi=0, bv=-1e99; for(let s=-15;s<=15;s++){ const v=cc(s); if(v>bv){bv=v;bi=s;} }
  const ym=cc(bi-1), y0=cc(bi), yp=cc(bi+1); return bi+0.5*(ym-yp)/(ym-2*y0+yp); }
const res={};
for(const md of ['std','bloch']){ const a=img(md,0.001); for(let q=0;q<ph.field.length;q++) ph.field[q]+=0.5; const b=img(md,0.002); for(let q=0;q<ph.field.length;q++) ph.field[q]-=0.5;
  res[md]=shiftPE(a.d,b.d,a.peV); var p=a.info.p; var df=0.5*42.577*3*0.7, R=a.info.R; console.log(md,'measured shift (S-px)',res[md].toFixed(2),' expected exact df*esp/R*S =',(df*p.esp_epi/R/1000*S).toFixed(2),' pf=',p.pf); }
