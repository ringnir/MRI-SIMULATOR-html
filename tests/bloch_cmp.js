/* 通常計算と Bloch 準拠モードの並べ比べ：node tests/bloch_cmp.js NAME '[[phantom,seq,B0,{st上書き},出力番号],...]' → tests/out/NAME.pgm（各行：通常｜Bloch） */
require('./load.js'); const fs=require('fs'), path=require('path');
const name=process.argv[2]||'bloch_cmp', cases=JSON.parse(process.argv[3]||'[["head","dwi",3,{},0]]'); const rows=[];
function norm(d){ const a=Array.from(d).sort((x,y)=>x-y); const hi=a[Math.floor(a.length*0.995)]||1; return d.map(v=>Math.max(0,Math.min(255,v/hi*255))); }
for(const [ph,id,B0,opt,oi] of cases){ const imgs=[];
  for(const md of ['std','bloch']){ const st=MS.defaultState(ph,id); st.B0=B0||1.5; Object.assign(st,opt||{}); st.fast=true; if(md==='bloch') st.bloch=true; MS.resetNoise(1); const t=Date.now(); const r=MS.run(st); const o=r.outs[oi||0];
    console.log(ph,id,B0,md,(Date.now()-t)+'ms',o.name,JSON.stringify(r.info.bloch||'')); imgs.push(norm(o.data)); }
  rows.push(imgs); }
const S=256, W=S*2+4, H=S*rows.length+4*(rows.length-1); const buf=Buffer.alloc(W*H,40);
rows.forEach((imgs,ri)=>imgs.forEach((im,ci)=>{ const s=Math.sqrt(im.length); for(let y=0;y<S;y++) for(let x=0;x<S;x++){ buf[(ri*(S+4)+y)*W+ci*(S+4)+x]=im[Math.floor(y*s/S)*s+Math.floor(x*s/S)]; } }));
const f=path.join(__dirname,'out',name+'.pgm'); fs.writeFileSync(f,Buffer.concat([Buffer.from(`P5 ${W} ${H} 255\n`),buf])); console.log(f);
