// Lienzo de dibujo. Coordenadas 0–1000 para que se vea igual en celular y PC.
const PALETA = ['#111111', '#e63946', '#fb8500', '#ffd60a', '#2a9d3a', '#1d6fe8', '#7b2cbf', '#8d5524', '#ffffff'];

export function aplicar(trazos, op) {
  if (op.op === 'borrar') trazos.length = 0;
  else if (op.op === 'deshacer') trazos.pop();
  else { let t = trazos[trazos.length - 1]; if (!t || t.n !== op.n) { t = { n: op.n, c: op.c, w: op.w, p: [] }; trazos.push(t); } t.p.push(...op.p); }
}
export function pintar(cv, trazos) {
  const g = cv.getContext('2d'), k = cv.width / 1000;
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const t of trazos) {
    g.strokeStyle = t.c; g.lineWidth = t.w * k; g.beginPath(); g.moveTo(t.p[0] * k, t.p[1] * k);
    if (t.p.length === 2) g.lineTo(t.p[0] * k + .1, t.p[1] * k);
    for (let i = 2; i < t.p.length; i += 2) g.lineTo(t.p[i] * k, t.p[i + 1] * k);
    g.stroke();
  }
}

export function crearLienzo(enviar) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1000; cv.className = 'lienzo';
  let trazos = [], color = PALETA[0], grosor = 10, activo = null, pendiente = [], n = Date.now() % 100000000, temporizador = 0;
  const punto = (e) => { const r = cv.getBoundingClientRect(); return [Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 1000), Math.round(Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) * 1000)]; };
  // `enviar` aplica la operación a la lista propia (la misma que `trazos`) y la manda a los demás
  const soltar = () => { clearTimeout(temporizador); temporizador = 0; if (!pendiente.length || activo === null) return; enviar({ op: 'puntos', n: activo.n, c: activo.c, w: activo.w, p: pendiente.splice(0, 600) }); pintar(cv, trazos); };
  const previa = (a, b) => { const g = cv.getContext('2d'); g.strokeStyle = activo.c; g.lineWidth = activo.w; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
  let ultimo = null;
  cv.addEventListener('pointerdown', (e) => { if (activo) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); activo = { id: e.pointerId, n: ++n, c: color, w: grosor }; ultimo = punto(e); pendiente.push(...ultimo); previa(ultimo, [ultimo[0] + .1, ultimo[1]]); soltar(); });
  cv.addEventListener('pointermove', (e) => { if (!activo || e.pointerId !== activo.id) return; e.preventDefault(); const p = punto(e); if (Math.abs(p[0] - ultimo[0]) + Math.abs(p[1] - ultimo[1]) < 3) return; previa(ultimo, p); ultimo = p; pendiente.push(...p); if (!temporizador) temporizador = setTimeout(soltar, 80); });
  const fin = (e) => { if (!activo || e.pointerId !== activo.id) return; soltar(); activo = null; };
  cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin); cv.addEventListener('lostpointercapture', fin);

  const nodo = document.createElement('div'); nodo.className = 'tablero';
  const colores = document.createElement('div'); colores.className = 'herramientas';
  const marcar = () => { for (const b of colores.querySelectorAll('[data-c]')) b.classList.toggle('sel', b.dataset.c === color); for (const b of utiles.querySelectorAll('[data-w]')) b.classList.toggle('sel', +b.dataset.w === grosor); };
  for (const c of PALETA) { const b = document.createElement('button'); b.type = 'button'; b.dataset.c = c; b.style.background = c; b.className = 'color'; b.title = c === '#ffffff' ? 'Borrador' : 'Color'; if (c === '#ffffff') b.textContent = '⌫'; b.onclick = () => { color = c; marcar(); }; colores.append(b); }
  const utiles = document.createElement('div'); utiles.className = 'herramientas';
  for (const [w, t] of [[5, '•'], [10, '●'], [28, '⬤']]) { const b = document.createElement('button'); b.type = 'button'; b.dataset.w = w; b.textContent = t; b.onclick = () => { grosor = w; marcar(); }; utiles.append(b); }
  for (const [op, t] of [['deshacer', '↶ Deshacer'], ['borrar', '🗑 Borrar todo']]) { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = () => { if (activo) return; enviar({ op }); pintar(cv, trazos); }; utiles.append(b); }
  nodo.append(cv, colores, utiles); marcar();
  return { nodo, cargar(lista) { trazos = lista; if (!activo) pintar(cv, trazos); } };
}
