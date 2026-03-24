"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type RightType = "can_view" | "can_create" | "can_edit" | "can_delete" | "can_print";

export interface UserRight {
  id: string;
  user_id: string;
  function_code: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_print: boolean;
}

// ─────────────────────────────────────────────
// Check if current user has a specific right
// ─────────────────────────────────────────────
export async function checkRight(
  functionCode: string,
  rightType: RightType = "can_view"
): Promise<boolean> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Admin always has all rights
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") return true;

  // Check specific right
  const { data, error } = await supabase
    .from("user_rights")
    .select(rightType)
    .eq("user_id", user.id)
    .eq("function_code", functionCode)
    .single();

  if (error || !data) return false;
  return data[rightType] ?? false;
}

// ─────────────────────────────────────────────
// Check multiple rights at once
// ─────────────────────────────────────────────
export async function checkMultipleRights(
  rights: { functionCode: string; rightType: RightType }[]
): Promise<Record<string, boolean>> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  // Admin has all rights
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    const result: Record<string, boolean> = {};
    for (const r of rights) {
      result[`${r.functionCode}:${r.rightType}`] = true;
    }
    return result;
  }

  // Get all rights for this user
  const { data: userRights } = await supabase
    .from("user_rights")
    .select("*")
    .eq("user_id", user.id);

  const rightsMap: Record<string, UserRight> = {};
  for (const ur of (userRights ?? [])) {
    rightsMap[ur.function_code] = ur;
  }

  const result: Record<string, boolean> = {};
  for (const r of rights) {
    const userRight = rightsMap[r.functionCode];
    result[`${r.functionCode}:${r.rightType}`] = userRight?.[r.rightType] ?? false;
  }

  return result;
}

// ─────────────────────────────────────────────
// Grant rights to a user (admin only)
// ─────────────────────────────────────────────
export async function grantRight(
  targetUserId: string,
  functionCode: string,
  rights: {
    can_view?: boolean;
    can_create?: boolean;
    can_edit?: boolean;
    can_delete?: boolean;
    can_print?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // Check if current user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { success: false, error: "Only admin can manage rights" };
  }

  const { error } = await supabase.rpc("grant_user_right", {
    p_user_id: targetUserId,
    p_function_code: functionCode,
    p_can_view: rights.can_view ?? false,
    p_can_create: rights.can_create ?? false,
    p_can_edit: rights.can_edit ?? false,
    p_can_delete: rights.can_delete ?? false,
    p_can_print: rights.can_print ?? false,
  });

  if (error) return { success: false, error: error.message };
  
  revalidatePath("/dashboard");
  return { success: true };
}

// ─────────────────────────────────────────────
// Get all rights for a user
// ─────────────────────────────────────────────
export async function getUserRights(userId?: string): Promise<UserRight[]> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  const targetUserId = userId || user?.id;
  
  if (!targetUserId) return [];

  const { data, error } = await supabase
    .from("user_rights")
    .select("*")
    .eq("user_id", targetUserId);

  if (error) return [];
  return data ?? [];
}

// ─────────────────────────────────────────────
// Get all users with their rights (admin only)
// ─────────────────────────────────────────────
export async function getAllUsersWithRights(): Promise<{
  userId: string;
  email: string;
  fullName: string;
  role: string;
  rights: UserRight[];
}[]> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Check if current user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, role");

  const { data: allRights } = await supabase
    .from("user_rights")
    .select("*");

  const rightsMap: Record<string, UserRight[]> = {};
  for (const r of (allRights ?? [])) {
    if (!rightsMap[r.user_id]) rightsMap[r.user_id] = [];
    rightsMap[r.user_id].push(r);
  }

  return (profiles ?? []).map(p => ({
    userId: p.id,
    email: p.email ?? "",
    fullName: p.full_name ?? "",
    role: p.role ?? "user",
    rights: rightsMap[p.id] ?? [],
  }));
}