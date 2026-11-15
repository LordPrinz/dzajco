import { pageText } from "./lang";
import { toast } from "./toast";

/**
 * Shows and wires every `[data-copy="name"]` button under `root`. It copies the `data-value` of the
 * matching `[data-field="name"]` element, or its text: a short link shows without its protocol, so
 * the full URL lives in `data-value`.
 */
export function enableCopy(root: ParentNode): void {
  const text = pageText();
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    button.hidden = false;
    button.addEventListener("click", async () => {
      const source = root.querySelector<HTMLElement>(`[data-field="${button.dataset.copy}"]`);
      try {
        await navigator.clipboard.writeText(source?.dataset.value ?? source?.textContent ?? "");
        button.textContent = text.copy.done;
        toast(text.copy.toast, "success");
      } catch {
        button.textContent = text.copy.failed;
        toast(text.copy.failedToast, "error");
      }
      setTimeout(() => {
        button.textContent = text.copy.button;
      }, 2000);
    });
  }
}
