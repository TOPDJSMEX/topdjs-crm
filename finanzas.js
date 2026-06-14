// =======================================================
// TopDJs Finanzas CRM v2.0 - Paso 1
// Liquidez: BBVA, NU, Manuel, Efectivo
// Fuente conceptual: ingresos/pagos del CRM operativo TopDJs.
// No se capturan ingresos manualmente en Finanzas.
// =======================================================

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ACCOUNT_KEYS = {
  bbva: ["bbva", "cuenta bbva", "cuenta topdjs principal actual"],
  nu: ["nu", "cuenta nu"],
  manuel: ["manuel", "cuenta manuel"],
  efectivo: ["efectivo", "cash", "caja topdjs"],
};

function money(value) {
  const number = Number(value || 0);
  return number.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setStatus(message, type = "") {
  const element = document.getElementById("statusBox");
  if (!element) return;

  element.className = `status-box ${type}`.trim();
  element.textContent = message;
}

function accountName(account) {
  return account.name || account.account_name || account.label || "";
}

function accountBalance(account) {
  return Number(
    account.current_balance ??
    account.balance ??
    account.amount ??
    0
  ) || 0;
}

function matchAccount(account, target) {
  const name = normalize(accountName(account));
  const type = normalize(account.type || account.account_type || "");

  return ACCOUNT_KEYS[target].some((keyword) => {
    const normalizedKeyword = normalize(keyword);
    return name === normalizedKeyword || name.includes(normalizedKeyword) || type === normalizedKeyword;
  });
}

function calculateBalancesFromAccounts(accounts) {
  const balances = {
    bbva: 0,
    nu: 0,
    manuel: 0,
    efectivo: 0,
  };

  for (const account of accounts || []) {
    const balance = accountBalance(account);

    if (matchAccount(account, "bbva")) balances.bbva += balance;
    else if (matchAccount(account, "nu")) balances.nu += balance;
    else if (matchAccount(account, "manuel")) balances.manuel += balance;
    else if (matchAccount(account, "efectivo")) balances.efectivo += balance;
  }

  return balances;
}

function renderBalances(balances) {
  const total =
    Number(balances.bbva || 0) +
    Number(balances.nu || 0) +
    Number(balances.manuel || 0) +
    Number(balances.efectivo || 0);

  setText("liquidezTotal", money(total));
  setText("saldoBbva", money(balances.bbva));
  setText("saldoNu", money(balances.nu));
  setText("saldoManuel", money(balances.manuel));
  setText("saldoEfectivo", money(balances.efectivo));
}

async function loadFinance() {
  setStatus("Cargando liquidez desde Supabase...");

  const { data, error } = await db
    .from("finance_accounts")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error cargando finance_accounts:", error);
    setStatus(`Error cargando finance_accounts: ${error.message}`, "error");
    renderBalances({ bbva: 0, nu: 0, manuel: 0, efectivo: 0 });
    return;
  }

  const balances = calculateBalancesFromAccounts(data || []);
  renderBalances(balances);

  setStatus(
    "Liquidez cargada. Finanzas v2.0 Paso 1 está leyendo las cuentas de TopDJs; los ingresos deben venir del CRM operativo.",
    "ok"
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", loadFinance);

  loadFinance();
});
