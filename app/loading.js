import Shell from "@/components/Shell";
import { PageSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <Shell noPadding>
      <PageSkeleton title="Loading page" />
    </Shell>
  );
}
