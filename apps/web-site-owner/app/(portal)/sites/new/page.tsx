import { redirect } from 'next/navigation';

// /sites/new redirects to the onboarding wizard
export default function NewSitePage() {
  redirect('/onboarding');
}
