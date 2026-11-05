"""MRIパラメータシミュレーター Pro のビルド

usage: python3 build.py OUT.html [CSS_DIR] [--public] [--radtools]

  既定        単独のHTML（院内用。RadTools の共通ヘッダ・フッタなし）
  --public    公開版（院内向けの表記を外し、裏付けのないメーカー名称を「—」にする。フッタに注意書き・ライセンス）
  --radtools  RadTools ポータル統合版（共通ヘッダ・フッタつき。RadTools の ui/chrome.py が必要）

  CSS は次の順に探す：
    1. 引数 CSS_DIR（RadTools の _build/src_v7）
    2. build.py の隣の css/（公開リポジトリの構成：book.css・radtools-ui.css・theme.css）
    3. build.py の一つ上の src_v7（便利ツール/_build/ の構成）
"""
import re,sys,os,datetime,glob
args=[a for a in sys.argv[1:] if not a.startswith('--')]; flags=set(a for a in sys.argv[1:] if a.startswith('--'))
RT_MODE='--radtools' in flags; PUBLIC='--public' in flags
here=os.path.dirname(os.path.abspath(__file__)); d=os.path.join(here,'src')+'/'
FAVICON="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Crect width=%2724%27 height=%2724%27 rx=%276%27 fill=%27%23007d82%27/%3E%3Cpath d=%27M5 12h3l2-5 3 10 2-5h4%27 fill=%27none%27 stroke=%27white%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E"
def css_from_rt(rt):
  book=open(os.path.join(rt,'work/mri-sequence-book.src.html'),encoding='utf-8').read()
  return (re.findall(r'<style[^>]*>(.*?)</style>',book,re.S)[0], open(os.path.join(rt,'ui/radtools-ui.css'),encoding='utf-8').read(), open(os.path.join(rt,'themes/mri-sequence-book.css'),encoding='utf-8').read())
rt=None
if len(args)>1: rt=args[1]
elif os.path.isdir(os.path.join(here,'css')): rt=None
elif os.path.isdir(os.path.join(here,'..','src_v7')): rt=os.path.join(here,'..','src_v7')
if rt: bookcss,rtui,theme=css_from_rt(rt)
else: bookcss,rtui,theme=[open(os.path.join(here,'css',f),encoding='utf-8').read() for f in ['book.css','radtools-ui.css','theme.css']]
files=[d+'tissues.js',d+'phantom.js']+sorted(glob.glob(d+'ph/*.js'))+[d+f+'.js' for f in ['engine','seqs','state','meta','learn']]
parts=[open(f,encoding='utf-8').read() for f in files]
if PUBLIC: parts.insert(1,'MS.PUBLIC=true;')
eng='\n'.join(parts)+'\n'
html=open(d+'ui.html',encoding='utf-8').read(); ui=open(d+'ui.js',encoding='utf-8').read()
if PUBLIC:
  REPO='https://github.com/ringnir/MRI-SIMULATOR-html'
  rep=[(html,[('院内教育版 · 全身・網羅版','教育用 · 全身・網羅版'),
              ('<span class="cf x">要確認</span> 名称を確認できていない。','裏付けのとれていない名称は「—」としています。'),
              ('院内装置のプロトコル名で確認してください。','お使いの装置のプロトコル名で確認してください。'),
              ('<p>院内教育用 · 全身・網羅版（2026年11月） · 外部ライブラリを使わず、すべての計算をこのファイル内で行います。既存の「MRIシーケンス読本」内のパラメータシミュレーターはそのまま残しています。</p>',
               '<p>教育用 · 全身・網羅版（2026年11月） · 外部ライブラリを使わず、すべての計算をこのファイル内で行います（オフラインで動作し、入力した値はどこにも送信しません）。</p>'
               '<p><b>診療・装置の設定には使わないでください。</b>組織値は文献値を丸めた代表値・推定値、仮想ファントムは解析的な図形で描いた模式図で、画像・撮像時間・SNR・SAR は教育用の近似です。医療機器ではありません。</p>'
               '<p>Siemens、Siemens Healthineers、Canon、Canon Medical Systems の各社名、および本ツールに記載のシーケンス名・機能名（TSE、HASTE、VIBE、SPACE、FASE、SPEEDER、AiCE など）は各社の商標または登録商標です。名称の対応を示す目的で記載しており、各社とは関係のない非公式のツールです。</p>'
               '<p><a href="'+REPO+'">GitHub</a> · <a href="'+REPO+'/blob/main/LICENSE">MIT License</a> · © 2026 ringnir</p>')]),
       ]
  for a,b in rep[0][1]:
    assert a in html, a[:30]; html=html.replace(a,b,1)
  for a,b in [('「要確認」は名称の裏付けが取れていないもので、','裏付けのとれていない名称は「—」としています。'),('院内の装置のプロトコル名で確認してください。','お使いの装置のプロトコル名で確認してください。')]:
    assert a in eng, a[:20]; eng=eng.replace(a,b)
  a='Siemens: Deep Resolve Sharp、Canon: PIQE（名称要確認）。'; assert a in ui; ui=ui.replace(a,'Siemens: Deep Resolve Sharp など。')
safe=lambda x:x.replace('</script','<\\/script')
html=html.replace('/*__BOOKCSS__*/',bookcss).replace('/*__RTUI__*/',rtui).replace('/*__THEME__*/',theme)
html=html.replace('/*__ENGINE__*/',safe(eng)).replace('/*__ENGINE_RUN__*/',safe(eng)).replace('/*__UI__*/',safe(ui))
html=html.replace('</head>','<link rel="icon" href="'+FAVICON+'">\n</head>',1)
if RT_MODE:
  sys.path.insert(0,os.path.join(rt,'ui')); import chrome
  html=re.sub(r'(<body[^>]*>)',lambda m:m.group(1)+'\n'+chrome.bar('MRIパラメータシミュレーター Pro','MRI物理・シーケンス','cat-physics','index.html'),html,count=1)
  i=html.rfind('</body>'); html=html[:i]+chrome.foot('index.html',datetime.date.today().isoformat())+'\n'+html[i:]
else:
  html=html.replace('</head>','<style>:root{--rt-bar-h:0px}.sidebar{padding-top:26px}</style>\n</head>',1)
out=args[0]; open(out,'w',encoding='utf-8').write(html); print(out,len(html)//1024,'KB')
