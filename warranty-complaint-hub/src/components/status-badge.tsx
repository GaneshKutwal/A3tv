import { Badge } from "@/components/ui/badge";
import type { ComplaintStatus, ComplaintPriority } from "@/lib/data";

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  if (status === "Open")
    return (
      <Badge className="shrink-0 whitespace-nowrap border-destructive/40 bg-destructive/15 text-destructive" variant="outline">
        Open
      </Badge>
    );
  if (status === "In Progress")
    return (
      <Badge className="shrink-0 whitespace-nowrap border-warning/40 bg-warning/15 text-warning" variant="outline">
        In Progress
      </Badge>
    );
  return (
    <Badge className="shrink-0 whitespace-nowrap border-success/40 bg-success/15 text-success" variant="outline">
      Resolved
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: ComplaintPriority }) {
  if (priority === "High")
    return (
      <Badge variant="outline" className="border-destructive/40 bg-destructive/15 text-destructive">
        High
      </Badge>
    );
  if (priority === "Medium")
    return (
      <Badge variant="outline" className="border-warning/40 bg-warning/15 text-warning">
        Medium
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-primary/40 bg-primary/15 text-primary">
      Low
    </Badge>
  );
}
