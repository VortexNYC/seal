import {
  createKumoToastManager,
  type KumoToastManagerAddOptions,
} from "@cloudflare/kumo/components/toast";
import type { ReactNode } from "react";

export const toastManager = createKumoToastManager();

type KumoAddOptions = KumoToastManagerAddOptions<object>;
type ToastVariant = NonNullable<KumoAddOptions["variant"]>;

const toastIds = new Map<string, string>();

export type ToastAction = {
  label: ReactNode;
  onClick: () => void;
};

export type ToastOptions = {
  id?: string;
  description?: ReactNode;
  duration?: number;
  action?: ToastAction;
};

type ToastType = ToastVariant | "default";

function add(variant: ToastType, message: ReactNode, options?: ToastOptions) {
  const opts: KumoAddOptions = {
    title: message,
    ...(variant === "default" ? {} : { variant }),
    ...(options?.description ? { description: options.description } : {}),
    ...(options?.action
      ? {
          actions: [
            {
              onClick: options.action.onClick,
              children: options.action.label,
            },
          ],
        }
      : {}),
  };

  if (options?.id) {
    const existing = toastIds.get(options.id);
    if (existing) {
      toastManager.update(existing, opts);
      return;
    }
    const toastId = toastManager.add(opts);
    toastIds.set(options.id, toastId);
  } else {
    toastManager.add(opts);
  }
}

export const toast = Object.assign(
  (message: ReactNode, options?: ToastOptions) =>
    add("default", message, options),
  {
    success: (message: ReactNode, options?: ToastOptions) =>
      add("success", message, options),
    error: (message: ReactNode, options?: ToastOptions) =>
      add("error", message, options),
    info: (message: ReactNode, options?: ToastOptions) =>
      add("info", message, options),
    warning: (message: ReactNode, options?: ToastOptions) =>
      add("warning", message, options),
    dismiss: (id?: string) => {
      if (id) {
        const kumoId = toastIds.get(id);
        if (kumoId) {
          toastManager.close(kumoId);
          toastIds.delete(id);
        }
      } else {
        toastManager.close();
      }
    },
    promise: <T>(
      promise: Promise<T>,
      options: {
        loading: ReactNode;
        success: ReactNode | ((data: T) => ReactNode);
        error: ReactNode | ((error: unknown) => ReactNode);
      }
    ) =>
      toastManager.promise(promise, {
        loading: { title: options.loading },
        success: (() => {
          const { success } = options;
          if (typeof success === "function") {
            return (data: T) => ({ title: success(data) });
          }
          return { title: success };
        })(),
        error: (() => {
          const { error } = options;
          if (typeof error === "function") {
            return (err: unknown) => ({ title: error(err) });
          }
          return { title: error };
        })(),
      }),
  }
);
