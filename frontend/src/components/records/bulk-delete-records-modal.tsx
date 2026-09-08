"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useFlashbar } from "@/components/shell/flashbar-context";
import { useBulkDeleteRecords } from "@/hooks/use-bulk-delete-records";
import { isApiError } from "@/lib/error";
import type { RecordItem } from "@/types/record";

export function BulkDeleteRecordsModal({
  zoneId,
  records,
  visible,
  onDismiss,
  onSuccess,
}: {
  zoneId: string;
  records: RecordItem[];
  visible: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}) {
  const { addFlash } = useFlashbar();
  const bulkDelete = useBulkDeleteRecords(zoneId);

  const close = () => {
    bulkDelete.reset();
    onDismiss();
  };

  const confirm = () => {
    bulkDelete.mutate(
      records.map((record) => record.id),
      {
        onSuccess: (response) => {
          addFlash({
            type: "success",
            content: `${records.length} record${records.length === 1 ? "" : "s"} deleted.`,
            activity: {
              action: "Deleted",
              resourceType: "Record",
              resourceName:
                records.length === 1 && records[0]
                  ? `${records[0].name} ${records[0].type}`
                  : `${records.length} records`,
              changeId: response.change.id,
              changeStatus: response.change.status,
            },
          });
          onSuccess();
          close();
        },
      },
    );
  };

  return (
    <Modal
      visible={visible}
      onDismiss={close}
      header="Delete records"
      closeAriaLabel="Close"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={confirm} loading={bulkDelete.isPending}>
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {bulkDelete.isError ? (
          <Alert type="error">
            {/* This batch is atomic (docs/API.md §4): any item failing means nothing
                in the selection was deleted, not a partial deletion. */}
            {isApiError(bulkDelete.error)
              ? `Nothing was deleted: ${bulkDelete.error.message}`
              : "Nothing was deleted. Something went wrong."}
          </Alert>
        ) : null}
        <Box>
          You can&apos;t undo this action. This will permanently delete the following{" "}
          {records.length} record{records.length === 1 ? "" : "s"}:
        </Box>
        <Box>
          <ul>
            {records.map((record) => (
              <li key={record.id}>
                {record.name} ({record.type})
              </li>
            ))}
          </ul>
        </Box>
      </SpaceBetween>
    </Modal>
  );
}
