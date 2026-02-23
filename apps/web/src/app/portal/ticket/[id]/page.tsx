'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Redirect portal ticket view to dashboard ticket view
export default function PortalTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/dashboard/tickets/${id}`);
  }, [id, router]);

  return null;
}
