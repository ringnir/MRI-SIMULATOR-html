# 画面で：各課題が開始時に未達成で、既知の解を入れるとクリアになること（画像の中央値で判定）
import asyncio,json,sys,os,pathlib
from playwright.async_api import async_playwright
F=sys.argv[1] if len(sys.argv)>1 else 'index.html'   # 使い方: python3 tests/ui_missions.py index.html（要 playwright）
SOL={ 's_t1w':{'p':{'tr':500,'te':12}}, 't2w':{'p':{'tr':4000,'te':100}}, 's_pd':{'p':{'tr':3000,'te':15}}, 'flair':{'p':{'ti':2400}}, 's_thin':{'p':{'thk':3,'nex':3}}, 's_half':{'p':{'nex':1}},
  'stir':{'p':{'ti':230}}, 'alias':{'p':{'pfov':100}}, 'inopp':{'p':{'te':2.3,'te2':4.6}}, 'chemshift':{'p':{'bw':450}}, 'b_fatsat':{'st':{'fs':'chess'}}, 'b_hem':{'p':{'te':25}},
  'cnr_time':{'p':{'tr':400,'te':12,'nex':1,'ny':192,'thk':6}}, 'breathhold':{'p':{'r':3,'pf':0.75,'npart':48}}, 'metal':{'p':{'bw':500},'st':{'vat':True,'fs':'stir'}}, 'epi':{'p':{'r':3,'pf':0.75,'ny':128}}, 'fast_t2':{'p':{'etl':16,'nex':1}}, 'a_sar':{'p':{'refoc':120,'etl':16,'tr':4000}},
  'x_mrcp':{'p':{'te':600,'r':2,'pf':0.75}}, 'x_flair3':{'p':{'refoc':120,'etl':24,'ti':2400}}, 'x_vibe':{'p':{'thk':2.5,'r':2,'pfz':0.75}}, 'x_dwi3':{'p':{'r':3,'pf':0.75,'ny':128}}, 'x_knee3':{'p':{'nx':448,'ny':400,'bw':450,'nex':2,'etl':16}}, 'x_mprage':{'p':{'ti':700}} }
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME') or None,args=['--no-sandbox']); errs=[]; bad=0
        pg=await b.new_page(viewport={'width':1600,'height':900}); pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto(pathlib.Path(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..',F)).resolve().as_uri()+'#mission'); await pg.wait_for_timeout(3000)
        ids=await pg.evaluate("MS.MISSIONS.map(m=>m.id)")
        for mid in ids:
            await pg.evaluate("__mrisimTest(function(t){ t.startMission('%s'); })"%mid); await pg.wait_for_timeout(2600)
            init=await pg.evaluate("[...document.querySelectorAll('#mcrit li')].map(l=>l.classList.contains('ok'))")
            sol=SOL.get(mid,{})
            await pg.evaluate("(sol=>__mrisimTest(function(t){ var s=t.getSt(); Object.assign(s.p,sol.p||{}); Object.assign(s,sol.st||{}); t.buildParams(); t.schedule(); }))(%s)"%json.dumps(sol)); await pg.wait_for_timeout(3200)
            after=await pg.inner_text('#mcrit'); okc=await pg.evaluate("[...document.querySelectorAll('#mcrit li')].map(l=>l.classList.contains('ok'))")
            good=(not all(init)) and all(okc)
            if not good: bad+=1
            print(('OK  ' if good else 'BAD ')+mid.ljust(11), 'init',init,'after',okc, '' if good else after.replace('\n',' | ')[:200])
        print('ui missions', 'ok' if not bad else 'bad %d'%bad, 'errors',errs); await b.close()
asyncio.run(main())
