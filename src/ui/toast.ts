export type ToastVariant = "info" | "success" | "warn" | "break" | "milestone";

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  duration?: number; // milliseconds
  progress?: number; // 0-100 for progress bar
}

export class ToastManager {
  private activeToasts: Set<HTMLElement> = new Set();
  private maxToasts = 3;

  showToast(options: ToastOptions): void {
    const {
      message,
      variant = "info",
      duration = 2500,
      progress
    } = options;

    // Clean up old toasts if we have too many
    if (this.activeToasts.size >= this.maxToasts) {
      const oldest = Array.from(this.activeToasts)[0];
      this.removeToast(oldest);
    }

    const el = document.createElement("div");
    el.className = `wm-toast wm-${variant}`;

    Object.assign(el.style, {
      position: "fixed",
      right: "16px",
      bottom: this.getBottomPosition() + "px",
      padding: "12px 16px",
      borderRadius: "10px",
      fontSize: "13px",
      zIndex: "9999",
      background: this.getBackgroundColor(variant),
      color: "#fff",
      boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
      transition: "all 0.3s ease",
      opacity: "0",
      transform: "translateX(400px)",
      minWidth: "250px",
      maxWidth: "400px",
    });

    // Message container
    const messageEl = document.createElement("div");
    messageEl.textContent = message;
    messageEl.style.marginBottom = progress !== undefined ? "8px" : "0";
    el.appendChild(messageEl);

    // Progress bar if provided
    if (progress !== undefined) {
      const progressContainer = document.createElement("div");
      Object.assign(progressContainer.style, {
        width: "100%",
        height: "4px",
        backgroundColor: "rgba(255,255,255,0.2)",
        borderRadius: "2px",
        overflow: "hidden",
      });

      const progressBar = document.createElement("div");
      Object.assign(progressBar.style, {
        width: `${Math.min(100, Math.max(0, progress))}%`,
        height: "100%",
        backgroundColor: "rgba(255,255,255,0.8)",
        borderRadius: "2px",
        transition: "width 0.3s ease",
      });

      progressContainer.appendChild(progressBar);
      el.appendChild(progressContainer);
    }

    document.body.appendChild(el);
    this.activeToasts.add(el);

    // Trigger animation
    requestAnimationFrame(() => {
      el.style.opacity = "0.98";
      el.style.transform = "translateX(0)";
    });

    // Auto-remove after duration
    setTimeout(() => {
      this.removeToast(el);
    }, duration);
  }

  private removeToast(el: HTMLElement): void {
    if (!this.activeToasts.has(el)) return;

    el.style.opacity = "0";
    el.style.transform = "translateX(400px)";

    setTimeout(() => {
      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
      this.activeToasts.delete(el);
    }, 300);
  }

  private getBottomPosition(): number {
    const baseBottom = 16;
    const toastHeight = 60;
    const gap = 10;
    const index = this.activeToasts.size;
    return baseBottom + (toastHeight + gap) * index;
  }

  private getBackgroundColor(variant: ToastVariant): string {
    switch (variant) {
      case "success":
        return "#1f8a50";
      case "warn":
        return "#b85c00";
      case "break":
        return "#586e75";
      case "milestone":
        return "#6b46c1";
      case "info":
      default:
        return "#3a6ea5";
    }
  }

  // Convenience methods
  info(message: string, duration?: number): void {
    this.showToast({ message, variant: "info", duration });
  }

  success(message: string, duration?: number): void {
    this.showToast({ message, variant: "success", duration });
  }

  warn(message: string, duration?: number): void {
    this.showToast({ message, variant: "warn", duration });
  }

  break(message: string, duration?: number): void {
    this.showToast({ message, variant: "break", duration });
  }

  milestone(message: string, duration?: number): void {
    this.showToast({ message, variant: "milestone", duration: duration || 5000 });
  }

  progress(message: string, percent: number, variant: ToastVariant = "info"): void {
    this.showToast({ message, variant, progress: percent, duration: 3000 });
  }

  cleanup(): void {
    this.activeToasts.forEach(toast => this.removeToast(toast));
  }
}
