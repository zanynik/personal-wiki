const script = document.currentScript;
const graphUrl = script?.dataset.graphUrl || "data/truth_graph.json";
const startSelect = document.getElementById("start-node");
const endSelect = document.getElementById("end-node");
const findButton = document.getElementById("find-path");
const statusEl = document.getElementById("graph-status");
const pathEl = document.getElementById("graph-path");
const essayEl = document.getElementById("graph-essay");
const svg = document.getElementById("graph-svg");

let truthNodes = new Map();
let directed = new Map();
let undirected = new Map();
let graphMode = "directed";

function textOf(id) {
  return truthNodes.get(id)?.statement || id;
}

function supportOf(id) {
  return truthNodes.get(id)?.support_count || 0;
}

function addEdge(map, source, target) {
  if (!map.has(source)) map.set(source, []);
  map.get(source).push(target);
}

function shortestPath(start, end, adjacency) {
  if (start === end) return [start];
  const queue = [[start]];
  const seen = new Set([start]);
  while (queue.length) {
    const path = queue.shift();
    const current = path[path.length - 1];
    for (const next of adjacency.get(current) || []) {
      if (seen.has(next)) continue;
      const nextPath = [...path, next];
      if (next === end) return nextPath;
      seen.add(next);
      if (nextPath.length < 9) queue.push(nextPath);
    }
  }
  return null;
}

function findBestPath(start, end) {
  const direct = shortestPath(start, end, directed);
  if (direct) {
    graphMode = "directed";
    return direct;
  }
  const bridge = shortestPath(start, end, undirected);
  if (bridge) {
    graphMode = "bridge";
    return bridge;
  }
  graphMode = "comparison";
  return [start, end];
}

function optionLabel(node) {
  return `${node.statement} (${node.support_count})`;
}

function populateControls(nodes, edges) {
  const causalIds = new Set();
  for (const edge of edges) {
    if (edge.type !== "causes") continue;
    causalIds.add(edge.source);
    causalIds.add(edge.target);
  }
  const ranked = nodes
    .filter(node => causalIds.has(node.id))
    .sort((a, b) => (b.support_count - a.support_count) || a.statement.localeCompare(b.statement));
  for (const node of ranked) {
    const startOption = new Option(optionLabel(node), node.id);
    const endOption = new Option(optionLabel(node), node.id);
    startSelect.add(startOption);
    endSelect.add(endOption);
  }
  if (ranked.length > 1) endSelect.selectedIndex = 1;
}

function renderGraph(path) {
  const width = Math.max(780, path.length * 220);
  const height = 330;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#0f766e"></path></marker>`;
  svg.appendChild(defs);
  const gap = width / Math.max(1, path.length);
  const y = 155;
  path.forEach((id, index) => {
    const x = gap * index + gap / 2;
    if (index < path.length - 1) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(x + 74));
      line.setAttribute("y1", String(y));
      line.setAttribute("x2", String(x + gap - 78));
      line.setAttribute("y2", String(y));
      line.setAttribute("stroke", graphMode === "directed" ? "#0f766e" : "#8a7f6d");
      line.setAttribute("stroke-width", "2");
      line.setAttribute("marker-end", "url(#arrow)");
      svg.appendChild(line);
    }
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(x - 82));
    rect.setAttribute("y", String(y - 62));
    rect.setAttribute("width", "164");
    rect.setAttribute("height", "124");
    rect.setAttribute("rx", "7");
    rect.setAttribute("fill", index === 0 || index === path.length - 1 ? "#d7ebe7" : "#fffdf8");
    rect.setAttribute("stroke", "#0f766e");
    group.appendChild(rect);
    const label = wrapText(textOf(id), 22, 5);
    label.forEach((lineText, lineIndex) => {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(x));
      text.setAttribute("y", String(y - 34 + lineIndex * 16));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-family", "ui-sans-serif, system-ui, sans-serif");
      text.setAttribute("font-size", "12");
      text.textContent = lineText;
      group.appendChild(text);
    });
    const support = document.createElementNS("http://www.w3.org/2000/svg", "text");
    support.setAttribute("x", String(x));
    support.setAttribute("y", String(y + 48));
    support.setAttribute("text-anchor", "middle");
    support.setAttribute("font-family", "ui-sans-serif, system-ui, sans-serif");
    support.setAttribute("font-size", "11");
    support.setAttribute("fill", "#6b675d");
    support.textContent = `${supportOf(id)} source occurrence${supportOf(id) === 1 ? "" : "s"}`;
    group.appendChild(support);
    svg.appendChild(group);
  });
}

function wrapText(value, lineLength, maxLines) {
  const words = value.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > lineLength) {
      lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
    if (lines.length === maxLines - 1) break;
  }
  if (current) lines.push(current.trim());
  if (words.join(" ").length > lines.join(" ").length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/\.*$/, "")}...`;
  }
  return lines;
}

function renderPath(path) {
  const modeLabel = graphMode === "directed"
    ? "Directed cause-effect path"
    : graphMode === "bridge"
      ? "Conceptual bridge through connected causal edges"
      : "No graph bridge found; essay compares the selected truths";
  pathEl.innerHTML = `<h2>${modeLabel}</h2><ol>${path.map(id => `<li>${escapeHtml(textOf(id))}</li>`).join("")}</ol>`;
}

function renderEssay(path) {
  const start = textOf(path[0]);
  const end = textOf(path[path.length - 1]);
  const title = `Logical Essay: ${start.slice(0, 72)}`;
  let body = "";
  if (path.length === 1) {
    body = `<p>${escapeHtml(start)}</p>`;
  } else if (graphMode === "directed") {
    const transitions = path.slice(0, -1).map((id, index) => {
      const next = path[index + 1];
      return `<p>If ${escapeHtml(textOf(id))}, then the graph treats it as producing or enabling this effect: ${escapeHtml(textOf(next))}.</p>`;
    }).join("");
    body = `<p>The selected start node is not just an isolated idea. In this graph it begins a causal chain that points toward the selected end node.</p>${transitions}<p>The essay structure is therefore: begin with ${escapeHtml(start)}, explain each intermediate pressure, and conclude with ${escapeHtml(end)} as the downstream consequence.</p>`;
  } else if (graphMode === "bridge") {
    const transitions = path.slice(0, -1).map((id, index) => {
      const next = path[index + 1];
      return `<p>${escapeHtml(textOf(id))} connects to ${escapeHtml(textOf(next))} in the causal neighborhood of the graph.</p>`;
    }).join("");
    body = `<p>The graph does not show a one-way causal proof from start to end, but it does show a connected chain of related causal statements.</p>${transitions}<p>A careful essay should present this as a conceptual bridge, not as a hard proof: ${escapeHtml(start)} helps frame the conditions under which ${escapeHtml(end)} becomes intelligible.</p>`;
  } else {
    body = `<p>The graph does not currently connect these nodes through cause-effect edges. A useful essay can still compare them as two truths from the same corpus.</p><p>Start with ${escapeHtml(start)}. Then ask what kind of world, system, or inner condition would also make ${escapeHtml(end)} true. The essay should make the missing bridge explicit rather than pretending the graph already proves it.</p>`;
  }
  essayEl.innerHTML = `<h2>${escapeHtml(title)}</h2>${body}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function buildSelection() {
  const start = startSelect.value;
  const end = endSelect.value;
  const path = findBestPath(start, end);
  renderGraph(path);
  renderPath(path);
  renderEssay(path);
  statusEl.textContent = `${graphMode === "directed" ? "Directed" : graphMode === "bridge" ? "Bridge" : "Comparison"} essay built from ${path.length} node${path.length === 1 ? "" : "s"}.`;
}

fetch(graphUrl)
  .then(response => {
    if (!response.ok) throw new Error(`Could not load ${graphUrl}`);
    return response.json();
  })
  .then(graph => {
    const nodes = graph.nodes.filter(node => node.type === "truth");
    const edges = graph.edges.filter(edge => edge.type === "causes");
    truthNodes = new Map(nodes.map(node => [node.id, node]));
    for (const edge of edges) {
      addEdge(directed, edge.source, edge.target);
      addEdge(undirected, edge.source, edge.target);
      addEdge(undirected, edge.target, edge.source);
    }
    populateControls(nodes, edges);
    statusEl.textContent = `${nodes.length.toLocaleString()} truth nodes and ${edges.length.toLocaleString()} cause-effect edges loaded.`;
    buildSelection();
  })
  .catch(error => {
    statusEl.textContent = error.message;
  });

findButton?.addEventListener("click", buildSelection);
startSelect?.addEventListener("change", buildSelection);
endSelect?.addEventListener("change", buildSelection);