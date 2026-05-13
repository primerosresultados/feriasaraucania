# Revisión móvil: Tendencias e Insertado

Doc de trabajo para decidir qué commits recientes mantener / revertir / iterar.
Contexto de la conversación: en móvil, el insertado se ve "más o menos" y la
sección Tendencias es difícil de usar (elementos se superponen, no se entiende
bien) — especialmente al querer ver toda la temporada × todas las categorías.

---

## 1. Cambios recientes en juego

Commits en `main` relacionados con Tendencias o layout móvil (más nuevo arriba):

| Commit | Título | Área | Estado sugerido |
|---|---|---|---|
| `41587fe` | Trends year level: keep all years; render filled-area chart on desktop | Tendencias (año) | **Mantener** — el área rellena en desktop ayuda; en móvil no aplica. |
| `9a51d98` | Trends: clean tooltip with sorted prices on hover/tap | Tendencias (tooltip) | **Mantener** — el tooltip ordenado es mejor que el default. *Pero*: en móvil sigue tapando medio chart. Iterar (ver Alt. D). |
| `de94638` | Trends: hide points with no data for visible categories | Tendencias (puntos) | **Mantener** — evita huecos visuales. |
| `3897fa3` | Trends: enable click drill via invisible Tooltip + activeDot; mobile legend in 2 columns | Tendencias (drill + leyenda) | **Iterar** — leyenda en 2 cols mejoró respecto del wrap, pero con 9-10 categorías sigue ocupando 5 filas y compite con el chart. Drill por activeDot en móvil tiene área tocable muy chica. |
| `9e305ee` | Filters: stack as 2-col grid on mobile so labels don't truncate | Filtros (header) | **Mantener** — el grid 2-col resolvió el truncado. |
| `085d011` | Trends: year→month→day drill (skip week); mobile-aware x-axis | Tendencias (drill) | **Mantener** — saltar semana fue correcto. |
| `1900f92` | Trends: drill into specific week range; remove 'Ver tabla' button | Tendencias | **Revisar** — quitar "Ver tabla" deja al móvil sin escape al modo denso. Si vamos por Alt. B (tabla pivote), restaurar como toggle. |
| `4483cdc` | Trends chart: click-to-drill restored, no tooltip popup | Tendencias | **Mantener** — drill es la interacción principal. |
| `d44e820` | Trends chart: zoom level selector instead of click-to-drill, no tooltip popup | Tendencias | **Iterar** — el selector "Zoom: Año Mes Sem Día" + breadcrumb ocupan 2-3 filas en móvil. Reemplazable por un stepper compacto (ver Alt. B de Tendencias). |
| `71c2434` | Trends chart: drill-down by year/month/week/day + tighter paddings | Tendencias | **Mantener** — el drill multinivel está bien conceptualmente. |
| `31bf953` | Trends chart: milestone-based view with full-period detail modal, no horizontal scroll | Tendencias | **Mantener** — eliminar scroll horizontal fue una mejora real. |
| `031dc4b` | Trends chart: horizontal scroll on mobile, external wrap-friendly legend | Tendencias | Ya revertido por `31bf953`. |

Nada en `widget-view.tsx` es controvertido en sí mismo — el problema es **acumulativo**:
cada cambio agrega un control (zoom, breadcrumb, leyenda 2-col, área…) y juntos
saturan la viewport móvil antes de mostrar datos.

---

## 2. Pain points concretos en móvil (≤ 400 px)

### Insertado (tab "Listado de Precios")
- Tipografía `text-lg` siempre (incluso en móvil) → tabla enorme, mucho scroll horizontal.
- 9 columnas (Categoría · Cabezas · Peso Prom · Precio 1-5 · Prom Gral) → hay que arrastrar para llegar a Prom Gral.
- La columna sticky de Categoría funciona pero los precios 2-5 quedan fuera de pantalla.

### Tendencias (tab "Tendencias")
- Antes del chart hay: breadcrumb (1 fila) + selector Zoom + botón Restablecer (1 fila) + chart + leyenda 2-col (≈5 filas con 10 categorías). El chart vive en una franja chica.
- Con 9-10 series, las líneas se cruzan = spaghetti ilegible.
- Labels X rotados a -45° se pisan cuando hay >6 puntos.
- `activeDot` r=7 es chico para dedo; tap accidental en zona vacía no hace nada.
- Tooltip flotante tapa la mitad del chart al tocarlo.
- **Caso roto principal:** "ver toda la temporada × todas las categorías" es estructuralmente imposible en 360 px con líneas.

---

## 3. Alternativas propuestas

### Insertado
- **A. Tabla compacta** — bajar fuente, reducir a 4 cols visibles (Categoría · Cabezas · Top · Prom), el resto al modal de detalle.
- **B. Cards apiladas** (recomendada) — una card por categoría, render distinto < 640 px.
- **C. Tabla swipeable** — paginar columnas en vez de scroll bruto.

### Tendencias
Para el caso "una categoría a la vez":
- **A1. Una serie a la vez con chips** — multi-select de hasta 2-3, leyenda desaparece.
- **B1. Stepper compacto** reemplaza zoom + breadcrumb.

Para el caso "toda la temporada × todas las categorías" (el que motivó esta revisión):
- **A2. Heatmap mensual** (recomendada) — filas=categorías × cols=meses, color=precio. Cabe completo en móvil, patrón estacional visible, cero overlap.
- **B2. Tabla pivote densa** (categoría × mes con números) — restaurar "Ver tabla" como toggle del heatmap.
- **C2. Small multiples** — 1 mini-chart por categoría, apilados verticalmente.
- **D2. Top-3 + "otros"** — mostrar solo las 3 categorías de mayor volumen, botón a modal pantalla completa.
- **E2. Modal landscape forzado** — botón "ver pantalla completa" que rota a horizontal. Parche barato.

---

## 4. Recomendación

Combinación mínima que destraba todo:

1. **Insertado:** alternativa **B** (cards en < 640 px). El componente actual queda 1:1 en desktop.
2. **Tendencias:** **A2 (heatmap)** como vista por defecto en móvil + **B2 (tabla pivote)** detrás de toggle "Ver datos". El chart de líneas actual permanece solo en desktop.
3. **Stepper (B1)** opcional para limpiar la barra superior. No urgente.

**Qué se revierte:** nada de forma directa. El gráfico de líneas se mantiene en
desktop; lo que cambia es **agregar** una vista distinta para móvil. Si decidimos
no hacer A2/B2, sí podría revertirse `1900f92` para devolver el botón "Ver tabla"
como salida de emergencia en móvil.

---

## 5. Decisión pendiente

- [ ] ¿Cards en insertado móvil? (Alt. B)
- [ ] ¿Heatmap como vista por defecto de Tendencias en móvil? (Alt. A2)
- [ ] ¿Restaurar "Ver tabla" como toggle? (revertir parcial de `1900f92`)
- [ ] ¿Reemplazar zoom+breadcrumb por stepper? (Alt. B1)
- [ ] ¿Algún commit a revertir de forma quirúrgica?
