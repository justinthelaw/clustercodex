/**
 * Renders lightweight inline error feedback used across interactive UI views.
 */
type ErrorBannerProps = {
  message: string;
};

// Returns nothing when there is no message and a styled alert when there is one.
export default function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) {
    return null;
  }

  return <div className="error">{message}</div>;
}
