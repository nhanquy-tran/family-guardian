import { describeBlock } from "../../lib/blocked";

const domain = new URLSearchParams(location.search).get("d") ?? "";
const target = document.getElementById("domain");
if (target !== null) target.textContent = domain;
const heading = document.getElementById("heading");
if (heading !== null) heading.textContent = describeBlock(location.search);
if (domain !== "") void browser.runtime.sendMessage({ type: "blocked", domain });
