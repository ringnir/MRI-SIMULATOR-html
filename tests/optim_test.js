require('./load.js'); var bad=0, n=0, t0=Date.now();
var seqs=Object.keys(MS.SEQ);
['head','abd'].forEach(function(ph){ if(!MS.PHANTOMS[ph]) return; seqs.forEach(function(sid){
  var st; try{ st=MS.defaultState(ph,sid); }catch(e){ return; } st.B0=st.B0||1.5;
  var keys=Object.keys(st.p);
  MS.OPT_GOALS.forEach(function(g){ n++; var r;
    try{ r=MS.optimize(st,g.id,{keys:['nx','ny','thk','npart','nex','r','rz','sms','cs','pf','pfz','bw'].concat(keys),A:'gm',B:'wm'}); }catch(e){ bad++; console.log('ERR',ph,sid,g.id,String(e).slice(0,120)); return; }
    if(r.ok && r.gain<0.999){ bad++; console.log('WORSE',ph,sid,g.id,r.gain); }
    if(sid==='fse_t2'&&ph==='head') console.log(g.id, r.ok?r.changes.map(c=>c.k+':'+c.from+'→'+c.to).join(' '):r.msg, r.ok?('T '+r.before.T.toFixed(0)+'→'+r.after.T.toFixed(0)+' SNR '+r.before.snr.toFixed(0)+'→'+r.after.snr.toFixed(0)+' SAR '+r.before.sar.toFixed(1)+'→'+r.after.sar.toFixed(1)+' vox '+r.before.vox.toFixed(2)+'→'+r.after.vox.toFixed(2)+' cnr '+(r.before.cnr||0).toFixed(1)+'→'+(r.after.cnr||0).toFixed(1)+' evals '+r.evals):'');
  }); }); });
console.log('runs',n,'bad',bad,'ms',Date.now()-t0);
