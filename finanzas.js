// =======================================================
// TopDJs Finanzas CRM v2.0.8
// Liquidez + gastos fijos + sueldos semanales + pagar gastos
// Al pagar, se resta el saldo de la cuenta seleccionada.
// No se capturan ingresos manualmente en Finanzas.
// =======================================================

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let accountsCache = [];
let fixedExpensesCache = [];
let editingExpenseId = null;
let payingExpenseId = null;

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

function dateToYmd(date) {
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
  });
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

  if (frequency === "weekly") {
    return WEEKDAYS[day || 1] || "Lunes";
  }

  return day ? `Día ${String(day).padStart(2, "0")}` : "Pendiente";
}

function expenseNextPaymentLabel(expense) {
  const frequency = expenseFrequency(expense);
  const day = expenseDueDay(expense);

  if (frequency === "weekly") {
    return dateToYmd(nextWeeklyDate(day || 1));
  }

  return dateToYmd(nextMonthlyDate(day || 1));
}

function suggestedPaymentAmount(expense) {
  // Para gastos semanales se paga el monto semanal.
  // Para gastos mensuales se paga el monto mensual.
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
  if (!container) return;

  const expenses = sortedActiveExpenses();
  const total = expenses.reduce((sum, expense) => sum + expenseMonthlyEstimate(expense), 0);
  setText("gastosFijosTotal", money(total));

  if (!expenses.length) {
    container.innerHTML = `<div class="empty-state">No hay gastos fijos registrados. Usa “Agregar gasto fijo”.</div>`;
    return;
  }

  container.innerHTML = expenses
    .map((expense) => {
      const frequency = expenseFrequency(expense);
      const amountLabel = frequency === "weekly" ? "Monto semanal" : "Monto mensual";
      const estimate = expenseMonthlyEstimate(expense);

      return `
        <article class="expense-row">
          <div class="expense-main">
            <strong>${escapeHtml(expenseName(expense))}</strong>
            <small>${frequency === "weekly" ? "Se calcula cada semana" : "Gasto fijo mensual"}</small>
          </div>

          <div class="expense-meta">
            <span>${amountLabel}</span>
            <strong class="amount">${money(expenseAmount(expense))}</strong>
          </div>

          <div class="expense-meta">
            <span>Pago</span>
            <strong>${escapeHtml(expenseDateLabel(expense))}</strong>
          </div>

          <div class="expense-meta">
            <span>Próximo</span>
            <strong>${escapeHtml(expenseNextPaymentLabel(expense))}</strong>
          </div>

          <div class="expense-meta">
            <span>Est. mes</span>
            <strong>${money(estimate)}</strong>
          </div>

          <div class="expense-actions">
            <button type="button" class="pay" onclick="showPaymentForm('${escapeHtml(expense.id)}')">Pagar</button>
            <button type="button" onclick="editExpense('${escapeHtml(expense.id)}')">Editar</button>
            <button type="button" class="danger" onclick="deleteExpense('${escapeHtml(expense.id)}')">Borrar</button>
          </div>
        </article>
      `;
    })
    .join("");
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
  closePaymentForm();

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
    <p class="payment-subtitle">
      Selecciona la cuenta y la cantidad. Al guardar, se restará del saldo superior.
    </p>

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
  closeExpenseForm();

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

async function tryInsertPaymentLog({ expense, accountKey, amount, paidAt }) {
  // El log es útil para historial. Si no existe la tabla, no bloquea el pago.
  try {
    await db.from("finance_fixed_expense_payments").insert({
      fixed_expense_id: expense.id,
      expense_name: expenseName(expense),
      amount,
      paid_from_account: ACCOUNT_LABELS[accountKey],
      paid_at: paidAt,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("No se pudo guardar historial de pago, pero el saldo ya se ajustó:", error);
  }
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

    await tryInsertPaymentLog({ expense, accountKey, amount, paidAt });

    setStatus(`Pago guardado. ${ACCOUNT_LABELS[accountKey]} quedó en ${money(newBalance)}.`, "ok");
    closePaymentForm();
    await loadFinance();
  } catch (error) {
    console.error("Error guardando pago:", error);
    setStatus(error.message || "Error guardando pago.", "error");
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
    accountsCache = [];
    renderBalances({ bbva: 0, nu: 0, manuel: 0, efectivo: 0 });
    return;
  }

  accountsCache = accountsResult.data || [];
  const balances = calculateBalancesFromAccounts(accountsCache);
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
