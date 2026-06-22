// =======================================================
// TopDJs Finanzas CRM v2.2.1
// Panel limpio + pago manual + gasto manual + gastos fijos + tarjetas + sincronización CRM + tacómetros + asistente interno
// =======================================================

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let accountsCache = [];
let fixedExpensesCache = [];
let paymentsCache = [];
let creditCardsCache = [];
let syncedCrmPaymentsCache = [];
let manualPaymentsCache = [];
let manualExpensesCache = [];
let editingExpenseId = null;
let payingExpenseId = null;
let openedExpenseId = null;
let editingCardId = null;
let payingCardId = null;

const CRM_SYNC_START_DATE = "2026-06-15";

const ACCOUNT_KEYS = {
  bbva: ["bbva", "cuenta bbva", "cuenta topdjs principal actual"],
  nu: ["nu", "cuenta nu"],
  manuel: ["manuel", "cuenta manuel"],
  efectivo: ["efectivo", "cash", "caja topdjs"],
};

const ACCOUNT_LABELS = {
  bbva: "BBVA",
  nu: "NU",
  manuel: "Manuel",
  efectivo: "Efectivo",
};

const WEEKDAYS = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

const WEEKLY_SALARY_NAMES = ["george", "papa", "papá", "vane"];

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

function openManualPaymentWorkspace() {
  const workspace = document.getElementById("manualPaymentWorkspace");
  if (!workspace) return;

  const dateInput = document.getElementById("manualPaymentDate");
  const amountInput = document.getElementById("manualPaymentAmount");
  const conceptInput = document.getElementById("manualPaymentConcept");

  if (dateInput && !dateInput.value) dateInput.value = isoToday();
  if (amountInput) amountInput.value = "";
  if (conceptInput) conceptInput.value = "";

  workspace.classList.remove("hidden");
  document.body.classList.add("workspace-open");

  if (amountInput) amountInput.focus();
}

function closeManualPaymentWorkspace() {
  const workspace = document.getElementById("manualPaymentWorkspace");
  if (!workspace) return;

  workspace.classList.add("hidden");
  document.body.classList.remove("workspace-open");
}

function openManualExpenseWorkspace() {
  const workspace = document.getElementById("manualExpenseWorkspace");
  if (!workspace) return;

  const dateInput = document.getElementById("manualExpenseDate");
  const amountInput = document.getElementById("manualExpenseAmount");
  const conceptInput = document.getElementById("manualExpenseConcept");

  if (dateInput && !dateInput.value) dateInput.value = isoToday();
  if (amountInput) amountInput.value = "";
  if (conceptInput) conceptInput.value = "";

  workspace.classList.remove("hidden");
  document.body.classList.add("workspace-open");

  if (amountInput) amountInput.focus();
}

function closeManualExpenseWorkspace() {
  const workspace = document.getElementById("manualExpenseWorkspace");
  if (!workspace) return;

  workspace.classList.add("hidden");
  document.body.classList.remove("workspace-open");
}

function openExpensesWorkspace() {
  const workspace = document.getElementById("expensesWorkspace");
  if (!workspace) return;

  workspace.classList.remove("hidden");
  document.body.classList.add("workspace-open");
}

function closeExpensesWorkspace() {
  const workspace = document.getElementById("expensesWorkspace");
  if (!workspace) return;

  closeExpenseDetail();
  closeExpenseForm();
  closePaymentForm();
  workspace.classList.add("hidden");
  document.body.classList.remove("workspace-open");
}

function openCardsWorkspace() {
  const workspace = document.getElementById("cardsWorkspace");
  if (!workspace) return;

  workspace.classList.remove("hidden");
  document.body.classList.add("workspace-open");
}

function closeCardsWorkspace() {
  const workspace = document.getElementById("cardsWorkspace");
  if (!workspace) return;

  closeCardEditForm();
  closeCardPaymentForm();
  workspace.classList.add("hidden");
  document.body.classList.remove("workspace-open");
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

function findAccountByKey(accountKey) {
  return accountsCache.find((account) => matchAccount(account, accountKey));
}

function accountKeyFromLabel(label) {
  const normalized = normalize(label);
  if (normalized.includes("bbva")) return "bbva";
  if (normalized.includes("nu")) return "nu";
  if (normalized.includes("manuel")) return "manuel";
  if (normalized.includes("efectivo") || normalized.includes("cash")) return "efectivo";
  return "";
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
  return firstValue(expense, ["name", "expense_name", "concept", "description", "label"], "-");
}

function expenseAmount(expense) {
  return Number(firstValue(expense, ["amount", "monthly_amount", "payment_amount", "monto"], 0)) || 0;
}

function expenseRawDay(expense) {
  return Number(firstValue(expense, ["due_day", "payment_day", "day", "day_of_month", "cutoff_day"], 0)) || 0;
}

function isWeeklySalaryByName(expense) {
  const name = normalize(expenseName(expense));
  return WEEKLY_SALARY_NAMES.some((salaryName) => name.includes(normalize(salaryName)));
}

function expenseFrequency(expense) {
  const frequency = normalize(firstValue(expense, ["frequency", "payment_frequency"], ""));
  if (frequency === "weekly" || frequency === "semanal") return "weekly";
  if (frequency === "monthly" || frequency === "mensual") return "monthly";
  if (isWeeklySalaryByName(expense)) return "weekly";
  return "monthly";
}

function expenseDueDay(expense) {
  const frequency = expenseFrequency(expense);
  const day = expenseRawDay(expense);

  if (frequency === "weekly") {
    if (day >= 1 && day <= 7) return day;
    return 1;
  }

  if (day >= 1 && day <= 31) return day;
  return "";
}

function expenseAccount(expense) {
  return firstValue(expense, ["suggested_account", "payment_account", "paid_from_account", "source_account", "account", "bank"], "Flexible");
}

function expenseCategory(expense) {
  if (expenseFrequency(expense) === "weekly") return "Sueldo semanal";
  return firstValue(expense, ["category", "type", "expense_type"], "Fijo");
}

function isActiveExpense(expense) {
  const active = firstValue(expense, ["is_active", "active"], true);
  return active === true || active === "true" || active === 1 || active === "1";
}

function getExpenseById(id) {
  return fixedExpensesCache.find((expense) => String(expense.id) === String(id));
}

function getPaymentById(id) {
  return paymentsCache.find((payment) => String(payment.id) === String(id));
}

function dateToShortLabel(dateValue) {
  const date = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return String(dateValue || "-");
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function dateToYmd(date) {
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function jsDayToFinanceWeekday(jsDay) {
  return jsDay === 0 ? 7 : jsDay;
}

function countWeekdayInCurrentMonth(weekday) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  let count = 0;

  const cursor = new Date(year, month, 1);
  while (cursor.getMonth() === month) {
    if (jsDayToFinanceWeekday(cursor.getDay()) === Number(weekday)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function nextWeeklyDate(weekday) {
  const today = new Date();
  const target = Number(weekday) || 1;
  const todayFinanceDay = jsDayToFinanceWeekday(today.getDay());
  let daysToAdd = target - todayFinanceDay;
  if (daysToAdd < 0) daysToAdd += 7;

  const result = new Date(today);
  result.setDate(today.getDate() + daysToAdd);
  return result;
}

function nextMonthlyDate(dayOfMonth) {
  const today = new Date();
  const day = Number(dayOfMonth) || 1;
  const year = today.getFullYear();
  const month = today.getMonth();

  const lastDayThisMonth = new Date(year, month + 1, 0).getDate();
  let result = new Date(year, month, Math.min(day, lastDayThisMonth));

  if (result < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    const lastDayNextMonth = new Date(year, month + 2, 0).getDate();
    result = new Date(year, month + 1, Math.min(day, lastDayNextMonth));
  }

  return result;
}

function expenseMonthlyEstimate(expense) {
  const amount = expenseAmount(expense);
  const frequency = expenseFrequency(expense);

  if (frequency === "weekly") {
    const weekday = expenseDueDay(expense) || 1;
    return amount * countWeekdayInCurrentMonth(weekday);
  }

  return amount;
}

function expenseDateLabel(expense) {
  const frequency = expenseFrequency(expense);
  const day = expenseDueDay(expense);
  if (frequency === "weekly") return WEEKDAYS[day || 1] || "Lunes";
  return day ? `Día ${String(day).padStart(2, "0")}` : "Pendiente";
}

function expenseNextPaymentLabel(expense) {
  const frequency = expenseFrequency(expense);
  const day = expenseDueDay(expense);
  if (frequency === "weekly") return dateToYmd(nextWeeklyDate(day || 1));
  return dateToYmd(nextMonthlyDate(day || 1));
}

function suggestedPaymentAmount(expense) {
  return expenseAmount(expense);
}

function sortedActiveExpenses() {
  return fixedExpensesCache
    .filter(isActiveExpense)
    .sort((a, b) => {
      const freqA = expenseFrequency(a) === "weekly" ? 0 : 1;
      const freqB = expenseFrequency(b) === "weekly" ? 0 : 1;
      if (freqA !== freqB) return freqA - freqB;

      const dayA = Number(expenseDueDay(a) || 99);
      const dayB = Number(expenseDueDay(b) || 99);
      if (dayA !== dayB) return dayA - dayB;

      return String(expenseName(a)).localeCompare(String(expenseName(b)));
    });
}

function renderFixedExpenses() {
  const container = document.getElementById("fixedExpensesList");
  const expenses = sortedActiveExpenses();
  const total = expenses.reduce((sum, expense) => sum + expenseMonthlyEstimate(expense), 0);

  setText("gastosFijosTotal", money(total));
  setText("gastosFijosCount", String(expenses.length));

  if (expenses.length) {
    setText("gastosFijosNext", expenseNextPaymentLabel(expenses[0]));
  } else {
    setText("gastosFijosNext", "-");
  }

  if (!container) return;

  if (!expenses.length) {
    container.innerHTML = `<div class="empty-state">No hay gastos fijos registrados. Usa “Agregar gasto fijo”.</div>`;
    closeExpenseDetail();
    return;
  }

  container.innerHTML = expenses.map((expense) => {
    const frequency = expenseFrequency(expense);
    const nextLabel = expenseNextPaymentLabel(expense);
    const estimate = expenseMonthlyEstimate(expense);

    return `
      <article class="expense-compact-row">
        <div class="expense-main">
          <strong>${escapeHtml(expenseName(expense))}</strong>
          <small>${frequency === "weekly" ? "Semanal" : "Mensual"} · ${escapeHtml(expenseDateLabel(expense))}</small>
        </div>

        <div class="expense-meta">
          <span>Monto</span>
          <strong class="amount">${money(expenseAmount(expense))}</strong>
        </div>

        <div class="expense-meta">
          <span>Próximo</span>
          <strong>${escapeHtml(nextLabel)}</strong>
        </div>

        <div class="expense-meta">
          <span>Est. mes</span>
          <strong>${money(estimate)}</strong>
        </div>

        <div class="expense-actions direct">
          <button type="button" class="pay" onclick="showPaymentForm('${escapeHtml(expense.id)}')">Pagar</button>
          <button type="button" onclick="editExpense('${escapeHtml(expense.id)}')">Editar</button>
          <button type="button" class="danger" onclick="deleteExpense('${escapeHtml(expense.id)}')">Borrar</button>
        </div>
      </article>
    `;
  }).join("");

  if (openedExpenseId && !getExpenseById(openedExpenseId)) {
    closeExpenseDetail();
  }
}

function renderExpenseDetail(expense) {
  const host = document.getElementById("expenseDetailHost");
  if (!host) return;

  if (!expense) {
    host.innerHTML = "";
    host.classList.add("hidden");
    return;
  }

  const frequency = expenseFrequency(expense);
  const amountLabel = frequency === "weekly" ? "Monto semanal" : "Monto mensual";
  const nextLabel = expenseNextPaymentLabel(expense);
  const estimate = expenseMonthlyEstimate(expense);

  host.innerHTML = `
    <div class="detail-titlebar">
      <div class="detail-title">
        <h3>${escapeHtml(expenseName(expense))}</h3>
        <p>Ficha completa del gasto seleccionado.</p>
      </div>
      <button type="button" class="secondary" onclick="closeExpenseDetail()">Cerrar</button>
    </div>

    <div class="detail-grid">
      <div class="detail-card">
        <span>Tipo</span>
        <strong>${escapeHtml(expenseCategory(expense))}</strong>
      </div>
      <div class="detail-card">
        <span>${amountLabel}</span>
        <strong>${money(expenseAmount(expense))}</strong>
      </div>
      <div class="detail-card">
        <span>Pago</span>
        <strong>${escapeHtml(expenseDateLabel(expense))}</strong>
      </div>
      <div class="detail-card">
        <span>Próximo pago</span>
        <strong>${escapeHtml(nextLabel)}</strong>
      </div>
      <div class="detail-card">
        <span>Est. mes</span>
        <strong>${money(estimate)}</strong>
      </div>
      <div class="detail-card">
        <span>Cuenta sugerida</span>
        <strong>${escapeHtml(expenseAccount(expense))}</strong>
      </div>
      <div class="detail-card">
        <span>Frecuencia</span>
        <strong>${frequency === "weekly" ? "Semanal" : "Mensual"}</strong>
      </div>
      <div class="detail-card">
        <span>Estatus</span>
        <strong><span class="status-chip">Activo</span></strong>
      </div>
    </div>

    <div class="detail-actions">
      <button type="button" class="pay" onclick="showPaymentForm('${escapeHtml(expense.id)}')">Pagar</button>
      <button type="button" onclick="editExpense('${escapeHtml(expense.id)}')">Editar</button>
      <button type="button" class="danger" onclick="deleteExpense('${escapeHtml(expense.id)}')">Borrar</button>
    </div>
  `;

  host.classList.remove("hidden");
  host.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showExpenseDetail(id) {
  openExpensesWorkspace();
  closeExpenseForm();
  closePaymentForm();
  openedExpenseId = id;

  const expense = getExpenseById(id);
  renderExpenseDetail(expense);
}

function closeExpenseDetail() {
  openedExpenseId = null;
  renderExpenseDetail(null);
}

function renderPaymentHistory() {
  const container = document.getElementById("paymentsHistoryList");
  if (!container) return;

  const payments = [...(paymentsCache || [])].sort((a, b) => {
    const dateA = new Date(firstValue(a, ["created_at", "paid_at"], "1970-01-01")).getTime();
    const dateB = new Date(firstValue(b, ["created_at", "paid_at"], "1970-01-01")).getTime();
    return dateB - dateA;
  });

  if (!payments.length) {
    container.innerHTML = `<div class="empty-state">Aún no hay pagos registrados.</div>`;
    return;
  }

  container.innerHTML = payments.map((payment) => {
    const voided = Boolean(payment.voided);
    const expense = firstValue(payment, ["expense_name"], "Gasto fijo");
    const amount = Number(firstValue(payment, ["amount"], 0)) || 0;
    const account = firstValue(payment, ["paid_from_account"], "-");
    const paidAt = firstValue(payment, ["paid_at"], "");
    const createdAt = firstValue(payment, ["created_at"], "");
    const statusLabel = voided ? "Anulado" : "Activo";

    return `
      <article class="payment-row ${voided ? "voided" : ""}">
        <div class="payment-main">
          <strong>${escapeHtml(expense)}</strong>
          <small>${createdAt ? `Registrado ${escapeHtml(dateToShortLabel(String(createdAt).slice(0, 10)))}` : "Pago registrado"}</small>
        </div>

        <div class="payment-meta">
          <span>Cantidad</span>
          <strong class="amount">${money(amount)}</strong>
        </div>

        <div class="payment-meta">
          <span>Cuenta</span>
          <strong>${escapeHtml(account)}</strong>
        </div>

        <div class="payment-meta">
          <span>Fecha pago</span>
          <strong>${escapeHtml(dateToShortLabel(paidAt))}</strong>
        </div>

        <div class="payment-meta">
          <span>Estado</span>
          <strong><span class="status-pill ${voided ? "voided" : ""}">${statusLabel}</span></strong>
        </div>

        <div class="payment-actions">
          ${voided ? `<button type="button" class="secondary" disabled>Anulado</button>` : `<button type="button" class="danger" onclick="voidPayment('${escapeHtml(payment.id)}')">Anular</button>`}
        </div>
      </article>
    `;
  }).join("");
}

function dayOptions(selectedDay, frequency) {
  if (frequency === "weekly") {
    return Object.entries(WEEKDAYS)
      .map(([value, label]) => `<option value="${value}" ${Number(selectedDay) === Number(value) ? "selected" : ""}>${label}</option>`)
      .join("");
  }

  let options = "";
  for (let day = 1; day <= 31; day++) {
    options += `<option value="${day}" ${Number(selectedDay) === day ? "selected" : ""}>Día ${String(day).padStart(2, "0")}</option>`;
  }
  return options;
}

function formTemplate(expense = null) {
  const isEdit = Boolean(expense);
  const id = isEdit ? expense.id : "";
  const name = isEdit ? expenseName(expense) : "";
  const amount = isEdit ? expenseAmount(expense) : "";
  const frequency = isEdit ? expenseFrequency(expense) : "monthly";
  const day = isEdit ? expenseDueDay(expense) : 1;
  const account = isEdit ? expenseAccount(expense) : "BBVA";

  return `
    <form class="expense-form" id="expenseForm" data-id="${escapeHtml(id)}">
      <div class="form-field">
        <label>Gasto fijo</label>
        <input id="expenseName" type="text" value="${escapeHtml(name)}" placeholder="Ej. George" required />
      </div>

      <div class="form-field">
        <label>Cantidad</label>
        <input id="expenseAmount" type="number" min="0" step="1" value="${escapeHtml(amount)}" placeholder="0" required />
      </div>

      <div class="form-field">
        <label>Frecuencia</label>
        <select id="expenseFrequency">
          <option value="monthly" ${frequency === "monthly" ? "selected" : ""}>Mensual</option>
          <option value="weekly" ${frequency === "weekly" ? "selected" : ""}>Semanal</option>
        </select>
      </div>

      <div class="form-field">
        <label id="expenseDayLabel">${frequency === "weekly" ? "Día semanal" : "Fecha pago"}</label>
        <select id="expenseDay">
          ${dayOptions(day, frequency)}
        </select>
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

function refreshDaySelector() {
  const frequencySelect = document.getElementById("expenseFrequency");
  const daySelect = document.getElementById("expenseDay");
  const dayLabel = document.getElementById("expenseDayLabel");

  if (!frequencySelect || !daySelect || !dayLabel) return;

  const frequency = frequencySelect.value;
  const currentDay = Number(daySelect.value || 1);
  const nextDay = frequency === "weekly" ? Math.min(Math.max(currentDay, 1), 7) : Math.min(Math.max(currentDay, 1), 31);

  dayLabel.textContent = frequency === "weekly" ? "Día semanal" : "Fecha pago";
  daySelect.innerHTML = dayOptions(nextDay, frequency);
}

function showExpenseForm(expense = null) {
  openExpensesWorkspace();
  closePaymentForm();
  closeExpenseDetail();

  const host = document.getElementById("expenseFormHost");
  if (!host) return;

  editingExpenseId = expense ? expense.id : null;
  host.innerHTML = formTemplate(expense);
  host.classList.remove("hidden");

  const form = document.getElementById("expenseForm");
  if (form) form.addEventListener("submit", saveExpenseFromForm);

  const frequencySelect = document.getElementById("expenseFrequency");
  if (frequencySelect) frequencySelect.addEventListener("change", refreshDaySelector);

  const input = document.getElementById("expenseName");
  if (input) input.focus();

  host.scrollIntoView({ behavior: "smooth", block: "start" });
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
  const frequency = document.getElementById("expenseFrequency")?.value || "monthly";
  const day = Number(document.getElementById("expenseDay")?.value || 0);
  const account = document.getElementById("expenseAccount")?.value || "BBVA";

  if (!name) throw new Error("Escribe el nombre del gasto fijo.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("La cantidad debe ser mayor a cero.");

  if (frequency === "weekly") {
    if (!Number.isFinite(day) || day < 1 || day > 7) throw new Error("El día semanal debe ser válido.");
  } else {
    if (!Number.isFinite(day) || day < 1 || day > 31) throw new Error("La fecha de pago debe ser un día entre 1 y 31.");
  }

  return {
    name,
    amount,
    frequency,
    due_day: day,
    suggested_account: account,
    category: frequency === "weekly" ? "Sueldo semanal" : "Fijo",
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
    closeExpenseDetail();
    closeExpenseForm();
    closePaymentForm();
    await loadFinance();
  } catch (error) {
    console.error("Error borrando gasto fijo:", error);
    setStatus(error.message || "Error borrando gasto fijo.", "error");
  }
}

function paymentFormTemplate(expense) {
  const suggestedAccount = expenseAccount(expense);
  const normalizedSuggested = normalize(suggestedAccount);
  const isFlexible = normalizedSuggested === "flexible" || normalizedSuggested === "";
  const defaultAccountKey = isFlexible ? "bbva" : (accountKeyFromLabel(suggestedAccount) || "bbva");
  const amount = suggestedPaymentAmount(expense);

  return `
    <h3 class="payment-title">Pagar: ${escapeHtml(expenseName(expense))}</h3>
    <p class="payment-subtitle">Selecciona la cuenta y la cantidad. Al guardar, se restará del saldo superior.</p>

    <form class="payment-form" id="paymentForm" data-id="${escapeHtml(expense.id)}">
      <div class="form-field">
        <label>Cuenta de pago</label>
        <select id="paymentAccount">
          <option value="bbva" ${defaultAccountKey === "bbva" ? "selected" : ""}>BBVA</option>
          <option value="nu" ${defaultAccountKey === "nu" ? "selected" : ""}>NU</option>
          <option value="manuel" ${defaultAccountKey === "manuel" ? "selected" : ""}>Manuel</option>
          <option value="efectivo" ${defaultAccountKey === "efectivo" ? "selected" : ""}>Efectivo</option>
        </select>
      </div>

      <div class="form-field">
        <label>Cantidad pagada</label>
        <input id="paymentAmount" type="number" min="0" step="1" value="${escapeHtml(amount)}" required />
      </div>

      <div class="form-field">
        <label>Fecha</label>
        <input id="paymentDate" type="date" value="${isoToday()}" required />
      </div>

      <div class="form-actions">
        <button type="submit" class="pay">Guardar pago</button>
        <button type="button" class="secondary" onclick="closePaymentForm()">Cancelar</button>
      </div>
    </form>

    ${isFlexible ? `<div class="account-warning">Este gasto estaba como Flexible. Aquí debes elegir de qué cuenta salió el pago.</div>` : ""}
  `;
}

function showPaymentForm(id) {
  openExpensesWorkspace();
  closeExpenseForm();
  closeExpenseDetail();

  const expense = getExpenseById(id);
  if (!expense) {
    setStatus("No encontré ese gasto para pagar.", "error");
    return;
  }

  const host = document.getElementById("paymentFormHost");
  if (!host) return;

  payingExpenseId = id;
  host.innerHTML = paymentFormTemplate(expense);
  host.classList.remove("hidden");

  const form = document.getElementById("paymentForm");
  if (form) form.addEventListener("submit", savePaymentFromForm);

  const amountInput = document.getElementById("paymentAmount");
  if (amountInput) amountInput.focus();

  host.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closePaymentForm() {
  const host = document.getElementById("paymentFormHost");
  if (!host) return;

  payingExpenseId = null;
  host.innerHTML = "";
  host.classList.add("hidden");
}

function getPaymentFormPayload() {
  const accountKey = document.getElementById("paymentAccount")?.value || "";
  const amount = Number(document.getElementById("paymentAmount")?.value || 0);
  const paidAt = document.getElementById("paymentDate")?.value || isoToday();

  if (!accountKey || !ACCOUNT_LABELS[accountKey]) throw new Error("Selecciona una cuenta válida.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("La cantidad pagada debe ser mayor a cero.");
  if (!paidAt) throw new Error("Selecciona la fecha de pago.");

  return { accountKey, amount, paidAt };
}

async function insertPaymentLog({ expense, accountKey, amount, paidAt }) {
  const { data, error } = await db
    .from("finance_fixed_expense_payments")
    .insert({
      fixed_expense_id: String(expense.id),
      expense_name: expenseName(expense),
      amount,
      paid_from_account: ACCOUNT_LABELS[accountKey],
      paid_at: paidAt,
      voided: false,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function savePaymentFromForm(event) {
  event.preventDefault();

  try {
    const expense = getExpenseById(payingExpenseId);
    if (!expense) throw new Error("No encontré el gasto que quieres pagar.");

    const { accountKey, amount, paidAt } = getPaymentFormPayload();
    const account = findAccountByKey(accountKey);
    if (!account) throw new Error(`No encontré la cuenta ${ACCOUNT_LABELS[accountKey]} en finance_accounts.`);

    const currentBalance = accountBalance(account);
    const newBalance = currentBalance - amount;

    const confirmed = window.confirm(
      `Confirmar pago de ${money(amount)} de ${expenseName(expense)} desde ${ACCOUNT_LABELS[accountKey]}.\n\n` +
      `Saldo actual: ${money(currentBalance)}\n` +
      `Saldo después del pago: ${money(newBalance)}`
    );

    if (!confirmed) return;

    const { error: updateError } = await db
      .from("finance_accounts")
      .update({ current_balance: newBalance })
      .eq("id", account.id);

    if (updateError) throw updateError;

    await insertPaymentLog({ expense, accountKey, amount, paidAt });

    setStatus(`Pago guardado. ${ACCOUNT_LABELS[accountKey]} quedó en ${money(newBalance)}.`, "ok");
    closePaymentForm();
    await loadFinance();
  } catch (error) {
    console.error("Error guardando pago:", error);
    setStatus(error.message || "Error guardando pago.", "error");
  }
}

async function voidPayment(id) {
  const payment = getPaymentById(id);
  if (!payment) {
    setStatus("No encontré ese pago para anular.", "error");
    return;
  }

  if (payment.voided) {
    setStatus("Ese pago ya estaba anulado.", "error");
    return;
  }

  const amount = Number(payment.amount || 0);
  const accountKey = accountKeyFromLabel(payment.paid_from_account);
  const account = findAccountByKey(accountKey);

  if (!accountKey || !account) {
    setStatus("No encontré la cuenta original del pago para regresar el dinero.", "error");
    return;
  }

  const currentBalance = accountBalance(account);
  const newBalance = currentBalance + amount;

  const confirmed = window.confirm(
    `¿Anular este pago?\n\n` +
    `${payment.expense_name}: ${money(amount)}\n` +
    `Cuenta original: ${ACCOUNT_LABELS[accountKey]}\n\n` +
    `Se regresarán ${money(amount)} a ${ACCOUNT_LABELS[accountKey]}.\n` +
    `Saldo actual: ${money(currentBalance)}\n` +
    `Saldo después de anular: ${money(newBalance)}`
  );

  if (!confirmed) return;

  try {
    const { error: accountError } = await db
      .from("finance_accounts")
      .update({ current_balance: newBalance })
      .eq("id", account.id);

    if (accountError) throw accountError;

    const { error: paymentError } = await db
      .from("finance_fixed_expense_payments")
      .update({
        voided: true,
        voided_at: new Date().toISOString(),
        void_reason: "Anulado desde TopDJs Finanzas CRM",
      })
      .eq("id", id);

    if (paymentError) throw paymentError;

    setStatus(`Pago anulado. ${ACCOUNT_LABELS[accountKey]} regresó a ${money(newBalance)}.`, "ok");
    await loadFinance();
  } catch (error) {
    console.error("Error anulando pago:", error);
    setStatus(error.message || "Error anulando pago.", "error");
  }
}



function cardName(card) {
  return firstValue(card, ["card_name", "name", "label"], "Tarjeta");
}

function cardBank(card) {
  return firstValue(card, ["bank", "issuer"], "-");
}

function cardBalance(card) {
  return Number(firstValue(card, ["balance", "current_balance", "debt"], 0)) || 0;
}

function cardLimit(card) {
  return Number(firstValue(card, ["credit_limit", "limit_amount", "limit"], 0)) || 0;
}

function cardMinimum(card) {
  return Number(firstValue(card, ["minimum_payment", "min_payment"], 0)) || 0;
}

function cardNoInterest(card) {
  return Number(firstValue(card, ["no_interest_payment", "payment_no_interest", "payment_to_avoid_interest"], 0)) || 0;
}

function cardCutoffDay(card) {
  return Number(firstValue(card, ["cutoff_day", "statement_day"], 0)) || 0;
}

function cardDueDay(card) {
  return Number(firstValue(card, ["payment_due_day", "due_day"], 0)) || 0;
}

function cardDueNextMonth(card) {
  const value = firstValue(card, ["payment_due_next_month", "due_next_month"], false);
  return value === true || value === "true" || value === 1 || value === "1";
}

function cardPaidFrom(card) {
  return firstValue(card, ["paid_from_account", "suggested_account", "payment_account"], "Flexible");
}

function getCardById(id) {
  return creditCardsCache.find((card) => String(card.id) === String(id));
}

function closeCardEditForm() {
  const host = document.getElementById("cardFormHost");
  if (!host) return;

  editingCardId = null;
  host.innerHTML = "";
  host.classList.add("hidden");
}

function cardEditTemplate(card) {
  return `
    <h3 class="card-edit-title">Editar: ${escapeHtml(cardName(card))}</h3>
    <p class="card-edit-subtitle">
      Solo se permite modificar el mínimo a pagar y el pago para no generar intereses.
    </p>

    <form class="card-edit-form" id="cardEditForm" data-id="${escapeHtml(card.id)}">
      <div class="form-field">
        <label>Mínimo a pagar</label>
        <input id="cardMinimumPayment" type="number" min="0" step="1" value="${escapeHtml(cardMinimum(card))}" required />
      </div>

      <div class="form-field">
        <label>Pago para no generar intereses</label>
        <input id="cardNoInterestPayment" type="number" min="0" step="1" value="${escapeHtml(cardNoInterest(card))}" required />
      </div>

      <div class="card-edit-actions">
        <button type="submit">Guardar</button>
        <button type="button" class="secondary" onclick="closeCardEditForm()">Cancelar</button>
      </div>
    </form>

    <div class="card-edit-warning">
      No se modifica el saldo, límite, corte ni fecha de pago. Esos datos quedan fijos.
    </div>
  `;
}

function showCardEditForm(id) {
  openCardsWorkspace();

  const card = getCardById(id);
  if (!card) {
    setStatus("No encontré esa tarjeta para editar.", "error");
    return;
  }

  const host = document.getElementById("cardFormHost");
  if (!host) return;

  editingCardId = id;
  host.innerHTML = cardEditTemplate(card);
  host.classList.remove("hidden");

  const form = document.getElementById("cardEditForm");
  if (form) form.addEventListener("submit", saveCardEditFromForm);

  const input = document.getElementById("cardMinimumPayment");
  if (input) input.focus();

  host.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getCardEditPayload() {
  const minimumPayment = Number(document.getElementById("cardMinimumPayment")?.value || 0);
  const noInterestPayment = Number(document.getElementById("cardNoInterestPayment")?.value || 0);

  if (!Number.isFinite(minimumPayment) || minimumPayment < 0) {
    throw new Error("El mínimo a pagar debe ser una cantidad válida.");
  }

  if (!Number.isFinite(noInterestPayment) || noInterestPayment < 0) {
    throw new Error("El pago para no generar intereses debe ser una cantidad válida.");
  }

  return {
    minimum_payment: minimumPayment,
    no_interest_payment: noInterestPayment,
  };
}

async function saveCardEditFromForm(event) {
  event.preventDefault();

  try {
    if (!editingCardId) throw new Error("No hay tarjeta seleccionada.");

    const payload = getCardEditPayload();

    const { error } = await db
      .from("finance_credit_cards")
      .update(payload)
      .eq("id", editingCardId);

    if (error) throw error;

    setStatus("Tarjeta actualizada correctamente.", "ok");
    closeCardEditForm();
    await loadFinance();
  } catch (error) {
    console.error("Error actualizando tarjeta:", error);
    setStatus(error.message || "Error actualizando tarjeta.", "error");
  }
}

function closeCardPaymentForm() {
  const host = document.getElementById("cardPaymentFormHost");
  if (!host) return;

  payingCardId = null;
  host.innerHTML = "";
  host.classList.add("hidden");
}

function cardPaymentTemplate(card) {
  const suggestedAccount = cardPaidFrom(card);
  const normalizedSuggested = normalize(suggestedAccount);
  const isFlexible = normalizedSuggested === "flexible" || normalizedSuggested === "";
  const defaultAccountKey = isFlexible ? "bbva" : (accountKeyFromLabel(suggestedAccount) || "bbva");
  const defaultAmount = cardNoInterest(card) || cardMinimum(card) || 0;

  return `
    <h3 class="card-payment-title">Pagar tarjeta: ${escapeHtml(cardName(card))}</h3>
    <p class="card-payment-subtitle">
      Registra la cantidad, fecha y cuenta desde donde se pagó. Al guardar, baja el saldo de la tarjeta y baja el saldo de la cuenta.
    </p>

    <form class="card-payment-form" id="cardPaymentForm" data-id="${escapeHtml(card.id)}">
      <div class="form-field">
        <label>Cuenta de pago</label>
        <select id="cardPaymentAccount">
          <option value="bbva" ${defaultAccountKey === "bbva" ? "selected" : ""}>BBVA</option>
          <option value="nu" ${defaultAccountKey === "nu" ? "selected" : ""}>NU</option>
          <option value="manuel" ${defaultAccountKey === "manuel" ? "selected" : ""}>Manuel</option>
          <option value="efectivo" ${defaultAccountKey === "efectivo" ? "selected" : ""}>Efectivo</option>
        </select>
      </div>

      <div class="form-field">
        <label>Cantidad pagada</label>
        <input id="cardPaymentAmount" type="number" min="0" step="1" value="${escapeHtml(defaultAmount)}" required />
      </div>

      <div class="form-field">
        <label>Fecha</label>
        <input id="cardPaymentDate" type="date" value="${isoToday()}" required />
      </div>

      <div class="card-payment-actions">
        <button type="submit" class="pay">Guardar pago</button>
        <button type="button" class="secondary" onclick="closeCardPaymentForm()">Cancelar</button>
      </div>
    </form>

    <div class="card-payment-warning">
      Este pago resta dinero de la cuenta seleccionada y reduce el saldo pendiente de la tarjeta.
    </div>
  `;
}

function showCardPaymentForm(id) {
  openCardsWorkspace();
  closeCardEditForm();

  const card = getCardById(id);
  if (!card) {
    setStatus("No encontré esa tarjeta para pagar.", "error");
    return;
  }

  const host = document.getElementById("cardPaymentFormHost");
  if (!host) return;

  payingCardId = id;
  host.innerHTML = cardPaymentTemplate(card);
  host.classList.remove("hidden");

  const form = document.getElementById("cardPaymentForm");
  if (form) form.addEventListener("submit", saveCardPaymentFromForm);

  const input = document.getElementById("cardPaymentAmount");
  if (input) input.focus();

  host.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getCardPaymentFormPayload() {
  const accountKey = document.getElementById("cardPaymentAccount")?.value || "";
  const amount = Number(document.getElementById("cardPaymentAmount")?.value || 0);
  const paidAt = document.getElementById("cardPaymentDate")?.value || isoToday();

  if (!accountKey || !ACCOUNT_LABELS[accountKey]) throw new Error("Selecciona una cuenta válida.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("La cantidad pagada debe ser mayor a cero.");
  if (!paidAt) throw new Error("Selecciona la fecha de pago.");

  return { accountKey, amount, paidAt };
}

async function insertCardPaymentLog({ card, accountKey, amount, paidAt }) {
  const { data, error } = await db
    .from("finance_credit_card_payments")
    .insert({
      credit_card_id: String(card.id),
      card_name: cardName(card),
      amount,
      paid_from_account: ACCOUNT_LABELS[accountKey],
      paid_at: paidAt,
      voided: false,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function saveCardPaymentFromForm(event) {
  event.preventDefault();

  try {
    const card = getCardById(payingCardId);
    if (!card) throw new Error("No encontré la tarjeta que quieres pagar.");

    const { accountKey, amount, paidAt } = getCardPaymentFormPayload();

    const account = findAccountByKey(accountKey);
    if (!account) throw new Error(`No encontré la cuenta ${ACCOUNT_LABELS[accountKey]} en finance_accounts.`);

    const currentAccountBalance = accountBalance(account);
    const newAccountBalance = currentAccountBalance - amount;

    const currentCardBalance = cardBalance(card);
    const newCardBalance = Math.max(0, currentCardBalance - amount);

    const confirmed = window.confirm(
      `Confirmar pago de ${money(amount)} a ${cardName(card)} desde ${ACCOUNT_LABELS[accountKey]}.\n\n` +
      `Cuenta ${ACCOUNT_LABELS[accountKey]}:\n` +
      `${money(currentAccountBalance)} → ${money(newAccountBalance)}\n\n` +
      `Saldo tarjeta:\n` +
      `${money(currentCardBalance)} → ${money(newCardBalance)}`
    );

    if (!confirmed) return;

    await insertCardPaymentLog({ card, accountKey, amount, paidAt });

    const { error: accountError } = await db
      .from("finance_accounts")
      .update({ current_balance: newAccountBalance })
      .eq("id", account.id);

    if (accountError) throw accountError;

    const { error: cardError } = await db
      .from("finance_credit_cards")
      .update({ balance: newCardBalance })
      .eq("id", card.id);

    if (cardError) throw cardError;

    setStatus(`Pago de tarjeta guardado. ${cardName(card)} quedó en ${money(newCardBalance)}.`, "ok");
    closeCardPaymentForm();
    await loadFinance();
  } catch (error) {
    console.error("Error guardando pago de tarjeta:", error);
    setStatus(error.message || "Error guardando pago de tarjeta.", "error");
  }
}



function cardAvailable(card) {
  return cardLimit(card) - cardBalance(card);
}

function cardUsagePercent(card) {
  const limit = cardLimit(card);
  if (!limit) return 0;
  return Math.max(0, Math.min(999, (cardBalance(card) / limit) * 100));
}

function cardRiskClass(percent) {
  if (percent >= 80) return "high";
  if (percent >= 55) return "medium";
  return "";
}

function cardRiskLabel(percent) {
  if (percent >= 80) return "Alta";
  if (percent >= 55) return "Media";
  return "Control";
}

function nextDateByDay(day, forceNextMonth = false) {
  const today = new Date();
  const wantedDay = Number(day) || 1;
  const year = today.getFullYear();
  const month = today.getMonth();
  const targetMonth = forceNextMonth ? month + 1 : month;
  const lastDay = new Date(year, targetMonth + 1, 0).getDate();
  let result = new Date(year, targetMonth, Math.min(wantedDay, lastDay));

  if (!forceNextMonth && result < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    const nextLastDay = new Date(year, month + 2, 0).getDate();
    result = new Date(year, month + 1, Math.min(wantedDay, nextLastDay));
  }
  return result;
}

function cardDueDateLabel(card) {
  const day = cardDueDay(card);
  if (!day) return "-";
  return dateToYmd(nextDateByDay(day, cardDueNextMonth(card)));
}

function cardCutoffLabel(card) {
  const day = cardCutoffDay(card);
  if (!day) return "-";
  return `Día ${String(day).padStart(2, "0")}`;
}

function sortedCreditCards() {
  return [...(creditCardsCache || [])].sort((a, b) => {
    const usageB = cardUsagePercent(b);
    const usageA = cardUsagePercent(a);
    if (usageB !== usageA) return usageB - usageA;
    return String(cardName(a)).localeCompare(String(cardName(b)));
  });
}

function renderCreditCards() {
  const cards = sortedCreditCards();
  const container = document.getElementById("creditCardsList");

  const totalDebt = cards.reduce((sum, card) => sum + cardBalance(card), 0);
  const totalLimit = cards.reduce((sum, card) => sum + cardLimit(card), 0);
  const totalAvailable = cards.reduce((sum, card) => sum + cardAvailable(card), 0);
  const totalMinimums = cards.reduce((sum, card) => sum + cardMinimum(card), 0);
  const totalNoInterest = cards.reduce((sum, card) => sum + cardNoInterest(card), 0);

  setText("tarjetasDeudaTotal", money(totalDebt));
  setText("tarjetasDisponibleTotal", money(totalAvailable));
  setText("cardsWindowDebt", money(totalDebt));
  setText("cardsWindowLimit", money(totalLimit));
  setText("cardsWindowAvailable", money(totalAvailable));
  setText("cardsWindowMinimums", money(totalMinimums));
  setText("cardsWindowNoInterest", money(totalNoInterest));

  if (cards.length) {
    const nextDue = [...cards].sort((a, b) => {
      const dateA = nextDateByDay(cardDueDay(a), cardDueNextMonth(a)).getTime();
      const dateB = nextDateByDay(cardDueDay(b), cardDueNextMonth(b)).getTime();
      return dateA - dateB;
    })[0];

    setText("tarjetasProximoPago", cardDueDateLabel(nextDue));
    setText("tarjetasProximoTarjeta", cardName(nextDue));
    setText("tarjetasProximoMinimo", money(cardMinimum(nextDue)));
    setText("tarjetasProximoNoIntereses", money(cardNoInterest(nextDue)));
  } else {
    setText("tarjetasProximoPago", "-");
    setText("tarjetasProximoTarjeta", "-");
    setText("tarjetasProximoMinimo", "$0");
    setText("tarjetasProximoNoIntereses", "$0");
  }

  if (!container) return;

  if (!cards.length) {
    container.innerHTML = `<div class="empty-state">No hay tarjetas registradas.</div>`;
    return;
  }

  container.innerHTML = cards.map((card) => {
    const usage = cardUsagePercent(card);
    const riskClass = cardRiskClass(usage);
    const riskLabel = cardRiskLabel(usage);
    const available = cardAvailable(card);
    const progressWidth = Math.max(0, Math.min(100, usage));

    return `
      <article class="credit-card-row">
        <div class="credit-card-header">
          <div class="credit-card-title">
            <strong>${escapeHtml(cardName(card))}</strong>
            <small>${escapeHtml(cardBank(card))} · Se paga desde ${escapeHtml(cardPaidFrom(card))}</small>
          </div>

          <div class="credit-card-actions">
            <div class="card-risk ${riskClass}">${riskLabel} · ${usage.toFixed(0)}%</div>
            <button type="button" class="pay" onclick="showCardPaymentForm('${escapeHtml(card.id)}')">Pagar</button>
            <button type="button" onclick="showCardEditForm('${escapeHtml(card.id)}')">Editar</button>
          </div>
        </div>

        <div class="card-metrics-grid">
          <div class="card-metric"><span>Saldo</span><strong>${money(cardBalance(card))}</strong></div>
          <div class="card-metric"><span>Límite</span><strong>${money(cardLimit(card))}</strong></div>
          <div class="card-metric"><span>Disponible</span><strong>${money(available)}</strong></div>
          <div class="card-metric"><span>Mínimo</span><strong>${money(cardMinimum(card))}</strong></div>
          <div class="card-metric"><span>No intereses</span><strong>${money(cardNoInterest(card))}</strong></div>
          <div class="card-metric"><span>Pago</span><strong>${escapeHtml(cardDueDateLabel(card))}</strong></div>
        </div>

        <div class="card-note">
          Corte: ${escapeHtml(cardCutoffLabel(card))}. Uso de línea: ${usage.toFixed(1)}%.
          <div class="card-progress"><div style="width: ${progressWidth}%"></div></div>
        </div>
      </article>
    `;
  }).join("");
}


function currentMonthIncomeTotal() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const allIncomeRows = [
    ...(syncedCrmPaymentsCache || []).map((row) => ({
      amount: firstValue(row, ["amount"], 0),
      date: firstValue(row, ["payment_date", "created_at", "synced_at"], ""),
    })),
    ...(manualPaymentsCache || []).map((row) => ({
      amount: firstValue(row, ["amount"], 0),
      date: firstValue(row, ["paid_at", "created_at"], ""),
    })),
  ];

  return allIncomeRows.reduce((sum, row) => {
    const iso = toIsoDate(row.date);
    if (!iso) return sum;

    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return sum;
    if (date.getFullYear() !== currentYear || date.getMonth() !== currentMonth) return sum;

    return sum + (Number(row.amount) || 0);
  }, 0);
}

function gaugeColorByPercent(percent, inverse = false) {
  const value = Number(percent || 0);

  if (inverse) {
    if (value >= 80) return "rgba(239, 68, 68, 0.96)";
    if (value >= 55) return "rgba(250, 204, 21, 0.96)";
    return "rgba(34, 197, 94, 0.96)";
  }

  if (value >= 80) return "rgba(34, 197, 94, 0.96)";
  if (value >= 55) return "rgba(250, 204, 21, 0.96)";
  return "rgba(239, 68, 68, 0.96)";
}

function renderGauge(elementId, percent, valueId, labelId, detailId, label, detail, inverse = false) {
  const gauge = document.getElementById(elementId);
  const valueEl = document.getElementById(valueId);
  const labelEl = document.getElementById(labelId);
  const detailEl = document.getElementById(detailId);

  const safePercent = Math.max(0, Math.min(100, Number(percent || 0)));
  const color = gaugeColorByPercent(safePercent, inverse);

  if (gauge) {
    gauge.style.setProperty("--percent", String(safePercent));
    gauge.style.setProperty("--gauge-color", color);
  }

  if (valueEl) valueEl.textContent = `${Math.round(safePercent)}%`;
  if (labelEl) labelEl.textContent = label;
  if (detailEl) detailEl.textContent = detail;
}


function totalLiquidity() {
  const balances = calculateBalancesFromAccounts(accountsCache || []);
  return (
    Number(balances.bbva || 0) +
    Number(balances.nu || 0) +
    Number(balances.manuel || 0) +
    Number(balances.efectivo || 0)
  );
}

function totalCreditCardDebt() {
  return (creditCardsCache || []).reduce((sum, card) => sum + cardBalance(card), 0);
}


function currentMonthManualExpensesTotal() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  return (manualExpensesCache || []).reduce((sum, row) => {
    const iso = toIsoDate(firstValue(row, ["spent_at", "created_at"], ""));
    if (!iso) return sum;

    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return sum;
    if (date.getFullYear() !== currentYear || date.getMonth() !== currentMonth) return sum;

    return sum + (Number(firstValue(row, ["amount"], 0)) || 0);
  }, 0);
}

function totalFixedMonthlyExpenses() {
  return sortedActiveExpenses().reduce((sum, expense) => sum + expenseMonthlyEstimate(expense), 0);
}

function totalNoInterestPayments() {
  return (creditCardsCache || []).reduce((sum, card) => sum + cardNoInterest(card), 0);
}

function totalMinimumPayments() {
  return (creditCardsCache || []).reduce((sum, card) => sum + cardMinimum(card), 0);
}

function highestUsageCard() {
  const cards = sortedCreditCards();
  if (!cards.length) return null;

  return [...cards].sort((a, b) => cardUsagePercent(b) - cardUsagePercent(a))[0];
}

function nextFixedExpense() {
  const expenses = sortedActiveExpenses();
  return expenses.length ? expenses[0] : null;
}

function createStrategy(type, icon, title, message) {
  return { type, icon, title, message };
}

function buildInternalStrategies() {
  const strategies = [];

  const liquidity = totalLiquidity();
  const fixedMonthly = totalFixedMonthlyExpenses() + currentMonthManualExpensesTotal();
  const cardDebt = totalCreditCardDebt();
  const monthlyIncome = currentMonthIncomeTotal();
  const noInterestTotal = totalNoInterestPayments();
  const minimumTotal = totalMinimumPayments();
  const topCard = highestUsageCard();
  const nextExpense = nextFixedExpense();

  const liquidityAfterFixed = liquidity - fixedMonthly;
  const incomeCoverage = fixedMonthly > 0 ? (monthlyIncome / fixedMonthly) * 100 : 0;
  const debtPressure = cardDebt > 0 ? (cardDebt / Math.max(cardDebt + liquidity, 1)) * 100 : 0;

  if (liquidity <= 0) {
    strategies.push(createStrategy(
      "danger",
      "🚨",
      "Sin liquidez disponible",
      "Antes de pagar tarjetas o gastos no urgentes, sincroniza nuevos pagos del CRM operativo o ingresa liquidez real a una cuenta."
    ));
  } else if (liquidityAfterFixed < 0) {
    strategies.push(createStrategy(
      "danger",
      "⚠️",
      "Liquidez insuficiente para cubrir gastos fijos",
      `Tu liquidez actual es ${money(liquidity)} y tus gastos fijos estimados del mes son ${money(fixedMonthly)}. Falta aproximadamente ${money(Math.abs(liquidityAfterFixed))}. Prioriza ingresos y pagos mínimos.`
    ));
  } else {
    strategies.push(createStrategy(
      "success",
      "✅",
      "Liquidez suficiente para gastos fijos estimados",
      `Con ${money(liquidity)} de liquidez y ${money(fixedMonthly)} de gastos fijos estimados, quedarían aproximadamente ${money(liquidityAfterFixed)} después de cubrirlos.`
    ));
  }

  if (topCard) {
    const usage = cardUsagePercent(topCard);
    if (usage >= 80) {
      strategies.push(createStrategy(
        "danger",
        "💳",
        "Prioridad alta en tarjeta con mayor uso",
        `${cardName(topCard)} está usando ${usage.toFixed(0)}% de su línea. Conviene bajarla antes de hacer pagos extra a tarjetas con menor presión.`
      ));
    } else if (usage >= 55) {
      strategies.push(createStrategy(
        "warning",
        "💳",
        "Vigilar uso de línea",
        `${cardName(topCard)} está en ${usage.toFixed(0)}% de uso. No es crítico, pero conviene no cargar más deuda ahí.`
      ));
    } else {
      strategies.push(createStrategy(
        "success",
        "💳",
        "Uso de tarjetas en zona controlada",
        `La tarjeta con mayor uso es ${cardName(topCard)} con ${usage.toFixed(0)}%. Mantén pagos mínimos y evita nuevas compras grandes.`
      ));
    }
  }

  if (noInterestTotal > liquidity && noInterestTotal > 0) {
    strategies.push(createStrategy(
      "warning",
      "🧾",
      "No alcanza para cubrir todos los pagos para no generar intereses",
      `El total para no generar intereses es ${money(noInterestTotal)} y tu liquidez actual es ${money(liquidity)}. Prioriza pagos mínimos y la tarjeta con mayor presión.`
    ));
  } else if (noInterestTotal > 0) {
    strategies.push(createStrategy(
      "info",
      "🧾",
      "Pagos para no generar intereses cubribles",
      `El total para no generar intereses es ${money(noInterestTotal)}. Si decides cubrirlo, todavía debes reservar gastos fijos y sueldos.`
    ));
  }

  if (minimumTotal > 0) {
    strategies.push(createStrategy(
      "info",
      "📌",
      "Piso mínimo de seguridad",
      `Tu mínimo total de tarjetas es ${money(minimumTotal)}. Si la liquidez se aprieta, este es el primer monto que no conviene dejar vencer.`
    ));
  }

  if (incomeCoverage < 55 && fixedMonthly > 0) {
    strategies.push(createStrategy(
      "warning",
      "📉",
      "Ingresos del mes aún bajos contra gastos",
      `Este mes llevas ${money(monthlyIncome)} sincronizados contra ${money(fixedMonthly)} de gastos fijos estimados. Aún no está cubierto el mes.`
    ));
  } else if (incomeCoverage >= 100) {
    strategies.push(createStrategy(
      "success",
      "📈",
      "Ingresos del mes cubren gastos fijos",
      `Los ingresos sincronizados del mes son ${money(monthlyIncome)}, suficientes contra ${money(fixedMonthly)} de gastos fijos estimados.`
    ));
  }

  if (debtPressure >= 80) {
    strategies.push(createStrategy(
      "danger",
      "🔥",
      "Presión de deuda alta",
      `La deuda de tarjetas es ${money(cardDebt)} contra una liquidez de ${money(liquidity)}. Evita nuevos cargos y enfoca pagos a reducir saldo.`
    ));
  } else if (debtPressure >= 55) {
    strategies.push(createStrategy(
      "warning",
      "⚖️",
      "Presión de deuda media",
      `La deuda aún pesa contra la liquidez. Conviene separar dinero para operación antes de hacer pagos extra.`
    ));
  }

  if (nextExpense) {
    strategies.push(createStrategy(
      "info",
      "🗓️",
      "Siguiente compromiso operativo",
      `El próximo gasto fijo detectado es ${expenseName(nextExpense)} por ${money(expenseAmount(nextExpense))}, con fecha ${expenseNextPaymentLabel(nextExpense)}.`
    ));
  }

  if (!strategies.length) {
    strategies.push(createStrategy(
      "info",
      "🤖",
      "Sin alertas críticas",
      "El asistente interno no detectó focos rojos con la información actual. Sigue sincronizando ingresos y registrando pagos para mejorar las recomendaciones."
    ));
  }

  return strategies;
}

function renderInternalStrategies() {
  const container = document.getElementById("aiStrategyList");
  if (!container) return;

  const strategies = buildInternalStrategies();

  container.innerHTML = strategies.map((item) => `
    <article class="ai-strategy-card ${escapeHtml(item.type)}">
      <div class="ai-strategy-icon">${escapeHtml(item.icon)}</div>
      <div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.message)}</p>
      </div>
    </article>
  `).join("");

  setStatus("Análisis interno generado con los datos actuales.", "ok");
}

function renderFinancialGauges() {
  const balances = calculateBalancesFromAccounts(accountsCache || []);
  const liquidityTotal =
    Number(balances.bbva || 0) +
    Number(balances.nu || 0) +
    Number(balances.manuel || 0) +
    Number(balances.efectivo || 0);

  const totalDebt = (creditCardsCache || []).reduce((sum, card) => sum + cardBalance(card), 0);
  const fixedMonthlyTotal = sortedActiveExpenses().reduce((sum, expense) => sum + expenseMonthlyEstimate(expense), 0) + currentMonthManualExpensesTotal();
  const currentIncome = currentMonthIncomeTotal();

  // Deudas: mientras más bajo, mejor. Se mide la presión de deuda contra la liquidez.
  const debtPressure = totalDebt > 0 ? (totalDebt / Math.max(totalDebt + liquidityTotal, 1)) * 100 : 0;
  let debtLabel = "Control";
  if (debtPressure >= 80) debtLabel = "Alta presión";
  else if (debtPressure >= 55) debtLabel = "Presión media";

  renderGauge(
    "debtGauge",
    debtPressure,
    "debtGaugeValue",
    "debtGaugeLabel",
    "debtGaugeDetail",
    debtLabel,
    `Deuda ${money(totalDebt)} vs liquidez ${money(liquidityTotal)}`,
    true
  );

  // Ingresos: mientras más alto, mejor. La meta es cubrir 100% del gasto fijo estimado del mes.
  const incomeCoverage = fixedMonthlyTotal > 0 ? Math.min(100, (currentIncome / fixedMonthlyTotal) * 100) : 0;
  let incomeLabel = "Bajo";
  if (incomeCoverage >= 100) incomeLabel = "Cubierto";
  else if (incomeCoverage >= 55) incomeLabel = "En progreso";

  renderGauge(
    "incomeGauge",
    incomeCoverage,
    "incomeGaugeValue",
    "incomeGaugeLabel",
    "incomeGaugeDetail",
    incomeLabel,
    `Ingresos del mes ${money(currentIncome)} vs gastos fijos ${money(fixedMonthlyTotal)}`
  );

  // Estado financiero general
  const liquidityCoverage = fixedMonthlyTotal > 0 ? Math.min(100, (liquidityTotal / fixedMonthlyTotal) * 100) : 100;
  const debtHealth = 100 - Math.max(0, Math.min(100, debtPressure));
  const healthScore = (liquidityCoverage * 0.4) + (incomeCoverage * 0.3) + (debtHealth * 0.3);

  let healthLabel = "Delicado";
  if (healthScore >= 80) healthLabel = "Fuerte";
  else if (healthScore >= 55) healthLabel = "Estable";

  renderGauge(
    "healthGauge",
    healthScore,
    "healthGaugeValue",
    "healthGaugeLabel",
    "healthGaugeDetail",
    healthLabel,
    `Liquidez ${money(liquidityTotal)} · Ingresos mes ${money(currentIncome)}`
  );
}

function toIsoDate(value) {
  if (!value) return "";

  const raw = String(value).trim();

  // ISO / Supabase timestamp.
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  // dd/mm/yyyy or dd-mm-yyyy.
  const match = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const day = String(match[1]).padStart(2, "0");
    const month = String(match[2]).padStart(2, "0");
    const year = match[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return "";
}


function getManualPaymentPayload() {
  const paidAt = document.getElementById("manualPaymentDate")?.value || isoToday();
  const amount = Number(document.getElementById("manualPaymentAmount")?.value || 0);
  const accountKey = document.getElementById("manualPaymentAccount")?.value || "";
  const concept = String(document.getElementById("manualPaymentConcept")?.value || "").trim();

  if (!paidAt) throw new Error("Selecciona la fecha del pago.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("La cantidad debe ser mayor a cero.");
  if (!accountKey || !ACCOUNT_LABELS[accountKey]) throw new Error("Selecciona una cuenta válida.");
  if (!concept) throw new Error("Escribe el concepto del pago.");

  return { paidAt, amount, accountKey, concept };
}

async function saveManualPayment(event) {
  event.preventDefault();

  try {
    const { paidAt, amount, accountKey, concept } = getManualPaymentPayload();

    const account = findAccountByKey(accountKey);
    if (!account) throw new Error(`No encontré la cuenta ${ACCOUNT_LABELS[accountKey]} en finance_accounts.`);

    const currentBalance = accountBalance(account);
    const newBalance = currentBalance + amount;

    const confirmed = window.confirm(
      `Confirmar pago recibido por ${money(amount)}.\n\n` +
      `Concepto: ${concept}\n` +
      `Cuenta destino: ${ACCOUNT_LABELS[accountKey]}\n\n` +
      `Saldo actual: ${money(currentBalance)}\n` +
      `Nuevo saldo: ${money(newBalance)}`
    );

    if (!confirmed) return;

    const { error: insertError } = await db
      .from("finance_manual_payments")
      .insert({
        concept,
        amount,
        deposited_to_account: ACCOUNT_LABELS[accountKey],
        paid_at: paidAt,
        created_at: new Date().toISOString(),
      });

    if (insertError) throw insertError;

    const { error: accountError } = await db
      .from("finance_accounts")
      .update({ current_balance: newBalance })
      .eq("id", account.id);

    if (accountError) throw accountError;

    setStatus(`Pago guardado: ${money(amount)} depositado a ${ACCOUNT_LABELS[accountKey]}.`, "ok");
    closeManualPaymentWorkspace();
    await loadFinance();
  } catch (error) {
    console.error("Error guardando pago manual:", error);
    setStatus(error.message || "Error guardando pago manual.", "error");
  }
}

function getManualExpensePayload() {
  const spentAt = document.getElementById("manualExpenseDate")?.value || isoToday();
  const amount = Number(document.getElementById("manualExpenseAmount")?.value || 0);
  const accountKey = document.getElementById("manualExpenseAccount")?.value || "";
  const concept = String(document.getElementById("manualExpenseConcept")?.value || "").trim();

  if (!spentAt) throw new Error("Selecciona la fecha del gasto.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("La cantidad debe ser mayor a cero.");
  if (!accountKey || !ACCOUNT_LABELS[accountKey]) throw new Error("Selecciona una cuenta válida.");
  if (!concept) throw new Error("Escribe el concepto del gasto.");

  return { spentAt, amount, accountKey, concept };
}

async function saveManualExpense(event) {
  event.preventDefault();

  try {
    const { spentAt, amount, accountKey, concept } = getManualExpensePayload();

    const account = findAccountByKey(accountKey);
    if (!account) throw new Error(`No encontré la cuenta ${ACCOUNT_LABELS[accountKey]} en finance_accounts.`);

    const currentBalance = accountBalance(account);
    const newBalance = currentBalance - amount;

    const confirmed = window.confirm(
      `Confirmar gasto/retiro por ${money(amount)}.\n\n` +
      `Concepto: ${concept}\n` +
      `Cuenta de retiro: ${ACCOUNT_LABELS[accountKey]}\n\n` +
      `Saldo actual: ${money(currentBalance)}\n` +
      `Nuevo saldo: ${money(newBalance)}`
    );

    if (!confirmed) return;

    const { error: insertError } = await db
      .from("finance_manual_expenses")
      .insert({
        concept,
        amount,
        withdrawn_from_account: ACCOUNT_LABELS[accountKey],
        spent_at: spentAt,
        created_at: new Date().toISOString(),
      });

    if (insertError) throw insertError;

    const { error: accountError } = await db
      .from("finance_accounts")
      .update({ current_balance: newBalance })
      .eq("id", account.id);

    if (accountError) throw accountError;

    setStatus(`Gasto guardado: ${money(amount)} retirado de ${ACCOUNT_LABELS[accountKey]}.`, "ok");
    closeManualExpenseWorkspace();
    await loadFinance();
  } catch (error) {
    console.error("Error guardando gasto manual:", error);
    setStatus(error.message || "Error guardando gasto manual.", "error");
  }
}



function operationalPaymentSourceId(payment) {
  return String(firstValue(payment, [
    "id",
    "payment_id",
    "uuid",
    "source_payment_id",
    "event_payment_id",
  ], `${operationalPaymentDate(payment)}|${operationalPaymentAmount(payment)}|${operationalPaymentDestinationLabel(payment)}|${firstValue(payment, ["record_id", "event_id", "topdjs_record_id"], "")}`));
}

function operationalPaymentAmount(payment) {
  return Number(firstValue(payment, [
    "amount",
    "payment_amount",
    "paid_amount",
    "monto",
    "abono",
    "value",
    "cantidad",
    "total",
  ], 0)) || 0;
}

function operationalPaymentDate(payment) {
  return toIsoDate(firstValue(payment, [
    "payment_date",
    "paid_at",
    "date",
    "fecha",
    "fecha_pago",
    "created_at",
    "updated_at",
  ], ""));
}

function operationalPaymentDestinationLabel(payment) {
  return firstValue(payment, [
    "destination",
    "payment_destination",
    "destination_account",
    "paid_to_account",
    "payment_account",
    "account",
    "bank",
    "method",
    "payment_method",
    "metodo",
    "cuenta",
    "cuenta_destino",
  ], "");
}

function operationalPaymentAccountKey(payment) {
  return accountKeyFromLabel(operationalPaymentDestinationLabel(payment));
}

function isOperationalPaymentEligible(payment) {
  const amount = operationalPaymentAmount(payment);
  const date = operationalPaymentDate(payment);
  const accountKey = operationalPaymentAccountKey(payment);

  return amount > 0 && date >= CRM_SYNC_START_DATE && Boolean(accountKey);
}

function groupPaymentsByAccount(payments) {
  return payments.reduce((grouped, payment) => {
    const accountKey = operationalPaymentAccountKey(payment);
    const amount = operationalPaymentAmount(payment);

    if (!grouped[accountKey]) grouped[accountKey] = 0;
    grouped[accountKey] += amount;

    return grouped;
  }, {});
}

async function syncCrmPayments() {
  try {
    setStatus(`Sincronizando CRM operativo desde ${CRM_SYNC_START_DATE}...`);

    const confirmed = window.confirm(
      "Sincronizar pagos del CRM operativo TopDJs desde el 15-jun-2026.\n\n" +
      "Los anticipos anteriores NO se tomarán para evitar duplicar saldos.\n\n" +
      "¿Continuar?"
    );

    if (!confirmed) {
      setStatus("Sincronización cancelada.", "ok");
      return;
    }

    const [sourceResult, logResult] = await Promise.all([
      db.from("event_payments").select("*"),
      db.from("finance_crm_payment_sync_log").select("source_payment_id,status"),
    ]);

    if (sourceResult.error) throw sourceResult.error;
    if (logResult.error) throw logResult.error;

    const syncedIds = new Set(
      (logResult.data || [])
        .filter((row) => !row.status || row.status === "synced")
        .map((row) => String(row.source_payment_id))
    );

    const sourcePayments = sourceResult.data || [];

    const eligiblePayments = sourcePayments.filter((payment) => {
      const sourceId = operationalPaymentSourceId(payment);
      return isOperationalPaymentEligible(payment) && !syncedIds.has(sourceId);
    });

    const ignoredBeforeCutoff = sourcePayments.filter((payment) => {
      const date = operationalPaymentDate(payment);
      return date && date < CRM_SYNC_START_DATE;
    }).length;

    if (!eligiblePayments.length) {
      setStatus(
        `No hay pagos nuevos para sincronizar desde ${CRM_SYNC_START_DATE}. Ignorados anteriores: ${ignoredBeforeCutoff}.`,
        "ok"
      );
      await loadFinance();
      return;
    }

    const grouped = groupPaymentsByAccount(eligiblePayments);
    const accountUpdates = [];

    for (const [accountKey, amount] of Object.entries(grouped)) {
      const account = findAccountByKey(accountKey);
      if (!account) {
        throw new Error(`No encontré la cuenta ${ACCOUNT_LABELS[accountKey]} para sumar pagos.`);
      }

      const currentBalance = accountBalance(account);
      const newBalance = currentBalance + amount;

      accountUpdates.push({
        accountKey,
        account,
        amount,
        currentBalance,
        newBalance,
      });
    }

    const summary = accountUpdates
      .map((item) => `${ACCOUNT_LABELS[item.accountKey]} + ${money(item.amount)} = ${money(item.newBalance)}`)
      .join("\n");

    const finalConfirm = window.confirm(
      `Pagos nuevos encontrados: ${eligiblePayments.length}\n\n${summary}\n\n¿Aplicar sincronización?`
    );

    if (!finalConfirm) {
      setStatus("Sincronización cancelada antes de aplicar cambios.", "ok");
      return;
    }

    for (const item of accountUpdates) {
      const { error } = await db
        .from("finance_accounts")
        .update({ current_balance: item.newBalance })
        .eq("id", item.account.id);

      if (error) throw error;
    }

    const logRows = eligiblePayments.map((payment) => {
      const accountKey = operationalPaymentAccountKey(payment);

      return {
        source_table: "event_payments",
        source_payment_id: operationalPaymentSourceId(payment),
        payment_date: operationalPaymentDate(payment),
        amount: operationalPaymentAmount(payment),
        destination_account: ACCOUNT_LABELS[accountKey],
        raw_destination: operationalPaymentDestinationLabel(payment),
        status: "synced",
        synced_at: new Date().toISOString(),
      };
    });

    const { error: insertLogError } = await db
      .from("finance_crm_payment_sync_log")
      .insert(logRows);

    if (insertLogError) throw insertLogError;

    setStatus(`Sincronización completa: ${eligiblePayments.length} pagos nuevos aplicados.`, "ok");
    await loadFinance();
  } catch (error) {
    console.error("Error sincronizando CRM operativo:", error);
    setStatus(error.message || "Error sincronizando CRM operativo.", "error");
  }
}


async function loadFinance() {
  setStatus("Cargando liquidez, gastos e historial desde Supabase...");

  const [accountsResult, expensesResult, paymentsResult, cardsResult, crmSyncResult, manualPaymentsResult, manualExpensesResult] = await Promise.all([
    db.from("finance_accounts").select("*"),
    db.from("finance_fixed_expenses").select("*"),
    db.from("finance_fixed_expense_payments").select("*").order("created_at", { ascending: false }).limit(50),
    db.from("finance_credit_cards").select("*"),
    db.from("finance_crm_payment_sync_log").select("*"),
    db.from("finance_manual_payments").select("*"),
    db.from("finance_manual_expenses").select("*"),
  ]);

  if (accountsResult.error) {
    console.error("Error cargando finance_accounts:", accountsResult.error);
    setStatus(`Error cargando finance_accounts: ${accountsResult.error.message}`, "error");
    accountsCache = [];
    renderBalances({ bbva: 0, nu: 0, manuel: 0, efectivo: 0 });
    return;
  }

  accountsCache = accountsResult.data || [];
  renderBalances(calculateBalancesFromAccounts(accountsCache));

  if (expensesResult.error) {
    console.error("Error cargando finance_fixed_expenses:", expensesResult.error);
    setStatus(`Liquidez cargada, pero hubo error en gastos fijos: ${expensesResult.error.message}`, "error");
    fixedExpensesCache = [];
    renderFixedExpenses();
    return;
  }

  fixedExpensesCache = expensesResult.data || [];
  renderFixedExpenses();

  if (paymentsResult.error) {
    console.error("Error cargando historial de pagos:", paymentsResult.error);
    paymentsCache = [];
    renderPaymentHistory();
    setStatus(`Gastos cargados, pero hubo error en historial: ${paymentsResult.error.message}`, "error");
    return;
  }

  paymentsCache = paymentsResult.data || [];
  renderPaymentHistory();

  if (cardsResult.error) {
    console.error("Error cargando tarjetas de crédito:", cardsResult.error);
    creditCardsCache = [];
    renderCreditCards();
    setStatus(`Datos cargados, pero hubo error en tarjetas: ${cardsResult.error.message}`, "error");
    return;
  }

  creditCardsCache = cardsResult.data || [];
  renderCreditCards();

  if (crmSyncResult.error) {
    console.error("Error cargando sync log del CRM:", crmSyncResult.error);
    syncedCrmPaymentsCache = [];
  } else {
    syncedCrmPaymentsCache = crmSyncResult.data || [];
  }

  if (manualPaymentsResult.error) {
    console.error("Error cargando pagos manuales:", manualPaymentsResult.error);
    manualPaymentsCache = [];
  } else {
    manualPaymentsCache = manualPaymentsResult.data || [];
  }

  if (manualExpensesResult.error) {
    console.error("Error cargando gastos manuales:", manualExpensesResult.error);
    manualExpensesCache = [];
  } else {
    manualExpensesCache = manualExpensesResult.data || [];
  }

  renderFinancialGauges();

  if (openedExpenseId) {
    renderExpenseDetail(getExpenseById(openedExpenseId));
  }

  setStatus("Liquidez, gastos, tarjetas e historial cargados correctamente desde Supabase.", "ok");
}

document.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", loadFinance);

  const manualPaymentBtn = document.getElementById("manualPaymentBtn");
  if (manualPaymentBtn) manualPaymentBtn.addEventListener("click", openManualPaymentWorkspace);

  const closeManualPaymentBtn = document.getElementById("closeManualPaymentBtn");
  if (closeManualPaymentBtn) closeManualPaymentBtn.addEventListener("click", closeManualPaymentWorkspace);

  const cancelManualPaymentBtn = document.getElementById("cancelManualPaymentBtn");
  if (cancelManualPaymentBtn) cancelManualPaymentBtn.addEventListener("click", closeManualPaymentWorkspace);

  const manualPaymentForm = document.getElementById("manualPaymentForm");
  if (manualPaymentForm) manualPaymentForm.addEventListener("submit", saveManualPayment);

  const manualExpenseBtn = document.getElementById("manualExpenseBtn");
  if (manualExpenseBtn) manualExpenseBtn.addEventListener("click", openManualExpenseWorkspace);

  const closeManualExpenseBtn = document.getElementById("closeManualExpenseBtn");
  if (closeManualExpenseBtn) closeManualExpenseBtn.addEventListener("click", closeManualExpenseWorkspace);

  const cancelManualExpenseBtn = document.getElementById("cancelManualExpenseBtn");
  if (cancelManualExpenseBtn) cancelManualExpenseBtn.addEventListener("click", closeManualExpenseWorkspace);

  const manualExpenseForm = document.getElementById("manualExpenseForm");
  if (manualExpenseForm) manualExpenseForm.addEventListener("submit", saveManualExpense);

  const analyzeFinanceBtn = document.getElementById("analyzeFinanceBtn");
  if (analyzeFinanceBtn) analyzeFinanceBtn.addEventListener("click", renderInternalStrategies);

  const syncCrmBtn = document.getElementById("syncCrmBtn");
  if (syncCrmBtn) syncCrmBtn.addEventListener("click", syncCrmPayments);

  const openExpensesBtn = document.getElementById("openExpensesBtn");
  if (openExpensesBtn) openExpensesBtn.addEventListener("click", openExpensesWorkspace);

  const closeExpensesBtn = document.getElementById("closeExpensesBtn");
  if (closeExpensesBtn) closeExpensesBtn.addEventListener("click", closeExpensesWorkspace);

  const openCardsBtn = document.getElementById("openCardsBtn");
  if (openCardsBtn) openCardsBtn.addEventListener("click", openCardsWorkspace);

  const closeCardsBtn = document.getElementById("closeCardsBtn");
  if (closeCardsBtn) closeCardsBtn.addEventListener("click", closeCardsWorkspace);

  const addExpenseBtn = document.getElementById("addExpenseBtn");
  if (addExpenseBtn) addExpenseBtn.addEventListener("click", () => showExpenseForm());

  const workspaceAddExpenseBtn = document.getElementById("workspaceAddExpenseBtn");
  if (workspaceAddExpenseBtn) workspaceAddExpenseBtn.addEventListener("click", () => showExpenseForm());

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeManualPaymentWorkspace();
      closeManualExpenseWorkspace();
      closeExpensesWorkspace();
      closeCardsWorkspace();
    }
  });

  loadFinance();
});
