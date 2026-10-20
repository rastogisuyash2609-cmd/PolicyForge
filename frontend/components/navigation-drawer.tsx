"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/primitives";

// Native modal dialog supplies focus containment, inert background and Escape.
export function NavigationDrawer({
  children,
  label,
  id,
}: {
  children: React.ReactNode;
  label: string;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) element?.showModal();
    if (!open && element?.open) element.close();
  }, [open]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  function close() {
    setOpen(false);
  }
  return (
    <>
      <Button
        ref={trigger}
        variant="ghost"
        size="icon"
        aria-label={`Open ${label.toLowerCase()}`}
        aria-haspopup="dialog"
        aria-controls={id}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </Button>
      <dialog
        ref={dialog}
        id={id}
        aria-labelledby={`${id}-title`}
        onCancel={close}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus({ preventScroll: true });
        }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const targets = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), [tabindex="0"]',
            ),
          );
          const first = targets[0],
            last = targets.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-[min(20rem,calc(100%_-_2rem))] max-w-none border-r border-border bg-surface p-0 text-text shadow-panel backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id={`${id}-title`} className="font-semibold">
            {label}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close navigation"
            onClick={close}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </Button>
        </div>
        <div
          className="p-4"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) close();
          }}
        >
          {children}
        </div>
      </dialog>
    </>
  );
}
