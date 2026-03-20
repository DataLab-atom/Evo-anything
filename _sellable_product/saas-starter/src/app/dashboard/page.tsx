import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3, Users, FolderOpen, TrendingUp } from "lucide-react";

const stats = [
  {
    title: "Total Projects",
    value: "12",
    change: "+2 from last month",
    icon: FolderOpen,
  },
  {
    title: "Team Members",
    value: "4",
    change: "+1 from last month",
    icon: Users,
  },
  {
    title: "Total Views",
    value: "2,345",
    change: "+18% from last month",
    icon: BarChart3,
  },
  {
    title: "Growth",
    value: "+12.5%",
    change: "Compared to last quarter",
    icon: TrendingUp,
  },
];

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome back, {session?.user?.name?.split(" ")[0] || "there"}
        </h2>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your account and recent activity.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Your latest actions and updates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: "Created project", detail: "Marketing Site", time: "2 hours ago" },
                { action: "Invited member", detail: "jane@example.com", time: "5 hours ago" },
                { action: "Updated settings", detail: "API key rotated", time: "1 day ago" },
                { action: "Created project", detail: "Mobile App", time: "3 days ago" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks to get you started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {[
                { title: "Create a new project", description: "Set up a new project workspace" },
                { title: "Invite team members", description: "Collaborate with your team" },
                { title: "Configure integrations", description: "Connect your favorite tools" },
                { title: "Upgrade your plan", description: "Unlock premium features" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-accent cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <span className="text-sm font-bold text-primary">
                      {i + 1}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
