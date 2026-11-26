import test from 'node:test';
import assert from 'node:assert/strict';
import { crearSala, plantilla, maxImpostores } from '../js/reglas.js';

const montar = (n, config = {}) => {
  const s = crearSala(); const ids = Array.from({ length: n }, (_, i) => 'p' + i);
  ids.forEach((id, i) => s.entrar(id, 'J' + i));
  s.accion('p0', { t: 'config', config }, true); s.accion('p0', { t: 'empezar' }, true);
  return { s, ids, imp: ids.filter((id) => s.vista(id).yo.impostor) };
};
const listos = (s, ids) => ids.forEach((id) => s.accion(id, { t: 'listo' }, false));

test('plantilla y máximos', () => {
  assert.equal(plantilla('Ninja comiendo una pizza gigante'), 'N____ c_______ u__ p____ g______');
  assert.deepEqual([3, 4, 5, 6, 7, 12].map(maxImpostores), [1, 1, 2, 2, 3, 3]);
});
test('no empieza con menos de 3', () => { const { s } = montar(2); assert.equal(s.S.fase, 'sala'); });
test('el farsante nunca recibe el secreto', () => {
  for (const modo of ['palabras', 'dibujo']) {
    const { s, ids, imp } = montar(6, { modo, impostores: 2 }); assert.equal(imp.length, 2);
    for (const id of imp) { const v = s.vista(id); assert.equal(v.secreto, null); assert.ok(!JSON.stringify(v).includes(s.S.secreto)); }
    const inocente = ids.find((id) => !imp.includes(id));
    assert.equal(s.vista(inocente).secreto, s.S.secreto);
    assert.ok(s.vista(inocente).jugadores.every((j) => j.impostor === null), 'un amigo no puede saber quién es farsante');
  }
});
test('palabras: turnos, voto, atrapado y adivinanza', () => {
  const { s, ids, imp } = montar(4, { vueltas: 1 }); listos(s, ids); assert.equal(s.S.fase, 'turnos');
  const otro = ids.find((id) => id !== s.vista(ids[0]).turno.id);
  assert.equal(s.accion(otro, { t: 'pista', texto: 'x' }, false), false);
  while (s.S.fase === 'turnos') s.accion(s.vista(ids[0]).turno.id, { t: 'pista', texto: 'algo' }, false);
  assert.equal(s.S.fase, 'voto');
  assert.equal(s.accion(ids[0], { t: 'voto', a: ids[0] }, false), false, 'no vale votarse');
  ids.forEach((id) => s.accion(id, { t: 'voto', a: id === imp[0] ? ids.find((x) => x !== id) : imp[0] }, false));
  assert.equal(s.S.fase, 'adivina');
  s.accion(imp[0], { t: 'adivinar', texto: s.S.secreto.toUpperCase() }, false);
  assert.equal(s.S.fase, 'fin'); assert.equal(s.S.resultado.ganan, 'impostores');
});
test('dibujo: trazos saneados, fallar el voto y ganar farsantes', () => {
  const { s, ids, imp } = montar(3, { modo: 'dibujo' }); listos(s, ids); assert.equal(s.S.fase, 'dibujo');
  assert.ok(s.trazo(ids[0], { op: 'puntos', n: 1, c: 'javascript:', w: 999, p: [1, 2, 3000, -4] }));
  assert.deepEqual(s.S.dibujos[ids[0]][0], { n: 1, c: '#111111', w: 60, p: [1, 2, 1000, 0] });
  assert.equal(s.trazo(ids[0], { op: 'puntos', n: 1, p: [1] }), null);
  const copia = s.vista(ids[1]).dibujos; copia[ids[0]].length = 0; assert.equal(s.S.dibujos[ids[0]].length, 1, 'la vista es una copia');
  listos(s, ids); assert.equal(s.S.fase, 'voto');
  const victima = ids.find((id) => !imp.includes(id));
  ids.forEach((id) => s.accion(id, { t: 'voto', a: id === victima ? imp[0] : victima }, false));
  assert.equal(s.S.fase, 'fin'); assert.equal(s.S.resultado.ganan, 'impostores');
  s.accion('p0', { t: 'volver' }, true); assert.equal(s.S.fase, 'sala');
});
test('empate: nadie sale y hay otra ronda', () => {
  const { s, ids } = montar(4, { modo: 'dibujo' }); listos(s, ids); listos(s, ids);
  ids.forEach((id) => s.accion(id, { t: 'voto', a: null }, false));
  assert.equal(s.S.fase, 'resultado'); s.accion('p0', { t: 'siguiente' }, true); assert.equal(s.S.ronda, 2);
});
test('el tiempo y las desconexiones hacen avanzar', () => {
  const { s, ids } = montar(4, { modo: 'dibujo' }); listos(s, ids);
  ids.slice(0, 3).forEach((id) => s.accion(id, { t: 'listo' }, false)); assert.equal(s.S.fase, 'dibujo');
  s.salir(ids[3]); assert.equal(s.S.fase, 'voto');
  s.S.fin = Date.now() - 1; assert.equal(s.tiempo(), true); assert.notEqual(s.S.fase, 'voto');
});
test('un invitado no puede usar acciones de anfitrión', () => {
  const s = crearSala(); ['a', 'b', 'c'].forEach((id) => s.entrar(id, id));
  assert.equal(s.accion('b', { t: 'empezar' }, false), false); assert.equal(s.S.fase, 'sala');
});
