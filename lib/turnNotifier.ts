// Client-side Turn Notification helper (Browser title flash + vibration)
export class TurnNotifier {
  private static originalTitle: string | null = null;
  private static intervalId: ReturnType<typeof setInterval> | null = null;

  /** `flashText` is already localized by the caller. */
  public static notify(flashText: string) {
    if (typeof window === 'undefined') return;

    // 1. Mobile Vibration if supported
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([150, 80, 150]);
      } catch {}
    }

    // 2. Title Blinking notification if tab is hidden
    if (document.hidden) {
      this.stop();
      let toggle = false;
      const originalTitle = document.title;
      this.originalTitle = originalTitle;

      this.intervalId = setInterval(() => {
        document.title = toggle ? flashText : originalTitle;
        toggle = !toggle;
      }, 1000);

      const onFocus = () => {
        this.stop();
        window.removeEventListener('focus', onFocus);
      };
      window.addEventListener('focus', onFocus);
    }
  }

  public static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Restore only a title this helper replaced; never clobber a newer one.
    if (typeof document !== 'undefined' && this.originalTitle !== null) {
      document.title = this.originalTitle;
      this.originalTitle = null;
    }
  }
}
