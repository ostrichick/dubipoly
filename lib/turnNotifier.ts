// Client-side Turn Notification helper (Browser title flash + vibration)
export class TurnNotifier {
  private static originalTitle = typeof document !== 'undefined' ? document.title : 'Dubipoly';
  private static intervalId: any = null;

  public static notify(playerName?: string) {
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
      const flashText = `🔔 [내 차례!] 주사위를 굴리세요`;
      this.originalTitle = document.title.replace(/^🔔\s*\[.*?\]\s*/, '');

      this.intervalId = setInterval(() => {
        document.title = toggle ? flashText : this.originalTitle;
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
    if (typeof document !== 'undefined' && this.originalTitle) {
      document.title = this.originalTitle;
    }
  }
}
