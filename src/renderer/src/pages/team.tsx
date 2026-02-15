import { useState } from "react"
import {
  Users,
  Plus,
  Mail,
  Shield,
  MoreHorizontal,
  Crown,
  UserCheck,
  Eye,
  Clock,
  Search,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

type Role = "owner" | "admin" | "member" | "viewer"

interface TeamMember {
  id: string
  name: string
  email: string
  role: Role
  status: "active" | "invited" | "disabled"
  lastActive: string
  agents: string[]
  mfaEnabled: boolean
}

interface Invitation {
  id: string
  email: string
  role: Role
  sentAt: string
  expiresAt: string
}

const mockMembers: TeamMember[] = [
  {
    id: "1",
    name: "Caio Vicentino",
    email: "caio@orquestr.ai",
    role: "owner",
    status: "active",
    lastActive: "Now",
    agents: ["Main Assistant", "Support Agent", "Data Analyst", "DevOps Bot"],
    mfaEnabled: true,
  },
  {
    id: "2",
    name: "Ana Silva",
    email: "ana@orquestr.ai",
    role: "admin",
    status: "active",
    lastActive: "10 min ago",
    agents: ["Main Assistant", "Support Agent"],
    mfaEnabled: true,
  },
  {
    id: "3",
    name: "Pedro Santos",
    email: "pedro@orquestr.ai",
    role: "member",
    status: "active",
    lastActive: "1 hour ago",
    agents: ["Support Agent"],
    mfaEnabled: false,
  },
  {
    id: "4",
    name: "Julia Costa",
    email: "julia@orquestr.ai",
    role: "member",
    status: "active",
    lastActive: "3 hours ago",
    agents: ["Data Analyst"],
    mfaEnabled: true,
  },
  {
    id: "5",
    name: "Lucas Oliveira",
    email: "lucas@orquestr.ai",
    role: "viewer",
    status: "disabled",
    lastActive: "30 days ago",
    agents: [],
    mfaEnabled: false,
  },
]

const mockInvitations: Invitation[] = [
  {
    id: "inv-1",
    email: "maria@orquestr.ai",
    role: "member",
    sentAt: "2 hours ago",
    expiresAt: "in 46 hours",
  },
  {
    id: "inv-2",
    email: "rafael@orquestr.ai",
    role: "admin",
    sentAt: "1 day ago",
    expiresAt: "in 24 hours",
  },
]

const roleConfig: Record<Role, { label: string; icon: typeof Crown; color: string }> = {
  owner: { label: "Owner", icon: Crown, color: "text-amber-400" },
  admin: { label: "Admin", icon: Shield, color: "text-blue-400" },
  member: { label: "Member", icon: UserCheck, color: "text-emerald-400" },
  viewer: { label: "Viewer", icon: Eye, color: "text-zinc-400" },
}

export function TeamPage() {
  const [members] = useState<TeamMember[]>(mockMembers)
  const [invitations] = useState<Invitation[]>(mockInvitations)

  const activeCount = members.filter((m) => m.status === "active").length
  const mfaCount = members.filter((m) => m.mfaEnabled).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage team members and access permissions
          </p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Invite Member
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Members" value={String(members.length)} />
        <StatCard label="Active" value={String(activeCount)} />
        <StatCard label="Pending Invites" value={String(invitations.length)} />
        <StatCard label="MFA Enabled" value={`${mfaCount}/${members.length}`} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Members</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search members..."
                  className="h-8 w-[200px] rounded-md border bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_100px_100px_120px_80px_40px] gap-4 px-3 py-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Member</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Role</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Last Active</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">MFA</span>
              <span />
            </div>
            <Separator />
            {members.map((member) => {
              const role = roleConfig[member.role]
              const RoleIcon = role.icon
              return (
                <div
                  key={member.id}
                  className="grid grid-cols-[1fr_100px_100px_120px_80px_40px] gap-4 px-3 py-2.5 rounded-md hover:bg-accent/30 transition-colors items-center"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium">
                        {member.name.split(" ").map((n) => n[0]).join("")}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RoleIcon className={`h-3.5 w-3.5 ${role.color}`} />
                    <span className="text-xs">{role.label}</span>
                  </div>
                  <div>
                    <Badge
                      variant={member.status === "active" ? "success" : member.status === "invited" ? "warning" : "secondary"}
                      className="text-[10px]"
                    >
                      {member.status === "active" ? "Active" : member.status === "invited" ? "Invited" : "Disabled"}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{member.lastActive}</span>
                  <div>
                    {member.mfaEnabled ? (
                      <Badge variant="success" className="text-[10px]">On</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Off</Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pending Invitations</CardTitle>
            <CardDescription>Invitations awaiting acceptance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-md bg-accent/20">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{inv.email}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Sent {inv.sentAt} · Expires {inv.expiresAt}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {roleConfig[inv.role].label}
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive">
                      Revoke
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      Resend
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}
