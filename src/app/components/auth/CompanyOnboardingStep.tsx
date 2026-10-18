import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  buildNewCompanyPayload,
  completeOnboardingCompany,
  fetchCompanyOptions,
  searchFrenchCompanies,
} from '../../api/company'
import { ApiError } from '../../api/client'
import type { SessionUser } from '../../types/auth'
import type { SiblingOnboardingPrefill } from '../../api/auth'
import {
  checkoutToNewCompanySeed,
  type AuthSignupPrefill,
} from '../../lib/authSignupPrefill'
import {
  ADDRESS_TYPE_PRESETS,
  emptyAddress,
  type CompanyOption,
  type EntrepriseSearchHit,
  type NewCompanyDraft,
} from '../../types/company'
import './CompanyOnboardingStep.css'

interface CompanyOnboardingStepProps {
  user: SessionUser
  siblingPrefill?: SiblingOnboardingPrefill | null
  checkoutPrefill?: AuthSignupPrefill | null
  loading: boolean
  setLoading: (v: boolean) => void
  error: string | null
  setError: (v: string | null) => void
  onSuccess: () => void
}

type AffiliationMode = 'existing' | 'new'

function isCompanyIdentifier(query: string): boolean {
  const compact = query.replace(/[\s.-]/g, '').toUpperCase()
  return /^FR\d{11}$/.test(compact) || /^\d{9}$/.test(compact) || /^\d{14}$/.test(compact)
}

export function CompanyOnboardingStep({
  user,
  siblingPrefill,
  checkoutPrefill,
  loading,
  setLoading,
  error,
  setError,
  onSuccess,
}: CompanyOnboardingStepProps) {
  const [mode, setMode] = useState<AffiliationMode>('existing')
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [selectedTva, setSelectedTva] = useState('')
  const [tvaVerification, setTvaVerification] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchHits, setSearchHits] = useState<EntrepriseSearchHit[]>([])
  const [searching, setSearching] = useState(false)

  const [newCo, setNewCo] = useState<NewCompanyDraft>({
    company_name: '',
    tva_intra_com: '',
    code_naf: '',
    email: '',
    phone_number: '',
    website: '',
    addresses: [],
  })

  useEffect(() => {
    fetchCompanyOptions()
      .then(setCompanies)
      .catch(() => setCompanies([]))
  }, [])

  useEffect(() => {
    const company = siblingPrefill?.company
    if (company) {
      if (company.affiliation_mode === 'existing' && company.tva_intra_com) {
        setMode('existing')
        setSelectedTva(company.tva_intra_com)
        setTvaVerification(company.tva_intra_com)
        return
      }

      if (company.company_name || company.tva_intra_com) {
        setMode('new')
        const addresses =
          company.addresses && company.addresses.length > 0
            ? company.addresses.map((addr, idx) => {
                const draft = emptyAddress(`addr-prefill-${idx}`)
                draft.street = addr.street
                draft.city = addr.city
                draft.zip_code = addr.zip_code
                draft.state = addr.state ?? ''
                draft.country_code = addr.country_code || 'FR'
                const preset = ADDRESS_TYPE_PRESETS.find((t) => t === addr.type)
                if (preset) {
                  draft.typePreset = preset
                } else if (addr.type) {
                  draft.typePreset = 'Autre'
                  draft.typeCustom = addr.type
                }
                return draft
              })
            : [emptyAddress('addr-1')]

        setNewCo({
          company_name: company.company_name ?? '',
          tva_intra_com: company.tva_intra_com ?? '',
          code_naf: company.code_naf ?? '',
          email: company.email ?? '',
          phone_number: company.phone_number ?? '',
          website: company.website ?? '',
          addresses,
        })
        return
      }
    }

    // Prefill depuis le chiffrage (création de compte pour envoi de demande)
    const seed = checkoutToNewCompanySeed(checkoutPrefill ?? null)
    if (!seed) return
    setMode('new')
    setNewCo((prev) => ({
      ...prev,
      company_name: seed.company_name || prev.company_name,
      email: seed.email || prev.email || user.email || '',
      phone_number: seed.phone_number || prev.phone_number,
      addresses:
        seed.addresses.some((a) => a.street || a.city || a.zip_code)
          ? seed.addresses
          : prev.addresses.length > 0
            ? prev.addresses
            : [emptyAddress('addr-1')],
    }))
  }, [siblingPrefill, checkoutPrefill, user.email])

  useEffect(() => {
    if (mode !== 'new' || searchQuery.trim().length < 2) {
      setSearchHits([])
      return
    }
    const timer = window.setTimeout(() => {
      setSearching(true)
      searchFrenchCompanies(searchQuery.trim())
        .then(setSearchHits)
        .catch(() => setSearchHits([]))
        .finally(() => setSearching(false))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [searchQuery, mode])

  const applySearchHit = (hit: EntrepriseSearchHit) => {
    setSearchQuery(hit.company_name)
    setSearchHits([])
    const firstAddr = emptyAddress('addr-1')
    if (hit.street) firstAddr.street = hit.street
    if (hit.zip_code) firstAddr.zip_code = hit.zip_code
    if (hit.city) firstAddr.city = hit.city
    if (hit.state) firstAddr.state = hit.state
    if (hit.country_code) firstAddr.country_code = hit.country_code

    setNewCo({
      company_name: hit.company_name,
      tva_intra_com: hit.tva_intra_com ?? '',
      code_naf: hit.code_naf ?? '',
      email: '',
      phone_number: '',
      website: '',
      addresses: [firstAddr],
    })
  }

  const visibleCount = () => newCo.addresses.filter((a) => a.expanded).length

  const addAddress = () => {
    if (visibleCount() >= 3) return
    setNewCo((c) => ({
      ...c,
      addresses: [...c.addresses, emptyAddress(`addr-${Date.now()}`)],
    }))
  }

  const removeAddress = (id: string) => {
    const expanded = newCo.addresses.filter((a) => a.expanded)
    if (expanded.length <= 1) return
    const index = expanded.findIndex((a) => a.id === id)
    if (index <= 0) return
    setNewCo((c) => ({
      ...c,
      addresses: c.addresses.filter((a) => a.id !== id),
    }))
  }

  const updateAddress = (id: string, patch: Partial<NewCompanyDraft['addresses'][0]>) => {
    setNewCo((c) => ({
      ...c,
      addresses: c.addresses.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'existing') {
        if (!selectedTva) {
          setError('Sélectionnez une société dans la liste.')
          return
        }
        if (!tvaVerification.trim()) {
          setError('Saisissez le numéro de TVA pour confirmer votre affiliation.')
          return
        }
        await completeOnboardingCompany({
          user_id: user.user_id,
          email: user.email,
          existing_company: {
            company_id: selectedTva,
            tva_verification: tvaVerification.trim(),
          },
        })
      } else {
        if (!newCo.company_name.trim() || !newCo.tva_intra_com.trim() || !newCo.code_naf.trim()) {
          setError('Nom, TVA intracommunautaire et code NAF sont obligatoires.')
          return
        }
        const activeAddresses = newCo.addresses.filter((a) => a.expanded)
        if (activeAddresses.length === 0) {
          setError('Ajoutez au moins une adresse.')
          return
        }
        for (const addr of activeAddresses) {
          if (!addr.street.trim() || !addr.city.trim() || !addr.zip_code.trim()) {
            setError('Chaque adresse doit avoir rue, ville et code postal.')
            return
          }
        }
        await completeOnboardingCompany({
          user_id: user.user_id,
          email: user.email,
          new_company: buildNewCompanyPayload(newCo),
        })
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.')
    } finally {
      setLoading(false)
    }
  }

  const visibleAddresses = newCo.addresses.filter((a) => a.expanded)
  const selectedCompany = companies.find((c) => c.tva_intra_com === selectedTva) ?? null

  const handleCompanySelect = (tva: string) => {
    setSelectedTva(tva)
    if (tva) {
      setTvaVerification(tva)
    }
  }

  return (
    <form className="company-step" onSubmit={handleSubmit}>
      <p className="auth-modal__hint">
        Indiquez pour quelle entreprise vous travaillez. Plusieurs utilisateurs peuvent être
        rattachés à la même société.
        {siblingPrefill?.has_sibling ? (
          <>
            {' '}
            Les informations de votre autre compte Urbyn ont été préremplies.
          </>
        ) : null}
      </p>

      <div className="company-step__modes">
        <button
          type="button"
          className={mode === 'existing' ? 'auth-tabs__btn auth-tabs__btn--active' : 'auth-tabs__btn'}
          onClick={() => setMode('existing')}
        >
          Société déjà enregistrée
        </button>
        <button
          type="button"
          className={mode === 'new' ? 'auth-tabs__btn auth-tabs__btn--active' : 'auth-tabs__btn'}
          onClick={() => setMode('new')}
        >
          Nouvelle société
        </button>
      </div>

      {error ? <p className="auth-modal__error" role="alert">{error}</p> : null}

      {mode === 'existing' ? (
        <div className="company-step__panel">
          <label className="field">
            <span>Choisir une société</span>
            <select
              className="company-select"
              value={selectedTva}
              onChange={(e) => handleCompanySelect(e.target.value)}
            >
              <option value="">— Sélectionnez une société —</option>
              {companies.map((c) => (
                <option key={c.tva_intra_com} value={c.tva_intra_com}>
                  {c.company_name} ({c.tva_intra_com})
                </option>
              ))}
            </select>
            {companies.length === 0 ? (
              <span className="company-step__hint">
                Aucune société en base pour le moment — créez la vôtre dans l&apos;onglet « Nouvelle société ».
              </span>
            ) : (
              <span className="company-step__hint">
                Sociétés déjà enregistrées sur Urbyn (y compris sans utilisateur actif).
              </span>
            )}
          </label>

          {selectedCompany ? (
            <div className="company-selected" aria-live="polite">
              <div className="company-selected__content">
                <p className="company-selected__label">Société sélectionnée</p>
                <p className="company-selected__name">{selectedCompany.company_name}</p>
                <p className="company-selected__tva">TVA {selectedCompany.tva_intra_com}</p>
              </div>
              <button
                type="button"
                className="company-selected__change"
                onClick={() => {
                  setSelectedTva('')
                  setTvaVerification('')
                }}
              >
                Changer
              </button>
            </div>
          ) : null}

          <label className="field">
            <span>Confirmer la TVA intracommunautaire</span>
            <input
              value={tvaVerification}
              onChange={(e) => setTvaVerification(e.target.value)}
              placeholder="FR12345678901"
              required
            />
            <span className="company-step__hint">
              Saisissez la TVA de votre employeur pour vérifier votre affiliation.
            </span>
          </label>
        </div>
      ) : (
        <div className="company-step__panel">
          <label className="field">
            <span>Rechercher une entreprise (France)</span>
            <input
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value
                setSearchQuery(value)
                if (!isCompanyIdentifier(value)) {
                  setNewCo((c) => ({ ...c, company_name: value }))
                }
              }}
              placeholder="Nom, SIREN ou TVA intracommunautaire"
              autoComplete="off"
            />
            <span className="company-step__hint">
              Par nom, par SIREN ou par TVA intracommunautaire.
            </span>
          </label>

          {searching ? <p className="company-step__hint">Recherche…</p> : null}
          {searchHits.length > 0 ? (
            <ul className="company-search-hits">
              {searchHits.map((hit) => (
                <li key={hit.siren}>
                  <button type="button" onClick={() => applySearchHit(hit)}>
                    <strong>{hit.company_name}</strong>
                    <span> · SIREN {hit.siren}</span>
                    {hit.tva_intra_com ? (
                      <span> · TVA {hit.tva_intra_com}</span>
                    ) : null}
                    {hit.city ? (
                      <span>
                        {' '}
                        — {hit.zip_code} {hit.city}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <label className="field">
            <span>Nom de la société</span>
            <input
              value={newCo.company_name}
              onChange={(e) => setNewCo((c) => ({ ...c, company_name: e.target.value }))}
              required
            />
          </label>
          <div className="auth-form__row auth-form__row--two">
            <label className="field">
              <span>TVA intracommunautaire</span>
              <input
                value={newCo.tva_intra_com}
                onChange={(e) => setNewCo((c) => ({ ...c, tva_intra_com: e.target.value }))}
                placeholder="FR12345678901"
                required
              />
            </label>
            <label className="field">
              <span>Code NAF</span>
              <input
                value={newCo.code_naf}
                onChange={(e) => setNewCo((c) => ({ ...c, code_naf: e.target.value }))}
                placeholder="62.01Z"
                required
              />
            </label>
          </div>

          <div className="company-step__optional">
            <p className="company-step__optional-title">Recommandé</p>
            <label className="field">
              <span>Email professionnel</span>
              <input
                type="email"
                value={newCo.email}
                onChange={(e) => setNewCo((c) => ({ ...c, email: e.target.value }))}
              />
            </label>
            <div className="auth-form__row auth-form__row--two">
              <label className="field">
                <span>Téléphone pro</span>
                <input
                  type="tel"
                  value={newCo.phone_number}
                  onChange={(e) => setNewCo((c) => ({ ...c, phone_number: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Site web</span>
                <input
                  type="url"
                  value={newCo.website}
                  onChange={(e) => setNewCo((c) => ({ ...c, website: e.target.value }))}
                  placeholder="https://"
                />
              </label>
            </div>
          </div>

          <div className="company-step__addresses">
            <p className="company-step__addresses-title">Adresses (1 à 3)</p>
            {visibleAddresses.map((addr, index) => (
              <div key={addr.id} className="company-address-card">
                <div className="company-address-card__header">
                  <p className="company-address-card__title">
                    Adresse {index + 1}
                    {index === 0 ? ' (obligatoire)' : ''}
                  </p>
                  {index > 0 ? (
                    <button
                      type="button"
                      className="company-address-card__remove"
                      onClick={() => removeAddress(addr.id)}
                    >
                      Supprimer
                    </button>
                  ) : null}
                </div>
                <label className="field">
                  <span>Type</span>
                  <select
                    value={addr.typePreset}
                    onChange={(e) =>
                      updateAddress(addr.id, { typePreset: e.target.value })
                    }
                  >
                    {ADDRESS_TYPE_PRESETS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="Autre">Autre (personnalisé)</option>
                  </select>
                </label>
                {addr.typePreset === 'Autre' ? (
                  <label className="field">
                    <span>Type personnalisé</span>
                    <input
                      value={addr.typeCustom}
                      onChange={(e) =>
                        updateAddress(addr.id, { typeCustom: e.target.value })
                      }
                    />
                  </label>
                ) : null}
                <label className="field">
                  <span>Rue</span>
                  <input
                    value={addr.street}
                    onChange={(e) => updateAddress(addr.id, { street: e.target.value })}
                    required
                  />
                </label>
                <div className="auth-form__row auth-form__row--two">
                  <label className="field">
                    <span>Code postal</span>
                    <input
                      value={addr.zip_code}
                      onChange={(e) => updateAddress(addr.id, { zip_code: e.target.value })}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Ville</span>
                    <input
                      value={addr.city}
                      onChange={(e) => updateAddress(addr.id, { city: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div className="auth-form__row auth-form__row--two">
                  <label className="field">
                    <span>Département</span>
                    <input
                      value={addr.state}
                      onChange={(e) => updateAddress(addr.id, { state: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Pays</span>
                    <input
                      value={addr.country_code}
                      onChange={(e) =>
                        updateAddress(addr.id, { country_code: e.target.value })
                      }
                      maxLength={2}
                    />
                  </label>
                </div>
              </div>
            ))}
            {visibleAddresses.length < 3 ? (
              <button type="button" className="btn btn--ghost btn--block" onClick={addAddress}>
                + Ajouter une adresse
              </button>
            ) : null}
          </div>
        </div>
      )}

      <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
        {loading ? 'Enregistrement…' : 'Terminer mon inscription'}
      </button>
    </form>
  )
}
