try {
  document.documentElement.dataset.theme = localStorage.getItem("pg-admin-theme") || "system";
} catch {
  document.documentElement.dataset.theme = "system";
}
