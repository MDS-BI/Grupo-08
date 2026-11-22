// Entorno base compartido por la suite del módulo de Control de Calidad.
// Cada prueba que monta la UI crea su propio JSDOM en tests/support/quality-dom.js;
// aquí solo se garantizan globals que pueden consumirse antes de ese montaje.
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = (callback) => callback(Date.now());
}
if (typeof globalThis.cancelAnimationFrame !== 'function') {
  globalThis.cancelAnimationFrame = () => {};
}
