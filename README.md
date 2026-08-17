# Push Dashboard

Dashboard estático que visualiza el reporte de valoración de notificaciones push (`Copia de REPORTE_VALORACION_PUSH.xlsx`): score por app, por flujo, tendencia mensual y listado de comentarios.

## Estructura

- `index.html`, `assets/` — dashboard (HTML/CSS/JS, usa [Chart.js](https://www.chartjs.org/) vía CDN)
- `data/push_data.json` — datos exportados del Excel (generado, ver abajo)
- `Copia de REPORTE_VALORACION_PUSH.xlsx` — fuente de datos original

## Actualizar los datos

Cuando el Excel se actualice, regenerar `data/push_data.json`:

```bash
pip install openpyxl
python3 - <<'PY'
import openpyxl, json

wb = openpyxl.load_workbook('Copia de REPORTE_VALORACION_PUSH.xlsx', data_only=True)
ws = wb['Sheet 1']
data = []
for idv, user, app, tmpl, flow, score, instore, msg, fec, mes in ws.iter_rows(min_row=2, values_only=True):
    if idv is None:
        continue
    try:
        score_i = int(score) if score not in (None, '') else None
    except (ValueError, TypeError):
        score_i = None
    data.append({
        'id': idv, 'app': app, 'tmpl': tmpl, 'flow': flow,
        'score': score_i, 'msg': (msg or '').strip(),
        'date': fec.isoformat() if fec else None,
    })

with open('data/push_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
PY
```

## Publicar en GitHub Pages

Este repo incluye `.github/workflows/pages.yml`, que construye y despliega el sitio en cada push a `main`.

Para activarlo (una sola vez): **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Después de fusionar esta rama a `main`, el workflow se ejecutará automáticamente y publicará el dashboard.
