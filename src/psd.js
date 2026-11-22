/* ===== パルスシーケンス図（模式図・パラメータに忠実な時間軸） =====
 MS.drawPSD(canvas, sq, p, st, opts)
   sq = MS.SEQ[id]、p = MS.derive(st,sq).p（補正後の値）、st = 状態
   opts = {colors:{bg,text,grid,rf,gss,gpe,gro,adc,sig,accent}, dpr, width, height}
 行：RF・スライス・位相・読出し・ADC・信号。時間は ms。t=0 は励起パルスの中心。
 長い待ち時間・長いエコートレインは「//」で省略する（省略しない区間は同じ縮尺）。
 表示用の日本語は下の L の文字列だけ（翻訳の仕組みが文字列単位で置き換えるため、連結しない）。 */
(function(){
var MS=window.MS; if(!MS) return;
var L={rf:'RF',ss:'スライス',pe:'位相',ro:'読出し',adc:'ADC',sig:'信号',echo:'エコー',inv:'反転',fs:'脂肪抑制',diff:'拡散',venc:'流速エンコード',rep:'繰り返し',note:'（時間軸は省略を含む模式図）'};
var DEFC={bg:'#ffffff',text:'#222222',grid:'#c8c8c8',rf:'#c0392b',gss:'#1f77b4',gpe:'#2ca02c',gro:'#8e44ad',adc:'#555555',sig:'#555555',accent:'#e67e22'};
var ROWS=['rf','ss','pe','ro','adc','sig'], RH={rf:1.3,ss:1,pe:1,ro:1,adc:0.6,sig:1.1};
function num(v,d){ v=+v; return isFinite(v)?v:d; }
function cl(v,a,b){ return v<a?a:(v>b?b:v); }
function f(v){ v=+v; if(!isFinite(v)) return '?'; var a=Math.abs(v); return String(a>=100?Math.round(v):a>=10?Math.round(v*10)/10:Math.round(v*100)/100); }
function pfTxt(pf){ for(var d=8;d<=16;d*=2){ var n=pf*d; if(Math.abs(n-Math.round(n))<0.02) return Math.round(n)+'/'+d; } return f(pf); }

/* ---------- 組み立て（時刻で操作を記録） ---------- */
function Bld(){ this.ops=[]; this.ev=[]; this.dead=[]; this.skip=[]; this.dims=[]; this.notes=[]; this.ab=false; }
var P=Bld.prototype;
P.add=function(o,t0,t1){ this.ops.push(o); this.ev.push([t0,t1]); return o; };
P.rf=function(t,dur,deg,o){ o=o||{}; return this.add({k:'rf',t:t,d:dur,deg:deg,sh:o.sh||'sinc',lab:o.lab,hl:o.hl,c:o.c},t-dur/2,t+dur/2); };
P.gr=function(row,t0,dur,amp,o){ o=o||{}; if(!(dur>0)) return; return this.add({k:'gr',row:row,t0:t0,d:dur,a:cl(amp,-1,1),rp:o.rp,c:o.c,dash:o.dash},t0,t0+dur); };
P.tab=function(row,t0,dur,amp){ if(!(dur>0)) return; return this.add({k:'tab',row:row,t0:t0,d:dur,a:amp||0.7},t0,t0+dur); };
P.adc=function(t0,dur){ if(!(dur>0)) return; return this.add({k:'adc',t0:t0,d:dur},t0,t0+dur); };
P.echo=function(tc,w,amp,o){ o=o||{}; return this.add({k:'echo',tc:tc,w:w,a:amp,hl:o.hl,lab:o.lab,half:o.half},tc-2.5*w,tc+(o.tail||2.5*w)); };
P.fid=function(t0,dur,amp){ if(dur>0) return this.add({k:'fid',t0:t0,d:dur,a:amp},t0,t0+dur); };
P.band=function(row,t0,t1,o){ o=o||{}; return this.add({k:'band',row:row,t0:t0,t1:t1,lab:o.lab,n:o.n,deg:o.deg,min:o.min||0,c:o.c},t0,t1); };
P.epi=function(t0,dur,n,tc,o){ return this.add({k:'epi',t0:t0,d:dur,n:Math.max(1,Math.round(n)),tc:tc,gre:o&&o.gre},t0,t0+dur); };
P.txt=function(row,t,s,o){ this.ops.push({k:'txt',row:row,t:t,s:s,c:o&&o.c}); };
P.mark=function(t,s,c){ this.add({k:'mark',t:t,s:s,c:c},t,t); };
P.dim=function(t0,t1,s){ this.dims.push({t0:Math.min(t0,t1),t1:Math.max(t0,t1),s:s}); };
P.gap=function(t0,t1){ if(t1-t0>0) this.dead.push([t0,t1]); };
P.cut=function(t0,t1){ if(t1-t0>0){ this.skip.push([t0,t1]); this.ab=true; } };
P.note=function(s){ if(s) this.notes.push(s); };

/* ---------- 部品 ---------- */
function sel(B,t,dur,amp,rp){ B.gr('ss',t-dur/2-rp,dur+2*rp,amp,{rp:rp}); }
/* 再収束パルス：RF＋スライス選択＋両側のクラッシャー */
function refoc(B,t,dur,deg,cr,rp,o){ o=o||{}; B.rf(t,dur,deg,{lab:o.lab,sh:o.d3?'rect':'sinc'});
  B.gr('ss',t-dur/2-cr-rp,cr,0.85,{rp:rp*0.5}); B.gr('ss',t+dur/2+rp,cr,0.85,{rp:rp*0.5}); if(!o.d3) B.gr('ss',t-dur/2-rp*0.5,dur+rp,0.45,{rp:rp*0.5}); }
/* 反転パルス（断熱）＋スポイラー */
function inv(B,t,dur,lab){ B.rf(t,dur,180,{sh:'sech',lab:lab||L.inv}); B.gr('ss',t-dur/2,dur,0.3,{rp:dur*0.1}); B.gr('ss',t+dur/2+dur*0.05,dur*0.45,0.9,{rp:dur*0.08}); }
/* 前置パルス（脂肪抑制・Sat・MT）を励起の前に置く。戻り値＝最も早い時刻 */
function preps(B,st,sq,t0,o){ o=o||{}; var t=t0, fs=o.noFs?'none':(st.fs||'none'), sc=o.sc||1;
  function one(lab,sh,dur,deg){ dur*=sc; var sp=dur*0.45; t-=sp+dur*0.1; B.gr('ss',t,sp,0.9,{rp:sp*0.15}); B.gr('ro',t,sp,0.6,{rp:sp*0.15}); t-=dur/2+dur*0.05; B.rf(t,dur,deg,{sh:sh,lab:lab}); t-=dur/2; }
  if(fs==='chess') one(L.fs,'gauss',8,90);
  if(st.satband||(sq.k==='tof'&&st.vsat)) one('Sat','sinc',5,90);
  if(st.mt) one('MT','gauss',8,60);
  if(fs==='spair'||fs==='stir'){ var ti=fs==='stir'?((st.B0||1.5)>=3?220:160):((st.B0||1.5)>=3?110:90); var tc=Math.min(t-6*sc,t0-ti);
    if(fs==='stir') B.gap(tc+6,t); else B.cut(tc+6*sc,t); if(fs==='stir'){ inv(B,tc,8); B.dim(tc,0,'TI '+f(ti)); } else { B.rf(tc,8*sc,110,{sh:'sech',lab:L.fs}); B.gr('ss',tc+4.5*sc,4*sc,0.9,{rp:0.6*sc}); } t=tc-4*sc; }
  if(fs==='we') B.note('WE 1-2-1');
  if(fs==='dixon') B.note('Dixon');
  return t; }
/* 0 からの最初のエコーまでに入れる位置合わせ：[w0,w1] の中で幅 frac の区間 */
function win(w0,w1,frac){ var d=Math.max(0.05,(w1-w0)*(frac||0.8)); return [w0+(w1-w0-d)/2,d]; }

/* ---------- スピンエコー系 ---------- */
function kSE(B,p,o){ var tes=o.tes, tro=o.tro, te1=tes[0];
  var rfE=Math.min(2.5,te1*0.16), rfR=Math.min(3,te1*0.18), cr=Math.min(1.2,te1*0.06), rp=Math.min(0.3,te1*0.02);
  B.rf(0,rfE,90,{lab:'90°',sh:o.we?'binom':'sinc'}); sel(B,0,rfE,0.45,rp);
  var prev=0, lastEnd=0;
  for(var i=0;i<tes.length;i++){ var te=tes[i], tp=(prev+te)/2, half=(te-prev)/2;
    var ro=Math.min(tro, 2*(half-rfR/2-cr-2*rp)*0.95); ro=Math.max(ro,half*0.3);
    if(i===0){ var w=win(rfE/2+rp,tp-rfR/2-cr-rp,0.75); B.gr('ss',w[0],w[1]*0.6,-0.45,{rp:rp}); B.tab('pe',w[0],w[1],0.75); B.gr('ro',w[0],w[1],cl(0.45*ro/2/w[1],0.2,1),{rp:rp}); B.fid(rfE/2,Math.min(half*0.6,8),0.6); }
    refoc(B,tp,rfR,180,cr,rp,{lab:'180°'});
    B.gr('ro',te-ro/2-rp,ro+2*rp,0.45,{rp:rp}); B.adc(te-ro/2,ro); B.echo(te,ro/6,0.85*Math.exp(-te/120),{hl:true,lab:i===0});
    if(i>0) B.dim(0,te,'TE2 '+f(te)); prev=te; lastEnd=te+ro/2+rp; }
  B.dim(0,te1,'TE '+f(te1)); next(B,o.tr,lastEnd,rfE,90,o.single); }
function next(B,tr,end,rfE,deg,single,d3){ if(single||!(tr>end)) return; B.gap(end+0.5,tr-rfE/2-0.5); B.rf(tr,rfE,deg,{lab:L.rep,sh:d3?'rect':'sinc'}); if(!d3) sel(B,tr,rfE,0.45,Math.min(0.3,rfE*0.12)); B.dim(0,tr,'TR '+f(tr)); }
/* 高速スピンエコー（2D/3D、シングルショット、マルチエコー） */
function kFSE(B,p,o){ var esp=o.esp, etl=Math.max(1,Math.round(o.etl)), c=cl(Math.round(o.te/esp),1,etl), d3=o.d3, me=o.me;
  var rfE=Math.min(2.4,esp*0.22), rfR=Math.min(2.8,esp*0.22), cr=Math.min(1,esp*0.08), rp=Math.min(0.3,esp*0.03);
  var ro=Math.max(esp*0.25,Math.min(o.tro,esp*0.42));
  B.rf(0,rfE,90,{lab:'90°',sh:d3?'rect':(o.we?'binom':'sinc')}); if(!d3){ sel(B,0,rfE,0.45,rp); }
  var w=win(rfE/2+rp,esp/2-rfR/2-cr-rp,0.8); if(!d3) B.gr('ss',w[0],w[1]*0.55,-0.45,{rp:rp}); B.gr('ro',w[0],w[1],cl(0.45*ro/2/w[1],0.2,1),{rp:rp});
  if(me) B.tab('pe',w[0],w[1],0.75);
  var show=[], i; if(etl<=10){ for(i=1;i<=etl;i++) show.push(i); } else { [1,2,3,c-1,c,c+1,etl].forEach(function(k){ if(k>=1&&k<=etl&&show.indexOf(k)<0) show.push(k); }); show.sort(function(a,b){return a-b;}); }
  var a0=rfR/2+cr+rp;
  for(i=0;i<show.length;i++){ var k=show[i], tp=(k-0.5)*esp, te=k*esp;
    var deg=d3? (k===1?o.refoc:Math.round(o.refoc*(0.4+0.6*Math.pow(k/etl,1.5)))) : o.refoc;
    refoc(B,tp,rfR,deg,cr,rp,{d3:d3,lab:k===1?(f(o.refoc)+'°'+(d3?' VFA':'')):null});
    var pw=win(tp+rfR/2+rp,te-ro/2-rp,0.8), rw=win(te+ro/2+rp,(k+0.5)*esp-rfR/2-rp,0.8);
    if(!me){ B.tab('pe',pw[0],pw[1],0.75*(etl>1?Math.max(0.25,Math.abs(k-c)/Math.max(1,c-1,etl-c)):1)); B.tab('pe',rw[0],rw[1],0.75*(etl>1?Math.max(0.25,Math.abs(k-c)/Math.max(1,c-1,etl-c)):1)); }
    if(d3){ B.tab('ss',pw[0],pw[1],0.6); B.tab('ss',rw[0],rw[1],0.6); }
    if(o.vat) B.gr('ss',te-ro/2-rp,ro+2*rp,0.3,{rp:rp,dash:true});
    B.gr('ro',te-ro/2-rp,ro+2*rp,0.45,{rp:rp}); B.adc(te-ro/2,ro);
    B.echo(te,ro/6,Math.max(0.15,0.9*Math.exp(-te/(d3?300:110))),{hl:me||k===c,lab:k===c});
    if(i+1<show.length && show[i+1]>k+1) B.cut((k+0.5)*esp-a0+0.05,(show[i+1]-0.5)*esp-a0-0.05); }
  if(me&&etl>1) B.tab('pe',(etl+0.5)*esp-a0,esp*0.15,0.75);
  if(o.vat) B.txt('ss',c*esp,'VAT');
  var end=(etl+0.5)*esp-a0+esp*0.2;
  if(o.restore){ refoc(B,(etl+0.5)*esp,rfR,o.refoc,cr,rp,{d3:d3}); B.rf((etl+1)*esp,rfE,-90,{lab:'-90°',sh:d3?'rect':'sinc'}); if(!d3) sel(B,(etl+1)*esp,rfE,0.45,rp); end=(etl+1)*esp+rfE; }
  if(!me) B.dim(0,c*esp,'TE '+f(o.te)); if(etl>1) B.dim(esp,2*esp,'ESP '+f(esp));
  if(me) B.dim(0,esp,'TE1 '+f(esp));
  B.note('ETL '+etl); if(!o.noNext) next(B,o.tr,end,rfE,90,o.single,d3); if(o.single) B.note('TR '+f(o.tr)); return end; }

/* ---------- グラディエントエコー系 ---------- */
/* o: tes[], tr, fa, mode('spoil'|'bal'|'fisp'|'psif'|'dess'), d3, fc, venc, meg, T0（開始時刻）, neg（−α）, nolab */
function kGRE(B,p,o){ var T0=o.T0||0, tes=o.tes, tr=o.tr, te=tes[0], tro=o.tro, mode=o.mode||'spoil', d3=o.d3, sgn=o.neg?-1:1;
  if(mode==='psif') te=Math.max(te,tr*0.55);
  var ro=Math.min(tro,(mode==='bal'?tr*0.5:tr*0.6)); if(tes.length>1) ro=Math.min(ro,(tes[1]-tes[0])*0.85);
  if(mode==='dess') ro=Math.min(ro,tr*0.3,(tr-2*te)*0.8+ro);
  var a=te-ro/2; if(mode!=='psif'&&a<0.3*te){ ro=Math.min(ro,2*te*0.7); a=te-ro/2; }
  var rf=Math.min(d3?0.8:2,a*0.55,tr*0.15), rp=Math.min(0.25,a*0.06,tr*0.02);
  var lab=o.nolab?null:((o.neg?'-':(mode==='bal'?'+':''))+(mode==='bal'?'α ':'α ')+f(o.fa)+'°');
  B.rf(T0,rf,sgn*o.fa,{lab:lab,sh:o.we?'binom':(o.ute?'rect':'sinc')}); sel(B,T0,rf,d3?0.3:0.45,rp);
  var w0=T0+rf/2+rp, w1=T0+(mode==='psif'?Math.min(a,tr*0.3):a)-rp, w=[w0,Math.max(0.05,w1-w0)];
  var roA=0.45, preA=cl(roA*ro/2/(w[1]*0.85),0.2,1);
  if(o.meg){ var per=1000/o.meg, n=Math.max(1,Math.floor(w[1]/per)), hp=Math.min(per/2,w[1]/(2*n)); for(var m=0;m<2*n;m++) B.gr('ss',w0+m*hp,hp*0.95,m%2?-0.8:0.8,{rp:hp*0.2,c:'accent'}); B.txt('ss',w0+n*hp,'MEG '+f(o.meg)+' Hz',{c:'accent'}); }
  else if(o.venc){ var h=w[1]/2; B.gr('ss',w0,h*0.95,0.8,{rp:h*0.2,c:'accent'}); B.gr('ss',w0+h,h*0.95,-0.8,{rp:h*0.2,c:'accent'}); B.gr('ss',w0,h*0.95,-0.8,{rp:h*0.2,dash:true}); B.gr('ss',w0+h,h*0.95,0.8,{rp:h*0.2,dash:true}); B.txt('ss',w0+h,L.venc,{c:'accent'}); B.txt('pe',w0+h,'VENC '+f(o.venc)); }
  else if(d3) B.tab('ss',w0,w[1]*0.85,0.6); else B.gr('ss',w0,w[1]*0.5,-0.45,{rp:rp});
  B.tab('pe',w0,w[1]*0.85,0.75);
  if(mode==='psif'){ B.gr('ro',w0,w[1]*0.85,0.7,{rp:rp}); }
  else if(o.fc){ B.gr('ro',w0,w[1]*0.4,cl(preA*0.9,0.2,1),{rp:rp}); B.gr('ro',w0+w[1]*0.45,w[1]*0.5,-cl(preA*1.6,0.2,1),{rp:rp}); B.txt('ro',w0+w[1]*0.45,'FC'); }
  else if(!o.ute) B.gr('ro',w0,w[1]*0.85,-preA,{rp:rp});
  if(!o.meg&&!o.venc&&mode!=='psif') B.fid(T0+rf/2,Math.min(a*0.8,6),0.55);
  var last=0, i, T2s=o.t2s||45;
  for(i=0;i<tes.length;i++){ var t=T0+(i===0?te:tes[i]), pol=(tes.length>1&&o.bip!==false)?(i%2?-1:1):1;
    if(o.ute){ B.gr('ro',t,ro,0.5,{rp:ro*0.35}); B.gr('pe',t,ro,0.3,{rp:ro*0.35,dash:true}); B.adc(t,ro); B.echo(t,ro/5,0.9*Math.exp(-tes[i]/2),{hl:i===0,lab:i===0,half:true,tail:ro}); last=t+ro; if(i+1<tes.length) B.gr('ro',t+ro+0.05,Math.min(ro*0.6,(tes[i+1]-tes[i]-ro)*0.8),-0.6,{rp:0.1}); continue; }
    B.gr('ro',t-ro/2-rp,ro+2*rp,pol*roA,{rp:rp}); B.adc(t-ro/2,ro);
    B.echo(t,ro/6,0.85*Math.exp(-tes[i]/T2s),{hl:i===0||tes.length>1,lab:i===0&&!o.nolab}); last=t+ro/2+rp;
    if(mode==='dess'&&i===0){ var t2=T0+tr-te, g0=last+0.1, g1=t2-ro/2-rp-0.1; B.gr('ss',g0,(g1-g0)*0.9,0.9,{rp:rp}); B.gr('ro',t2-ro/2-rp,ro+2*rp,roA,{rp:rp}); B.adc(t2-ro/2,ro); B.echo(t2,ro/6,0.5,{hl:true}); B.txt('sig',t-ro*0.3,'S+'); B.txt('sig',t2-ro*0.3,'S-'); B.dim(T0,t2,'TE2 '+f(tr-te)); last=t2+ro/2+rp; } }
  var R0=last+0.05, R1=T0+tr-Math.min(rf,0.8)/2-rp-0.05, R=Math.max(0.05,R1-R0); if(mode==='spoil') R=Math.min(R,Math.max(1.5,ro*0.9)); else R=Math.min(R,Math.max(w[1],ro*0.5)/0.85);
  if(mode==='bal'){ if(d3) B.tab('ss',R0,R*0.85,0.6); else B.gr('ss',R0+R*0.5,R*0.45,-0.45,{rp:rp}); B.tab('pe',R0,R*0.85,0.75); B.gr('ro',R0,R*0.85,-preA,{rp:rp}); }
  else if(mode==='fisp'){ if(d3) B.tab('ss',R0,R*0.85,0.6); B.tab('pe',R0,R*0.85,0.75); B.note('S+ (FISP)'); }
  else if(mode==='psif'){ B.tab('pe',R0,R*0.8,0.75); B.note('S- (PSIF)'); }
  else if(mode==='dess'){ B.tab('pe',R0,R*0.8,0.75); }
  else if(R>0.1){ B.tab('pe',R0,R*0.45,0.75); if(d3) B.tab('ss',R0,R*0.45,0.6); B.gr('ss',R0+R*0.5,R*0.45,0.9,{rp:rp}); B.gr('ro',R0,R*0.6,0.55,{rp:rp}); }
  return {rf:rf,end:mode==='spoil'?R0+R:last};
}
function greDims(B,o,k){ var tes=o.tes; B.dim(0,tes[0],(tes.length>1?'TE1 ':'TE ')+f(tes[0]));
  if(tes.length===2) B.dim(0,tes[1],'TE2 '+f(tes[1])); else if(tes.length>2) B.dim(tes[0],tes[1],'ΔTE '+f(tes[1]-tes[0]));
  if(tes.length>2) B.note('ne '+tes.length); }

/* ---------- EPI（拡散・BOLD・DSC） ---------- */
function kEPI(B,p,o){ var te=o.te, espE=o.espE, lines=o.lines, pre=cl(o.pre,1,lines), rdur=lines*espE, rs=te-pre*espE, rp=Math.min(0.3,espE*0.2);
  var pp=Math.min(1.5,Math.max(0.4,rs*0.06)), b=o.b;
  if(o.se){ var rfE=Math.min(3,te*0.05), rfR=Math.min(4,te*0.06), cr=Math.min(1.2,te*0.02), tp=te/2;
    B.rf(0,rfE,90,{lab:'90°',sh:o.we?'binom':'sinc'}); sel(B,0,rfE,0.45,rp); B.gr('ss',rfE/2+rp,Math.min(1.5,rfE*0.5),-0.45,{rp:rp});
    refoc(B,tp,rfR,180,cr,rp,{lab:'180°'});
    if(b>0){ var g=rfR/2+cr+rp+0.4, dmax=Math.min(tp-g-rfE/2-2.5, rs-pp-0.6-tp-g), del=cl(o.del||10,0.5,Math.max(0.5,dmax)), r=Math.min(1,del*0.12);
      ['ss','pe','ro'].forEach(function(row){ B.gr(row,tp-g-del,del,0.6,{rp:r,c:'accent'}); B.gr(row,tp+g,del,0.6,{rp:r,c:'accent'}); });
      B.txt('ss',tp-g-del/2,L.diff,{c:'accent'}); B.txt('pe',tp-g-del/2,'b '+o.bs,{c:'accent'});
      B.dim(tp-g-del,tp-g,'δ '+f(del)); B.dim(tp-g-del,tp+g,'Δ '+f(2*g+del)); }
  } else { var rf=Math.min(2.5,rs*0.3); B.rf(0,rf,o.fa,{lab:'α '+f(o.fa)+'°'}); sel(B,0,rf,0.45,rp); B.gr('ss',rf/2+rp,rf*0.5,-0.45,{rp:rp}); }
  B.gr('ro',rs-pp-0.2,pp,-0.7,{rp:rp}); B.gr('pe',rs-pp-0.2,pp,-0.6,{rp:rp});
  B.epi(rs,rdur,lines,te);
  B.dim(0,te,'TE '+f(te)); B.note('ETL '+lines); B.note('ESP '+f(espE)); if(o.seg>1) B.note('seg '+o.seg); B.note('TR '+f(o.tr));
}

/* ---------- 準備パルス＋GREブロック（MPRAGE・ASL・心電図同期など、巨視的な図） ---------- */
function block(B,t0,t1,fa,n,lab,o){ o=o||{}; B.band('rf',t0,t1,{n:n,deg:fa,lab:lab,min:o.min}); B.band('ss',t0,t1,{min:o.min,lab:o.ssl}); B.band('pe',t0,t1,{min:o.min}); B.band('ro',t0,t1,{min:o.min,n:n}); B.band('adc',t0,t1,{min:o.min,n:n}); B.band('sig',t0,t1,{min:o.min,n:n}); }

/* ---------- 各シーケンスの組み立て ---------- */
function build(sq,p,st){ var B=new Bld(), k=sq.k||'', d3=sq.dim==='3D', tro=1000/num(p.bw,250), tr=num(p.tr,500), te=num(p.te,10), fa=num(p.fa,90);
  var we=st.fs==='we', RR=60000/num(st.hr,70);
  var noFs=/^(ir|mprage|mp2rage|asl|lge|map_t1|cine|mrs)$/.test(k);
  function pre(t0){ return preps(B,st,sq,t0,{noFs:noFs,sc:sq.gre&&!sq.epi&&tr<20?Math.max(0.25,tr/20):1}); }
  /* 反転つき：次の TR の反転パルス（最も早い反転から TR 後）まで */
  function reInv(end,tis,di){ var t1=Math.max.apply(null,tis), tn=Math.max(tr-t1,end+di+2); B.gap(end+0.5,tn-di); tis.forEach(function(x){ if(x===t1) inv(B,tn,di); }); B.dim(-t1,tn,'TR '+f(tr)); }
  var fse={tr:tr,te:te,etl:num(p.etl,8),esp:num(p.esp,10),refoc:num(p.refoc,150),tro:tro,d3:d3,restore:!!st.restore,we:we,vat:!!st.vat&&(k==='fse')};
  var R=(st.pimode&&st.pimode!=='off')?Math.max(1,num(p.r,1)):1, ny=num(p.ny,256), pf=num(p.pf,1);
  if(k==='se'||k==='se_dual'){ var tes=[te]; if(k==='se_dual') tes.push(Math.max(num(p.te2se,90),te+10)); pre(-Math.min(2.5,te*0.16)/2-0.3); kSE(B,p,{tes:tes,tro:tro,tr:tr,we:we}); }
  else if(k==='fse'||k==='dixon_tse'||k==='map_t2'){ pre(-1.5); fse.me=k==='map_t2'; kFSE(B,p,fse); if(k==='dixon_tse') B.note('Dixon '+num(p.dixpts,2)+'pt'); }
  else if(k==='ssfse'||k==='mrcp2d'){ pre(-1.5); fse.etl=Math.max(2,Math.round(ny*pf/R)); fse.single=true; kFSE(B,p,fse); }
  else if(k==='ir'){ var ti=num(p.ti,500), di=Math.min(8,ti*0.3); inv(B,-ti,di); B.gap(-ti+di,-2); B.dim(-ti,0,'TI '+f(ti)); fse.noNext=true; reInv(kFSE(B,p,fse),[ti],di); }
  else if(k==='fse3d'||k==='mrcp'||k==='ncmra_fbi'){ var t0=pre(-1.5);
    if(sq.dir&&p.ti2){ inv(B,-num(p.ti,3000),8); inv(B,-num(p.ti2,450),8); B.gap(-num(p.ti,3000)+8,-num(p.ti2,450)-6); B.gap(-num(p.ti2,450)+8,Math.min(t0,-2)); B.dim(-num(p.ti2,450),0,'TI2 '+f(p.ti2)); B.dim(-num(p.ti,3000),0,'TI1 '+f(p.ti)); }
    else if(p.ti){ inv(B,-num(p.ti,1800),8); B.gap(-num(p.ti,1800)+8,Math.min(t0,-2)); B.dim(-num(p.ti,1800),0,'TI '+f(p.ti)); }
    if(k==='ncmra_fbi'){ B.mark(Math.min(t0,-2)-150,'R'); B.gap(Math.min(t0,-2)-148,Math.min(t0,-2)); B.note('ECG'); B.note('spoil '+num(p.spoil,30)); }
    if(p.ti){ fse.noNext=true; reInv(kFSE(B,p,fse),sq.dir&&p.ti2?[num(p.ti,3000),num(p.ti2,450)]:[num(p.ti,1800)],8); } else kFSE(B,p,fse); }
  else if(k==='mprage'||k==='mp2rage'){ var trs=num(p.trs,2300), esp=num(p.esp,7), Rz=(st.pimode&&st.pimode!=='off')?Math.max(1,num(p.rz,1)):1, n=Math.max(2,Math.round(num(p.npart,176)/Rz)), c=Math.floor(n/2);
    var TI1=num(p.ti,1000), b0=Math.max(12,TI1-c*esp); inv(B,0,10); block(B,b0,b0+n*esp,fa,n,'α '+f(fa)+'° ×'+n);
    B.dim(0,TI1,(k==='mp2rage'?'TI1 ':'TI ')+f(TI1)); var e1=b0+n*esp;
    if(k==='mp2rage'){ var TI2=Math.max(num(p.ti2,2500),e1+c*esp+5), b1=TI2-c*esp; block(B,b1,b1+n*esp,num(p.fa2,5),n,'α '+f(num(p.fa2,5))+'°'); B.dim(0,TI2,'TI2 '+f(TI2)); e1=b1+n*esp; }
    inv(B,Math.max(trs,e1+12),10); B.dim(e1,Math.max(trs,e1+12),'TD '+f(Math.max(0,trs-e1))); B.dim(0,Math.max(trs,e1+12),'TR '+f(trs)); B.note('ESP '+f(esp)); }
  else if(k==='bssfp'||k==='ncmra_ts'||k==='ncmra_qiss'){ var tb=k==='ncmra_ts'?num(p.bbti,1200):k==='ncmra_qiss'?num(p.qi,230):0, t1=pre(-0.6);
    if(k==='ncmra_ts'){ inv(B,-tb,8,L.inv); B.gap(-tb+5,Math.min(t1,-1)); B.dim(-tb,0,'BBTI '+f(tb)); B.note('Tag'); }
    if(k==='ncmra_qiss'){ B.mark(-tb-80,'R'); B.rf(-tb,4,90,{lab:'Sat'}); B.gr('ss',-tb+2.5,3,0.9,{rp:0.5}); B.gap(-tb-78,-tb-3); B.gap(-tb+6,Math.min(t1,-1)); B.dim(-tb,0,'QI '+f(tb)); B.note('ECG'); }
    var g={tes:[tr/2],tr:tr,fa:fa,mode:'bal',d3:d3,tro:tro,we:we}; kGRE(B,p,g); g.T0=tr; g.neg=true; kGRE(B,p,g); B.rf(2*tr,Math.min(d3?0.8:2,tr*0.15),fa,{}); sel(B,2*tr,Math.min(d3?0.8:2,tr*0.15),d3?0.3:0.45,Math.min(0.25,tr*0.02));
    B.dim(0,tr/2,'TE '+f(te)); B.dim(0,tr,'TR '+f(tr)); B.note('balanced'); if(sq.ciss) B.note('CISS'); }
  else if(k==='cine'){ var vps=num(p.vps,12), tres=vps*tr, nph=Math.max(1,Math.floor(RR*0.9/tres)); B.mark(0,'R'); B.mark(RR,'R');
    for(var j=0;j<nph;j++){ var a0=RR*0.02+j*tres; block(B,a0,a0+tres*0.96,fa,vps,j===0?'bSSFP':null,{}); }
    B.dim(RR*0.02,RR*0.02+tres,'Tres '+f(tres)); B.dim(0,RR,'RR '+f(RR)); B.note(vps+' × TR '+f(tr)); B.note('ECG'); }
  else if(k==='lge'){ var vl=num(p.vps,25), sd=vl*tr, tc=RR*0.72, ti=num(p.ti,300), tinv=Math.max(5,tc-ti);
    B.mark(0,'R'); B.mark(RR,'R'); B.mark(2*RR,'R'); inv(B,tinv,8); block(B,tc-sd/2,tc+sd/2,fa,vl,'GRE',{min:24}); inv(B,tinv+2*RR,8);
    B.gap(tc+sd/2+5,RR-5); B.gap(RR+5,2*RR-5); B.dim(tinv,tc,'TI '+f(ti)); B.dim(0,RR,'RR '+f(RR)); B.dim(tinv,tinv+2*RR,'TR '+f(2*RR)); B.note('ECG'); }
  else if(k==='map_t1'){ var sh=Math.min(RR*0.35,Math.round(ny*pf/R)*tr), pat=[1,1,1,1,1,0,0,0,1,1,1]; for(var q=0;q<=11;q++) B.mark(q*RR,'R');
    inv(B,0.72*RR-100,8); inv(B,8*RR+0.72*RR-180,8);
    for(q=0;q<11;q++) if(pat[q]) block(B,q*RR+0.72*RR-sh/2,q*RR+0.72*RR+sh/2,fa,8,q===0?'bSSFP':null,{min:10});
    B.dim(0.72*RR-100,0.72*RR,'TI 100'); B.dim(0,RR,'RR '+f(RR)); B.note('MOLLI 5(3)3'); B.note('ECG'); }
  else if(k==='asl'){ var ld=num(p.ld,1800), pld=num(p.pld,1800), ra=Math.max(30,te+30), ln=-(ld+pld);
    B.band('rf',ln,-pld,{n:60,deg:20,lab:'pCASL'}); B.band('ss',ln,-pld,{});
    block(B,0,ra,90,20,'EPI',{min:26});
    B.dim(ln,-pld,'LD '+f(ld)); B.dim(-pld,0,'PLD '+f(pld)); B.dim(ln,tr+ln,'TR '+f(tr)); B.band('rf',tr+ln,tr+ln+ld*0.08,{n:4,deg:20}); B.gap(ra+30,tr+ln-5); B.note('pairs '+num(p.npairs,8)); }
  else if(k==='dwi'||k==='dti'||k==='bold'||k==='dsc'||sq.epi){ var se=!(k==='bold'||k==='dsc'||(sq.gre&&k!=='dwi'&&k!=='dti')), espE=num(p.esp_epi,0.8), seg=num(p.seg,1), lines=Math.max(4,Math.round(ny*pf/R));
    if(seg>1) espE=espE/(seg*0.55); var prel=pf<1?Math.max(2,Math.round(ny*(pf-0.5)/R)):Math.round(lines/2);
    var bs=String(p.bvals||'0,1000').split(',').map(Number).filter(function(v){ return isFinite(v); }); if(!bs.length) bs=[0,1000]; var bmax=Math.max.apply(null,bs);
    var G=num(st.grad,45)*1e-3, gam=2.675e8, del=Math.cbrt?Math.cbrt(1.5*bmax*1e6/(gam*gam*G*G))*1000:Math.pow(1.5*bmax*1e6/(gam*gam*G*G),1/3)*1000;
    var t2=pre(-1.6); if(sq.stir){ var tis=num(p.ti,180); inv(B,Math.min(t2-5,-tis),8); B.gap(Math.min(t2-5,-tis)+5,t2); B.dim(-tis,0,'TI '+f(tis)); }
    kEPI(B,p,{se:se,te:te,tr:tr,fa:fa,espE:espE,lines:lines,pre:prel,b:se?bmax:0,bs:bs.join('/'),del:del,seg:seg,we:we});
    if(k==='dti') B.note('ndir '+num(p.ndir,30)); if(k==='bold'||k==='dsc') B.note('GRE-EPI'); }
  else if(k==='ute'){ var tu=[te]; if(p.te2) tu.push(Math.max(num(p.te2,2.3),te+0.5)); var rfu=Math.min(0.3,tr*0.05), ru=Math.min(tro,tr*0.3,tu.length>1?(tu[1]-tu[0])*0.45:9), tq=0;
    B.rf(0,rfu,fa,{sh:'rect',lab:'α '+f(fa)+'°'});
    tu.forEach(function(x,i){ tq=rfu/2+x; B.gr('ro',tq,ru,0.5,{rp:ru*0.3}); B.gr('pe',tq,ru,0.3,{rp:ru*0.3,dash:true}); B.gr('ss',tq,ru,0.2,{rp:ru*0.3,dash:true}); B.adc(tq,ru);
      B.echo(tq,ru/5,0.85*Math.exp(-x/3),{hl:true,lab:i===0,half:true,tail:ru}); tq+=ru+0.05;
      if(i+1<tu.length){ B.gr('ro',tq,Math.min(ru,(tu[i+1]-x-ru)*0.8),-0.5,{rp:ru*0.25}); } });
    B.gr('ro',tq,Math.min(1,tr*0.15),0.8,{rp:0.15}); B.gr('ss',tq,Math.min(1,tr*0.15),0.8,{rp:0.15}); tq+=Math.min(1,tr*0.15);
    B.dim(rfu/2,rfu/2+te,'TE '+f(te)); if(tu.length>1) B.dim(0,rfu/2+tu[1],'TE2 '+f(tu[1])); B.note('radial'); next(B,tr,tq+0.1,rfu,fa); }
  else if(k==='mrs'){ var rf9=Math.min(3,te*0.1), rf18=Math.min(5,te*0.14), cr=Math.min(2,te*0.05), rp=0.3;
    for(var w=3;w>=1;w--){ var tw=-w*22; B.rf(tw,12,90,{sh:'gauss',lab:w===2?'WS':null}); B.gr('ss',tw+7,8,0.9,{rp:1}); B.gr('ro',tw+7,8,0.6,{rp:1}); }
    B.rf(0,rf9,90,{lab:'90°'}); sel(B,0,rf9,0.45,rp); B.gr('ss',rf9/2+rp,rf9*0.5,-0.45,{rp:rp});
    [[te/4,'pe'],[3*te/4,'ro']].forEach(function(x){ B.rf(x[0],rf18,180,{lab:'180°'}); B.gr(x[1],x[0]-rf18/2-0.2,rf18+0.4,0.45,{rp:0.2}); ['ss','pe','ro'].forEach(function(r){ B.gr(r,x[0]-rf18/2-cr-0.3,cr,0.8,{rp:0.2}); B.gr(r,x[0]+rf18/2+0.3,cr,0.8,{rp:0.2}); }); });
    var acq=512; B.adc(te,acq); B.echo(te,te*0.06,0.85,{hl:true,lab:true,tail:acq}); B.cut(te+45,te+acq-30);
    B.dim(0,te,'TE '+f(te)); next(B,tr,te+acq+1,rf9,90); B.note('PRESS'); B.note('avg '+num(p.navg,128)); B.note('vox '+num(p.vox,15)+' mm'); }
  else if(sq.gre||/gre|dixon|pdff|swi|tof|pc|cemra|mre|map_t2s|map_vfa|fisp|psif|dess/.test(k)){
    var mode={fisp:'fisp',psif:'psif',dess:'dess'}[k]||'spoil', ts=[te];
    if(k==='dixon') ts=[te,num(p.te2,te*2)]; else if(k==='pdff'||k==='map_t2s'){ ts=[]; for(var e=0;e<num(p.ne,6);e++) ts.push(te+e*num(p.dte,te)); }
    var gg={tes:ts,tr:tr,fa:fa,mode:mode,d3:d3,tro:tro,we:we,fc:!!st.flowcomp||k==='tof'||k==='swi',venc:k==='pc'?num(p.venc,150):0,meg:k==='mre'?num(p.freq,60):0,me:ts.length>2,t2s:k==='swi'?60:45};
    pre(-Math.min(d3?0.8:2,te*0.3)/2-0.2); var r=kGRE(B,p,gg); greDims(B,gg,k);
    next(B,tr,r.end+0.02,r.rf,fa); if(k==='map_vfa') B.note('α '+f(fa)+'°/'+f(num(p.fa2,15))+'°');
    if(k==='tof'){ if(st.tone) B.note('TONE'); if(d3&&p.slabs>1) B.note('slabs '+p.slabs); }
    if(sq.twist) B.note('TWIST A '+num(p.pa,20)+'% B '+num(p.pb,25)+'%'); if(sq.radial) B.note('radial'); if(mode==='dess') B.note('DESS'); }
  else { pre(-1.5); if(p.etl) kFSE(B,p,fse); else kSE(B,p,{tes:[te],tro:tro,tr:tr}); }
  /* 加速の注記 */
  if(d3&&!/mprage|mp2rage/.test(k)) B.note('3D');
  var Rz=(d3&&st.pimode&&st.pimode!=='off')?Math.max(1,num(p.rz,1)):1; if(R>1||Rz>1) B.note('PI ×'+R+(Rz>1?'×'+Rz:''));
  if(pf<1) B.note('PF '+pfTxt(pf)); if(d3&&num(p.pfz,1)<1) B.note('PFz '+pfTxt(p.pfz)); if(num(p.sms,1)>1) B.note('SMS ×'+p.sms); if(num(p.cs,1)>1) B.note('CS ×'+p.cs);
  if(/^(chess|spair|stir)$/.test(st.fs||'')&&!noFs) B.note(st.fs.toUpperCase());
  return B; }

/* ---------- 時間軸（省略つき） ---------- */
function axis(B,x0,x1){ var tmin=Infinity,tmax=-Infinity; B.ev.forEach(function(e){ if(isFinite(e[0])&&isFinite(e[1])){ tmin=Math.min(tmin,e[0]); tmax=Math.max(tmax,e[1]); } });
  if(!isFinite(tmin)){ tmin=0; tmax=10; } var span=tmax-tmin||1;
  var brk=B.skip.map(function(b){ return [b[0],b[1],1]; }), shown=span; brk.forEach(function(b){ shown-=b[1]-b[0]; });
  var dd=B.dead.filter(function(d){ return d[1]-d[0]>0; }).sort(function(a,b){ return (b[1]-b[0])-(a[1]-a[0]); });
  dd.forEach(function(d){ var ov=brk.some(function(b){ return d[0]<b[1]&&d[1]>b[0]; }); if(!ov&&d[1]-d[0]>0.45*shown){ brk.push([d[0],d[1]]); shown-=d[1]-d[0]; } });
  brk=brk.map(function(b){ var m=b.length>2?0:Math.min((b[1]-b[0])*0.25,shown*0.02); return [b[0]+m,b[1]-m]; });
  brk.sort(function(a,b){ return a[0]-b[0]; }); shown=span; brk.forEach(function(b){ shown-=b[1]-b[0]; }); tmin-=shown*0.015; tmax+=shown*0.015; shown*=1.03;
  var BW=16, s=Math.max(1e-6,(x1-x0-BW*brk.length)/shown);
  function X(t){ var x=x0, prev=tmin; for(var i=0;i<brk.length;i++){ var b=brk[i]; if(t<=b[0]) return x+(t-prev)*s; x+=(b[0]-prev)*s; if(t<=b[1]) return x+(t-b[0])/(b[1]-b[0])*BW; x+=BW; prev=b[1]; } return x+(t-prev)*s; }
  var bx=brk.map(function(b){ return X(b[0]); }); return {X:X,s:s,brk:brk,bx:bx,BW:BW}; }

/* ---------- 描画 ---------- */
MS.drawPSD=function(canvas,sq,p,st,opts){
  opts=opts||{}; sq=sq||{}; p=p||{}; st=st||{}; var C={}, k; for(k in DEFC) C[k]=DEFC[k]; if(opts.colors) for(k in opts.colors) if(opts.colors[k]) C[k]=opts.colors[k];
  var dpr=opts.dpr||(typeof window!=='undefined'&&window.devicePixelRatio)||1;
  var W=opts.width||canvas.clientWidth||Math.round((canvas.width||600)/dpr)||600, H=opts.height||260;
  canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr); if(canvas.style&&!canvas.style.height) canvas.style.height=H+'px';
  var g=canvas.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.fillStyle=C.bg; g.fillRect(0,0,W,H);
  var B; try{ B=build(sq,p,st); }catch(e){ B=new Bld(); B.note('?'); }
  var FONT='11px system-ui,-apple-system,"Segoe UI",sans-serif', SM='10px system-ui,-apple-system,"Segoe UI",sans-serif';
  g.font=FONT; var lw=0; ROWS.forEach(function(r){ lw=Math.max(lw,g.measureText(L[r]).width); });
  var x0=lw+12, x1=W-10, top=18, lanes=3, laneH=13, bot=H-lanes*laneH-4, tot=0; ROWS.forEach(function(r){ tot+=RH[r]; });
  var Y={}, y=top; ROWS.forEach(function(r){ var h=(bot-top)*RH[r]/tot; Y[r]={t:y,h:h,b:r==='rf'?y+h*0.8:y+h/2}; y+=h; });
  var hasNeg=B.ops.some(function(o){ return o.k==='rf'&&o.deg<0; }); Y.rf.b=Y.rf.t+Y.rf.h*(hasNeg?0.64:0.86);
  var A=axis(B,x0,x1), X=A.X, occ={};
  function free(key,a,b){ var l=occ[key]||(occ[key]=[]); for(var i=0;i<l.length;i++) if(a<l[i][1]&&b>l[i][0]) return false; l.push([a,b]); return true; }
  function col(c){ return C[c]||c; }
  function text(s,x,yy,o){ o=o||{}; g.font=o.font||SM; var w=g.measureText(s).width, al=o.al||'center', xa=al==='center'?x-w/2:al==='right'?x-w:x;
    if(o.lane&&!free(o.lane,xa-2,xa+w+2)) return false; if(o.halo!==false){ g.globalAlpha=0.85; g.fillStyle=C.bg; g.fillRect(xa-1.5,yy-8,w+3,10.5); g.globalAlpha=1; }
    g.fillStyle=col(o.c||'text'); g.textAlign='left'; g.textBaseline='alphabetic'; g.fillText(s,xa,yy); return true; }
  /* 行ラベルと基線 */
  var RC={rf:'rf',ss:'gss',pe:'gpe',ro:'gro',adc:'adc',sig:'sig'};
  ROWS.forEach(function(r){ text(L[r],4,Y[r].b+4,{al:'left',font:FONT,c:RC[r],halo:false}); });
  g.strokeStyle=C.grid; g.lineWidth=1; var segs=[], sx=x0; A.bx.forEach(function(b){ segs.push([sx,b]); sx=b+A.BW; }); segs.push([sx,x1]);
  ROWS.forEach(function(r){ segs.forEach(function(s){ g.beginPath(); g.moveTo(s[0],Y[r].b+0.5); g.lineTo(s[1],Y[r].b+0.5); g.stroke(); }); });
  /* 省略区間以外にクリップ */
  g.save(); g.beginPath(); segs.forEach(function(s){ g.rect(s[0],top-4,s[1]-s[0],bot-top+4+lanes*laneH); }); g.clip();
  var amp={rf:Y.rf.h*(hasNeg?0.36:0.6),g:0,sig:Y.sig.h*0.34};
  function trap(o){ var R=Y[o.row], hA=R.h*0.42, xa=X(o.t0), xb=X(o.t0+o.d), w=Math.max(1,xb-xa), rp=Math.min(w*0.45,Math.max(1,(o.rp||o.d*0.15)*A.s)), yy=R.b-o.a*hA;
    g.beginPath(); g.moveTo(xa,R.b); g.lineTo(xa+rp,yy); g.lineTo(xa+w-rp,yy); g.lineTo(xa+w,R.b); g.closePath();
    var c=col(o.c||RC[o.row]); g.strokeStyle=c; g.fillStyle=c; if(o.dash){ g.setLineDash([3,2]); g.lineWidth=1; g.stroke(); g.setLineDash([]); return; } g.globalAlpha=0.3; g.fill(); g.globalAlpha=1; g.lineWidth=1.2; g.stroke(); }
  function rfShape(o){ var R=Y.rf, xc=X(o.t), w=Math.max(6,o.d*A.s), d=Math.abs(o.deg||90), hA=amp.rf*cl(0.3+0.7*d/180,0.3,1)*(o.deg<0?-1:1), n=Math.max(12,Math.round(w));
    g.beginPath(); g.moveTo(xc-w/2,R.b); for(var i=0;i<=n;i++){ var u=i/n*2-1, v;
      if(o.sh==='rect') v=Math.abs(u)<0.95?1:0; else if(o.sh==='gauss') v=Math.exp(-u*u*5); else if(o.sh==='sech') v=1/Math.cosh(u*3.2);
      else if(o.sh==='binom'){ var q=(u+1)*2, j=Math.floor(q), fr=q-j; v=(j>=0&&j<4)?[0.33,0.66,0.66,0.33][j]*Math.sin(Math.PI*fr)*1.4:0; }
      else { var z=u*3*Math.PI; v=(z===0?1:Math.sin(z)/z)*(0.5+0.5*Math.cos(Math.PI*u)); }
      g.lineTo(xc-w/2+i/n*w,R.b-hA*v); } g.lineTo(xc+w/2,R.b);
    var c=col(o.c||(o.hl?'accent':'rf')); g.strokeStyle=c; g.fillStyle=c; g.globalAlpha=o.sh==='sech'?0.35:0.22; g.fill(); g.globalAlpha=1; g.lineWidth=1.2; g.stroke(); return {x:xc,y:R.b-Math.max(hA,0)}; }
  function sigLine(t0,t1,env,o){ var R=Y.sig, xa=X(t0), xb=X(t1), n=Math.max(8,Math.round(xb-xa)); if(xb-xa<0.5) return; g.beginPath();
    for(var i=0;i<=n;i++){ var t=t0+(t1-t0)*i/n, x=X(t), e=env(t); g[i?'lineTo':'moveTo'](x,R.b-amp.sig*e*Math.cos(x*1.35)); }
    g.strokeStyle=col(o.hl?'accent':'sig'); g.lineWidth=o.hl?1.5:1; g.stroke(); }
  var rfLab=[], labs=[];
  B.ops.forEach(function(o){
    if(o.k==='rf'){ var pt=rfShape(o); if(o.lab) rfLab.push({x:pt.x,s:o.lab,c:o.hl?'accent':'rf'}); }
    else if(o.k==='gr') trap(o);
    else if(o.k==='tab'){ var R=Y[o.row], hA=R.h*0.42*o.a, xa=X(o.t0), w=X(o.t0+o.d)-xa; if(w<8){ xa+=w/2-4; w=8; } rp=Math.min(w*0.3,3), c=col(RC[o.row]); g.strokeStyle=c; g.fillStyle=c;
      g.globalAlpha=0.15; g.fillRect(xa+rp/2,R.b-hA,w-rp,2*hA); g.globalAlpha=1; g.lineWidth=0.8;
      [-1,-0.5,0,0.5,1].forEach(function(m){ g.beginPath(); g.moveTo(xa,R.b); g.lineTo(xa+rp,R.b-m*hA); g.lineTo(xa+w-rp,R.b-m*hA); g.lineTo(xa+w,R.b); g.stroke(); }); }
    else if(o.k==='adc'){ var Ra=Y.adc, xa2=X(o.t0), w2=Math.max(1.5,X(o.t0+o.d)-xa2); g.fillStyle=C.adc; g.globalAlpha=0.25; g.fillRect(xa2,Ra.b-Ra.h*0.3,w2,Ra.h*0.6); g.globalAlpha=1; g.strokeStyle=C.adc; g.lineWidth=1; g.strokeRect(xa2+0.5,Ra.b-Ra.h*0.3,w2-1,Ra.h*0.6); }
    else if(o.k==='echo'){ if(!(o.a>0)) return; var w3=Math.max(o.w,2.2/A.s); sigLine(o.half?o.tc:o.tc-2.5*w3,o.tc+(o.tail||2.5*w3),function(t){ var u=(t-o.tc)/w3; return o.a*(o.half||(o.tail&&t>o.tc)?Math.exp(-Math.abs(t-o.tc)/Math.max(w3,(o.tail||w3)*0.35)):Math.exp(-u*u)); },o);
      if(o.lab) labs.push({row:'sig',x:X(o.tc),s:L.echo,c:o.hl?'accent':'sig'}); }
    else if(o.k==='fid') sigLine(o.t0,o.t0+o.d,function(t){ return o.a*Math.exp(-(t-o.t0)/(o.d*0.3)); },{});
    else if(o.k==='band'){ var Rb=Y[o.row], xb0=X(o.t0), wb=Math.max(o.min||0,X(o.t1)-xb0,2), c2=col(RC[o.row]); g.strokeStyle=c2; g.fillStyle=c2;
      if(o.n&&(o.row==='rf'||o.row==='ro'||o.row==='adc'||o.row==='sig')){ var nd=Math.max(1,Math.min(o.n,Math.floor(wb/4))); if(nd<o.n) B.ab=true; var hh=o.row==='rf'?amp.rf*cl(0.3+0.7*(o.deg||10)/180,0.3,1):Rb.h*(o.row==='adc'?0.3:0.3);
        for(var i=0;i<nd;i++){ var xi=xb0+(i+0.5)*wb/nd; if(o.row==='adc'){ g.globalAlpha=0.4; g.fillRect(xi-wb/nd*0.3,Rb.b-hh,wb/nd*0.6,2*hh); g.globalAlpha=1; } else if(o.row==='sig'){ g.beginPath(); g.moveTo(xi,Rb.b-hh*0.7); g.lineTo(xi,Rb.b+hh*0.7); g.lineWidth=0.8; g.stroke(); } else { g.beginPath(); g.moveTo(xi,Rb.b); g.lineTo(xi,Rb.b-hh); g.lineWidth=1; g.stroke(); } } }
      else { g.globalAlpha=0.18; g.fillRect(xb0,Rb.b-Rb.h*0.3,wb,Rb.h*0.6); g.globalAlpha=1; g.lineWidth=0.8; g.strokeRect(xb0+0.5,Rb.b-Rb.h*0.3,wb-1,Rb.h*0.6); }
      if(o.lab) (o.row==='rf'?rfLab:labs).push({row:o.row,x:xb0+wb/2,s:o.lab,c:RC[o.row]}); }
    else if(o.k==='epi'){ var xe=X(o.t0), we=Math.max(4,X(o.t0+o.d)-xe), nd2=Math.max(1,Math.min(o.n,Math.floor(we/6))), lw2=we/nd2; if(nd2<o.n) B.ab=true;
      var Rr=Y.ro, Rp=Y.pe, Rd=Y.adc, hr=Rr.h*0.42*0.75; g.lineWidth=1.1;
      for(var j=0;j<nd2;j++){ var xa3=xe+j*lw2, sg=j%2?-1:1, rr=Math.min(lw2*0.25,3); g.beginPath(); g.moveTo(xa3,Rr.b); g.lineTo(xa3+rr,Rr.b-sg*hr); g.lineTo(xa3+lw2-rr,Rr.b-sg*hr); g.lineTo(xa3+lw2,Rr.b); g.strokeStyle=C.gro; g.fillStyle=C.gro; g.globalAlpha=0.3; g.fill(); g.globalAlpha=1; g.stroke();
        g.fillStyle=C.adc; g.globalAlpha=0.3; g.fillRect(xa3+rr,Rd.b-Rd.h*0.3,lw2-2*rr,Rd.h*0.6); g.globalAlpha=1;
        if(j<nd2-1){ var xb3=xa3+lw2, bw2=Math.min(lw2*0.4,4); g.beginPath(); g.moveTo(xb3-bw2/2,Rp.b); g.lineTo(xb3,Rp.b-Rp.h*0.18); g.lineTo(xb3+bw2/2,Rp.b); g.strokeStyle=C.gpe; g.stroke(); } }
      g.strokeStyle=C.adc; g.lineWidth=1; g.strokeRect(xe+0.5,Rd.b-Rd.h*0.3,we-1,Rd.h*0.6);
      var tc=o.tc, sdv=o.d*0.12; sigLine(o.t0,o.t0+o.d,function(t){ var u=(t-tc)/sdv; return 0.85*Math.exp(-u*u*0.5)*(0.35+0.65*Math.abs(Math.cos(Math.PI*(t-o.t0)/(o.d/nd2)))); },{hl:true});
      labs.push({row:'sig',x:X(tc),s:L.echo,c:'accent'}); }
    else if(o.k==='txt') labs.push({row:o.row,x:X(o.t),s:o.s,c:o.c||RC[o.row]});
    else if(o.k==='mark'){ var xm=X(o.t); g.strokeStyle=col(o.c||'accent'); g.setLineDash([2,3]); g.lineWidth=1; g.beginPath(); g.moveTo(xm,top); g.lineTo(xm,bot); g.stroke(); g.setLineDash([]); rfLab.push({x:xm,s:o.s,c:o.c||'accent',pri:1}); }
  });
  /* 寸法線（TE・TR・TI など）：重ならない段に置く */
  var dimL=[]; B.dims.forEach(function(d){ var a=X(d.t0), b=X(d.t1); g.font=SM; var w=g.measureText(d.s).width, inside=b-a>w+8, ta=inside?(a+b)/2-w/2:b+3;
    for(var ln=0;ln<lanes;ln++){ if(free('dim'+ln,a-1,Math.max(b,ta+w)+3)){ dimL.push({a:a,b:b,ln:ln,s:d.s,ta:ta,w:w}); break; } } });
  dimL.forEach(function(d){ var yy=bot+laneH*d.ln+9; g.strokeStyle=C.grid; g.setLineDash([1,2]); g.lineWidth=0.8; [d.a,d.b].forEach(function(x){ g.beginPath(); g.moveTo(x,Y.rf.t+4); g.lineTo(x,yy); g.stroke(); }); g.setLineDash([]);
    g.strokeStyle=C.text; g.lineWidth=0.9; g.beginPath(); g.moveTo(d.a,yy); g.lineTo(d.b,yy); g.moveTo(d.a,yy-3); g.lineTo(d.a,yy+3); g.moveTo(d.b,yy-3); g.lineTo(d.b,yy+3); g.stroke(); });
  g.restore();
  dimL.forEach(function(d){ var yy=bot+laneH*d.ln+9; text(d.s,d.ta,yy-2,{al:'left',c:'text'}); });
  /* 省略記号 // */
  g.strokeStyle=C.text; g.lineWidth=1; A.bx.forEach(function(bx){ var ys=ROWS.map(function(r){ return Y[r].b; }); dimL.forEach(function(d){ if(d.a<bx&&d.b>bx+A.BW) ys.push(bot+laneH*d.ln+9); });
    ys.forEach(function(yy){ [0.32,0.62].forEach(function(fx){ var xx=bx+A.BW*fx; g.beginPath(); g.moveTo(xx-2,yy+5); g.lineTo(xx+2,yy-5); g.stroke(); }); }); });
  /* ラベル（重なるものは省く） */
  function put(l,yy,lane){ text(l.s,l.x,yy,{lane:lane,c:l.c})||text(l.s,l.x+3,yy,{lane:lane,c:l.c,al:'left'})||text(l.s,l.x-3,yy,{lane:lane,c:l.c,al:'right'}); }
  rfLab.sort(function(a,b){ return (b.pri||0)-(a.pri||0); }).forEach(function(l){ put(l,Y.rf.t+9,'rfl'); });
  labs.forEach(function(l){ var R=Y[l.row]; put(l,l.y||(R.t+9),'l'+l.row); });
  /* 見出し：注記（右）と省略の注意（左） */
  g.font=SM; var nt=B.notes.join('  ·  '), nw=g.measureText(nt).width; text(nt,x1,11,{al:'right',c:'text',halo:false});
  if(A.brk.length||B.ab){ var fw=g.measureText(L.note).width; if(x0+fw<x1-nw-8){ g.globalAlpha=0.6; text(L.note,x0,11,{al:'left',c:'text',halo:false}); g.globalAlpha=1; } }
  return {notes:B.notes,breaks:A.brk.length};
};
})();
