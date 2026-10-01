import { t } from '../ui/i18n/ko';

export function showFatal(root: HTMLElement, err: unknown): void {
  const msg = err instanceof Error && err.message === 'webgl-unavailable' ? t('ui.fatalWebgl') : t('ui.fatalAssets');
  root.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'fatal';
  el.dataset.testid = 'fatal';
  el.textContent = msg;
  root.appendChild(el);
  console.error(err);
}
