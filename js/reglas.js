// Reglas de la partida. Sin DOM ni red: lo ejecuta el navegador del anfitrión y se puede probar con Node.
import { PALABRAS, DIBUJOS } from './temas.js';

export const MIN_JUGADORES = 3, MAX_JUGADORES = 12;
export const COLORES = ['#ff5d5d', '#ffb703', '#8ac926', '#2ec4b6', '#4cc9f0', '#4d7cff', '#9b5de5', '#f15bb5', '#fb8500', '#b5e48c', '#e5989b', '#cdb4db'];
const MAX_PUNTOS = 30000; // por jugador y ronda

export const maxImpostores = (n) => Math.max(1, Math.min(3, Math.floor((n - 1) / 2)));
export const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]/g, '').replace(/\s+/g, ' ').trim();
export const plantilla = (frase) => frase.split(' ').map((p) => p[0] + '_'.repeat(Math.max(0, p.length - 1))).join(' ');
const limpiar = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const entero = (v, a, b, d) => (Number.isFinite(+v) ? Math.min(b, Math.max(a, Math.round(+v))) : d);

export function crearSala(azar = Math.random) {
  const S = {
    jugadores: [], fase: 'sala', ronda: 0, fin: 0, aviso: '',
    config: { modo: 'palabras', impostores: 1, segundos: 90, vueltas: 2, pista: true, adivinar: true },
    secreto: '', categoria: '', orden: [], turno: 0, pistas: [], dibujos: {}, listos: new Set(), votos: {}, resultado: null, usados: new Set(),
  };
  const J = (id) => S.jugadores.find((j) => j.id === id);
  const vivos = () => S.jugadores.filter((j) => j.enJuego && j.vivo);
  const barajar = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const k = Math.floor(azar() * (i + 1)); [b[i], b[k]] = [b[k], b[i]]; } return b; };
  const plazo = (seg) => { S.fin = Date.now() + seg * 1000; };

  function entrar(id, nombre) {
    const ya = J(id);
    if (ya) { ya.conectado = true; return { ok: true }; }
    if (S.jugadores.length >= MAX_JUGADORES) return { ok: false, motivo: 'La sala está llena (12 jugadores).' };
    let base = limpiar(nombre, 16) || 'Jugador', final = base, n = 2;
    while (S.jugadores.some((j) => normalizar(j.nombre) === normalizar(final))) final = `${base} ${n++}`;
    const color = COLORES.find((c) => !S.jugadores.some((j) => j.color === c)) || COLORES[0];
    S.jugadores.push({ id, nombre: final, color, conectado: true, enJuego: false, vivo: false, impostor: false, puntos: 0 });
    return { ok: true };
  }
  function salir(id) {
    const j = J(id); if (!j) return;
    if (S.fase === 'sala') S.jugadores = S.jugadores.filter((x) => x !== j);
    else { j.conectado = false; revisarAvance(); }
  }

  function nuevaRonda() {
    S.ronda++; S.pistas = []; S.dibujos = {}; S.listos = new Set(); S.votos = {}; S.resultado = null;
    const libres = (lista) => { let l = lista.filter((x) => !S.usados.has(x.s)); if (!l.length) { S.usados.clear(); l = lista; } return l[Math.floor(azar() * l.length)]; };
    const lista = S.config.modo === 'dibujo' ? DIBUJOS.map((s) => ({ s, c: 'Dibujo' }))
      : Object.entries(PALABRAS).flatMap(([c, ps]) => ps.map((s) => ({ s, c })));
    const t = libres(lista); S.secreto = t.s; S.categoria = t.c; S.usados.add(t.s);
    S.orden = barajar(vivos().map((j) => j.id)); S.turno = 0;
    S.fase = 'rol'; plazo(20);
  }
  function empezar() {
    const activos = S.jugadores.filter((j) => j.conectado);
    if (activos.length < MIN_JUGADORES) { S.aviso = `Faltan jugadores: mínimo ${MIN_JUGADORES}.`; return; }
    S.jugadores = activos; S.aviso = ''; S.ronda = 0;
    const n = activos.length, k = Math.min(S.config.impostores, maxImpostores(n));
    const elegidos = new Set(barajar(activos.map((j) => j.id)).slice(0, k));
    for (const j of S.jugadores) Object.assign(j, { enJuego: true, vivo: true, impostor: elegidos.has(j.id) });
    nuevaRonda();
  }
  function aJugar() {
    S.listos = new Set();
    if (S.config.modo === 'dibujo') { S.fase = 'dibujo'; plazo(S.config.segundos); }
    else { S.fase = 'turnos'; S.turno = 0; plazo(60); saltarAusentes(); }
  }
  const turnosTotales = () => S.orden.length * S.config.vueltas;
  const jugadorDeTurno = () => S.orden[S.turno % S.orden.length];
  function avanzarTurno() { S.turno++; if (S.turno >= turnosTotales()) aVotar(); else { plazo(60); saltarAusentes(); } }
  function saltarAusentes() { const j = J(jugadorDeTurno()); if (S.fase === 'turnos' && (!j || !j.conectado || !j.vivo)) avanzarTurno(); }
  function aVotar() { S.fase = 'voto'; S.votos = {}; plazo(90); }

  function contarVotos() {
    const cuenta = {};
    for (const v of Object.values(S.votos)) if (v) cuenta[v] = (cuenta[v] || 0) + 1;
    const orden = Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
    const saltos = Object.values(S.votos).filter((v) => !v).length;
    const fuera = orden.length && (orden.length === 1 || orden[0][1] > orden[1][1]) && orden[0][1] > saltos ? orden[0][0] : null;
    S.resultado = { votos: { ...S.votos }, fuera, eraImpostor: false, adivinanza: null, ganan: null };
    if (fuera) {
      const j = J(fuera); j.vivo = false; S.resultado.eraImpostor = j.impostor;
      for (const [quien, a] of Object.entries(S.votos)) if (a === fuera && j.impostor && J(quien) && !J(quien).impostor) J(quien).puntos += 1;
      if (j.impostor && S.config.adivinar && j.conectado) { S.fase = 'adivina'; plazo(40); return; }
    }
    cerrarRonda();
  }
  function cerrarRonda() {
    const v = vivos(), imp = v.filter((j) => j.impostor).length, resto = v.length - imp;
    let ganan = S.resultado.ganan;
    if (!ganan) { if (!imp) ganan = 'amigos'; else if (imp >= resto) ganan = 'impostores'; }
    S.resultado.ganan = ganan;
    if (ganan) for (const j of S.jugadores) if (j.enJuego && (ganan === 'impostores') === j.impostor) j.puntos += ganan === 'impostores' ? 3 : 1;
    S.fase = ganan ? 'fin' : 'resultado'; S.fin = 0;
  }

  // todos los que faltan ya actuaron (o se desconectaron)
  function revisarAvance() {
    const faltan = (hecho) => vivos().filter((j) => j.conectado && !hecho(j.id)).length;
    if (S.fase === 'rol' && !faltan((id) => S.listos.has(id))) aJugar();
    else if (S.fase === 'dibujo' && !faltan((id) => S.listos.has(id))) aVotar();
    else if (S.fase === 'voto' && !faltan((id) => id in S.votos)) contarVotos();
    else if (S.fase === 'turnos') saltarAusentes();
  }
  function tiempo() { // se llama cada segundo
    if (!S.fin || Date.now() < S.fin) return false;
    if (S.fase === 'rol') aJugar();
    else if (S.fase === 'turnos') { S.pistas.push({ id: jugadorDeTurno(), texto: '(sin pista)' }); avanzarTurno(); }
    else if (S.fase === 'dibujo') aVotar();
    else if (S.fase === 'voto') contarVotos();
    else if (S.fase === 'adivina') { S.resultado.adivinanza = ''; cerrarRonda(); }
    else return false;
    return true;
  }

  // acción de un jugador; devuelve true si cambió el estado
  function accion(id, m, esAnfitrion) {
    const j = J(id); if (!j || !m || typeof m.t !== 'string') return false;
    if (esAnfitrion) {
      if (m.t === 'config' && S.fase === 'sala') {
        const c = S.config, n = m.config || {};
        if (n.modo === 'palabras' || n.modo === 'dibujo') c.modo = n.modo;
        c.impostores = entero(n.impostores, 1, 3, c.impostores); c.segundos = entero(n.segundos, 30, 240, c.segundos); c.vueltas = entero(n.vueltas, 1, 4, c.vueltas);
        if (typeof n.pista === 'boolean') c.pista = n.pista; if (typeof n.adivinar === 'boolean') c.adivinar = n.adivinar;
        return true;
      }
      if (m.t === 'empezar' && S.fase === 'sala') { empezar(); return true; }
      if (m.t === 'siguiente' && S.fase === 'resultado') { nuevaRonda(); return true; }
      if (m.t === 'volver' && S.fase !== 'sala') { S.fase = 'sala'; S.fin = 0; S.jugadores = S.jugadores.filter((x) => x.conectado); for (const x of S.jugadores) Object.assign(x, { enJuego: false, vivo: false, impostor: false }); return true; }
      if (m.t === 'saltar' && ['rol', 'turnos', 'dibujo', 'voto', 'adivina'].includes(S.fase)) { S.fin = Date.now() - 1; return tiempo(); }
    }
    if (m.t === 'adivinar' && S.fase === 'adivina' && S.resultado.fuera === id) {
      const g = limpiar(m.texto, 60); S.resultado.adivinanza = g;
      if (normalizar(g) === normalizar(S.secreto)) S.resultado.ganan = 'impostores';
      cerrarRonda(); return true;
    }
    if (!j.enJuego || !j.vivo) return false;
    if (m.t === 'listo' && (S.fase === 'rol' || S.fase === 'dibujo')) { S.listos.add(id); revisarAvance(); return true; }
    if (m.t === 'pista' && S.fase === 'turnos' && jugadorDeTurno() === id) { S.pistas.push({ id, texto: limpiar(m.texto, 40) || '(dicha en voz alta)' }); avanzarTurno(); return true; }
    if (m.t === 'voto' && S.fase === 'voto' && !(id in S.votos)) {
      const a = m.a ? J(m.a) : null;
      if (m.a && (!a || !a.vivo || a.id === id)) return false;
      S.votos[id] = a ? a.id : null; revisarAvance(); return true;
    }
    return false;
  }

  // trazos de dibujo: devuelve la operación saneada para reenviarla, o null
  function trazo(id, m) {
    const j = J(id); if (S.fase !== 'dibujo' || !j || !j.vivo || S.listos.has(id)) return null;
    const d = (S.dibujos[id] ||= []);
    if (m.op === 'borrar') { d.length = 0; return { op: 'borrar' }; }
    if (m.op === 'deshacer') { d.pop(); return { op: 'deshacer' }; }
    if (m.op !== 'puntos' || !Array.isArray(m.p) || m.p.length < 2 || m.p.length > 600 || m.p.length % 2) return null;
    if (d.reduce((s, t) => s + t.p.length, 0) > MAX_PUNTOS) return null;
    const p = m.p.map((v) => entero(v, 0, 1000, 0));
    const c = /^#[0-9a-f]{6}$/i.test(m.c) ? m.c : '#111111', w = entero(m.w, 2, 60, 8), n = entero(m.n, 0, 1e9, 0);
    let t = d[d.length - 1];
    if (!t || t.n !== n) { t = { n, c, w, p: [] }; d.push(t); }
    t.p.push(...p);
    return { op: 'puntos', n, c: t.c, w: t.w, p };
  }

  // lo que puede ver cada jugador (nunca se envían secretos ajenos)
  function vista(id) {
    const j = J(id), fin = S.fase === 'fin', conoce = fin || (j && j.enJuego && !j.impostor) || (S.fase === 'resultado' && j && !j.impostor);
    const verDibujos = ['dibujo', 'voto', 'adivina', 'resultado', 'fin'].includes(S.fase);
    return {
      fase: S.fase, ronda: S.ronda, aviso: S.aviso, config: { ...S.config }, resta: S.fin ? Math.max(0, S.fin - Date.now()) : 0,
      jugadores: S.jugadores.map((x) => ({ id: x.id, nombre: x.nombre, color: x.color, conectado: x.conectado, enJuego: x.enJuego, vivo: x.vivo, puntos: x.puntos,
        impostor: fin || (!x.vivo && x.enJuego) || (j && j.impostor && x.impostor) ? x.impostor : null, listo: S.listos.has(x.id), voto: x.id in S.votos })),
      yo: j ? { id, enJuego: j.enJuego, vivo: j.vivo, impostor: j.impostor, voto: S.votos[id] } : null,
      secreto: S.fase === 'sala' ? null : conoce ? S.secreto : null,
      plantilla: S.fase !== 'sala' && j && j.impostor && S.config.modo === 'dibujo' ? plantilla(S.secreto) : null,
      categoria: S.fase !== 'sala' && S.config.modo === 'palabras' && (conoce || S.config.pista) ? S.categoria : null,
      turno: S.fase === 'turnos' ? { id: jugadorDeTurno(), n: S.turno + 1, de: turnosTotales() } : null,
      pistas: S.pistas, dibujos: verDibujos ? structuredClone(S.dibujos) : {},
      resultado: ['adivina', 'resultado', 'fin'].includes(S.fase) ? S.resultado : null,
    };
  }
  return { S, entrar, salir, accion, trazo, tiempo, vista };
}
