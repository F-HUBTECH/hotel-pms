"use client";

import { useState, useEffect } from "react";
import { getAllUsersWithRights, FUNCTION_CODES, grantRight } from "@/lib/actions/user-rights";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, User, Settings } from "lucide-react";
import { toast } from "sonner";

interface UserWithRights {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  rights: {
    id: string;
    function_code: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
    can_print: boolean;
  }[];
}

const FUNCTION_LABELS: Record<string, string> = {
  KO39: "Payment / ชำระเงิน",
  KO40: "Void / ยกเลิก",
  KO41: "Post Charge / บันทึกค่าใช้จ่าย",
  KO42: "Transfer / โอนระหว่าง Folio",
  KO43: "Folio Setup / ตั้งค่า Folio",
  KO44: "Checkout / ออกจากห้อง",
  KO45: "Credit Note / ออก Credit Note",
  KO46: "Correction / ปรับปรุงรายการ",
  KO47: "Split / แยกรายการ",
  KO48: "Tax Invoice / ใบกำกับภาษี",
  KO50: "Fast Posting",
  KO51: "Dummy Room Folio",
  KO52: "Advance Payment / รับเงินล่วงหน้า",
};

export default function UserRightsPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithRights[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithRights | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editRights, setEditRights] = useState<Record<string, boolean>>({});

  const loadUsers = async () => {
    setLoading(true);
    const data = await getAllUsersWithRights();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openEdit = (user: UserWithRights) => {
    setSelectedUser(user);
    const rights: Record<string, boolean> = {};
    for (const code of Object.values(FUNCTION_CODES)) {
      const existing = user.rights.find(r => r.function_code === code);
      rights[code] = existing?.can_view ?? false;
    }
    setEditRights(rights);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);

    for (const [code, canView] of Object.entries(editRights)) {
      const result = await grantRight(selectedUser.userId, code, {
        can_view: canView,
        can_create: canView,
        can_edit: canView,
        can_delete: canView,
        can_print: canView,
      });
      if (!result.success) {
        toast.error(`Failed to update ${code}: ${result.error}`);
      }
    }

    toast.success("Rights updated successfully");
    setSaving(false);
    setEditOpen(false);
    loadUsers();
  };

  const toggleRight = (code: string) => {
    setEditRights(prev => ({ ...prev, [code]: !prev[code] }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-indigo-600" />
            User Rights / สิทธิ์การใช้งาน
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage user permissions for each function</p>
        </div>
        <Button variant="outline" onClick={loadUsers}>
          <Settings className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" /> Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Rights Count</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell className="font-medium">{user.fullName || "N/A"}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.rights.length} rights</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(user)}
                      >
                        Edit Rights
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Rights Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Rights for {selectedUser?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.entries(FUNCTION_CODES).map(([key, code]) => (
              <div key={code} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                <div>
                  <div className="font-medium text-sm">{FUNCTION_LABELS[code] || code}</div>
                  <div className="text-xs text-slate-500">{code}</div>
                </div>
                <Checkbox
                  checked={editRights[code] ?? false}
                  onCheckedChange={() => toggleRight(code)}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}