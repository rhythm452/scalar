"use client";

import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useFlashbar } from "@/components/shell/flashbar-context";
import { useCreateRecordsBatch } from "@/hooks/use-create-records-batch";
import { isApiError } from "@/lib/error";
import { mapRecordErrorToField } from "@/lib/record-error-mapping";
import {
  defaultRecordFormValues,
  quickCreateFormSchema,
  recordFormToPayload,
  type QuickCreateFormValues,
} from "@/types/record-forms";
import { RecordFormFields } from "@/components/records/record-form-fields";

export function QuickCreateRecordForm({
  zoneId,
  zoneName,
  onSwitchToWizard,
}: {
  zoneId: string;
  zoneName: string;
  onSwitchToWizard: () => void;
}) {
  const router = useRouter();
  const { addFlash } = useFlashbar();
  const createRecords = useCreateRecordsBatch(zoneId);

  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<QuickCreateFormValues>({
    resolver: zodResolver(quickCreateFormSchema),
    defaultValues: { records: [defaultRecordFormValues()] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "records" });
  const watched = watch("records");

  const onSubmit = handleSubmit((formValues) => {
    const first = formValues.records[0];
    const name =
      formValues.records.length === 1 && first
        ? `${first.subdomain.trim() || "@"}.${zoneName}`.replace(/^@\./, "")
        : `${formValues.records.length} records`;
    createRecords.mutate(
      formValues.records.map((record) => recordFormToPayload(record, zoneName)),
      {
        onSuccess: (response) => {
          addFlash({
            type: "success",
            content: `Record created: ${name} (Change ${response.change.id}, status ${response.change.status}).`,
            activity: {
              action: "Created",
              resourceType: "Record",
              resourceName: name,
              changeId: response.change.id,
              changeStatus: response.change.status,
            },
          });
          router.push(`/route53/hostedzones/${zoneId}?tab=records`);
        },
        onError: (error) => {
          if (!isApiError(error)) return;
          // The inline field/root mapping below stays untouched; this single
          // announcement also toasts the failure and logs the error entry.
          addFlash({
            type: "error",
            content: `Record not created: ${name} (${error.code}).`,
            activity: { action: "Created", resourceType: "Record", resourceName: name },
          });
          // A single record in the batch: map the AWS error onto that record's
          // field, exactly like the zone-create form. With more than one record
          // in the batch, the API doesn't say which item failed (docs/API.md §4
          // returns the first error with no item index), so it can't be safely
          // attributed to one row -- surfaced as a top-level Alert instead.
          if (formValues.records.length === 1) {
            const field = mapRecordErrorToField(error);
            if (field) {
              setError(`records.0.${field}`, { message: error.message });
              return;
            }
          }
          setError("root", { message: error.message });
        },
      },
    );
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <Form
        errorText={errors.root?.message}
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              formAction="none"
              onClick={() => router.push(`/route53/hostedzones/${zoneId}?tab=records`)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              formAction="submit"
              loading={createRecords.isPending}
              loadingText="Creating…"
            >
              Create record
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="l">
          <Box>
            <Link onFollow={onSwitchToWizard}>Switch to wizard</Link>
          </Box>
          {fields.map((field, index) => (
            <Container
              key={field.id}
              header={
                <Header
                  actions={
                    fields.length > 1 ? (
                      <Button onClick={() => remove(index)}>Remove</Button>
                    ) : undefined
                  }
                >
                  {`Record ${index + 1}`}
                </Header>
              }
            >
              <SpaceBetween size="l">
                <RecordFormFields
                  control={control}
                  errors={errors.records?.[index] ?? {}}
                  values={watched[index] ?? defaultRecordFormValues()}
                  zoneName={zoneName}
                  section="identity"
                  namePrefix={`records.${index}.`}
                />
                <RecordFormFields
                  control={control}
                  errors={errors.records?.[index] ?? {}}
                  values={watched[index] ?? defaultRecordFormValues()}
                  zoneName={zoneName}
                  section="values"
                  namePrefix={`records.${index}.`}
                />
                <RecordFormFields
                  control={control}
                  errors={errors.records?.[index] ?? {}}
                  values={watched[index] ?? defaultRecordFormValues()}
                  zoneName={zoneName}
                  section="routing"
                  namePrefix={`records.${index}.`}
                />
              </SpaceBetween>
            </Container>
          ))}
          <Box>
            <Button iconName="add-plus" onClick={() => append(defaultRecordFormValues())}>
              Add another record
            </Button>
          </Box>
        </SpaceBetween>
      </Form>
    </form>
  );
}
