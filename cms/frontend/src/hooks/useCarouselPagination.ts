"use client";

import { useEffect, useMemo, useState } from "react";

export function useCarouselPagination<T>(items: readonly T[], baseItemsPerPage = 5) {
  const [itemsPerPage, setItemsPerPage] = useState(baseItemsPerPage);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 640) setItemsPerPage(Math.min(2, baseItemsPerPage));
      else if (window.innerWidth < 1024) setItemsPerPage(Math.min(3, baseItemsPerPage));
      else setItemsPerPage(baseItemsPerPage);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [baseItemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));

  // Auto-correct current page if items are deleted or itemsPerPage changes
  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [currentPage, totalPages]);

  const pages = useMemo(() => {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += itemsPerPage) {
      chunks.push(items.slice(i, i + itemsPerPage));
    }
    return chunks;
  }, [items, itemsPerPage]);

  function nextPage() {
    setCurrentPage((curr) => Math.min(totalPages - 1, curr + 1));
  }

  function prevPage() {
    setCurrentPage((curr) => Math.max(0, curr - 1));
  }

  function goToPage(page: number) {
    setCurrentPage(Math.max(0, Math.min(totalPages - 1, page)));
  }

  return {
    pages,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    goToPage,
  };
}
