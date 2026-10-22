// Вкладки по SDK (Changelog, покрытие API): кнопки role="tab" с data-package,
// стрелки влево/вправо, ссылка вида #<package> открывает нужную вкладку.
export const initTabs = () => {
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role=tab][data-package]')];
  const select = (tab: HTMLButtonElement, focus = false) => {
    for (const other of tabs) {
      const on = other === tab;
      other.setAttribute('aria-selected', String(on));
      other.tabIndex = on ? 0 : -1;
      document.getElementById(other.getAttribute('aria-controls')!)!.hidden = !on;
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
  const fromHash = tabs.find((tab) => `#${tab.dataset.package}` === location.hash);
  if (fromHash) select(fromHash);
};
