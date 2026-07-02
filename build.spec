# PyInstaller spec for RaceVision backend
# Run via: pyinstaller build.spec --distpath backend-dist --workpath build-tmp --noconfirm

from PyInstaller.utils.hooks import collect_all, collect_submodules

block_cipher = None

# Collect all submodules + data for packages with dynamic imports
uvicorn_datas,   uvicorn_bins,   uvicorn_hidden   = collect_all('uvicorn')
ws_datas,        ws_bins,        ws_hidden        = collect_all('websockets')
fastapi_datas,   fastapi_bins,   fastapi_hidden   = collect_all('fastapi')
starlette_datas, starlette_bins, starlette_hidden = collect_all('starlette')

a = Analysis(
    ['backend/main.py'],
    pathex=['.'],
    binaries=uvicorn_bins + ws_bins + fastapi_bins + starlette_bins,
    datas=(
        uvicorn_datas + ws_datas + fastapi_datas + starlette_datas +
        [('backend/data', 'backend/data')]
    ),
    hiddenimports=(
        uvicorn_hidden + ws_hidden + fastapi_hidden + starlette_hidden + [
            'anyio',
            'anyio._backends._asyncio',
            'anyio._backends._trio',
            'h11',
            'h11._readers',
            'h11._writers',
            'irsdk',
            'pydantic',
            'pydantic_core',
            'pydantic.deprecated.class_validators',
            'sqlite3',
            'xml.etree.ElementTree',
            'email.mime.multipart',
            'email.mime.text',
            'pkg_resources',
        ]
    ),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='racevision-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='racevision-backend',
)
