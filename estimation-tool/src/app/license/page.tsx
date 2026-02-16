'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LicensePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/materials');
  }, [router]);

  return null;
}
