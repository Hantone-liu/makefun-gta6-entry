// SOLMARINA — keyboard and mouse. WASD/arrows move, Shift sprints, E enters
// or steals a car, F punches, Space is the handbrake, R restarts, Esc pauses,
// M mutes. Dragging the mouse orbits the third-person camera; a click shoots
// when the player is armed. All state lives here; the game reads it.
export function createInput(canvas) {
  const input = {
    keys: Object.create(null),
    orbitDX: 0, orbitDY: 0, clicked: false, clickX: 0, clickY: 0,
    dragging: false, lastX: 0, lastY: 0,
  };

  function down(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    input.keys[k] = true;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  }
  function up(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    input.keys[k] = false;
  }
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => { input.keys = Object.create(null); });

  canvas.addEventListener('pointerdown', (e) => {
    input.dragging = true; input.lastX = e.clientX; input.lastY = e.clientY;
  });
  window.addEventListener('pointermove', (e) => {
    if (!input.dragging) return;
    input.orbitDX += e.clientX - input.lastX;
    input.orbitDY += e.clientY - input.lastY;
    input.lastX = e.clientX; input.lastY = e.clientY;
  });
  window.addEventListener('pointerup', () => { input.dragging = false; });
  canvas.addEventListener('click', (e) => {
    input.clicked = true; input.clickX = e.clientX; input.clickY = e.clientY;
  });

  input.axis = function axis() {
    const k = input.keys;
    const x = (k.d || k.ArrowRight ? 1 : 0) - (k.a || k.ArrowLeft ? 1 : 0);
    const y = (k.w || k.ArrowUp ? 1 : 0) - (k.s || k.ArrowDown ? 1 : 0);
    return { x, y };
  };
  input.pressed = function pressed(key) {
    const k = input.keys;
    return !!(k[key] || (key === 'e' && k.e) || (key === 'f' && k.f));
  };
  input.consumeOrbit = function consumeOrbit() {
    const o = { dx: input.orbitDX, dy: input.orbitDY };
    input.orbitDX = 0; input.orbitDY = 0;
    return o;
  };
  input.consumeClick = function consumeClick() {
    const c = input.clicked;
    input.clicked = false;
    return c;
  };
  input.clear = function clear() {
    input.keys = Object.create(null);
    input.orbitDX = 0; input.orbitDY = 0; input.clicked = false;
  };
  return input;
}
