// Popup on/off switch. State lives in chrome.storage.local (default on); the
// content scripts read it via IAR.ifEnabled at load, so toggling reloads the
// active tab to apply immediately.
const box = document.getElementById("toggle");
const status = document.getElementById("status");

function render(enabled) {
  box.checked = enabled;
  status.textContent = enabled ? "Blocking algorithmic feeds" : "Paused — feeds are normal";
}

chrome.storage.local.get({ enabled: true }, (d) => render(!!(d && d.enabled)));

box.addEventListener("change", () => {
  const enabled = box.checked;
  chrome.storage.local.set({ enabled }, () => {
    render(enabled);
    chrome.tabs.reload(); // reapply on the current tab
  });
});
