"use client";

import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface AttachmentSheetProps {
  title: string;
  children: React.ReactNode;
}

export function AttachmentSheet({ title, children }: AttachmentSheetProps) {
  const router = useRouter();

  return (
    <Sheet open onOpenChange={() => router.back()}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="truncate">{title}</SheetTitle>
          <SheetDescription>Visualização do anexo</SheetDescription>
        </SheetHeader>
        <div className="py-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
