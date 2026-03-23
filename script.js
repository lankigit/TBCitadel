const PRESETS = {
  25: 12500000,
  30: 24000000,
};

const STORAGE_KEY = "tb_citadel_saved_calculations_v1";

const form = document.querySelector("#planner-form");
const targetLevel = document.querySelector("#target-level");
const targetPower = document.querySelector("#target-power");
const attackBonus = document.querySelector("#attack-bonus");
const safetyBuffer = document.querySelector("#safety-buffer");
const troopRows = document.querySelector("#troop-rows");
const rowTpl = document.querySelector("#troop-row-template");
const resultsCard = document.querySelector("#results-card");
const resultSummary = document.querySelector("#result-summary");
const resultTableBody = document.querySelector("#result-table tbody");
const resultStatus = document.querySelector("#result-status");
const saveButton = document.querySelector("#save-calc");
const calcNameInput = document.querySelector("#calc-name");
const savedList = document.querySelector("#saved-list");
const quickButtons = [...document.querySelectorAll(".quick-btn")];
const toast = document.querySelector("#toast");

let lastCalculation = null;
let toastTimer;

function fmt(number) {
  return Number(number || 0).toLocaleString();
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function setTargetLevel(level) {
  targetLevel.value = level;
  if (level in PRESETS) {
    targetPower.value = PRESETS[level];
    targetPower.disabled = true;
  } else {
    targetPower.disabled = false;
  }
  quickButtons.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.target === level));
}

function addTroopRow(seed = { name: "", attack: 100, available: 0, lossRate: 15 }) {
  const node = rowTpl.content.firstElementChild.cloneNode(true);
  for (const input of node.querySelectorAll("input")) {
    input.value = seed[input.dataset.field] ?? "";
  }
  node.querySelector("[data-action='remove']").addEventListener("click", () => node.remove());
  troopRows.append(node);
}

function getTroopsFromForm() {
  return [...troopRows.querySelectorAll(".troop-row")]
    .map((row) => {
      const read = (field) => row.querySelector(`[data-field='${field}']`).value;
      return {
        name: read("name").trim() || "Unnamed troop",
        attack: Number(read("attack")),
        available: Number(read("available")),
        lossRate: Number(read("lossRate")) / 100,
      };
    })
    .filter((t) => t.attack > 0 && t.available >= 0 && t.lossRate >= 0);
}

function calculatePlan({ targetPowerValue, attackBonusPct, safetyBufferPct, troops }) {
  const adjustedTargetAttack = Math.ceil(
    (targetPowerValue * (1 + safetyBufferPct / 100)) / (1 + attackBonusPct / 100)
  );

  const ranked = [...troops].sort((a, b) => {
    const aEff = a.lossRate / a.attack;
    const bEff = b.lossRate / b.attack;
    if (aEff !== bEff) return aEff - bEff;
    return b.attack - a.attack;
  });

  let remaining = adjustedTargetAttack;
  const chosen = [];

  for (const troop of ranked) {
    if (remaining <= 0) break;
    const need = Math.ceil(remaining / troop.attack);
    const assign = Math.min(need, troop.available);
    if (assign <= 0) continue;

    const attackContrib = assign * troop.attack;
    const losses = Math.ceil(assign * troop.lossRate);
    remaining -= attackContrib;

    chosen.push({
      ...troop,
      assigned: assign,
      attackContrib,
      losses,
    });
  }

  const totalAttack = chosen.reduce((s, c) => s + c.attackContrib, 0);
  const totalTroops = chosen.reduce((s, c) => s + c.assigned, 0);
  const totalLosses = chosen.reduce((s, c) => s + c.losses, 0);

  return {
    adjustedTargetAttack,
    chosen,
    totalAttack,
    totalTroops,
    totalLosses,
    feasible: remaining <= 0,
    shortfallAttack: Math.max(0, remaining),
  };
}

function renderResult(data) {
  resultsCard.hidden = false;
  resultTableBody.innerHTML = "";

  resultStatus.className = `status-pill ${data.feasible ? "ok" : "warn"}`;
  resultStatus.textContent = data.feasible ? "Target reachable" : "Insufficient troops for target";

  resultSummary.innerHTML = [
    ["Required attack", fmt(data.adjustedTargetAttack)],
    ["Assigned attack", fmt(data.totalAttack)],
    ["Total troops", fmt(data.totalTroops)],
    ["Expected losses", fmt(data.totalLosses)],
    ["Shortfall", data.feasible ? "0" : fmt(data.shortfallAttack)],
  ]
    .map(([label, value]) => `<div><div class='k'>${label}</div><div class='v'>${value}</div></div>`)
    .join("");

  for (const row of data.chosen) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.name}</td>
      <td>${fmt(row.assigned)}</td>
      <td>${fmt(row.attackContrib)}</td>
      <td>${fmt(row.losses)}</td>
    `;
    resultTableBody.append(tr);
  }
}

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistSaved(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function renderSaved() {
  const items = loadSaved().sort((a, b) => b.createdAt - a.createdAt);
  savedList.innerHTML = "";

  if (items.length === 0) {
    savedList.innerHTML = `<p class='saved-meta'>No saved scenarios yet.</p>`;
    return;
  }

  for (const item of items) {
    const wrap = document.createElement("article");
    wrap.className = "saved-item";

    const date = new Date(item.createdAt).toLocaleString();
    wrap.innerHTML = `
      <div class='row spread'>
        <strong>${item.name}</strong>
        <span class='saved-meta'>${date}</span>
      </div>
      <div class='saved-meta top-space'>${item.inputs.targetLabel} · Required ${fmt(item.result.adjustedTargetAttack)} · Losses ${fmt(item.result.totalLosses)}</div>
      <div class='row gap top-space'>
        <button data-action='load' class='secondary'>Load</button>
        <button data-action='dup' class='secondary'>Duplicate</button>
        <button data-action='delete' class='danger'>Delete</button>
      </div>
    `;

    wrap.querySelector("[data-action='load']").addEventListener("click", () => {
      hydrateForm(item.inputs);
      renderResult(item.result);
      lastCalculation = structuredClone(item);
      calcNameInput.value = `${item.name} copy`;
      showToast("Scenario loaded");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    wrap.querySelector("[data-action='dup']").addEventListener("click", () => {
      const all = loadSaved();
      all.push({ ...item, id: crypto.randomUUID(), name: `${item.name} (copy)`, createdAt: Date.now() });
      persistSaved(all);
      renderSaved();
      showToast("Scenario duplicated");
    });

    wrap.querySelector("[data-action='delete']").addEventListener("click", () => {
      const all = loadSaved().filter((x) => x.id !== item.id);
      persistSaved(all);
      renderSaved();
      showToast("Scenario deleted");
    });

    savedList.append(wrap);
  }
}

function hydrateForm(inputs) {
  setTargetLevel(inputs.targetLevel);
  targetPower.value = inputs.targetPower;
  attackBonus.value = inputs.attackBonus;
  safetyBuffer.value = inputs.safetyBuffer;

  troopRows.innerHTML = "";
  for (const troop of inputs.troops) {
    addTroopRow({
      name: troop.name,
      attack: troop.attack,
      available: troop.available,
      lossRate: troop.lossRate * 100,
    });
  }
}

function gatherInputPayload() {
  const troops = getTroopsFromForm();
  return {
    targetLevel: targetLevel.value,
    targetLabel: targetLevel.value === "custom" ? "Custom target" : `Citadel ${targetLevel.value}`,
    targetPower: Number(targetPower.value),
    attackBonus: Number(attackBonus.value) || 0,
    safetyBuffer: Number(safetyBuffer.value) || 0,
    troops,
  };
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const inputs = gatherInputPayload();

  if (!inputs.targetPower || inputs.targetPower < 1) {
    showToast("Set a valid target power");
    targetPower.focus();
    return;
  }

  if (inputs.troops.length === 0) {
    showToast("Add at least one valid troop row");
    return;
  }

  const result = calculatePlan({
    targetPowerValue: inputs.targetPower,
    attackBonusPct: inputs.attackBonus,
    safetyBufferPct: inputs.safetyBuffer,
    troops: inputs.troops,
  });

  renderResult(result);
  lastCalculation = {
    id: crypto.randomUUID(),
    name: calcNameInput.value.trim() || `${inputs.targetLabel} plan`,
    createdAt: Date.now(),
    inputs,
    result,
  };
  showToast(result.feasible ? "Plan generated" : "Plan generated with shortfall");
});

targetLevel.addEventListener("change", () => setTargetLevel(targetLevel.value));
quickButtons.forEach((btn) => btn.addEventListener("click", () => setTargetLevel(btn.dataset.target)));

document.querySelector("#add-troop").addEventListener("click", () => addTroopRow());

saveButton.addEventListener("click", () => {
  if (!lastCalculation) {
    showToast("Run a calculation first");
    return;
  }
  const all = loadSaved();
  const name = calcNameInput.value.trim();
  const toSave = { ...lastCalculation, id: crypto.randomUUID(), createdAt: Date.now() };
  if (name) toSave.name = name;
  all.push(toSave);
  persistSaved(all);
  renderSaved();
  showToast("Scenario saved");
});

document.querySelector("#export-calcs").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(loadSaved(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "tb-citadel-calculations.json";
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Exported JSON");
});

document.querySelector("#import-calcs").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed)) throw new Error("Invalid JSON format.");
    const merged = [...loadSaved(), ...parsed].filter((item) => item && item.id && item.inputs && item.result);
    persistSaved(merged);
    renderSaved();
    showToast(`Imported ${parsed.length} records`);
  } catch (error) {
    showToast(`Import failed: ${error.message}`);
  } finally {
    event.target.value = "";
  }
});

addTroopRow({ name: "Infantry T1", attack: 100, available: 20000, lossRate: 22 });
addTroopRow({ name: "Cavalry T1", attack: 150, available: 12000, lossRate: 18 });
addTroopRow({ name: "Shooter T1", attack: 175, available: 9000, lossRate: 14 });
setTargetLevel("25");
renderSaved();
