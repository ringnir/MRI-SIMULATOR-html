/* 精密計算（EPG）の検証：同じ条件を、ボクセル内に等間隔の位相分散を持つ多数のスピン（isochromat）で
   Bloch 方程式を直接解いた結果と比べる。node tests/epg_validate.js */
global.window=global; global.MS=global.MS||{}; require('../src/epg.js'); const P=MS.EPG;
const N=720; const D=Math.PI/180;
function rot(m,a,ph){ const c=Math.cos(a),s=Math.sin(a),cp=Math.cos(ph),sp=Math.sin(ph); const x=m[0]*cp+m[1]*sp, y=-m[0]*sp+m[1]*cp, z=m[2]; const y2=y*c-z*s, z2=y*s+z*c; m[0]=x*cp-y2*sp; m[1]=x*sp+y2*cp; m[2]=z2; }
function prec(m,a){ const c=Math.cos(a),s=Math.sin(a),x=m[0]*c-m[1]*s,y=m[0]*s+m[1]*c; m[0]=x; m[1]=y; }
function rel(m,t,T1,T2){ const e1=Math.exp(-t/T1),e2=Math.exp(-t/T2); m[0]*=e2; m[1]*=e2; m[2]=m[2]*e1+1-e1; }
function avg(M){ let x=0,y=0; for(const m of M){x+=m[0];y+=m[1];} return Math.hypot(x,y)/M.length; }
const iso=(z)=>Array.from({length:N},()=>[0,0,z]);
function cpmgIso(T1,T2,esp,etl,ref,b1){ const M=iso(1); M.forEach(m=>rot(m,90*D*b1,0)); const o=[]; for(let e=0;e<etl;e++){ M.forEach((m,i)=>{ rel(m,esp/2,T1,T2); prec(m,2*Math.PI*i/N); rot(m,ref*D*b1,Math.PI/2); rel(m,esp/2,T1,T2); prec(m,2*Math.PI*i/N); }); o.push(avg(M)); } return o; }
function spgrIso(T1,T2,TR,a){ const M=iso(1); let ph=0,dph=0,sig=0; for(let n=0;n<1200;n++){ dph+=117*D; ph+=dph; M.forEach(m=>rot(m,a,ph)); sig=avg(M); M.forEach((m,i)=>{ rel(m,TR,T1,T2); prec(m,2*Math.PI*i/N); }); } return sig; }
function ssfpIso(T1,T2,TR,a){ const M=iso(1); let f=0,p=0; for(let n=0;n<1500;n++){ M.forEach(m=>rot(m,a,0)); f=avg(M); M.forEach((m,i)=>{ rel(m,TR,T1,T2); prec(m,2*Math.PI*i/N); }); p=avg(M); } return {fisp:f,psif:p}; }
const rows=[]; let maxErr=0;
function cmp(name,a,b){ const e=Math.abs(a-b); maxErr=Math.max(maxErr,e/Math.max(1e-3,Math.abs(b))); rows.push([name,a.toFixed(4),b.toFixed(4),(100*e/Math.max(1e-3,Math.abs(b))).toFixed(2)+'%']); }
for(const [ref,b1] of [[180,1],[150,1],[120,1],[150,0.8]]){ const T1=1000,T2=80; const ep=P.fseTrain(T1,T2,{etl:12,esp:10,tr:1e7,refoc:ref,b1}).echo, is=cpmgIso(T1,T2,10,12,ref,b1); for(const e of [0,1,5,11]) cmp(`CPMG ${ref}° B1=${b1} echo${e+1}`,ep[e],is[e]); }
for(const [T1,T2,a] of [[800,50,15],[1400,90,30],[4000,2000,15]]) cmp(`RF-spoiled GRE T1=${T1} T2=${T2} ${a}°`,P.spgr(T1,T2,10,a*D),spgrIso(T1,T2,10,a*D));
for(const [T1,T2,a] of [[800,80,30],[1200,1000,40]]){ const e=P.ssfp(T1,T2,10,a*D), s=ssfpIso(T1,T2,10,a*D); cmp(`FISP T1=${T1} T2=${T2} ${a}°`,e.fisp,s.fisp); cmp(`PSIF T1=${T1} T2=${T2} ${a}°`,e.psif,s.psif); }
console.log('条件\tEPG\tBloch（isochromat '+N+'）\t相対誤差'); rows.forEach(r=>console.log(r.join('\t'))); console.log('最大相対誤差 '+(maxErr*100).toFixed(2)+'%');
