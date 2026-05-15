const input = document.getElementById("search");
const results = document.getElementById("results");

input?.addEventListener("input", () => {
  const q = input.value.trim().toLowerCase();
  if (!q) {
    results.style.display = "none";
    results.innerHTML = "";
    return;
  }
  const matches = window.SEARCH_INDEX
    .map(page => {
      const hay = `${page.title} ${page.text}`.toLowerCase();
      const score = q.split(/\s+/).filter(term => hay.includes(term)).length;
      return { ...page, score };
    })
    .filter(page => page.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  results.innerHTML = matches.length
    ? matches.map(page => `<a href="${page.slug}.html">${page.title}</a>`).join("")
    : "<span>No matches</span>";
  results.style.display = "block";
});