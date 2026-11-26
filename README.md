# 🎭 El Farsante

Juego de grupo en el navegador: todos conocen el secreto menos uno. De 3 a 12 jugadores, en celular o PC, en salas privadas.

**Jugar:** https://virtualtut.github.io/el-farsante/

## Cómo se juega
1. Una persona toca **Crear sala** y comparte el enlace o el código.
2. Cada quien escribe su nombre y entra.
3. El anfitrión elige la versión y empieza.

| Versión | Los demás ven | El farsante ve |
|---|---|---|
| **Palabras** | La palabra | Solo que es el farsante (y, si se activa, la categoría) |
| **Dibujo** | El tema, p. ej. «Ninja comiendo una pizza gigante» | `N____ c_______ u__ p____ g______` |

- **Palabras:** por turnos, cada uno da una pista corta (escrita o en voz alta).
- **Dibujo:** todos dibujan a la vez y se ven los dibujos en vivo.
- Al final se vota. Si cae el farsante, puede ganar adivinando el secreto. Si cae un amigo y los farsantes igualan en número a los demás, ganan ellos.

Para hablar, usen su llamada de siempre.

## Importante
- El navegador del **anfitrión** dirige la partida: si cierra la página, la sala se acaba.
- La conexión es directa entre navegadores (WebRTC con [PeerJS](https://peerjs.com)). Algunas redes la bloquean: prueben otra wifi o datos móviles.
- Es un juego para jugar entre amigos: quien dirige la sala podría ver los secretos revisando su navegador.

## Cambiar temas
Edita `js/temas.js` (listas `PALABRAS` y `DIBUJOS`).

## Desarrollo
```
npm run web    # http://localhost:8777
npm test       # pruebas de las reglas
```
