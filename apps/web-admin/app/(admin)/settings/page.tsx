import { TopBar } from '../../../components/layout/TopBar';
import { PlatformSettings } from './PlatformSettings';

export default function AdminSettingsPage() {
  return (
    <>
      <TopBar title="Platform settings" />
      <main className="flex-1 p-6 max-w-2xl">
        <PlatformSettings />
      </main>
    </>
  );
}
