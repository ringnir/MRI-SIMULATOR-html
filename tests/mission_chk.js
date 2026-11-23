require('./load.js');
function mkE(st){ var sq=MS.SEQ[st.seq], ph=MS.PHANTOMS[st.phantom]; st.coil=ph.coil; st.coilG=ph.coilG; st.p.dim3=sq.dim==='3D';
  var i=MS.derive(st,sq); var r=MS.probe(st,{xk:'te',xs:[]}); var ref=MS.defaultState(st.phantom,st.seq); ref.B0=1.5; ref.coil=ph.coil; ref.coilG=ph.coilG; ref.p.dim3=st.p.dim3; var sr=MS.derive(ref,sq).snr0;
  var sig=function(k){ var j=r.keys.indexOf(k); return j<0?0:r.cur.v[j]; };
  return {st:st,p:i.p,info:i,T:i.T,sar:i.sar,snr:i.snr0/sr*100,wrap:0,readEPI:i.readEPI||0,csPix:Math.abs(3.4*42.577*st.B0/((i.p&&i.p.bw)||st.p.bw)),sig:sig,cnr:function(a,b){ return Math.abs(sig(a)-sig(b))*i.snr0; },bg:function(){ return NaN; },quiz:true}; }
function setup(M){ var st=MS.defaultState(M.ph,M.seq,null); st.B0=M.B0||1.5; st.les={}; if(M.les) Object.assign(st.les,M.les); if(M.popt) Object.assign(st.popt,M.popt); if(M.init){ if(M.init.p) Object.assign(st.p,M.init.p); if(M.init.st) Object.assign(st,M.init.st); } return st; }
function okAll(M,E){ return M.crit.filter(function(c){ return !(M.ui&&/背景/.test(c.label)); }).map(c=>{ try{ return !!c.f(E).ok; }catch(e){ return 'ERR '+e; } }); }
var seed=1; function rnd(){ seed=(seed*16807)%2147483647; return seed/2147483647; }
var SOL={ s_t1w:{p:{tr:500,te:12}}, t2w:{p:{tr:4000,te:100}}, s_pd:{p:{tr:3000,te:15}}, flair:{p:{ti:2400}}, s_thin:{p:{thk:3,nex:3}}, s_half:{p:{nex:1}},
  stir:{p:{ti:230}}, alias:{p:{pfov:100}}, inopp:{p:{te:2.3,te2:4.6}}, chemshift:{p:{bw:450}}, b_fatsat:{st:{fs:'chess'}}, b_hem:{p:{te:25}},
  cnr_time:{p:{tr:400,te:12,nex:1,ny:192,thk:6}}, breathhold:{p:{r:3,pf:0.75,npart:48}}, metal:{p:{bw:500},st:{vat:true,fs:'stir'}}, epi:{p:{r:3,pf:0.75,ny:128}}, fast_t2:{p:{etl:16,nex:1}}, a_sar:{p:{refoc:120,etl:16,tr:4000}},
  x_mrcp:{p:{te:600,r:2,pf:0.75}}, x_flair3:{p:{refoc:120,etl:24,ti:2400}}, x_vibe:{p:{thk:2.5,r:2,pfz:0.75}}, x_dwi3:{p:{r:3,pf:0.75,ny:128}}, x_knee3:{p:{nx:448,ny:400,bw:450,nex:2,etl:16}}, x_mprage:{p:{ti:750}}, art_noise:{p:{thk:4,nx:256,ny:256,bw:200,nex:2}}, art_resp:{st:{resp:'trig'}}, art_gfac:{p:{r:2,pfz:0.75}}, art_combo:{p:{pfov:100},st:{resp:'bh'}} };
var OPTV={fs:['none','chess','spair','stir','water','dixon'],vat:[false,true],semac:[0,4,8,12]};
var bad=0;
MS.MISSIONS.forEach(function(M){ var st=setup(M), o0=okAll(M,mkE(JSON.parse(JSON.stringify(st))));
  var found=null, how='';
  if(SOL[M.id]){ var s=JSON.parse(JSON.stringify(st)); Object.assign(s.p,SOL[M.id].p||{}); Object.assign(s,SOL[M.id].st||{}); try{ if(okAll(M,mkE(s)).every(x=>x===true)){ found=s; how='known'; } }catch(e){} }
  var ks=(M.keys||[]).filter(k=>OPTV[k]||(MS.PDEF[k]&&typeof st.p[k]==='number'));
  for(var t=0;t<3000&&!found&&ks.length;t++){ var s=JSON.parse(JSON.stringify(st)); var nk=1+Math.floor(rnd()*ks.length);
    for(var j=0;j<nk;j++){ var k=ks[Math.floor(rnd()*ks.length)]; if(OPTV[k]){ s[k]=OPTV[k][Math.floor(rnd()*OPTV[k].length)]; continue; } var d=MS.PDEF[k]; var lo=Math.log(Math.max(d.min,1e-3)), hi=Math.log(d.max); var v=d.min>0&&d.max/d.min>20?Math.exp(lo+rnd()*(hi-lo)):d.min+rnd()*(d.max-d.min); s.p[k]=Math.round(v/d.step)*d.step; }
    var E; try{ E=mkE(s); }catch(e){ continue; } if(okAll(M,E).every(x=>x===true)){ found=s; how='search'; } }
  var initSolved=o0.every(x=>x===true)&&M.id!=='alias'&&!M.ui; /* 画像で判定する課題は tests/ui_missions.py で確かめる */ /* 折り返しは画像で判定するので Node では見ない */ if(!found||initSolved) bad++;
  console.log(M.lv.padEnd(6), M.id.padEnd(11), 'init', JSON.stringify(o0), found?'SOLVABLE ('+how+')':'NO SOLUTION', initSolved?'ALREADY SOLVED AT START':''); });
console.log('missions', MS.MISSIONS.length, bad?'bad '+bad:'ok');
var M=MS.MISSION_MAP.inopp, s=setup(M); s.p.te=2.3; s.p.te2=4.6; console.log('inopp direct', okAll(M,mkE(s)), mkE(setup(M)).p.te);
M=MS.MISSION_MAP.metal; s=setup(M); s.p.bw=500; s.vat=true; s.fs='stir'; console.log('metal direct', okAll(M,mkE(s)));

// ヒントで示すパラメータが、その課題のシーケンスの画面に出ること
var OPT={fs:1,vat:1,semac:1,resp:1,satband:1}, badK=0;
MS.MISSIONS.forEach(function(M){ var sq=MS.SEQ[M.seq], st=setup(M); (M.keys||[]).forEach(function(k){
  var ok= OPT[k] ? (k==='resp'||k==='satband'||(sq.o||[]).indexOf(k)>=0 || (k==='fs'&&/dwi/.test(sq.k))) : (st.p[k]!==undefined && MS.PDEF[k]);
  if(!ok){ badK++; console.log('KEY NOT IN UI', M.id, k); } }); });
console.log('mission keys', badK? 'bad '+badK : 'ok');
