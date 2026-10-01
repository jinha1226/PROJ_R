import type { Screen } from '../../app/router';
import { t } from '../i18n/ko';

/** Placeholder shown while assets load, so the previous screen can't be clicked in the meantime. */
export class LoadingScreen implements Screen {
  private el = document.createElement('div');

  mount(root: HTMLElement): void {
    this.el.className = 'loading';
    this.el.dataset.testid = 'loading';
    this.el.textContent = t('ui.loading');
    root.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }
}
