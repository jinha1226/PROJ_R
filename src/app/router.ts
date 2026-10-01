export interface Screen {
  mount(root: HTMLElement): void;
  unmount(): void;
}

export class Router {
  private current: Screen | null = null;

  constructor(private readonly root: HTMLElement) {}

  go(screen: Screen): void {
    this.current?.unmount();
    this.root.innerHTML = '';
    this.current = screen;
    screen.mount(this.root);
  }
}
