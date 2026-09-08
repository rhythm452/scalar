"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Wizard from "@cloudscape-design/components/wizard";
import { useFlashbar } from "@/components/shell/flashbar-context";
import { useCreateRecordsBatch } from "@/hooks/use-create-records-batch";
import { isApiError } from "@/lib/error";
import { mapRecordErrorToField } from "@/lib/record-error-mapping";
import {
  defaultRecordFormValues,
  previewRecordName,
  recordFormSchema,
  recordFormToPayload,
  ROUTING_POLICY_LABELS,
  type RecordFormValues,
} from "@/types/record-forms";
import { RecordFormFields } from "@/components/records/record-form-fields";

// UI-PARITY §2 records/create (drafted, unverified against a screenshot per §7.3):
// Details -> Values -> Routing -> Review.
export function RecordWizard({
  zoneId,
  zoneName,
  onSwitchToQuickCreate,
}: {
  zoneId: string;
  zoneName: string;
  onSwitchToQuickCreate: () => void;
}) {
  const router = useRouter();
  const { addFlash } = useFlashbar();
  const createRecords = useCreateRecordsBatch(zoneId);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    watch,
    setError,
    trigger,
    formState: { errors },
  } = useForm<RecordFormValues>({
    resolver: zodResolver(recordFormSchema),
    defaultValues: defaultRecordFormValues(),
    mode: "onSubmit",
  });
  const values = watch();

  const fieldsForStep: Record<number, (keyof RecordFormValues)[]> = {
    0: ["subdomain", "type", "aliasTarget", "aliasHostedZoneId"],
    1: ["ttl", "valuesText", "aliasEvaluateTargetHealth"],
    2: ["routingPolicy", "setIdentifier", "weight", "region", "failover", "geoContinent", "geoCountry"],
  };

  const submit = () => {
    setSubmitError(null);
    createRecords.mutate([recordFormToPayload(values, zoneName)], {
      onSuccess: (response) => {
        addFlash({
          type: "success",
          content: `Record created: ${previewRecordName(values.subdomain, zoneName)} ${values.type} (Change ${response.change.id}, status ${response.change.status}).`,
          activity: {
            action: "Created",
            resourceType: "Record",
            resourceName: `${previewRecordName(values.subdomain, zoneName)} ${values.type}`,
            changeId: response.change.id,
            changeStatus: response.change.status,
          },
        });
        router.push(`/route53/hostedzones/${zoneId}?tab=records`);
      },
      onError: (error) => {
        if (!isApiError(error)) {
          setSubmitError("Something went wrong. Please try again.");
          return;
        }
        // The step-routing mapping below stays untouched; this single
        // announcement also toasts the failure and logs the error entry.
        addFlash({
          type: "error",
          content: `Record not created: ${previewRecordName(values.subdomain, zoneName)} (${error.code}).`,
          activity: {
            action: "Created",
            resourceType: "Record",
            resourceName: `${previewRecordName(values.subdomain, zoneName)} ${values.type}`,
          },
        });
        const field = mapRecordErrorToField(error);
        if (field) {
          setError(field, { message: error.message });
          // Route the wizard back to the step that owns the field in error.
          if (["subdomain", "type", "aliasTarget", "aliasHostedZoneId"].includes(field)) setStepIndex(0);
          else if (["ttl", "valuesText"].includes(field)) setStepIndex(1);
          else setStepIndex(2);
          return;
        }
        setSubmitError(error.message);
      },
    });
  };

  return (
    <Wizard
      i18nStrings={{
        stepNumberLabel: (step) => `Step ${step}`,
        collapsedStepsLabel: (step, total) => `Step ${step} of ${total}`,
        skipToButtonLabel: (step) => `Skip to ${step.title}`,
        navigationAriaLabel: "Steps",
        cancelButton: "Cancel",
        previousButton: "Previous",
        nextButton: "Next",
        submitButton: "Create record",
        optional: "optional",
      }}
      activeStepIndex={stepIndex}
      onNavigate={async ({ detail }) => {
        if (detail.requestedStepIndex > stepIndex) {
          const valid = await trigger(fieldsForStep[stepIndex]);
          if (!valid) return;
        }
        setStepIndex(detail.requestedStepIndex);
      }}
      onCancel={() => router.push(`/route53/hostedzones/${zoneId}?tab=records`)}
      onSubmit={submit}
      isLoadingNextStep={createRecords.isPending}
      steps={[
        {
          title: "Details",
          // Cloudscape renders a step's `description` inside a <p>; a <Box> (a <div>)
          // in there is invalid HTML and triggers a hydration mismatch, so this stays
          // inline-safe content only (docs/UI-PARITY.md §2 "Switch to quick create").
          description: <Link onFollow={onSwitchToQuickCreate}>Switch to quick create</Link>,
          content: (
            <Container header={<Header variant="h2">Record details</Header>}>
              <RecordFormFields
                control={control}
                errors={errors}
                values={values}
                zoneName={zoneName}
                section="identity"
              />
            </Container>
          ),
        },
        {
          title: "Values",
          content: (
            <Container header={<Header variant="h2">Record value</Header>}>
              <RecordFormFields
                control={control}
                errors={errors}
                values={values}
                zoneName={zoneName}
                section="values"
              />
            </Container>
          ),
        },
        {
          title: "Routing",
          content: (
            <Container header={<Header variant="h2">Routing policy</Header>}>
              <RecordFormFields
                control={control}
                errors={errors}
                values={values}
                zoneName={zoneName}
                section="routing"
              />
            </Container>
          ),
        },
        {
          title: "Review",
          content: (
            <Container header={<Header variant="h2">Review and create</Header>}>
              <SpaceBetween size="l">
                {submitError ? <Box color="text-status-error">{submitError}</Box> : null}
                <ColumnLayout columns={2} variant="text-grid">
                  <div>
                    <Box variant="awsui-key-label">Record name</Box>
                    <div>{previewRecordName(values.subdomain, zoneName)}</div>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Record type</Box>
                    <div>{values.type}</div>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Alias</Box>
                    <div>{values.isAlias ? "Yes" : "No"}</div>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">{values.isAlias ? "Alias target" : "TTL (seconds)"}</Box>
                    <div>{values.isAlias ? values.aliasTarget : values.ttl}</div>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Routing policy</Box>
                    <div>{ROUTING_POLICY_LABELS[values.routingPolicy]}</div>
                  </div>
                  {!values.isAlias ? (
                    <div>
                      <Box variant="awsui-key-label">Value</Box>
                      <div style={{ whiteSpace: "pre-wrap" }}>{values.valuesText}</div>
                    </div>
                  ) : null}
                </ColumnLayout>
              </SpaceBetween>
            </Container>
          ),
        },
      ]}
    />
  );
}
