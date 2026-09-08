"use client";

import { Controller, type Control, type FieldErrors, type FieldValues, type Path } from "react-hook-form";
import Box from "@cloudscape-design/components/box";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import RadioGroup from "@cloudscape-design/components/radio-group";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Toggle from "@cloudscape-design/components/toggle";
import { AWS_REGIONS } from "@/lib/aws-regions";
import {
  RECORD_TYPES,
  ROUTING_POLICIES,
  ROUTING_POLICY_LABELS,
  previewRecordName,
  type RecordFormValues,
} from "@/types/record-forms";

const TYPE_HELP: Record<string, string> = {
  A: "One IPv4 address per line, e.g. 192.0.2.1",
  AAAA: "One IPv6 address per line, e.g. 2001:db8::1",
  CNAME: "A single hostname, e.g. app.example.com.",
  TXT: 'One quoted string per line, e.g. "v=spf1 -all"',
  MX: "One \"<priority> <hostname>\" per line, e.g. 10 mail.example.com.",
  NS: "One hostname per line, e.g. ns1.example.com.",
  PTR: "One hostname per line, e.g. host.example.com.",
  SRV: "One \"<priority> <weight> <port> <target>\" per line, e.g. 10 60 5060 sip.example.com.",
  CAA: 'One "<flags> <tag> <value>" per line, e.g. 0 issue "letsencrypt.org"',
  SOA: "Managed automatically -- cannot be created directly.",
  NAPTR: "One \"order preference flags service regexp replacement\" per line.",
  SPF: 'One quoted string per line, e.g. "v=spf1 -all"',
  DS: "One \"<keytag> <algorithm> <digesttype> <digest hex>\" per line.",
};

const FAILOVER_OPTIONS = [
  { value: "PRIMARY", label: "Primary" },
  { value: "SECONDARY", label: "Secondary" },
];

interface RecordFormFieldsProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  errors: FieldErrors<RecordFormValues>;
  values: RecordFormValues;
  zoneName: string;
  section: "identity" | "values" | "routing";
  identityDisabled?: boolean;
  // "" when the form's root is a single RecordFormValues (wizard, edit); the
  // dotted array path (e.g. "records.0.") when nested under quick create's
  // useFieldArray -- lets one component target either form shape.
  namePrefix?: string;
}

// Shared by quick create, the wizard (one section per step), and the edit
// SplitPanel -- one validated model, three presentations (Phase 5 Part C/D).
export function RecordFormFields<TFieldValues extends FieldValues>({
  control,
  errors,
  values,
  zoneName,
  section,
  identityDisabled = false,
  namePrefix = "",
}: RecordFormFieldsProps<TFieldValues>) {
  const field = (suffix: keyof RecordFormValues): Path<TFieldValues> =>
    `${namePrefix}${suffix}` as Path<TFieldValues>;

  if (section === "identity") {
    return (
      <SpaceBetween size="l">
        <Controller
          name={field("subdomain")}
          control={control}
          render={({ field }) => (
            <FormField
              label="Record name"
              description={`Full name: ${previewRecordName(values.subdomain, zoneName)}`}
              errorText={errors.subdomain?.message}
              controlId={`${namePrefix}record-subdomain`}
            >
              <Input
                value={field.value}
                onChange={({ detail }) => field.onChange(detail.value)}
                onBlur={field.onBlur}
                placeholder="www"
                disabled={identityDisabled}
                autoFocus={!identityDisabled}
              />
            </FormField>
          )}
        />
        <Controller
          name={field("type")}
          control={control}
          render={({ field }) => (
            <FormField label="Record type" controlId={`${namePrefix}record-type`}>
              <Select
                selectedOption={{ value: field.value, label: field.value }}
                onChange={({ detail }) =>
                  field.onChange(detail.selectedOption.value as RecordFormValues["type"])
                }
                options={RECORD_TYPES.map((type) => ({ value: type, label: type }))}
                disabled={identityDisabled}
              />
            </FormField>
          )}
        />
        <Controller
          name={field("isAlias")}
          control={control}
          render={({ field }) => (
            <Toggle checked={field.value} onChange={({ detail }) => field.onChange(detail.checked)}>
              Alias
            </Toggle>
          )}
        />
        {values.isAlias ? (
          <SpaceBetween size="l">
            <Controller
              name={field("aliasTarget")}
              control={control}
              render={({ field }) => (
                <FormField
                  label="Alias target"
                  errorText={errors.aliasTarget?.message}
                  controlId={`${namePrefix}record-alias-target`}
                >
                  <Input
                    value={field.value}
                    onChange={({ detail }) => field.onChange(detail.value)}
                    onBlur={field.onBlur}
                    placeholder="target.example.com."
                  />
                </FormField>
              )}
            />
            <Controller
              name={field("aliasHostedZoneId")}
              control={control}
              render={({ field }) => (
                <FormField
                  label="Alias hosted zone ID - optional"
                  errorText={errors.aliasHostedZoneId?.message}
                  controlId={`${namePrefix}record-alias-hosted-zone-id`}
                >
                  <Input
                    value={field.value}
                    onChange={({ detail }) => field.onChange(detail.value)}
                    onBlur={field.onBlur}
                  />
                </FormField>
              )}
            />
          </SpaceBetween>
        ) : null}
      </SpaceBetween>
    );
  }

  if (section === "values") {
    return (
      <SpaceBetween size="l">
        {values.isAlias ? (
          <Controller
            name={field("aliasEvaluateTargetHealth")}
            control={control}
            render={({ field }) => (
              <FormField label="Evaluate target health" controlId={`${namePrefix}record-evaluate-target-health`}>
                <RadioGroup
                  value={field.value ? "yes" : "no"}
                  onChange={({ detail }) => field.onChange(detail.value === "yes")}
                  items={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                />
              </FormField>
            )}
          />
        ) : (
          <SpaceBetween size="l">
            <Controller
              name={field("ttl")}
              control={control}
              render={({ field }) => (
                <FormField label="TTL (seconds)" errorText={errors.ttl?.message} controlId={`${namePrefix}record-ttl`}>
                  <Input
                    value={field.value}
                    onChange={({ detail }) => field.onChange(detail.value)}
                    onBlur={field.onBlur}
                    inputMode="numeric"
                    type="number"
                  />
                </FormField>
              )}
            />
            <Controller
              name={field("valuesText")}
              control={control}
              render={({ field }) => (
                <FormField
                  label="Value"
                  description={TYPE_HELP[values.type]}
                  errorText={errors.valuesText?.message}
                  controlId={`${namePrefix}record-values`}
                >
                  <Textarea
                    value={field.value}
                    onChange={({ detail }) => field.onChange(detail.value)}
                    onBlur={field.onBlur}
                    rows={4}
                    placeholder={
                      values.type === "A" ? "192.0.2.1\n192.0.2.2" : "One value per line"
                    }
                  />
                </FormField>
              )}
            />
          </SpaceBetween>
        )}
      </SpaceBetween>
    );
  }

  return (
    <SpaceBetween size="l">
      <Controller
        name={field("routingPolicy")}
        control={control}
        render={({ field }) => (
          <FormField label="Routing policy" controlId={`${namePrefix}record-routing-policy`}>
            <Select
              selectedOption={{ value: field.value, label: ROUTING_POLICY_LABELS[field.value] }}
              onChange={({ detail }) =>
                field.onChange(detail.selectedOption.value as RecordFormValues["routingPolicy"])
              }
              options={ROUTING_POLICIES.map((policy) => ({
                value: policy,
                label: ROUTING_POLICY_LABELS[policy],
              }))}
            />
          </FormField>
        )}
      />
      {values.routingPolicy !== "simple" ? (
        <Controller
          name={field("setIdentifier")}
          control={control}
          render={({ field }) => (
            <FormField
              label="Set identifier"
              description="Unique among records with the same name and type."
              errorText={errors.setIdentifier?.message}
              controlId={`${namePrefix}record-set-identifier`}
            >
              <Input
                value={field.value}
                onChange={({ detail }) => field.onChange(detail.value)}
                onBlur={field.onBlur}
              />
            </FormField>
          )}
        />
      ) : null}
      {values.routingPolicy === "weighted" ? (
        <Controller
          name={field("weight")}
          control={control}
          render={({ field }) => (
            <FormField label="Weight" errorText={errors.weight?.message} controlId={`${namePrefix}record-weight`}>
              <Input
                value={field.value}
                onChange={({ detail }) => field.onChange(detail.value)}
                onBlur={field.onBlur}
                inputMode="numeric"
                type="number"
              />
            </FormField>
          )}
        />
      ) : null}
      {values.routingPolicy === "latency" ? (
        <Controller
          name={field("region")}
          control={control}
          render={({ field }) => (
            <FormField label="Region" errorText={errors.region?.message} controlId={`${namePrefix}record-region`}>
              <Select
                selectedOption={AWS_REGIONS.find((region) => region.value === field.value) ?? null}
                onChange={({ detail }) => field.onChange(detail.selectedOption.value ?? "")}
                options={AWS_REGIONS}
                placeholder="Choose a region"
              />
            </FormField>
          )}
        />
      ) : null}
      {values.routingPolicy === "failover" ? (
        <Controller
          name={field("failover")}
          control={control}
          render={({ field }) => (
            <FormField
              label="Failover record type"
              errorText={errors.failover?.message}
              controlId={`${namePrefix}record-failover`}
            >
              <Select
                selectedOption={FAILOVER_OPTIONS.find((option) => option.value === field.value) ?? null}
                onChange={({ detail }) =>
                  field.onChange(detail.selectedOption.value as "PRIMARY" | "SECONDARY")
                }
                options={FAILOVER_OPTIONS}
                placeholder="Choose Primary or Secondary"
              />
            </FormField>
          )}
        />
      ) : null}
      {values.routingPolicy === "geolocation" ? (
        <SpaceBetween size="l">
          <Box variant="small" color="text-body-secondary">
            Provide a continent, or a country (optionally with a subdivision).
          </Box>
          <Controller
            name={field("geoContinent")}
            control={control}
            render={({ field }) => (
              <FormField
                label="Continent code - optional"
                errorText={errors.geoContinent?.message}
                controlId={`${namePrefix}record-geo-continent`}
              >
                <Input
                  value={field.value}
                  onChange={({ detail }) => field.onChange(detail.value)}
                  onBlur={field.onBlur}
                  placeholder="NA"
                />
              </FormField>
            )}
          />
          <Controller
            name={field("geoCountry")}
            control={control}
            render={({ field }) => (
              <FormField
                label="Country code - optional"
                errorText={errors.geoCountry?.message}
                controlId={`${namePrefix}record-geo-country`}
              >
                <Input
                  value={field.value}
                  onChange={({ detail }) => field.onChange(detail.value)}
                  onBlur={field.onBlur}
                  placeholder="US"
                />
              </FormField>
            )}
          />
          <Controller
            name={field("geoSubdivision")}
            control={control}
            render={({ field }) => (
              <FormField
                label="Subdivision code - optional"
                errorText={errors.geoSubdivision?.message}
                controlId={`${namePrefix}record-geo-subdivision`}
              >
                <Input
                  value={field.value}
                  onChange={({ detail }) => field.onChange(detail.value)}
                  onBlur={field.onBlur}
                  placeholder="WA"
                />
              </FormField>
            )}
          />
        </SpaceBetween>
      ) : null}
    </SpaceBetween>
  );
}
