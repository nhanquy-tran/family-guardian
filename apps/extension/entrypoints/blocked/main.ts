const domain = new URLSearchParams(location.search).get("d") ?? "";
const target = document.getElementById("domain");
if (target !== null) target.textContent = domain;
if (domain !== "") void browser.runtime.sendMessage({ type: "blocked", domain });
