"use client";

import { useRouter } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useFlashbar } from "@/components/shell/flashbar-context";
import { useDeleteHostedZone } from "@/hooks/use-delete-hosted-zone";
import { isApiError } from "@/lib/error";

export function DeleteZoneModal({
  zoneId,
  zoneName,
  visible,
  onDismiss,
}: {
  zoneId: string;
  zoneName: string;
  visible: boolean;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const { addFlash } = useFlashbar();
  const deleteZone = useDeleteHostedZone(zoneId);

  const close = () => {
    deleteZone.reset();
    onDismiss();
  };

  const confirm = () => {
    deleteZone.mutate(undefined, {
      onSuccess: () => {
        addFlash({
          type: "success",
          content: "Hosted zone deleted.",
          activity: { action: "Deleted", resourceType: "Hosted zone", resourceName: zoneName },
        });
        router.push("/route53/hostedzones");
      },
    });
  };

  return (
    <Modal
      visible={visible}
      onDismiss={close}
      header="Delete hosted zone"
      closeAriaLabel="Close"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={confirm} loading={deleteZone.isPending}>
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {/* R3 HostedZoneNotEmpty: the backend rejects this while non-system records
            remain, surfaced verbatim rather than re-derived client-side. */}
        {deleteZone.isError ? (
          <Alert type="error">
            {isApiError(deleteZone.error) ? deleteZone.error.message : "Something went wrong."}
          </Alert>
        ) : null}
        <Box>
          You can&apos;t undo this action. This will permanently delete the hosted zone{" "}
          <Box variant="strong" display="inline">
            {zoneName}
          </Box>
          .
        </Box>
      </SpaceBetween>
    </Modal>
  );
}
