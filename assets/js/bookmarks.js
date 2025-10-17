const STORAGE_PREFIX = "overlay";
const STORAGE_VERSION = 1;
const DEFAULT_GROUP = "Bookmarks";

function storageKey(profileId) {
  const prof = (profileId || "default").toLowerCase();
  return `${STORAGE_PREFIX}.${prof}.v${STORAGE_VERSION}`;
}

function normalizeSortMode(mode) {
  if (typeof mode !== "string") return null;
  const normalized = mode.toLowerCase();
  return ["alpha", "smart", "insertion"].includes(normalized) ? normalized : null;
}

function emptyOverlay() {
  return {
    version: STORAGE_VERSION,
    groups: {},
    hide: [],
    order: { groups: [], labels: {} },
    sort: { groups: "insertion", labels: { default: "insertion" } },
  };
}

function normalizeOverlayCandidate(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return emptyOverlay();
  }
  if (candidate.version && candidate.version !== STORAGE_VERSION) {
    return emptyOverlay();
  }
  const groups = candidate.groups && typeof candidate.groups === "object" ? candidate.groups : {};
  const hide = Array.isArray(candidate.hide) ? candidate.hide : [];
  const order = candidate.order && typeof candidate.order === "object" ? candidate.order : {};
  const sort = candidate.sort && typeof candidate.sort === "object" ? candidate.sort : {};

  const normalized = emptyOverlay();
  normalized.groups = Object.fromEntries(
    Object.entries(groups).map(([groupName, items]) => [
      groupName,
      Array.isArray(items)
        ? items
            .filter((item) => item && typeof item === "object")
            .map((item) => ({
              label: typeof item.label === "string" ? item.label : "",
              url: typeof item.url === "string" ? item.url : "",
            }))
        : [],
    ])
  );
  normalized.hide = hide.filter((label) => typeof label === "string");
  normalized.order.groups = Array.isArray(order.groups)
    ? order.groups.filter((group) => typeof group === "string")
    : [];
  normalized.order.labels =
    order.labels && typeof order.labels === "object"
      ? Object.fromEntries(
          Object.entries(order.labels).map(([groupName, labels]) => [
            groupName,
            Array.isArray(labels) ? labels.filter((label) => typeof label === "string") : [],
          ])
        )
      : {};
  normalized.sort.groups = normalizeSortMode(sort.groups) || "insertion";
  normalized.sort.labels =
    sort.labels && typeof sort.labels === "object"
      ? Object.fromEntries(
          Object.entries(sort.labels).map(([groupName, mode]) => [
            groupName,
            normalizeSortMode(mode) || "insertion",
          ])
        )
      : { default: "insertion" };
  if (!normalized.sort.labels.default) normalized.sort.labels.default = "insertion";
  return normalized;
}

export function normalizeImportedOverlay(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Invalid overlay payload");
  if (raw.version && raw.version !== STORAGE_VERSION) {
    throw new Error(`Unsupported overlay version: ${raw.version}`);
  }
  return normalizeOverlayCandidate(raw);
}

export function loadOverlay(profileId) {
  try {
    const raw = localStorage.getItem(storageKey(profileId));
    if (!raw) return emptyOverlay();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== STORAGE_VERSION) return emptyOverlay();
    return normalizeOverlayCandidate(parsed);
  } catch {
    return emptyOverlay();
  }
}

export function saveOverlay(profileId, overlay) {
  try {
    const normalized = normalizeOverlayCandidate(overlay);
    localStorage.setItem(storageKey(profileId), JSON.stringify(normalized));
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}
export function mergeWithOverlay(baseline, overlayCandidate) {
  const overlay = normalizeOverlayCandidate(overlayCandidate);
  const hidden = new Map();
  overlay.hide.forEach((label) => {
    const key = normalizeLabel(label);
    if (key) hidden.set(key, label);
  });

  const overlayEntries = collectOverlayEntries(overlay);
  const overlayLabelLookup = new Map();
  overlayEntries.forEach((entry) => {
    overlayLabelLookup.set(entry.labelKey, entry);
  });

  const sectionsMap = new Map();
  const baselineSections = Array.isArray(baseline?.sections) ? baseline.sections : [];

  baselineSections.forEach((section, index) => {
    const title = typeof section.title === "string" && section.title.trim() ? section.title : "Links";
    const key = normalizeGroup(title);
    const record = {
      title,
      key,
      origin: "baseline",
      baseIndex: index,
      overlayIndex: Number.POSITIVE_INFINITY,
      items: [],
    };
    sectionsMap.set(key, record);

    const items = Array.isArray(section.items) ? section.items : [];
    items.forEach((item, itemIndex) => {
      if (!item) return;
      const label = typeof item.label === "string" && item.label.trim() ? item.label : item.url || "bookmark";
      const labelKey = normalizeLabel(label);
      if (!labelKey) return;
      if (hidden.has(labelKey)) return;
      if (overlayLabelLookup.has(labelKey)) return; // overlay overrides baseline entry
      record.items.push({
        label,
        url: typeof item.url === "string" ? item.url : "",
        orderIndex: itemIndex,
        origin: "baseline",
      });
    });
  });

  let overlayGroupCounter = 0;
  overlayEntries.forEach((entry) => {
    if (hidden.has(entry.labelKey)) return;
    const key = normalizeGroup(entry.groupName);
    if (!sectionsMap.has(key)) {
      sectionsMap.set(key, {
        title: entry.groupName,
        key,
        origin: "overlay",
        baseIndex: Number.POSITIVE_INFINITY,
        overlayIndex: overlayGroupCounter++,
        items: [],
      });
    }
    const record = sectionsMap.get(key);
    if (record.overlayIndex === Number.POSITIVE_INFINITY && record.origin === "baseline") {
      record.overlayIndex = overlayGroupCounter++;
    }
    record.items.push({
      label: entry.label,
      url: entry.url,
      orderIndex: entry.orderIndex,
      origin: "overlay",
    });
  });

  const orderedSections = applyGroupOrdering([...sectionsMap.values()], overlay);
  const finalSections = orderedSections.map((section) => {
    const items = applyItemOrdering(section, overlay, hidden);
    return {
      title: section.title,
      items: items.map(({ label, url }) => ({ label, url })),
    };
  });

  return {
    ...baseline,
    sections: finalSections,
  };
}

export function addBookmark(overlayCandidate, bookmark) {
  const overlay = normalizeOverlayCandidate(overlayCandidate);
  if (!bookmark || typeof bookmark.label !== "string" || typeof bookmark.url !== "string") return overlay;
  const label = bookmark.label.trim();
  const url = bookmark.url.trim();
  if (!label || !url) return overlay;
  const labelKey = normalizeLabel(label);
  const groupName = cleanGroupName(bookmark.group);

  removeOverlayEntry(overlay, labelKey);
  removeFromHide(overlay, labelKey);

  if (!overlay.groups[groupName]) overlay.groups[groupName] = [];
  overlay.groups[groupName].push({ label, url });
  return overlay;
}

export function removeBookmark(overlayCandidate, label) {
  const overlay = normalizeOverlayCandidate(overlayCandidate);
  const labelKey = normalizeLabel(label);
  if (!labelKey) return overlay;

  const removed = removeOverlayEntry(overlay, labelKey);
  if (!removed) {
    addToHide(overlay, label, labelKey);
  } else {
    updateOrderLabel(overlay, removed.groupName, removed.label, null);
    removeFromHide(overlay, labelKey);
  }
  return overlay;
}

export function moveBookmark(overlayCandidate, label, newGroupName) {
  const overlay = normalizeOverlayCandidate(overlayCandidate);
  const labelKey = normalizeLabel(label);
  if (!labelKey) return overlay;

  const entry = removeOverlayEntry(overlay, labelKey);
  if (!entry) return overlay;

  const groupName = cleanGroupName(newGroupName);
  if (!overlay.groups[groupName]) overlay.groups[groupName] = [];
  overlay.groups[groupName].push({ label: entry.label, url: entry.url });
  updateOrderLabel(overlay, entry.groupName, entry.label, null);
  removeFromHide(overlay, labelKey);
  return overlay;
}

export function renameBookmark(overlayCandidate, oldLabel, newLabel) {
  const overlay = normalizeOverlayCandidate(overlayCandidate);
  const oldKey = normalizeLabel(oldLabel);
  const newKey = normalizeLabel(newLabel);
  if (!oldKey || !newKey) return overlay;
  if (oldKey === newKey) return overlay;

  const entry = findOverlayEntry(overlay, oldKey);
  if (!entry) return overlay;

  const list = overlay.groups[entry.groupName];
  if (!Array.isArray(list)) return overlay;
  list[entry.index] = { label: newLabel, url: entry.item.url };
  updateOrderLabel(overlay, entry.groupName, oldLabel, newLabel);
  removeFromHide(overlay, newKey);
  addToHide(overlay, oldLabel, oldKey);
  return overlay;
}

export function hideBookmark(overlayCandidate, label) {
  const overlay = normalizeOverlayCandidate(overlayCandidate);
  const key = normalizeLabel(label);
  if (!key) return overlay;
  addToHide(overlay, label, key);
  updateOrderLabel(overlay, null, label, null);
  return overlay;
}

export function unhideBookmark(overlayCandidate, label) {
  const overlay = normalizeOverlayCandidate(overlayCandidate);
  const key = normalizeLabel(label);
  if (!key) return overlay;
  removeFromHide(overlay, key);
  return overlay;
}

export function setSort(overlayCandidate, config) {
  const overlay = normalizeOverlayCandidate(overlayCandidate);
  if (!config) return overlay;
  const mode = normalizeSortMode(config.mode);
  if (!mode) return overlay;
  if (!overlay.sort.labels) overlay.sort.labels = { default: "insertion" };
  if (config.group) {
    overlay.sort.labels[config.group] = mode;
  } else {
    overlay.sort.labels.default = mode;
  }
  return overlay;
}

export function setGroupSortMode(overlayCandidate, mode) {
  const overlay = normalizeOverlayCandidate(overlayCandidate);
  const normalized = normalizeSortMode(mode);
  if (!normalized) return overlay;
  overlay.sort.groups = normalized;
  return overlay;
}

export function applyOrder(overlayCandidate, mergedData) {
  const overlay = normalizeOverlayCandidate(overlayCandidate);
  const sections = Array.isArray(mergedData?.sections) ? mergedData.sections : [];
  overlay.order.groups = sections
    .map((section) => (typeof section.title === "string" ? section.title : null))
    .filter(Boolean);
  overlay.order.labels = {};
  sections.forEach((section) => {
    const title = typeof section.title === "string" ? section.title : "";
    overlay.order.labels[title] = Array.isArray(section.items)
      ? section.items
          .map((item) => (typeof item?.label === "string" ? item.label : null))
          .filter(Boolean)
      : [];
  });
  return overlay;
}

export function resetOrder(overlayCandidate) {
  const overlay = normalizeOverlayCandidate(overlayCandidate);
  overlay.order = { groups: [], labels: {} };
  return overlay;
}
/* Helpers */
function collectOverlayEntries(overlay) {
  const entries = [];
  let cursor = 0;
  Object.keys(overlay.groups).forEach((groupName) => {
    const list = Array.isArray(overlay.groups[groupName]) ? overlay.groups[groupName] : [];
    list.forEach((item, index) => {
      if (!item || typeof item.label !== "string" || typeof item.url !== "string") return;
      const label = item.label.trim();
      const url = item.url.trim();
      if (!label || !url) return;
      const labelKey = normalizeLabel(label);
      if (!labelKey) return;
      entries.push({
        groupName,
        label,
        labelKey,
        url,
        index,
        orderIndex: cursor++,
      });
    });
  });
  return entries;
}

function applyGroupOrdering(sections, overlay) {
  const order = Array.isArray(overlay.order?.groups) ? overlay.order.groups : [];
  const used = new Set();
  const result = [];

  order.forEach((title) => {
    const match = sections.find((section) => normalizeGroup(section.title) === normalizeGroup(title));
    if (match && !used.has(match)) {
      result.push(match);
      used.add(match);
    }
  });

  const remaining = sections.filter((section) => !used.has(section));
  const mode = overlay.sort?.groups || "insertion";
  remaining.sort((a, b) => compareGroups(a, b, mode));
  return result.concat(remaining);
}

function applyItemOrdering(section, overlay, hidden) {
  const items = section.items.slice();
  const orderLabels = overlay.order?.labels || {};
  const orderKey = findOrderKey(orderLabels, section.title);
  const preferred = orderKey ? orderLabels[orderKey] : [];
  const usedIndexes = new Set();
  const ordered = [];

  preferred.forEach((label) => {
    const key = normalizeLabel(label);
    const index = items.findIndex((item, idx) => !usedIndexes.has(idx) && normalizeLabel(item.label) === key);
    if (index >= 0) {
      usedIndexes.add(index);
      ordered.push(items[index]);
    }
  });

  const mode = determineItemSortMode(overlay, section.title);
  const remaining = items.filter((_, idx) => !usedIndexes.has(idx));
  remaining.sort((a, b) => compareItems(a, b, mode));

  return ordered.concat(remaining).filter((item) => !hidden.has(normalizeLabel(item.label)));
}

function compareGroups(a, b, mode) {
  if (mode === "alpha" || mode === "smart") {
    const left = normalizeSortTitle(a.title);
    const right = normalizeSortTitle(b.title);
    if (left === right) return 0;
    return left < right ? -1 : 1;
  }
  const aIndex = Math.min(a.baseIndex, a.overlayIndex);
  const bIndex = Math.min(b.baseIndex, b.overlayIndex);
  return aIndex - bIndex;
}

function compareItems(a, b, mode) {
  if (mode === "alpha") {
    const left = normalizeLabel(a.label);
    const right = normalizeLabel(b.label);
    if (left === right) return 0;
    return left < right ? -1 : 1;
  }
  if (mode === "smart") {
    const left = normalizeSmartLabel(a.label);
    const right = normalizeSmartLabel(b.label);
    if (left === right) return 0;
    return left < right ? -1 : 1;
  }
  return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
}

function normalizeSmartLabel(label) {
  return normalizeLabel(label).replace(/^(the|an|a)\s+/i, "");
}

function normalizeSortTitle(title) {
  return normalizeSmartLabel(title.replace(/^\/\/+\s*/, ""));
}

function determineItemSortMode(overlay, groupTitle) {
  const labelsSort = overlay.sort?.labels || {};
  if (typeof groupTitle === "string") {
    const key = findOrderKey(labelsSort, groupTitle);
    if (key && labelsSort[key]) return labelsSort[key];
  }
  return labelsSort.default || "insertion";
}

function findOrderKey(map, groupTitle) {
  if (!map || typeof map !== "object") return null;
  const target = normalizeGroup(groupTitle || "");
  return Object.keys(map).find((key) => normalizeGroup(key) === target) || null;
}

function normalizeLabel(label) {
  if (typeof label !== "string") return "";
  return label.trim().toLowerCase();
}

function normalizeGroup(groupName) {
  if (typeof groupName !== "string") return "";
  return groupName.trim().toLowerCase();
}

function cleanGroupName(groupName) {
  const raw = typeof groupName === "string" ? groupName.trim() : "";
  if (!raw) return DEFAULT_GROUP;
  return raw;
}

function removeOverlayEntry(overlay, labelKey) {
  if (!labelKey) return null;
  const groups = overlay.groups || {};
  for (const groupName of Object.keys(groups)) {
    const list = Array.isArray(groups[groupName]) ? groups[groupName] : [];
    const index = list.findIndex((item) => normalizeLabel(item.label) === labelKey);
    if (index >= 0) {
      const [removed] = list.splice(index, 1);
      if (!list.length) delete groups[groupName];
      return { groupName, label: removed.label, url: removed.url };
    }
  }
  return null;
}

function findOverlayEntry(overlay, labelKey) {
  if (!labelKey) return null;
  const groups = overlay.groups || {};
  for (const groupName of Object.keys(groups)) {
    const list = Array.isArray(groups[groupName]) ? groups[groupName] : [];
    const index = list.findIndex((item) => normalizeLabel(item.label) === labelKey);
    if (index >= 0) {
      return { groupName, index, item: list[index] };
    }
  }
  return null;
}

function addToHide(overlay, label, labelKey) {
  if (!labelKey) return;
  const hide = overlay.hide || (overlay.hide = []);
  if (hide.some((existing) => normalizeLabel(existing) === labelKey)) return;
  hide.push(typeof label === "string" ? label : labelKey);
}

function removeFromHide(overlay, labelKey) {
  if (!labelKey || !Array.isArray(overlay.hide)) return;
  const next = overlay.hide.filter((entry) => normalizeLabel(entry) !== labelKey);
  overlay.hide = next;
}

function updateOrderLabel(overlay, groupName, oldLabel, newLabel) {
  if (!overlay.order || !overlay.order.labels) return;
  const targetKeys = groupName
    ? [findOrderKey(overlay.order.labels, groupName)].filter(Boolean)
    : Object.keys(overlay.order.labels);
  const oldKey = normalizeLabel(oldLabel);
  targetKeys.forEach((key) => {
    const list = Array.isArray(overlay.order.labels[key]) ? overlay.order.labels[key] : [];
    for (let i = 0; i < list.length; i += 1) {
      if (normalizeLabel(list[i]) === oldKey) {
        if (newLabel) {
          list[i] = newLabel;
        } else {
          list.splice(i, 1);
        }
        break;
      }
    }
    overlay.order.labels[key] = list;
  });
}

