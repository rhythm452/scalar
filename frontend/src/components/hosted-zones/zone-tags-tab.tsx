"use client";

import { useState } from "react";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";
import { EditTagsModal } from "@/components/hosted-zones/edit-tags-modal";
import type { TagItem } from "@/types/tag";

export function ZoneTagsTab({ zoneId, tags }: { zoneId: string; tags: TagItem[] }) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <Table
        items={tags}
        columnDefinitions={[
          { id: "key", header: "Key", cell: (tag) => tag.key, isRowHeader: true },
          { id: "value", header: "Value", cell: (tag) => tag.value },
        ]}
        header={
          <Header actions={<Button onClick={() => setEditing(true)}>Edit tags</Button>}>
            Tags ({tags.length})
          </Header>
        }
        empty={
          <Box textAlign="center" color="inherit">
            <Box variant="strong">No tags</Box>
            <Box variant="p" color="inherit">
              This hosted zone has no tags.
            </Box>
          </Box>
        }
      />
      <EditTagsModal
        zoneId={zoneId}
        tags={tags}
        visible={editing}
        onDismiss={() => setEditing(false)}
      />
    </>
  );
}
