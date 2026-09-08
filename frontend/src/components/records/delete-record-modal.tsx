"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useFlashbar } from "@/components/shell/flashbar-context";
import { useDeleteRecord } from "@/hooks/use-delete-record";
import { isApiError } from "@/lib/error";
import type { RecordItem } from "@/types/record";

export function DeleteRecordModal({
  zoneId,
  record,
  visible,
  onDismiss,
}: {
  zoneId: string;
  record: RecordItem | null;
  visible: boolean;
  onDismiss: () => void;
}) {
  const { addFlash } = useFlashbar();
  const deleteRecord = useDeleteRecord(zoneId, record?.id ?? "");

  const close = () => {
    deleteRecord.reset();
    onDismiss();
  };

  const confirm = () => {
    if (!record) return;
    deleteRecord.mutate(undefined, {
      onSuccess: (response) => {
        addFlash({
          type: "success",
          content: `Record deleted: ${record.name} ${record.type} (Change ${response.change.id}, status ${response.change.status}).`,
          activity: {
            action: "Deleted",
            resourceType: "Record",
            resourceName: `${record.name} ${record.type}`,
            changeId: response.change.id,
            changeStatus: response.change.status,
          },
        });
        close();
      },
    });
  };

  return (
    <Modal
      visible={visible}
      onDismiss={close}
      header="Delete record"
      closeAriaLabel="Close"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={confirm} loading={deleteRecord.isPending}>
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {deleteRecord.isError ? (
          <Alert type="error">
            {isApiError(deleteRecord.error) ? deleteRecord.error.message : "Something went wrong."}
          </Alert>
        ) : null}
        {record ? (
          <Box>
            You can&apos;t undo this action. This will permanently delete the record set{" "}
            <Box variant="strong" display="inline">
              {record.name}
            </Box>{" "}
            of type{" "}
            <Box variant="strong" display="inline">
              {record.type}
            </Box>
            .
          </Box>
        ) : null}
      </SpaceBetween>
    </Modal>
  );
}
