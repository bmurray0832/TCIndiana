import { Sidebar } from "@/components/Sidebar";
import { SidebarFooter } from "@/components/SidebarFooter";
import { TopBar } from "@/components/TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar footer={<SidebarFooter />} />
      <main className="flex flex-1 flex-col overflow-y-auto bg-background">
        <TopBar />
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
