"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useFlashbar } from "@/components/shell/flashbar-context";
import { useUpdateHostedZone } from "@/hooks/use-update-hosted-zone";
import { isApiError } from "@/lib/error";
import { formatAbsoluteDate } from "@/lib/format-date";
import {
  editZoneCommentFormSchema,
  type EditZoneCommentFormValues,
} from "@/types/hosted-zone-forms";
import type { HostedZoneDetail } from "@/types/hosted-zone";
import { ZoneTypeBadge } from "@/components/hosted-zones/zone-type-badge";

export function ZoneDetailsTab({ zone }: { zone: HostedZoneDetail }) {
  const [editing, setEditing] = useState(false);
  const { addFlash } = useFlashbar();
  const updateZone = useUpdateHostedZone(zone.id);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditZoneCommentFormValues>({
    resolver: zodResolver(editZoneCommentFormSchema),
    defaultValues: { comment: zone.comment ?? "" },
  });

  const startEditing = () => {
    reset({ comment: zone.comment ?? "" });
    setEditing(true);
  };

  const onSubmit = handleSubmit((values) => {
    updateZone.mutate(values.comment || null, {
      onSuccess: () => {
        addFlash({ type: "success", content: "Hosted zone updated." });
        setEditing(false);
      },
    });
  });

  if (editing) {
    return (
      <Container header={<Header variant="h2">Hosted zone details</Header>}>
        <form onSubmit={onSubmit} noValidate>
          <SpaceBetween size="l">
            {updateZone.isError ? (
              <Alert type="error">
                {isApiError(updateZone.error) ? updateZone.error.message : "Something went wrong."}
              </Alert>
            ) : null}
            <Controller
              name="comment"
              control={control}
              render={({ field }) => (
                <FormField
                  label="Description - optional"
                  errorText={errors.comment?.message}
                  constraintText={`${field.value.length}/256`}
                >
                  <Input
                    value={field.value}
                    onChange={({ detail }) => field.onChange(detail.value)}
                    autoFocus
                  />
                </FormField>
              )}
            />
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="primary" formAction="submit" loading={updateZone.isPending}>
                Save
              </Button>
              <Button formAction="none" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </SpaceBetween>
          </SpaceBetween>
        </form>
      </Container>
    );
  }

  return (
    <Container
      header={
        <Header variant="h2" actions={<Button onClick={startEditing}>Edit</Button>}>
          Hosted zone details
        </Header>
      }
    >
      <KeyValuePairs
        columns={2}
        items={[
          { label: "Domain name", value: zone.name },
          { label: "Type", value: <ZoneTypeBadge type={zone.type} /> },
          { label: "Description", value: zone.comment || <Box color="text-body-secondary">-</Box> },
          { label: "Hosted zone ID", value: zone.id },
          { label: "Caller reference", value: zone.caller_reference },
          { label: "Record count", value: zone.record_set_count },
          { label: "Created", value: formatAbsoluteDate(zone.created_at) },
          ...(zone.type === "private"
            ? [
                { label: "VPC ID", value: zone.vpc_id ?? "" },
                { label: "VPC region", value: zone.vpc_region ?? "" },
              ]
            : []),
        ]}
      />
    </Container>
  );
}
