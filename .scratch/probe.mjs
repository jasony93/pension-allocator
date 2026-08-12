import { compute } from '../src/engine/index.mjs';
import { loadRulesets, baseRequest } from '../src/engine/test-helpers.mjs';
const rulesets = loadRulesets();
for (const salary of [34143911, 34142000, 34143912, 30686275, 34146000]) {
  const r = compute(baseRequest({ profile: { current_year_total_salary_krw: salary, monthly_capacity_krw: 750000, birth_date: '1986-06-15' } }), rulesets);
  const s = r.scenarios[0];
  const c = s.pension_credit_tax_liability_cap;
  const p = s.plans.find((x) => x.plan_id === 'max_tax_credit') ?? s.plans[0];
  const b = p.deterministic_benefit;
  console.log(salary, JSON.stringify({
    ded: c.wage_income_deduction_krw, wage: c.wage_income_amount_krw, base: c.tax_base_krw,
    tax: c.computed_tax_krw, credit: c.wage_income_credit_krw, cap: c.cap_krw,
    applied: b.tax_liability_cap.applied, binding: b.tax_liability_cap.binding_code,
    inc: b.pension_credit_income_tax_krw, loc: b.pension_credit_local_tax_krw, tot: b.pension_credit_total_krw,
    before: b.pension_credit_income_tax_before_cap_krw,
    reduced: b.tax_liability_cap.reduced_income_tax_krw,
    plan: p.plan_id, ceil: s.pension_credit_ceiling.tax_liability_cap_relation_code,
  }));
}
