import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createAdminCatalog,
  fetchAdminCatalog,
  fetchAdminCatalogProductAttributes,
  fetchAdminCatalogProducts,
  fetchAdminCatalogTree,
  downloadAdminCsv,
  importAdminCatalogCsv,
  importAdminSubscriptionsCsv,
  importAdminSupplierOffersCsv,
  setAdminCatalogAttributeMandatory,
  updateAdminCatalog,
  type AdminCatalogNode,
  type AdminCatalogProductEntry,
  type CatalogCsvImportMode,
  type CatalogCsvImportResult,
  type CatalogProductAttribute,
  type SubscriptionsCsvImportResult,
  type SupplierOffersCsvImportResult,
} from '../../api/admin'
import { AdminTopBar } from './AdminDashboardPage'
import { CsvDropzone, CsvErrorList, CsvModeField } from './AdminCsvImportPanel'
import './Admin.css'

type PanelMode = 'empty' | 'edit' | 'create-root' | 'create-child'

function nodeMatches(node: AdminCatalogNode, q: string): boolean {
  const hay = `${node.name ?? ''} ${node.description ?? ''}`.toLowerCase()
  return hay.includes(q)
}

function filterTree(nodes: AdminCatalogNode[], q: string): AdminCatalogNode[] {
  if (!q) return nodes
  const result: AdminCatalogNode[] = []
  for (const node of nodes) {
    const filteredChildren = filterTree(node.children, q)
    if (nodeMatches(node, q) || filteredChildren.length > 0) {
      result.push({ ...node, children: filteredChildren })
    }
  }
  return result
}

function collectExpandIds(nodes: AdminCatalogNode[], q: string, acc: Set<number>): void {
  for (const node of nodes) {
    if (node.children.length) {
      collectExpandIds(node.children, q, acc)
      if (q && (nodeMatches(node, q) || node.children.some((c) => acc.has(c.id)))) {
        acc.add(node.id)
      }
    }
  }
}

function TreeNode({
  node,
  depth,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
}: {
  node: AdminCatalogNode
  depth: number
  selectedId: number | null
  expandedIds: Set<number>
  onSelect: (id: number) => void
  onToggle: (id: number) => void
}) {
  const hasChildren = node.children.length > 0
  const expanded = expandedIds.has(node.id)
  const selected = selectedId === node.id

  return (
    <li className="admin-tree__item">
      <div
        className={`admin-tree__row ${selected ? 'is-selected' : ''}`}
        style={{ paddingLeft: `${depth * 1.1 + 0.5}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="admin-tree__toggle"
            aria-label={expanded ? 'Replier' : 'Déplier'}
            onClick={() => onToggle(node.id)}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="admin-tree__toggle admin-tree__toggle--spacer" />
        )}
        <button type="button" className="admin-tree__label" onClick={() => onSelect(node.id)}>
          <span className="admin-tree__name">{node.name ?? `Catalogue #${node.id}`}</span>
          {!node.is_active ? <span className="admin-tree__badge">Inactif</span> : null}
          {node.product_count > 0 ? (
            <span className="admin-tree__meta">{node.product_count} prod.</span>
          ) : null}
        </button>
      </div>
      {hasChildren && expanded ? (
        <ul className="admin-tree__children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function AdminCatalogPage() {
  const [roots, setRoots] = useState<AdminCatalogNode[]>([])
  const [total, setTotal] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<PanelMode>('empty')
  const [createParentId, setCreateParentId] = useState<number | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<string[]>([])
  const [childCount, setChildCount] = useState(0)
  const [productCount, setProductCount] = useState(0)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [productAttrs, setProductAttrs] = useState<CatalogProductAttribute[]>([])
  const [attrsLoading, setAttrsLoading] = useState(false)
  const [togglingAttr, setTogglingAttr] = useState<string | null>(null)

  const [catalogProducts, setCatalogProducts] = useState<AdminCatalogProductEntry[]>([])
  const [productsLoading, setProductsLoading] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [adminMode, setAdminMode] = useState<CatalogCsvImportMode>('additive')
  const [adminFile, setAdminFile] = useState<File | null>(null)
  const [adminImporting, setAdminImporting] = useState(false)
  const [adminResult, setAdminResult] = useState<CatalogCsvImportResult | null>(null)
  const [offersMode, setOffersMode] = useState<CatalogCsvImportMode>('additive')
  const [offersFile, setOffersFile] = useState<File | null>(null)
  const [offersImporting, setOffersImporting] = useState(false)
  const [offersResult, setOffersResult] = useState<SupplierOffersCsvImportResult | null>(null)
  const [subsMode, setSubsMode] = useState<CatalogCsvImportMode>('additive')
  const [subsFile, setSubsFile] = useState<File | null>(null)
  const [subsImporting, setSubsImporting] = useState(false)
  const [subsResult, setSubsResult] = useState<SubscriptionsCsvImportResult | null>(null)
  const [offersExporting, setOffersExporting] = useState(false)
  const [subsExporting, setSubsExporting] = useState(false)

  const q = search.trim().toLowerCase()
  const displayTree = useMemo(() => filterTree(roots, q), [roots, q])

  const reloadTree = useCallback(async () => {
    const data = await fetchAdminCatalogTree()
    setRoots(data.roots)
    setTotal(data.total)
  }, [])

  useEffect(() => {
    reloadTree()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [reloadTree])

  useEffect(() => {
    if (!q) return
    const expanded = new Set<number>()
    collectExpandIds(roots, q, expanded)
    setExpandedIds(expanded)
  }, [q, roots])

  async function loadCatalogProducts(id: number) {
    setProductsLoading(true)
    try {
      setCatalogProducts(await fetchAdminCatalogProducts(id))
    } catch {
      setCatalogProducts([])
    } finally {
      setProductsLoading(false)
    }
  }

  async function loadProductAttributes(id: number) {
    setAttrsLoading(true)
    try {
      setProductAttrs(await fetchAdminCatalogProductAttributes(id))
    } catch {
      setProductAttrs([])
    } finally {
      setAttrsLoading(false)
    }
  }

  async function loadDetail(id: number) {
    const detail = await fetchAdminCatalog(id)
    setSelectedId(id)
    setMode('edit')
    setName(detail.name ?? '')
    setDescription(detail.description ?? '')
    setIsActive(detail.is_active)
    setBreadcrumb(detail.breadcrumb)
    setChildCount(detail.child_count)
    setProductCount(detail.product_count)
    setCreateParentId(null)
    setError(null)
    void loadCatalogProducts(id)
    void loadProductAttributes(id)
  }

  function startCreateRoot() {
    setSelectedId(null)
    setMode('create-root')
    setCreateParentId(null)
    setName('')
    setDescription('')
    setIsActive(true)
    setProductAttrs([])
    setBreadcrumb([])
    setChildCount(0)
    setProductCount(0)
    setCatalogProducts([])
    setError(null)
    setSuccess(null)
  }

  function startCreateChild() {
    if (!selectedId) return
    setMode('create-child')
    setCreateParentId(selectedId)
    setName('')
    setDescription('')
    setIsActive(true)
    setProductAttrs([])
    setError(null)
    setSuccess(null)
  }

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleToggleMandatory(attr: CatalogProductAttribute) {
    if (!selectedId) return
    setTogglingAttr(attr.attribute_name)
    setError(null)
    try {
      const updated = await setAdminCatalogAttributeMandatory(
        selectedId,
        attr.attribute_name,
        !attr.is_mandatory,
      )
      setProductAttrs((list) =>
        list
          .map((a) => (a.attribute_name === attr.attribute_name ? updated : a))
          .sort((a, b) => a.attribute_name.localeCompare(b.attribute_name, 'fr')),
      )
      setSuccess(
        updated.is_mandatory
          ? `« ${updated.attribute_name} » rendu obligatoire.`
          : `« ${updated.attribute_name} » rendu facultatif.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setTogglingAttr(null)
    }
  }

  async function handleSave() {
    if (!name.trim() || !description.trim()) {
      setError('Nom et description sont obligatoires.')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        is_active: isActive,
      }
      if (mode === 'edit' && selectedId) {
        await updateAdminCatalog(selectedId, body)
        setSuccess('Catalogue mis à jour.')
        await reloadTree()
        await loadDetail(selectedId)
      } else if (mode === 'create-root') {
        const created = await createAdminCatalog(body)
        setSuccess('Catalogue racine créé.')
        await reloadTree()
        await loadDetail(created.id)
      } else if (mode === 'create-child' && createParentId) {
        const created = await createAdminCatalog({ ...body, parent_id: createParentId })
        setSuccess('Sous-catalogue créé.')
        setExpandedIds((prev) => new Set(prev).add(createParentId))
        await reloadTree()
        await loadDetail(created.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(next: boolean) {
    if (!selectedId || mode !== 'edit') return
    setIsActive(next)
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await updateAdminCatalog(selectedId, {
        name: name.trim(),
        description: description.trim(),
        is_active: next,
      })
      setSuccess(next ? 'Catalogue activé.' : 'Catalogue désactivé.')
      await reloadTree()
    } catch (e) {
      setIsActive(!next)
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdminImport() {
    if (!adminFile) return
    setAdminImporting(true)
    setError(null)
    setSuccess(null)
    setAdminResult(null)
    try {
      const result = await importAdminCatalogCsv({ file: adminFile, mode: adminMode })
      setAdminResult(result)
      setSuccess(
        `CSV_ADMIN : ${result.products_created} créés, ${result.products_updated} mis à jour, ${result.offers_written ?? 0} offres URBANIZE.`,
      )
      await reloadTree()
      if (selectedId) await loadDetail(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur import CSV_ADMIN')
    } finally {
      setAdminImporting(false)
    }
  }

  async function handleOffersImport() {
    if (!offersFile) return
    setOffersImporting(true)
    setError(null)
    setSuccess(null)
    setOffersResult(null)
    try {
      const result = await importAdminSupplierOffersCsv({ file: offersFile, mode: offersMode })
      setOffersResult(result)
      if (!result.applied) {
        setError(
          `CSV_FOURNISSEUR bloqué : ${result.errors.length} erreur(s). Rien n'a été écrit.`,
        )
        return
      }
      setSuccess(
        `CSV_FOURNISSEUR : ${result.offers_written} offres écrites, ${result.offers_unchanged} inchangées.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur import CSV_FOURNISSEUR')
    } finally {
      setOffersImporting(false)
    }
  }

  async function handleSubsImport() {
    if (!subsFile) return
    setSubsImporting(true)
    setError(null)
    setSuccess(null)
    setSubsResult(null)
    try {
      const result = await importAdminSubscriptionsCsv({ file: subsFile, mode: subsMode })
      setSubsResult(result)
      if (!result.applied) {
        setError(
          `CSV_ABONNEMENT bloqué : ${result.errors.length} erreur(s). Rien n'a été écrit.`,
        )
        return
      }
      setSuccess(
        `CSV_ABONNEMENT : ${result.subscriptions_created} créés, ${result.subscriptions_updated} mis à jour.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur import CSV_ABONNEMENT')
    } finally {
      setSubsImporting(false)
    }
  }

  async function handleOffersExport() {
    setOffersExporting(true)
    setError(null)
    try {
      await downloadAdminCsv('/api/v1/admin/supplier-offers/export-csv', 'CSV_FOURNISSEUR.csv')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur export CSV_FOURNISSEUR')
    } finally {
      setOffersExporting(false)
    }
  }

  async function handleSubsExport() {
    setSubsExporting(true)
    setError(null)
    try {
      await downloadAdminCsv('/api/v1/admin/subscriptions/export-csv', 'CSV_ABONNEMENT.csv')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur export CSV_ABONNEMENT')
    } finally {
      setSubsExporting(false)
    }
  }

  const panelTitle =
    mode === 'create-root'
      ? 'Nouveau catalogue racine'
      : mode === 'create-child'
        ? 'Nouveau sous-catalogue'
        : mode === 'edit'
          ? name || 'Catalogue'
          : 'Sélectionnez un catalogue'

  return (
    <div className="admin-page admin-page--catalog">
      <AdminTopBar title="Catalogues" />
      <div className="admin-catalog-import-bar">
        <button
          type="button"
          className="admin-btn admin-btn--soft"
          onClick={() => setImportOpen((v) => !v)}
        >
          {importOpen ? 'Fermer les imports CSV' : 'Imports CSV (admin / fournisseur / abonnement)'}
        </button>
        {importOpen ? (
          <div className="admin-csv-grid">
            <article className="admin-csv-import">
              <h3>CSV_ADMIN</h3>
              <p className="admin-catalog__hint">
                Arborescence, produits, attributs + offre URBANIZE (non abonné).
              </p>
              <CsvModeField
                name="admin-csv-mode"
                mode={adminMode}
                onChange={setAdminMode}
                destructiveHint="vide les catalogues cibles du fichier"
              />
              <CsvDropzone
                file={adminFile}
                onFile={(f) => {
                  setAdminFile(f)
                  setAdminResult(null)
                }}
              />
              <div className="admin-csv-import__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={adminImporting || !adminFile}
                  onClick={() => void handleAdminImport()}
                >
                  {adminImporting ? 'Import en cours…' : 'Importer CSV_ADMIN'}
                </button>
                {adminResult ? (
                  <p className="admin-catalog__hint">
                    {adminResult.rows_processed} lignes · {adminResult.offers_written ?? 0} offres
                    {adminResult.catalogs_cleared > 0
                      ? ` · ${adminResult.catalogs_cleared} catalogues vidés`
                      : ''}
                  </p>
                ) : null}
              </div>
              {adminResult ? (
                <CsvErrorList label="Avertissements" items={adminResult.errors} />
              ) : null}
            </article>

            <article className="admin-csv-import">
              <h3>CSV_FOURNISSEUR</h3>
              <p className="admin-catalog__hint">
                1 ligne = 1 produit + 1 fournisseur. Bloqué si un fournisseur est inconnu.
              </p>
              <CsvModeField
                name="offers-csv-mode"
                mode={offersMode}
                onChange={setOffersMode}
                destructiveHint="purge l’historique d’offres des fournisseurs du fichier"
              />
              <CsvDropzone
                file={offersFile}
                onFile={(f) => {
                  setOffersFile(f)
                  setOffersResult(null)
                }}
              />
              <div className="admin-csv-import__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={offersImporting || !offersFile}
                  onClick={() => void handleOffersImport()}
                >
                  {offersImporting ? 'Import en cours…' : 'Importer CSV_FOURNISSEUR'}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--soft"
                  disabled={offersExporting}
                  onClick={() => void handleOffersExport()}
                >
                  {offersExporting ? 'Export…' : 'Exporter'}
                </button>
                {offersResult ? (
                  <p className="admin-catalog__hint">
                    {offersResult.applied ? 'Écrit' : 'Bloqué'} · {offersResult.rows_processed} lignes
                    {offersResult.offers_deleted > 0
                      ? ` · ${offersResult.offers_deleted} historiques purgés`
                      : ''}
                  </p>
                ) : null}
              </div>
              {offersResult ? <CsvErrorList items={offersResult.errors} /> : null}
            </article>

            <article className="admin-csv-import">
              <h3>CSV_ABONNEMENT</h3>
              <p className="admin-catalog__hint">
                Fournisseur + statut. URBANIZE reste toujours non abonné.
              </p>
              <CsvModeField
                name="subs-csv-mode"
                mode={subsMode}
                onChange={setSubsMode}
                destructiveHint="vide la table puis réécrit les paires du fichier"
              />
              <CsvDropzone
                file={subsFile}
                onFile={(f) => {
                  setSubsFile(f)
                  setSubsResult(null)
                }}
              />
              <div className="admin-csv-import__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={subsImporting || !subsFile}
                  onClick={() => void handleSubsImport()}
                >
                  {subsImporting ? 'Import en cours…' : 'Importer CSV_ABONNEMENT'}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--soft"
                  disabled={subsExporting}
                  onClick={() => void handleSubsExport()}
                >
                  {subsExporting ? 'Export…' : 'Exporter'}
                </button>
                {subsResult ? (
                  <p className="admin-catalog__hint">
                    {subsResult.applied ? 'Écrit' : 'Bloqué'} · {subsResult.rows_processed} lignes
                  </p>
                ) : null}
              </div>
              {subsResult ? (
                <>
                  <CsvErrorList items={subsResult.errors} />
                  <CsvErrorList label="Avertissements" items={subsResult.warnings} />
                </>
              ) : null}
            </article>
          </div>
        ) : null}
      </div>
      <main className="admin-catalog">
        <aside className="admin-catalog__tree-panel">
          <div className="admin-catalog__tree-head">
            <input
              type="search"
              className="admin-search"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="button" className="admin-btn admin-btn--soft" onClick={startCreateRoot}>
              + Racine
            </button>
          </div>
          <p className="admin-catalog__tree-meta">{total} catalogue(s) au total</p>
          {loading ? (
            <p className="admin-catalog__hint">Chargement…</p>
          ) : displayTree.length === 0 ? (
            <p className="admin-catalog__hint">
              {q ? 'Aucun résultat.' : 'Aucun catalogue. Créez une racine pour commencer.'}
            </p>
          ) : (
            <ul className="admin-tree">
              {displayTree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  expandedIds={expandedIds}
                  onSelect={(id) => void loadDetail(id)}
                  onToggle={toggleExpand}
                />
              ))}
            </ul>
          )}
        </aside>

        <section className="admin-catalog__detail">
          <div className="admin-catalog__detail-head">
            <div>
              <h2>{panelTitle}</h2>
              {breadcrumb.length > 0 ? (
                <p className="admin-catalog__breadcrumb">{breadcrumb.join(' › ')}</p>
              ) : null}
            </div>
            {mode === 'edit' && selectedId ? (
              <div className="admin-catalog__detail-actions">
                <button type="button" className="admin-btn admin-btn--soft" onClick={startCreateChild}>
                  + Enfant
                </button>
              </div>
            ) : null}
          </div>

          {error ? <p className="admin-alert admin-alert--error">{error}</p> : null}
          {success ? <p className="admin-alert admin-alert--success">{success}</p> : null}

          {mode === 'empty' ? (
            <div className="admin-catalog__empty">
              <p>Choisissez un nœud dans l&apos;arborescence ou créez un catalogue racine.</p>
              <p className="admin-catalog__hint">
                Pour les massifs béton, utilisez l’import CSV en haut de page.
              </p>
            </div>
          ) : (
            <>
              {mode === 'edit' ? (
                <div className="admin-stats">
                  <span>{childCount} sous-catalogue(s)</span>
                  <span>{productCount} produit(s)</span>
                  <span className={isActive ? 'admin-status--active' : 'admin-status--inactive'}>
                    {isActive ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              ) : null}
              {mode === 'create-child' && createParentId ? (
                <p className="admin-catalog__hint">Parent : catalogue #{createParentId}</p>
              ) : null}

              <div className="admin-form">
                <label className="admin-field">
                  <span>Nom *</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="admin-field">
                  <span>Description *</span>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>

                {mode === 'edit' && selectedId ? (
                  <div className="admin-attr-section">
                    <h3>Attributs des produits</h3>
                    <p className="admin-catalog__hint">
                      Attributs présents sur les produits de ce catalogue. Par défaut facultatifs —
                      activez le switch pour les rendre obligatoires.
                    </p>
                    {attrsLoading ? (
                      <p className="admin-catalog__hint">Chargement…</p>
                    ) : productAttrs.length === 0 ? (
                      <p className="admin-catalog__hint">
                        Aucun attribut détecté (importez un CSV ou ajoutez des attributs aux produits).
                      </p>
                    ) : (
                      <ul className="admin-attr-list">
                        {productAttrs.map((attr) => (
                          <li key={attr.attribute_name} className="admin-attr-list__item admin-attr-list__item--switch">
                            <div>
                              <span>{attr.attribute_name}</span>
                              <small className="admin-attr-list__meta">
                                {attr.product_count} produit(s)
                              </small>
                            </div>
                            <label className="admin-switch">
                              <input
                                type="checkbox"
                                checked={attr.is_mandatory}
                                disabled={togglingAttr === attr.attribute_name}
                                onChange={() => void handleToggleMandatory(attr)}
                              />
                              <span>{attr.is_mandatory ? 'Obligatoire' : 'Facultatif'}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="admin-form__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={saving}
                  onClick={() => void handleSave()}
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                {mode === 'edit' && selectedId ? (
                  isActive ? (
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      disabled={saving}
                      onClick={() => void toggleActive(false)}
                    >
                      Désactiver le catalogue
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="admin-btn admin-btn--soft"
                      disabled={saving}
                      onClick={() => void toggleActive(true)}
                    >
                      Activer le catalogue
                    </button>
                  )
                ) : null}
              </div>
            </>
          )}
        </section>

        <aside className="admin-catalog__products-panel">
          <h3>Produits du catalogue</h3>
          {mode !== 'edit' || !selectedId ? (
            <p className="admin-catalog__hint">Sélectionnez un catalogue pour voir ses produits.</p>
          ) : productsLoading ? (
            <p className="admin-catalog__hint">Chargement…</p>
          ) : catalogProducts.length === 0 ? (
            <p className="admin-catalog__hint">Aucun produit enregistré dans ce catalogue.</p>
          ) : (
            <div className="admin-mini-table__scroll">
              <table className="admin-mini-table">
                <thead>
                  <tr>
                    <th>SKU admin</th>
                    <th>Produit</th>
                    <th>Prix min</th>
                    <th>Fournisseurs</th>
                    <th>État</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogProducts.map((p) => (
                    <tr key={p.product_id}>
                      <td>
                        <Link to={`/admin/produits/${p.product_id}`} className="admin-mini-table__link">
                          {p.admin_sku}
                        </Link>
                      </td>
                      <td>
                        <Link to={`/admin/produits/${p.product_id}`} className="admin-mini-table__link">
                          {p.product_name}
                        </Link>
                      </td>
                      <td>
                        {p.price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {p.currency}
                      </td>
                      <td>{p.supplier_count ?? 0}</td>
                      <td>
                        <span
                          className={
                            p.is_active ? 'admin-status--active' : 'admin-status--inactive'
                          }
                        >
                          {p.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}
