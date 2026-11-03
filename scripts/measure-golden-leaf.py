"""Image-space silhouette diagnostics; these are not reconstruction accuracy scores."""
from pathlib import Path
import json,sys
from PIL import Image,ImageChops
folder=Path(sys.argv[1]); output=Path(sys.argv[2]); sources=Path('public/local-references')
def measurements(path):
    img=Image.open(path).convert('RGBA')
    if img.getextrema()[3][0]<255:
        bounds=img.getchannel('A').point(lambda a:255 if a>100 else 0).getbbox()
    else:
        bounds=ImageChops.difference(img.convert('RGB'),Image.new('RGB',img.size,img.getpixel((0,0))[:3])).convert('L').point(lambda v:255 if v>15 else 0).getbbox()
    img=img.crop(bounds); hsv=img.convert('RGB').convert('HSV'); px=hsv.load(); rows=[]
    for level in [.2,.35,.5,.65,.72]:
        y=round(level*(img.height-1)); xs=[x for yy in range(max(0,y-1),min(img.height,y+2)) for x in range(img.width) if 18<=px[x,yy][0]<=43 and px[x,yy][1]>=100 and px[x,yy][2]>=65 and img.getpixel((x,yy))[3]>100]
        width=max(xs)-min(xs)+1 if xs else 0
        rows.append({'fractionFromTop':level,'goldPixelSpan':width,'spanPerBuildingHeight':round(width/img.height,4)})
    return {'croppedSize':[img.width,img.height],'goldSpans':rows}
report={'meaning':'Screen-space gold-color span at equal normalized whole-building height. Source camera is unknown; no pixel-identity or similarity-percentage claim. The user requested a slightly slimmer tower.','views':{}}
for view in ['front','rear']:
    report['views'][view]={'reference':measurements(sources/('golden-leaf-'+view+'.png')),'v8':measurements(Path('evidence/golden-leaf-v8-final')/('golden-leaf-'+view+'.png')),'v9':measurements(folder/('golden-leaf-'+view+'.png'))}
output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))
