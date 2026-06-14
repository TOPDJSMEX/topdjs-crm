// =======================================================
// TOPDJS FINANZAS CRM v1.0.1
// Tarjetas con límite, disponible, usado y % uso
// =======================================================

// IMPORTANTE:
// Copia estos dos valores desde tu app.js actual del CRM operativo.
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const money = (value) => {
  const number = Number(value || 0);
  return number.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const shortMoney = (value) => {
  const number = Number(value || 0);
  return number.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstDefined(source, keys, fallback = null) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return fallback;
}

function asNumber(value, fallback = 0) {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function inputNumberValue(value) {
  return value === null || value === undefined ? "" : Number(value || 0);
}

function readMoneyInput(id) {
  const input = document.getElementById(id);
  if (!input || input.value === "") return null;
  const number = Number(input.value);
  return Number.isFinite(number) ? number : null;
}

function percentText(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Pendiente";
  }

  return `${Number(value).toFixed(1)}%`;
}

function countMondaysInCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  let mondays = 0;

  const date = new Date(year, month, 1);

  while (date.getMonth() === month) {
    if (date.getDay() === 1) mondays++;
    date.setDate(date.getDate() + 1);
  }

  return mondays;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function badgeRisk(level) {
  const normalized = (level || "low").toLowerCase();

  const labelMap = {
    critical: "Crítico",
    high: "Alto",
    medium: "Medio",
    low: "Bajo",
  };

  return `<span class="badge ${normalized}">${labelMap[normalized] || escapeHtml(level)}</span>`;
}

function calculateCardMetrics(card) {
  const balance = asNumber(
    firstDefined(card, ["current_balance", "balance", "saldo"], 0)
  );

  const creditLimitRaw = firstDefined(card, ["credit_limit", "limit", "limite"], null);
  const availableRaw = firstDefined(
    card,
    ["available_credit", "available", "disponible"],
    null
  );

  const creditLimit = creditLimitRaw === null ? null : asNumber(creditLimitRaw, 0);
  const availableCredit = availableRaw === null ? null : asNumber(availableRaw, 0);

  const usedCredit =
    firstDefined(card, ["used_credit", "used", "saldo_usado"], null) !== null
      ? asNumber(firstDefined(card, ["used_credit", "used", "saldo_usado"], 0))
      : creditLimit !== null && availableCredit !== null
      ? Math.max(creditLimit - availableCredit, 0)
      : balance;

  const usagePercentage =
    firstDefined(card, ["usage_percentage", "usage_percent", "porcentaje_uso"], null) !== null
      ? asNumber(firstDefined(card, ["usage_percentage", "usage_percent", "porcentaje_uso"], 0))
      : creditLimit && creditLimit > 0
      ? (usedCredit / creditLimit) * 100
      : null;

  return {
    balance,
    creditLimit,
    availableCredit,
    usedCredit,
    usagePercentage,
  };
}

function calculateRiskLevel(card) {
  if (card.risk_level) return card.risk_level;

  const { balance, usagePercentage } = calculateCardMetrics(card);
  const cat = asNumber(firstDefined(card, ["cat", "cat_rate", "interest_rate"], 0));

  if (cat >= 100 || usagePercentage >= 90 || balance >= 80000) return "critical";
  if (cat >= 60 || usagePercentage >= 70 || balance >= 30000) return "high";
  if (cat >= 25 || usagePercentage >= 40) return "medium";
  return "low";
}

function renderAccounts(accounts) {
  const el = document.getElementById("accountsList");
  if (!el) return;

  if (!accounts || !accounts.length) {
    el.innerHTML = `<div class="empty-state">No hay cuentas registradas.</div>`;
    return;
  }

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Cuenta</th>
          <th>Tipo</th>
          <th>Saldo</th>
          <th>Notas</th>
        </tr>
      </thead>
      <tbody>
        ${accounts
          .map(
            (account) => `
            <tr>
              <td><strong>${escapeHtml(account.name)}</strong></td>
              <td>${escapeHtml(account.type || "-")}</td>
              <td class="amount">${money(account.current_balance)}</td>
              <td>${escapeHtml(account.notes || "")}</td>
            </tr>
          `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function updateCardFinanceFields(cardId) {
  const minimumPayment = readMoneyInput(`min-${cardId}`);
  const creditLimit = readMoneyInput(`limit-${cardId}`);
  const availableCredit = readMoneyInput(`available-${cardId}`);

  const payload = {
    minimum_payment: minimumPayment,
    minimum_payment_status: minimumPayment === null ? "pending_app" : "known",
    credit_limit: creditLimit,
    credit_limit_status: creditLimit === null ? "pending" : "known",
    available_credit: availableCredit,
  };

  const { error } = await db
    .from("finance_credit_cards")
    .update(payload)
    .eq("id", cardId);

  if (error) {
    alert("No se pudo guardar la tarjeta: " + error.message);
    return;
  }

  await loadFinance();
}

// Necesario porque los botones usan onclick dentro de HTML renderizado.
window.updateCardFinanceFields = updateCardFinanceFields;

function renderCards(cards) {
  const el = document.getElementById("cardsList");
  if (!el) return;

  if (!cards || !cards.length) {
    el.innerHTML = `<div class="empty-state">No hay tarjetas registradas.</div>`;
    return;
  }

  el.innerHTML = `
    <table class="cards-table">
      <thead>
        <tr>
          <th>Prioridad</th>
          <th>Tarjeta</th>
          <th>Saldo</th>
          <th>Límite</th>
          <th>Disponible</th>
          <th>Usado</th>
          <th>% uso</th>
          <th>Mínimo</th>
          <th>CAT / Tasa</th>
          <th>Riesgo</th>
          <th>Guardar</th>
        </tr>
      </thead>
      <tbody>
        ${cards
          .map((card) => {
            const metrics = calculateCardMetrics(card);
            const cat = firstDefined(card, ["cat", "cat_rate"], null);
            const interestRate = firstDefined(card, ["interest_rate", "rate"], null);
            const catOrRate =
              cat !== null
                ? `CAT ${Number(cat).toFixed(1)}%`
                : interestRate !== null
                ? `${Number(interestRate).toFixed(1)}%`
                : "-";

            const minimumValue =
              card.minimum_payment_status === "pending_app" ||
              card.minimum_payment === null ||
              card.minimum_payment === undefined
                ? ""
                : inputNumberValue(card.minimum_payment);

            const creditLimitValue = inputNumberValue(metrics.creditLimit);
            const availableCreditValue = inputNumberValue(metrics.availableCredit);
            const usageClass =
              metrics.usagePercentage === null
                ? "pending"
                : metrics.usagePercentage >= 80
                ? "danger"
                : metrics.usagePercentage >= 50
                ? "warning"
                : "positive";

            const bank = firstDefined(card, ["bank", "bank_name", "issuer"], "-");
            const usageType = firstDefined(card, ["usage_type", "card_type"], "Mixta");
            const riskLevel = calculateRiskLevel(card);

            return `
              <tr>
                <td>${escapeHtml(card.priority || "-")}</td>
                <td>
                  <strong>${escapeHtml(card.card_name || card.name || "Tarjeta")}</strong><br>
                  <small>${escapeHtml(bank)} · ${escapeHtml(usageType)}</small>
                </td>
                <td class="amount">${money(metrics.balance)}</td>
                <td>
                  <input
                    class="money-input"
                    type="number"
                    min="0"
                    step="1"
                    id="limit-${escapeHtml(card.id)}"
                    value="${creditLimitValue}"
                    placeholder="Límite"
                  />
                </td>
                <td>
                  <input
                    class="money-input positive"
                    type="number"
                    min="0"
                    step="1"
                    id="available-${escapeHtml(card.id)}"
                    value="${availableCreditValue}"
                    placeholder="Disponible"
                  />
                </td>
                <td class="amount muted-amount">${money(metrics.usedCredit)}</td>
                <td>
                  <span class="usage-pill ${usageClass}">${percentText(metrics.usagePercentage)}</span>
                </td>
                <td>
                  <input
                    class="money-input warning"
                    type="number"
                    min="0"
                    step="1"
                    id="min-${escapeHtml(card.id)}"
                    value="${minimumValue}"
                    placeholder="Mínimo"
                  />
                </td>
                <td>${escapeHtml(catOrRate)}</td>
                <td>${badgeRisk(riskLevel)}</td>
                <td class="actions-cell">
                  <button onclick="updateCardFinanceFields('${escapeHtml(card.id)}')">
                    Guardar
                  </button>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderExpenses(expenses) {
  const el = document.getElementById("expensesList");
  if (!el) return;

  if (!expenses || !expenses.length) {
    el.innerHTML = `<div class="empty-state">No hay gastos fijos registrados.</div>`;
    return;
  }

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Gasto</th>
          <th>Monto</th>
          <th>Frecuencia</th>
          <th>Día</th>
          <th>Cuenta</th>
          <th>Categoría</th>
        </tr>
      </thead>
      <tbody>
        ${expenses
          .map((expense) => {
            const frequency =
              expense.frequency === "weekly" ? "Semanal" : "Mensual";

            const day =
              expense.frequency === "weekly"
                ? "Lunes"
                : `Día ${expense.due_day}`;

            return `
              <tr>
                <td><strong>${escapeHtml(expense.name)}</strong></td>
                <td class="amount">${money(expense.amount)}</td>
                <td>${escapeHtml(frequency)}</td>
                <td>${escapeHtml(day)}</td>
                <td>${escapeHtml(expense.suggested_account || "Flexible")}</td>
                <td>${escapeHtml(expense.category || "-")}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function updateMainAlert(totals) {
  const alert = document.getElementById("mainAlert");
  if (!alert) return;

  const liquidity = Number(totals.total_liquidity || 0);
  const fixed = Number(totals.monthly_fixed_expenses || 0);
  const weeklyPayroll = Number(totals.weekly_payroll || 0);
  const minimums = Number(totals.known_minimum_card_payments || 0);
  const pendingMinimums = Number(totals.cards_with_pending_minimum || 0);

  const mondays = countMondaysInCurrentMonth();
  const realPayroll = weeklyPayroll * mondays;
  const monthNeed = fixed + realPayroll + minimums;
  const deficit = monthNeed - liquidity;

  alert.classList.remove("green", "red");

  if (deficit > 0) {
    alert.classList.add("red");
    alert.innerHTML = `
      🚨 Déficit estimado del mes: <strong>${money(deficit)}</strong>.
      Necesario con fijos, nómina y mínimos conocidos: <strong>${money(
        monthNeed
      )}</strong>.
      Liquidez actual: <strong>${money(liquidity)}</strong>.
      ${
        pendingMinimums > 0
          ? `<br>Falta capturar ${pendingMinimums} pago mínimo pendiente.`
          : ""
      }
    `;
  } else {
    alert.classList.add("green");
    alert.innerHTML = `
      ✅ Mes cubierto con la liquidez actual.
      Sobrante estimado: <strong>${money(Math.abs(deficit))}</strong>.
    `;
  }
}

async function loadFinance() {
  try {
    const [totalsRes, accountsRes, cardsRes, expensesRes] = await Promise.all([
      db.from("finance_dashboard_totals").select("*").single(),
      db
        .from("finance_accounts")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      db.from("finance_credit_card_priority").select("*"),
      db
        .from("finance_fixed_expenses")
        .select("*")
        .eq("is_active", true)
        .order("frequency", { ascending: true })
        .order("due_day", { ascending: true }),
    ]);

    if (totalsRes.error) throw totalsRes.error;
    if (accountsRes.error) throw accountsRes.error;
    if (cardsRes.error) throw cardsRes.error;
    if (expensesRes.error) throw expensesRes.error;

    const totals = totalsRes.data;

    setText("totalLiquidity", shortMoney(totals.total_liquidity));
    setText("balanceNu", shortMoney(totals.balance_nu));
    setText("balanceBbva", shortMoney(totals.balance_bbva));
    setText("balanceManuel", shortMoney(totals.balance_manuel));
    setText("balanceEfectivo", shortMoney(totals.balance_efectivo));
    setText("monthlyFixed", shortMoney(totals.monthly_fixed_expenses));
    setText("weeklyPayroll", shortMoney(totals.weekly_payroll));
    setText("totalCards", shortMoney(totals.total_credit_card_balance));
    setText("knownMinimums", shortMoney(totals.known_minimum_card_payments));
    setText("noInterestTotal", shortMoney(totals.total_no_interest_payment));

    updateMainAlert(totals);
    renderAccounts(accountsRes.data);
    renderCards(cardsRes.data);
    renderExpenses(expensesRes.data);
  } catch (error) {
    console.error("Error cargando Finanzas:", error);

    const alert = document.getElementById("mainAlert");
    if (alert) {
      alert.classList.add("red");
      alert.innerHTML = `
        Error cargando TopDJs Finanzas. Revisa SUPABASE_URL, SUPABASE_ANON_KEY o permisos.
        <br><small>${escapeHtml(error.message || error)}</small>
      `;
    }
  }
}

document.addEventListener("DOMContentLoaded", loadFinance);
