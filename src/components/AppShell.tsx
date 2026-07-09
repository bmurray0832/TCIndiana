import { Sidebar } from "@/components/Sidebar";
import { SidebarFooter } from "@/components/SidebarFooter";
import { TopBar } from "@/components/TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen print:block print:h-auto">
      <div className="contents print:hidden">
        <Sidebar footer={<SidebarFooter />} />
      </div>
      <main className="flex flex-1 flex-col overflow-y-auto bg-background print:overflow-visible">
        <div className="print:hidden">
          <TopBar />
        </div>
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
