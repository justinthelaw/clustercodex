/**
 * Hosts the main issue-centric landing experience for operators.
 */
import IssuesDashboard from "@/components/IssuesDashboard";

/** Displays the default dashboard view for active cluster issues. */
export default function HomePage() {
  return <IssuesDashboard />;
}
