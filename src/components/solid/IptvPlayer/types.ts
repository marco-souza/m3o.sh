// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stream source configuration for the player */
export interface StreamSource {
  url: string;
}

export interface IptvPlayerProps {
  /** The stream to play, or null when no channel is selected */
  streamSource: StreamSource | null;
  /** Callback when hls.js emits a fatal error */
  onError?: (message: string) => void;
  /** When true, show player controls (play/pause, mute, fullscreen). When false, hide them for a clean view. */
  showControls?: boolean;
}

/** Distinguishes error categories for user-facing messaging and recovery UX. */
export const ERROR_KINDS = [
  "network-offline",
  "stream-unavailable",
  "media-error",
  "generic",
] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];

export interface PlayerError {
  message: string;
  kind: ErrorKind;
}
