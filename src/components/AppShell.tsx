import { Sidebar } from "@/components/Sidebar";
import { SidebarFooter } from "@/components/SidebarFooter";
import { TopBar } from "@/components/TopBar";
import { getCurrentUser } from "@/lib/auth";
import { canAnywhere, type Permission } from "@/lib/permissions";

const NAV_PERMISSIONS: Permission[] = ["import:run"];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  const permissions = me ? NAV_PERMISSIONS.filter((p) => canAnywhere(me, p)) : [];
  return (
    <div className="flex h-screen print:block print:h-auto">
      <div className="contents print:hidden">
        <Sidebar footer={<SidebarFooter />} permissions={permissions} />
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
