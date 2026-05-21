import { SettingsNav } from "@/components/settings/SettingsNav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-6 p-6">
      <SettingsNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
