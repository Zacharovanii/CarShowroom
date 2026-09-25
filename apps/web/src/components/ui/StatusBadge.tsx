import type { TestDriveStatus } from "@carshowroom/contracts";
import { Badge } from "./Badge";
import { TEST_DRIVE_STATUS_VIEW } from "./testDriveStatus";

export interface StatusBadgeProps {
  status: TestDriveStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const view = TEST_DRIVE_STATUS_VIEW[status];

  return (
    <Badge tone={view.tone} dot className={className}>
      {view.label}
    </Badge>
  );
}
