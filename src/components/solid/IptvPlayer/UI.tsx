import { type JSX, Show } from "solid-js";

/** Shown when no channel is selected */
export function EmptyState(): JSX.Element {
  return (
    <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/60 py-12">
      <svg
        class="h-20 w-20 opacity-40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="3" width="20" height="15" rx="2" ry="2" />
        <polyline points="17 21 12 17 7 21" />
      </svg>
      <p class="text-lg font-medium">Select a channel to start watching</p>
    </div>
  );
}

/** Props for ErrorOverlay */
interface ErrorOverlayProps {
  errorMessage: string | undefined;
  isOffline: boolean;
  isPermanentError: boolean;
  retryCount: number;
  maxRetries: number;
  onRetry: () => void;
  onCopyUrl: () => void;
}

/** Error display with retry logic */
export function ErrorOverlay(props: ErrorOverlayProps): JSX.Element {
  return (
    <div
      class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-white"
      role="alert"
    >
      <Show
        when={props.isOffline}
        fallback={
          <svg
            class="h-12 w-12 text-red-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        }
      >
        <svg
          class="h-12 w-12 text-amber-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </Show>

      {/* Error message */}
      <p class="max-w-md text-center text-sm">{props.errorMessage}</p>

      {/* Actions: depends on retry count */}
      <div class="flex flex-col items-center gap-3">
        <Show
          when={props.isPermanentError}
          fallback={
            <>
              <button
                type="button"
                class="rounded-lg bg-white/10 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                onClick={props.onRetry}
                aria-label="Retry playback"
              >
                Try Again
              </button>
              <Show when={props.retryCount > 0}>
                <p class="text-xs text-white/40">
                  Attempt {props.retryCount} of {props.maxRetries + 1}
                </p>
              </Show>
            </>
          }
        >
          <p class="max-w-md text-center text-xs text-white/50">
            Playback could not be recovered after {props.maxRetries + 1}{" "}
            attempts.
          </p>
          <button
            type="button"
            class="rounded-lg bg-white/10 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={props.onCopyUrl}
            aria-label="Copy stream URL to clipboard"
          >
            Copy stream URL
          </button>
        </Show>
      </div>
    </div>
  );
}
