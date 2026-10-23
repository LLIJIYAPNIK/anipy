// Движение, которому нужен JS (стили — styles/motion.css):
// — data-reveal: блок получает .is-revealed, когда доезжает до экрана;
// — data-parallax: вертикальная кана отстаёт от прокрутки на долю --parallax.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const reveal = () => {
  const items = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
  if (reduced || !('IntersectionObserver' in window)) {
    for (const el of items) el.classList.add('is-revealed');
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  for (const el of items) observer.observe(el);
};

const parallax = () => {
  const items = [...document.querySelectorAll<HTMLElement>('[data-parallax]')];
  const factor = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--parallax')) || 0;
  if (!items.length || !factor) return;
  let frame = 0;
  const update = () => {
    frame = 0;
    // Сдвиг вниз на долю прокрутки: элемент уходит вверх медленнее текста.
    // Дальше одного экрана не двигаем — кана уже за краем.
    const y = Math.min(window.scrollY, window.innerHeight) * factor;
    for (const el of items) el.style.setProperty('--parallax-y', `${y}px`);
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!frame) frame = requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();
};

reveal();
parallax();
