const days = document.getElementById("calendarDays");
const blanks = 4; // Oct 1, 2026 starts on Thursday
for (let i = 0; i < blanks; i++) {
  const spacer = document.createElement("span");
  days.appendChild(spacer);
}
for (let d = 1; d <= 31; d++) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = d;
  if (d === 7) b.classList.add("selected");
  b.addEventListener("click", () => {
    document.querySelectorAll(".days button").forEach(x => x.classList.remove("selected"));
    b.classList.add("selected");
  });
  days.appendChild(b);
}

document.querySelectorAll(".time-buttons button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".time-buttons button").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
  });
});

// Keep accordion behavior close to the source: only one FAQ open at a time.
document.querySelectorAll("details").forEach(item => {
  item.addEventListener("toggle", () => {
    if (item.open) {
      document.querySelectorAll("details").forEach(other => {
        if (other !== item) other.open = false;
      });
    }
  });
});
