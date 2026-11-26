// Conexión entre navegadores (PeerJS/WebRTC). El anfitrión ejecuta las reglas; los demás envían acciones.
import { crearSala } from './reglas.js';

const PREFIJO = 'elfarsante-v1-';
const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const codigoNuevo = () => Array.from(crypto.getRandomValues(new Uint32Array(5)), (n) => LETRAS[n % LETRAS.length]).join('');

// Clave privada para volver a entrar (los demás jugadores nunca la ven).
export function idPropio() {
  let id = sessionStorage.getItem('farsante-id');
  if (!id) { id = 'j' + Array.from(crypto.getRandomValues(new Uint8Array(9)), (n) => n.toString(36)).join(''); sessionStorage.setItem('farsante-id', id); }
  return id;
}

export function crearAnfitrion(nombre, { alEstado, alTrazo, alError }, intento = 0) {
  return new Promise((listo, fallo) => {
    const codigo = codigoNuevo(), peer = new Peer(PREFIJO + codigo, { debug: 1 });
    const t = setTimeout(() => { peer.destroy(); fallo(new Error('No se pudo conectar con el servidor de salas. Revisa tu internet.')); }, 15000);
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && intento < 4) { clearTimeout(t); peer.destroy(); crearAnfitrion(nombre, { alEstado, alTrazo, alError }, intento + 1).then(listo, fallo); return; }
      if (!peer.open) { clearTimeout(t); fallo(new Error('No se pudo crear la sala (' + e.type + ').')); } else console.warn(e.type);
    });
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    peer.on('open', () => {
      clearTimeout(t);
      const sala = crearSala(), clavePropia = idPropio(), yo = 'p' + codigoNuevo() + '0', conexiones = new Map(), publicos = new Map();
      sala.entrar(yo, nombre);
      const difundir = () => { alEstado(sala.vista(yo)); for (const [id, c] of conexiones) if (c.open) c.send({ t: 'estado', v: sala.vista(id) }); };
      const reenviar = (de, op) => { if (de !== yo) alTrazo(de, op); for (const [id, c] of conexiones) if (id !== de && c.open) c.send({ t: 'trazo', de, op }); };
      peer.on('connection', (c) => {
        let id = null;
        c.on('data', (m) => {
          if (!m || typeof m.t !== 'string') return;
          if (!id) {
            if (m.t !== 'hola' || typeof m.id !== 'string' || m.id.length > 40 || m.id === clavePropia) return;
            const publico = publicos.get(m.id) || 'p' + codigoNuevo() + (publicos.size + 1);
            const anterior = conexiones.get(publico); conexiones.delete(publico); anterior?.close();
            const r = sala.entrar(publico, m.nombre);
            if (!r.ok) { c.send({ t: 'rechazo', motivo: r.motivo }); setTimeout(() => c.close(), 500); return; }
            publicos.set(m.id, publico); id = publico; conexiones.set(id, c); difundir(); return;
          }
          if (m.t === 'trazo') { const op = sala.trazo(id, m); if (op) reenviar(id, op); return; }
          if (sala.accion(id, m, false)) difundir();
        });
        const fuera = () => { if (id && conexiones.get(id) === c) { conexiones.delete(id); sala.salir(id); difundir(); } };
        c.on('close', fuera); c.on('error', fuera);
        c.on('iceStateChanged', (s) => { if (s === 'failed' || s === 'closed') fuera(); });
      });
      const reloj = setInterval(() => { if (sala.tiempo()) difundir(); }, 500);
      difundir();
      listo({
        codigo, anfitrion: true,
        enviar(m) { if (m.t === 'trazo') { const op = sala.trazo(yo, m); if (op) reenviar(yo, op); } else if (sala.accion(yo, m, true)) difundir(); },
        cerrar() { clearInterval(reloj); peer.destroy(); },
      });
    });
  });
}

export function unirse(codigo, nombre, { alEstado, alTrazo, alError }) {
  return new Promise((listo, fallo) => {
    const peer = new Peer({ debug: 1 }), clavePropia = idPropio();
    let conn = null, dentro = false;
    const t = setTimeout(() => { peer.destroy(); fallo(new Error('No se pudo entrar. Revisa el código; algunas redes bloquean la conexión (prueba con otra wifi o con datos).')); }, 15000);
    peer.on('error', (e) => { const msg = e.type === 'peer-unavailable' ? 'No existe una sala con ese código.' : 'Error de conexión (' + e.type + ').'; if (!dentro) { clearTimeout(t); peer.destroy(); fallo(new Error(msg)); } else console.warn(e.type); });
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    peer.on('open', () => {
      conn = peer.connect(PREFIJO + codigo, { reliable: true });
      conn.on('open', () => conn.send({ t: 'hola', id: clavePropia, nombre }));
      conn.on('data', (m) => {
        if (m.t === 'rechazo') { clearTimeout(t); peer.destroy(); fallo(new Error(m.motivo)); return; }
        if (m.t === 'trazo') { alTrazo(m.de, m.op); return; }
        if (m.t === 'estado') {
          if (!dentro) { dentro = true; clearTimeout(t); listo({ codigo, anfitrion: false, enviar: (x) => conn.open && conn.send(x), cerrar: () => peer.destroy() }); }
          alEstado(m.v);
        }
      });
      conn.on('close', () => { if (dentro) alError('Se perdió la conexión con la sala. Si el anfitrión la sigue teniendo abierta, vuelve a entrar con el mismo código.'); });
    });
  });
}
