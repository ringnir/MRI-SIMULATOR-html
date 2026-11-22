// パルスシーケンス図：全シーケンスで例外が出ないこと。canvas パッケージがあれば代表例を PNG に書き出す
// usage: node tests/psd_test.js [id ...]   （PNG は tests/out/psd_<id>.png）
const MS=require('./load.js'); const fs=require('fs'), path=require('path');
let Canvas=null; for(const q of ['canvas']){ try{ Canvas=require(q); break; }catch(e){} }
function mockCanvas(w,h){ const calls={n:0}; const ctx=new Proxy({},{get:(t,k)=>{ if(k in t) return t[k]; if(k==='measureText') return s=>({width:String(s).length*6}); return function(){ calls.n++; }; },set:(t,k,v)=>{ t[k]=v; return true; }});
  return {width:w,height:h,clientWidth:w,style:{},getContext:()=>ctx,calls}; }
function mk(w,h){ if(Canvas){ const c=Canvas.createCanvas(w,h); c.clientWidth=w; return c; } return mockCanvas(w,h); }
function draw(ph,id,w){ const st=MS.defaultState(ph,id), sq=MS.SEQ[id]; const info=MS.derive(st,sq); const c=mk(w||640,260); const r=MS.drawPSD(c,sq,info.p,st,{dpr:Canvas?2:1}); return {c,r}; }
let bad=[], n=0;
for(const s of MS.SEQS){ for(const ph of ['head']){ try{ draw(ph,s.id); n++; }catch(e){ bad.push(ph+' '+s.id+' '+e.stack.split('\n').slice(0,3).join(' | ')); } } }
for(const id of ['fse_pd','vibe','dess']){ try{ draw('knee',id); n++; }catch(e){ bad.push('knee '+id+' '+e.message); } }
// 欠けたパラメータ・空の状態でも落ちないこと
for(const s of MS.SEQS){ try{ MS.drawPSD(mk(400,260),s,{},{},{}); n++; }catch(e){ bad.push('empty '+s.id+' '+e.message); } }
try{ MS.drawPSD(mk(300,260),{},null,null,null); n++; }catch(e){ bad.push('null '+e.message); }
// 状態のオプション（復帰パルス・脂肪抑制・Sat・MT・流れ補正・PI）
const opt=[['fse_t2',{restore:true,fs:'spair',satband:true}],['fse_pd',{fs:'chess',mt:true}],['gre_t1',{fs:'stir',flowcomp:true}],['dwi',{fs:'stir'}],['bssfp',{fs:'we'}],['metal',{vat:true}],['se_t1',{fs:'chess',pimode:'grappa'}]];
for(const [id,o] of opt){ try{ const st=Object.assign(MS.defaultState('head',id),o); if(o.pimode) st.p.r=2; const info=MS.derive(st,MS.SEQ[id]); MS.drawPSD(mk(640,260),MS.SEQ[id],info.p,st,{}); n++; }catch(e){ bad.push('opt '+id+' '+e.message); } }
console.log('canvas:',Canvas?'node-canvas':'mock','draws',n,'errors',bad.length); bad.slice(0,20).forEach(b=>console.log(' ',b));
if(Canvas){ const out=path.join(__dirname,'out'); fs.mkdirSync(out,{recursive:true});
  const ids=process.argv.slice(2).length?process.argv.slice(2):['se_t1','fse_t2','flair','gre_t1','inopp','bssfp','dess','mprage','dwi','bold','pc','ute','mrs','fse3d_t2','lge'];
  for(const id of ids){ const ph=/^(dess|vibe)$/.test(id)?'knee':'head'; const {c}=draw(ph,id,640); fs.writeFileSync(path.join(out,'psd_'+id+'.png'),c.toBuffer('image/png')); }
  console.log('png',ids.length,'→',out); }
process.exitCode=bad.length?1:0;
