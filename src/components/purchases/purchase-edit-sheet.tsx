"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { updatePurchaseSchema, type UpdatePurchaseInput } from "@/lib/schemas/purchase";
import { updatePurchaseAction } from "@/actions/purchase";
import { PurchaseStatus } from "@/types/purchase";
import type { PurchaseWithCount } from "@/types/purchase";
import { cn } from "@/lib/utils";
import { clientLogger } from "@/lib/client-logger";

interface PurchaseEditSheetProps {
  purchase: PurchaseWithCount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseEditSheet({ purchase, open, onOpenChange }: PurchaseEditSheetProps) {
  const form = useForm<UpdatePurchaseInput>({
    resolver: zodResolver(updatePurchaseSchema),
    defaultValues: {
      storeName: purchase.storeName ?? "",
      boughtAt: purchase.boughtAt ? new Date(purchase.boughtAt).toISOString() : null,
      status: purchase.status ?? PurchaseStatus.NEEDS_REVIEW,
    },
  });

  const selectedDate = form.watch("boughtAt");
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(data: UpdatePurchaseInput) {
    const result = await updatePurchaseAction(purchase.id, data);

    if (!result.success) {
      clientLogger.error("Failed to update purchase", result.error, { purchaseId: purchase.id });
      return;
    }

    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[425px]">
        <SheetHeader>
          <SheetTitle>Edit Purchase</SheetTitle>
          <SheetDescription>Make changes to the purchase details.</SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="storeName">Store Name</Label>
            <Input id="storeName" placeholder="Enter store name" {...form.register("storeName")} />
            {form.formState.errors.storeName && (
              <p className="text-sm text-destructive">{form.formState.errors.storeName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Purchase Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(new Date(selectedDate), "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate ? new Date(selectedDate) : undefined}
                  onSelect={(date) => form.setValue("boughtAt", date ? date.toISOString() : null)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={form.watch("status")?.toString()}
              onValueChange={(value) => form.setValue("status", parseInt(value, 10))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PurchaseStatus.APPROVED.toString()}>Approved</SelectItem>
                <SelectItem value={PurchaseStatus.NEEDS_REVIEW.toString()}>Needs Review</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
