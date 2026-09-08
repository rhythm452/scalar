import { z } from "zod";

// Lightweight client-side mirror of docs/ROUTE53-DOMAIN-RULES.md R5/R9/R10; the
// backend (app/core/dns_names.py normalise_zone_name) remains authoritative and is
// the source of the actual 400 InvalidInput on a bad name.
const DOMAIN_NAME_PATTERN = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?\.?$/i;
const COMMENT_MAX = 256;

export const createHostedZoneFormSchema = z
  .object({
    name: z
      .string()
      .min(1, "Domain name is required")
      .max(253, "Domain name must be 253 characters or fewer")
      .regex(DOMAIN_NAME_PATTERN, "Enter a fully qualified domain name, e.g. example.com."),
    comment: z.string().max(COMMENT_MAX, `Description must be ${COMMENT_MAX} characters or fewer.`),
    type: z.enum(["public", "private"]),
    vpc_id: z.string(),
    vpc_region: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.type !== "private") return;
    if (!values.vpc_id.trim()) {
      ctx.addIssue({ code: "custom", path: ["vpc_id"], message: "VPC ID is required" });
    }
    if (!values.vpc_region.trim()) {
      ctx.addIssue({ code: "custom", path: ["vpc_region"], message: "VPC region is required" });
    }
  });

export type CreateHostedZoneFormValues = z.infer<typeof createHostedZoneFormSchema>;

export const editZoneCommentFormSchema = z.object({
  comment: z.string().max(COMMENT_MAX, `Description must be ${COMMENT_MAX} characters or fewer.`),
});

export type EditZoneCommentFormValues = z.infer<typeof editZoneCommentFormSchema>;

const tagRowSchema = z.object({
  key: z.string().min(1, "Key is required").max(128, "Key must be 128 characters or fewer"),
  value: z.string().max(256, "Value must be 256 characters or fewer"),
});

export const editTagsFormSchema = z.object({
  tags: z
    .array(tagRowSchema)
    .max(50, "A resource may have at most 50 tags")
    .superRefine((tags, ctx) => {
      const seen = new Set<string>();
      tags.forEach((tag, index) => {
        if (seen.has(tag.key)) {
          ctx.addIssue({
            code: "custom",
            path: [index, "key"],
            message: `Duplicate tag key ${tag.key}.`,
          });
        }
        seen.add(tag.key);
      });
    }),
});

export type EditTagsFormValues = z.infer<typeof editTagsFormSchema>;
