/* 精密計算（EPG）と Bloch 準拠モードで、全ファントム×全シーケンス（1.5T）を計算し、エラー・NaN がないか確かめる */
require('./load.js');
const mode=process.argv[2]||'epg'; let runs=0, bad=0, t0=Date.now(), nb=0;
for(const ph of Object.keys(MS.PHANTOMS)) for(const sq of MS.SEQS){
  const st=MS.defaultState(ph,sq.id); st.fast=true; st[mode]=true;
  try{ const r=MS.run(st); runs++; if(r.info.bloch) nb++; for(const o of r.outs){ const d=o.data; if(!d) continue; for(let i=0;i<d.length;i+=97){ if(!isFinite(d[i])){ bad++; console.log('NaN',ph,sq.id,o.name); break; } } } }
  catch(e){ bad++; console.log('ERR',ph,sq.id,e.message); } }
console.log(mode,'runs',runs,'bad',bad, mode==='bloch'?'bloch-runs '+nb:'', ((Date.now()-t0)/1000).toFixed(0)+'s');
