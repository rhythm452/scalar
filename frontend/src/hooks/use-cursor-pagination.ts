"use client";

import { useCallback, useRef, useState } from "react";

// Route 53 lists paginate via an opaque cursor (docs/API.md §9), which doesn't fit
// Cloudscape Pagination's page-index model directly. We keep a token stack in memory
// so "Previous" can replay a token we've already seen; a hard reload deep-linked past
// page 1 loses that history (Previous is simply disabled), the same limitation the
// real AWS console pagination has for arbitrary page jumps. Shared by the hosted-zones
// list (Phase 4) and the records tab (Phase 4 read-only, Phase 5 full CRUD).
export function useCursorPagination() {
  const [pageIndex, setPageIndex] = useState(1);
  const tokenStack = useRef<string[]>([]);

  const currentToken = pageIndex === 1 ? undefined : tokenStack.current[pageIndex - 2];

  const goToNextPage = useCallback((nextToken: string) => {
    setPageIndex((page) => {
      tokenStack.current[page - 1] = nextToken;
      return page + 1;
    });
  }, []);

  const goToPreviousPage = useCallback(() => {
    setPageIndex((page) => Math.max(1, page - 1));
  }, []);

  const reset = useCallback(() => {
    tokenStack.current = [];
    setPageIndex(1);
  }, []);

  return { pageIndex, currentToken, goToNextPage, goToPreviousPage, reset };
}
