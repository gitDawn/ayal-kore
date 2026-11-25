'use server';

import { revalidatePath } from 'next/cache';

/** Make the public search page pick up a newly published inventory right away. */
export async function refreshCatalog() {
  revalidatePath('/');
}
