"""Baut das Synology-Paket ringtagebuch-<version>.spk aus dem Projektordner.

Aufruf: python3 build_spk.py <projekt-ordner> <ausgabe-ordner>
Aufbau wie beim NununuMe-Paket: INFO + package.tgz (src/ = Web-Dateien) + conf/ + scripts/ + Symbole.
"""
import hashlib
import io
import os
import sys
import tarfile
import time

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
root, out_dir = sys.argv[1], sys.argv[2]
version = open(os.path.join(root, 'VERSION')).read().strip()
FILES = ['index.html', 'style.css', 'app.js', 'icons.js', 'intro.js', 'sw.js', 'manifest.json', 'version.json',
         'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png']
FILES += ['splash/' + f for f in sorted(os.listdir(os.path.join(root, 'splash'))) if f.endswith('.png')]  # iPhone-Startbilder
missing = [f for f in FILES if not os.path.exists(os.path.join(root, f))]
assert not missing, missing
# Versionsnummer muss in App und Offline-Speicher stehen, sonst lädt das Handy das Update nicht
assert f"APP_VERSION = '{version}'" in open(os.path.join(root, 'app.js'), encoding='utf-8').read(), 'app.js: Version passt nicht'
assert f"'ringtagebuch-{version}'" in open(os.path.join(root, 'sw.js'), encoding='utf-8').read(), 'sw.js: Version passt nicht'
import json
assert json.load(open(os.path.join(root, 'version.json'), encoding='utf-8'))['version'] == version, 'version.json: Version passt nicht'
now = int(time.time())


def add_bytes(tar, name, data, mode=0o644):
    info = tarfile.TarInfo(name)
    info.size = len(data)
    info.mode = mode
    info.mtime = now
    info.uid = info.gid = 0
    info.uname = info.gname = 'root'
    tar.addfile(info, io.BytesIO(data))


def add_dir(tar, name, mode=0o755):
    info = tarfile.TarInfo(name)
    info.type = tarfile.DIRTYPE
    info.mode = mode
    info.mtime = now
    tar.addfile(info)


pkg = io.BytesIO()
with tarfile.open(fileobj=pkg, mode='w:gz') as t:
    add_dir(t, 'src')
    add_dir(t, 'src/splash')
    for f in FILES:
        add_bytes(t, 'src/' + f, open(os.path.join(root, f), 'rb').read())
pkg_bytes = pkg.getvalue()

desc = ('Tagebuch für NuvaRing und Endometriose: Symptome, Essen und Emotionen täglich festhalten und auswerten. '
        'Alle Gesundheitsdaten bleiben auf dem Handy. Nach der Installation im Browser http://IP-der-DiskStation/ringtagebuch/ öffnen.')
info = f'''package="ringtagebuch"
version="{version}-0001"
os_min_ver="7.2-64570"
displayname="Ringtagebuch"
description="{desc}"
description_ger="{desc}"
maintainer="Ringtagebuch"
arch="noarch"
thirdparty="yes"
install_dep_packages="WebStation"
checksum="{hashlib.md5(pkg_bytes).hexdigest()}"
'''


def icon(size):
    src = Image.open(os.path.join(root, 'icon-512.png')).convert('RGBA').resize((size * 4, size * 4), Image.LANCZOS)
    mask = Image.new('L', src.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, src.size[0] - 1, src.size[1] - 1], radius=int(src.size[0] * 0.2), fill=255)
    out = Image.new('RGBA', src.size, (0, 0, 0, 0))
    out.paste(src, (0, 0), mask)
    buf = io.BytesIO()
    out.resize((size, size), Image.LANCZOS).save(buf, 'PNG', optimize=True)
    return buf.getvalue()


os.makedirs(out_dir, exist_ok=True)
spk_path = os.path.join(out_dir, f'ringtagebuch-{version}.spk')
with tarfile.open(spk_path, 'w', format=tarfile.GNU_FORMAT) as t:
    add_bytes(t, 'INFO', info.encode('utf-8'))
    add_bytes(t, 'package.tgz', pkg_bytes)
    add_dir(t, 'conf')
    for name in ('privilege', 'resource'):
        add_bytes(t, 'conf/' + name, open(os.path.join(HERE, 'conf', name), 'rb').read())
    add_dir(t, 'scripts')
    for name in sorted(os.listdir(os.path.join(HERE, 'scripts'))):
        add_bytes(t, 'scripts/' + name, open(os.path.join(HERE, 'scripts', name), 'rb').read(), 0o755)
    add_bytes(t, 'PACKAGE_ICON.PNG', icon(64))
    add_bytes(t, 'PACKAGE_ICON_256.PNG', icon(256))
print(spk_path, os.path.getsize(spk_path), 'Bytes,', len(FILES), 'App-Dateien, Version', version)
