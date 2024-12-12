import { fireEvent } from "../../../../common/dom/fire_event";

export interface BackupOnboardingDialogParams {
  submit?: (value: boolean) => void;
  cancel?: () => void;
}

const loadDialog = () => import("./dialog-backup-onboarding");

export const showBackupOnboardingDialog = (
  element: HTMLElement,
  params?: BackupOnboardingDialogParams
) =>
  new Promise<boolean>((resolve) => {
    const origCancel = params?.cancel;
    const origSubmit = params?.submit;
    fireEvent(element, "show-dialog", {
      dialogTag: "ha-dialog-backup-onboarding",
      dialogImport: loadDialog,
      dialogParams: {
        ...params,
        cancel: () => {
          resolve(false);
          if (origCancel) {
            origCancel();
          }
        },
        submit: (value) => {
          resolve(value);
          if (origSubmit) {
            origSubmit(value);
          }
        },
      },
    });
  });
