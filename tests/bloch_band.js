/* bSSFP のバンディング：頭部ファントムの磁場に直線の勾配（±1.5 ppm）を足し、通常計算と Bloch 準拠モードを比べる → tests/out/bssfp_band.pgm */
require('./load.js'); const fs=require('fs'), path=require('path');
function base(){ const st=MS.defaultState('head','bssfp'); st.B0=3; st.fast=true; st.p.tr=12; st.p.te=6; st.p.fa=40; return st; }
const r0=MS.run(base()); const ph=r0.ph, fn=ph.fn; for(let j=0;j<fn;j++) for(let i=0;i<fn;i++) ph.field[j*fn+i]+=3.0*(i/fn-0.5)/0.7;
function norm(d){ const a=Array.from(d).sort((x,y)=>x-y); const hi=a[Math.floor(a.length*0.995)]||1; return d.map(v=>Math.max(0,Math.min(255,v/hi*255))); }
const imgs=[]; for(const md of ['std','bloch']){ const st=base(); st.offX=0.001; if(md==='bloch') st.bloch=true; MS.resetNoise(1); const r=MS.run(st); imgs.push(norm(r.outs[0].data)); console.log(md, JSON.stringify(r.info.bloch||'')); }
const S=256, W=S*2+4; const buf=Buffer.alloc(W*S,40); imgs.forEach((im,ci)=>{ for(let y=0;y<S;y++) for(let x=0;x<S;x++) buf[y*W+ci*(S+4)+x]=im[y*S+x]; });
const f=path.join(__dirname,'out','bssfp_band.pgm'); fs.writeFileSync(f,Buffer.concat([Buffer.from(`P5 ${W} ${S} 255\n`),buf])); console.log(f);
/* 帯を横切る縦の線（中央列）のプロファイル */
const col=128; let rows=[]; for(let y=40;y<216;y+=4) rows.push(y+':'+imgs.map(im=>String(Math.round(im[y*S+col])).padStart(3)).join('/')); console.log(rows.join('  '));
