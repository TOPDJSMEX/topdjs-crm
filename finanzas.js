// =======================================================
// TOPDJS FINANZAS CRM v1.0
// Frontend MVP
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

  return `<span class="badge ${normalized}">${labelMap[normalized] || level}</span>`;
}

function renderAccounts(accounts) {
  const el = document.getElementById("accountsList");

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
              <td><strong>${account.name}</strong></td>
              <td>${account.type || "-"}</td>
              <td class="amount">${money(account.current_balance)}</td>
              <td>${account.notes || ""}</td>
            </tr>
          `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderCards(cards) {
  const el = document.getElementById("cardsList");

  if (!cards || !cards.length) {
    el.innerHTML = `<div class="empty-state">No hay tarjetas registradas.</div>`;
    return;
  }

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Prioridad</th>
          <th>Tarjeta</th>
          <th>Saldo</th>
          <th>Mínimo</th>
          <th>CAT / Tasa</th>
          <th>Riesgo</th>
        </tr>
      </thead>
      <tbody>
        ${cards
          .map((card) => {
            const catOrRate = card.cat
              ? `CAT ${card.cat}%`
              : card.interest_rate
              ? `${card.interest_rate}%`
              : "-";

            const minimum =
              card.minimum_payment_status === "pending_app"
                ? "Pendiente"
                : money(card.minimum_payment);

            return `
              <tr>
                <td>${card.priority || "-"}</td>
                <td>
                  <strong>${card.card_name}</strong><br>
                  <small>${card.bank} · ${card.usage_type || "Mixta"}</small>
                </td>
                <td class="amount">${money(card.current_balance)}</td>
                <td class="amount">${minimum}</td>
                <td>${catOrRate}</td>
                <td>${badgeRisk(card.risk_level)}</td>
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
                <td><strong>${expense.name}</strong></td>
                <td class="amount">${money(expense.amount)}</td>
                <td>${frequency}</td>
                <td>${day}</td>
                <td>${expense.suggested_account || "Flexible"}</td>
                <td>${expense.category || "-"}</td>
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
        <br><small>${error.message || error}</small>
      `;
    }
  }
}

document.addEventListener("DOMContentLoaded", loadFinance);
