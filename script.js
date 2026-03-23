const CITADEL_POWER = { 25: 12500000, 30: 24000000 };
const STORAGE_KEY = "tb_citadel_stage_calculations_v1";

const TROOPS = [
  { name: "Ariel", base: 210000, tier: "m8" },
  { name: "Griffin VII", base: 16500, tier: "m7" },
  { name: "Fire Phoenix I", base: 215000, tier: "m8" },
  { name: "Griffin VI", base: 45000, tier: "m6" },
  { name: "Manticore", base: 115000, tier: "m7" },
  { name: "Vulture VII", base: 5200, tier: "m7" },
  { name: "Vulture VI", base: 2700, tier: "m6" },
  { name: "Vulture V", base: 1500, tier: "m5" },
  { name: "-- Select --", base: 1, tier: "all" },
];

const STAGES = [
  { id: "wall", title: "Wall Killer", weight: 0.0006, multiplier: 2.965, losses: false },
  { id: "first", title: "1. First Striker", weight: 0.016, multiplier: 1, losses: true },
  { id: "second", title: "2. Second Striker", weight: 0.0018, multiplier: 1.556, losses: false },
  { id: "third", title: "3. Third Striker", weight: 0.008, multiplier: 1, losses: false },
  { id: "c1", title: "4. Cleanup 1", weight: 0.0034, multiplier: 1, losses: false },
  { id: "c2", title: "5. Cleanup 2", weight: 0.09, multiplier: 1, losses: false },
  { id: "c3", title: "6. Cleanup 3", weight: 0.16, multiplier: 1, losses: false },
  { id: "c4", title: "7. Cleanup 4", weight: 0.28, multiplier: 1, losses: false },
  { id: "c5", title: "8. Cleanup 5", weight: 0.22, multiplier: 1, losses: false },
  { id: "c6", title: "9. Cleanup 6", weight: 0.22, multiplier: 1, losses: false },
];

const stagesRoot = document.querySelector("#stages");
const template = document.querySelector("#stage-template");
const citadelLevel = document.querySelector("#citadel-level");
const customWrap = document.querySelector("#custom-power-wrap");
const customPower = document.querySelector("#custom-power");
const m89 = document.querySelector("#m89");
const saveName = document.querySelector("#save-name");
const savedList = document.querySelector("#saved-list");

const stageNodes = new Map();
let lastSnapshot = null;

function format(num) {
  return Number(num || 0).toLocaleString();
}

function availableTroops() {
  if (m89.value === "yes") return TROOPS;
  return TROOPS.filter((t) => !["m8", "m9"].includes(t.tier));
}

function buildStages() {
  stagesRoot.innerHTML = "";
  const options = availableTroops();

  for (const stage of STAGES) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.stage = stage.id;
    node.querySelector(".stage-title").textContent = stage.title;

    const troopSelect = node.querySelector("[data-field='troop']");
    troopSelect.innerHTML = options
      .map((troop) => `<option value="${troop.name}">${troop.name}</option>`)
      .join("");

    const healthWrap = node.querySelector("[data-role='health-wrap']");
    const lossRow = node.querySelector("[data-role='loss-row']");
    if (stage.losses) {
      healthWrap.hidden = false;
      lossRow.hidden = false;
    }

    stagesRoot.append(node);
    stageNodes.set(stage.id, node);
  }
}

function targetPower() {
  if (citadelLevel.value === "custom") return Number(customPower.value) || 0;
  return CITADEL_POWER[citadelLevel.value];
}

function calculate() {
  const power = targetPower();
  const snapshot = {
    level: citadelLevel.value,
    power,
    m89: m89.value,
    stages: {},
    createdAt: Date.now(),
  };

  for (const stage of STAGES) {
    const node = stageNodes.get(stage.id);
    const troopName = node.querySelector("[data-field='troop']").value;
    const strength = Number(node.querySelector("[data-field='strengthBonus']").value) || 0;
    const health = Number(node.querySelector("[data-field='healthBonus']")?.value) || 0;
    const troop = TROOPS.find((x) => x.name === troopName) || TROOPS[TROOPS.length - 1];

    const effective = strength * stage.multiplier;
    const stagePower = power * stage.weight;
    const required = Math.ceil(stagePower / (troop.base * (1 + effective / 100)));
    const losses = stage.losses ? Math.ceil(required * Math.max(0.05, 0.18 - health / 10000)) : 0;

    node.querySelector("[data-field='effective']").textContent = `${effective.toFixed(1)}%`;
    node.querySelector("[data-field='required']").textContent = format(required);
    if (stage.losses) {
      node.querySelector("[data-field='losses']").textContent = format(losses);
    }

    snapshot.stages[stage.id] = { troopName, strength, health, effective, required, losses };
  }

  lastSnapshot = snapshot;
}

function resetSelections() {
  for (const stage of STAGES) {
    const node = stageNodes.get(stage.id);
    node.querySelector("[data-field='troop']").selectedIndex = 0;
    node.querySelector("[data-field='strengthBonus']").value = 0;
    const health = node.querySelector("[data-field='healthBonus']");
    if (health) health.value = 0;
    node.querySelector("[data-field='effective']").textContent = "0%";
    node.querySelector("[data-field='required']").textContent = "0";
    const loss = node.querySelector("[data-field='losses']");
    if (loss) loss.textContent = "0";
  }
}

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveSaved(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function renderSaved() {
  const items = loadSaved().sort((a, b) => b.createdAt - a.createdAt);
  savedList.innerHTML = "";
  if (!items.length) {
    savedList.innerHTML = "<small>No saved calculations yet.</small>";
    return;
  }

  for (const item of items) {
    const div = document.createElement("div");
    div.className = "saved-item";
    div.innerHTML = `
      <div class='row spread'>
        <strong>${item.name}</strong>
        <small>${new Date(item.createdAt).toLocaleString()}</small>
      </div>
      <small>Citadel ${item.level} · Power ${format(item.power)}</small>
      <div class='row gap' style='margin-top:.4rem'>
        <button data-action='load'>Load</button>
        <button data-action='delete' class='danger'>Delete</button>
      </div>
    `;

    div.querySelector("[data-action='load']").addEventListener("click", () => {
      citadelLevel.value = item.level;
      customWrap.hidden = item.level !== "custom";
      customPower.value = item.power;
      m89.value = item.m89;
      buildStages();

      for (const stage of STAGES) {
        const input = item.stages[stage.id];
        if (!input) continue;
        const node = stageNodes.get(stage.id);
        node.querySelector("[data-field='troop']").value = input.troopName;
        node.querySelector("[data-field='strengthBonus']").value = input.strength;
        const h = node.querySelector("[data-field='healthBonus']");
        if (h) h.value = input.health;
      }
      calculate();
    });

    div.querySelector("[data-action='delete']").addEventListener("click", () => {
      saveSaved(loadSaved().filter((x) => x.id !== item.id));
      renderSaved();
    });

    savedList.append(div);
  }
}

document.querySelector("#calculate").addEventListener("click", calculate);
document.querySelector("#reset-stage").addEventListener("click", resetSelections);
document.querySelector("#save-calc").addEventListener("click", () => {
  if (!lastSnapshot) return;
  const items = loadSaved();
  items.push({ ...lastSnapshot, id: crypto.randomUUID(), name: saveName.value.trim() || `Citadel ${lastSnapshot.level}` });
  saveSaved(items);
  renderSaved();
});

citadelLevel.addEventListener("change", () => {
  customWrap.hidden = citadelLevel.value !== "custom";
});
m89.addEventListener("change", () => {
  buildStages();
  resetSelections();
});

buildStages();
renderSaved();
