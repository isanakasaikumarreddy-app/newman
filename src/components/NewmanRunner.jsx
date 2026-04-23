import { useState, useEffect, useRef } from "react";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg: "#0f0f11", surface: "#16161b", surfaceHigh: "#1e1e26",
  border: "#2a2a35", borderHover: "#3d3d50",
  accent: "#6c63ff", accentDim: "#6c63ff22", accentText: "#9d97ff",
  green: "#3ecf8e", greenDim: "#3ecf8e22",
  red: "#f87171", redDim: "#f8717122",
  yellow: "#fbbf24", yellowDim: "#fbbf2422",
  blue: "#60a5fa",
  tp: "#e8e6e1", ts: "#888899", tm: "#555566",
  mono: "'JetBrains Mono', monospace",
};

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

// ─── Collection extractor ─────────────────────────────────────────────────────
function extractRequests(col) {
  const reqs = [];
  function walk(items) {
    (items || []).forEach((item) => {
      if (item.item) walk(item.item);
      else if (item.request) {
        const req = item.request;
        const rawUrl = typeof req.url === "string" ? req.url : req.url?.raw || "";
        const headers = (req.header || []).reduce((a, h) => ({ ...a, [h.key]: h.value }), {});
        let body = null;
        if (req.body?.mode === "raw") {
          try { body = JSON.parse(req.body.raw); } catch { body = req.body.raw; }
        }
        reqs.push({ name: item.name || "Request", method: (req.method || "GET").toUpperCase(), url: rawUrl, headers, body });
      }
    });
  }
  walk(col.item || col.collection?.item || []);
  return reqs;
}

// ─── Variable substitution ────────────────────────────────────────────────────
function substitute(str, row, env) {
  if (!str) return str;
  return str.replace(/\{\{([^}]+)\}\}/g, (_, k) => row?.[k] ?? env?.[k] ?? `{{${k}}}`);
}
function substituteObj(obj, row, env) {
  if (!obj) return obj;
  return JSON.parse(substitute(JSON.stringify(obj), row, env));
}

// ─── Real API caller ──────────────────────────────────────────────────────────
// async function callAPI(req) {
//   const start = Date.now();
//   try {
//     const proxyUrl = req.url.replace(/^https?:\/\/[^/]+/, `import.meta.env.VITE_API_BASE_URL`);
//     console.log("Resolved URL:", proxyUrl);
//     const res = await fetch(proxyUrl, {
//       method: req.method,
//       headers: { "Content-Type": "application/json", ...req.headers },
//       body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
//     });
//     const time = Date.now() - start;
//     const resHeaders = [...res.headers.entries()].map(([key, value]) => ({ key, value }));
//     let responseBody;
//     const ct = res.headers.get("content-type") || "";
//     if (ct.includes("application/json")) {
//       const json = await res.json();
//       responseBody = JSON.stringify(json, null, 2);
//     } else {
//       responseBody = await res.text();
//     }
//     return { pass: res.ok, statusCode: res.status, time, responseBody, responseHeaders: resHeaders, error: null };
//   } catch (err) {
//     const time = Date.now() - start;
//     return {
//       pass: false, statusCode: 0, time,
//       responseBody: JSON.stringify({
//         error: err.message, type: err.name,
//         hint: "Request failed via Vite proxy. Make sure your vite.config.js has the proxy configured and the target API is reachable.",
//       }, null, 2),
//       responseHeaders: [], error: err.message,
//     };
//   }
//   console.log("API BASE URL:", import.meta.env.VITE_API_BASE_URL);
//   console.log("Original URL:", req.url);
// }
// ─── Real API caller ──────────────────────────────────────────────────────────
async function callAPI(req) {
  console.log("API BASE URL:", "https://api.toorakcapital.info/");
  console.log("Original URL:", req.url);
  const start = Date.now();
  try {
    const baseUrl = "https://api.toorakcapital.info/";
    const proxyUrl = req.url.replace(/^https?:\/\/[^/]+/, baseUrl);
    console.log("Resolved URL:", proxyUrl);
    const res = await fetch(proxyUrl, {
      method: req.method,
      headers: { "Content-Type": "application/json", ...req.headers },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    const time = Date.now() - start;
    const resHeaders = [...res.headers.entries()].map(([key, value]) => ({ key, value }));
    let responseBody;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const json = await res.json();
      responseBody = JSON.stringify(json, null, 2);
    } else {
      responseBody = await res.text();
    }
    return { pass: res.ok, statusCode: res.status, time, responseBody, responseHeaders: resHeaders, error: null };
  } catch (err) {
    const time = Date.now() - start;
    return {
      pass: false, statusCode: 0, time,
      responseBody: JSON.stringify({
        error: err.message, type: err.name,
        hint: "Request failed. Check CORS and VITE_API_BASE_URL env variable.",
      }, null, 2),
      responseHeaders: [], error: err.message,
    };
  }
}

// ─── UploadCard ───────────────────────────────────────────────────────────────
function UploadCard({ label, hint, icon, file, onFile, accept }) {
  const ref = useRef();
  const [drag, setDrag] = useState(false);
  const handle = (f) => { if (f) onFile(f); };
  return (
    <div
      onClick={() => ref.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      style={{ border: `1.5px dashed ${drag ? T.accent : file ? T.green : T.border}`, borderRadius: 10, padding: "16px", textAlign: "center", cursor: "pointer", background: file ? T.greenDim : drag ? T.accentDim : T.surface, transition: "all 0.2s", userSelect: "none" }}
    >
      <input ref={ref} type="file" accept={accept} style={{ display: "none" }} onChange={(e) => handle(e.target.files[0])} />
      <div style={{ fontSize: 20, marginBottom: 4 }}>{file ? "✅" : icon}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: file ? T.green : T.tp, marginBottom: 2 }}>{file ? file.name : label}</div>
      <div style={{ fontSize: 11, color: T.tm }}>{file ? "Click to replace" : hint}</div>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ method }) {
  const map = { GET: [T.accent, T.accentDim], POST: [T.green, T.greenDim], PUT: [T.yellow, T.yellowDim], DELETE: [T.red, T.redDim], PATCH: [T.yellow, T.yellowDim] };
  const [c, bg] = map[method] || [T.ts, "#ffffff11"];
  return <span style={{ background: bg, color: c, border: `1px solid ${c}44`, borderRadius: 4, padding: "2px 7px", fontSize: 10, fontFamily: T.mono, fontWeight: 700 }}>{method}</span>;
}

// ─── StatusCode ───────────────────────────────────────────────────────────────
function StatusCode({ code }) {
  if (!code) return <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.red }}>ERR</span>;
  const c = code >= 500 ? T.red : code >= 400 ? T.yellow : T.green;
  return <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: c }}>{code}</span>;
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={{ background: T.surfaceHigh, borderRadius: 8, padding: "14px 16px", border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 11, color: T.tm, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, fontFamily: T.mono, color: color || T.tp }}>{value}</div>
    </div>
  );
}

// ─── JsonViewer ───────────────────────────────────────────────────────────────
function JsonViewer({ data }) {
  return (
    <div style={{ fontFamily: T.mono, fontSize: 12, lineHeight: 1.7, overflowX: "auto" }}>
      {(data || "").split("\n").map((line, i) => {
        const key     = line.match(/^\s*"([^"]+)":/);
        const strVal  = line.match(/:\s*"([^"]*)"(,?)$/);
        const numVal  = line.match(/:\s*(-?\d+\.?\d*)(,?)$/);
        const boolVal = line.match(/:\s*(true|false|null)(,?)$/);
        if (key && strVal)  return <div key={i}><span style={{ color: T.ts }}>{line.substring(0, line.indexOf('"'))}</span><span style={{ color: T.accentText }}>"{key[1]}"</span><span style={{ color: T.ts }}>: </span><span style={{ color: T.green }}>"{strVal[1]}"</span><span style={{ color: T.ts }}>{strVal[2]}</span></div>;
        if (key && numVal)  return <div key={i}><span style={{ color: T.ts }}>{line.substring(0, line.indexOf('"'))}</span><span style={{ color: T.accentText }}>"{key[1]}"</span><span style={{ color: T.ts }}>: </span><span style={{ color: T.yellow }}>{numVal[1]}</span><span style={{ color: T.ts }}>{numVal[2]}</span></div>;
        if (key && boolVal) return <div key={i}><span style={{ color: T.ts }}>{line.substring(0, line.indexOf('"'))}</span><span style={{ color: T.accentText }}>"{key[1]}"</span><span style={{ color: T.ts }}>: </span><span style={{ color: T.blue }}>{boolVal[1]}</span><span style={{ color: T.ts }}>{boolVal[2]}</span></div>;
        return <div key={i} style={{ color: T.ts }}>{line}</div>;
      })}
    </div>
  );
}

// ─── RequestDetail modal ──────────────────────────────────────────────────────
function RequestDetail({ req, onClose }) {
  const [subTab, setSubTab] = useState("body");
  const isJson = req.responseBody?.trim().startsWith("{") || req.responseBody?.trim().startsWith("[");
  const st = (a) => ({ padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", borderRadius: 4, border: "none", fontFamily: "'DM Sans',sans-serif", background: a === subTab ? T.surfaceHigh : "transparent", color: a === subTab ? T.tp : T.ts, transition: "all 0.15s" });

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, width: "100%", maxWidth: 700, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>

        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Badge method={req.method} />
          <span style={{ flex: 1, fontWeight: 500, fontSize: 14, color: T.tp, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{req.name}</span>
          {req.csvRow && <span style={{ fontSize: 11, background: T.accentDim, color: T.accentText, border: `1px solid ${T.accent}44`, borderRadius: 4, padding: "2px 8px", fontFamily: T.mono }}>Row {req.csvRow}</span>}
          <StatusCode code={req.statusCode} />
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.tm }}>{req.time}ms</span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.ts, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: "10px 20px", borderBottom: `1px solid ${T.border}`, background: T.bg }}>
          <div style={{ fontSize: 11, color: T.tm, marginBottom: 3 }}>Request URL</div>
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.accentText, wordBreak: "break-all" }}>{req.resolvedUrl || req.url}</div>
        </div>

        {req.dataRow && (
          <div style={{ padding: "10px 20px", borderBottom: `1px solid ${T.border}`, background: T.surfaceHigh }}>
            <div style={{ fontSize: 11, color: T.tm, marginBottom: 6 }}>CSV data injected (row {req.csvRow})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(req.dataRow).map(([k, v]) => (
                <span key={k} style={{ fontSize: 11, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 4, padding: "2px 10px", fontFamily: T.mono }}>
                  <span style={{ color: T.accentText }}>{k}</span><span style={{ color: T.tm }}>:</span><span style={{ color: T.green, marginLeft: 4 }}>{v}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {req.error && (
          <div style={{ padding: "10px 20px", background: T.redDim, borderBottom: `1px solid ${T.red}33` }}>
            <div style={{ fontSize: 11, color: T.red, fontWeight: 500, marginBottom: 2 }}>Network / CORS Error</div>
            <div style={{ fontSize: 12, color: T.tp, fontFamily: T.mono }}>{req.error}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 4, padding: "10px 20px 0", borderBottom: `1px solid ${T.border}` }}>
          <button style={st("body")}    onClick={() => setSubTab("body")}>Response body</button>
          <button style={st("headers")} onClick={() => setSubTab("headers")}>Headers <span style={{ fontFamily: T.mono, fontSize: 10, color: T.tm }}>({req.responseHeaders?.length || 0})</span></button>
          <button style={st("req")}     onClick={() => setSubTab("req")}>Request sent</button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {subTab === "body" && (
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: T.tm, textTransform: "uppercase", letterSpacing: "0.06em" }}>Response body</span>
                {isJson && <span style={{ fontSize: 11, background: T.accentDim, color: T.accentText, padding: "2px 7px", borderRadius: 3, fontFamily: T.mono }}>JSON</span>}
                {!req.pass && req.statusCode > 0 && <span style={{ fontSize: 11, background: T.redDim, color: T.red, padding: "2px 7px", borderRadius: 3 }}>Error response</span>}
                {req.statusCode === 0 && <span style={{ fontSize: 11, background: T.redDim, color: T.red, padding: "2px 7px", borderRadius: 3 }}>No response — network/CORS error</span>}
                <span style={{ marginLeft: "auto", fontSize: 11, color: T.tm }}>{(req.responseBody || "").length} chars</span>
              </div>
              <div style={{ background: T.bg, borderRadius: 8, padding: 16, border: `1px solid ${req.pass ? T.border : T.red + "44"}` }}>
                {isJson ? <JsonViewer data={req.responseBody} /> : <pre style={{ fontFamily: T.mono, fontSize: 12, color: T.tp, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{req.responseBody}</pre>}
              </div>
            </div>
          )}
          {subTab === "headers" && (
            <div>
              <div style={{ fontSize: 11, color: T.tm, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Response headers</div>
              {req.responseHeaders?.length > 0 ? (
                <div style={{ background: T.bg, borderRadius: 8, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: T.mono }}>
                    <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}><th style={{ textAlign: "left", padding: "6px 10px", color: T.tm, fontWeight: 500 }}>Key</th><th style={{ textAlign: "left", padding: "6px 10px", color: T.tm, fontWeight: 500 }}>Value</th></tr></thead>
                    <tbody>{req.responseHeaders.map((h, i) => (<tr key={i} style={{ borderBottom: `1px solid ${T.border}22` }}><td style={{ padding: "6px 10px", color: T.accentText }}>{h.key}</td><td style={{ padding: "6px 10px", color: T.tp, wordBreak: "break-all" }}>{h.value}</td></tr>))}</tbody>
                  </table>
                </div>
              ) : <div style={{ color: T.tm, fontSize: 13 }}>No headers received (likely a network or CORS error).</div>}
            </div>
          )}
          {subTab === "req" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: T.tm, marginBottom: 6 }}>Method & URL</div>
                <div style={{ background: T.bg, borderRadius: 6, padding: "10px 14px", border: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 12 }}>
                  <span style={{ color: T.accentText, marginRight: 10 }}>{req.method}</span>
                  <span style={{ color: T.tp, wordBreak: "break-all" }}>{req.resolvedUrl || req.url}</span>
                </div>
              </div>
              {req.sentHeaders && Object.keys(req.sentHeaders).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: T.tm, marginBottom: 6 }}>Request headers sent</div>
                  <div style={{ background: T.bg, borderRadius: 6, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: T.mono }}>
                      <tbody>{Object.entries(req.sentHeaders).map(([k, v], i) => (<tr key={i} style={{ borderBottom: `1px solid ${T.border}22` }}><td style={{ padding: "6px 10px", color: T.accentText }}>{k}</td><td style={{ padding: "6px 10px", color: T.tp, wordBreak: "break-all" }}>{v}</td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {req.sentBody && (
                <div>
                  <div style={{ fontSize: 11, color: T.tm, marginBottom: 6 }}>Request body sent</div>
                  <div style={{ background: T.bg, borderRadius: 6, padding: "10px 14px", border: `1px solid ${T.border}` }}>
                    <JsonViewer data={typeof req.sentBody === "string" ? req.sentBody : JSON.stringify(req.sentBody, null, 2)} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── RequestRow ───────────────────────────────────────────────────────────────
function RequestRow({ req, index, onSelect }) {
  const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), index * 40); }, [index]);
  return (
    <div
      onClick={() => onSelect(req)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: T.surfaceHigh, borderRadius: 7, border: `1px solid ${req.pass ? T.border : T.red + "44"}`, opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(6px)", transition: "opacity 0.3s, transform 0.3s", fontSize: 13, cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = req.pass ? T.borderHover : T.red)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = req.pass ? T.border : T.red + "44")}
    >
      <Badge method={req.method} />
      <span style={{ flex: 1, fontWeight: 500, color: T.tp, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{req.name}</span>
      {req.csvRow && <span style={{ fontSize: 10, color: T.tm, fontFamily: T.mono }}>row {req.csvRow}</span>}
      <StatusCode code={req.statusCode} />
      <span style={{ color: T.tm, fontSize: 12, fontFamily: T.mono, marginLeft: 4 }}>{req.time}ms</span>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: req.pass ? T.green : T.red, boxShadow: req.pass ? `0 0 5px ${T.green}` : `0 0 5px ${T.red}`, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: T.tm }}>›</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NewmanRunner() {
  const [colFile,       setColFile]       = useState(null);
  const [envFile,       setEnvFile]       = useState(null);
  const [csvFile,       setCsvFile]       = useState(null);
  const [csvPreview,    setCsvPreview]    = useState([]);
  const [running,       setRunning]       = useState(false);
  const [progress,      setProgress]      = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [results,       setResults]       = useState(null);
  const [tab,           setTab]           = useState("config");
  const [selected,      setSelected]      = useState(null);
  const [filter,        setFilter]        = useState("all");
  const [log,           setLog]           = useState([]);
  const logRef = useRef([]);

  const addLog = (msg, type = "info") => {
    const entry = { msg, type, ts: new Date().toLocaleTimeString() };
    logRef.current = [...logRef.current, entry];
    setLog([...logRef.current]);
  };

  const handleCsvFile = async (f) => {
    setCsvFile(f);
    const text = await f.text();
    const rows = parseCSV(text);
    setCsvPreview(rows.slice(0, 5));
    addLog(`CSV loaded: ${rows.length} rows, columns: ${Object.keys(rows[0] || {}).join(", ")}`, "success");
  };

  // ─── Export Results ─────────────────────────────────────────────────────────
  function exportResults(format) {
    if (!results) return;

    const ts = Date.now();

    if (format === "json") {
      const exportData = {
        summary: { total: results.total, passed: results.passed, failed: results.failed, avgTime: results.avgTime, runAt: new Date().toISOString() },
        results: results.reqs.map((r) => ({
          name: r.name, method: r.method, url: r.resolvedUrl || r.url,
          statusCode: r.statusCode, time: r.time, pass: r.pass,
          csvRow: r.csvRow || null, dataRow: r.dataRow || null,
          responseBody: r.responseBody, responseHeaders: r.responseHeaders, error: r.error || null,
        })),
      };
      triggerDownload(JSON.stringify(exportData, null, 2), `newman-results-${ts}.json`, "application/json");

    } else if (format === "csv") {
      const headers = ["Name", "Method", "URL", "Status Code", "Time (ms)", "Result", "CSV Row", "Error"];
      const rows = results.reqs.map((r) => [
        `"${r.name}"`, r.method, `"${r.resolvedUrl || r.url}"`,
        r.statusCode, r.time, r.pass ? "PASS" : "FAIL",
        r.csvRow || "", `"${r.error || ""}"`,
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      triggerDownload(csv, `newman-results-${ts}.csv`, "text/csv");

    } else if (format === "html") {
      const rows = results.reqs.map((r) => {
        const methodColor = r.method === "GET" ? "#9d97ff" : r.method === "POST" ? "#3ecf8e" : r.method === "DELETE" ? "#f87171" : "#fbbf24";
        const methodBg    = r.method === "GET" ? "#6c63ff22" : r.method === "POST" ? "#3ecf8e22" : r.method === "DELETE" ? "#f8717122" : "#fbbf2422";
        const statusColor = r.statusCode >= 500 ? "#f87171" : r.statusCode >= 400 ? "#fbbf24" : "#3ecf8e";
        return `<tr>
          <td>${r.name}</td>
          <td><span style="background:${methodBg};color:${methodColor};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;font-family:monospace">${r.method}</span></td>
          <td style="font-family:monospace;font-size:11px;color:#9d97ff;word-break:break-all">${r.resolvedUrl || r.url}</td>
          <td style="font-weight:700;color:${statusColor}">${r.statusCode || "ERR"}</td>
          <td style="font-family:monospace;color:#888899">${r.time}ms</td>
          <td style="font-weight:700;color:${r.pass ? "#3ecf8e" : "#f87171"}">${r.pass ? "PASS" : "FAIL"}</td>
          <td style="color:#888899">${r.csvRow ? `Row ${r.csvRow}` : "—"}</td>
          <td style="color:#f87171;font-size:11px;font-family:monospace">${r.error || ""}</td>
        </tr>`;
      }).join("");

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Newman Results</title>
  <style>
    body  { font-family: 'DM Sans', sans-serif; background: #0f0f11; color: #e8e6e1; margin: 0; padding: 32px; }
    h1    { font-size: 20px; font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 10px; }
    .sub  { font-size: 13px; color: #555566; margin-bottom: 24px; }
    .stats { display: flex; gap: 12px; margin-bottom: 28px; flex-wrap: wrap; }
    .stat  { background: #1e1e26; border: 1px solid #2a2a35; border-radius: 8px; padding: 14px 20px; min-width: 100px; }
    .stat-label { font-size: 11px; color: #555566; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
    .stat-value { font-size: 26px; font-weight: 600; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; background: #16161b; border-radius: 10px; overflow: hidden; font-size: 13px; }
    th    { text-align: left; padding: 10px 14px; font-size: 11px; color: #555566; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #2a2a35; background: #1e1e26; }
    td    { padding: 10px 14px; border-bottom: 1px solid #2a2a3522; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #1e1e26; }
  </style>
</head>
<body>
  <h1>⚡ Newman Runner</h1>
  <div class="sub">Exported on ${new Date().toLocaleString()}</div>
  <div class="stats">
    <div class="stat"><div class="stat-label">Total</div><div class="stat-value" style="color:#e8e6e1">${results.total}</div></div>
    <div class="stat"><div class="stat-label">Passed</div><div class="stat-value" style="color:#3ecf8e">${results.passed}</div></div>
    <div class="stat"><div class="stat-label">Failed</div><div class="stat-value" style="color:${results.failed > 0 ? "#f87171" : "#555566"}">${results.failed}</div></div>
    <div class="stat"><div class="stat-label">Avg time</div><div class="stat-value" style="color:#9d97ff">${results.avgTime}ms</div></div>
  </div>
  <table>
    <thead><tr><th>Name</th><th>Method</th><th>URL</th><th>Status</th><th>Time</th><th>Result</th><th>Row</th><th>Error</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
      triggerDownload(html, `newman-results-${ts}.html`, "text/html");
    }
  }

  function triggerDownload(content, filename, type) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function run() {
    if (!colFile) { addLog("No collection file uploaded", "error"); return; }
    setRunning(true); setResults(null); setProgress(0); setTab("results");
    logRef.current = []; setLog([]);

    let col, envVars = {}, csvRows = [{ __empty: true }];

    try { const t = await colFile.text(); col = JSON.parse(t); }
    catch { addLog("Invalid collection JSON", "error"); setRunning(false); return; }

    if (envFile) {
      try {
        const t = await envFile.text();
        const e = JSON.parse(t);
        envVars = Object.fromEntries((e.values || e.environment?.values || []).map((v) => [v.key, v.value]));
        addLog(`Environment loaded: ${Object.keys(envVars).length} variables`);
      } catch { addLog("Could not parse environment file", "warn"); }
    }

    if (csvFile) {
      try {
        const t = await csvFile.text();
        csvRows = parseCSV(t);
        addLog(`CSV loaded: ${csvRows.length} rows`);
      } catch { addLog("Could not parse CSV", "warn"); }
    }

    const reqs = extractRequests(col);
    if (!reqs.length) { addLog("No requests found in collection", "error"); setRunning(false); return; }
    addLog(`Found ${reqs.length} request(s)`);

    const allResults = [];
    const total = reqs.length * csvRows.length;
    let done = 0;

    for (const req of reqs) {
      for (let ci = 0; ci < csvRows.length; ci++) {
        const row    = csvRows[ci].__empty ? null : csvRows[ci];
        const rowNum = row ? ci + 1 : null;
        setProgressLabel(`${req.name}${row ? ` · row ${rowNum}` : ""}`);
        addLog(`→ ${req.method} ${req.name}${row ? ` (row ${rowNum})` : ""}`);

        const resolvedUrl = substitute(req.url, row, envVars);
        const sentHeaders = { ...substituteObj(req.headers, row, envVars), "Content-Type": "application/json" };
        const sentBody    = req.body ? substituteObj(req.body, row, envVars) : undefined;

        const result = await callAPI({ ...req, url: resolvedUrl, headers: sentHeaders, body: sentBody });

        if (result.pass) addLog(`  ✓ ${result.statusCode} in ${result.time}ms`, "success");
        else             addLog(`  ✗ ${result.statusCode || "ERR"} — ${result.error || "API returned error"}`, "error");

        allResults.push({
          ...req, ...result, resolvedUrl, sentHeaders, sentBody,
          csvRow: rowNum, dataRow: row,
          name: req.name + (csvRows.length > 1 && row ? ` [row ${rowNum}]` : ""),
        });
        done++;
        setProgress(Math.round((done / total) * 100));
        if (done < total) await new Promise((r) => setTimeout(r, 80));
      }
    }

    const passed = allResults.filter((r) => r.pass).length;
    setResults({ reqs: allResults, passed, failed: allResults.length - passed, total: allResults.length, avgTime: Math.round(allResults.reduce((a, r) => a + r.time, 0) / allResults.length) });
    addLog(`Done — ${passed}/${allResults.length} passed`, "success");
    setRunning(false);
  }

  const tabStyle = (a) => ({ padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer", borderRadius: 6, border: "none", fontFamily: "'DM Sans',sans-serif", background: a === tab ? T.accent : "transparent", color: a === tab ? "#fff" : T.ts, transition: "all 0.15s" });
  const filteredReqs = results ? results.reqs.filter((r) => filter === "all" || (filter === "pass" && r.pass) || (filter === "fail" && !r.pass)) : [];

  const exportBtnStyle = {
    padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer",
    borderRadius: 5, border: `1px solid ${T.border}`, background: T.surfaceHigh,
    color: T.ts, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: "24px 20px", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=number], input[type=text] { background: #1a1a1f; border: 1px solid #2a2a35; color: #e8e6e1; border-radius: 6px; padding: 8px 12px; width: 100%; font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; transition: border 0.2s; }
        input[type=number]:focus, input[type=text]:focus { border-color: #6c63ff; }
        input[type=checkbox] { accent-color: #6c63ff; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #1a1a1f; }
        ::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 2px; }
        .export-btn:hover { border-color: #6c63ff !important; color: #9d97ff !important; }
      `}</style>

      <div style={{ maxWidth: 740, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 28, height: 28, background: T.accent, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⚡</div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: T.tp }}>Newman Runner</h1>
            <span style={{ fontSize: 11, background: T.accentDim, color: T.accentText, border: `1px solid ${T.accent}44`, borderRadius: 4, padding: "2px 8px", fontFamily: T.mono }}>Live API</span>
          </div>
          <p style={{ fontSize: 13, color: T.tm }}>Real API calls with CSV data injection — actual responses shown</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, background: T.surface, padding: 4, borderRadius: 8, border: `1px solid ${T.border}` }}>
          <button style={tabStyle("config")}  onClick={() => setTab("config")}>Configuration</button>
          <button style={tabStyle("log")}     onClick={() => setTab("log")}>Run log{log.length > 0 && <span style={{ marginLeft: 4, fontFamily: T.mono, fontSize: 10, color: T.tm }}>{log.length}</span>}</button>
          <button style={tabStyle("results")} onClick={() => setTab("results")}>
            Results{results && <span style={{ marginLeft: 5, background: results.failed > 0 ? T.red : T.green, color: "#000", borderRadius: 3, padding: "0 5px", fontSize: 11 }}>{results.failed > 0 ? `${results.failed} fail` : "all pass"}</span>}
          </button>
        </div>

        {/* ── CONFIG TAB ── */}
        {tab === "config" && (
          <div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: T.tm, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Files</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: T.ts, marginBottom: 6 }}>Collection <span style={{ color: T.red }}>*</span></div>
                  <UploadCard label="Collection JSON" hint=".json export from Postman" icon="📁" file={colFile} onFile={setColFile} accept=".json" />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: T.ts, marginBottom: 6 }}>Environment</div>
                  <UploadCard label="Environment JSON" hint="optional" icon="🌍" file={envFile} onFile={setEnvFile} accept=".json" />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: T.ts, marginBottom: 6 }}>Data CSV</div>
                  <UploadCard label="Data CSV" hint="one row per iteration" icon="📊" file={csvFile} onFile={handleCsvFile} accept=".csv" />
                </div>
              </div>
            </div>

            {csvPreview.length > 0 && (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: T.tm, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>CSV preview</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: T.mono }}>
                    <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{Object.keys(csvPreview[0]).map((k) => <th key={k} style={{ textAlign: "left", padding: "5px 10px", color: T.accentText, fontWeight: 500 }}>{k}</th>)}</tr></thead>
                    <tbody>{csvPreview.map((row, i) => <tr key={i} style={{ borderBottom: `1px solid ${T.border}22` }}>{Object.values(row).map((v, j) => <td key={j} style={{ padding: "5px 10px", color: T.tp }}>{v}</td>)}</tr>)}</tbody>
                  </table>
                </div>
                <div style={{ fontSize: 11, color: T.tm, marginTop: 8 }}>Showing first {csvPreview.length} rows. Use column names as {"{{variable}}"} in your Postman collection URLs/bodies.</div>
              </div>
            )}

            <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13 }}>
              <span style={{ color: T.accentText, fontWeight: 500 }}>How it works: </span>
              <span style={{ color: T.ts }}>Add variable placeholders in your Postman URL/body. The CSV column values are substituted per row and a real API call is made. Each CSV row = one iteration. If your API has CORS restrictions, configure the Vite proxy in vite.config.js.</span>
            </div>

            <button onClick={run} disabled={!colFile || running}
              style={{ width: "100%", padding: 13, fontSize: 14, fontWeight: 600, background: colFile && !running ? T.accent : T.surfaceHigh, color: colFile && !running ? "#fff" : T.tm, border: "none", borderRadius: 8, cursor: colFile && !running ? "pointer" : "not-allowed", fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s" }}>
              {running ? `Running... ${progress}% — ${progressLabel}` : !colFile ? "Upload a collection to run" : "⚡ Run Collection"}
            </button>
            {running && <div style={{ marginTop: 10, height: 3, background: T.border, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", background: T.accent, width: `${progress}%`, transition: "width 0.3s" }} /></div>}
          </div>
        )}

        {/* ── LOG TAB ── */}
        {tab === "log" && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 11, color: T.tm, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Run log</div>
            {log.length === 0
              ? <div style={{ color: T.tm, fontSize: 13 }}>No runs yet.</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 400, overflowY: "auto" }}>
                  {log.map((e, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, fontSize: 12, fontFamily: T.mono }}>
                      <span style={{ color: T.tm, flexShrink: 0 }}>{e.ts}</span>
                      <span style={{ color: e.type === "error" ? T.red : e.type === "success" ? T.green : e.type === "warn" ? T.yellow : T.ts }}>{e.msg}</span>
                    </div>
                  ))}
                </div>}
          </div>
        )}

        {/* ── RESULTS TAB ── */}
        {tab === "results" && (
          <div>
            {!results && !running && (
              <div style={{ textAlign: "center", padding: "48px 20px", color: T.tm, border: `1px dashed ${T.border}`, borderRadius: 10, background: T.surface }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.ts, marginBottom: 6 }}>No results yet</div>
                <div style={{ fontSize: 12 }}>Upload a collection and click Run</div>
              </div>
            )}
            {running && (
              <div style={{ textAlign: "center", padding: "48px 20px", border: `1px solid ${T.border}`, borderRadius: 10, background: T.surface }}>
                <div style={{ fontSize: 28, marginBottom: 12, display: "inline-block", animation: "spin 1s linear infinite" }}>⚡</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.accentText, marginBottom: 4 }}>Running collection...</div>
                <div style={{ fontSize: 13, color: T.tm, marginBottom: 12, fontFamily: T.mono }}>{progressLabel}</div>
                <div style={{ height: 3, background: T.border, borderRadius: 2, overflow: "hidden", maxWidth: 260, margin: "0 auto" }}><div style={{ height: "100%", background: T.accent, width: `${progress}%`, transition: "width 0.3s" }} /></div>
                <div style={{ marginTop: 8, fontSize: 12, fontFamily: T.mono, color: T.accent }}>{progress}%</div>
              </div>
            )}
            {results && !running && (
              <div>
                {/* ── Stats ── */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
                  <StatCard label="Total"    value={results.total}          color={T.tp} />
                  <StatCard label="Passed"   value={results.passed}         color={T.green} />
                  <StatCard label="Failed"   value={results.failed}         color={results.failed > 0 ? T.red : T.tm} />
                  <StatCard label="Avg time" value={`${results.avgTime}ms`} color={T.accentText} />
                </div>

                {/* ── Filter + Export row ── */}
                <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
                  {[["all", "All", results.total], ["pass", "Passed", results.passed], ["fail", "Failed", results.failed]].map(([v, l, c]) => (
                    <button key={v} onClick={() => setFilter(v)}
                      style={{ padding: "5px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", borderRadius: 5, border: `1px solid ${filter === v ? T.accent : T.border}`, background: filter === v ? T.accentDim : "transparent", color: filter === v ? T.accentText : T.ts, fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s" }}>
                      {l} <span style={{ fontFamily: T.mono, fontSize: 11 }}>{c}</span>
                    </button>
                  ))}

                  {/* ── Export buttons ── */}
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: T.tm }}>Export:</span>
                    {[["json", "JSON"], ["csv", "CSV"], ["html", "HTML"]].map(([fmt, label]) => (
                      <button key={fmt} className="export-btn" onClick={() => exportResults(fmt)} style={exportBtnStyle}>
                        ↓ {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Request list ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {filteredReqs.map((req, i) => <RequestRow key={i} req={req} index={i} onSelect={setSelected} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && <RequestDetail req={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}