// Кнопки «Копировать» у блоков кода: components/CodeBlock.astro и код в документации (lib/markdown.ts).
for (const button of document.querySelectorAll<HTMLButtonElement>('.copy[data-copy]')) {
  const label = button.querySelector('[aria-live]')!;
  const idle = label.textContent;
  button.addEventListener('click', async () => {
    await navigator.clipboard.writeText(button.dataset.copy ?? '');
    label.textContent = button.dataset.done ?? idle;
    setTimeout(() => (label.textContent = idle), 1600);
  });
}
