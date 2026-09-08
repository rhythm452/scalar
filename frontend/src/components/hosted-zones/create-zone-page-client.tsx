"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import RadioGroup from "@cloudscape-design/components/radio-group";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useSetBreadcrumbs } from "@/components/shell/breadcrumbs-context";
import { useFlashbar } from "@/components/shell/flashbar-context";
import { useCreateHostedZone } from "@/hooks/use-create-hosted-zone";
import { isApiError } from "@/lib/error";
import { AWS_REGIONS } from "@/lib/aws-regions";
import {
  createHostedZoneFormSchema,
  type CreateHostedZoneFormValues,
} from "@/types/hosted-zone-forms";

export function CreateZonePageClient() {
  const router = useRouter();
  const { addFlash } = useFlashbar();
  const createZone = useCreateHostedZone();
  const [formError, setFormError] = useState<string | null>(null);

  useSetBreadcrumbs([
    { text: "Route 53", href: "/route53" },
    { text: "Hosted zones", href: "/route53/hostedzones" },
    { text: "Create", href: "/route53/hostedzones/create" },
  ]);

  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<CreateHostedZoneFormValues>({
    resolver: zodResolver(createHostedZoneFormSchema),
    defaultValues: { name: "", comment: "", type: "public", vpc_id: "", vpc_region: "" },
  });

  const type = watch("type");

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    createZone.mutate(
      {
        name: values.name,
        comment: values.comment || null,
        type: values.type,
        vpc_id: values.type === "private" ? values.vpc_id : null,
        vpc_region: values.type === "private" ? values.vpc_region : null,
      },
      {
        onSuccess: (response) => {
          addFlash({ type: "success", content: `Hosted zone created: ${response.zone.name}` });
          router.push(`/route53/hostedzones/${response.zone.id}`);
        },
        onError: (error) => {
          if (!isApiError(error)) {
            setFormError("Something went wrong. Please try again.");
            return;
          }
          if (error.code === "HostedZoneAlreadyExists") {
            setError("name", { message: error.message });
          } else if (error.message.toLowerCase().includes("domain name")) {
            setError("name", { message: error.message });
          } else if (error.message.toLowerCase().includes("description")) {
            setError("comment", { message: error.message });
          } else {
            setFormError(error.message);
          }
        },
      },
    );
  });

  return (
    <ContentLayout header={<Header variant="h1">Create hosted zone</Header>}>
      <form onSubmit={onSubmit} noValidate>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="none" onClick={() => router.push("/route53/hostedzones")}>
                Cancel
              </Button>
              <Button
                variant="primary"
                formAction="submit"
                loading={createZone.isPending}
                loadingText="Creating…"
              >
                Create hosted zone
              </Button>
            </SpaceBetween>
          }
        >
          <Container>
            <SpaceBetween size="l">
              {formError ? <Alert type="error">{formError}</Alert> : null}
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <FormField
                    label="Domain name"
                    description="Enter a fully qualified domain name, e.g. example.com."
                    errorText={errors.name?.message}
                    controlId="zone-name"
                  >
                    <Input
                      value={field.value}
                      onChange={({ detail }) => field.onChange(detail.value)}
                      onBlur={field.onBlur}
                      placeholder="example.com"
                      autoFocus
                    />
                  </FormField>
                )}
              />
              <Controller
                name="comment"
                control={control}
                render={({ field }) => (
                  <FormField
                    label="Description - optional"
                    errorText={errors.comment?.message}
                    constraintText={`${field.value.length}/256`}
                    controlId="zone-comment"
                  >
                    <Input
                      value={field.value}
                      onChange={({ detail }) => field.onChange(detail.value)}
                      onBlur={field.onBlur}
                    />
                  </FormField>
                )}
              />
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <FormField label="Type" controlId="zone-type">
                    <RadioGroup
                      value={field.value}
                      onChange={({ detail }) =>
                        field.onChange(detail.value as "public" | "private")
                      }
                      items={[
                        {
                          value: "public",
                          label: "Publicly routable in the internet",
                          description:
                            "A public hosted zone determines how traffic is routed on the internet.",
                        },
                        {
                          value: "private",
                          label: "Private hosted zone",
                          description:
                            "A private hosted zone determines how traffic is routed within one or more VPCs.",
                        },
                      ]}
                    />
                  </FormField>
                )}
              />
              {type === "private"
                ? [
                    <Controller
                      key="vpc_id"
                      name="vpc_id"
                      control={control}
                      render={({ field }) => (
                        <FormField
                          label="VPC ID"
                          errorText={errors.vpc_id?.message}
                          controlId="zone-vpc-id"
                        >
                          <Input
                            value={field.value}
                            onChange={({ detail }) => field.onChange(detail.value)}
                            onBlur={field.onBlur}
                            placeholder="vpc-1a2b3c4d"
                          />
                        </FormField>
                      )}
                    />,
                    <Controller
                      key="vpc_region"
                      name="vpc_region"
                      control={control}
                      render={({ field }) => (
                        <FormField
                          label="VPC region"
                          errorText={errors.vpc_region?.message}
                          controlId="zone-vpc-region"
                        >
                          <Select
                            selectedOption={
                              AWS_REGIONS.find((region) => region.value === field.value) ?? null
                            }
                            onChange={({ detail }) =>
                              field.onChange(detail.selectedOption.value ?? "")
                            }
                            options={AWS_REGIONS}
                            placeholder="Choose a region"
                          />
                        </FormField>
                      )}
                    />,
                  ]
                : null}
            </SpaceBetween>
          </Container>
        </Form>
      </form>
    </ContentLayout>
  );
}
