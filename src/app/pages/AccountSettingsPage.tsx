import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useAuth } from '../context/AuthContext'
import { saveSession } from '../api/auth'
import {
  addAccountAddress,
  changeAccountPassword,
  confirmEmailChange,
  deleteAccountAddress,
  fetchAccountProfile,
  setAccountAddressCatalogs,
  startEmailChange,
  updateAccountAddress,
  updateAccountProfile,
  type AccountProfile,
} from '../api/orders'
import { fetchCatalogs } from '../api/supplierPortal'
import type { CatalogRecord } from '../types/supplierPortal'

export function AccountSettingsPage() {
  const navigate = useNavigate()
  const { isLoggedIn, ready, session, setSessionUser, isBuyer, isSupplier } = useAuth()
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [mobile, setMobile] = useState('')
  const [title, setTitle] = useState('')

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')

  const [newEmail, setNewEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailCodeSent, setEmailCodeSent] = useState(false)

  const [addrStreet, setAddrStreet] = useState('')
  const [addrCity, setAddrCity] = useState('')
  const [addrZip, setAddrZip] = useState('')
  const [addrCountry, setAddrCountry] = useState('FR')
  const [addrLabel, setAddrLabel] = useState('')

  const [catalogs, setCatalogs] = useState<CatalogRecord[]>([])
  const [catalogFilter, setCatalogFilter] = useState('')
  const [draftCatalogIds, setDraftCatalogIds] = useState<Record<number, number[]>>({})
  const [savingCatalogsFor, setSavingCatalogsFor] = useState<number | null>(null)

  const backPath = isSupplier ? '/fournisseur/leads' : '/compte/commandes'

  useEffect(() => {
    if (!ready) return
    if (!isLoggedIn) {
      navigate('/')
      return
    }
    fetchAccountProfile()
      .then((p) => {
        setProfile(p)
        setFirstName(p.first_name || '')
        setLastName(p.last_name || '')
        setMobile(p.mobile_phone || '')
        setTitle(p.title || '')
        const drafts: Record<number, number[]> = {}
        for (const a of p.addresses || []) {
          drafts[a.id] = a.catalog_ids || a.catalogs?.map((c) => c.id) || []
        }
        setDraftCatalogIds(drafts)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [ready, isLoggedIn, navigate])

  useEffect(() => {
    if (!ready || !isLoggedIn || !isSupplier || !session) return
    fetchCatalogs({ user_id: session.user_id, email: session.email })
      .then(setCatalogs)
      .catch(() => {
        /* catalogue optionnel si API indisponible */
      })
  }, [ready, isLoggedIn, isSupplier, session])

  const filteredCatalogs = useMemo(() => {
    const q = catalogFilter.trim().toLowerCase()
    if (!q) return catalogs
    return catalogs.filter((c) => {
      const name = (c.name || '').toLowerCase()
      const crumb = (c.breadcrumb || []).join(' ').toLowerCase()
      return name.includes(q) || crumb.includes(q) || String(c.id).includes(q)
    })
  }, [catalogs, catalogFilter])

  const flash = (ok: string) => {
    setMsg(ok)
    setError(null)
  }

  const toggleCatalog = (addressId: number, catalogId: number) => {
    setDraftCatalogIds((prev) => {
      const current = new Set(prev[addressId] || [])
      if (current.has(catalogId)) current.delete(catalogId)
      else current.add(catalogId)
      return { ...prev, [addressId]: [...current].sort((a, b) => a - b) }
    })
  }

  const saveCatalogs = async (addressId: number) => {
    setError(null)
    setSavingCatalogsFor(addressId)
    try {
      const p = await setAccountAddressCatalogs(
        addressId,
        draftCatalogIds[addressId] || [],
      )
      setProfile(p)
      const drafts: Record<number, number[]> = {}
      for (const a of p.addresses || []) {
        drafts[a.id] = a.catalog_ids || a.catalogs?.map((c) => c.id) || []
      }
      setDraftCatalogIds(drafts)
      flash('Catalogues associés à l’adresse.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSavingCatalogsFor(null)
    }
  }

  const saveProfile = async () => {
    setError(null)
    try {
      const p = await updateAccountProfile({
        title: title || null,
        first_name: firstName,
        last_name: lastName,
        mobile_phone: mobile,
      })
      setProfile(p)
      if (session) {
        const updated = {
          ...session,
          first_name: p.first_name,
          last_name: p.last_name,
          mobile_phone: p.mobile_phone,
        }
        saveSession(updated)
        setSessionUser(updated)
      }
      flash('Profil mis à jour.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  const savePassword = async () => {
    setError(null)
    try {
      const res = await changeAccountPassword({
        current_password: currentPwd,
        new_password: newPwd,
        confirm_password: confirmPwd,
      })
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
      flash(res.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  const requestEmailCode = async () => {
    setError(null)
    try {
      const res = await startEmailChange(newEmail)
      setEmailCodeSent(true)
      flash(res.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  const confirmEmail = async () => {
    setError(null)
    try {
      const p = await confirmEmailChange(emailCode)
      setProfile(p)
      if (session) {
        const updated = { ...session, email: p.email }
        saveSession(updated)
        setSessionUser(updated)
      }
      setEmailCodeSent(false)
      setNewEmail('')
      setEmailCode('')
      flash('Email mis à jour.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  const addAddress = async () => {
    setError(null)
    try {
      const label = addrLabel.trim() || 'Adresse'
      const p = await addAccountAddress({
        type: 'delivery',
        label,
        street: addrStreet,
        city: addrCity,
        zip_code: addrZip,
        country_code: addrCountry,
        is_primary: (profile?.addresses.length || 0) === 0,
      })
      setProfile(p)
      setAddrStreet('')
      setAddrCity('')
      setAddrZip('')
      setAddrLabel('')
      flash('Adresse ajoutée.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-[var(--header-height)] px-4 py-10 text-gray-500">
        Chargement…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-[var(--header-height)]">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link
            to={backPath}
            className="inline-flex items-center text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Link>
          <h1 className="text-2xl font-bold text-black">Settings</h1>
        </div>

        {msg ? <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{msg}</p> : null}
        {error ? <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p> : null}

        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-bold text-black">Identité</h2>
          <p className="text-xs text-gray-500">
            Compte {isBuyer ? 'client' : isSupplier ? 'fournisseur' : ''} · {profile?.email}
            {profile?.company_name ? ` · ${profile.company_name}` : ''}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Civilité</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="M. / Mme" />
            </div>
            <div />
            <div>
              <Label className="text-xs">Prénom</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Nom</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Téléphone</Label>
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
          </div>
          <Button onClick={saveProfile} className="bg-black text-white">
            Enregistrer le profil
          </Button>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-bold text-black">Mot de passe</h2>
          <div>
            <Label className="text-xs">Mot de passe actuel</Label>
            <Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Nouveau mot de passe</Label>
            <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Confirmer le nouveau mot de passe</Label>
            <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
          </div>
          <Button onClick={savePassword} className="bg-black text-white">
            Changer le mot de passe
          </Button>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-bold text-black">Changer d&apos;email</h2>
          <p className="text-xs text-gray-500">
            Un code de confirmation sera envoyé à la nouvelle adresse (Resend).
          </p>
          <div>
            <Label className="text-xs">Nouvel email</Label>
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          {!emailCodeSent ? (
            <Button onClick={requestEmailCode} className="bg-black text-white" disabled={!newEmail}>
              Envoyer le code
            </Button>
          ) : (
            <>
              <div>
                <Label className="text-xs">Code reçu par email</Label>
                <Input value={emailCode} onChange={(e) => setEmailCode(e.target.value)} maxLength={6} />
              </div>
              <Button onClick={confirmEmail} className="bg-black text-white" disabled={emailCode.length !== 6}>
                Confirmer le nouvel email
              </Button>
            </>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-bold text-black">Adresses</h2>
          {isSupplier ? (
            <p className="text-xs text-gray-500">
              Associez un ou plusieurs catalogues à chaque adresse labellisée. Les produits
              de votre société dans ces catalogues (et sous-catalogues) partiront de cette
              adresse pour le calcul de livraison. Sans association → fallback 75015.
            </p>
          ) : null}
          {isSupplier && catalogs.length > 0 ? (
            <Input
              placeholder="Filtrer les catalogues…"
              value={catalogFilter}
              onChange={(e) => setCatalogFilter(e.target.value)}
            />
          ) : null}
          {(profile?.addresses || []).map((a) => {
            const selected = new Set(draftCatalogIds[a.id] || [])
            return (
              <div
                key={a.id}
                className="border border-gray-100 rounded-lg p-3 text-sm space-y-3"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium text-black">
                      {a.label || a.type}
                      {a.is_primary ? ' · principale' : ''}
                    </p>
                    <p className="text-gray-600">
                      {[a.street, `${a.zip_code || ''} ${a.city || ''}`.trim(), a.country_code]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    {(a.catalogs || []).length > 0 ? (
                      <p className="text-xs text-gray-500 mt-1">
                        Catalogues liés :{' '}
                        {(a.catalogs || []).map((c) => c.name || `#${c.id}`).join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!a.is_primary ? (
                      <button
                        type="button"
                        className="text-xs underline text-gray-600"
                        onClick={async () => {
                          try {
                            const p = await updateAccountAddress({
                              address_id: a.id,
                              type: a.type,
                              label: a.label || a.type,
                              street: a.street || undefined,
                              city: a.city || undefined,
                              zip_code: a.zip_code || undefined,
                              country_code: a.country_code || 'FR',
                              is_primary: true,
                            })
                            setProfile(p)
                            flash('Adresse principale mise à jour.')
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Erreur')
                          }
                        }}
                      >
                        Principale
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-red-500"
                      onClick={async () => {
                        try {
                          setProfile(await deleteAccountAddress(a.id))
                          flash('Adresse supprimée.')
                        } catch (e) {
                          setError(e instanceof Error ? e.message : 'Erreur')
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isSupplier ? (
                  <div className="border-t border-gray-50 pt-2 space-y-2">
                    <p className="text-xs font-medium text-gray-700">
                      Catalogues / sous-catalogues expédiés depuis cette adresse
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1 rounded border border-gray-100 p-2">
                      {filteredCatalogs.length === 0 ? (
                        <p className="text-xs text-gray-400">Aucun catalogue trouvé.</p>
                      ) : (
                        filteredCatalogs.map((c) => {
                          const checked = selected.has(c.id)
                          const label =
                            (c.breadcrumb && c.breadcrumb.length
                              ? c.breadcrumb.join(' / ')
                              : null) ||
                            c.name ||
                            `Catalogue #${c.id}`
                          return (
                            <label
                              key={c.id}
                              className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={checked}
                                onChange={() => toggleCatalog(a.id, c.id)}
                              />
                              <span>{label}</span>
                            </label>
                          )
                        })
                      )}
                    </div>
                    <Button
                      type="button"
                      className="bg-black text-white"
                      disabled={savingCatalogsFor === a.id}
                      onClick={() => saveCatalogs(a.id)}
                    >
                      {savingCatalogsFor === a.id
                        ? 'Enregistrement…'
                        : 'Enregistrer les catalogues'}
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })}

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-sm font-medium flex items-center gap-1">
              <Plus className="w-4 h-4" /> Ajouter une adresse
            </p>
            <Input
              placeholder="Libellé (ex. Entrepôt Lyon, Entrepôt Paris)"
              value={addrLabel}
              onChange={(e) => setAddrLabel(e.target.value)}
            />
            <Input placeholder="Rue" value={addrStreet} onChange={(e) => setAddrStreet(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Code postal" value={addrZip} onChange={(e) => setAddrZip(e.target.value)} />
              <Input placeholder="Ville" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
            </div>
            <Input placeholder="Pays (code)" value={addrCountry} onChange={(e) => setAddrCountry(e.target.value)} />
            <Button onClick={addAddress} className="bg-black text-white" disabled={!addrStreet || !addrCity}>
              Ajouter
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
