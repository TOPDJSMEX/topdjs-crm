// =======================================================
// TopDJs Finanzas CRM v1.0.11
// Layout limpio + tarjetas con cortes reales
// Regla: mínimo y pago para no generar intereses se capturan
// únicamente a partir de un día después de la fecha de corte.
// =======================================================

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CARD_LIMITS = {
  "NU": 140000,
  "BBVA VANE": 180000,
  "BBVA MANUEL": 77900,
  "LIVERPOOL VISA": 50000,
  "LIVERPOOL DEPARTAMENTAL": 25000,
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

function plainNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number)) : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function firstValue(object, keys, fallback = null) {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null) {
      return object[key];
    }
  }
  return fallback;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function normalizeCardName(card) {
  return String(firstValue(card, ["card_name", "name"], ""))
    .trim()
    .toUpperCase();
}

function getCreditLimit(card) {
  const name = normalizeCardName(card);
  return getNumber(firstValue(card, ["credit_limit"], CARD_LIMITS[name] || 0));
}

function getBalance(card) {
  return getNumber(firstValue(card, ["balance", "current_balance", "saldo"], 0));
}

function getMinimumPayment(card) {
  return firstValue(card, ["minimum_payment"], null);
}

function getNoInterestPayment(card) {
  return firstValue(card, ["no_interest_payment", "payment_no_interest"], null);
}

function getBank(card) {
  return firstValue(card, ["bank", "bank_name", "issuer"], "-");
}

function getCardType(card) {
  return firstValue(card, ["card_type", "usage_type"], "Mixta");
}

function getCatRate(card) {
  return firstValue(card, ["cat_rate", "cat", "interest_rate"], null);
}

function cutoffDay(card) {
  return getNumber(firstValue(card, ["cutoff_day", "cut_day"], 0));
}

function dueDay(card) {
  return getNumber(firstValue(card, ["payment_due_day", "due_day"], 0));
}

function dueNextMonth(card) {
  const value = firstValue(card, ["payment_due_next_month", "due_next_month"], false);
  return value === true || value === "true";
}

function canEditAfterCutoff(card, today = new Date()) {
  const cut = cutoffDay(card);
  if (!cut) return false;

  // Regla solicitada por Charly:
  // se habilita un día después del corte.
  // Ejemplo: corte 04 => editable desde día 05.
  return today.getDate() > cut;
}

function editAvailableDay(card) {
  const cut = cutoffDay(card);
  if (!cut) return "Pendiente";
  return `Día ${String(cut + 1).padStart(2, "0")}`;
}

function dueDateLabel(card) {
  const day = dueDay(card);
  if (!day) return "Pendiente";

  return `Día ${String(day).padStart(2, "0")}${
    dueNextMonth(card) ? " del mes siguiente" : ""
  }`;
}

function cutoffLabel(card) {
  const cut = cutoffDay(card);
  return cut ? `Día ${String(cut).padStart(2, "0")}` : "Pendiente";
}

function getCardMetrics(card) {
  const balance = getBalance(card);
  const creditLimit = getCreditLimit(card);
  const available = Math.max(creditLimit - balance, 0);
  const usage = creditLimit > 0 ? Math.min((balance / creditLimit) * 100, 999) : null;

  return {
    balance,
    creditLimit,
    available,
    usage,
  };
}

function riskLevel(card) {
  const { balance, usage } = getCardMetrics(card);
  const cat = getNumber(getCatRate(card), 0);

  if (cat >= 100 || usage >= 90 || balance >= 80000) return "critical";
  if (cat >= 60 || usage >= 70 || balance >= 30000) return "high";
  if (cat >= 25 || usage >= 40) return "medium";
  return "low";
}

function riskLabel(level) {
  const map = {
    critical: "Crítico",
    high: "Alto",
    medium: "Medio",
    low: "Bajo",
  };

  return map[level] || level;
}

function riskBadge(card) {
  const level = riskLevel(card);
  return `<span class="risk-badge ${level}">${riskLabel(level)}</span>`;
}

function catBadge(card) {
  const cat = getCatRate(card);
  if (cat === null || cat === undefined || cat === "") return "";
  return `<span class="cat-badge">CAT ${Number(cat).toFixed(1)}%</span>`;
}

function usageClass(usage) {
  if (usage === null || usage === undefined) return "unknown";
  if (usage >= 90) return "danger";
  if (usage >= 70) return "warning";
  if (usage >= 40) return "medium";
  return "safe";
}

function usageText(usage) {
  if (usage === null || usage === undefined || Number.isNaN(Number(usage))) {
    return "Pendiente";
  }
  return `${Number(usage).toFixed(1)}%`;
}

function readMoneyInput(id) {
  const input = document.getElementById(id);
  if (!input || input.value === "") return null;
  const number = Number(input.value);
  return Number.isFinite(number) ? number : null;
}

function countMondaysInCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  let mondays = 0;
  const cursor = new Date(year, month, 1);

  while (cursor.getMonth() === month) {
    if (cursor.getDay() === 1) mondays++;
    cursor.setDate(cursor.getDate() + 1);
  }

  return mondays;
}

function renderAccounts(accounts) {
  const el = document.getElementById("accountsList");
  if (!el) return;

  if (!accounts || !accounts.length) {
    el.innerHTML = `<div class="empty-state">No hay cuentas registradas.</div>`;
    return;
  }

  el.innerHTML = `
    <div class="responsive-table">
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
            .map((account) => `
              <tr>
                <td><strong>${escapeHtml(account.name || "-")}</strong></td>
                <td>${escapeHtml(account.type || "-")}</td>
                <td class="amount">${money(account.current_balance)}</td>
                <td>${escapeHtml(account.notes || "")}</td>
              </tr>
            `)
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPaymentInput(card, field, value, enabled, label) {
  const id = `${field}-${escapeHtml(card.id)}`;
  const disabledAttr = enabled ? "" : "disabled";
  const lockedText = enabled ? "Editable" : `Editable desde ${editAvailableDay(card)}`;

  return `
    <div class="card-field payment-field ${enabled ? "editable" : "locked"}">
      <span>${label}</span>
      <input
        id="${id}"
        class="money-input ${field === "min" ? "warning" : "positive"}"
        type="number"
        min="0"
        step="1"
        value="${plainNumber(value)}"
        placeholder="${enabled ? "Capturar" : "Bloqueado"}"
        ${disabledAttr}
      />
      <small>${escapeHtml(lockedText)}</small>
    </div>
  `;
}

function renderCards(cards) {
  const el = document.getElementById("cardsList");
  if (!el) return;

  if (!cards || !cards.length) {
    el.innerHTML = `<div class="empty-state">No hay tarjetas registradas.</div>`;
    return;
  }

  const sortedCards = [...cards].sort((a, b) => {
    const pa = getNumber(a.priority, 999);
    const pb = getNumber(b.priority, 999);
    if (pa !== pb) return pa - pb;
    return getBalance(b) - getBalance(a);
  });

  el.innerHTML = `
    <div class="finance-card-list">
      ${sortedCards
        .map((card, index) => {
          const metrics = getCardMetrics(card);
          const priority = firstValue(card, ["priority"], index + 1);
          const canEdit = canEditAfterCutoff(card);
          const usage = metrics.usage;
          const uClass = usageClass(usage);
          const payFrom = firstValue(card, ["paid_from_account", "pay_from"], "Flexible");
          const usageNotes = firstValue(
            card,
            ["usage_notes", "usage_label"],
            "TopDJs / Mixta / Personal usada para TopDJs"
          );

          return `
            <article class="finance-card risk-${riskLevel(card)}">
              <div class="finance-card-top">
                <div class="card-title-block">
                  <span class="priority-pill">#${escapeHtml(priority)}</span>
                  <div>
                    <h3>${escapeHtml(firstValue(card, ["card_name", "name"], "Tarjeta"))}</h3>
                    <p>${escapeHtml(getBank(card))} · ${escapeHtml(getCardType(card))}</p>
                  </div>
                </div>

                <div class="card-badges">
                  ${catBadge(card)}
                  ${riskBadge(card)}
                </div>
              </div>

              <div class="card-data-grid">
                <div class="card-field featured danger">
                  <span>Saldo usado</span>
                  <strong>${money(metrics.balance)}</strong>
                </div>

                <div class="card-field">
                  <span>Límite crédito</span>
                  <strong>${money(metrics.creditLimit)}</strong>
                  <small>Fijo</small>
                </div>

                <div class="card-field positive">
                  <span>Disponible calculado</span>
                  <strong>${money(metrics.available)}</strong>
                  <small>Límite - saldo usado</small>
                </div>

                <div class="card-field">
                  <span>% uso</span>
                  <strong>${usageText(usage)}</strong>
                  <div class="usage-bar ${uClass}">
                    <i style="width:${Math.max(0, Math.min(100, usage || 0))}%"></i>
                  </div>
                </div>

                ${renderPaymentInput(
                  card,
                  "min",
                  getMinimumPayment(card),
                  canEdit,
                  "Mínimo a pagar"
                )}

                ${renderPaymentInput(
                  card,
                  "nointerest",
                  getNoInterestPayment(card),
                  canEdit,
                  "No generar intereses"
                )}

                <div class="card-field">
                  <span>Fecha corte</span>
                  <strong>${cutoffLabel(card)}</strong>
                  <small>Captura desde ${escapeHtml(editAvailableDay(card))}</small>
                </div>

                <div class="card-field">
                  <span>Fecha límite pago</span>
                  <strong>${escapeHtml(dueDateLabel(card))}</strong>
                </div>

                <div class="card-field">
                  <span>Se paga desde</span>
                  <strong>${escapeHtml(payFrom)}</strong>
                  <small>${escapeHtml(usageNotes)}</small>
                </div>
              </div>

              <div class="finance-card-actions">
                <p>
                  ${canEdit
                    ? "Ya puedes capturar el mínimo y el pago para no generar intereses de este ciclo."
                    : `Se habilita un día después del corte: ${escapeHtml(editAvailableDay(card))}.`}
                </p>

                <button
                  type="button"
                  onclick="updateCardPayments('${escapeHtml(card.id)}')"
                  ${canEdit ? "" : "disabled"}
                >
                  Guardar pagos
                </button>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
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
    <div class="responsive-table">
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
              const frequency = expense.frequency === "weekly" ? "Semanal" : "Mensual";
              const day =
                expense.frequency === "weekly" ? "Lunes" : `Día ${expense.due_day || "-"}`;

              return `
                <tr>
                  <td><strong>${escapeHtml(expense.name || "-")}</strong></td>
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
    </div>
  `;
}

function accountBalance(accounts, name) {
  const normalized = name.toLowerCase();
  const found = (accounts || []).find((account) =>
    String(account.name || "").toLowerCase().includes(normalized)
  );
  return getNumber(found?.current_balance, 0);
}

function calculateDashboard(accounts, cards, expenses) {
  const liquidity = (accounts || []).reduce(
    (sum, account) => sum + getNumber(account.current_balance, 0),
    0
  );

  const monthlyFixed = (expenses || [])
    .filter((expense) => expense.frequency !== "weekly")
    .reduce((sum, expense) => sum + getNumber(expense.amount, 0), 0);

  const weeklyPayroll = (expenses || [])
    .filter((expense) => expense.frequency === "weekly")
    .reduce((sum, expense) => sum + getNumber(expense.amount, 0), 0);

  const totalCards = (cards || []).reduce(
    (sum, card) => sum + getBalance(card),
    0
  );

  const knownMinimums = (cards || []).reduce(
    (sum, card) => sum + getNumber(getMinimumPayment(card), 0),
    0
  );

  const noInterestTotal = (cards || []).reduce(
    (sum, card) => sum + getNumber(getNoInterestPayment(card), 0),
    0
  );

  return {
    liquidity,
    bbva: accountBalance(accounts, "BBVA"),
    nu: accountBalance(accounts, "NU"),
    manuel: accountBalance(accounts, "Manuel"),
    efectivo: accountBalance(accounts, "Efectivo"),
    monthlyFixed,
    weeklyPayroll,
    totalCards,
    knownMinimums,
    noInterestTotal,
  };
}

function updateDashboard(totals, cards) {
  setText("totalLiquidity", money(totals.liquidity));
  setText("balanceBbva", money(totals.bbva));
  setText("balanceNu", money(totals.nu));
  setText("balanceManuel", money(totals.manuel));
  setText("balanceEfectivo", money(totals.efectivo));
  setText("monthlyFixed", money(totals.monthlyFixed));
  setText("weeklyPayroll", money(totals.weeklyPayroll));
  setText("totalCards", money(totals.totalCards));
  setText("knownMinimums", money(totals.knownMinimums));
  setText("noInterestTotal", money(totals.noInterestTotal));

  const pendingMinimums = (cards || []).filter(
    (card) => getMinimumPayment(card) === null || getMinimumPayment(card) === undefined
  ).length;

  const alert = document.getElementById("mainAlert");
  if (!alert) return;

  const monthNeed =
    totals.monthlyFixed +
    totals.weeklyPayroll * countMondaysInCurrentMonth() +
    totals.knownMinimums;

  const deficit = monthNeed - totals.liquidity;
  alert.classList.remove("green", "red");

  if (deficit > 0) {
    alert.classList.add("red");
    alert.innerHTML = `
      🚨 Déficit estimado del mes:
      <strong>${money(deficit)}</strong>.
      Necesario con gastos fijos, nómina y mínimos conocidos:
      <strong>${money(monthNeed)}</strong>.
      Liquidez actual: <strong>${money(totals.liquidity)}</strong>.
      ${pendingMinimums ? `<br><small>Falta capturar ${pendingMinimums} mínimo pendiente.</small>` : ""}
    `;
  } else {
    alert.classList.add("green");
    alert.innerHTML = `
      ✅ Mes cubierto con la liquidez actual.
      Sobrante estimado: <strong>${money(Math.abs(deficit))}</strong>.
      ${pendingMinimums ? `<br><small>Hay ${pendingMinimums} mínimo pendiente por capturar cuando se habilite.</small>` : ""}
    `;
  }
}

async function loadFinance() {
  const alert = document.getElementById("mainAlert");
  if (alert) {
    alert.classList.remove("green", "red");
    alert.textContent = "Cargando estado financiero...";
  }

  try {
    const [accountsRes, cardsRes, expensesRes] = await Promise.all([
      db
        .from("finance_accounts")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true }),

      db
        .from("finance_credit_card_priority")
        .select("*"),

      db
        .from("finance_fixed_expenses")
        .select("*")
        .eq("is_active", true)
        .order("frequency", { ascending: true })
        .order("due_day", { ascending: true }),
    ]);

    if (accountsRes.error) throw accountsRes.error;
    if (cardsRes.error) throw cardsRes.error;
    if (expensesRes.error) throw expensesRes.error;

    const accounts = accountsRes.data || [];
    const cards = cardsRes.data || [];
    const expenses = expensesRes.data || [];

    renderAccounts(accounts);
    renderCards(cards);
    renderExpenses(expenses);

    const totals = calculateDashboard(accounts, cards, expenses);
    updateDashboard(totals, cards);
  } catch (error) {
    console.error("Error cargando TopDJs Finanzas:", error);

    if (alert) {
      alert.classList.add("red");
      alert.innerHTML = `
        Error cargando TopDJs Finanzas.
        <br><small>${escapeHtml(error.message || error)}</small>
      `;
    }
  }
}

async function updateCardPayments(cardId) {
  const minInput = document.getElementById(`min-${cardId}`);
  const cardArticle = minInput?.closest(".finance-card");

  const minValue = readMoneyInput(`min-${cardId}`);
  const noInterestValue = readMoneyInput(`nointerest-${cardId}`);

  const payload = {
    minimum_payment: minValue,
    minimum_payment_status: minValue === null ? "pending_app" : "known",
    no_interest_payment: noInterestValue,
    no_interest_payment_status: noInterestValue === null ? "pending_app" : "known",
  };

  const button = cardArticle?.querySelector("button");
  if (button) {
    button.disabled = true;
    button.textContent = "Guardando...";
  }

  const { error } = await db
    .from("finance_credit_cards")
    .update(payload)
    .eq("id", cardId);

  if (error) {
    alert("No se pudo guardar la tarjeta: " + error.message);
    if (button) {
      button.disabled = false;
      button.textContent = "Guardar pagos";
    }
    return;
  }

  await loadFinance();
}

window.loadFinance = loadFinance;
window.updateCardPayments = updateCardPayments;

document.addEventListener("DOMContentLoaded", loadFinance);
