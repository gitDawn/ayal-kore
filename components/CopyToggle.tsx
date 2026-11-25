'use client';

// Reading-list button for one copy on a server-rendered book page.
import { ListToggle } from '@/components/ReadingList';
import { itemId, toggleItem, useReadingList } from '@/lib/readingList';
import type { BookRow } from '@/lib/inventory';

export default function CopyToggle({ row }: { row: BookRow }) {
  const list = useReadingList();
  return <ListToggle inList={list.some((i) => i.id === itemId(row))} onToggle={() => toggleItem(row)} />;
}
