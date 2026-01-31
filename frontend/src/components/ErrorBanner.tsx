type ErrorBannerProps = {
  message: string;
};

export default function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null;
  return <div className="error">{message}</div>;
}
