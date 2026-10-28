"""Proportional side-by-side reference audit, without altering building pixels."""
from pathlib import Path
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFont

folder = Path(sys.argv[1] if len(sys.argv) > 1 else 'evidence')
out = Path(sys.argv[2] if len(sys.argv) > 2 else 'evidence/golden-leaf-100-comparison.png')
reference = Path('public/local-references')
background = (20, 25, 27)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 18)
baseline = Path(sys.argv[3]) if len(sys.argv) > 3 else None
baseline_label = sys.argv[4] if len(sys.argv)>4 else 'V8'
current_label = sys.argv[5] if len(sys.argv)>5 else 'V9'
sheet = Image.new('RGB', (1800, 1840) if baseline else (2400, 930), background)
draw = ImageDraw.Draw(sheet)
draw.text((22, 16), 'Reference / canonical model | Equal displayed height, no stretching | Estimated 14-degree view', font=font, fill='white')
panels=[]
sources = ([(label, directory/('golden-leaf-'+view+'.png')) for view in ['front','rear'] for label,directory in [('Reference '+view,reference),(baseline_label+' '+view,baseline),(current_label+' '+view,folder)]] if baseline else [('Original front',reference/'golden-leaf-front.png'),('100-block model front',folder/'golden-leaf-front.png'),('Original rear',reference/'golden-leaf-rear.png'),('100-block model rear',folder/'golden-leaf-rear.png')])
for label, path in sources:
 img=Image.open(path).convert('RGBA')
 if img.getextrema()[3][0] < 255: bounds=img.getchannel('A').point(lambda a:255 if a>100 else 0).getbbox()
 else:
  diff=ImageChops.difference(img.convert('RGB'),Image.new('RGB',img.size,img.getpixel((0,0))[:3]))
  bounds=diff.convert('L').point(lambda x:255 if x>15 else 0).getbbox()
 if bounds: img=img.crop(bounds)
 panels.append((label,img))
# One shared height prevents a wide source from being silently displayed shorter.
display_height=min(825,*(565*img.height/img.width for _,img in panels))
for i,(label,img) in enumerate(panels):
 scale=display_height/img.height
 img=img.resize((round(img.width*scale),round(img.height*scale)),Image.Resampling.LANCZOS)
 column,row=(i%3,i//3) if baseline else (i,0)
 draw.text((column*600+22,56+row*900),label,font=font,fill=(220,225,224))
 sheet.paste(img,(column*600+(600-img.width)//2,100+row*900+(825-img.height)),img)
out.parent.mkdir(parents=True,exist_ok=True)
sheet.save(out)
print(out)
