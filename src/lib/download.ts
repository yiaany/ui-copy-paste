/**
 * Скачивание сгенерированного компонента как файла (.tsx/.jsx) через Blob.
 * Работает без локального моста — обычная загрузка в браузере.
 */

/** Расширение файла по режиму TypeScript из настроек. */
export function fileExtension(typescript: boolean): 'tsx' | 'jsx' {
  return typescript ? 'tsx' : 'jsx';
}

/** Инициирует скачивание кода как файла componentName.ext. */
export function downloadComponent(
  componentName: string,
  code: string,
  ext: 'tsx' | 'jsx' = 'tsx',
): void {
  const safeName = componentName.replace(/[^A-Za-z0-9_]/g, '') || 'Component';
  const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Освобождаем URL после того, как клик обработан.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}