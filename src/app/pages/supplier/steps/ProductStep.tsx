import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  addProductAttribute,
  createProduct,
  deleteProductAttribute,
  fetchCatalogAttributeDefinitions,
  fetchProduct,
  fetchProductAttributes,
  fetchProducts,
  searchCatalogs,
  updateProduct,
  updateProductAttribute,
  type ProductFormPayload,
} from '../../../api/supplierPortal'
import { fetchAccountProfile } from '../../../api/orders'
import { CatalogHelpTrigger, CatalogTreeHelpModal } from '../../../components/CatalogTreeHelp'
import { catalogPathLabel } from '../../../lib/catalogDisplay'
import {
  findMissingMandatory,
  mergeMandatoryPrefill,
  pruneMandatoryValues,
  splitMandatoryFields,
  syncMatchedFromPrimary,
} from '../../../lib/mandatoryAttributes'
import { loadWizardDraft, patchWizardDraft, usePortalSession } from '../../../lib/supplier'
import type { SessionUser } from '../../../types/auth'
import type {
  CatalogAttributeDefinition,
  CatalogRecord,
  ProductAttributRecord,
  ProductListEntry,
  ProductRecord,
} from '../../../types/supplierPortal'
import { WizardActions, WizardShell } from '../WizardShell'

interface ProductStepProps {
  session: SessionUser
}

type Mode = 'create' | 'edit'

interface MandatoryField extends CatalogAttributeDefinition {
  catalogLabel: string
}

const EMPTY_FORM = {
  clientSku: '',
  productName: '',
  price: '',
  currency: 'EUR',
  isActive: true,
  addressId: null as number | null,
  mandatoryValues: {} as Record<number, string>,
}

export function ProductStep({ session }: ProductStepProps) {
  const navigate = useNavigate()
  const portal = usePortalSession(session)
  const draft = loadWizardDraft()
  const lockedCatalogRef = draft.catalogRef

  const [mode, setMode] = useState<Mode>('create')
  const [products, setProducts] = useState<ProductListEntry[]>([])
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('')
  const [productId, setProductId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [additionalCatalogs, setAdditionalCatalogs] = useState<CatalogRecord[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogSearchResults, setCatalogSearchResults] = useState<CatalogRecord[]>([])
  const [mandatoryFields, setMandatoryFields] = useState<MandatoryField[]>([])
  const [attrOpen, setAttrOpen] = useState(false)
  const [attributes, setAttributes] = useState<ProductAttributRecord[]>([])
  const [editingAttrId, setEditingAttrId] = useState<number | null>(null)
  const [attrName, setAttrName] = useState('')
  const [attrValue, setAttrValue] = useState('')
  const [attrError, setAttrError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [treeHelpOpen, setTreeHelpOpen] = useState(false)
  const [companyAddresses, setCompanyAddresses] = useState<
    Array<{ id: number; label: string; zip_code: string | null; city: string | null; is_primary: boolean }>
  >([])

  useEffect(() => {
    fetchAccountProfile()
      .then((p) =>
        setCompanyAddresses(
          (p.addresses || []).map((a) => ({
            id: a.id,
            label: a.label || a.type,
            zip_code: a.zip_code,
            city: a.city,
            is_primary: a.is_primary,
          })),
        ),
      )
      .catch(() => setCompanyAddresses([]))
  }, [])

  const reloadProducts = useCallback(async () => {
    if (!lockedCatalogRef) return
    setProducts(await fetchProducts(portal, lockedCatalogRef))
  }, [portal, lockedCatalogRef])

  const loadMandatoryFields = useCallback(
    async (catalogIds: number[], labels: Map<number, string>) => {
      const all: MandatoryField[] = []
      for (const cid of catalogIds) {
        const defs = await fetchCatalogAttributeDefinitions(portal, cid)
        for (const d of defs) {
          all.push({
            ...d,
            catalogLabel: labels.get(cid) ?? `Catalogue #${cid}`,
          })
        }
      }
      all.sort((a, b) => a.attribute_name.localeCompare(b.attribute_name, 'fr'))
      setMandatoryFields(all)
      setForm((prev) => {
        const pruned = pruneMandatoryValues(all, prev.mandatoryValues)
        const prefilled = mergeMandatoryPrefill(all, pruned)
        const synced = lockedCatalogRef
          ? syncMatchedFromPrimary(all, lockedCatalogRef, prefilled)
          : prefilled
        return { ...prev, mandatoryValues: synced }
      })
    },
    [portal, lockedCatalogRef],
  )

  useEffect(() => {
    if (!lockedCatalogRef) return
    reloadProducts().catch((e: Error) => setError(e.message))
  }, [lockedCatalogRef, reloadProducts])

  useEffect(() => {
    if (!lockedCatalogRef) return
    const labels = new Map<number, string>()
    labels.set(lockedCatalogRef, draft.catalogName ?? `Catalogue #${lockedCatalogRef}`)
    for (const c of additionalCatalogs) {
      labels.set(c.id, c.name ?? `Catalogue #${c.id}`)
    }
    const ids = [lockedCatalogRef, ...additionalCatalogs.map((c) => c.id)]
    loadMandatoryFields(ids, labels).catch(() => setMandatoryFields([]))
  }, [lockedCatalogRef, additionalCatalogs, draft.catalogName, loadMandatoryFields])

  useEffect(() => {
    if (!catalogSearch.trim()) {
      setCatalogSearchResults([])
      return
    }
    const t = window.setTimeout(() => {
      searchCatalogs(portal, catalogSearch)
        .then(setCatalogSearchResults)
        .catch(() => setCatalogSearchResults([]))
    }, 250)
    return () => window.clearTimeout(t)
  }, [catalogSearch, portal])

  const { primary: primaryMandatoryFields, extraUnmatched: extraMandatoryFields } = useMemo((): {
    primary: MandatoryField[]
    extraUnmatched: MandatoryField[]
  } => {
    if (!lockedCatalogRef) {
      return { primary: mandatoryFields, extraUnmatched: [] }
    }
    const { primary, extraUnmatched } = splitMandatoryFields(mandatoryFields, lockedCatalogRef)
    return {
      primary: primary as MandatoryField[],
      extraUnmatched: extraUnmatched as MandatoryField[],
    }
  }, [mandatoryFields, lockedCatalogRef])

  function setMandatoryValue(defId: number, value: string, fromPrimary = false) {
    setForm((f) => {
      let mandatoryValues = { ...f.mandatoryValues, [defId]: value }
      if (fromPrimary && lockedCatalogRef) {
        mandatoryValues = syncMatchedFromPrimary(mandatoryFields, lockedCatalogRef, mandatoryValues)
      }
      return { ...f, mandatoryValues }
    })
  }

  const fillFromProduct = useCallback((p: ProductRecord) => {
    setProductId(p.id)
    setSelectedProductId(p.id)
    const mandatoryValues: Record<number, string> = {}
    for (const m of p.mandatory_attributes) {
      if (m.value) mandatoryValues[m.definition_id] = m.value
    }
    setForm({
      clientSku: p.client_sku,
      productName: p.product_name,
      price: String(p.price),
      currency: p.currency,
      isActive: p.is_active,
      addressId: p.address_id ?? null,
      mandatoryValues,
    })
    patchWizardDraft({ productId: p.id })
  }, [])

  const loadAttributes = useCallback(
    async (pid: number) => {
      try {
        setAttributes(await fetchProductAttributes(portal, pid))
      } catch {
        setAttributes([])
      }
    },
    [portal],
  )

  const resetFormForCreate = useCallback(() => {
    setProductId(null)
    setSelectedProductId('')
    setForm(EMPTY_FORM)
    setMandatoryFields([])
    setAdditionalCatalogs([])
    setCatalogSearch('')
    setAttributes([])
    patchWizardDraft({ productId: undefined })
  }, [])

  async function loadProductById(pid: number) {
    setError(null)
    try {
      const p = await fetchProduct(portal, pid)
      if (!p.catalog_ids.includes(lockedCatalogRef!)) {
        setError('Ce produit n’appartient pas au catalogue sélectionné.')
        return
      }
      fillFromProduct(p)
      const linked = p.linked_catalogs ?? []
      const extras = linked.filter((c) => c.id !== lockedCatalogRef)
      setAdditionalCatalogs(extras)
      await loadAttributes(p.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Produit introuvable.')
    }
  }

  async function onSelectProduct(pid: number) {
    if (!pid) {
      resetFormForCreate()
      return
    }
    await loadProductById(pid)
  }

  useEffect(() => {
    const pid = draft.productId
    if (!lockedCatalogRef || !pid) return
    setMode('edit')
    void loadProductById(pid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedCatalogRef])

  function addAdditionalCatalog(catalog: CatalogRecord) {
    if (catalog.id === lockedCatalogRef) return
    if (additionalCatalogs.some((c) => c.id === catalog.id)) return
    setAdditionalCatalogs((list) => [...list, catalog])
    setCatalogSearch('')
    setCatalogSearchResults([])
  }

  function removeAdditionalCatalog(id: number) {
    setAdditionalCatalogs((list) => list.filter((c) => c.id !== id))
  }

  function buildPayload(): ProductFormPayload | null {
    if (!lockedCatalogRef) {
      setError('Catalogue manquant : revenez à l’étape 1.')
      return null
    }
    if (!form.clientSku.trim() || !form.productName.trim() || form.price === '') {
      setError('SKU client, nom produit et prix sont obligatoires.')
      return null
    }
    const missing = findMissingMandatory(mandatoryFields, form.mandatoryValues)
    if (missing.length) {
      setError(
        `Attributs obligatoires manquants : ${missing.map((m) => m.attribute_name).join(', ')}.`,
      )
      return null
    }
    setError(null)
    return {
      primary_catalog_id: lockedCatalogRef,
      additional_catalog_ids: additionalCatalogs.map((c) => c.id),
      client_sku: form.clientSku.trim(),
      product_name: form.productName.trim(),
      price: Number(form.price),
      currency: form.currency,
      is_active: form.isActive,
      address_id: form.addressId,
      mandatory_attributes: mandatoryFields.map((f) => ({
        definition_id: f.id,
        value: form.mandatoryValues[f.id].trim(),
      })),
    }
  }

  async function persist(): Promise<ProductRecord | null> {
    const payload = buildPayload()
    if (!payload) return null
    if (mode === 'edit' && !productId) {
      setError('Sélectionnez un produit existant à modifier.')
      return null
    }
    setSaving(true)
    setSuccess(null)
    const wasUpdate = productId != null
    try {
      const saved = wasUpdate
        ? await updateProduct(portal, productId!, payload)
        : await createProduct(portal, payload)
      fillFromProduct(saved)
      setSuccess(wasUpdate ? 'Produit mis à jour.' : 'Produit créé.')
      await loadAttributes(saved.id)
      await reloadProducts()
      return saved
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
      return null
    } finally {
      setSaving(false)
    }
  }

  function openAttrModal(attr?: ProductAttributRecord) {
    setAttrError(null)
    if (attr) {
      setEditingAttrId(attr.id)
      setAttrName(attr.name)
      setAttrValue(attr.value ?? '')
    } else {
      setEditingAttrId(null)
      setAttrName('')
      setAttrValue('')
    }
    setAttrOpen(true)
  }

  async function removeAttribute(attrId: number) {
    if (!productId) return
    try {
      await deleteProductAttribute(portal, productId, attrId)
      setAttributes((list) => list.filter((a) => a.id !== attrId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible.')
    }
  }

  async function saveAttribute() {
    if (!productId) {
      setAttrError('Enregistrez le produit avant d’ajouter des attributs.')
      return
    }
    if (!attrName.trim()) {
      setAttrError('Le nom de l’attribut est obligatoire.')
      return
    }
    setAttrError(null)
    try {
      if (editingAttrId != null) {
        const updated = await updateProductAttribute(
          portal,
          productId,
          editingAttrId,
          attrName.trim(),
          attrValue.trim() || null,
        )
        setAttributes((list) => list.map((a) => (a.id === updated.id ? updated : a)))
      } else {
        const created = await addProductAttribute(
          portal,
          productId,
          attrName.trim(),
          attrValue.trim() || null,
        )
        setAttributes((list) => [...list, created])
      }
      setAttrName('')
      setAttrValue('')
      setEditingAttrId(null)
    } catch (e) {
      setAttrError(e instanceof Error ? e.message : 'Erreur attribut.')
    }
  }

  if (!lockedCatalogRef) {
    return (
      <WizardShell step="produit" title="Étape 2 — Produit & attributs">
        <div className="wizard__panel">
          <p className="wizard__error">
            Aucun catalogue sélectionné. Choisissez d’abord un catalogue à l’étape 1.
          </p>
          <Link to="/fournisseur/offres/catalogue" className="btn btn--primary">
            Choisir un catalogue
          </Link>
        </div>
      </WizardShell>
    )
  }

  return (
    <WizardShell step="produit" title="Étape 2 — Produit & attributs">
      <p className="wizard__context-banner">
        Catalogue principal : <strong>{draft.catalogName ?? `#${lockedCatalogRef}`}</strong>
        {' · '}
        <Link to="/fournisseur/offres/catalogue">Changer de catalogue</Link>
      </p>

      <div className="wizard__mode">
        <button
          type="button"
          className={mode === 'create' ? 'is-active' : undefined}
          onClick={() => {
            setMode('create')
            resetFormForCreate()
            setError(null)
          }}
        >
          Nouveau produit
        </button>
        <button
          type="button"
          className={mode === 'edit' ? 'is-active' : undefined}
          onClick={() => {
            setMode('edit')
            resetFormForCreate()
            setError(null)
          }}
        >
          Modifier un produit
        </button>
      </div>

      <div className="wizard__panel">
        {error ? <p className="wizard__error">{error}</p> : null}
        {success ? <p className="wizard__success">{success}</p> : null}

        <div className="wizard__fields">
          {mode === 'edit' ? (
            <label className="field">
              <span>Choisir un produit *</span>
              <select
                value={selectedProductId}
                onChange={(e) => void onSelectProduct(Number(e.target.value))}
              >
                <option value="">— Choisir —</option>
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.client_sku}
                  </option>
                ))}
              </select>
              {products.length === 0 ? (
                <span className="field__unit-hint">
                  Aucun produit dans ce catalogue pour votre société.
                </span>
              ) : (
                <span className="field__unit-hint">
                  Liste par SKU client — le détail (nom, prix…) s&apos;affiche ci-dessous une fois
                  sélectionné.
                </span>
              )}
            </label>
          ) : null}

          <label className="field">
            <span>SKU client *</span>
            <input
              type="text"
              value={form.clientSku}
              disabled={mode === 'edit' && !productId}
              onChange={(e) => setForm((f) => ({ ...f, clientSku: e.target.value }))}
            />
            <span className="field__unit-hint">Référence commerciale de votre société.</span>
          </label>

          <label className="field">
            <span>Nom du produit *</span>
            <input
              type="text"
              value={form.productName}
              onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
            />
          </label>

          <div className="product-extra-catalogs">
            <div className="field-label-row">
              <strong>Catalogues supplémentaires</strong>
              <CatalogHelpTrigger onClick={() => setTreeHelpOpen(true)} />
            </div>
            <p className="field__unit-hint">
              Liez ce produit à d&apos;autres catalogues (ex. familles proches). Les liens
              directionnels entre catalogues sont enregistrés automatiquement.
            </p>
            {additionalCatalogs.length > 0 ? (
              <ul className="catalog-chip-list">
                {additionalCatalogs.map((c) => (
                  <li key={c.id} className="catalog-chip">
                    <span>{catalogPathLabel(c)}</span>
                    <button type="button" onClick={() => removeAdditionalCatalog(c.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <input
              type="search"
              placeholder="Rechercher un catalogue à ajouter…"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
            />
            {catalogSearchResults.length > 0 ? (
              <ul className="catalog-search-results">
                {catalogSearchResults
                  .filter(
                    (c) =>
                      c.id !== lockedCatalogRef &&
                      !additionalCatalogs.some((a) => a.id === c.id),
                  )
                  .slice(0, 8)
                  .map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => addAdditionalCatalog(c)}>
                        {catalogPathLabel(c)}
                      </button>
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>

          {primaryMandatoryFields.length > 0 ? (
            <div className="mandatory-attrs-section">
              <strong>Attributs obligatoires — catalogue principal</strong>
              <p className="field__unit-hint">
                {draft.catalogName ?? `Catalogue #${lockedCatalogRef}`}
              </p>
              {primaryMandatoryFields.map((field) => (
                <label key={field.id} className="field">
                  <span>{field.attribute_name} *</span>
                  <input
                    type="text"
                    value={form.mandatoryValues[field.id] ?? ''}
                    onChange={(e) => setMandatoryValue(field.id, e.target.value, true)}
                  />
                </label>
              ))}
            </div>
          ) : null}

          {extraMandatoryFields.length > 0 ? (
            <div className="mandatory-attrs-section mandatory-attrs-section--extra">
              <strong>Informations complémentaires — catalogues liés</strong>
              <p className="field__unit-hint">
                Ces champs sont propres aux catalogues supplémentaires que vous avez ajoutés. Les
                attributs déjà renseignés pour le catalogue principal (même nom) sont repris
                automatiquement et ne sont pas redemandés ici.
              </p>
              {extraMandatoryFields.map((field) => (
                <label key={field.id} className="field">
                  <span>
                    {field.attribute_name} *
                    <small className="field__unit-hint"> ({field.catalogLabel})</small>
                  </span>
                  <input
                    type="text"
                    value={form.mandatoryValues[field.id] ?? ''}
                    onChange={(e) => setMandatoryValue(field.id, e.target.value)}
                  />
                </label>
              ))}
            </div>
          ) : null}

          <label className="field">
            <span>Prix *</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Devise</span>
            <input
              type="text"
              maxLength={3}
              value={form.currency}
              onChange={(e) =>
                setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))
              }
            />
          </label>
          <label className="field">
            <span>Adresse d&apos;origine (expédition)</span>
            <select
              value={form.addressId ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  addressId: e.target.value ? Number(e.target.value) : null,
                }))
              }
            >
              <option value="">Adresse principale de la société</option>
              {companyAddresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                  {a.is_primary ? ' · principale' : ''}
                  {a.zip_code || a.city
                    ? ` — ${[a.zip_code, a.city].filter(Boolean).join(' ')}`
                    : ''}
                </option>
              ))}
            </select>
            <small className="field__unit-hint">
              Associée en plus du fournisseur. Utilisée pour la livraison / calcul de distance.
              {companyAddresses.length === 0
                ? ' Ajoutez des adresses dans Paramètres compte.'
                : ''}
            </small>
          </label>
          <label className="field checkbox-row">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            <span>Produit actif</span>
          </label>

          <div className="product-attr-section">
            <div className="product-attr-section__head">
              <strong>Attributs sur mesure (optionnels)</strong>
              {productId ? (
                <button type="button" className="btn btn--ghost" onClick={() => openAttrModal()}>
                  + Ajouter
                </button>
              ) : null}
            </div>
            {!productId ? (
              <p className="field__unit-hint">Enregistrez le produit pour gérer les attributs.</p>
            ) : attributes.length === 0 ? (
              <p className="field__unit-hint">Aucun attribut sur mesure.</p>
            ) : (
              <table className="attr-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Valeur</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {attributes.map((a) => (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td>{a.value ?? '—'}</td>
                      <td className="attr-table__actions">
                        <button
                          type="button"
                          className="btn btn--ghost"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem' }}
                          onClick={() => openAttrModal(a)}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem', color: '#b91c1c' }}
                          onClick={() => void removeAttribute(a.id)}
                        >
                          Suppr.
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {attrOpen && productId ? (
        <AttributesModal
          editing={editingAttrId != null}
          attrName={attrName}
          attrValue={attrValue}
          attrError={attrError}
          onNameChange={setAttrName}
          onValueChange={setAttrValue}
          onClose={() => {
            setAttrOpen(false)
            setAttrError(null)
            setEditingAttrId(null)
          }}
          onSave={() => void saveAttribute()}
        />
      ) : null}

      <CatalogTreeHelpModal
        portal={portal}
        open={treeHelpOpen}
        onClose={() => setTreeHelpOpen(false)}
        onSelect={addAdditionalCatalog}
        excludeIds={
          lockedCatalogRef
            ? [lockedCatalogRef, ...additionalCatalogs.map((c) => c.id)]
            : additionalCatalogs.map((c) => c.id)
        }
        title="Arborescence — catalogues supplémentaires"
      />

      <WizardActions
        onSave={() => void persist()}
        onNext={async () => {
          const saved = await persist()
          if (saved) navigate('/fournisseur')
        }}
        saving={saving}
        nextLabel="Terminer"
      />
    </WizardShell>
  )
}

function AttributesModal({
  editing,
  attrName,
  attrValue,
  attrError,
  onNameChange,
  onValueChange,
  onClose,
  onSave,
}: {
  editing: boolean
  attrName: string
  attrValue: string
  attrError: string | null
  onNameChange: (v: string) => void
  onValueChange: (v: string) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div className="attr-modal-backdrop" role="dialog" aria-modal="true">
      <div className="attr-modal">
        <div className="attr-modal__scroll">
          <h3>{editing ? 'Modifier l’attribut' : 'Nouvel attribut'}</h3>
          {attrError ? <p className="wizard__error">{attrError}</p> : null}
          <div className="wizard__fields">
            <label className="field">
              <span>Nom *</span>
              <input type="text" value={attrName} onChange={(e) => onNameChange(e.target.value)} />
            </label>
            <label className="field">
              <span>Valeur</span>
              <input
                type="text"
                value={attrValue}
                onChange={(e) => onValueChange(e.target.value)}
              />
            </label>
          </div>
          <div className="wizard__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Fermer
            </button>
            <button type="button" className="btn btn--primary" onClick={onSave}>
              {editing ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
