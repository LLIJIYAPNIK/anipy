// Вкладки по SDK (Changelog, покрытие API): кнопки role="tab" с data-package,
// стрелки влево/вправо, ссылка вида #<package> открывает нужную вкладку.

/** Плавное появление (.tab-enter из motion.css); класс снимается после анимации. */
export const playEnter = (el: HTMLElement) => {
  el.classList.remove('tab-enter');
  void el.offsetWidth; // перезапуск анимации при повторном выборе
  el.classList.add('tab-enter');
  el.addEventListener('animationend', () => el.classList.remove('tab-enter'), { once: true });
};

export const initTabs = () => {
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role=tab][data-package]')];
  const select = (tab: HTMLButtonElement, focus = false, animate = true) => {
    for (const other of tabs) {
      const on = other === tab;
      const panel = document.getElementById(other.getAttribute('aria-controls')!)!;
      const wasHidden = panel.hidden;
      other.setAttribute('aria-selected', String(on));
      other.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
      if (on && wasHidden && animate) playEnter(panel);
    }
    if (focus) tab.focus();
    history.replaceState(null, '', `#${tab.dataset.package}`);
  };
  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (step) select(tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length], true);
    });
  }
  // Вкладка из адреса открывается сразу, без анимации.
  const fromHash = tabs.find((tab) => `#${tab.dataset.package}` === location.hash);
  if (fromHash) select(fromHash, false, false);
};
