import { useMemo } from 'react'
import { useSessionState } from './application/session-state'
import { useIntakeSolve } from './application/intake-orchestration'
import { StaticCatalogRepository } from './infrastructure/catalog/catalog-repository-impl'
import { DimensionForm } from './presentation/intake/DimensionForm'
import { BudgetSlider } from './presentation/intake/BudgetSlider'
import { ThemeSelector } from './presentation/intake/ThemeSelector'

function App() {
  const [session, patchSession] = useSessionState()
  // Composition root: the concrete Infrastructure implementation is
  // constructed here, in Presentation, and injected into the Application
  // hook as the CatalogRepository interface — Application never imports
  // the concrete class itself.
  const repository = useMemo(() => new StaticCatalogRepository(), [])
  const solve = useIntakeSolve(session, repository)

  return (
    <div style={{ padding: 40, maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <h1 style={{ fontFamily: 'system-ui', fontSize: 22 }}>Bath Planner</h1>

      <DimensionForm value={session.room} onChange={(room) => patchSession({ room })} />
      <BudgetSlider valueCents={session.budgetCents} onChange={(budgetCents) => patchSession({ budgetCents })} />
      <ThemeSelector value={session.theme} onChange={(theme) => patchSession({ theme })} />

      <div style={{ fontFamily: 'system-ui', fontSize: 14, borderTop: '1px solid #d3dbd6', paddingTop: 16 }}>
        {solve.status === 'loading-catalog' && <p>Loading catalog…</p>}
        {solve.status === 'catalog-error' && <p>Couldn't load the catalog.</p>}
        {solve.status === 'no-preset-theme' && <p>Pick a preset style to see bundles (custom styles aren't matched to products yet).</p>}
        {solve.status === 'solving' && <p>Solving…</p>}
        {solve.status === 'infeasible' && solve.infeasibleReason === 'over-budget' && (
          <p>
            Even the cheapest bundle costs ${((solve.cheapestPossibleCents ?? 0) / 100).toLocaleString()} —
            over budget. Try raising it.
          </p>
        )}
        {solve.status === 'infeasible' && solve.infeasibleReason === 'no-eligible-options' && (
          <p>
            {solve.issues && solve.issues.length > 0
              ? solve.issues.map((issue) => issue.message).join(' ')
              : "No products fit this room's constraints."}{' '}
            Try adjusting the room dimensions or removing a style constraint — no budget change will fix this.
          </p>
        )}
        {solve.status === 'infeasible' && solve.infeasibleReason === 'missing-plumbing-point' && (
          <p>Add a plumbing point for the toilet, vanity, and shower to see bundle options.</p>
        )}
        {solve.status === 'solved' && solve.tiers && (
          <ul>
            {solve.tiers.map((bundle) => (
              <li key={bundle.id}>
                {bundle.tier}: ${(bundle.totalPriceCents / 100).toLocaleString()}
                {bundle.warnings.length > 0 && ` (${bundle.warnings.length} warning${bundle.warnings.length > 1 ? 's' : ''})`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default App
