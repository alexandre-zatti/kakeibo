"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AttachmentModalProps {
  title: string;
  children: React.ReactNode;
}

export function AttachmentModal({ title, children }: AttachmentModalProps) {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={() => router.back()}>
      <DialogContent className="flex h-[85vh] max-w-5xl flex-col">
        <DialogHeader>
          <DialogTitle className="truncate">{title}</DialogTitle>
          <DialogDescription>Visualização do anexo</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
