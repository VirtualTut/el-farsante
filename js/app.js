// Pantallas. Todo el texto de jugadores se pinta con textContent (nunca como HTML).
import { crearAnfitrion, unirse } from './red.js';
import { crearLienzo, pintar, aplicar } from './lienzo.js';
import { MIN_JUGADORES, maxImpostores } from './reglas.js';

const raiz = document.getElementById('app');
const h = (tag, props = {}, ...hijos) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (v !== false && v != null) e[k] = v;
  }
  for (const c of hijos.flat()) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : String(c));
  return e;
};

let con = null, V = null, finLocal = 0, clave = '', miniaturas = {}, lienzo = null;
const J = (id) => V.jugadores.find((j) => j.id === id);
const ficha = (j, extra) => h('span', { class: 'ficha' + (j.enJuego && !j.vivo ? ' fuera' : '') + (j.conectado ? '' : ' ausente') }, h('i', { style: `background:${j.color}` }), j.nombre + (V && j.id === V.yo?.id ? ' (tú)' : ''), extra || null);
const boton = (texto, alPulsar, clase = '') => h('button', { class: clase, type: 'button', onclick: alPulsar }, texto);

function inicio(error) {
  con?.cerrar(); con = null; V = null; clave = '';
  const nombre = h('input', { placeholder: 'Tu nombre', maxLength: 16, value: localStorage.getItem('farsante-nombre') || '', autocomplete: 'nickname' });
  const codigo = h('input', { placeholder: 'Código de sala', maxLength: 5, class: 'codigo', value: (new URLSearchParams(location.search).get('sala') || '').toUpperCase(), autocomplete: 'off' });
  const msg = h('p', { class: 'error' }, error || '');
  const conectar = async (fn, btn) => {
    const n = nombre.value.trim(); if (!n) { msg.textContent = 'Escribe tu nombre.'; nombre.focus(); return; }
    localStorage.setItem('farsante-nombre', n); msg.textContent = 'Conectando…'; btn.disabled = true;
    try { con = await fn(n); if (!con.anfitrion) history.replaceState(null, '', '?sala=' + con.codigo); pedirPantallaEncendida(); render(); } catch (e) { msg.textContent = e.message; btn.disabled = false; }
  };
  const manejadores = { alEstado: (v) => { if (v.fase === 'dibujo' && V?.fase === 'dibujo' && V.ronda === v.ronda && v.yo && V.dibujos[v.yo.id]) v.dibujos[v.yo.id] = V.dibujos[v.yo.id]; V = v; finLocal = Date.now() + v.resta; if (con) render(); }, alTrazo: (de, op) => { if (V) { aplicar((V.dibujos[de] ||= []), op); if (miniaturas[de]) pintar(miniaturas[de], V.dibujos[de]); } }, alError: (m) => inicio(m) };
  const bCrear = boton('Crear sala', () => conectar((n) => crearAnfitrion(n, manejadores), bCrear), 'principal');
  const bUnir = boton('Entrar', () => { const c = codigo.value.trim().toUpperCase(); if (c.length !== 5) { msg.textContent = 'El código tiene 5 letras o números.'; return; } conectar((n) => unirse(c, n, manejadores), bUnir); }, 'principal');
  codigo.addEventListener('keydown', (e) => { if (e.key === 'Enter') bUnir.click(); });
  raiz.replaceChildren(
    h('header', { class: 'portada' }, h('div', { class: 'logo' }, '🎭'), h('h1', {}, 'El Farsante'), h('p', {}, 'Todos conocen el secreto menos uno. Descúbranlo… o que no te descubran.')),
    h('section', { class: 'caja' }, nombre, codigo.value ? null : bCrear),
    h('section', { class: 'caja' }, h('h2', {}, codigo.value ? 'Te invitaron a una sala' : '¿Te invitaron?'), codigo, bUnir, codigo.value ? boton('Mejor crear mi sala', () => { history.replaceState(null, '', location.pathname); inicio(); }, 'suave') : null),
    msg,
    h('details', { class: 'caja' }, h('summary', {}, 'Cómo se juega'),
      h('ul', {}, h('li', {}, 'De 3 a 12 jugadores. Cada uno en su celular o PC.'), h('li', {}, 'Palabras: por turnos, den una pista corta sin delatar la palabra. El farsante finge.'), h('li', {}, 'Dibujo: todos dibujan el mismo tema a la vez; el farsante solo ve las primeras letras y mira los dibujos ajenos.'), h('li', {}, 'Voten. Quien tenga más votos queda fuera. Si cae el farsante, aún puede ganar adivinando el secreto.'), h('li', {}, 'Para hablar usen su llamada de siempre.'))));
}

function cabecera() {
  return h('div', { class: 'barra' }, h('b', {}, '🎭 Sala ' + con.codigo), h('span', { id: 'reloj' }, ''), boton('Salir', () => { if (confirm(con.anfitrion ? 'Si sales, la sala se cierra para todos. ¿Salir?' : '¿Salir de la sala?')) inicio(); }, 'suave'));
}
function tarjetaSecreto() {
  const dib = V.config.modo === 'dibujo';
  if (!V.yo?.enJuego) return h('div', { class: 'secreto' }, h('small', {}, 'Estás mirando'), h('strong', {}, 'Juegas en la próxima partida'));
  if (V.yo.impostor) return h('div', { class: 'secreto farsante' }, h('small', {}, 'Eres el FARSANTE'), h('strong', { class: dib ? 'huecos' : '' }, dib ? V.plantilla : '¡Disimula!'), V.categoria ? h('small', {}, 'Pista: ' + V.categoria) : null);
  return h('div', { class: 'secreto' }, h('small', {}, dib ? 'Dibuja' : 'La palabra es' + (V.categoria ? ' · ' + V.categoria : '')), h('strong', {}, V.secreto || ''));
}
function galeria(votable) {
  miniaturas = {};
  return h('div', { class: 'galeria' }, V.jugadores.filter((j) => j.enJuego && (j.vivo || V.dibujos[j.id])).map((j) => {
    const cv = h('canvas', { width: 500, height: 500 }); miniaturas[j.id] = cv; pintar(cv, V.dibujos[j.id] || []);
    return h('figure', {}, cv, h('figcaption', {}, ficha(j)), votable && j.vivo && j.id !== V.yo.id ? votable(j) : null);
  }));
}
const listaPistas = () => V.pistas.length ? h('ol', { class: 'pistas' }, V.pistas.map((p) => h('li', {}, J(p.id) ? ficha(J(p.id)) : '¿?', h('span', {}, p.texto)))) : null;
const esperando = (txt) => h('p', { class: 'espera' }, txt);
const saltar = () => con.anfitrion ? boton('Anfitrión: pasar a lo siguiente', () => con.enviar({ t: 'saltar' }), 'suave') : null;

const PANTALLAS = {
  sala() {
    const c = V.config, n = V.jugadores.length;
    const enlace = location.origin + location.pathname + '?sala=' + con.codigo;
    const campo = (texto, control) => h('label', {}, h('span', {}, texto), control);
    const selector = (k, opciones) => { const s = h('select', { disabled: !con.anfitrion, onchange: (e) => con.enviar({ t: 'config', config: { [k]: typeof c[k] === 'boolean' ? e.target.value === 'true' : typeof c[k] === 'number' ? +e.target.value : e.target.value } }) }, opciones.map(([v, t]) => h('option', { value: String(v) }, t))); s.value = String(c[k]); return s; };
    return [
      h('section', { class: 'caja centro' }, h('small', {}, 'Código de sala'), h('div', { class: 'grande' }, con.codigo),
        boton('Compartir invitación', async (e) => { const b = e.target; try { if (navigator.share) await navigator.share({ title: 'El Farsante', url: enlace }); else { await navigator.clipboard.writeText(enlace); b.textContent = '¡Enlace copiado!'; } } catch { prompt('Copia el enlace:', enlace); } }, 'principal')),
      h('section', { class: 'caja' }, h('h2', {}, `Jugadores (${n}/12)`), h('div', { class: 'fichas' }, V.jugadores.map((j) => ficha(j)))),
      h('section', { class: 'caja' }, h('h2', {}, 'Partida'),
        campo('Versión', selector('modo', [['palabras', 'Palabras'], ['dibujo', 'Dibujo']])),
        campo('Farsantes', selector('impostores', [1, 2, 3].filter((k) => k <= maxImpostores(Math.max(n, MIN_JUGADORES)) || k === c.impostores).map((k) => [k, k]))),
        c.modo === 'dibujo' ? campo('Tiempo para dibujar', selector('segundos', [[45, '45 s'], [60, '1 min'], [90, '1 min 30'], [120, '2 min'], [180, '3 min']])) : campo('Vueltas de pistas', selector('vueltas', [1, 2, 3, 4].map((k) => [k, k]))),
        c.modo === 'palabras' ? campo('El farsante ve la categoría', selector('pista', [[true, 'Sí'], [false, 'No']])) : null,
        campo('Si lo atrapan, puede adivinar', selector('adivinar', [[true, 'Sí'], [false, 'No']])),
        c.impostores > maxImpostores(Math.max(n, MIN_JUGADORES)) ? h('small', {}, `Con ${n} jugadores habrá ${maxImpostores(Math.max(n, MIN_JUGADORES))}.`) : null),
      V.aviso ? h('p', { class: 'error' }, V.aviso) : null,
      con.anfitrion ? h('button', { class: 'principal enorme', disabled: n < MIN_JUGADORES, onclick: () => con.enviar({ t: 'empezar' }) }, n < MIN_JUGADORES ? `Faltan ${MIN_JUGADORES - n}` : 'Empezar') : esperando('Esperando a que el anfitrión empiece…'),
      con.anfitrion ? h('small', { class: 'nota' }, 'Eres el anfitrión: deja esta pantalla abierta y encendida.') : null,
    ];
  },
  rol() {
    const yo = J(V.yo?.id);
    return [h('h2', {}, 'Ronda ' + V.ronda + ': mira en secreto'), tarjetaSecreto(),
      V.yo?.vivo ? (yo?.listo ? esperando('Esperando a los demás…') : boton('Listo', () => con.enviar({ t: 'listo' }), 'principal enorme')) : esperando('Estás fuera: puedes mirar.'), saltar()];
  },
  turnos() {
    const j = J(V.turno.id), mio = V.turno.id === V.yo?.id;
    const entrada = h('input', { placeholder: 'Tu pista (una o dos palabras)', maxLength: 40, id: 'pista' });
    const enviar = () => con.enviar({ t: 'pista', texto: entrada.value });
    entrada.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); });
    return [tarjetaSecreto(), h('h2', {}, mio ? '¡Es tu turno!' : `Turno de ${j?.nombre}`), h('small', {}, `Pista ${V.turno.n} de ${V.turno.de}`),
      mio ? h('section', { class: 'caja' }, entrada, boton('Enviar pista', enviar, 'principal'), h('small', {}, 'Si la dices en voz alta, envíala vacía.')) : null, listaPistas(), saltar()];
  },
  dibujo() {
    const yo = J(V.yo?.id), dibujando = V.yo?.vivo && !yo.listo;
    if (dibujando) { lienzo ||= crearLienzo((m) => { const mios = (V.dibujos[V.yo.id] ||= []); aplicar(mios, m); lienzo.cargar(mios); con.enviar({ t: 'trazo', ...m }); if (miniaturas[V.yo.id]) pintar(miniaturas[V.yo.id], mios); }); lienzo.cargar((V.dibujos[V.yo.id] ||= [])); }
    return [tarjetaSecreto(), dibujando ? lienzo.nodo : esperando(V.yo?.vivo ? 'Dibujo entregado. Mira a los demás.' : 'Estás fuera: puedes mirar.'),
      dibujando ? boton('Terminé mi dibujo', () => con.enviar({ t: 'listo' }), 'principal') : null,
      h('h2', {}, 'Dibujos en vivo'), galeria(), saltar()];
  },
  voto() {
    const ya = Boolean(V.yo && J(V.yo.id)?.voto), puedo = V.yo?.vivo && !ya;
    const bVotar = (j) => puedo ? boton('Votar', () => con.enviar({ t: 'voto', a: j.id }), 'principal') : V.yo?.voto === j.id ? h('b', { class: 'marcado' }, 'Tu voto') : null;
    const vivos = V.jugadores.filter((j) => j.vivo);
    return [h('h2', {}, '¿Quién es el farsante?'), h('small', {}, `Han votado ${vivos.filter((j) => j.voto).length} de ${vivos.length}`), tarjetaSecreto(),
      V.config.modo === 'dibujo' ? galeria(bVotar) : h('div', {}, listaPistas(), h('div', { class: 'votos' }, vivos.filter((j) => j.id !== V.yo?.id).map((j) => h('div', { class: 'fila' }, ficha(j), bVotar(j))))),
      puedo ? boton('No votar a nadie', () => con.enviar({ t: 'voto', a: null }), 'suave') : ya ? esperando('Voto enviado. Esperando…') : esperando('Estás fuera: no votas.'), saltar()];
  },
  adivina() {
    const j = J(V.resultado.fuera), mio = V.yo?.id === j.id;
    const entrada = h('input', { placeholder: V.config.modo === 'dibujo' ? 'Escribe el tema completo' : '¿Cuál era la palabra?', maxLength: 60, id: 'adivina' });
    const enviar = () => con.enviar({ t: 'adivinar', texto: entrada.value });
    entrada.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); });
    return [h('h2', {}, `¡Atraparon a ${j.nombre}!`), mio ? h('section', { class: 'caja' }, h('p', {}, 'Última oportunidad: si adivinas el secreto, ganan los farsantes.'), V.plantilla ? h('div', { class: 'secreto farsante' }, h('strong', { class: 'huecos' }, V.plantilla)) : null, entrada, boton('Adivinar', enviar, 'principal')) : esperando('El farsante está intentando adivinar el secreto…'), saltar()];
  },
  resultado: () => resumen(false),
  fin: () => resumen(true),
};

function resumen(final) {
  const r = V.resultado, j = r.fuera ? J(r.fuera) : null;
  const titulo = final ? (r.ganan === 'amigos' ? '¡Ganan los amigos! 🎉' : '¡Ganan los farsantes! 🎭') : j ? (r.eraImpostor ? `${j.nombre} era farsante` : `${j.nombre} NO era farsante`) : 'Nadie queda fuera';
  return [h('h2', { class: 'titular' }, titulo),
    final && j ? h('p', {}, `${j.nombre} quedó fuera y ${r.eraImpostor ? 'sí' : 'no'} era farsante.`) : null,
    r.adivinanza ? h('p', {}, `Su intento: «${r.adivinanza}»`) : null,
    final ? h('div', { class: 'secreto' }, h('small', {}, 'El secreto era'), h('strong', {}, V.secreto)) : h('p', {}, 'Todavía queda al menos un farsante.'),
    h('section', { class: 'caja' }, h('h2', {}, 'Votos'), h('ul', { class: 'pistas' }, Object.entries(r.votos).map(([a, b]) => h('li', {}, J(a) ? ficha(J(a)) : '¿?', h('span', {}, '→ ' + (b && J(b) ? J(b).nombre : 'a nadie')))))),
    final ? h('section', { class: 'caja' }, h('h2', {}, 'Puntos'), h('ul', { class: 'pistas' }, [...V.jugadores].sort((a, b) => b.puntos - a.puntos).map((x) => h('li', {}, ficha(x, x.impostor ? h('em', {}, ' farsante') : null), h('span', {}, String(x.puntos)))))) : null,
    V.config.modo === 'dibujo' ? galeria() : listaPistas(),
    con.anfitrion ? boton(final ? 'Otra partida' : 'Siguiente ronda', () => con.enviar({ t: final ? 'volver' : 'siguiente' }), 'principal enorme') : esperando('Esperando al anfitrión…')];
}

// Solo se redibuja la pantalla cuando cambia algo visible; durante el dibujo no se pierde el trazo ni lo escrito.
function render() {
  if (!con || !V) return;
  const k = JSON.stringify({ ...V, resta: 0, dibujos: V.fase === 'dibujo' ? 0 : Object.keys(V.dibujos) });
  if (k === clave) return;
  const mismaFase = clave && JSON.parse(clave).fase === V.fase && JSON.parse(clave).ronda === V.ronda;
  clave = k;
  if (V.fase !== 'dibujo') lienzo = null;
  const campo = document.activeElement?.tagName === 'INPUT' ? { id: document.activeElement.id, v: document.activeElement.value } : null;
  const y = window.scrollY;
  miniaturas = {};
  raiz.replaceChildren(cabecera(), ...PANTALLAS[V.fase]().filter(Boolean));
  if (campo?.id) { const e = document.getElementById(campo.id); if (e) { e.value = campo.v; e.focus(); } }
  window.scrollTo(0, mismaFase ? y : 0);
  reloj();
}
function reloj() { const e = document.getElementById('reloj'); if (!e || !V) return; const s = V.resta ? Math.max(0, Math.ceil((finLocal - Date.now()) / 1000)) : 0; e.textContent = V.resta ? '⏱ ' + s + ' s' : ''; e.classList.toggle('urge', s > 0 && s <= 10); }
setInterval(reloj, 250);
async function pedirPantallaEncendida() { try { await navigator.wakeLock?.request('screen'); } catch { /* no disponible */ } }
document.addEventListener('visibilitychange', () => { if (!document.hidden && con) pedirPantallaEncendida(); });
window.addEventListener('beforeunload', (e) => { if (con) { e.preventDefault(); e.returnValue = ''; } });

if (typeof Peer === 'undefined') raiz.replaceChildren(h('p', { class: 'error' }, 'No se pudo cargar el juego. Revisa tu internet y recarga.'));
else inicio();
