"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateAutomationSchema,
  type CreateAutomationInput,
} from "@/models/automation.schema";
import {
  createAutomation,
  updateAutomation,
} from "@/actions/automation.actions";
import { toastSuccess, toastError } from "@/lib/toast";
import type { AutomationWithResume, JobBoard } from "@/models/automation.model";
import type { AtsConfigValue } from "../AtsSearchStep";
import {
  EMPTY_ATS,
  STEPS,
  buildDuplicateDefaults,
  parseEditSourceConfig,
  type AtsKey,
} from "./wizardConfig";

interface UseWizardFormArgs {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automations: AutomationWithResume[];
  onSuccess: () => void;
  editAutomation?: AutomationWithResume | null;
  /** Prefills create mode; never updates the source automation. */
  duplicateFrom?: AutomationWithResume | null;
}

function blankDefaults(): CreateAutomationInput {
  return {
    name: "",
    jobBoard: "greenhouse",
    keywords: "",
    location: "",
    sourceConfig: undefined,
    resumeId: "",
    matchThreshold: 80,
    scheduleHour: 8,
  };
}

function editDefaults(source: AutomationWithResume): CreateAutomationInput {
  return {
    name: source.name,
    jobBoard: source.jobBoard as JobBoard,
    keywords: source.keywords ?? "",
    location: source.location ?? "",
    sourceConfig: parseEditSourceConfig(source.sourceConfig),
    resumeId: source.resumeId,
    matchThreshold: source.matchThreshold,
    scheduleHour: source.scheduleHour,
  };
}

export function useWizardForm({
  open,
  onOpenChange,
  automations,
  onSuccess,
  editAutomation,
  duplicateFrom,
}: UseWizardFormArgs) {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!editAutomation;

  const initialValues = editAutomation
    ? editDefaults(editAutomation)
    : duplicateFrom
      ? buildDuplicateDefaults(duplicateFrom)
      : blankDefaults();

  const form = useForm<CreateAutomationInput>({
    resolver: zodResolver(CreateAutomationSchema),
    mode: "onChange",
    defaultValues: initialValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editAutomation
          ? editDefaults(editAutomation)
          : duplicateFrom
            ? buildDuplicateDefaults(duplicateFrom)
            : blankDefaults(),
      );
      setStep(0);
    }
  }, [open, editAutomation, duplicateFrom, form]);

  const formValues = form.watch();

  const onSubmit = async (data: CreateAutomationInput) => {
    setIsSubmitting(true);
    try {
      // Duplicate always creates; only editAutomation updates in place.
      const result = isEditing
        ? await updateAutomation(editAutomation.id, data)
        : await createAutomation(data);

      if (result.success) {
        toastSuccess(
          isEditing
            ? "Your automation has been updated successfully."
            : "Your automation has been created and will run at the scheduled time.",
          isEditing ? "Automation updated" : "Automation created",
        );
        form.reset();
        setStep(0);
        onOpenChange(false);
        onSuccess();
      } else {
        toastError(result.message || "Something went wrong");
      }
    } catch (error) {
      toastError("Failed to save automation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const atsKey: AtsKey = formValues.jobBoard;
  const atsConfig: AtsConfigValue =
    formValues.sourceConfig?.[atsKey] ?? EMPTY_ATS;

  const canGoNext = () => {
    switch (step) {
      case 0:
        return (formValues.name?.trim().length ?? 0) > 0;
      case 1:
        return (atsConfig.companies?.length ?? 0) > 0;
      case 2:
        return (formValues.resumeId?.length ?? 0) > 0;
      case 3:
      case 4:
        return true;
      default:
        return false;
    }
  };

  // Hours already claimed by the user's other automations. Only one automation
  // may run per hourly slot, so the schedule step rejects a taken hour.
  // Duplicate keeps the source hour "taken" so the user picks a free slot.
  const takenHours = new Set(
    automations
      .filter((a) => a.id !== editAutomation?.id)
      .map((a) => a.scheduleHour),
  );

  const nextStep = () => {
    if (step === 4 && takenHours.has(formValues.scheduleHour)) {
      form.setError("scheduleHour", {
        message: `Another automation already runs at ${(
          formValues.scheduleHour ?? 8
        )
          .toString()
          .padStart(2, "0")}:00. Please choose a different time.`,
      });
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleClose = () => {
    form.reset();
    setStep(0);
    onOpenChange(false);
  };

  return {
    form,
    formValues,
    step,
    isSubmitting,
    isEditing,
    isDuplicating: !!duplicateFrom && !isEditing,
    atsKey,
    atsConfig,
    takenHours,
    canGoNext,
    nextStep,
    prevStep,
    handleClose,
    onSubmit,
  };
}
