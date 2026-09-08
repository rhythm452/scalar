"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Form from "@cloudscape-design/components/form";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useFlashbar } from "@/components/shell/flashbar-context";
import { useUpdateRecord } from "@/hooks/use-update-record";
import { isApiError } from "@/lib/error";
import { mapRecordErrorToField } from "@/lib/record-error-mapping";
import { recordFormSchema, recordFormToPayload, recordToFormValues, type RecordFormValues } from "@/types/record-forms";
import type { RecordItem } from "@/types/record";
import { RecordFormFields } from "@/components/records/record-form-fields";

export function RecordEditForm({
  zoneId,
  zoneName,
  record,
}: {
  zoneId: string;
  zoneName: string;
  record: RecordItem;
}) {
  const router = useRouter();
  const { addFlash } = useFlashbar();
  const updateRecord = useUpdateRecord(zoneId, record.id);
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);

  const backToRecords = () => router.push(`/route53/hostedzones/${zoneId}?tab=records`);

  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isDirty },
  } = useForm<RecordFormValues>({
    resolver: zodResolver(recordFormSchema),
    defaultValues: recordToFormValues(record, zoneName, record.type as RecordFormValues["type"]),
  });
  const values = watch();

  const onCancel = () => {
    if (isDirty) {
      setDiscardPromptOpen(true);
      return;
    }
    backToRecords();
  };

  const onSubmit = handleSubmit((formValues) => {
    updateRecord.mutate(recordFormToPayload(formValues, zoneName), {
      onSuccess: (response) => {
        addFlash({
          type: "success",
          content: `Record updated: ${response.record.name} ${response.record.type} (Change ${response.change.id}, status ${response.change.status}).`,
        });
        backToRecords();
      },
      onError: (error) => {
        if (!isApiError(error)) {
          setError("root", { message: "Something went wrong. Please try again." });
          return;
        }
        const field = mapRecordErrorToField(error);
        setError(field ?? "root", { message: error.message });
      },
    });
  });

  return (
    <>
      <form onSubmit={onSubmit} noValidate>
        <Form
          errorText={errors.root?.message}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="none" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                variant="primary"
                formAction="submit"
                loading={updateRecord.isPending}
                loadingText="Saving…"
              >
                Save
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <Box>
              <Box variant="awsui-key-label">Record name</Box>
              <div>{record.name}</div>
            </Box>
            <Box>
              <Box variant="awsui-key-label">Record type</Box>
              <div>{record.type}</div>
            </Box>
            <RecordFormFields
              control={control}
              errors={errors}
              values={values}
              zoneName={zoneName}
              section="values"
            />
            <RecordFormFields
              control={control}
              errors={errors}
              values={values}
              zoneName={zoneName}
              section="routing"
            />
          </SpaceBetween>
        </Form>
      </form>
      <Modal
        visible={discardPromptOpen}
        onDismiss={() => setDiscardPromptOpen(false)}
        header="Discard changes?"
        closeAriaLabel="Close"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => setDiscardPromptOpen(false)}>Keep editing</Button>
              <Button variant="primary" onClick={backToRecords}>
                Discard
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        You have unsaved changes to this record. If you leave now, they will be lost.
      </Modal>
    </>
  );
}
