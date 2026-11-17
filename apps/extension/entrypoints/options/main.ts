const status = document.querySelector<HTMLParagraphElement>("#status");
browser.storage.local.get("deviceToken").then(({ deviceToken }) => {
  if (status && deviceToken) status.textContent = "Connected.";
});
