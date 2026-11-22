require('./load.js');
function mkE(st){ var sq=MS.SEQ[st.seq], ph=MS.PHANTOMS[st.phantom]; st.coil=ph.coil; st.coilG=ph.coilG; st.p.dim3=sq.dim==='3D';
  var i=MS.derive(st,sq); var r=MS.probe(st,{xk:'te',xs:[]}); var ref=MS.defaultState(st.phantom,st.seq); ref.B0=1.5; ref.coil=ph.coil; ref.coilG=ph.coilG; ref.p.dim3=st.p.dim3; var sr=MS.derive(ref,sq).snr0;
  var sig=function(k){ var j=r.keys.indexOf(k); return j<0?0:r.cur.v[j]; };
  return {st:st,p:i.p,info:i,T:i.T,sar:i.sar,snr:i.snr0/sr*100,wrap:0,readEPI:i.readEPI||0,csPix:Math.abs(3.4*42.577*st.B0/((i.p&&i.p.bw)||st.p.bw)),sig:sig,cnr:function(a,b){ return Math.abs(sig(a)-sig(b))*i.snr0; }}; }
function setup(M){ var st=MS.defaultState(M.ph,M.seq,null); st.B0=M.B0||1.5; st.les={}; if(M.les) Object.assign(st.les,M.les); if(M.popt) Object.assign(st.popt,M.popt); if(M.init){ if(M.init.p) Object.assign(st.p,M.init.p); if(M.init.st) Object.assign(st,M.init.st); } return st; }
function okAll(M,E){ return M.crit.map(c=>{ try{ return !!c.f(E).ok; }catch(e){ return 'ERR '+e; } }); }
var seed=1; function rnd(){ seed=(seed*16807)%2147483647; return seed/2147483647; }
MS.MISSIONS.forEach(function(M){ var st=setup(M), E0=mkE(JSON.parse(JSON.stringify(st))), o0=okAll(M,E0);
  var keys=Object.keys(st.p).filter(k=>MS.PDEF[k]&&MS.PDEF[k].max>MS.PDEF[k].min&&typeof st.p[k]==='number'); var stKeys=['fs','B0','resp','swap'];
  var found=null; for(var t=0;t<1500&&!found;t++){ var s=JSON.parse(JSON.stringify(st)); var nk=1+Math.floor(rnd()*3);
    for(var j=0;j<nk;j++){ var k=keys[Math.floor(rnd()*keys.length)], d=MS.PDEF[k]; var lo=Math.log(Math.max(d.min,1e-3)), hi=Math.log(d.max); var v=d.min>0&&d.max/d.min>20?Math.exp(lo+rnd()*(hi-lo)):d.min+rnd()*(d.max-d.min); s.p[k]=Math.round(v/d.step)*d.step; }
    if(rnd()<0.3){ var fsv=['none','fatsat','stir','water','dixon'][Math.floor(rnd()*5)]; s.fs=fsv; } if(rnd()<0.2) s.B0=rnd()<0.5?1.5:3; if(rnd()<0.15) s.swap=!s.swap; if(rnd()<0.15) s.resp=['none','bh','trig','radial'][Math.floor(rnd()*4)];
    var E; try{ E=mkE(s); }catch(e){ continue; } if(okAll(M,E).every(x=>x===true)) found=s; }
  console.log(M.id.padEnd(11), 'init', JSON.stringify(o0), found?'SOLVABLE':'no solution found in random search', found?JSON.stringify(Object.keys(found.p).filter(k=>found.p[k]!==st.p[k]).map(k=>k+'='+(+found.p[k]).toFixed(1)).concat(['fs','B0','swap','resp'].filter(k=>found[k]!==st[k]).map(k=>k+'='+found[k]))):''); });
var M=MS.MISSION_MAP.inopp, s=setup(M); s.p.te=2.3; s.p.te2=4.6; console.log('inopp direct', okAll(M,mkE(s)), mkE(setup(M)).p.te);
M=MS.MISSION_MAP.metal; s=setup(M); s.p.bw=500; s.vat=true; s.fs='stir'; console.log('metal direct', okAll(M,mkE(s)));
