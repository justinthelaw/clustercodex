/**
 * Renders lightweight inline error feedback used across interactive UI views.
 */
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ErrorBannerProps = {
  message: string;
};

/** Returns nothing when there is no message and a styled alert when there is one. */
export default function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <TriangleAlert className="size-4" />
      <AlertTitle>Request Failed</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
