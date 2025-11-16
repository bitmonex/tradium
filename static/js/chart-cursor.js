export function createCursorOverlay(chartCore) {
  const parent = chartCore?.app?.view?.parentNode;
  if (!parent) return null;

  const el = document.createElement('i');
  el.className = 'cur hide';
  const v = document.createElement('b'); // вертикальная линия
  const h = document.createElement('u'); // горизонтальная линия
  el.appendChild(v);
  el.appendChild(h);

  // 🔹 плашки
  const tipPrice = document.createElement('s');
  tipPrice.className = 'tip price';
  const tipTime = document.createElement('s');
  tipTime.className = 'tip time';
  el.appendChild(tipPrice);
  el.appendChild(tipTime);

  parent.appendChild(el);

  let mode = 'dashed'; // 'default' | 'solid' | 'dashed' | 'dotted'
  el.classList.add(mode);

  function setVisible(on) {
    if (on) {
      el.classList.remove('hide');
    } else {
      el.classList.add('hide');
    }
  }

  function updateBox(layout) {
    if (!layout) return;
    el.style.left = layout.plotX + 'px';
    el.style.top = '0px'; // 🔧 курсор охватывает весь график
    el.style.width = layout.plotW + 'px';
    el.style.height = layout.height + 'px'; // 🔧 высота всей области
  }

  function updatePosition(mx, my, layout) {
    if (!layout) return;
    const lx = mx - layout.plotX;
    const ly = my - layout.plotY;
    const inChart = mx >= layout.plotX && mx <= layout.plotX + layout.plotW;

    setVisible(inChart && mode !== 'default');
    if (!inChart) return;

    // 🔹 линии — сдвиг на 1px
    v.style.left = (lx - 2) + 'px';
    v.style.top = '0px';
    h.style.left = '0px';
    h.style.top = (ly - 1) + 'px';

    // 🔹 цена
    const price = layout.maxPrice - ((my - layout.plotY) / layout.plotH) * (layout.maxPrice - layout.minPrice);
    tipPrice.textContent = price?.toFixed?.(5) ?? '';
    tipPrice.style.position = 'absolute';
    tipPrice.style.left = layout.plotW + 'px';
    tipPrice.style.top = (ly - tipPrice.offsetHeight * 0.5) + 'px';

    // 🔹 время
    const time = layout.screenToTime(mx);
    tipTime.textContent = new Date(time).toLocaleString();
    tipTime.style.position = 'absolute';
    tipTime.style.left = (lx - tipTime.offsetWidth * 0.5) + 'px';
    tipTime.style.top = (layout.height - layout.bottomOffset) + 'px';
  }

  function setStyle(styleName = 'default') {
    mode = styleName;
    el.classList.remove('default', 'solid', 'dashed', 'dotted');
    el.classList.add(styleName);
  }

  function getStyle() {
    return mode;
  }

  function toggleStyle() {
    const styles = ['default', 'solid', 'dashed', 'dotted'];
    const i = styles.indexOf(mode);
    const next = styles[(i + 1) % styles.length];
    setStyle(next);
  }

  return {
    updateBox,
    updatePosition,
    setVisible,
    setStyle,
    getStyle,
    toggleStyle,
    destroy: () => el.remove()
  };
}
