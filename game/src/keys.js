// Keyboard + mouse input. Camera yaw is the VIEW direction (also the aim direction).
export function makeInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    dragDX: 0,
    dragDY: 0,
    clicked: false,
    clickX: 0,
    clickY: 0,
    interactPressed: false,
    anyKey: false,
    dragging: false,
    _lastX: 0,
    _lastY: 0,
  };

  function code(e) {
    return e.code || e.key;
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(code(e));
    input.anyKey = true;
    if (code(e) === 'KeyE') input.interactPressed = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code(e))) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(code(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (e) => {
    input.dragging = true;
    input._lastX = e.clientX;
    input._lastY = e.clientY;
    input.clicked = true;
    input.clickX = e.clientX;
    input.clickY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!input.dragging) return;
    input.dragDX += e.clientX - input._lastX;
    input.dragDY += e.clientY - input._lastY;
    input._lastX = e.clientX;
    input._lastY = e.clientY;
  });
  function endDrag() {
    input.dragging = false;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  input.consumeDrag = () => {
    const dx = input.dragDX;
    const dy = input.dragDY;
    input.dragDX = 0;
    input.dragDY = 0;
    return { dx, dy };
  };
  input.consumeClick = () => {
    const c = input.clicked;
    input.clicked = false;
    return c;
  };
  input.consumeInteract = () => {
    const p = input.interactPressed;
    input.interactPressed = false;
    return p;
  };
  input.axis = () => {
    let f = 0;
    let s = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
    return { f, s };
  };
  return input;
}
