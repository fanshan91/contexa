'use server';

import { redirect } from 'next/navigation';

export async function customerPortalAction() {
  redirect('/dashboard');
}

