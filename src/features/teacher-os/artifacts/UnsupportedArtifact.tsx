import { EmptyState } from "@/shared/components/EmptyState";

export function UnsupportedArtifact() {
  return (
    <div className="artifact-unsupported">
      <EmptyState
        title="This resource isn’t ready to preview"
        description="Teacher OS can’t display this item as a teaching document yet. The original resource is unchanged — try another item, or open Work if you need to continue from this version."
      />
    </div>
  );
}
