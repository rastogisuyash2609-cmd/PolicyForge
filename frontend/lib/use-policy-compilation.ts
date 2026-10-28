"use client";
import {useEffect, useRef, useState} from "react";
import {usePathname} from "next/navigation";
import {api} from "./api";
import type {PolicyDraft} from "./policy-domain";
import {LatestRequest} from "./latest-request";

export function usePolicyCompilation(draft: PolicyDraft, setDraft: React.Dispatch<React.SetStateAction<PolicyDraft>>) {
  const pathname = usePathname();
  const key = JSON.stringify({draft, pathname});
  const latest = useRef(key); latest.current = key;
  const gate = useRef(new LatestRequest());
  const pending = useRef(false);
  const [accessCode, setAccessCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {const channel = gate.current; setError(null); return () => channel.cancel();}, [key]);
  async function run() {
    if (pending.current || !consent || !accessCode || !draft.name.trim() || !draft.text.trim() || draft.text.length > 4000) return;
    pending.current = true;
    const token = gate.current.begin();
    const captured = JSON.stringify(draft);
    setLoading(true); setError(null); setConsent(false);
    try {
      const result = await api.compile({document_text: draft.text, doc_name: "policy.md", live: true, max_repairs: 0},
        {accessCode, requestId: crypto.randomUUID()}, token.signal);
      if (gate.current.current(token.id) && latest.current === key)
        setDraft((old) => JSON.stringify(old) !== captured ? old : ({...old, mode: "ai", example: "",
          rulesJson: JSON.stringify(result.compiled_rules, null, 2), referenceEdited: false,
          compilation: {model: result.model!, requestId: result.request_id!, usage: result.token_usage, finishReason: result.finish_reason!}}));
    } catch (cause: unknown) {
      if (latest.current === key)
        setError(cause instanceof Error ? cause.message : "Compilation failed; previous rules were preserved.");
    } finally {pending.current = false; setLoading(false);}
  }
  return {accessCode, setAccessCode, consent, setConsent, loading, error, run};
}
