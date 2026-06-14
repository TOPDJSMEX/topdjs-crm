// =======================================================
// TOPDJS FINANZAS CRM v1.0.7
// Límites fijos por tarjeta + mínimo editable + layout limpio
// =======================================================

// IMPORTANTE:
// Copia estos dos valores desde tu app.js actual del CRM operativo.
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Límites reales de crédito definidos por TopDJs Finanzas.
// Ya no se capturan en pantalla. Se usan para calcular disponible y % de uso.
const FIXED_CARD_LIMITS = {
  "nu": 140000,
  "bbva vane": 180000,
  "bbva manuel": 77900,
  "liverpool visa": 50000,
  "liverpool departamental": 25000,
};

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

function normalizeCardName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

function getFixedCreditLimit(card) {
  const cardName = normalizeCardName(firstDefined(card, ["card_name", "name"], ""));

  if (FIXED_CARD_LIMITS[cardName]) {
    return FIXED_CARD_LIMITS[cardName];
  }

  // Respaldo: si en Supabase ya existe credit_limit, se usa.
  const storedLimit = asNumber(firstDefined(card, ["credit_limit", "limit", "limite"], 0), 0);
  return storedLimit > 0 ? storedLimit : null;
}

function calculateCardMetrics(card) {
  const balance = asNumber(
    firstDefined(card, ["current_balance", "balance", "saldo"], 0)
  );

  const creditLimit = getFixedCreditLimit(card);
  const usedCredit = Math.max(balance, 0);
  const availableCredit = creditLimit !== null ? creditLimit - usedCredit : null;
  const usagePercentage =
    creditLimit !== null && creditLimit > 0 ? (usedCredit / creditLimit) * 100 : null;

  return {
    balance,
    creditLimit,
    availableCredit,
    usedCredit,
    usagePercentage,
  };
}

function calculateRiskLevelFromValues({ balance = 0, usagePercentage = null, cat = 0 }) {
  if (cat >= 100 || usagePercentage >= 90 || balance >= 80000) return "critical";
  if (cat >= 60 || usagePercentage >= 70 || balance >= 30000) return "high";
  if (cat >= 25 || usagePercentage >= 40) return "medium";
  return "low";
}

function calculateRiskLevel(card) {
  const metrics = calculateCardMetrics(card);
  const cat = asNumber(firstDefined(card, ["cat", "cat_rate", "interest_rate"], 0));

  return calculateRiskLevelFromValues({
    balance: metrics.balance,
    usagePercentage: metrics.usagePercentage,
    cat,
  });
}

function getUsageClass(usagePercentage) {
  if (usagePercentage === null || usagePercentage === undefined) return "pending";
  if (usagePercentage >= 80) return "danger";
  if (usagePercentage >= 50) return "warning";
  return "positive";
}

function usageProgressWidth(usagePercentage) {
  if (usagePercentage === null || usagePercentage === undefined || Number.isNaN(Number(usagePercentage))) {
    return 0;
  }

  return Math.max(0, Math.min(Number(usagePercentage), 100));
}

function displayMoneyOrPending(value, pendingText = "Pendiente") {
  return value === null || value === undefined ? pendingText : money(value);
}

let financeCardsById = new Map();

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
  const card = financeCardsById.get(String(cardId));
  if (!card) return;

  const metrics = calculateCardMetrics(card);
  const minimumPayment = readMoneyInput(`min-${cardId}`);

  const payload = {
    minimum_payment: minimumPayment,
    minimum_payment_status: minimumPayment === null ? "pending_app" : "known",
    credit_limit: metrics.creditLimit,
    credit_limit_status: metrics.creditLimit === null ? "pending" : "known",
    available_credit: metrics.availableCredit,
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

function wireCardsBoardEvents(container) {
  container.querySelectorAll(".save-card-btn").forEach((button) => {
    button.addEventListener("click", () => updateCardFinanceFields(button.dataset.cardId));
  });
}

// Disponible para debug desde consola si hace falta.
window.updateCardFinanceFields = updateCardFinanceFields;

function renderCards(cards) {
  const el = document.getElementById("cardsList");
  if (!el) return;

  if (!cards || !cards.length) {
    el.innerHTML = `<div class="empty-state">No hay tarjetas registradas.</div>`;
    return;
  }

  financeCardsById = new Map(cards.map((card) => [String(card.id), card]));

  el.innerHTML = `
    <div class="cards-list-v107">
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
              : "Sin tasa";

          const minimumValue =
            card.minimum_payment_status === "pending_app" ||
            card.minimum_payment === null ||
            card.minimum_payment === undefined
              ? ""
              : inputNumberValue(card.minimum_payment);

          const usageClass = getUsageClass(metrics.usagePercentage);
          const bank = firstDefined(card, ["bank", "bank_name", "issuer"], "-");
          const usageType = firstDefined(card, ["usage_type", "card_type"], "Mixta");
          const riskLevel = calculateRiskLevel(card);
          const cardId = escapeHtml(card.id);
          const priority = escapeHtml(card.priority || "-");
          const availableText = displayMoneyOrPending(metrics.availableCredit, "Sin límite");
          const availableNegativeClass = metrics.availableCredit !== null && metrics.availableCredit < 0 ? " negative" : "";

          return `
            <article class="finance-card-row-v107 risk-${riskLevel}" data-card-container="${cardId}">
              <div class="card-main-v107">
                <span class="priority-pill-v107">#${priority}</span>
                <div class="card-title-v107">
                  <h3>${escapeHtml(card.card_name || card.name || "Tarjeta")}</h3>
                  <p>${escapeHtml(bank)} · ${escapeHtml(usageType)}</p>
                </div>
                <div class="card-badges-v107">
                  <span class="rate-pill-v107">${escapeHtml(catOrRate)}</span>
                  <span id="risk-display-${cardId}">${badgeRisk(riskLevel)}</span>
                </div>
              </div>

              <div class="metric-box-v107 debt-box-v107">
                <span>Saldo usado</span>
                <strong>${money(metrics.balance)}</strong>
              </div>

              <div class="metric-box-v107 limit-box-v107">
                <span>Límite crédito</span>
                <strong>${displayMoneyOrPending(metrics.creditLimit, "Sin límite")}</strong>
              </div>

              <label class="metric-box-v107 minimum-box-v107">
                <span>Mínimo a pagar</span>
                <input
                  class="money-input warning"
                  type="number"
                  min="0"
                  step="1"
                  id="min-${cardId}"
                  value="${minimumValue}"
                  placeholder="Mínimo"
                />
              </label>

              <div class="metric-box-v107 available-box-v107">
                <span>Disponible</span>
                <strong class="computed-money-v107${availableNegativeClass}">${availableText}</strong>
              </div>

              <div class="metric-box-v107 usage-box-v107">
                <div class="usage-top-v107">
                  <span>% uso</span>
                  <b class="usage-pill ${usageClass}">${percentText(metrics.usagePercentage)}</b>
                </div>
                <div class="usage-progress-v107" aria-hidden="true">
                  <div class="usage-progress-fill ${usageClass}" style="width: ${usageProgressWidth(metrics.usagePercentage)}%"></div>
                </div>
              </div>

              <div class="action-box-v107">
                <button class="save-card-btn" type="button" data-card-id="${cardId}">Guardar mínimo</button>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;

  wireCardsBoardEvents(el);
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
