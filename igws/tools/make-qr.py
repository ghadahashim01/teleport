#!/usr/bin/env python3
"""توليد رمز QR لشريحة الختام من رابط المنصة المعرّف في js/content.js (PLATFORM_URL).

الاستخدام (من مجلد المشروع):  python3 tools/make-qr.py
يحتاج: pip install qrcode   — والتحقق الاختياري بالقراءة: pip install zxing-cpp pillow
الناتج: img/qr-platform.svg — وحدات كحلية على أبيض، تصحيح أخطاء M، هامش هادئ 4 وحدات.
"""
import pathlib, re, sys
import qrcode

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / 'js' / 'content.js').read_text(encoding='utf-8')
m = re.search(r"export const PLATFORM_URL = '([^']+)'", src)
if not m:
    sys.exit('PLATFORM_URL غير موجود في js/content.js')
url = m.group(1)

qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=4)
qr.add_data(url); qr.make(fit=True)
mat = qr.get_matrix(); n = len(mat)
path = ''.join(f'M{x} {y}h1v1h-1z' for y, row in enumerate(mat) for x, v in enumerate(row) if v)
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges">'
       f'<rect width="{n}" height="{n}" fill="#ffffff"/><path d="{path}" fill="#0b1f3a"/></svg>')
out = ROOT / 'img' / 'qr-platform.svg'
out.write_text(svg, encoding='utf-8')
print(f'كُتب {out.relative_to(ROOT)} ({n}×{n} وحدة) للرابط: {url}')

try:  # تحقق: قراءة الرمز المولَّد والتأكد من أن وجهته مطابقة تماماً
    import zxingcpp
    img = qr.make_image(fill_color='#0b1f3a', back_color='white').convert('RGB')
    got = [r.text for r in zxingcpp.read_barcodes(img)]
    print('التحقق بالقراءة:', 'ناجح' if got == [url] else f'فشل: {got}')
except ImportError:
    print('(تخطّي التحقق: zxing-cpp غير مثبت)')
