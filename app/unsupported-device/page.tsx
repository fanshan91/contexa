import { redirect } from 'next/navigation';

export default async function UnsupportedDevicePage() {
  redirect('/');
}
