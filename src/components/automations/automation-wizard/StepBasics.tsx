"use client";

import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { CreateAutomationInput } from "@/models/automation.schema";
import type { JobBoard } from "@/models/automation.model";
import { migrateAtsConfigOnBoardChange } from "./wizardConfig";

export function StepBasics({
  form,
}: {
  form: UseFormReturn<CreateAutomationInput>;
}) {
  return (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Automation Name</FormLabel>
            <FormControl>
              <Input placeholder="e.g., Full Stack Jobs Calgary" {...field} />
            </FormControl>
            <FormDescription>
              A descriptive name to identify this automation
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="jobBoard"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Job Board</FormLabel>
            <Select
              value={field.value}
              onValueChange={(next) => {
                const prev = field.value as JobBoard;
                const to = next as JobBoard;
                field.onChange(to);
                if (prev !== to) {
                  form.setValue(
                    "sourceConfig",
                    migrateAtsConfigOnBoardChange(
                      form.getValues("sourceConfig"),
                      prev,
                      to,
                    ),
                    { shouldValidate: true },
                  );
                }
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a job board" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="greenhouse">
                  Greenhouse (company boards)
                </SelectItem>
                <SelectItem value="lever">Lever (company boards)</SelectItem>
                <SelectItem value="ashby">Ashby (company boards)</SelectItem>
                <SelectItem value="personio">
                  Personio (company boards)
                </SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              Track specific companies&apos; job boards. Changing board keeps
              your criteria but clears companies (tokens differ per board).
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
