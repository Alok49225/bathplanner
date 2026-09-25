import { useEffect, useMemo, useState } from 'react'
import { useSessionState } from './application/session-state'
import { useIntakeSolve } from './application/intake-orchestration'
import { useChatSolve } from './application/chat-orchestration'
import { StaticCatalogRepository } from './infrastructure/catalog/catalog-repository-impl'
import { DimensionForm } from './presentation/intake/DimensionForm'
import { BudgetSlider } from './presentation/intake/BudgetSlider'
import { ThemeSelector } from './presentation/intake/ThemeSelector'
import { SolveStatusPanel } from './presentation/intake/SolveStatusPanel'
import { TierSwitcher } from './presentation/viz/TierSwitcher'
import { FloorPlan } from './presentation/viz/FloorPlan'
import { FixtureLayer } from './presentation/viz/FixtureLayer'
import { BundleSummary } from './presentation/output/BundleSummary'
import { ProductPicker } from './presentation/output/ProductPicker'
import { ChatPanel } from './presentation/chat/ChatPanel'
import type { Product, ProductCategory } from './domain/types/product'
import type { BundleTier } from './domain/types/bundle'
import { filterEligibleProducts } from './domain/engine/compatibility-rules'
import './App.css'

function App() {
  const [session, patchSession] = useSessionState()
  // Composition root: the concrete Infrastructure implementation is
  // constructed here, in Presentation, and injected into the Application
  // hook as the CatalogRepository interface — Application never imports
  // the concrete class itself.
  const repository = useMemo(() => new StaticCatalogRepository(), [])
  const solve = useIntakeSolve(session, repository)

  // useIntakeSolve loads its own catalog internally but never exposes it,
  // and BundleSummary/FixtureLayer both need one — same small, deliberate
  // duplication chat-orchestration.ts already accepted rather than
  // refactoring that already-tested hook's return shape.
  const [catalog, setCatalog] = useState<Product[] | null>(null)
  useEffect(() => {
    let cancelled = false
    repository.getAll().then((products) => {
      if (!cancelled) setCatalog(products)
    })
    return () => {
      cancelled = true
    }
  }, [repository])

  const [selectedTier, setSelectedTier] = useState<BundleTier>('balanced')
  const chat = useChatSolve({ session, patchSession, repository, solve, selectedTier })

  const solvedTiers = solve.status === 'solved' ? solve.tiers : undefined
  const autoBundle = solvedTiers?.find((b) => b.tier === selectedTier)
  // Chat's pinned result overrides the auto-solved bundle only while it's
  // for the tier currently being viewed — chat-orchestration.ts clears it
  // whenever a fresh solve makes it stale.
  const displayedBundle =
    chat.pinnedBundle && chat.pinnedBundle.tier === selectedTier ? chat.pinnedBundle : autoBundle

  // Which category's product picker is open, if any — set by BundleSummary's
  // Change button, cleared on close or once a selection is made.
  const [pickerCategory, setPickerCategory] = useState<ProductCategory | null>(null)
  // Same inline RoomDimensions -> Room conversion FixtureLayer.tsx and
  // PlumbingPointList.tsx already use for the same reason (accessibility/
  // constraints don't affect eligibility here either) — only computed while
  // a picker is actually open, not on every render.
  const pickerEligible =
    pickerCategory && catalog
      ? filterEligibleProducts(catalog, { ...session.room, accessibility: {}, constraints: [] }).eligible[
          pickerCategory
        ]
      : null

  return (
    <div className="app-shell">
      <h1 className="app-title">Bath Planner</h1>
      <div className="app-columns">
        <div className="app-main">
          <DimensionForm value={session.room} onChange={(room) => patchSession({ room })} catalog={catalog} />
          <BudgetSlider valueCents={session.budgetCents} onChange={(budgetCents) => patchSession({ budgetCents })} />
          <ThemeSelector value={session.theme} onChange={(theme) => patchSession({ theme })} />

          <SolveStatusPanel solve={solve} />

          {solvedTiers && displayedBundle && catalog && (
            <>
              <TierSwitcher tiers={solvedTiers} selectedTier={selectedTier} onChange={setSelectedTier} />
              <div className="app-plan-stack">
                <FloorPlan room={session.room} showLegend={false} />
                <FixtureLayer bundle={displayedBundle} catalog={catalog} room={session.room} />
              </div>
              <BundleSummary bundle={displayedBundle} catalog={catalog} onChangeCategory={setPickerCategory} />
            </>
          )}
        </div>

        <div className="app-chat">
          <ChatPanel messages={chat.messages} onSend={chat.sendMessage} />
        </div>
      </div>

      {pickerCategory && pickerEligible && displayedBundle && (
        <ProductPicker
          category={pickerCategory}
          products={pickerEligible}
          selectedProductId={displayedBundle.items[pickerCategory]?.productId ?? ''}
          onSelect={(productId) => {
            void chat.selectProduct(pickerCategory, productId)
            setPickerCategory(null)
          }}
          onClose={() => setPickerCategory(null)}
        />
      )}
    </div>
  )
}

export default App
