export interface DisposableDevice { destroy(): void }

/** Generic single-page async device lifetime, independently testable from WebGPU. */
export class SharedDeviceProvider<T extends DisposableDevice> {
  private current: Promise<T> | null = null;
  private readonly create: () => Promise<T>;

  constructor(create: () => Promise<T>) {
    this.create = create;
  }

  get(): Promise<T> {
    return (this.current ??= this.create());
  }

  reset(): void {
    const previous = this.current;
    this.current = null;
    previous?.then((device) => device.destroy()).catch(() => {
      // A device that never resolved owns nothing to release.
    });
  }
}
