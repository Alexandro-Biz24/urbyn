import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAccountProfile } from '../../api/orders'
import {
  fetchCatalogChildren,
  fetchCatalogOfferProducts,
  fetchMyOffers,
  fetchPortalContext,
  fetchRootCatalogs,
  saveSupplierOffer,
  saveSupplierSection,
  withdrawSupplierOffer,
  searchCatalogProducts,
  type CatalogProductHit,
  type CatalogSearchGroup,
  type SupplierOfferGroup,
} from '../../api/supplierPortal'
import type { CatalogRecord } from '../../types/supplierPortal'
import { usePortalSession } from '../../lib/supplier'
import type { SessionUser } from '../../types/auth'
import './SupplierPortal.css'

interface SupplierDashboardProps {
  session: SessionUser
}

export function SupplierDashboard({ session }: SupplierDashboardProps) {
  const navigate = useNavigate()
  const portal = usePortalSession(session)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [groups, setGroups] = useState<SupplierOfferGroup[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [drafts, setDrafts] = useState<Record<number, { price: string; delay: string }>>({})
  const [savingSection, setSavingSection] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchGroups, setSearchGroups] = useState<CatalogSearchGroup[] | null>(null)
  const [openSearch, setOpenSearch] = useState<Record<number, boolean>>({})
  const [searching, setSearching] = useState(false)
  const [crumbs, setCrumbs] = useState<{ id: number | null; name: string }[]>([
    { id: null, name: 'Catalogues' },
  ])
  const [folders, setFolders] = useState<CatalogRecord[]>([])
  const [shelf, setShelf] = useState<CatalogProductHit[]>([])
  const [browsing, setBrowsing] = useState(false)
  const [picked, setPicked] = useState<Record<number, { name: string; price: string; delay: string }>>({})
  const [savingPick, setSavingPick] = useState(false)
  const [offersOpen, setOffersOpen] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(true)
  const [addresses, setAddresses] = useState<{ id: number; label: string; primary: boolean }[]>([])
  const [groupAddress, setGroupAddress] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchPortalContext(portal)
      .then((ctx) => setCompanyName(ctx.company_name))
      .catch(() => setCompanyName(null))
  }, [portal])

  function siegeOf(list: { id: number; label: string; primary: boolean }[]) {
    const labeled = list.filter((address) => address.label.trim())
    return (
      labeled.find((address) => {
        const name = address.label.toLowerCase()
        return name.includes('siège') || name.includes('siege')
      }) ||
      labeled.find((address) => address.primary) ||
      labeled[0] ||
      null
    )
  }

  function applyGroups(
    data: { groups: SupplierOfferGroup[] },
    list = addresses,
  ) {
    const siege = siegeOf(list)
    setGroups(data.groups)
    const next: Record<number, { price: string; delay: string }> = {}
    const chosen: Record<string, string> = {}
    for (const group of data.groups) {
      for (const offer of group.offers) {
        next[offer.product_id] = {
          price: String(offer.price),
          delay: String(offer.delai_jours),
        }
      }
      const key = group.catalog_ids.join('-') || group.catalog_label
      chosen[key] = group.address_id
        ? String(group.address_id)
        : siege
          ? String(siege.id)
          : ''
    }
    setDrafts(next)
    setGroupAddress(chosen)
  }

  function loadOffers() {
    setLoadingProducts(true)
    fetchMyOffers(portal)
      .then((data) => applyGroups(data))
      .catch(() => setGroups([]))
      .finally(() => setLoadingProducts(false))
  }

  useEffect(() => {
    loadOffers()
  }, [portal])

  useEffect(() => {
    fetchAccountProfile()
      .then((profile) => {
        const list = (profile.addresses || [])
          .filter((address) => (address.label || '').trim())
          .map((address) => ({
            id: address.id,
            label: address.label!.trim(),
            primary: address.is_primary,
          }))
        const siege = siegeOf(list)
        const ordered = siege
          ? [siege, ...list.filter((address) => address.id !== siege.id)]
          : list
        setAddresses(ordered)
      })
      .catch(() => setAddresses([]))
  }, [portal])

  const totalProducts = groups.reduce((sum, g) => sum + g.offers.length, 0)

  function filled(price: string, delay: string) {
    if (price.trim() === '' || delay.trim() === '') return false
    const amount = Number(price)
    const days = Number(delay)
    return Number.isFinite(amount) && amount >= 0 && Number.isInteger(days) && days >= 0
  }

  async function saveSection() {
    for (const group of groups) {
      for (const offer of group.offers) {
        const draft = drafts[offer.product_id]
        if (!draft || !filled(draft.price, draft.delay)) {
          setFormError('Chaque produit doit avoir un prix et un délai entier.')
          return
        }
      }
    }
    const siege = siegeOf(addresses)
    const offerChanges: { product_id: number; price: number; delai_jours: number }[] = []
    const addressChanges: { address_id: number; catalog_ids: number[] }[] = []
    for (const group of groups) {
      const key = group.catalog_ids.join('-') || group.catalog_label
      const selected = groupAddress[key] || (siege ? String(siege.id) : '')
      const stored = group.address_id ? String(group.address_id) : ''
      const addressId = Number(selected)
      if (
        group.catalog_ids.length > 0 &&
        selected &&
        selected !== stored &&
        Number.isInteger(addressId)
      ) {
        addressChanges.push({ address_id: addressId, catalog_ids: group.catalog_ids })
      }
      for (const offer of group.offers) {
        const draft = drafts[offer.product_id]
        if (!draft) continue
        const price = Number(draft.price)
        const delay = Number(draft.delay)
        if (Math.abs(price - offer.price) > 0.001 || delay !== offer.delai_jours) {
          offerChanges.push({
            product_id: offer.product_id,
            price,
            delai_jours: delay,
          })
        }
      }
    }
    if (offerChanges.length === 0 && addressChanges.length === 0) return
    setSavingSection(true)
    setFormError(null)
    try {
      const saved = await saveSupplierSection(portal, offerChanges, addressChanges)
      applyGroups(saved)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Enregistrement impossible.')
    } finally {
      setSavingSection(false)
    }
  }

  async function removeOffer(productId: number, name: string) {
    if (!window.confirm(`Retirer « ${name} » de vos produits ?`)) return
    setRemovingId(productId)
    setFormError(null)
    try {
      await withdrawSupplierOffer(portal, productId)
      setGroups((prev) =>
        prev
          .map((group) => ({
            ...group,
            offers: group.offers.filter((offer) => offer.product_id !== productId),
          }))
          .filter((group) => group.offers.length > 0),
      )
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[productId]
        return next
      })
      setShelf((prev) =>
        prev.map((hit) =>
          hit.product_id === productId ? { ...hit, already_offered: false } : hit,
        ),
      )
      setSearchGroups((prev) =>
        prev
          ? prev.map((group) => ({
              ...group,
              products: group.products.map((hit) =>
                hit.product_id === productId ? { ...hit, already_offered: false } : hit,
              ),
            }))
          : prev,
      )
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Suppression impossible.')
    } finally {
      setRemovingId(null)
    }
  }

  function priceText(raw: string) {
    const cleaned = raw.replace(',', '.').replace(/[^\d.]/g, '')
    const dot = cleaned.indexOf('.')
    if (dot === -1) return cleaned
    return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '')}`
  }

  function validPrice(raw: string) {
    if (raw.trim() === '' || raw === '.') return false
    const amount = Number(raw)
    return Number.isFinite(amount) && amount >= 0
  }

  function validDelay(raw: string) {
    return /^\d+$/.test(raw)
  }

  function addPick(hit: CatalogProductHit) {
    setPicked((prev) =>
      prev[hit.product_id]
        ? prev
        : { ...prev, [hit.product_id]: { name: hit.product_name, price: '', delay: '' } },
    )
  }

  async function showCatalog(id: number | null, trail: { id: number | null; name: string }[]) {
    setBrowsing(true)
    setFormError(null)
    try {
      if (id === null) {
        setFolders(await fetchRootCatalogs(portal))
        setShelf([])
      } else {
        const [children, products] = await Promise.all([
          fetchCatalogChildren(portal, id),
          fetchCatalogOfferProducts(portal, id),
        ])
        setFolders(children)
        setShelf(products)
      }
      setCrumbs(trail)
      setSearchGroups(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Catalogue inaccessible.')
    } finally {
      setBrowsing(false)
    }
  }

  useEffect(() => {
    void showCatalog(null, [{ id: null, name: 'Catalogues' }])
  }, [portal])

  async function runSearch() {
    if (query.trim().length < 2) {
      setSearchGroups(null)
      return
    }
    setSearching(true)
    setFormError(null)
    try {
      const groups = await searchCatalogProducts(portal, query)
      setSearchGroups(groups)
      setOpenSearch({})
    } catch (err) {
      setSearchGroups([])
      setFormError(err instanceof Error ? err.message : 'Recherche impossible.')
    } finally {
      setSearching(false)
    }
  }

  async function savePicked() {
    const rows = Object.entries(picked).filter(
      ([, row]) => validPrice(row.price) && validDelay(row.delay),
    )
    if (rows.length === 0) return
    setSavingPick(true)
    setFormError(null)
    try {
      for (const [id, row] of rows) {
        await saveSupplierOffer(portal, Number(id), Number(row.price), Number(row.delay))
        setPicked((prev) => {
          const next = { ...prev }
          delete next[Number(id)]
          return next
        })
      }
      loadOffers()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Enregistrement impossible.')
      loadOffers()
    } finally {
      setSavingPick(false)
    }
  }

  const pickRows = Object.entries(picked)
  const picksReady =
    pickRows.length > 0 && pickRows.every(([, row]) => validPrice(row.price) && validDelay(row.delay))

  return (
    <main className="supplier-page supplier-page--wide">
      <div className="supplier-page__heading">
        <div>
          <h1 className="supplier-page__title">Espace partenaire</h1>
          <p className="supplier-page__subtitle">
            {companyName ? `Société : ${companyName}` : 'Gérez vos offres et paramètres'}
          </p>
        </div>
        <button type="button" className="supplier-subscribe">S&apos;abonner</button>
      </div>

      {formError ? <p className="supplier-offer-error">{formError}</p> : null}
      <section className={`supplier-products-panel${offersOpen ? '' : ' is-collapsed'}`}>
        <button
          type="button"
          className="supplier-products-panel__head"
          onClick={() => setOffersOpen((open) => !open)}
          aria-expanded={offersOpen}
        >
          <h2>{offersOpen ? '▾' : '▸'} Vos produits</h2>
          <span className="supplier-products-panel__count">
            {totalProducts} produit{totalProducts > 1 ? 's' : ''}
          </span>
        </button>
        {offersOpen ? (loadingProducts ? (
          <p className="supplier-products-panel__hint">Chargement…</p>
        ) : totalProducts === 0 ? (
          <p className="supplier-products-panel__hint">Aucune offre pour le moment.</p>
        ) : (
          <>
          <div className="supplier-products-table__scroll">
            <table className="supplier-products-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Prix HT</th>
                  <th>Délai (jours)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const groupKey = group.catalog_ids.join('-') || group.catalog_label
                  const paths = group.catalog_paths?.length
                    ? group.catalog_paths
                    : [group.catalog_label]
                  return (
                  <Fragment key={groupKey}>
                    <tr className="supplier-products-table__group">
                      <td colSpan={4}>
                        <div className="supplier-group-address">
                          <div>
                            {paths.map((path) => (
                              <div key={path}>{path}</div>
                            ))}
                          </div>
                          <div className="supplier-group-address__controls">
                            <select
                              value={
                                groupAddress[groupKey] ||
                                (addresses[0] ? String(addresses[0].id) : '')
                              }
                              onChange={(e) =>
                                setGroupAddress((prev) => ({ ...prev, [groupKey]: e.target.value }))
                              }
                            >
                              {addresses.map((address) => (
                                <option key={address.id} value={address.id}>
                                  {address.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </td>
                    </tr>
                    {group.offers.map((offer) => {
                      const draft = drafts[offer.product_id] ?? {
                        price: String(offer.price),
                        delay: String(offer.delai_jours),
                      }
                      return (
                        <tr key={offer.product_id}>
                          <td>{offer.product_name}</td>
                          <td>
                            <input
                              className="supplier-offer-input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={draft.price}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [offer.product_id]: { ...draft, price: e.target.value },
                                }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="supplier-offer-input"
                              type="number"
                              min="0"
                              step="1"
                              value={draft.delay}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [offer.product_id]: { ...draft, delay: e.target.value },
                                }))
                              }
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="supplier-offer-remove"
                              disabled={removingId === offer.product_id}
                              onClick={() => void removeOffer(offer.product_id, offer.product_name)}
                            >
                              {removingId === offer.product_id ? 'Suppression…' : 'Supprimer'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="supplier-products-panel__save">
            <button
              type="button"
              className="supplier-offer-save"
              disabled={savingSection}
              onClick={() => void saveSection()}
            >
              {savingSection ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
          </>
        )) : null}
      </section>

      <section className={`supplier-products-panel${pickerOpen ? '' : ' is-collapsed'}`}>
        <button
          type="button"
          className="supplier-products-panel__head"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
        >
          <h2>{pickerOpen ? '▾' : '▸'} Proposer des produits du catalogue</h2>
        </button>
        {pickerOpen ? <div className="supplier-picker">
          <div className="supplier-picker__browse">
            <div className="supplier-offer-search">
              <input
                className="supplier-offer-input supplier-offer-input--grow"
                value={query}
                placeholder="Nom ou référence"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runSearch()
                }}
              />
              <button type="button" className="supplier-offer-save" onClick={() => void runSearch()} disabled={searching}>
                Chercher
              </button>
            </div>
            {searchGroups ? (
              <div className="supplier-tree">
                <button
                  type="button"
                  className="supplier-crumb"
                  onClick={() => {
                    setQuery('')
                    setSearchGroups(null)
                  }}
                >
                  Retour aux catalogues
                </button>
                {searchGroups.length === 0 ? (
                  <p className="supplier-products-panel__hint">Aucun catalogue ne contient ce produit.</p>
                ) : (
                  searchGroups.map((group) => (
                    <div key={group.catalog_id} className="supplier-tree__folder">
                      <button
                        type="button"
                        className="supplier-tree__toggle"
                        onClick={() =>
                          setOpenSearch((prev) => ({ ...prev, [group.catalog_id]: !prev[group.catalog_id] }))
                        }
                      >
                        {openSearch[group.catalog_id] ? '▾' : '▸'} {group.catalog_label}
                        <span>{group.products.length}</span>
                      </button>
                      {openSearch[group.catalog_id] ? (
                        <ul className="supplier-tree__products">
                          {group.products.map((hit) => (
                            <li key={hit.product_id}>
                              <button type="button" onClick={() => addPick(hit)}>
                                {hit.product_name}
                              </button>
                              {hit.already_offered ? <span>déjà proposé</span> : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="supplier-tree">
                <p className="supplier-crumbs">
                  {crumbs.map((crumb, index) => (
                    <button
                      key={`${crumb.id ?? 'root'}-${index}`}
                      type="button"
                      className="supplier-crumb"
                      onClick={() => void showCatalog(crumb.id, crumbs.slice(0, index + 1))}
                    >
                      {crumb.name}
                    </button>
                  ))}
                </p>
                {browsing ? <p className="supplier-products-panel__hint">Chargement…</p> : null}
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    className="supplier-tree__folder-btn"
                    onClick={() =>
                      void showCatalog(folder.id, [
                        ...crumbs,
                        { id: folder.id, name: folder.name || 'Catalogue' },
                      ])
                    }
                  >
                    {folder.name || 'Catalogue'}
                  </button>
                ))}
                <ul className="supplier-tree__products">
                  {shelf.map((hit) => (
                    <li key={hit.product_id}>
                      <button type="button" onClick={() => addPick(hit)}>
                        {hit.product_name}
                      </button>
                      {hit.already_offered ? <span>déjà proposé</span> : null}
                    </li>
                  ))}
                </ul>
                {!browsing && folders.length === 0 && shelf.length === 0 ? (
                  <p className="supplier-products-panel__hint">Rien dans ce catalogue.</p>
                ) : null}
              </div>
            )}
          </div>
          <aside className="supplier-picker__cart">
            <h3>Sélection</h3>
            {pickRows.length === 0 ? (
              <p className="supplier-products-panel__hint">Choisissez un produit à gauche.</p>
            ) : (
              <ul className="supplier-pick-list">
                {pickRows.map(([id, row]) => (
                  <li key={id}>
                    <div className="supplier-pick-list__head">
                      <strong>{row.name}</strong>
                      <button
                        type="button"
                        onClick={() =>
                          setPicked((prev) => {
                            const next = { ...prev }
                            delete next[Number(id)]
                            return next
                          })
                        }
                      >
                        Retirer
                      </button>
                    </div>
                    <label>
                      prix :
                      <input
                        className="supplier-offer-input"
                        inputMode="decimal"
                        value={row.price}
                        onChange={(e) =>
                          setPicked((prev) => ({
                            ...prev,
                            [Number(id)]: { ...row, price: priceText(e.target.value) },
                          }))
                        }
                      />
                    </label>
                    <label>
                      delais :
                      <input
                        className="supplier-offer-input"
                        inputMode="numeric"
                        value={row.delay}
                        onChange={(e) =>
                          setPicked((prev) => ({
                            ...prev,
                            [Number(id)]: { ...row, delay: e.target.value.replace(/\D/g, '') },
                          }))
                        }
                      />
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="supplier-offer-save"
              disabled={!picksReady || savingPick}
              onClick={() => void savePicked()}
            >
              {savingPick ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </aside>
        </div> : null}
      </section>

      <div className="supplier-menu">
        <button
          type="button"
          className="supplier-menu__card"
          onClick={() => navigate('/fournisseur/expedition')}
        >
          <strong>Méthodes d&apos;expédition</strong>
          <span>Créer ou modifier vos tarifs de transport (2 étapes)</span>
        </button>
        <button
          type="button"
          className="supplier-menu__card"
          onClick={() => navigate('/fournisseur/paiement')}
        >
          <strong>Informations de paiement</strong>
          <span>Créer ou modifier une méthode et ses coordonnées bancaires</span>
        </button>
      </div>
    </main>
  )
}
