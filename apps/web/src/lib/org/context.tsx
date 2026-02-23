'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
}

export interface OrgContextValue {
  currentOrg: OrgInfo | null;
  currentRole: string | null;
  currentDepartment: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue>({
  currentOrg: null,
  currentRole: null,
  currentDepartment: null,
  loading: true,
  refetch: async () => {},
});

export function OrgProvider({ children }: { children: ReactNode }) {
  const [currentOrg, setCurrentOrg] = useState<OrgInfo | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [currentDepartment, setCurrentDepartment] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrgMembership = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCurrentOrg(null);
        setCurrentRole(null);
        setCurrentDepartment(null);
        return;
      }

      const { data: membership, error } = await supabase
        .from('org_members')
        .select('org_id, role, department, organizations(id, name, slug, settings)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (error || !membership) {
        setCurrentOrg(null);
        setCurrentRole(null);
        setCurrentDepartment(null);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const org = (membership as any).organizations;
      if (org) {
        setCurrentOrg({
          id: org.id,
          name: org.name,
          slug: org.slug,
          settings: org.settings ?? {},
        });
      }

      setCurrentRole(membership.role);
      setCurrentDepartment(membership.department ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgMembership();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchOrgMembership();
      } else if (event === 'SIGNED_OUT') {
        setCurrentOrg(null);
        setCurrentRole(null);
        setCurrentDepartment(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <OrgContext.Provider
      value={{
        currentOrg,
        currentRole,
        currentDepartment,
        loading,
        refetch: fetchOrgMembership,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextValue {
  return useContext(OrgContext);
}
