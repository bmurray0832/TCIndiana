import { Sidebar } from "@/components/Sidebar";
import { SidebarFooter } from "@/components/SidebarFooter";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar footer={<SidebarFooter />} />
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}
