"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect page for legacy /projects/create route
 * Redirects to /projects/submit which is the actual project creation page
 */
export default function CreateProjectRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/projects/submit");
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        <p className="mt-4 text-slate-400">Redirecting to project submission...</p>
      </div>
    </div>
  );
}
