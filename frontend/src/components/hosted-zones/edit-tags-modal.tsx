"use client";

import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Grid from "@cloudscape-design/components/grid";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useReplaceTags } from "@/hooks/use-replace-tags";
import { isApiError } from "@/lib/error";
import { editTagsFormSchema, type EditTagsFormValues } from "@/types/hosted-zone-forms";
import type { TagItem } from "@/types/tag";

export function EditTagsModal({
  zoneId,
  tags,
  visible,
  onDismiss,
}: {
  zoneId: string;
  tags: TagItem[];
  visible: boolean;
  onDismiss: () => void;
}) {
  const replaceTags = useReplaceTags(zoneId);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditTagsFormValues>({
    resolver: zodResolver(editTagsFormSchema),
    defaultValues: { tags },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "tags" });

  const close = () => {
    reset({ tags });
    replaceTags.reset();
    onDismiss();
  };

  const onSubmit = handleSubmit((values) => {
    replaceTags.mutate(values.tags, { onSuccess: close });
  });

  return (
    <Modal
      visible={visible}
      onDismiss={close}
      header="Edit tags"
      closeAriaLabel="Close"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={() => onSubmit()} loading={replaceTags.isPending}>
              Save
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <SpaceBetween size="m">
          {replaceTags.isError ? (
            <Alert type="error">
              {isApiError(replaceTags.error) ? replaceTags.error.message : "Something went wrong."}
            </Alert>
          ) : null}
          {fields.map((field, index) => (
            <Grid key={field.id} gridDefinition={[{ colspan: 5 }, { colspan: 5 }, { colspan: 2 }]}>
              <Controller
                name={`tags.${index}.key`}
                control={control}
                render={({ field: keyField }) => (
                  <FormField
                    label={index === 0 ? "Key" : undefined}
                    errorText={errors.tags?.[index]?.key?.message}
                  >
                    <Input
                      value={keyField.value}
                      onChange={({ detail }) => keyField.onChange(detail.value)}
                      placeholder="Key"
                    />
                  </FormField>
                )}
              />
              <Controller
                name={`tags.${index}.value`}
                control={control}
                render={({ field: valueField }) => (
                  <FormField
                    label={index === 0 ? "Value" : undefined}
                    errorText={errors.tags?.[index]?.value?.message}
                  >
                    <Input
                      value={valueField.value}
                      onChange={({ detail }) => valueField.onChange(detail.value)}
                      placeholder="Value"
                    />
                  </FormField>
                )}
              />
              <Button
                onClick={() => remove(index)}
                iconName="close"
                ariaLabel={`Remove tag ${index + 1}`}
              />
            </Grid>
          ))}
          <Button onClick={() => append({ key: "", value: "" })} disabled={fields.length >= 50}>
            Add tag
          </Button>
        </SpaceBetween>
      </form>
    </Modal>
  );
}
