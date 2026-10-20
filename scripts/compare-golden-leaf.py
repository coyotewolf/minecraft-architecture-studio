"""Proportional side-by-side reference audit, without altering building pixels."""
from pathlib import Path
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFont

folder = Path(sys.argv[1] if len(sys.argv) > 1 else 'evidence')
out = Path(sys.argv[2] if len(sys.argv) > 2 else 'evidence/golden-leaf-100-comparison.png')
reference = Path('public/local-references')
background = (20, 25, 27)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 18)
sheet = Image.new('RGB', (2400, 930), background)
draw = ImageDraw.Draw(sheet)
draw.text((22, 16), 'Source / actual 100-block model | Equal displayed height, no stretching | Estimated 14-degree source view', font=font, fill='white')
for i, (label, path) in enumerate([
 ('Original front',reference/'golden-leaf-front.png'),('100-block model front',folder/'golden-leaf-front.png'),
 ('Original rear',reference/'golden-leaf-rear.png'),('100-block model rear',folder/'golden-leaf-rear.png')]):
 img=Image.open(path).convert('RGBA')
 if img.getextrema()[3][0] < 255: bounds=img.getchannel('A').point(lambda a:255 if a>100 else 0).getbbox()
 else:
  diff=ImageChops.difference(img.convert('RGB'),Image.new('RGB',img.size,img.getpixel((0,0))[:3]))
  bounds=diff.convert('L').point(lambda x:255 if x>15 else 0).getbbox()
 if bounds: img=img.crop(bounds)
 scale=min(565/img.width,825/img.height)
 img=img.resize((round(img.width*scale),round(img.height*scale)),Image.Resampling.LANCZOS)
 draw.text((i*600+22,56),label,font=font,fill=(220,225,224))
 sheet.paste(img,(i*600+(600-img.width)//2,100+(825-img.height)),img)
out.parent.mkdir(parents=True,exist_ok=True)
sheet.save(out)
print(out)
