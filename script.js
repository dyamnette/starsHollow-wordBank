// Persistent drag-and-drop puzzle logic
const CORRECT_ANSWERS = {
  1: ["Johnny", "Machete"],
  2: ["Bert"],
  3: ["Fade", "Into", "You"],
  4: ["When", "Applying", "To", "Yale", "Daily", "News"],
  5: ["Train", "Derailment", "Carrying", "A", "Load", "Of", "Pickles"]
};




let guessesState = {};
let bankOrder = [];

function loadGuesses() {
  try {
    guessesState = JSON.parse(localStorage.getItem("guesses") || "{}");
  } catch (_) {
    guessesState = {};
  }
}

function saveGuesses() {
  localStorage.setItem("guesses", JSON.stringify(guessesState));
}

function loadBankOrder() {
  try {
    bankOrder = JSON.parse(localStorage.getItem("bankOrder") || "[]");
    if (!Array.isArray(bankOrder)) bankOrder = [];
  } catch (_) {
    bankOrder = [];
  }
}

function saveBankOrder() {
  localStorage.setItem("bankOrder", JSON.stringify(bankOrder));
}

function getWordBank() {
  try {
    const rawData = localStorage.getItem("wordBank") || "[]";
    const wordBank = JSON.parse(rawData);
    
    // Check if we have old format data (strings) and clear cache if so
    const hasOldFormat = wordBank.some(entry => typeof entry === 'string');
    if (hasOldFormat) {
      console.log("Detected old format data, clearing cache for compatibility");
      localStorage.removeItem("wordBank");
      localStorage.removeItem("scannedIds");
      localStorage.removeItem("guesses");
      localStorage.removeItem("bankOrder");
      return [];
    }
    
    // Ensure all entries are properly formatted for iOS Safari
    return wordBank.map(entry => {
      if (entry && typeof entry === 'object') {
        return {
          word: String(entry.word || ''),
          id: String(entry.id || '')
        };
      } else {
        return String(entry || ''); // Fallback
      }
    });
  } catch (e) {
    console.error("Error reading wordBank:", e);
    return [];
  }
}

function getAllGuessedWords() {
  // Return just the word text for filtering (extract from unique IDs)
  return Object.values(guessesState).flat().map(uniqueId => {
    if (typeof uniqueId === 'string' && uniqueId.includes('_')) {
      // Extract word from uniqueId format "word_id"
      return uniqueId.split('_')[0];
    }
    return uniqueId; // Old format, just return as is
  });
}

function getAllGuessedUniqueIds() {
  // Return the actual unique IDs for precise tracking
  return Object.values(guessesState).flat();
}

function createWordElement(wordEntry, isBank) {
  const el = document.createElement("div");
  el.className = "word";
  
  let displayText, uniqueId;
  
  if (typeof wordEntry === 'string') {
    // Old format or guessed word (just text)
    displayText = wordEntry;
    uniqueId = wordEntry; // For old format, use word as ID
  } else if (wordEntry && typeof wordEntry === 'object' && wordEntry.word) {
    // New format with word+ID
    displayText = String(wordEntry.word);
    uniqueId = `${wordEntry.word}_${wordEntry.id}`; // Create unique identifier
  } else {
    displayText = String(wordEntry || '');
    uniqueId = displayText;
  }
  
  // Final check to prevent [object Object]
  if (displayText === '[object Object]') {
    displayText = 'Unknown Word';
  }
  
  el.textContent = displayText;
  el.setAttribute("data-word", displayText);
  el.setAttribute("data-unique-id", uniqueId); // Store unique ID for drag operations
  el.draggable = true;

  el.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", uniqueId); // Use unique ID instead of just text
    e.dataTransfer.effectAllowed = "move";
    el.classList.add("dragging");
  });
  el.addEventListener("dragend", () => el.classList.remove("dragging"));

  // Touch/pen pointer fallback for mobile devices (iOS & Android)
  el.addEventListener("pointerdown", e => {
    // Only handle primary button and non-mouse to preserve native mouse DnD
    if (e.button !== 0) return;
    if (e.pointerType === "mouse") return;
    startPointerDrag(e, el, uniqueId); // Use unique ID
  });

  // No per-word remove icon; users can drag back to the word bank to remove
  return el;
}

function renderBank() {
  const bank = document.getElementById("bank");
  if (!bank) return;
  bank.innerHTML = "";
  const wordBankEntries = getWordBank();
  const guessedUniqueIds = new Set(getAllGuessedUniqueIds());
  
  // Filter out entries that are currently guessed (by unique ID)
  const visibleEntries = wordBankEntries.filter(entry => {
    if (typeof entry === 'object' && entry.word && entry.id) {
      const uniqueId = `${entry.word}_${entry.id}`;
      return !guessedUniqueIds.has(uniqueId);
    } else {
      // Old format - check by word text
      return !guessedUniqueIds.has(entry);
    }
  });
  
  // For ordering, we need unique words (not duplicates)
  const uniqueVisibleWords = [...new Set(visibleEntries.map(entry => {
    return typeof entry === 'object' ? entry.word : entry;
  }))];

  // Normalize bankOrder to include all unique visible words (append missing in current order)
  const orderSet = new Set(bankOrder);
  let mutated = false;
  uniqueVisibleWords.forEach(w => {
    if (!orderSet.has(w)) {
      bankOrder.push(w);
      orderSet.add(w);
      mutated = true;
    }
  });
  if (mutated) saveBankOrder();

  // Sort visible entries by their word's position in bankOrder
  const indexOfOrMax = w => {
    const idx = bankOrder.indexOf(w);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  visibleEntries.sort((a, b) => {
    const wordA = typeof a === 'object' ? a.word : a;
    const wordB = typeof b === 'object' ? b.word : b;
    return indexOfOrMax(wordA) - indexOfOrMax(wordB);
  });

  // Render all visible entries (including duplicates with different IDs)
  visibleEntries.forEach(entry => {
    bank.appendChild(createWordElement(entry, true)); // Pass full entry to createWordElement
  });
}

function renderZones() {
  document.querySelectorAll(".drop-zone").forEach(zone => {
    const zoneId = zone.getAttribute("data-zone");
    const uniqueIds = Array.isArray(guessesState[zoneId]) ? guessesState[zoneId] : [];
    zone.innerHTML = "";
    uniqueIds.forEach(uniqueId => {
      // For guessed words, we need to create a pseudo-entry that createWordElement can handle
      let wordEntry;
      if (typeof uniqueId === 'string' && uniqueId.includes('_')) {
        const parts = uniqueId.split('_');
        const word = parts[0];
        const id = parts[1];
        wordEntry = { word: word, id: id }; // Reconstruct the entry
      } else {
        wordEntry = uniqueId; // Old format
      }
      zone.appendChild(createWordElement(wordEntry, false));
    });
  });
}

function renderAll() {
  renderZones();
  renderBank();
}

function removeWordFromAllZones(uniqueId) {
  for (const key of Object.keys(guessesState)) {
    guessesState[key] = (guessesState[key] || []).filter(id => id !== uniqueId);
  }
}

function getInsertionIndex(container, clientX, clientY) {
  const children = Array.from(container.querySelectorAll(".word"));
  if (children.length === 0) return 0;

  // First try: find best candidate within the same visual row
  let best = { dist: Infinity, index: children.length };
  children.forEach((child, index) => {
    const box = child.getBoundingClientRect();
    const inRow = clientY >= box.top && clientY <= box.bottom;
    const centerX = box.left + box.width / 2;
    const dx = Math.abs(clientX - centerX);
    if (inRow && dx < best.dist) {
      best = { dist: dx, index: clientX < centerX ? index : index + 1 };
    }
  });
  if (best.dist !== Infinity) return Math.max(0, Math.min(best.index, children.length));

  // Fallback: choose closest by vertical proximity, then left/right of center
  let closest = { dy: Infinity, index: children.length };
  children.forEach((child, index) => {
    const box = child.getBoundingClientRect();
    const centerY = box.top + box.height / 2;
    const dy = Math.abs(clientY - centerY);
    if (dy < closest.dy) {
      const centerX = box.left + box.width / 2;
      closest = { dy, index: clientX < centerX ? index : index + 1 };
    }
  });
  return Math.max(0, Math.min(closest.index, children.length));
}

function setupDropTargets() {
  // Zones accept drops for adding/moving/reordering
  document.querySelectorAll(".drop-zone").forEach(zone => {
    zone.addEventListener("dragover", e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    zone.addEventListener("drop", e => {
      e.preventDefault();
      const uniqueId = e.dataTransfer.getData("text/plain");
      if (!uniqueId) return;
      const zoneId = zone.getAttribute("data-zone");
      const index = getInsertionIndex(zone, e.clientX, e.clientY);

      // Update state uniquely using unique ID
      removeWordFromAllZones(uniqueId);
      const arr = Array.isArray(guessesState[zoneId]) ? guessesState[zoneId] : [];
      arr.splice(index, 0, uniqueId);
      guessesState[zoneId] = arr;
      saveGuesses();
      renderAll();
    });

    // Pointer-drag hover feedback for touch fallback
    zone.addEventListener("pointerenter", e => {
      if (e.pointerType !== "mouse") zone.classList.add("drop-target-hover");
    });
    zone.addEventListener("pointerleave", () => zone.classList.remove("drop-target-hover"));
  });

  // Bank accepts drops to remove words from guesses
  const bank = document.getElementById("bank");
  if (bank) {
    bank.addEventListener("dragover", e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    bank.addEventListener("drop", e => {
      e.preventDefault();
      const uniqueId = e.dataTransfer.getData("text/plain");
      if (!uniqueId) return;
      // Extract word text from unique ID for bank operations
      const wordText = uniqueId.includes('_') ? uniqueId.split('_')[0] : uniqueId;
      
      // When dropping back to bank, we don't need to filter out the current item
      // because we're moving it FROM a guess zone TO the bank
      const wordBankEntries = getWordBank();
      const guessedUniqueIds = new Set(getAllGuessedUniqueIds());
      // Remove the item we're currently dragging from the guessed set for this calculation
      guessedUniqueIds.delete(uniqueId);
      
      const visibleWords = wordBankEntries
        .filter(entry => {
          if (typeof entry === 'object' && entry.word && entry.id) {
            const entryUniqueId = `${entry.word}_${entry.id}`;
            return !guessedUniqueIds.has(entryUniqueId);
          } else {
            return !guessedUniqueIds.has(entry);
          }
        })
        .map(entry => typeof entry === 'object' ? entry.word : entry);

      const index = getInsertionIndex(bank, e.clientX, e.clientY);

      // Update bank order: move word among visible list
      // Ensure bankOrder is loaded
      loadBankOrder();
      // Remove word from bankOrder if exists
      bankOrder = bankOrder.filter(w => w !== wordText);
      // Build visible order based on current bankOrder
      const currentVisibleOrdered = bankOrder.filter(w => visibleWords.includes(w));
      // Insert word at target index
      currentVisibleOrdered.splice(Math.max(0, Math.min(index, currentVisibleOrdered.length)), 0, wordText);
      // Compose new bankOrder: keep new visible order first, then the rest (non-visible) preserving prior order
      const visibleSet = new Set(currentVisibleOrdered);
      const rest = bankOrder.filter(w => !visibleSet.has(w));
      bankOrder = currentVisibleOrdered.concat(rest);
      saveBankOrder();

      // If the word was in a guess, remove it using unique ID
      removeWordFromAllZones(uniqueId);
      saveGuesses();
      renderAll();
    });

    bank.addEventListener("pointerenter", e => {
      if (e.pointerType !== "mouse") bank.classList.add("drop-target-hover");
    });
    bank.addEventListener("pointerleave", () => bank.classList.remove("drop-target-hover"));
  }
}

// Touch/pen pointer-based drag fallback
let activePointerDrag = null;

function startPointerDrag(startEvent, originEl, word) {
  const pointerId = startEvent.pointerId;
  activePointerDrag = { pointerId, word };
  document.body.classList.add("dragging-touch");

  const dragGhost = originEl.cloneNode(true);
  dragGhost.classList.add("dragging");
  dragGhost.style.position = "fixed";
  dragGhost.style.pointerEvents = "none";
  dragGhost.style.opacity = "0.9";
  dragGhost.style.transform = "translate(-50%, -50%)";
  dragGhost.style.zIndex = "9999";
  document.body.appendChild(dragGhost);

  const move = (e) => {
    if (e.pointerId !== pointerId) return;
    dragGhost.style.left = `${e.clientX}px`;
    dragGhost.style.top = `${e.clientY}px`;
  };

  const end = (e) => {
    if (e.pointerId !== pointerId) return;
    cleanup();
    const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
    handlePointerDrop(dropTarget, e.clientX, e.clientY, word);
  };

  const cancel = (e) => {
    if (e.pointerId !== pointerId) return;
    cleanup();
  };

  function cleanup() {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", cancel);
    document.body.classList.remove("dragging-touch");
    if (dragGhost && dragGhost.parentNode) dragGhost.parentNode.removeChild(dragGhost);
    activePointerDrag = null;
  }

  document.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", cancel);
}

function handlePointerDrop(target, clientX, clientY, uniqueId) {
  if (!target) return;
  // Find closest zone or the bank container
  const zone = target.closest ? target.closest(".drop-zone") : null;
  const bank = document.getElementById("bank");
  if (zone) {
    const zoneId = zone.getAttribute("data-zone");
    const index = getInsertionIndex(zone, clientX, clientY);
    removeWordFromAllZones(uniqueId);
    const arr = Array.isArray(guessesState[zoneId]) ? guessesState[zoneId] : [];
    arr.splice(index, 0, uniqueId);
    guessesState[zoneId] = arr;
    saveGuesses();
    renderAll();
    return;
  }
  if (bank && (target === bank || (target.closest && target.closest("#bank")))) {
    // Extract word text from unique ID for bank operations
    const wordText = uniqueId.includes('_') ? uniqueId.split('_')[0] : uniqueId;
    
    const wordBankEntries = getWordBank();
    const guessedUniqueIds = new Set(getAllGuessedUniqueIds());
    // Remove the item we're currently dragging from the guessed set for this calculation
    guessedUniqueIds.delete(uniqueId);
    
    const visibleWords = wordBankEntries
      .filter(entry => {
        if (typeof entry === 'object' && entry.word && entry.id) {
          const entryUniqueId = `${entry.word}_${entry.id}`;
          return !guessedUniqueIds.has(entryUniqueId);
        } else {
          return !guessedUniqueIds.has(entry);
        }
      })
      .map(entry => typeof entry === 'object' ? entry.word : entry);
    const index = getInsertionIndex(bank, clientX, clientY);
    loadBankOrder();
    bankOrder = bankOrder.filter(w => w !== wordText);
    const currentVisibleOrdered = bankOrder.filter(w => visibleWords.includes(w));
    currentVisibleOrdered.splice(Math.max(0, Math.min(index, currentVisibleOrdered.length)), 0, wordText);
    const visibleSet = new Set(currentVisibleOrdered);
    const rest = bankOrder.filter(w => !visibleSet.has(w));
    bankOrder = currentVisibleOrdered.concat(rest);
    saveBankOrder();
    removeWordFromAllZones(uniqueId);
    saveGuesses();
    renderAll();
  }
}

function setupButtons() {
  const undoAll = document.getElementById("undo-all");
  if (undoAll) {
    undoAll.addEventListener("click", () => {
      if (confirm("Undo all guesses? This will clear the four boxes but keep your unlocked word bank.")) {
        localStorage.removeItem("guesses");
        location.reload();
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadGuesses();
  loadBankOrder();
  renderAll();
  setupDropTargets();
  setupButtons();
});

