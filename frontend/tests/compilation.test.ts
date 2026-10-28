import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {createApiClient} from "../lib/api";
import {activateDraft, emptyDraft, starterRule} from "../lib/policy-domain";
import {capturePolicy} from "../lib/comparison";
import {createReport} from "../lib/reports";
import {LatestRequest} from "../lib/latest-request";

const rule = starterRule();
const result = {mode:"live",model:"nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",request_id:"offline-id",
  provider_requests:1,finish_reason:"stop",total_clauses:1,mapped_clauses:1,unmapped_clauses:[],
  compiled_rules:[rule],rule_confidence:{[rule.id]:{rule_id:rule.id,grounded:true,lint_clean:true,confidence:"HIGH",notes:[]}},
  rejected_rules:[],lint_warnings:[],token_usage:{call_count:1,provider_usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}},latency_ms:1,summary:"offline fixture"};
const response = (data: unknown, status=200) => new Response(JSON.stringify(data), {status});
test("compile is explicit, authenticated and bounded to a single fetch", async () => {
  let count=0;
  const client=createApiClient({fetchImpl:async(_url,init)=>{
    count++; const body=JSON.parse(String(init?.body));
    assert.equal(body.live,true); assert.equal(body.max_repairs,0);
    assert.equal(new Headers(init?.headers).get("Authorization"),"Bearer offline-access");
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"),"offline-id");
    assert.doesNotMatch(String(init?.body),/offline-access/);
    return response(result);
  }});
  assert.equal((await client.compile({live:true,document_text:"policy"},{accessCode:"offline-access",requestId:"offline-id"})).compiled_rules.length,1);
  assert.equal(count,1);
});
test("compile failure never retries or mutates previous active rules", async () => {
  const previous=activateDraft({...emptyDraft(),mode:"manual",name:"Previous",rulesJson:JSON.stringify([rule])},1).value!;
  const snapshot=JSON.stringify(previous); let count=0;
  const client=createApiClient({fetchImpl:async()=>{count++;return response({detail:{code:"provider_timeout",message:"Provider timed out. No retry."}},504);}});
  await assert.rejects(client.compile({live:true,document_text:"policy"},{accessCode:"offline-access",requestId:"id"}),/Provider timed out/);
  assert.equal(count,1); assert.equal(JSON.stringify(previous),snapshot);
});
test("compiled provenance survives activation, snapshots and deterministic report export", () => {
  const compilation={model:result.model,requestId:"offline-id",usage:result.token_usage,finishReason:"stop"};
  const draft={...emptyDraft(),mode:"ai" as const,name:"AI policy",text:"policy",rulesJson:JSON.stringify([rule]),compilation};
  const active=activateDraft(draft,2).value!; assert.equal(active.origin,"ai");
  assert.deepEqual(capturePolicy(active).compilation,compilation);
  const report=createReport({kind:"simulation",request:{rules:active.rules,journey:[]},result:{outcomes:[],final_state:{},trace:{event_traces:[]},findings:[]}},active,"offline test");
  assert.deepEqual(report.workspace_session.compilation,compilation);
  assert.equal(report.workspace_session.revision,2);
  assert.equal(activateDraft({...draft,referenceEdited:true},3).value,null);
});
test("late compile replies are discarded and the UI has no effect-triggered inference", () => {
  const gate=new LatestRequest(); const token=gate.begin(); gate.cancel(); assert.equal(gate.current(token.id),false);
  const hook=readFileSync("lib/use-policy-compilation.ts","utf8");
  assert.equal((hook.match(/api\.compile\(/g)||[]).length,1);
  assert.ok(hook.indexOf("async function run()")<hook.indexOf("api.compile("));
  assert.match(hook,/pending\.current/); assert.match(hook,/latest\.current === key/);
  assert.doesNotMatch(hook,/localStorage|sessionStorage|NEBIUS_API_KEY|setInterval/);
});
test("unsupported compilation and bad contracts stop locally without fallback", async()=>{
  let calls=0; const client=createApiClient({fetchImpl:async()=>{calls++;return response({...result,finish_reason:"length"});}});
  await assert.rejects(client.compile({live:true,document_text:"x".repeat(4001)},{accessCode:"x",requestId:"id"})); assert.equal(calls,0);
  await assert.rejects(client.compile({live:true,document_text:"policy"},{accessCode:"x",requestId:"id"})); assert.equal(calls,1);
});
