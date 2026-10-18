import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteAdminCompany, displayRole, fetchAdminCompany, userDisplayName } from '../../api/adminAccounts'
import { AdminTopBar } from './AdminDashboardPage'
import { AdminBackLink, AdminFieldGrid, AdminIdentityCard } from './AdminAccountsShared'
import './Admin.css'

export function AdminCompanyDetailPage() {
  const { tva } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchAdminCompany>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tva) return
    fetchAdminCompany(decodeURIComponent(tva))
      .then(setDetail)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [tva])

  async function handleDelete() {
    if (!detail) return
    const msg =
      `Supprimer définitivement la société « ${detail.company_name} » ?\n\n` +
      'TOUT sera effacé : produits, utilisateurs liés, adresses, expédition, paiements, etc.\n' +
      'Cette action est irréversible.'
    if (!window.confirm(msg)) return
    setDeleting(true)
    setError(null)
    try {
      await deleteAdminCompany(detail.tva_intra_com)
      navigate('/admin/societes')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible.')
      setDeleting(false)
    }
  }

  return (
    <div className="admin-page">
      <AdminTopBar title="Fiche société" />
      <main className="admin-page__main">
        <AdminBackLink to="/admin/societes" label="Retour aux sociétés" />
        {error ? <p className="admin-alert admin-alert--error">{error}</p> : null}
        {loading ? (
          <p className="admin-catalog__hint">Chargement…</p>
        ) : detail ? (
          <AdminIdentityCard
            title={detail.company_name}
            subtitle={`TVA ${detail.tva_intra_com}`}
            deleteLabel="Supprimer la société"
            deleting={deleting}
            onDelete={() => void handleDelete()}
          >
            <AdminFieldGrid
              items={[
                { label: 'Email société', value: detail.email },
                { label: 'Téléphone', value: detail.phone_number },
                { label: 'Code NAF', value: detail.code_naf },
                { label: 'Branche', value: detail.branche },
                { label: 'Site web', value: detail.website },
                { label: 'TVA (%)', value: detail.vat_rate != null ? String(detail.vat_rate) : null },
                { label: 'Abonné', value: detail.abonne ? 'Oui' : 'Non' },
                { label: 'Vérifiée', value: detail.is_verified ? 'Oui' : 'Non' },
                { label: 'CGV acceptées', value: detail.cgv_accepted ? 'Oui' : 'Non' },
                { label: 'Produits', value: String(detail.product_count) },
                { label: 'Grilles expédition', value: String(detail.shipping_rate_count) },
                { label: 'Moyens de paiement', value: String(detail.payment_method_count) },
                { label: 'Créée le', value: new Date(detail.created_at).toLocaleString('fr-FR') },
              ]}
            />
            {detail.description ? (
              <section className="admin-identity__section">
                <h3>Description</h3>
                <p>{detail.description}</p>
              </section>
            ) : null}
            {detail.condition_reglement ? (
              <section className="admin-identity__section">
                <h3>Conditions de règlement</h3>
                <p>{detail.condition_reglement}</p>
              </section>
            ) : null}
            {detail.addresses.length > 0 ? (
              <section className="admin-identity__section">
                <h3>Adresses</h3>
                <ul className="admin-identity__list">
                  {detail.addresses.map((a) => (
                    <li key={a.id}>
                      <strong>{a.type}</strong>
                      {a.is_primary ? ' (principale)' : ''} — {[a.street, a.zip_code, a.city, a.country_code]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {detail.users.length > 0 ? (
              <section className="admin-identity__section">
                <h3>Utilisateurs liés</h3>
                <ul className="admin-identity__list">
                  {detail.users.map((u) => (
                    <li key={u.id}>
                      {userDisplayName(u)} — {u.email} ({displayRole(u.role)})
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </AdminIdentityCard>
        ) : null}
      </main>
    </div>
  )
}
