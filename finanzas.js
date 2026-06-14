// =======================================================
// TopDJs Finanzas CRM v2.0.5
// Liquidez + CRUD de gastos fijos
// No se capturan ingresos manualmente en Finanzas.
// =======================================================

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let fixedExpensesCache = [];
let editingExpenseId = null;

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstValue(object, keys, fallback = "") {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null && object[key] !== "") {
      return object[key];
    }
  }
  return fallback;
}

function numberValue(object, keys, fallback = 0) {
  const value = firstValue(object, keys, fallback);
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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
  return Number(account.current_balance ?? account.balance ?? account.amount ?? 0) || 0;
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

function expenseName(expense) {
  return firstValue(expense, ["expense_name", "name", "concept", "description", "label"], "-");
}

function expenseAmount(expense) {
  return numberValue(expense, ["amount", "monthly_amount", "payment_amount", "monto"], 0);
}

function expenseDay(expense) {
  return firstValue(expense, ["payment_day", "due_day", "day", "day_of_month", "cutoff_day"], "");
}

function expenseAccount(expense) {
  return firstValue(expense, ["account", "payment_account", "paid_from_account", "source_account", "bank"], "-");
}

function expenseCategory(expense) {
  return firstValue(expense, ["category", "type", "expense_type"], "Fijo");
}

function expenseNotes(expense) {
  return firstValue(expense, ["notes", "note", "status"], "");
}

function isActiveExpense(expense) {
  const active = firstValue(expense, ["is_active", "active"], true);
  return active === true || active === "true" || active === 1 || active === "1";
}

function getExpenseById(id) {
  return fixedExpensesCache.find((expense) => String(expense.id) === String(id));
}

function sortedActiveExpenses() {
  return fixedExpensesCache
    .filter(isActiveExpense)
    .sort((a, b) => {
      const dayA = Number(expenseDay(a) || 99);
      const dayB = Number(expenseDay(b) || 99);
      if (dayA !== dayB) return dayA - dayB;
      return String(expenseName(a)).localeCompare(String(expenseName(b)));
    });
}

function renderFixedExpenses() {
  const container = document.getElementById("fixedExpensesList");
  if (!container) return;

  const expenses = sortedActiveExpenses();
  const total = expenses.reduce((sum, expense) => sum + expenseAmount(expense), 0);
  setText("gastosFijosTotal", money(total));

  if (!expenses.length) {
    container.innerHTML = `<div class="empty-state">No hay gastos fijos registrados. Usa “Agregar gasto fijo”.</div>`;
    return;
  }

  container.innerHTML = expenses
    .map((expense) => {
      const day = expenseDay(expense);
      const dayLabel = day ? `Día ${String(day).padStart(2, "0")}` : "Pendiente";
      const notes = expenseNotes(expense);

      return `
        <article class="expense-row">
          <div class="expense-main">
            <strong>${escapeHtml(expenseName(expense))}</strong>
            <small>${escapeHtml(notes || "Sin notas")}</small>
          </div>

          <div class="expense-meta">
            <span>Cantidad</span>
            <strong class="amount">${money(expenseAmount(expense))}</strong>
          </div>

          <div class="expense-meta">
            <span>Fecha pago</span>
            <strong>${escapeHtml(dayLabel)}</strong>
          </div>

          <div class="expense-meta">
            <span>Cuenta</span>
            <strong>${escapeHtml(expenseAccount(expense))}</strong>
          </div>

          <div class="expense-meta">
            <span>Categoría</span>
            <strong>${escapeHtml(expenseCategory(expense))}</strong>
          </div>

          <div class="expense-actions">
            <button type="button" onclick="editExpense('${escapeHtml(expense.id)}')">Editar</button>
            <button type="button" class="danger" onclick="deleteExpense('${escapeHtml(expense.id)}')">Borrar</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function formTemplate(expense = null) {
  const isEdit = Boolean(expense);
  const id = isEdit ? expense.id : "";
  const name = isEdit ? expenseName(expense) : "";
  const amount = isEdit ? expenseAmount(expense) : "";
  const day = isEdit ? expenseDay(expense) : "";
  const account = isEdit ? expenseAccount(expense) : "BBVA";

  return `
    <form class="expense-form" id="expenseForm" data-id="${escapeHtml(id)}">
      <div class="form-field">
        <label>Gasto fijo</label>
        <input id="expenseName" type="text" value="${escapeHtml(name)}" placeholder="Ej. Hipotecario" required />
      </div>

      <div class="form-field">
        <label>Cantidad</label>
        <input id="expenseAmount" type="number" min="0" step="1" value="${escapeHtml(amount)}" placeholder="0" required />
      </div>

      <div class="form-field">
        <label>Fecha pago</label>
        <input id="expenseDay" type="number" min="1" max="31" step="1" value="${escapeHtml(day)}" placeholder="Día" required />
      </div>

      <div class="form-field">
        <label>Se paga desde</label>
        <select id="expenseAccount">
          <option value="BBVA" ${account === "BBVA" ? "selected" : ""}>BBVA</option>
          <option value="NU" ${account === "NU" ? "selected" : ""}>NU</option>
          <option value="Manuel" ${account === "Manuel" ? "selected" : ""}>Manuel</option>
          <option value="Efectivo" ${account === "Efectivo" ? "selected" : ""}>Efectivo</option>
          <option value="Flexible" ${account === "Flexible" ? "selected" : ""}>Flexible</option>
        </select>
      </div>

      <div class="form-actions">
        <button type="submit">${isEdit ? "Guardar cambios" : "Guardar"}</button>
        <button type="button" class="secondary" onclick="closeExpenseForm()">Cancelar</button>
      </div>
    </form>
  `;
}

function showExpenseForm(expense = null) {
  const host = document.getElementById("expenseFormHost");
  if (!host) return;

  editingExpenseId = expense ? expense.id : null;
  host.innerHTML = formTemplate(expense);
  host.classList.remove("hidden");

  const form = document.getElementById("expenseForm");
  if (form) form.addEventListener("submit", saveExpenseFromForm);

  const input = document.getElementById("expenseName");
  if (input) input.focus();
}

function closeExpenseForm() {
  const host = document.getElementById("expenseFormHost");
  if (!host) return;

  editingExpenseId = null;
  host.innerHTML = "";
  host.classList.add("hidden");
}

function getExpenseFormPayload() {
  const name = document.getElementById("expenseName")?.value?.trim();
  const amount = Number(document.getElementById("expenseAmount")?.value || 0);
  const day = Number(document.getElementById("expenseDay")?.value || 0);
  const account = document.getElementById("expenseAccount")?.value || "BBVA";

  if (!name) throw new Error("Escribe el nombre del gasto fijo.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("La cantidad debe ser mayor a cero.");
  if (!Number.isFinite(day) || day < 1 || day > 31) throw new Error("La fecha de pago debe ser un día entre 1 y 31.");

  return {
    name,
    amount,
    payment_day: day,
    payment_account: account,
    category: "Fijo",
    notes: "",
    is_active: true,
  };
}

async function saveExpenseFromForm(event) {
  event.preventDefault();

  try {
    const payload = getExpenseFormPayload();

    if (editingExpenseId) {
      const { error } = await db
        .from("finance_fixed_expenses")
        .update(payload)
        .eq("id", editingExpenseId);

      if (error) throw error;
      setStatus("Gasto fijo actualizado correctamente.", "ok");
    } else {
      const { error } = await db
        .from("finance_fixed_expenses")
        .insert(payload);

      if (error) throw error;
      setStatus("Gasto fijo guardado correctamente.", "ok");
    }

    closeExpenseForm();
    await loadFinance();
  } catch (error) {
    console.error("Error guardando gasto fijo:", error);
    setStatus(error.message || "Error guardando gasto fijo.", "error");
  }
}

function editExpense(id) {
  const expense = getExpenseById(id);
  if (!expense) {
    setStatus("No encontré ese gasto para editar.", "error");
    return;
  }

  showExpenseForm(expense);
}

async function deleteExpense(id) {
  const expense = getExpenseById(id);
  const name = expense ? expenseName(expense) : "este gasto";
  const confirmed = window.confirm(`¿Borrar ${name}?`);

  if (!confirmed) return;

  try {
    const { error } = await db
      .from("finance_fixed_expenses")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;

    setStatus("Gasto fijo borrado correctamente.", "ok");
    closeExpenseForm();
    await loadFinance();
  } catch (error) {
    console.error("Error borrando gasto fijo:", error);
    setStatus(error.message || "Error borrando gasto fijo.", "error");
  }
}

async function loadFinance() {
  setStatus("Cargando liquidez y gastos fijos desde Supabase...");

  const [accountsResult, expensesResult] = await Promise.all([
    db.from("finance_accounts").select("*"),
    db.from("finance_fixed_expenses").select("*"),
  ]);

  if (accountsResult.error) {
    console.error("Error cargando finance_accounts:", accountsResult.error);
    setStatus(`Error cargando finance_accounts: ${accountsResult.error.message}`, "error");
    renderBalances({ bbva: 0, nu: 0, manuel: 0, efectivo: 0 });
    return;
  }

  const balances = calculateBalancesFromAccounts(accountsResult.data || []);
  renderBalances(balances);

  if (expensesResult.error) {
    console.error("Error cargando finance_fixed_expenses:", expensesResult.error);
    setStatus(`Liquidez cargada, pero hubo error en gastos fijos: ${expensesResult.error.message}`, "error");
    fixedExpensesCache = [];
    renderFixedExpenses();
    return;
  }

  fixedExpensesCache = expensesResult.data || [];
  renderFixedExpenses();

  setStatus("Liquidez y gastos fijos cargados correctamente desde Supabase.", "ok");
}

document.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", loadFinance);

  const addExpenseBtn = document.getElementById("addExpenseBtn");
  if (addExpenseBtn) addExpenseBtn.addEventListener("click", () => showExpenseForm());

  loadFinance();
});
